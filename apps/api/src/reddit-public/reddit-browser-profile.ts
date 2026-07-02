import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

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

function redditProfileDirectory(): string {
  return resolve(
    process.env.REDDIT_BACKEND_PROFILE_DIR ??
      '.runtime/reddit-browser-profile',
  );
}

export async function launchRedditBackendContext(): Promise<BrowserContext> {
  const profileDirectory = redditProfileDirectory();

  await mkdir(profileDirectory, { recursive: true });

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

async function waitForInteractiveRedditLogin(page: Page): Promise<void> {
  const timeoutMs = positiveInteger(
    process.env.REDDIT_LOGIN_BOOTSTRAP_TIMEOUT_MS,
    180_000,
  );
  const deadline = Date.now() + timeoutMs;

  await page.bringToFront().catch(() => undefined);

  if (!/reddit\.com/i.test(page.url())) {
    await page.goto('https://www.reddit.com/login/', {
      waitUntil: 'domcontentloaded',
      timeout: positiveInteger(
        process.env.REDDIT_CRAWLER_NAVIGATION_TIMEOUT_MS,
        30_000,
      ),
    });
  }

  console.warn(
    `[reddit] Backend profile is not authenticated. Log in in the opened browser within ${Math.ceil(timeoutMs / 1000)} seconds. Profile: ${redditProfileDirectory()}`,
  );

  while (Date.now() < deadline) {
    if (!(await redditSessionMissing(page))) {
      console.info('[reddit] Backend login detected; session saved in persistent profile.');
      return;
    }
    await page.waitForTimeout(1_000);
  }

  throw new Error(
    `REDDIT_BACKEND_LOGIN_REQUIRED: login was not completed within ${timeoutMs}ms; profile=${redditProfileDirectory()}`,
  );
}

export async function assertRedditSession(
  context: BrowserContext,
): Promise<void> {
  const page =
    context.pages()[0] ?? (await context.newPage());

  await page.goto('https://www.reddit.com/', {
    waitUntil: 'domcontentloaded',
    timeout: positiveInteger(
      process.env.REDDIT_CRAWLER_NAVIGATION_TIMEOUT_MS,
      30_000,
    ),
  });

  if (!(await redditSessionMissing(page))) return;

  if (envBoolean(process.env.REDDIT_SHOW_BROWSER, false)) {
    await waitForInteractiveRedditLogin(page);
    return;
  }

  throw new Error(
    `REDDIT_BACKEND_LOGIN_REQUIRED: set REDDIT_SHOW_BROWSER=true and log in once; profile=${redditProfileDirectory()}`,
  );
}
