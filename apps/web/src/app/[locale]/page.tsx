import { getTranslations } from 'next-intl/server';
import { AnimatedHeader } from '@/components/animated-header';
import { PoolSceneLazy } from '@/components/pool-scene-lazy';
import { api, getWorkspaceId } from '@/lib/api';
type Workspace={name:string;_count:{members:number;leads:number;llmConnections:number}};
export default async function Overview(){const t=await getTranslations('overview');const workspaceId=await getWorkspaceId();const workspace=await api<Workspace>(`/workspaces/${workspaceId}`);return <div className="space-y-8"><AnimatedHeader title={t('title')} subtitle={t('subtitle')}/><section className="panel overflow-hidden lg:grid lg:grid-cols-2"><div className="grid grid-cols-2 gap-4 p-6 lg:p-10"><Metric label={t('workspace')} value={workspace.name}/><Metric label={t('leads')} value={workspace._count.leads}/><Metric label={t('connections')} value={workspace._count.llmConnections}/><Metric label="Members" value={workspace._count.members}/></div><PoolSceneLazy/></section></div>}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-5"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>}
