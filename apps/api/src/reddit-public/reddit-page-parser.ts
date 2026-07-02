import type { Page } from 'playwright';

export const REDDIT_POST_SELECTOR = [
  'shreddit-post',
  'article[data-testid="post-container"]',
  'article:has(a[href*="/comments/"])',
  '[data-testid="post-container"]',
  '.thing.link[data-fullname^="t3_"]',
].join(',');

export interface RedditPageCard {
  id: string;
  permalink: string;
  title: string;
  body?: string;
  author?: string;
  subreddit?: string;
  score?: number;
  commentCount?: number;
  createdAt?: string;
  mediaUrls: string[];
  promoted: boolean;
  pinned: boolean;
  nsfw: boolean;
}

/**
 * Execute a self-contained browser expression. Keeping the complete parser in a
 * string prevents tsx/esbuild helpers such as `__name` from leaking into the
 * browser context, while the IIFE ensures Playwright returns the card array
 * rather than the function expression itself.
 */
const EXTRACT_REDDIT_CARDS_EXPRESSION = String.raw`
  (() => {
    const elements = Array.from(
      document.querySelectorAll(${JSON.stringify(REDDIT_POST_SELECTOR)}),
    );

    const text = (value) => {
      const normalized = value == null
        ? undefined
        : String(value).replace(/\s+/g, ' ').trim();
      return normalized || undefined;
    };

    const absolute = (value) => {
      if (!value) return undefined;
      try {
        return new URL(value, location.origin).href;
      } catch {
        return undefined;
      }
    };

    const attribute = (element, names) => {
      for (const name of names) {
        const value = element.getAttribute(name);
        if (value) return value;
      }
      return undefined;
    };

    const compactNumber = (value) => {
      if (!value) return undefined;
      const normalized = String(value).toLowerCase().replace(/,/g, '').trim();
      const match = normalized.match(/-?\d+(?:\.\d+)?/);
      if (!match) return undefined;
      let number = Number(match[0]);
      if (normalized.includes('k')) number *= 1000;
      if (normalized.includes('m')) number *= 1000000;
      return Number.isFinite(number) ? Math.round(number) : undefined;
    };

    const results = new Map();
    for (const element of elements) {
      const host = element.matches('shreddit-post')
        ? element
        : element.querySelector('shreddit-post') || element;
      const container =
        element.closest('article') || element.closest('.thing.link') || element;
      const link = container.querySelector('a[href*="/comments/"]');
      const permalink =
        absolute(attribute(host, ['permalink', 'data-permalink'])) ||
        absolute(attribute(container, ['data-permalink'])) ||
        absolute(link && link.getAttribute('href'));
      const idMatch =
        permalink && permalink.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i);
      const idFromUrl = idMatch ? idMatch[1] : undefined;
      const rawId =
        attribute(host, ['id', 'data-fullname', 'data-post-id']) ||
        attribute(container, ['data-fullname', 'data-post-id']);
      const id = rawId && rawId.startsWith('t3_')
        ? rawId
        : idFromUrl
          ? 't3_' + idFromUrl
          : rawId;
      const titleNode = container.querySelector(
        '[slot="title"], a.title, [data-testid="post-title"], h1, h2, h3',
      );
      const title =
        text(attribute(host, ['post-title'])) ||
        text(titleNode && titleNode.innerText);
      if (!id || !permalink || !title || results.has(id)) continue;

      const authorNode = container.querySelector('a[href*="/user/"]');
      const authorValue =
        text(attribute(host, ['author', 'data-author'])) ||
        text(authorNode && authorNode.textContent);
      const author = authorValue && authorValue.replace(/^u\//, '');

      const subredditNode = container.querySelector('a[href^="/r/"]');
      const subredditValue =
        text(
          attribute(host, [
            'subreddit-prefixed-name',
            'subreddit-name',
            'data-subreddit',
          ]),
        ) || text(subredditNode && subredditNode.textContent);
      const subreddit = subredditValue && subredditValue.replace(/^r\//, '');

      const bodyNode = container.querySelector(
        '[slot="text-body"], shreddit-post-text-body, [data-testid="post-content"], .usertext-body .md, .expando .md',
      );
      const body = text(bodyNode && bodyNode.innerText);

      const scoreNode = container.querySelector(
        '[data-testid="post-vote-count"], .score',
      );
      const scoreText =
        attribute(host, ['score']) || (scoreNode && scoreNode.innerText);

      const commentNode = container.querySelector(
        '[data-testid="comment-count"], a.comments',
      );
      const commentText =
        attribute(host, ['comment-count']) ||
        (commentNode && commentNode.innerText);

      const mediaUrls = [];
      const mediaNodes = container.querySelectorAll('img[src], faceplate-img');
      for (const image of mediaNodes) {
        const mediaUrl = absolute(
          image.currentSrc ||
            image.getAttribute('src') ||
            image.getAttribute('data-src'),
        );
        if (!mediaUrl || /avatar|icon|emoji|award|snoo/i.test(mediaUrl)) continue;
        if (!mediaUrls.includes(mediaUrl)) mediaUrls.push(mediaUrl);
        if (mediaUrls.length >= 10) break;
      }

      const createdNode = container.querySelector('time[datetime]');
      results.set(id, {
        id,
        permalink,
        title,
        body,
        author,
        subreddit,
        score: compactNumber(scoreText),
        commentCount: compactNumber(commentText),
        createdAt:
          attribute(host, ['created-timestamp', 'data-timestamp']) ||
          (createdNode && createdNode.dateTime) ||
          undefined,
        mediaUrls,
        promoted:
          host.hasAttribute('is-promoted') ||
          Boolean(
            container.querySelector(
              '[aria-label*="promoted" i], [data-testid*="promoted" i]',
            ),
          ),
        pinned:
          host.hasAttribute('is-stickied') ||
          host.hasAttribute('stickied') ||
          container.classList.contains('stickied'),
        nsfw:
          host.hasAttribute('is-nsfw') ||
          container.classList.contains('over18') ||
          Boolean(container.querySelector('[aria-label*="nsfw" i]')),
      });
    }

    return Array.from(results.values());
  })()
`;

export async function extractRedditCards(page: Page): Promise<RedditPageCard[]> {
  const cards = await page.evaluate(EXTRACT_REDDIT_CARDS_EXPRESSION);
  if (!Array.isArray(cards)) {
    throw new TypeError('Reddit page parser did not return a card array');
  }
  return cards as RedditPageCard[];
}
