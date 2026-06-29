import Link from 'next/link';
import { registerAction } from '../auth-actions';

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  const message = error ? decodeURIComponent(error) : '';

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Tạo tài khoản LeadSignal</h1>
        <p className="mt-2 text-slate-400">
          Tạo tài khoản trước, sau đó LeadSignal sẽ tự ghép nối extension bằng phiên đăng nhập của bạn.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {message}
        </div>
      )}

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
            minLength={12}
            autoComplete="new-password"
            aria-describedby="password-help"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <span id="password-help" className="mt-2 block text-xs text-slate-400">
            Mật khẩu phải có ít nhất 12 ký tự.
          </span>
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
