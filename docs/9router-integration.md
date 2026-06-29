# 9Router integration

LeadSignal uses 9Router as a local OpenAI-compatible gateway. Subscription login, quota tracking, token refresh, account rotation, and provider fallback stay inside 9Router. LeadSignal stores only the 9Router endpoint key created in the 9Router dashboard.

## Runtime flow

```text
LeadSignal worker
  -> 9Router /v1/chat/completions
  -> Claude Code, Codex, combo, or fallback model
  -> normalized OpenAI response
  -> LeadSignal classification pipeline
```

## Start 9Router

Published image:

```bash
docker run -d \
  --name 9router \
  -p 20128:20128 \
  -v "$HOME/.9router:/app/data" \
  -e DATA_DIR=/app/data \
  decolua/9router:latest
```

Open `http://127.0.0.1:20128/dashboard`, then:

1. Connect Claude Code for Claude subscription models, Codex for ChatGPT subscription models, or both.
2. Create an endpoint API key in 9Router.
3. Optionally create a combo such as `premium-coding` or `always-on`.
4. Open LeadSignal LLM Pool and add the 9Router connection.

## LeadSignal settings

```env
NINE_ROUTER_BASE_URL=http://127.0.0.1:20128/v1
NINE_ROUTER_DEFAULT_MODEL=cc/claude-sonnet-4-6
```

The endpoint key is entered through the LeadSignal UI and encrypted by the existing credential service.

Suggested models:

```text
cc/claude-opus-4-7
cc/claude-sonnet-4-6
cx/gpt-5.5
cx/gpt-5.4
premium-coding
always-on
```

## Docker networking

When LeadSignal and 9Router run in the same Compose network, use:

```env
NINE_ROUTER_BASE_URL=http://9router:20128/v1
```

When 9Router runs on the Docker host and LeadSignal runs in a container, use the host gateway supported by the deployment platform instead of `127.0.0.1`.

## Verification

LeadSignal verifies a 9Router connection by:

1. Calling `GET /v1/models` with the endpoint key.
2. Checking that the configured model or combo exists when a model list is returned.
3. Sending a small classification request to `POST /v1/chat/completions`.

The OpenAI-compatible strategy accepts both base URL forms:

```text
http://127.0.0.1:20128
http://127.0.0.1:20128/v1
```

For translated subscription routes that reject OpenAI `response_format`, LeadSignal retries once without that field.

## CI validation

Every push to the open pull request validates dependency installation, Prisma generation and migration deployment, application build, unit tests, and API E2E tests. Runtime calls to 9Router are not required during CI; the integration is exercised through the OpenAI-compatible strategy boundary.
