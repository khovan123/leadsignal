import { api, getWorkspaceId } from '@/lib/api';
import {
  connectOAuthProvider,
  createLlmConnection,
  removeLlmConnection,
  verifyLlmConnection,
} from '../actions';

type Connection = {
  id: string;
  provider: string;
  name: string;
  accountLabel?: string;
  status: string;
  ownerConcurrencyLimit: number;
  healthScore: number;
  ownerUserId: string;
  models: { model: string }[];
};

const KEY_PROVIDERS = [
  {
    provider: 'OPENAI',
    title: 'OpenAI GPT',
    description: 'OpenAI API sử dụng API key chính thức.',
    model: 'gpt-4.1-mini',
    credential: 'OpenAI API key',
  },
  {
    provider: 'ANTHROPIC',
    title: 'Anthropic Claude',
    description: 'Claude API sử dụng Anthropic API key chính thức.',
    model: 'claude-sonnet-4-5',
    credential: 'Anthropic API key',
  },
] as const;

export default async function LlmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ connected?: string }>;
}) {
  const { locale } = await params;
  const { connected } = await searchParams;
  const workspaceId = await getWorkspaceId();
  const connections = await api<Connection[]>(
    `/workspaces/${workspaceId}/llm/connections`,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Shared LLM Pool</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Kết nối tài khoản AI vào pool chung. Google hỗ trợ OAuth; OpenAI và Anthropic sử dụng API key theo tài liệu chính thức của provider.
        </p>
      </div>

      {connected && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-emerald-200">
          Đã kết nối {connected}. Model đã được thêm vào shared pool.
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="panel space-y-4 p-6">
          <div>
            <p className="text-sm font-medium text-blue-300">OAuth</p>
            <h2 className="mt-1 text-xl font-semibold">Google Gemini</h2>
            <p className="mt-2 text-sm text-slate-400">
              Đăng nhập Google Cloud và cấp quyền Vertex AI. Access token và refresh token được mã hóa ở backend.
            </p>
          </div>
          <form action={connectOAuthProvider}>
            <input type="hidden" name="provider" value="google" />
            <input type="hidden" name="locale" value={locale} />
            <button className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500">
              Connect Google with OAuth
            </button>
          </form>
          <p className="text-xs text-slate-500">
            Model mặc định: gemini-2.5-flash
          </p>
        </article>

        {KEY_PROVIDERS.map((item) => (
          <article key={item.provider} className="panel space-y-4 p-6">
            <div>
              <p className="text-sm font-medium text-violet-300">API key</p>
              <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{item.description}</p>
            </div>
            <form action={createLlmConnection} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="provider" value={item.provider} />
              <input
                name="name"
                required
                defaultValue={`${item.title} account`}
                className="field"
              />
              <input
                name="accountLabel"
                placeholder="Account label"
                className="field"
              />
              <input
                name="model"
                required
                defaultValue={item.model}
                className="field"
              />
              <input
                name="credential"
                type="password"
                required
                placeholder={item.credential}
                className="field"
              />
              <input type="hidden" name="ownerConcurrencyLimit" value="2" />
              <button className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium hover:bg-violet-500">
                Add {item.title}
              </button>
            </form>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Connected accounts</h2>
        {connections.map((connection) => (
          <article
            key={connection.id}
            className="panel flex flex-wrap items-center justify-between gap-4 p-5"
          >
            <div>
              <strong>
                {connection.provider} · {connection.name}
              </strong>
              <p className="text-sm text-slate-400">
                {connection.models.map((model) => model.model).join(', ')}
              </p>
              <p className="text-xs text-slate-500">
                Health {connection.healthScore}/100 · Capacity{' '}
                {connection.ownerConcurrencyLimit} · {connection.status}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={verifyLlmConnection}>
                <input type="hidden" name="id" value={connection.id} />
                <input type="hidden" name="locale" value={locale} />
                <button className="rounded bg-slate-700 px-3 py-2 text-sm">
                  Verify
                </button>
              </form>
              <form action={removeLlmConnection}>
                <input type="hidden" name="id" value={connection.id} />
                <input type="hidden" name="locale" value={locale} />
                <button className="rounded bg-red-950 px-3 py-2 text-sm text-red-300">
                  Remove
                </button>
              </form>
            </div>
          </article>
        ))}
        {connections.length === 0 && (
          <div className="panel p-8 text-slate-400">
            Chưa có provider account trong shared pool.
          </div>
        )}
      </section>
    </div>
  );
}
