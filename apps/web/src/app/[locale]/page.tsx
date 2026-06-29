import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AnimatedHeader } from '@/components/animated-header';
import { PoolSceneLazy } from '@/components/pool-scene-lazy';
import { api, getWorkspaceId } from '@/lib/api';

type Workspace = {
  name: string;
  _count: { members: number; leads: number; llmConnections: number };
};

type OverviewProps = {
  params: Promise<{ locale: string }>;
};

export default async function Overview({ params }: OverviewProps) {
  const [{ locale }, t, workspaceId] = await Promise.all([
    params,
    getTranslations('overview'),
    getWorkspaceId(),
  ]);

  if (!workspaceId) {
    return (
      <div className="space-y-8">
        <AnimatedHeader
          title={t('title')}
          subtitle="You are signed in, but no workspace is attached to this account yet."
        />
        <section className="panel p-6 lg:p-10">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-xl font-semibold">No active workspace</h2>
            <p className="text-slate-400">
              Join a workspace through an invitation, or register a new account that creates an initial workspace.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/invite`}
                className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
              >
                Accept invitation
              </Link>
              <Link
                href={`/${locale}/register`}
                className="rounded-lg border border-slate-600 px-4 py-2 font-medium hover:bg-slate-800"
              >
                Create account and workspace
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const workspace = await api<Workspace>(`/workspaces/${workspaceId}`);

  return (
    <div className="space-y-8">
      <AnimatedHeader title={t('title')} subtitle={t('subtitle')} />
      <section className="panel overflow-hidden lg:grid lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-4 p-6 lg:p-10">
          <Metric label={t('workspace')} value={workspace.name} />
          <Metric label={t('leads')} value={workspace._count.leads} />
          <Metric label={t('connections')} value={workspace._count.llmConnections} />
          <Metric label="Members" value={workspace._count.members} />
        </div>
        <PoolSceneLazy />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
