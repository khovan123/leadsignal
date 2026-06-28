chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'LEADSIGNAL_CAPTURE_PAGE') return false;
  try {
    sendResponse({ ok: true, batch: captureRenderedPosts(message.limit) });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
  return false;
});

function captureRenderedPosts(requestedLimit) {
  const limit = Math.max(1, Math.min(Number(requestedLimit) || 50, 2000));
  const selector = 'shreddit-post,article[data-testid="post-container"],[data-testid="post-container"],.thing.link[data-fullname^="t3_"]';
  const posts = [];
  const seen = new Set();
  for (const element of document.querySelectorAll(selector)) {
    if (posts.length >= limit) break;
    const post = parseRenderedPost(element);
    if (!post || seen.has(post.externalPostId)) continue;
    seen.add(post.externalPostId);
    posts.push(post);
  }
  const current = new URL(location.href);
  const source = detectSource(current);
  return {
    source,
    posts,
    capturedAt: new Date().toISOString(),
  };
}

function detectSource(current) {
  const path = current.pathname;
  if (/^\/r\/popular(?:\/|$)/i.test(path)) {
    return { type: 'POPULAR', name: 'Reddit Popular' };
  }
  if (/^\/news(?:\/|$)/i.test(path)) {
    return { type: 'NEWS', name: 'Reddit News' };
  }
  if (/^\/(?:best|posts)(?:\/|$)/i.test(path)) {
    return { type: 'BEST', name: 'Reddit Best' };
  }
  if (/^\/new(?:\/|$)/i.test(path)) {
    return { type: 'LATEST', name: 'Reddit Latest' };
  }
  if (/^\/search(?:\/|$)/i.test(path)) {
    return {
      type: 'SEARCH',
      name: 'Reddit Search',
      searchQuery: current.searchParams.get('q') || undefined,
    };
  }
  const subreddit = path.match(/^\/r\/([^/]+)/i)?.[1];
  if (subreddit) {
    return {
      type: 'SUBREDDIT',
      name: `r/${subreddit}`,
      subreddit,
    };
  }
  if (path === '/' || /^\/(?:home)?$/i.test(path)) {
    return { type: 'FOLLOWING', name: 'Reddit Following' };
  }
  return {
    type: 'CUSTOM_URL',
    name: 'Reddit browser URL',
    url: current.href,
  };
}

function parseRenderedPost(element) {
  const host = element.matches('shreddit-post') ? element : element.querySelector('shreddit-post') || element;
  const container = element.closest('article') || element.closest('.thing.link') || element;
  if (host.hasAttribute('is-promoted') || host.hasAttribute('is-stickied') || container.classList.contains('stickied')) return null;
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
