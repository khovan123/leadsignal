'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, getWorkspaceId } from '@/lib/api';

export async function createPairingCodeAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const workspaceId = await getWorkspaceId();
  const role = String(formData.get('role') ?? 'MEMBER');
  const displayName = String(formData.get('displayName') ?? '').trim();
  const expiresInMinutes = Number(formData.get('expiresInMinutes') ?? 30);

  const result = await api<{ code: string }>(
    `/workspaces/${workspaceId}/extension-devices/pairing-codes`,
    {
      method: 'POST',
      body: JSON.stringify({
        role,
        displayName: displayName || undefined,
        expiresInMinutes,
      }),
    },
  );

  redirect(
    `/${locale}/settings/extensions?pairingCode=${encodeURIComponent(result.code)}`,
  );
}

export async function revokeExtensionDeviceAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const deviceId = String(formData.get('deviceId') ?? '');
  const workspaceId = await getWorkspaceId();
  await api(
    `/workspaces/${workspaceId}/extension-devices/${encodeURIComponent(deviceId)}/revoke`,
    { method: 'POST', body: '{}' },
  );
  revalidatePath(`/${locale}/settings/extensions`);
}
