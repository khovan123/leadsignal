# LeadSignal

LeadSignal is a Reddit lead-intelligence MVP. It collects configured public Reddit sources, deduplicates posts, classifies buying signals through a shared multi-account LLM pool, and promotes qualified posts into a collaborative lead inbox.

## Current status

The repository contains a functional end-to-end MVP suitable for local development, internal alpha, and controlled private beta.

Implemented:

- Workspace registration, login, JWT access tokens, rotating refresh-token families, logout and workspace authorization
- HTTP-only access/refresh cookies in Next.js with automatic refresh rotation
- Workspace invitations with one-time tokens and durable email outbox delivery
- Scheduled Playwright collection from configured public subreddit, search and Reddit listing pages
- Reddit post normalization, deduplication and classification dispatch
- Shared member-owned LLM connections with account, model and provider fallback
- OpenAI-compatible, OpenRouter, GitHub Models, Anthropic, Gemini and Rule Engine strategies
- BullMQ classification worker with distributed concurrency limits in Valkey
- Lead creation, lead inbox and status updates
- Vietnamese and English routes
- PostgreSQL migrations, unit tests, HTTP E2E tests and staging smoke checks

The Reddit collector does not require `REDDIT_CLIENT_ID` or `REDDIT_CLIENT_SECRET`. It also does not accept browser cookies, localStorage snapshots or private Reddit API credentials. Sources that require an authenticated personalized session are not supported by this collector.

## Stack

- Backend: NestJS 11, Fastify, Prisma 7, PostgreSQL
- Queue and coordination: BullMQ and Valkey
- Reddit collection: Playwright with Chrome or Playwright Chromium
- Frontend: Next.js 16 App Router, React Server Components, Server Actions, Tailwind CSS, Lucide, next-intl, GSAP and Three.js
- Runtime: Node.js 24 and pnpm 10

## Architecture

```text
Next.js Server Components and Server Actions
                    |
                    v
             NestJS REST API
            /                \
     PostgreSQL          BullMQ / Valkey
            ^                  |
            |                  v
      Email outbox       NestJS worker
                               |
                  Reddit crawler + LLM pool
```

The Reddit crawler reads enabled `RedditSource` records directly. New discoveries are stored in `RedditPost` and `PostDiscovery`, then queued for classification. Existing discoveries are refreshed without creating duplicate classification jobs.

## Supported Reddit sources

A source is resolved in the following order:

1. When `subreddit` is present, crawl `r/<subreddit>/new`.
2. Types containing `POPULAR`, `NEWS` or `BEST` map to their public listing pages.
3. A `searchQuery` containing a Reddit URL is treated as a custom public Reddit URL.
4. Any other `searchQuery` is sent to Reddit public search with `sort=new`.

The collector rejects custom URLs outside `reddit.com`. It excludes promoted, pinned and NSFW cards by default. When a modern subreddit page yields no cards, it falls back once to `old.reddit.com` pagination.

The collector stops a source immediately when navigation returns HTTP `403` or `429`; it does not rotate proxies, reuse user sessions or bypass challenge pages.

## LLM routing order

1. Retry the current account and model.
2. Use the same model on another member-owned account.
3. Move to the next configured model tier.
4. Move to another provider.
5. Use the deterministic Rule Engine route.

Each connection and model can have its own concurrency limit. Slots are coordinated through Valkey so multiple worker replicas respect the same limits.

## Local setup

Requirements:

- Node.js 24
- pnpm 10
- Docker or Podman Compose
- Google Chrome, or Playwright Chromium

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

The default configuration uses the installed Chrome channel:

```env
REDDIT_BROWSER_CHANNEL=chrome
```

To use Playwright Chromium instead:

```bash
pnpm exec playwright install chromium
```

Then set:

```env
REDDIT_BROWSER_CHANNEL=
```

Playwright is headless by default. Only enable a visible browser for local debugging:

```env
REDDIT_SHOW_BROWSER=true
```

Generate unique local secrets before starting:

```bash
openssl rand -hex 32
openssl rand -base64 48
```

