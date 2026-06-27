# Production secrets and rotation

Production values must come from the deployment platform's encrypted secret store. Never place real secrets in `.env`, images, workflow YAML, browser-exposed variables, logs, tickets or source control.

## Required secrets

- `DATABASE_URL` and `VALKEY_URL`: rotate when infrastructure credentials change or exposure is suspected.
- `CREDENTIAL_ENCRYPTION_KEY`: a unique 32-byte key for each environment.
- `JWT_ACCESS_SECRET`: at least 32 random characters; rotate every 90 days.
- Reddit, GitHub and Google OAuth client secrets: rotate every 180 days or after exposure.
- `RESEND_API_KEY`: rotate every 180 days or after exposure.

`NEXT_PUBLIC_API_URL` is public configuration. `INTERNAL_API_URL` is the private server-to-server API address used by Next.js.

## Deployment rules

1. Use distinct development, staging and production secrets.
2. Restrict secrets to the API, worker and migration identities that need them.
3. Run migrations as a one-shot job before deploying API and workers.
4. Never expose repository or environment secrets to forked pull requests.
5. Enable GitHub secret scanning and push protection.
6. Redact Authorization headers, cookies, OAuth codes and refresh tokens from logs.
7. Encrypt database backups and test restoration regularly.

## JWT rotation

Access tokens expire after 15 minutes by default. Replace `JWT_ACCESS_SECRET` in the secret store and roll API instances together. Existing access tokens become invalid, while valid refresh sessions obtain new access tokens through the Next.js proxy. Revoke all `AuthSession` rows as part of the incident response when a complete logout is required.

## Credential encryption-key rotation

`CREDENTIAL_ENCRYPTION_KEY` protects Reddit and LLM credentials with AES-256-GCM. Replacing it without re-encrypting data makes stored credentials unreadable.

1. Pause API credential writes and worker collectors.
2. Back up PostgreSQL.
3. Supply the old key only to a short-lived maintenance process.
4. Generate and stage the new 32-byte key.
5. Re-encrypt the encrypted credential, IV and authentication-tag columns in `LlmConnection`, `RedditConnection` and `ProviderOAuthCredential`.
6. Verify Reddit refresh and one request for every enabled provider.
7. Roll API and workers with only the new key.
8. Remove the old key from all secret stores and maintenance environments.

If the old key is lost, members must reconnect affected provider accounts.

## OAuth client-secret rotation

Create the new secret in the provider console, verify authorization-code and refresh-token flows in staging, then update production and roll API instances. Revoke the old secret after production verification and any provider-supported overlap period. If existing refresh tokens stop working, mark the connection invalid and require reconnection.

## Incident response

Revoke the exposed credential, rotate it, revoke affected session families, inspect LLM execution and provider audit logs, and document the affected workspaces, users and time window.
