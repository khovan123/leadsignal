chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'LEADSIGNAL_CAPTURE_PAGE') return false;
  crawlConfiguredPosts(message.settings || {}, message.sourceId)
    .then((batch) => sendResponse({ ok: true, batch }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

async function crawlConfiguredPosts(rawSettings, sourceId) {
  const settings = normalizeSettings(rawSettings);
  const selector = 'shreddit-post,article[data-testid="post-container"],[data-testid="post-container"],.thing.link[data-fullname^="t3_"]';
  const posts = new Map();
  let stalls = 0;

  for (let round = 0; round <= settings.maxScrolls && posts.size < settings.targetPostCount; round += 1) {
    const before = posts.size;
    for (const element of document.querySelectorAll(selector)) {
      if (posts.size >= settings.targetPostCount) break;
      const post = parseRenderedPost(element, settings);
      if (!post || posts.has(post.externalPostId)) continue;
      posts.set(post.externalPostId, post);
    }

    if (posts.size >= settings.targetPostCount) break;
    stalls = posts.size === before ? stalls + 1 : 0;
    if (stalls >= settings.maxStallRounds) break;

    const elements = document.querySelectorAll(selector);
    elements.item(elements.length - 1)?.scrollIntoView({ block: 'end' });
    window.scrollBy(0, Math.max(500, Math.floor(window.innerHeight * 0.9)));
    await waitForMoreCards(selector, elements.length);
  }

  const current = new URL(location.href);
  const detected = detectSource(current);
  return {
    source: {
      sourceId: sourceId || undefined,
      type: settings.type || detected.type,
      name: settings.name || detected.name,
      subreddit: settings.subreddit || detected.subreddit,
      searchQuery: settings.searchQuery || detected.searchQuery,
      url: current.href,
    },
    posts: [...posts.values()].slice(0, settings.targetPostCount),
    capturedAt: new Date().toISOString(),
  };
}

function normalizeSettings(value) {
  return {
    type: String(value.type || '').toUpperCase() || undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    subreddit: typeof value.subreddit === 'string' ? value.subreddit : undefined,
    searchQuery: typeof value.searchQuery === 'string' ? value.searchQuery : undefined,
    targetPostCount: boundedInteger(value.targetPostCount, 50, 1, 2000),
    maxScrolls: boundedInteger(value.maxScrolls, 20, 1, 100),
    maxStallRounds: boundedInteger(value.maxStallRounds, 4, 1, 12),
    includePromoted: Boolean(value.includePromoted),
    includePinned: Boolean(value.includePinned),
    includeNsfw: Boolean(value.includeNsfw),
  };
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

async function waitForMoreCards(selector, previousCount) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (document.querySelectorAll(selector).length > previousCount) return;
  }
}

function detectSource(current) {
  const path = current.pathname;
  if (/^\/r\/popular(?:\/|$)/i.test(path)) return { type: 'POPULAR', name: 'Reddit Popular' };
  if (/^\/news(?:\/|$)/i.test(path)) return { type: 'NEWS', name: 'Reddit News' };
  if (/^\/(?:best|posts)(?:\/|$)/i.test(path)) return { type: 'BEST', name: 'Reddit Best' };
  if (/^\/new(?:\/|$)/i.test(path)) return { type: 'LATEST', name: 'Reddit Latest' };
  if (/^\/search(?:\/|$)/i.test(path)) {
    return { type: 'SEARCH', name: 'Reddit Search', searchQuery: current.searchParams.get('q') || undefined };
  }
  const subreddit = path.match(/^\/r\/([^/]+)/i)?.[1];
  if (subreddit) return { type: 'SUBREDDIT', name: `r/${subreddit}`, subreddit };
  if (path === '/' || /^\/(?:home)?$/i.test(path)) return { type: 'FOLLOWING', name: 'Reddit Following' };
  return { type: 'CUSTOM_URL', name: 'Reddit browser URL', url: current.href };
}

function parseRenderedPost(element, settings) {
  const host = element.matches('shreddit-post') ? element : element.querySelector('shreddit-post') || element;
  const container = element.closest('article') || element.closest('.thing.link') || element;
  const promoted = host.hasAttribute('is-promoted') || Boolean(container.querySelector('[aria-label*="promoted" i],[data-testid*="promoted" i]'));
  const pinned = host.hasAttribute('is-stickied') || host.hasAttribute('stickied') || container.classList.contains('stickied');
  const nsfw = host.hasAttribute('is-nsfw') || container.classList.contains('over18') || Boolean(container.querySelector('[aria-label*="nsfw" i]'));
  if ((promoted && !settings.includePromoted) || (pinned && !settings.includePinned) || (nsfw && !settings.includeNsfw)) return null;

  const clean = (value) => value?.replace(/\s+/g, ' ').trim() || undefined;
  const absolute = (value) => {
    try { return value ? new URL(value, location.origin).href : undefined; }
    catch { return undefined; }
  };
  const count = (value) => {
    const text = String(value || '').toLowerCase().replace(/,/g, '');
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return 0;
    let number = Number(match[0]);
    if (text.includes('k')) number *= 1000;
    if (text.includes('m')) number *= 1000000;
    return Math.max(0, Math.round(number));
  };
  const permalink = absolute(
    host.getAttribute('permalink') ||
      host.getAttribute('data-permalink') ||
      container.getAttribute('data-permalink') ||
      container.querySelector('a[href*="/comments/"]')?.getAttribute('href'),
  );
  const idFromUrl = permalink?.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i)?.[1];
  const rawId = host.getAttribute('id') || host.getAttribute('data-fullname') || host.getAttribute('data-post-id') || container.getAttribute('data-fullname');
  const externalPostId = rawId?.startsWith('t3_') ? rawId : idFromUrl ? `t3_${idFromUrl}` : undefined;
  const title = clean(host.getAttribute('post-title') || container.querySelector('[slot="title"],a.title,[data-testid="post-title"],h1,h2,h3')?.innerText);
  if (!externalPostId || !permalink || !title) return null;
  return {
    externalPostId,
    title,
    body: clean(container.querySelector('[slot="text-body"],shreddit-post-text-body,[data-testid="post-content"],.usertext-body .md')?.innerText) || '',
    authorUsername: clean(host.getAttribute('author') || container.querySelector('a[href*="/user/"]')?.textContent)?.replace(/^u\//i, ''),
    subreddit: clean(host.getAttribute('subreddit-prefixed-name') || host.getAttribute('subreddit-name') || container.querySelector('a[href^="/r/"]')?.textContent)?.replace(/^r\//i, ''),
    permalink,
    score: count(host.getAttribute('score') || container.querySelector('[data-testid="post-vote-count"],.score')?.innerText),
    commentCount: count(host.getAttribute('comment-count') || container.querySelector('[data-testid="comment-count"],a.comments')?.innerText),
    postedAt: host.getAttribute('created-timestamp') || container.querySelector('time[datetime]')?.getAttribute('datetime'),
  };
}
