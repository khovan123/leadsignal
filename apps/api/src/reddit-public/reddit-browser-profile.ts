import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  chromium,
  type BrowserContext,
  type LaunchPersistentContextOptions,
} from 'playwright';

function envBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(
    value.trim().toLowerCase(),
  );
}

export async function launchRedditBackendContext(): Promise<BrowserContext> {
  const profileDirectory = resolve(
    process.env.REDDIT_BACKEND_PROFILE_DIR ??
      '.runtime/reddit-browser-profile',
  );

  await mkdir(profileDirectory, { recursive: true });

  const channel =
    process.env.REDDIT_BROWSER_CHANNEL?.trim() || undefined;

  const options: LaunchPersistentContextOptions = {
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

export async function assertRedditSession(
  context: BrowserContext,
): Promise<void> {
  const page =
    context.pages()[0] ?? (await context.newPage());

  await page.goto('https://www.reddit.com/', {
    waitUntil: 'domcontentloaded',
    timeout: Number(
      process.env.REDDIT_CRAWLER_NAVIGATION_TIMEOUT_MS ??
        30_000,
    ),
  });

  const redirectedToLogin =
    /\/login(?:\/|\?|$)/i.test(page.url());

  const loginControlVisible = await page
    .locator(
      [
        'a[href*="/login"]',
        'button:has-text("Log In")',
        'button:has-text("Đăng nhập")',
      ].join(','),
    )
    .first()
    .isVisible()
    .catch(() => false);

  if (redirectedToLogin || loginControlVisible) {
    throw new Error('REDDIT_BACKEND_LOGIN_REQUIRED');
  }
}