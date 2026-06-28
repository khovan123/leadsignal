import { ExtensionLoginClient } from './extension-login-client';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  return <ExtensionLoginClient locale={locale} initialError={error} />;
}
