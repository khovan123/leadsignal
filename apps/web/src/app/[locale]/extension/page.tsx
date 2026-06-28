import Link from 'next/link';

export default async function ExtensionInstallPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Cài LeadSignal Extension</h1>
        <p className="mt-2 text-slate-400">
          Extension dùng khóa riêng của thiết bị để đăng nhập và ký các batch post Reddit trước khi gửi về workspace.
        </p>
      </div>

      <div className="panel space-y-5 p-6 text-sm text-slate-300">
        <ol className="list-decimal space-y-3 pl-5">
          <li>Clone hoặc tải repository LeadSignal.</li>
          <li>Mở <code>chrome://extensions</code> hoặc <code>edge://extensions</code>.</li>
          <li>Bật Developer mode và chọn Load unpacked.</li>
          <li>Chọn thư mục <code>apps/extension</code>.</li>
          <li>Mở Details → Extension options.</li>
          <li>Nhập API base URL, ví dụ <code>https://api.example.com/api</code>.</li>
          <li>Nhập app origin, ví dụ <code>https://app.example.com</code>, rồi cấp host permission.</li>
          <li>Reload trang đăng nhập để hệ thống phát hiện extension.</li>
          <li>Nhập pairing code do owner/admin cấp.</li>
          <li>Trong tab Reddit, bấm biểu tượng extension để gửi các post đang render.</li>
        </ol>

        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
          <p className="font-medium text-slate-100">Bootstrap thiết bị đầu tiên</p>
          <p className="mt-2 text-slate-400">
            Đặt <code>EXTENSION_BOOTSTRAP_CODE</code> trên API và nhập mã đó tại trang đăng nhập. Mã bootstrap chỉ dùng để tạo workspace và owner đầu tiên.
          </p>
        </div>

        <div className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-4 text-emerald-100/90">
          Extension không gửi cookie, localStorage, access token hay refresh token của Reddit. Chỉ post đã parse và chữ ký thiết bị được gửi về LeadSignal.
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className="inline-flex rounded-lg bg-violet-600 px-4 py-2 font-medium" href={`/${locale}/login`}>
          Quay lại đăng nhập
        </Link>
        <Link className="inline-flex rounded-lg border border-slate-700 px-4 py-2 font-medium" href={`/${locale}/settings/extensions`}>
          Quản lý thiết bị
        </Link>
      </div>
    </div>
  );
}
