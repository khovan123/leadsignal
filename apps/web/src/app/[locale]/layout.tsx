import '../globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';

export function generateStaticParams() { return [{ locale: 'vi' }, { locale: 'en' }]; }
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages();
  return <html lang={locale}><body><NextIntlClientProvider messages={messages}><AppShell locale={locale}>{children}</AppShell></NextIntlClientProvider></body></html>;
}
