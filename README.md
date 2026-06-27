# LeadSignal MVP

LeadSignal collects Reddit posts, applies deterministic filters and a shared multi-account LLM pool, then promotes buying signals into a collaborative lead inbox.

## Stack

- **Backend:** NestJS 11, Fastify, Prisma 7, PostgreSQL, BullMQ, Valkey
- **Frontend:** Next.js 16 App Router, React Server Components, Server Actions, Tailwind CSS 4, shadcn-style UI, Lucide, next-intl, GSAP, Three.js
- **LLM routing:** member-owned shared connections, retry, account/model/provider fallback, per-connection distributed concurrency

## MVP capabilities

- Workspace-scoped leads and LLM pool
- Every member can add/remove their own LLM accounts
- Multiple accounts for the same provider
- OpenAI/OpenRouter/custom OpenAI-compatible, Anthropic and Gemini strategies
- Automatic fallback across accounts, models and providers
- Rule-engine final fallback
- BullMQ worker processes many posts concurrently
- Per-account concurrency leases in Valkey
- Lead inbox, status updates and source/classification metadata
- Vietnamese and English UI

> This repository accepts only official provider API/OAuth credentials. It does not implement web-session reverse proxies.

## Quick start

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000/vi` and the API Swagger page at `http://localhost:4000/docs`.

Test the full ingest → queue → classification → lead flow:

```bash
curl -X POST http://localhost:4000/api/workspaces/00000000-0000-4000-8000-000000000001/posts/ingest \
  -H 'content-type: application/json' \
  -d '{"externalPostId":"t3_test_001","subreddit":"SaaS","title":"Looking for an alternative CRM","body":"We need a tool this month and have budget approved."}'
```

## Demo identity

The MVP uses `x-user-id` and `x-workspace-id` headers as a replaceable demo identity boundary. The Next.js server API client injects the seeded IDs. Replace this with production JWT/rotating-refresh authentication before public launch.

## Important environment variables

- `DATABASE_URL`
- `VALKEY_URL`
- `CREDENTIAL_ENCRYPTION_KEY` (64 hexadecimal characters)
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_DEMO_WORKSPACE_ID`
- `NEXT_PUBLIC_DEMO_USER_ID`

## Architecture

```text
Next.js Server Components / Server Actions
                 |
                 v
          NestJS REST API
          /             \
   PostgreSQL          BullMQ / Valkey
                           |
                           v
                    NestJS Worker
                           |
                           v
              Shared LLM Connection Pool
```

## LLM fallback order

1. Retry the same account and model
2. Same model on another account
3. Another configured model
4. Another provider
5. Deterministic Rule Engine

## Next production steps

- Replace demo identity headers with JWT authentication
- Add Reddit OAuth callbacks and scheduled collectors
- Add invitation email delivery
- Add provider OAuth flows where officially supported
- Add E2E tests and production secrets management
