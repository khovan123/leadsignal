if (typeof lsGetConfig === 'undefined' || typeof lsEnsureKeyPair === 'undefined') {
  importScripts('crypto.js', 'api.js');
}

chrome.runtime.onInstalled.addListener(() => {
  lsEnsureKeyPair().catch(() => undefined);
  lsGetConfig().then((config) => lsRegisterAppOrigin(config.appOrigin)).catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  lsGetConfig().then((config) => lsRegisterAppOrigin(config.appOrigin)).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case 'AUTH_PING':
      return getState();
    case 'PAIR_DEVICE':
      return pairDevice(message.payload || {});
    case 'AUTHENTICATE':
      return authenticateDevice();
    case 'GET_STATE':
      return { ok: true, state: (await getState()).state, config: await lsGetConfig() };
    case 'SAVE_CONFIG':
      return { ok: true, config: await lsSaveConfig(message.payload || {}) };
    default:
      return { ok: false, error: 'Unsupported extension message' };
  }
}

async function getState() {
  const stored = await chrome.storage.local.get([
    LS_KEYS.deviceId,
    LS_KEYS.workspaceId,
    LS_KEYS.publicKey,
  ]);
  return {
    ok: true,
    state: {
      installed: true,
      paired: Boolean(stored[LS_KEYS.deviceId]),
      deviceId: stored[LS_KEYS.deviceId],
      workspaceId: stored[LS_KEYS.workspaceId],
      hasKey: Boolean(stored[LS_KEYS.publicKey]),
      version: chrome.runtime.getManifest().version,
      executionMode: 'BACKEND_ONLY',
    },
  };
}

async function pairDevice(payload) {
  const pairingCode = String(payload.pairingCode || '').trim();
  if (!pairingCode) throw new Error('Pairing code is required');
  const { publicKeyJwk } = await lsEnsureKeyPair();
  const config = await lsGetConfig();
  const result = await lsApiFetch(config, '/auth/extension/pair', {
    method: 'POST',
    body: JSON.stringify({
      pairingCode,
      publicKeyJwk,
      deviceLabel: String(payload.deviceLabel || 'LeadSignal Extension').slice(0, 120),
      displayName: payload.displayName
        ? String(payload.displayName).slice(0, 100)
        : undefined,
    }),
  });
  await chrome.storage.local.set({
    [LS_KEYS.deviceId]: result.deviceId,
    [LS_KEYS.workspaceId]: result.workspaceId,
  });
  return { ok: true, deviceId: result.deviceId, workspaceId: result.workspaceId };
}

async function authenticateDevice() {
  const stored = await chrome.storage.local.get(LS_KEYS.deviceId);
  const deviceId = stored[LS_KEYS.deviceId];
  if (!deviceId) throw new Error('Extension has not been paired');
  const config = await lsGetConfig();
  const challenge = await lsApiFetch(config, '/auth/extension/challenge', {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
  const proof = await lsSignText(challenge.message);
  const verified = await lsApiFetch(config, '/auth/extension/verify', {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      proof,
    }),
  });
  return { ok: true, ticket: verified.ticket };
}
