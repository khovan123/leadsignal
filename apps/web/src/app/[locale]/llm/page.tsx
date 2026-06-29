import { getTranslations } from 'next-intl/server';
import { api, getWorkspaceId } from '@/lib/api';
import {
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

export default async function LlmPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('llm');
  const workspaceId = await getWorkspaceId();
  const connections = await api<Connection[]>(
    `/workspaces/${workspaceId}/llm/connections`,
  );
  const nineRouterBaseUrl =
    process.env.NINE_ROUTER_BASE_URL ?? 'http://127.0.0.1:20128/v1';
  const nineRouterDefaultModel =
    process.env.NINE_ROUTER_DEFAULT_MODEL ?? 'cc/claude-sonnet-4-6';

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <p className="mt-3 max-w-3xl text-slate-400">{t('subtitle')}</p>
      </div>

      <section className="panel overflow-hidden border-violet-700/60">
        <div className="border-b border-slate-800 bg-violet-950/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                Subscription gateway
              </p>
              <h2 className="mt-2 text-xl font-semibold">9Router</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Connect LeadSignal to the local 9Router OpenAI-compatible endpoint.
                Claude Code and Codex subscription authentication, quota tracking,
                refresh, account rotation, and fallback remain inside 9Router.
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
          <input
            type="hidden"
            name="provider"
            value="CUSTOM_OPENAI_COMPATIBLE"
          />
          <input type="hidden" name="name" value="9Router" />
          <input
            type="hidden"
            name="accountLabel"
            value="Subscription Gateway"
          />

          <label className="text-sm lg:col-span-2">
            Base URL
            <input
              name="baseUrl"
              required
              defaultValue={nineRouterBaseUrl}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
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
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>

          <label className="text-sm lg:col-span-2">
            Model or combo
            <input
              name="model"
              required
              defaultValue={nineRouterDefaultModel}
              list="nine-router-models"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
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
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>

          <div className="flex items-end">
            <button className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium">
              Add 9Router to pool
            </button>
          </div>

          <p className="text-xs text-slate-500 lg:col-span-4">
            First connect Claude Code or Codex under 9Router Providers, then use
            its generated endpoint key here. LeadSignal only calls
            /v1/models and /v1/chat/completions.
          </p>
        </form>
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
          <input
            name="name"
            required
            placeholder="Connection name"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <input
            name="accountLabel"
            placeholder="Account label"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <select
            name="provider"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          >
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
          <input
            name="model"
            required
            placeholder="Model ID"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <input
            name="baseUrl"
            placeholder="Custom base URL"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <input
            name="credential"
            type="password"
            required
            placeholder="API credential"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <input
            name="ownerConcurrencyLimit"
            type="number"
            min="1"
            max="50"
            defaultValue="2"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <button className="rounded-lg bg-slate-700 px-4 py-2 font-medium md:col-span-2">
            Add account to shared pool
          </button>
        </form>
      </details>

      <div className="space-y-3">
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
            Connect 9Router or add the first provider account above.
          </div>
        )}
      </div>
    </div>
  );
}