Use the hexadecimal value for `CREDENTIAL_ENCRYPTION_KEY` and the base64 value for `JWT_ACCESS_SECRET`.

Open:

- Web: `http://localhost:3000/vi`
- Swagger: `http://localhost:4000/docs`
- API health: `http://localhost:4000/api/health`

## Important environment variables

Core:

- `DATABASE_URL`
- `VALKEY_URL`
- `INTERNAL_API_URL`
- `NEXT_PUBLIC_API_URL`
- `PUBLIC_API_URL`
- `PUBLIC_APP_URL`
- `CREDENTIAL_ENCRYPTION_KEY`
- `JWT_ACCESS_SECRET`

Worker and Reddit crawler:

- `WORKER_CONCURRENCY`
- `REDDIT_COLLECTOR_INTERVAL_SECONDS`, default `300`
- `REDDIT_CRAWLER_ENABLED`, default `true`
- `REDDIT_SHOW_BROWSER`, default `false`
- `REDDIT_BROWSER_CHANNEL`, default `chrome`
- `REDDIT_CRAWLER_POSTS_PER_SOURCE`, default `50`, maximum `200`
- `REDDIT_CRAWLER_MAX_SCROLLS`, default `20`, maximum `100`
- `REDDIT_CRAWLER_MAX_STALL_ROUNDS`, default `4`
- `REDDIT_CRAWLER_NAVIGATION_TIMEOUT_MS`, default `30000`
- `REDDIT_CRAWLER_USER_AGENT`
- `REDDIT_CRAWLER_LOCALE`
- `REDDIT_CRAWLER_TIMEZONE`
- `EMAIL_OUTBOX_INTERVAL_SECONDS`, default `10`
- `EMAIL_OUTBOX_BATCH_SIZE`, default `20`

Security:

- `RATE_LIMIT_FAIL_OPEN`: use `true` for local development; set `false` in production
- `JWT_ACCESS_TTL_SECONDS`
- `JWT_REFRESH_TTL_DAYS`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

Integrations:

- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `RESEND_API_KEY`, `INVITATION_FROM_EMAIL`

## OAuth callback URLs

Configure these callback URLs for the remaining OAuth providers:

```text
{PUBLIC_API_URL}/connections/github/complete
{PUBLIC_API_URL}/connections/google/complete
```

## Authentication and rate limiting

Next.js stores the access token, refresh token and active workspace in HTTP-only cookies. The proxy refreshes an access token shortly before expiration. Refresh-token reuse revokes the complete token family.

Valkey-backed rate limits are applied globally, with stricter policies for login, registration, refresh, OAuth authorization and workspace invitations. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` when blocked.

## Email outbox

Invitation creation and outbox insertion happen in the same PostgreSQL transaction. The worker claims pending messages with `FOR UPDATE SKIP LOCKED`, allowing multiple replicas without duplicate claims.

Failed deliveries use exponential retry delays from 15 seconds up to one hour. Messages stop retrying after eight attempts and retain the last error for operational inspection.

## Tests

Run TypeScript builds and unit tests:

```bash
pnpm build
pnpm test
```

Run the PostgreSQL/Valkey HTTP E2E suite:

```bash
pnpm test:e2e
```

CI runs migrations, builds every package, runs unit tests, and runs the E2E suite against clean PostgreSQL and Valkey services. CI does not launch a real Reddit browser crawl.

## Staging smoke tests

Create a GitHub Environment named `staging` with:

- `STAGING_BASE_URL`
- `STAGING_SMOKE_EMAIL`
- `STAGING_SMOKE_PASSWORD`
- Optional `STAGING_WORKSPACE_ID`

Set `STAGING_SMOKE_OAUTH_PROVIDERS` only for configured OAuth providers, such as `github,google`.

## Production operations

Read `docs/production-secrets.md` before deployment. Install Chrome or Playwright Chromium on the worker host. Production still requires backup/restore verification, monitoring and alerting, and load testing for the intended Reddit and LLM volume.
