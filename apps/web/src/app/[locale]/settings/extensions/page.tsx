import Link from 'next/link';
import { api, getWorkspaceId } from '@/lib/api';
import {
  createPairingCodeAction,
  revokeExtensionDeviceAction,
} from './actions';

type Device = {
  id: string;
  label: string | null;
  redditUsername: string | null;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  user: { displayName: string };
};

export default async function ExtensionSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pairingCode?: string }>;
}) {
  const { locale } = await params;
  const { pairingCode } = await searchParams;
  const workspaceId = await getWorkspaceId();
  const devices = await api<Device[]>(
    `/workspaces/${workspaceId}/extension-devices`,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Extension devices</h1>
          <p className="mt-2 text-slate-400">
            Tạo pairing code, kiểm tra thiết bị đã ghép nối và thu hồi quyền truy cập.
          </p>
        </div>
        <Link
          href={`/${locale}/extension`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium"
        >
          Hướng dẫn cài đặt
        </Link>
      </div>

      {pairingCode && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-5">
          <p className="text-sm font-medium text-emerald-200">Pairing code mới</p>
          <code className="mt-3 block break-all rounded-lg bg-slate-950 px-4 py-3 text-lg text-emerald-100">
            {pairingCode}
          </code>
          <p className="mt-2 text-xs text-emerald-100/70">
            Gửi mã này cho đúng thành viên. Mã chỉ dùng được một lần và sẽ hết hạn theo cấu hình.
          </p>
        </div>
      )}

      <section className="panel p-6">
        <h2 className="text-xl font-semibold">Tạo pairing code</h2>
        <form action={createPairingCodeAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <label className="text-sm">
            Tên hiển thị
            <input
              name="displayName"
              placeholder="Ví dụ: Sales Member"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Role
            <select
              name="role"
              defaultValue="MEMBER"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MEMBER">MEMBER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </label>
          <label className="text-sm">
            Hết hạn sau
            <select
              name="expiresInMinutes"
              defaultValue="30"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <option value="15">15 phút</option>
              <option value="30">30 phút</option>
              <option value="60">1 giờ</option>
              <option value="1440">24 giờ</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium">
              Tạo pairing code
            </button>
          </div>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-800 p-6">
          <h2 className="text-xl font-semibold">Thiết bị đã ghép nối</h2>
        </div>
        {devices.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Chưa có extension device.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {devices.map((device) => (
              <div key={device.id} className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <p className="font-medium">{device.user.displayName}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {device.label || 'LeadSignal Extension'}
                    {device.redditUsername ? ` · u/${device.redditUsername}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {device.status} · last seen {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'never'}
                  </p>
                </div>
                {!device.revokedAt && (
                  <form action={revokeExtensionDeviceAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="deviceId" value={device.id} />
                    <button className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300">
                      Revoke
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
