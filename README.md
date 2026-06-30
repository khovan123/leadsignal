# LeadSignal

LeadSignal is a private Reddit lead-intelligence application for a small workspace. Members authenticate through the LeadSignal browser extension, capture Reddit posts already rendered in their active tab, and send signed post batches to the existing classification and lead pipeline.

## Implemented

- Extension-only authentication by default; no email/password registration is required
- ECDSA P-256 device key generated and retained inside extension storage
- One-time device pairing codes and first-device bootstrap code
- Short-lived login challenges and one-time login tickets
- Signed Reddit post ingestion with timestamp and nonce replay protection
- Maximum private workspace size configurable with `MAX_PRIVATE_USERS`, default `10`
- HTTP-only LeadSignal access and rotating refresh-token cookies after extension verification
- Reddit post normalization, source discovery, deduplication and BullMQ classification dispatch
- Shared multi-account LLM pool with model/account/provider fallback
- Lead inbox, status workflow, workspace authorization and invitations
- Optional server-side Playwright public-page collector, disabled by default
- PostgreSQL migrations, unit tests and HTTP E2E tests

The extension does **not** send Reddit cookies, localStorage, sessionStorage, access tokens or other browser credentials to LeadSignal. It sends the device public key, signed proofs and parsed post data only.

## Authentication flow

```text
LeadSignal login page
        |
        v
Detect installed extension
        |
        +-- not installed --> show installation instructions
        |
        v
Pair device with one-time code
        |
        v
API issues short-lived challenge
        |
        v
Extension signs challenge with device private key
        |
        v
API verifies signature and issues one-time login ticket
        |
        v
Next.js exchanges ticket for LeadSignal JWT/refresh session
```

The first device can pair using `EXTENSION_BOOTSTRAP_CODE` only while no extension device exists. Later devices require a pairing code created by an OWNER or ADMIN:

```http
POST /api/workspaces/:workspaceId/extension-devices/pairing-codes
Authorization: Bearer <LeadSignal access token>
```

## Reddit capture flow

1. Open Reddit and sign in normally in the browser.
2. Open Home, Best, Popular, a subreddit, or another Reddit listing.
3. Allow Reddit to render the posts you need.
4. Click the LeadSignal extension toolbar icon.
5. The extension parses the visible/rendered post cards.
6. It signs the canonical batch with its device key.
7. LeadSignal verifies the proof, rejects replayed nonces, upserts posts and queues new discoveries for classification.

The toolbar action does not transfer the Reddit session and does not perform a background session crawl.

## Stack

- Backend: NestJS 11, CQRS, Prisma 7, PostgreSQL
- Queue and coordination: BullMQ and Valkey
- Frontend: Next.js 16 App Router, React Server Components, Server Actions, Tailwind CSS, next-intl
- Extension: Chrome/Edge Manifest V3, Web Crypto ECDSA P-256
- Runtime: Node.js 24 and pnpm 10

## Local setup

Requirements:

- Node.js 24
- pnpm 10
- Docker or Podman Compose
- Chrome or Edge for the extension

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

The API `dev` script now runs `pnpm db:generate` and `pnpm db:deploy` before starting the watch process. After pulling code that contains a new migration, stop and restart `pnpm dev`; pending migrations are applied before the API accepts requests. Use `pnpm --filter @leadsignal/api dev:watch` only when intentionally skipping this migration check.

Generate environment secrets:

```bash
openssl rand -hex 32       # CREDENTIAL_ENCRYPTION_KEY
openssl rand -base64 48    # JWT_ACCESS_SECRET
openssl rand -hex 16       # EXTENSION_BOOTSTRAP_CODE
```

Set at minimum:

```env
CREDENTIAL_ENCRYPTION_KEY=<64 hex characters>
JWT_ACCESS_SECRET=<random secret>
PASSWORD_AUTH_ENABLED=false
MAX_PRIVATE_USERS=10
EXTENSION_BOOTSTRAP_CODE=<first-device pairing code>
REDDIT_CRAWLER_ENABLED=false
```

Open:

- Web: `http://localhost:3001/vi`
- API health: `http://localhost:4000/api/health`
- Swagger: `http://localhost:4000/docs`

## Install the extension

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select the repository directory `apps/extension`.
5. Reload `http://localhost:3001/vi/login`.
6. Enter `EXTENSION_BOOTSTRAP_CODE` for the first device.
7. For later devices, enter the one-time pairing code created by an OWNER or ADMIN.

The local extension defaults are:

```text
App: http://localhost:3001
API: http://localhost:4000/api
```

## Extension API

Public proof endpoints:

```text
POST /api/auth/extension/pair
POST /api/auth/extension/challenge
POST /api/auth/extension/verify
POST /api/auth/extension/exchange
POST /api/extension/ingest
```

Authenticated device-management endpoints:

```text
POST /api/workspaces/:workspaceId/extension-devices/pairing-codes
GET  /api/workspaces/:workspaceId/extension-devices
POST /api/workspaces/:workspaceId/extension-devices/:deviceId/revoke
```

## Security controls

- Private key never leaves extension storage
- P-256 signatures use SHA-256 and IEEE-P1363 encoding
- Login challenges expire after two minutes
- Exchange tickets expire after one minute and can be consumed once
- Ingestion timestamps must be within five minutes
- Device/nonces are unique and replay attempts return a conflict
- Ingestion rejects credential-shaped keys such as cookies, authorization, localStorage and tokens
- Custom post/source URLs must use `reddit.com`
- A signed batch contains at most 100 posts
- Revoked devices cannot authenticate or ingest
- Password registration/login remains disabled unless `PASSWORD_AUTH_ENABLED=true`

## Optional public collector

The server-side Playwright collector is retained as an optional adapter and is disabled by default:

```env
REDDIT_CRAWLER_ENABLED=false
```

When enabled, the worker reads public configured sources without Reddit API keys. Extension capture remains the primary private workflow.

## Tests

```bash
pnpm build
pnpm test
pnpm test:e2e
```

The E2E suite covers:

- extension bootstrap and pairing;
- P-256 challenge verification;
- one-time ticket exchange;
- signed ingestion;
- ticket and nonce replay rejection;
- legacy authentication behavior when explicitly enabled for compatibility tests;
- workspace authorization and invitation flows.

Final validation run: `28328444345`.

Additional design notes are in `docs/extension-authentication.md` and `docs/backend-architecture.md`.
