import { api, getWorkspaceId } from '@/lib/api';
import {
  createRedditSourceAction,
  deleteRedditSourceAction,
  runRedditSourcesAction,
  updateRedditSourceAction,
} from './actions';

type Source = {
  id: string;
  name: string;
  type: string;
  subreddit: string | null;
  searchQuery: string | null;
  enabled: boolean;
  sort: string;
  timeRange: string;
  targetPostCount: number;
  maxScrolls: number;
  maxStallRounds: number;
  includePromoted: boolean;
  includePinned: boolean;
  includeNsfw: boolean;
  detailEnabled: boolean;
  commentsTopN: number;
  collectionMode: string;
  lastRunAt: string | null;
  lastStatus: string;
  lastCollected: number;
  lastError: string | null;
};

type Job = {
  id: string;
  state: string;
  progress: unknown;
  result: unknown;
  failedReason: string | null;
};

const BUILT_INS = [
  { type: 'HOME', label: 'Home', description: 'Trang chủ Reddit công khai', mode: 'PUBLIC' },
  { type: 'POPULAR', label: 'Popular', description: 'Bài phổ biến toàn Reddit', mode: 'PUBLIC' },
  { type: 'NEWS', label: 'News', description: 'Nguồn Reddit News', mode: 'PUBLIC' },
  { type: 'BEST', label: 'Best', description: 'Bài được Reddit xếp hạng tốt nhất', mode: 'PUBLIC' },
  { type: 'FOLLOWING', label: 'Following', description: 'Feed cá nhân, chạy qua extension', mode: 'EXTENSION' },
] as const;

const SORTS = ['HOT', 'NEW', 'TOP', 'RISING', 'RELEVANCE', 'COMMENTS'];
const TIME_RANGES = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR', 'ALL'];

