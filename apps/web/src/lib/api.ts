import 'server-only';
import { cookies } from 'next/headers';

const apiUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function getWorkspaceId(): Promise<string> {
  const value = (await cookies()).get('ls_workspace')?.value;
  if (!value) throw new Error('No active workspace is stored in the session');
  return value;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = (await cookies()).get('ls_access')?.value;
  if (!accessToken) throw new Error('Authentication is required');

  const response = await fetch(`${apiUrl}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}
