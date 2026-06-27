# LeadSignal

LeadSignal is a Reddit lead-intelligence MVP. It collects configured Reddit sources, deduplicates posts, classifies buying signals through a shared multi-account LLM pool, and promotes qualified posts into a collaborative lead inbox.

## Current status

The repository contains a functional end-to-end MVP suitable for local development, internal alpha, and controlled private beta.

Implemented:

- Workspace registration, login, JWT access tokens, rotating refresh-token families, logout and workspace authorization
- HTTP-only access/refresh cookies in Next.js with automatic refresh rotation
- Workspace invitations with one-time tokens and durable email outbox delivery
- Reddit OAuth, scheduled subreddit/search collectors and post deduplication
- Shared member-owned LLM connections with account, model and provider fallback
- OpenAI-compatible, OpenRouter, GitHub Models, Anthropic, Gemini and Rule Engine strategies
- BullMQ classification worker with distributed concurrency limits in Valkey
- Lead creation, lead inbox and status updates
- Vietnamese and English routes
- PostgreSQL migrations, unit tests, HTTP E2E tests and staging smoke checks

Only official provider API or OAuth credentials are supported. Browser session cookies and private web endpoints are not supported.

## Stack

- Backend: NestJS 11, Fastify, Prisma 7, PostgreSQL
- Queue and coordination: BullMQ and Valkey
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
                    Reddit collector + LLM pool
```

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

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
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

Workers:

- `WORKER_CONCURRENCY`
- `REDDIT_COLLECTOR_INTERVAL_SECONDS`
- `EMAIL_OUTBOX_INTERVAL_SECONDS`, default `10`
- `EMAIL_OUTBOX_BATCH_SIZE`, default `20`

Security:

- `RATE_LIMIT_FAIL_OPEN`: use `true` for local development; set `false` in production
- `JWT_ACCESS_TTL_SECONDS`
- `JWT_REFRESH_TTL_DAYS`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

Integrations:

- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `RESEND_API_KEY`, `INVITATION_FROM_EMAIL`

## OAuth callback URLs

Configure these exact callback URLs in the provider consoles:

```text
{PUBLIC_API_URL}/connections/reddit/complete
{PUBLIC_API_URL}/connections/github/complete
{PUBLIC_API_URL}/connections/google/complete
```

For example:

```text
https://api.example.com/api/connections/reddit/complete
```

## Authentication and rate limiting

Next.js stores the access token, refresh token and active workspace in HTTP-only cookies. The proxy refreshes an access token shortly before expiration. Refresh-token reuse revokes the complete token family.

Valkey-backed rate limits are applied globally, with stricter policies for:

- Login: 10 attempts per 15 minutes
- Registration: 5 attempts per hour
- Refresh: 30 attempts per minute
- OAuth authorization: 20 attempts per 10 minutes
- Workspace invitations: 30 attempts per hour
- Other API requests: 300 requests per minute

Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` when blocked.

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

The E2E suite covers registration, login, refresh rotation, refresh-token reuse detection, workspace authorization, invitation acceptance, invitation replay, and OAuth state expiry/replay.

CI runs migrations, builds every package, runs unit tests, and runs the E2E suite against clean PostgreSQL and Valkey services.

## Staging smoke tests

Create a GitHub Environment named `staging` with:

- `STAGING_BASE_URL`
- `STAGING_SMOKE_EMAIL`
- `STAGING_SMOKE_PASSWORD`
- Optional `STAGING_WORKSPACE_ID`

Set the environment variable `STAGING_SMOKE_OAUTH_PROVIDERS` to a comma-separated list such as `github,google,reddit` when those OAuth applications are configured in staging.

Run manually from Actions → Staging Smoke, or allow the scheduled daily run. Locally:

```bash
STAGING_BASE_URL=https://staging.example.com \
STAGING_SMOKE_EMAIL=smoke@example.com \
STAGING_SMOKE_PASSWORD='replace-me' \
pnpm smoke:staging
```

The smoke test checks API health, the login page, authentication, refresh rotation, workspace access, and optionally provider authorization URLs. It never prints access or refresh tokens.

## Production operations

Read `docs/production-secrets.md` before deployment. Production still requires real provider callback validation, backup/restore verification, monitoring and alerting, and load testing for the intended Reddit and LLM volume.
