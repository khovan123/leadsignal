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
  const nineRouterBaseUrl =
    process.env.NINE_ROUTER_BASE_URL ?? 'http://127.0.0.1:20128/v1';
  const nineRouterDefaultModel =
    process.env.NINE_ROUTER_DEFAULT_MODEL ?? 'cc/claude-sonnet-4-6';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Shared LLM Pool</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Kết nối provider chính thức hoặc 9Router subscription gateway vào pool chung.
        </p>
      </div>

      {connected && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-emerald-200">
          Đã kết nối {connected}. Model đã được thêm vào shared pool.
        </div>
      )}

      <section className="panel overflow-hidden border-violet-700/60">
        <div className="border-b border-slate-800 bg-violet-950/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                Subscription gateway
              </p>
              <h2 className="mt-2 text-xl font-semibold">9Router</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                LeadSignal gọi endpoint OpenAI-compatible của 9Router. Claude Code,
                Codex, quota, refresh, account rotation và fallback được quản lý
                bên trong 9Router.
              </p>
            </div>
            <a
              href="http://127.0.0.1:20128/dashboard"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-violet-500/60 px-3 py-2 text-sm text-violet-200"
            >
              Open 9Router dashboard
            </a>
          </div>
        </div>

        <form
          action={createLlmConnection}
          className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="provider" value="CUSTOM_OPENAI_COMPATIBLE" />
          <input type="hidden" name="name" value="9Router" />
          <input type="hidden" name="accountLabel" value="Subscription Gateway" />

          <label className="text-sm lg:col-span-2">
            Base URL
            <input
              name="baseUrl"
              required
              defaultValue={nineRouterBaseUrl}
              className="field mt-2"
            />
          </label>

          <label className="text-sm lg:col-span-2">
            9Router endpoint API key
            <input
              name="credential"
              type="password"
              required
              placeholder="Copy from 9Router dashboard"
              autoComplete="off"
              className="field mt-2"
            />
          </label>

          <label className="text-sm lg:col-span-2">
            Model or combo
            <input
              name="model"
              required
              defaultValue={nineRouterDefaultModel}
              list="nine-router-models"
              className="field mt-2"
            />
            <datalist id="nine-router-models">
              <option value="cc/claude-opus-4-7" />
              <option value="cc/claude-sonnet-4-6" />
              <option value="cx/gpt-5.5" />
              <option value="cx/gpt-5.4" />
              <option value="premium-coding" />
              <option value="always-on" />
            </datalist>
          </label>

          <label className="text-sm">
            Concurrency
            <input
              name="ownerConcurrencyLimit"
              type="number"
              min="1"
              max="10"
              defaultValue="1"
              className="field mt-2"
            />
          </label>

          <div className="flex items-end">
            <button className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium">
              Add 9Router to pool
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="panel space-y-4 p-6">
          <div>
            <p className="text-sm font-medium text-blue-300">OAuth</p>
            <h2 className="mt-1 text-xl font-semibold">Google Gemini</h2>
            <p className="mt-2 text-sm text-slate-400">
              Đăng nhập Google Cloud và cấp quyền Vertex AI. Credential được mã hóa ở backend.
            </p>
          </div>
          <form action={connectOAuthProvider}>
            <input type="hidden" name="provider" value="google" />
            <input type="hidden" name="locale" value={locale} />
            <button className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500">
              Connect Google with OAuth
            </button>
          </form>
          <p className="text-xs text-slate-500">Model mặc định: gemini-2.5-flash</p>
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
              <input name="accountLabel" placeholder="Account label" className="field" />
              <input name="model" required defaultValue={item.model} className="field" />
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

      <details className="panel">
        <summary className="cursor-pointer p-5 font-medium">
          Add another OpenAI-compatible or API-key provider
        </summary>
        <form
          action={createLlmConnection}
          className="grid gap-3 border-t border-slate-800 p-5 md:grid-cols-3"
        >
          <input type="hidden" name="locale" value={locale} />
          <input name="name" required placeholder="Connection name" className="field" />
          <input name="accountLabel" placeholder="Account label" className="field" />
          <select name="provider" className="field">
            {[
              'OPENAI',
              'OPENROUTER',
              'ANTHROPIC',
              'GEMINI',
              'GITHUB_MODELS',
              'CUSTOM_OPENAI_COMPATIBLE',
            ].map((provider) => (
              <option key={provider}>{provider}</option>
            ))}
          </select>
          <input name="model" required placeholder="Model ID" className="field" />
          <input name="baseUrl" placeholder="Custom base URL" className="field" />
          <input
            name="credential"
            type="password"
            required
            placeholder="API credential"
            className="field"
          />
          <input
            name="ownerConcurrencyLimit"
            type="number"
            min="1"
            max="50"
            defaultValue="2"
            className="field"
          />
          <button className="rounded-lg bg-slate-700 px-4 py-2 font-medium md:col-span-2">
            Add account to shared pool
          </button>
        </form>
      </details>

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
                <button className="rounded bg-slate-700 px-3 py-2 text-sm">Verify</button>
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
