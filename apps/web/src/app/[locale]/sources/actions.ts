'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, getWorkspaceId } from '@/lib/api';

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value || undefined;
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

function sourcePayload(formData: FormData) {
  return {
    name: optionalText(formData, 'name'),
    type: String(formData.get('type') ?? 'SUBREDDIT'),
    subreddit: optionalText(formData, 'subreddit'),
    searchQuery: optionalText(formData, 'searchQuery'),
    enabled: checked(formData, 'enabled'),
    sort: String(formData.get('sort') ?? 'NEW'),
    timeRange: String(formData.get('timeRange') ?? 'ALL'),
    targetPostCount: numberValue(formData, 'targetPostCount', 50),
    maxScrolls: numberValue(formData, 'maxScrolls', 20),
    maxStallRounds: numberValue(formData, 'maxStallRounds', 4),
    includePromoted: checked(formData, 'includePromoted'),
    includePinned: checked(formData, 'includePinned'),
    includeNsfw: checked(formData, 'includeNsfw'),
    detailEnabled: checked(formData, 'detailEnabled'),
    commentsTopN: numberValue(formData, 'commentsTopN', 0),
    collectionMode: String(formData.get('collectionMode') ?? 'PUBLIC'),
  };
}

export async function createRedditSourceAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const workspaceId = await getWorkspaceId();
  await api(`/workspaces/${workspaceId}/reddit-sources`, {
    method: 'POST',
    body: JSON.stringify(sourcePayload(formData)),
  });
  revalidatePath(`/${locale}/sources`);
  redirect(`/${locale}/sources?created=1`);
}

export async function updateRedditSourceAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const sourceId = String(formData.get('sourceId') ?? '');
  const workspaceId = await getWorkspaceId();
  await api(
    `/workspaces/${workspaceId}/reddit-sources/${encodeURIComponent(sourceId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(sourcePayload(formData)),
    },
  );
  revalidatePath(`/${locale}/sources`);
  redirect(`/${locale}/sources?saved=${encodeURIComponent(sourceId)}`);
}

export async function deleteRedditSourceAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const sourceId = String(formData.get('sourceId') ?? '');
  const workspaceId = await getWorkspaceId();
  await api(
    `/workspaces/${workspaceId}/reddit-sources/${encodeURIComponent(sourceId)}`,
    { method: 'DELETE' },
  );
  revalidatePath(`/${locale}/sources`);
  redirect(`/${locale}/sources?deleted=1`);
}

export async function runRedditSourcesAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const workspaceId = await getWorkspaceId();
  const sourceIds = formData
    .getAll('sourceIds')
    .map(String)
    .filter(Boolean);
  const result = await api<{ jobId: string }>(
    `/workspaces/${workspaceId}/reddit-sources/run`,
    {
      method: 'POST',
      body: JSON.stringify({ sourceIds: sourceIds.length ? sourceIds : undefined }),
    },
  );
  revalidatePath(`/${locale}/sources`);
  redirect(`/${locale}/sources?jobId=${encodeURIComponent(result.jobId)}`);
}
