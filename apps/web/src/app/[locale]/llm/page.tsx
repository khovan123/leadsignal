import { getTranslations } from 'next-intl/server';
import { api, workspaceId } from '@/lib/api';
import { createLlmConnection, removeLlmConnection, verifyLlmConnection } from '../actions';

type Connection = { id: string; provider: string; name: string; accountLabel?: string; status: string; ownerConcurrencyLimit: number; healthScore: number; ownerUserId: string; models: { model: string }[] };
export default async function LlmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('llm');
  const connections = await api<Connection[]>(`/workspaces/${workspaceId}/llm/connections`);
  return <div className="space-y-7"><div><h1 className="text-3xl font-semibold">{t('title')}</h1><p className="mt-3 max-w-3xl text-slate-400">{t('subtitle')}</p></div>
    <form action={createLlmConnection} className="panel grid gap-3 p-5 md:grid-cols-3">
      <input type="hidden" name="locale" value={locale}/><input name="name" required placeholder="Connection name" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"/>
      <input name="accountLabel" placeholder="abc@example.com" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"/>
      <select name="provider" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">{['OPENAI','OPENROUTER','ANTHROPIC','GEMINI','GITHUB_MODELS','CUSTOM_OPENAI_COMPATIBLE'].map((p)=><option key={p}>{p}</option>)}</select>
      <input name="model" required placeholder="Model ID" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"/>
      <input name="baseUrl" placeholder="Custom base URL (optional)" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"/>
      <input name="credential" type="password" required placeholder="API credential" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"/>
      <input name="ownerConcurrencyLimit" type="number" min="1" max="50" defaultValue="2" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"/>
      <button className="rounded-lg bg-violet-600 px-4 py-2 font-medium md:col-span-2">Add account to shared pool</button>
    </form>
    <div className="panel overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-700 text-slate-400"><tr><th className="p-4">Provider</th><th className="p-4">{t('account')}</th><th className="p-4">Models</th><th className="p-4">{t('health')}</th><th className="p-4">{t('capacity')}</th><th className="p-4">{t('status')}</th><th className="p-4">Actions</th></tr></thead><tbody>{connections.map((c) => <tr key={c.id} className="border-b border-slate-800"><td className="p-4 font-medium">{c.provider}</td><td className="p-4">{c.name}<div className="text-xs text-slate-500">{c.accountLabel}</div></td><td className="p-4 text-slate-400">{c.models.map((m) => m.model).join(', ')}</td><td className="p-4">{c.healthScore}/100</td><td className="p-4">{c.ownerConcurrencyLimit}</td><td className="p-4"><span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">{c.status}</span></td><td className="p-4"><div className="flex gap-2"><form action={verifyLlmConnection}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="locale" value={locale}/><button className="rounded bg-slate-700 px-2 py-1">Verify</button></form><form action={removeLlmConnection}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="locale" value={locale}/><button className="rounded bg-red-950 px-2 py-1 text-red-300">Remove</button></form></div></td></tr>)}</tbody></table>{connections.length === 0 && <div className="p-8 text-slate-400">Add the first provider account above.</div>}</div>
  </div>;
}
