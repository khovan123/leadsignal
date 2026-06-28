# Extension device authentication

LeadSignal private mode uses a browser extension instead of email/password registration.

1. The extension generates an ECDSA P-256 key pair and stores the private key inside extension storage.
2. A one-time pairing code binds the public key to a workspace member.
3. Login uses a short-lived challenge and a one-time exchange ticket.
4. Reddit posts captured from the active tab are sent as signed batches.
5. The API rejects credential-shaped fields and stores a nonce to prevent batch replay.

The first device can use `EXTENSION_BOOTSTRAP_CODE`. After that, an OWNER or ADMIN creates pairing codes through `POST /api/workspaces/:workspaceId/extension-devices/pairing-codes`.

The toolbar action captures only posts already rendered in the active Reddit tab. It does not transfer browser session material to the API.
