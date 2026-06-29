import 'server-only';
import { cookies } from 'next/headers';

const apiUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const retryDelays = [250, 500, 1000, 1500];

export async function getWorkspaceId(): Promise<string> {
  const value = (await cookies()).get('ls_workspace')?.value;
  if (!value) throw new Error('No active workspace is stored in the session');
  return value;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = (await cookies()).get('ls_access')?.value;
  if (!accessToken) throw new Error('Authentication is required');

  const method = String(init?.method ?? 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD';
  let response: Response | undefined;
  let networkError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      response = await fetch(`${apiUrl}/api${path}`, {
        ...init,
        headers: {
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          authorization: `Bearer ${accessToken}`,
          ...(init?.headers ?? {}),
        },
        cache: 'no-store',
      });
      break;
    } catch (error) {
      networkError = error;
      if (!canRetry || attempt === retryDelays.length) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }

  if (!response) {
    const reason = networkError instanceof Error ? networkError.message : String(networkError ?? 'network error');
    throw new Error(`LeadSignal API is unavailable at ${apiUrl}. Wait for the API server to start, then reload. Cause: ${reason}`);
  }

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}
