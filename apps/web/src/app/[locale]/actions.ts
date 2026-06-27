'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, getWorkspaceId } from '@/lib/api';

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  const locale = String(formData.get('locale') ?? 'vi');
  const workspaceId = await getWorkspaceId();
  await api(`/workspaces/${workspaceId}/leads/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  revalidatePath(`/${locale}/leads`);
}

export async function createLlmConnection(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const workspaceId = await getWorkspaceId();
  await api(`/workspaces/${workspaceId}/llm/connections`, {
    method: 'POST',
    body: JSON.stringify({
      provider: String(formData.get('provider')),
      name: String(formData.get('name')),
      accountLabel: String(formData.get('accountLabel') ?? ''),
      credential: String(formData.get('credential')),
      baseUrl: String(formData.get('baseUrl') ?? '') || undefined,
      ownerConcurrencyLimit: Number(formData.get('ownerConcurrencyLimit') ?? 2),
      models: [String(formData.get('model'))],
    }),
  });
  revalidatePath(`/${locale}/llm`);
}

export async function connectOAuthProvider(formData: FormData) {
  const provider = String(formData.get('provider'));
  const workspaceId = await getWorkspaceId();
  const result = await api<{ authorizationUrl?: string; mode: string }>(
    `/connections/${provider}/authorize?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  if (!result.authorizationUrl) {
    throw new Error(`${provider} requires an API key connection`);
  }
  redirect(result.authorizationUrl);
}

export async function verifyLlmConnection(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const workspaceId = await getWorkspaceId();
  await api(`/workspaces/${workspaceId}/llm/connections/${String(formData.get('id'))}/verify`, { method: 'POST' });
  revalidatePath(`/${locale}/llm`);
}

export async function removeLlmConnection(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const workspaceId = await getWorkspaceId();
  await api(`/workspaces/${workspaceId}/llm/connections/${String(formData.get('id'))}`, { method: 'DELETE' });
  revalidatePath(`/${locale}/llm`);
}