export default async function SourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    created?: string;
    saved?: string;
    deleted?: string;
    jobId?: string;
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const workspaceId = await getWorkspaceId();
  const sources = await api<Source[]>(
    `/workspaces/${workspaceId}/reddit-sources`,
  );
  let job: Job | null = null;
  if (query.jobId) {
    try {
      job = await api<Job>(
        `/workspaces/${workspaceId}/reddit-sources/jobs/${encodeURIComponent(query.jobId)}`,
      );
    } catch {
      job = null;
    }
  }
  const existingBuiltIns = new Set(
    sources
      .filter((source) => BUILT_INS.some((item) => item.type === source.type))
      .map((source) => source.type),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Reddit Sources</h1>
        <p className="mt-2 text-slate-400">
          Cấu hình feed, subreddit, search và URL; mỗi nguồn có số bài, sort, scroll và bộ lọc riêng.
        </p>
      </div>

      {(query.created || query.saved || query.deleted) && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          Cấu hình nguồn đã được cập nhật.
        </div>
      )}

      {query.jobId && (
        <div className="rounded-xl border border-violet-800 bg-violet-950/30 p-4 text-sm text-violet-100">
          <p className="font-medium">Collection job: {query.jobId}</p>
          <p className="mt-1 text-violet-200/80">
            Trạng thái: {job?.state ?? 'queued'}
            {job?.failedReason ? ` · ${job.failedReason}` : ''}
          </p>
          <a href={`/${locale}/sources?jobId=${encodeURIComponent(query.jobId)}`} className="mt-3 inline-block underline">
            Làm mới trạng thái
          </a>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Nguồn dựng sẵn</h2>
          <p className="mt-1 text-sm text-slate-400">
            Following cần extension đã pair; các nguồn còn lại có thể chạy bằng public collector.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BUILT_INS.map((item) => {
            const exists = existingBuiltIns.has(item.type);
            return (
              <form key={item.type} action={createRedditSourceAction} className="panel p-5">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="type" value={item.type} />
                <input type="hidden" name="name" value={`Reddit ${item.label}`} />
                <input type="hidden" name="enabled" value="true" />
                <input type="hidden" name="detailEnabled" value="true" />
                <input type="hidden" name="targetPostCount" value="50" />
                <input type="hidden" name="maxScrolls" value="20" />
                <input type="hidden" name="maxStallRounds" value="4" />
                <input type="hidden" name="sort" value="HOT" />
                <input type="hidden" name="timeRange" value="ALL" />
                <input type="hidden" name="collectionMode" value={item.mode} />
                <h3 className="font-semibold">{item.label}</h3>
                <p className="mt-2 min-h-10 text-sm text-slate-400">{item.description}</p>
                <button
                  disabled={exists}
                  className="mt-4 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {exists ? 'Đã thêm' : 'Thêm nguồn'}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-xl font-semibold">Thêm nguồn tùy chỉnh</h2>
        <form action={createRedditSourceAction} className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="text-sm">Loại nguồn
            <select name="type" defaultValue="SUBREDDIT" className="field">
              <option value="SUBREDDIT">Subreddit</option>
              <option value="SEARCH">Search query</option>
              <option value="CUSTOM_URL">Custom Reddit URL</option>
            </select>
          </label>
          <label className="text-sm">Tên hiển thị
            <input name="name" placeholder="Optional" className="field" />
          </label>
          <label className="text-sm">Subreddit
            <input name="subreddit" placeholder="smallbusiness" className="field" />
          </label>
          <label className="text-sm">Search query / URL
            <input name="searchQuery" placeholder="buying CRM hoặc https://reddit.com/..." className="field" />
          </label>
          <label className="text-sm">Sort
            <select name="sort" defaultValue="NEW" className="field">
              {SORTS.map((sort) => <option key={sort}>{sort}</option>)}
            </select>
          </label>
          <label className="text-sm">Time range
            <select name="timeRange" defaultValue="ALL" className="field">
              {TIME_RANGES.map((range) => <option key={range}>{range}</option>)}
            </select>
          </label>
          <NumberField name="targetPostCount" label="Số bài mục tiêu" value={50} min={1} max={2000} />
          <NumberField name="maxScrolls" label="Số lần scroll tối đa" value={20} min={1} max={100} />
          <NumberField name="maxStallRounds" label="Số vòng không có bài mới" value={4} min={1} max={12} />
          <NumberField name="commentsTopN" label="Top comments" value={0} min={0} max={50} />
          <label className="text-sm">Collection mode
            <select name="collectionMode" defaultValue="PUBLIC" className="field">
              <option value="PUBLIC">Public worker</option>
              <option value="EXTENSION">Browser extension</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <Check name="enabled" label="Enabled" defaultChecked />
            <Check name="detailEnabled" label="Detail" defaultChecked />
            <Check name="includePromoted" label="Promoted" />
            <Check name="includePinned" label="Pinned" />
            <Check name="includeNsfw" label="NSFW" />
          </div>
          <div className="flex items-end lg:col-span-2">
            <button className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium">Tạo nguồn</button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Nguồn đã cấu hình</h2>
            <p className="mt-1 text-sm text-slate-400">{sources.length} nguồn trong workspace.</p>
          </div>
          <form action={runRedditSourcesAction}>
            <input type="hidden" name="locale" value={locale} />
            <button disabled={!sources.some((source) => source.enabled)} className="rounded-lg bg-emerald-700 px-4 py-2 font-medium disabled:opacity-50">
              Run all enabled sources
            </button>
          </form>
        </div>

        {sources.length === 0 ? (
          <div className="panel p-6 text-sm text-slate-400">Chưa có nguồn Reddit.</div>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SourceCard({ source, locale }: { source: Source; locale: string }) {
  return (
    <details className="panel group overflow-hidden">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${source.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <h3 className="font-semibold">{source.name}</h3>
            <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{source.type}</span>
            <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{source.collectionMode}</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {source.subreddit ? `r/${source.subreddit}` : source.searchQuery || 'Built-in feed'} · {source.targetPostCount} posts · {source.sort}
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>{source.lastStatus} · {source.lastCollected} collected</p>
          <p className="mt-1">{source.lastRunAt ? new Date(source.lastRunAt).toLocaleString() : 'Never run'}</p>
        </div>
      </summary>
      <div className="border-t border-slate-800 p-5">
        {source.lastError && <div className="mb-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{source.lastError}</div>}
        <form action={updateRedditSourceAction} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="sourceId" value={source.id} />
          <label className="text-sm">Tên
            <input name="name" defaultValue={source.name} className="field" />
          </label>
          <label className="text-sm">Loại
            <select name="type" defaultValue={source.type} className="field">
              {['HOME','POPULAR','NEWS','BEST','FOLLOWING','SUBREDDIT','SEARCH','CUSTOM_URL'].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="text-sm">Subreddit
            <input name="subreddit" defaultValue={source.subreddit ?? ''} className="field" />
          </label>
          <label className="text-sm">Search query / URL
            <input name="searchQuery" defaultValue={source.searchQuery ?? ''} className="field" />
          </label>
          <label className="text-sm">Sort
            <select name="sort" defaultValue={source.sort} className="field">
              {SORTS.map((sort) => <option key={sort}>{sort}</option>)}
            </select>
          </label>
          <label className="text-sm">Time range
            <select name="timeRange" defaultValue={source.timeRange} className="field">
              {TIME_RANGES.map((range) => <option key={range}>{range}</option>)}
            </select>
          </label>
          <NumberField name="targetPostCount" label="Số bài mục tiêu" value={source.targetPostCount} min={1} max={2000} />
          <NumberField name="maxScrolls" label="Max scrolls" value={source.maxScrolls} min={1} max={100} />
          <NumberField name="maxStallRounds" label="Stall rounds" value={source.maxStallRounds} min={1} max={12} />
          <NumberField name="commentsTopN" label="Top comments" value={source.commentsTopN} min={0} max={50} />
          <label className="text-sm">Mode
            <select name="collectionMode" defaultValue={source.collectionMode} className="field">
              <option value="PUBLIC">Public worker</option>
              <option value="EXTENSION">Browser extension</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-4 text-sm lg:col-span-3">
            <Check name="enabled" label="Enabled" defaultChecked={source.enabled} />
            <Check name="detailEnabled" label="Detail" defaultChecked={source.detailEnabled} />
            <Check name="includePromoted" label="Promoted" defaultChecked={source.includePromoted} />
            <Check name="includePinned" label="Pinned" defaultChecked={source.includePinned} />
            <Check name="includeNsfw" label="NSFW" defaultChecked={source.includeNsfw} />
          </div>
          <div className="flex items-end lg:col-span-4">
            <button className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium">Lưu cấu hình</button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={runRedditSourcesAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sourceIds" value={source.id} />
            <button disabled={!source.enabled} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium disabled:opacity-50">Run this source</button>
          </form>
          <form action={deleteRedditSourceAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sourceId" value={source.id} />
            <button className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300">Xóa nguồn</button>
          </form>
        </div>
      </div>
    </details>
  );
}

function NumberField({ name, label, value, min, max }: { name: string; label: string; value: number; min: number; max: number }) {
  return <label className="text-sm">{label}<input name={name} type="number" min={min} max={max} defaultValue={value} className="field" /></label>;
}

function Check({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return <label className="flex items-center gap-2"><input name={name} type="checkbox" defaultChecked={defaultChecked} />{label}</label>;
}
