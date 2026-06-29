import Link from 'next/link';
import { cookies } from 'next/headers';
import { loginAction } from '../auth-actions';
import { ExtensionLoginClient } from './extension-login-client';

export default async function LoginPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  const authenticated = Boolean((await cookies()).get('ls_access')?.value);

  if (authenticated) {
    return <ExtensionLoginClient locale={locale} initialError={error} />;
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Đăng nhập LeadSignal</h1>
        <p className="mt-2 text-slate-400">Đăng nhập để ghép nối lại extension.</p>
      </div>
      {error && <div className="rounded-lg border border-red-800 p-3 text-sm text-red-300">{decodeURIComponent(error)}</div>}
      <div className="panel space-y-4 p-6">
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input name="email" type="email" autoComplete="email" required placeholder="Email" className="field" />
          <input name="password" type="password" autoComplete="current-password" required minLength={12} placeholder="Mật khẩu" className="field" />
          <button className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium">Đăng nhập và ghép nối lại</button>
        </form>
        <Link href={`/${locale}/register`} className="block text-center text-sm text-violet-300">Tạo tài khoản mới</Link>
      </div>
    </div>
  );
}
