import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import {
  extractRedditCards,
  REDDIT_POST_SELECTOR,
  type RedditPageCard,
} from './reddit-page-parser';
import type {
  RedditPublicCollectionResult,
  RedditPublicPost,
  RedditPublicSource,
} from './reddit-public.types';
import { resolvePublicRedditSourceUrl } from './reddit-source-url';

function enabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class RedditPublicCollectorService {
  private readonly logger = new Logger(RedditPublicCollectorService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async collect(): Promise<RedditPublicCollectionResult> {
    if (!enabled(process.env.REDDIT_CRAWLER_ENABLED, true)) {
      return { workspaces: 0, sources: 0, posts: 0, failures: [] };
    }

    const sources = (await this.prisma.redditSource.findMany({
      where: { enabled: true },
      orderBy: [{ workspaceId: 'asc' }, { createdAt: 'asc' }],
    })) as RedditPublicSource[];
    if (sources.length === 0) {
      return { workspaces: 0, sources: 0, posts: 0, failures: [] };
    }

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let posts = 0;
    const failures: Array<{ sourceId: string; message: string }> = [];
    const workspaces = new Set(sources.map((source) => source.workspaceId));

    try {
      browser = await this.launchBrowser();
      context = await browser.newContext({
        userAgent:
          process.env.REDDIT_CRAWLER_USER_AGENT ??
          'LeadSignalPublicCollector/1.0',
        locale: process.env.REDDIT_CRAWLER_LOCALE ?? 'en-US',
        timezoneId:
          process.env.REDDIT_CRAWLER_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
        viewport: { width: 1440, height: 1000 },
      });

      for (const source of sources) {
        try {
          const collected = await this.collectSource(context, source);
          for (const record of collected) {
            if (await this.persist(source, record)) posts += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push({ sourceId: source.id, message });
          this.logger.warn(`Reddit source ${source.id} failed: ${message}`);
        }
      }
    } finally {
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }

    return {
      workspaces: workspaces.size,
      sources: sources.length,
      posts,
      failures,
    };
  }

  private async launchBrowser(): Promise<Browser> {
    const showBrowser = enabled(process.env.REDDIT_SHOW_BROWSER, false);
    const channel = process.env.REDDIT_BROWSER_CHANNEL?.trim() || undefined;
    try {
      return await chromium.launch({ headless: !showBrowser, channel });
    } catch (error) {
      if (!channel) throw error;
      this.logger.warn(
        `Browser channel ${channel} is unavailable; using Playwright Chromium`,
      );
      return chromium.launch({ headless: !showBrowser });
    }
  }

  private async collectSource(
    context: BrowserContext,
    source: RedditPublicSource,
  ): Promise<RedditPublicPost[]> {
    const target = Math.min(
      positiveInteger(process.env.REDDIT_CRAWLER_POSTS_PER_SOURCE, 50),
      200,
    );
    const maxScrolls = Math.min(
      positiveInteger(process.env.REDDIT_CRAWLER_MAX_SCROLLS, 20),
      100,
    );
    const maxStalls = Math.min(
      positiveInteger(process.env.REDDIT_CRAWLER_MAX_STALL_ROUNDS, 4),
      12,
    );
    const page = await context.newPage();
    const posts = new Map<string, RedditPublicPost>();
    let stalls = 0;
    let oldReddit = false;

    try {
      await this.navigate(page, resolvePublicRedditSourceUrl(source, false));
      await this.waitForCards(page);

      for (
        let round = 0;
        round <= maxScrolls && posts.size < target;
        round += 1
      ) {
        const cards = await extractRedditCards(page);
        const sizeBefore = posts.size;

        for (const card of cards) {
          if (card.promoted || card.pinned || card.nsfw) continue;
          const normalized = this.normalizeCard(source, card);
          if (!normalized || posts.has(normalized.externalPostId)) continue;
          posts.set(normalized.externalPostId, normalized);
          if (posts.size >= target) break;
        }

        if (posts.size >= target) break;
        if (
          posts.size === 0 &&
          round >= 1 &&
          source.subreddit &&
          !oldReddit
        ) {
          oldReddit = true;
          stalls = 0;
          await this.navigate(page, resolvePublicRedditSourceUrl(source, true));
          await this.waitForCards(page);
          continue;
        }

        stalls = posts.size === sizeBefore ? stalls + 1 : 0;
        if (stalls >= maxStalls) break;

        if (page.url().includes('old.reddit.com')) {
          const next = page
            .locator('span.next-button a, a[rel="nofollow next"]')
            .first();
          if (!(await next.isVisible().catch(() => false))) break;
          await Promise.all([
            page.waitForLoadState('domcontentloaded').catch(() => undefined),
            next.click(),
          ]);
          await this.waitForCards(page);
          continue;
        }

        await page.evaluate((selector) => {
          const candidates = Array.from(document.querySelectorAll(selector));
          candidates.at(-1)?.scrollIntoView({
            block: 'end',
            behavior: 'instant',
          });
          window.scrollBy(0, Math.floor(window.innerHeight * 0.9));
        }, REDDIT_POST_SELECTOR);
        await Promise.race([
          page
            .waitForFunction(
              ({ selector, count }) =>
                document.querySelectorAll(selector).length > count,
              { selector: REDDIT_POST_SELECTOR, count: cards.length },
              { timeout: 8_000 },
            )
            .catch(() => undefined),
          page.waitForTimeout(1_800),
        ]);
      }

      return [...posts.values()];
    } finally {
      await page.close();
    }
  }

  private async navigate(page: Page, url: string): Promise<void> {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: positiveInteger(
        process.env.REDDIT_CRAWLER_NAVIGATION_TIMEOUT_MS,
        30_000,
      ),
    });
    const status = response?.status();
    if (status === 403 || status === 429) {
      throw new Error(`Reddit blocked the crawler with HTTP ${status}`);
    }
    if (status && status >= 400) {
      throw new Error(`Reddit returned HTTP ${status} for ${url}`);
    }
  }

  private async waitForCards(page: Page): Promise<void> {
    await page
      .waitForFunction(
        (selector) => document.querySelectorAll(selector).length > 0,
        REDDIT_POST_SELECTOR,
        { timeout: 10_000 },
      )
      .catch(() => undefined);
    await page.waitForTimeout(800);
  }

  private normalizeCard(
    source: RedditPublicSource,
    card: RedditPageCard,
  ): RedditPublicPost | null {
    const rawId = card.id.startsWith('t3_')
      ? card.id
      : card.permalink.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i)?.[1];
    if (!rawId) return null;
    const externalPostId = rawId.startsWith('t3_') ? rawId : `t3_${rawId}`;
    const postedAt = card.createdAt ? new Date(card.createdAt) : new Date();

    return {
      externalPostId,
      canonicalUrl: card.permalink,
      subreddit: card.subreddit ?? source.subreddit ?? 'unknown',
      authorUsername: card.author ?? null,
      title: card.title,
      body: card.body ?? '',
      score: card.score ?? 0,
      commentCount: card.commentCount ?? 0,
      postedAt: Number.isNaN(postedAt.getTime()) ? new Date() : postedAt,
      mediaUrls: card.mediaUrls,
    };
  }

  private async persist(
    source: RedditPublicSource,
    record: RedditPublicPost,
  ): Promise<boolean> {
    const post = await this.prisma.redditPost.upsert({
      where: { externalPostId: record.externalPostId },
      update: {
        subreddit: record.subreddit,
        authorUsername: record.authorUsername,
        title: record.title,
        body: record.body,
        permalink: record.canonicalUrl,
        score: record.score,
        commentCount: record.commentCount,
      },
      create: {
        externalPostId: record.externalPostId,
        subreddit: record.subreddit,
        authorUsername: record.authorUsername,
        title: record.title,
        body: record.body,
        permalink: record.canonicalUrl,
        score: record.score,
        commentCount: record.commentCount,
        postedAt: record.postedAt,
      },
    });

    const key = {
      workspaceId: source.workspaceId,
      postId: post.id,
      sourceId: source.id,
    };
    const existing = await this.prisma.postDiscovery.findUnique({
      where: { workspaceId_postId_sourceId: key },
      select: { id: true },
    });
    await this.prisma.postDiscovery.upsert({
      where: { workspaceId_postId_sourceId: key },
      update: { discoveredAt: new Date() },
      create: key,
    });
    if (existing) return false;
    await this.queue.enqueueClassification(source.workspaceId, post.id);
    return true;
  }
}
