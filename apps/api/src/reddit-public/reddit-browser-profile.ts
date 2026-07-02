import { mkdir } from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolveRedditRuntimePath } from './reddit-runtime-path';
import { applySyncedRedditSession } from './reddit-session-store';

type PersistentContextOptions = NonNullable<
  Parameters<typeof chromium.launchPersistentContext>[1]
>;

const REDDIT_LOGIN_CONTROL_SELECTOR = [
  'a[href*="/login"]',
  'button:has-text("Log In")',
  'button:has-text("Đăng nhập")',
].join(',');

function envBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(
    value.trim().toLowerCase(),
  );
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallback;
}

export function redditProfileDirectory(): string {
  return resolveRedditRuntimePath(
    process.env.REDDIT_BACKEND_PROFILE_DIR,
    '.runtime/reddit-browser-profile',
  );
}

export async function launchRedditBackendContext(): Promise<BrowserContext> {
  const profileDirectory = redditProfileDirectory();

  await mkdir(profileDirectory, { recursive: true });
  console.info('[reddit] launching backend browser profile', {
    profileDirectory,
    cwd: process.cwd(),
  });

  const channel =
    process.env.REDDIT_BROWSER_CHANNEL?.trim() || undefined;

  const options: PersistentContextOptions = {
    headless: !envBoolean(
      process.env.REDDIT_SHOW_BROWSER,
      false,
    ),
    channel,
    locale:
      process.env.REDDIT_CRAWLER_LOCALE ?? 'en-US',
    timezoneId:
      process.env.REDDIT_CRAWLER_TIMEZONE ??
      'Asia/Ho_Chi_Minh',
    viewport: {
      width: 1440,
      height: 1000,
    },
    userAgent:
      process.env.REDDIT_CRAWLER_USER_AGENT ??
      'LeadSignalBackendCollector/1.0',
  };

  try {
    return await chromium.launchPersistentContext(
      profileDirectory,
      options,
    );
  } catch (error) {
    if (!channel) throw error;

    return chromium.launchPersistentContext(
      profileDirectory,
      {
        ...options,
        channel: undefined,
      },
    );
  }
}

async function redditSessionMissing(page: Page): Promise<boolean> {
  const redirectedToLogin =
    /\/login(?:\/|\?|$)/i.test(page.url());

  const loginControlVisible = await page
    .locator(REDDIT_LOGIN_CONTROL_SELECTOR)
    .first()
    .isVisible()
    .catch(() => false);

  return redirectedToLogin || loginControlVisible;
}

async function navigateRedditHome(page: Page): Promise<void> {
  await page.goto('https://www.reddit.com/', {
    waitUntil: 'domcontentloaded',
    timeout: positiveInteger(
      process.env.REDDIT_CRAWLER_NAVIGATION_TIMEOUT_MS,
      30_000,
    ),
  });
}

export async function assertRedditSession(
  context: BrowserContext,
): Promise<void> {
  const page =
    context.pages()[0] ?? (await context.newPage());

  await navigateRedditHome(page);
  if (!(await redditSessionMissing(page))) return;

  const hydrated = await applySyncedRedditSession(context);
  if (hydrated) {
    await navigateRedditHome(page);
    if (!(await redditSessionMissing(page))) {
      console.info(
        '[reddit] Backend browser authenticated from the paired extension session.',
      );
      return;
    }
  }

  throw new Error(
    'REDDIT_SESSION_SYNC_REQUIRED: open Reddit in the paired browser so the extension can synchronize the existing session',
  );
}
