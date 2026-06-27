import { Activity, Bot, Radar } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

export async function AppShell({ locale, children }: { locale: string; children: ReactNode }) {
  const t = await getTranslations('nav');
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
    <aside className="border-r border-slate-800/80 bg-slate-950/50 p-6">
      <Link href={`/${locale}`} className="flex items-center gap-3 text-xl font-semibold"><Radar className="text-violet-400"/> LeadSignal</Link>
      <nav className="mt-10 space-y-2 text-sm text-slate-300">
        <Link className="flex gap-3 rounded-lg px-3 py-2 hover:bg-slate-800" href={`/${locale}`}><Activity size={18}/> {t('overview')}</Link>
        <Link className="flex gap-3 rounded-lg px-3 py-2 hover:bg-slate-800" href={`/${locale}/leads`}><Radar size={18}/> {t('leads')}</Link>
        <Link className="flex gap-3 rounded-lg px-3 py-2 hover:bg-slate-800" href={`/${locale}/llm`}><Bot size={18}/> {t('llm')}</Link>
      </nav>
    </aside>
    <main className="p-5 lg:p-10">{children}</main>
  </div>;
}
