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
          Extension là phương thức đăng nhập và gửi các post Reddit đã parse về workspace.
        </p>
      </div>
      <div className="panel space-y-4 p-6 text-sm text-slate-300">
        <ol className="list-decimal space-y-3 pl-5">
          <li>Clone hoặc tải repository LeadSignal.</li>
          <li>Mở <code>chrome://extensions</code> hoặc <code>edge://extensions</code>.</li>
          <li>Bật Developer mode và chọn Load unpacked.</li>
          <li>Chọn thư mục <code>apps/extension</code>.</li>
          <li>Mở popup extension, cấu hình API URL và LeadSignal URL.</li>
          <li>Nhập pairing code do owner/admin cấp, sau đó quay lại trang đăng nhập.</li>
        </ol>
        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
          <p className="font-medium text-slate-100">Bootstrap thiết bị đầu tiên</p>
          <p className="mt-2 text-slate-400">
            Đặt <code>EXTENSION_BOOTSTRAP_CODE</code> trên API và nhập đúng mã đó trong popup. Chỉ thiết bị đầu tiên được phép dùng bootstrap code.
          </p>
        </div>
      </div>
      <Link className="inline-flex rounded-lg bg-violet-600 px-4 py-2 font-medium" href={`/${locale}/login`}>
        Quay lại đăng nhập
      </Link>
    </div>
  );
}
