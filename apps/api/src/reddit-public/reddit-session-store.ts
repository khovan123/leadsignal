import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BrowserContext, Cookie } from 'playwright';
import { CryptoService } from '../crypto/crypto.service';
import { resolveRedditRuntimePath } from './reddit-runtime-path';

export interface RedditSessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface StoredRedditSession {
  version: 1;
  workspaceId: string;
  deviceId: string;
  syncedAt: string;
  encrypted: string;
  iv: string;
  authTag: string;
}

export function redditSessionFilePath(): string {
  return resolveRedditRuntimePath(
    process.env.REDDIT_SESSION_FILE,
    '.runtime/reddit-session.json',
  );
}

export async function saveRedditSession(
  crypto: CryptoService,
  input: {
    workspaceId: string;
    deviceId: string;
    cookies: RedditSessionCookie[];
  },
): Promise<{ syncedAt: string; cookieCount: number }> {
  const syncedAt = new Date().toISOString();
  const payload = crypto.encrypt(JSON.stringify(input.cookies));
  const record: StoredRedditSession = {
    version: 1,
    workspaceId: input.workspaceId,
    deviceId: input.deviceId,
    syncedAt,
    ...payload,
  };
  const path = redditSessionFilePath();
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(record), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, path);
  console.info('[reddit-session] synchronized session saved', {
    path,
    workspaceId: input.workspaceId,
    cookieCount: input.cookies.length,
    syncedAt,
  });
  return { syncedAt, cookieCount: input.cookies.length };
}

export async function applySyncedRedditSession(
  context: BrowserContext,
  crypto = new CryptoService(),
): Promise<boolean> {
  const path = redditSessionFilePath();
  let record: StoredRedditSession;
  try {
    record = JSON.parse(await readFile(path, 'utf8')) as StoredRedditSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn('[reddit-session] synchronized session file not found', {
        path,
        cwd: process.cwd(),
      });
      return false;
    }
    throw error;
  }

  const cookies = JSON.parse(
    crypto.decrypt(record.encrypted, record.iv, record.authTag),
  ) as RedditSessionCookie[];
  const nowSeconds = Date.now() / 1000;
  const usable = cookies
    .filter((cookie) => cookie.name && cookie.value)
    .filter((cookie) => !cookie.expires || cookie.expires > nowSeconds)
    .map((cookie): Cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.reddit.com',
      path: cookie.path || '/',
      expires: cookie.expires ?? -1,
      httpOnly: Boolean(cookie.httpOnly),
      secure: cookie.secure !== false,
      sameSite: cookie.sameSite ?? 'Lax',
    }));

  if (usable.length === 0) {
    console.warn('[reddit-session] synchronized session has no usable cookies', {
      path,
      syncedAt: record.syncedAt,
    });
    return false;
  }

  await context.addCookies(usable);
  console.info('[reddit-session] synchronized session loaded', {
    path,
    workspaceId: record.workspaceId,
    cookieCount: usable.length,
    syncedAt: record.syncedAt,
  });
  return true;
}
