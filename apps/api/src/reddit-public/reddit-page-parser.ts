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

export function extractRedditCards(page: Page): Promise<RedditPageCard[]> {
  return page.locator(REDDIT_POST_SELECTOR).evaluateAll((elements) => {
    const text = (value: string | null | undefined): string | undefined => {
      const normalized = value?.replace(/\s+/g, ' ').trim();
      return normalized || undefined;
    };
    const absolute = (value: string | null | undefined): string | undefined => {
      if (!value) return undefined;
      try {
        return new URL(value, location.origin).href;
      } catch {
        return undefined;
      }
    };
    const attribute = (element: Element, names: string[]): string | undefined => {
      for (const name of names) {
        const value = element.getAttribute(name);
        if (value) return value;
      }
      return undefined;
    };
    const compactNumber = (value: string | null | undefined): number | undefined => {
      if (!value) return undefined;
      const normalized = value.toLowerCase().replace(/,/g, '').trim();
      const match = normalized.match(/-?\d+(?:\.\d+)?/);
      if (!match) return undefined;
      let number = Number(match[0]);
      if (normalized.includes('k')) number *= 1_000;
      if (normalized.includes('m')) number *= 1_000_000;
      return Number.isFinite(number) ? Math.round(number) : undefined;
    };

    const results = new Map<string, RedditPageCard>();
    for (const element of elements) {
      const host = element.matches('shreddit-post')
        ? element
        : element.querySelector('shreddit-post') ?? element;
      const container =
        element.closest('article') ?? element.closest('.thing.link') ?? element;
      const link = container.querySelector<HTMLAnchorElement>(
        'a[href*="/comments/"]',
      );
      const permalink =
        absolute(attribute(host, ['permalink', 'data-permalink'])) ??
        absolute(attribute(container, ['data-permalink'])) ??
        absolute(link?.getAttribute('href'));
      const idFromUrl = permalink?.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i)?.[1];
      const rawId =
        attribute(host, ['id', 'data-fullname', 'data-post-id']) ??
        attribute(container, ['data-fullname', 'data-post-id']);
      const id = rawId?.startsWith('t3_')
        ? rawId
        : idFromUrl
          ? `t3_${idFromUrl}`
          : rawId;
      const title =
        text(attribute(host, ['post-title'])) ??
        text(
          container.querySelector<HTMLElement>(
            '[slot="title"], a.title, [data-testid="post-title"], h1, h2, h3',
          )?.innerText,
        );
      if (!id || !permalink || !title || results.has(id)) continue;

      const author = (
        text(attribute(host, ['author', 'data-author'])) ??
        text(
          container.querySelector<HTMLAnchorElement>('a[href*="/user/"]')
            ?.textContent,
        )
      )?.replace(/^u\//, '');
      const subreddit = (
        text(
          attribute(host, [
            'subreddit-prefixed-name',
            'subreddit-name',
            'data-subreddit',
          ]),
        ) ??
        text(
          container.querySelector<HTMLAnchorElement>('a[href^="/r/"]')
            ?.textContent,
        )
      )?.replace(/^r\//, '');
      const body = text(
        container.querySelector<HTMLElement>(
          '[slot="text-body"], shreddit-post-text-body, [data-testid="post-content"], .usertext-body .md, .expando .md',
        )?.innerText,
      );
      const scoreText =
        attribute(host, ['score']) ??
        container.querySelector<HTMLElement>(
          '[data-testid="post-vote-count"], .score',
        )?.innerText;
      const commentText =
        attribute(host, ['comment-count']) ??
        container.querySelector<HTMLElement>(
          '[data-testid="comment-count"], a.comments',
        )?.innerText;
      const mediaUrls = Array.from(
        container.querySelectorAll<HTMLImageElement>('img[src], faceplate-img'),
      )
        .map((image) =>
          absolute(
            image.currentSrc ||
              image.getAttribute('src') ||
              image.getAttribute('data-src'),
          ),
        )
        .filter((value): value is string => Boolean(value))
        .filter((value) => !/avatar|icon|emoji|award|snoo/i.test(value));

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
          attribute(host, ['created-timestamp', 'data-timestamp']) ??
          container.querySelector<HTMLTimeElement>('time[datetime]')?.dateTime,
        mediaUrls: [...new Set(mediaUrls)].slice(0, 10),
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
    return [...results.values()];
  });
}
