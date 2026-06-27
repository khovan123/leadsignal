import 'server-only';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const workspaceId = process.env.NEXT_PUBLIC_DEMO_WORKSPACE_ID ?? '00000000-0000-4000-8000-000000000001';
const userId = process.env.NEXT_PUBLIC_DEMO_USER_ID ?? '00000000-0000-4000-8000-000000000001';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-user-id': userId, 'x-workspace-id': workspaceId, ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export { workspaceId, userId };
