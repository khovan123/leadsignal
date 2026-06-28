import type { BrowserContext } from 'playwright';
import type { RedditPublicPost } from './reddit-public.types';

interface DetailSnapshot {
  body?: string;
  mediaUrls: string[];
  topComments: string[];
}

export async function enrichRedditPostDetails(
  context: BrowserContext,
  posts: RedditPublicPost[],
  commentsTopN: number,
  maxParallel = 2,
): Promise<RedditPublicPost[]> {
  const results = [...posts];
  const concurrency = Math.max(1, Math.min(maxParallel, 4));
  let cursor = 0;

  const worker = async () => {
    while (cursor < results.length) {
      const index = cursor;
      cursor += 1;
      const post = results[index];
      try {
        const detail = await fetchDetail(context, post.canonicalUrl, commentsTopN);
        results[index] = {
          ...post,
          body: detail.body || post.body,
          mediaUrls: [...new Set([...post.mediaUrls, ...detail.mediaUrls])].slice(0, 20),
          topComments: detail.topComments,
          detailFetched: true,
        };
      } catch {
        results[index] = { ...post, detailFetched: false };
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function fetchDetail(
  context: BrowserContext,
  url: string,
  commentsTopN: number,
): Promise<DetailSnapshot> {
  const page = await context.newPage();
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(700);
    return await page.evaluate((topN) => {
      const clean = (value: string | null | undefined) =>
        value?.replace(/\s+/g, ' ').trim() || undefined;
      const absolute = (value: string | null | undefined) => {
        if (!value) return undefined;
        try {
          return new URL(value, location.origin).href;
        } catch {
          return undefined;
        }
      };
      const body = clean(
        document.querySelector<HTMLElement>(
          '[slot="text-body"], shreddit-post-text-body, [data-testid="post-content"], .usertext-body .md, .expando .md',
        )?.innerText,
      );
      const mediaUrls = Array.from(
        document.querySelectorAll<HTMLImageElement>(
          'main img[src], shreddit-post img[src], article img[src]',
        ),
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
      const comments = Array.from(
        document.querySelectorAll<HTMLElement>(
          'shreddit-comment [slot="comment"], shreddit-comment .md, [data-testid="comment"] .md, .comment .usertext-body .md',
        ),
      )
        .map((element) => clean(element.innerText))
        .filter((value): value is string => Boolean(value));
      return {
        body,
        mediaUrls: [...new Set(mediaUrls)].slice(0, 20),
        topComments: [...new Set(comments)].slice(0, Math.max(0, topN)),
      };
    }, Math.max(0, Math.min(commentsTopN, 50)));
  } finally {
    await page.close();
  }
}
