'use server';
import { revalidatePath } from 'next/cache';
import { api, workspaceId } from '@/lib/api';

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  const locale = String(formData.get('locale') ?? 'vi');
  await api(`/workspaces/${workspaceId}/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  revalidatePath(`/${locale}/leads`);
}

export async function createLlmConnection(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  await api(`/workspaces/${workspaceId}/llm/connections`, { method: 'POST', body: JSON.stringify({
    provider: String(formData.get('provider')), name: String(formData.get('name')),
    accountLabel: String(formData.get('accountLabel') ?? ''), credential: String(formData.get('credential')),
    baseUrl: String(formData.get('baseUrl') ?? '') || undefined,
    ownerConcurrencyLimit: Number(formData.get('ownerConcurrencyLimit') ?? 2),
    models: [String(formData.get('model'))],
  }) });
  revalidatePath(`/${locale}/llm`);
}

export async function verifyLlmConnection(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  await api(`/workspaces/${workspaceId}/llm/connections/${String(formData.get('id'))}/verify`, { method: 'POST' });
  revalidatePath(`/${locale}/llm`);
}

export async function removeLlmConnection(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  await api(`/workspaces/${workspaceId}/llm/connections/${String(formData.get('id'))}`, { method: 'DELETE' });
  revalidatePath(`/${locale}/llm`);
}
