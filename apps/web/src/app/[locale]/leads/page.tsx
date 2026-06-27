import { getTranslations } from 'next-intl/server';
import { api, getWorkspaceId } from '@/lib/api';
import { updateLeadStatus } from '../actions';

type Lead={id:string;status:string;priorityScore:number;priorityLevel:string;post:{title:string;subreddit:string;permalink:string};classification:{signalType:string;summary:string;provider:string;model:string}};

export default async function LeadsPage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;
  const t=await getTranslations('leads');
  const workspaceId=await getWorkspaceId();
  const leads=await api<Lead[]>(`/workspaces/${workspaceId}/leads`);
  return <div className="space-y-6"><h1 className="text-3xl font-semibold">{t('title')}</h1>{leads.length===0?<div className="panel p-8 text-slate-400">{t('empty')}</div>:leads.map((lead)=><article key={lead.id} className="panel p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><a href={lead.post.permalink} target="_blank" className="font-semibold hover:text-violet-300">{lead.post.title}</a><p className="mt-2 text-sm text-slate-400">{lead.classification.summary}</p><p className="mt-2 text-xs text-slate-500">r/{lead.post.subreddit} · {lead.classification.provider}/{lead.classification.model}</p></div><span className="rounded-full bg-violet-500/15 px-3 py-1 text-sm text-violet-300">{lead.priorityLevel} · {lead.priorityScore}</span></div><form action={updateLeadStatus} className="mt-4 flex gap-2"><input type="hidden" name="id" value={lead.id}/><input type="hidden" name="locale" value={locale}/><select name="status" defaultValue={lead.status} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">{['NEW','REVIEWING','QUALIFIED','ASSIGNED','CONTACTED','CONVERTED','REJECTED','ARCHIVED'].map((status)=><option key={status}>{status}</option>)}</select><button className="rounded-lg bg-violet-600 px-3 py-2 text-sm">Save</button></form></article>)}</div>;
}
