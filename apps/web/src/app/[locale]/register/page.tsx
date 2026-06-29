import Link from 'next/link';
import { registerAction } from '../auth-actions';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Tạo tài khoản LeadSignal</h1>
        <p className="mt-2 text-slate-400">
          Tạo tài khoản trước, sau đó LeadSignal sẽ tự ghép nối extension bằng phiên đăng nhập của bạn.
        </p>
      </div>

      <form action={registerAction} className="panel space-y-4 p-6">
        <input type="hidden" name="locale" value={locale} />

        <label className="block text-sm">
          Tên hiển thị
          <input
            name="displayName"
            required
            minLength={2}
            autoComplete="name"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          Mật khẩu
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium hover:bg-violet-500"
        >
          Tạo tài khoản và tiếp tục
        </button>
      </form>

      <p className="text-center text-sm text-slate-400">
        Đã có tài khoản?{' '}
        <Link href={`/${locale}/login`} className="text-violet-300 hover:text-violet-200">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}
