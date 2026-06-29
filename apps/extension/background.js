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
chrome.action.onClicked.addListener(async () => {
  await chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
  await chrome.action.setBadgeText({ text: '…' });
  try {
    const result = await captureCurrentPage();
    await chrome.action.setBadgeText({ text: String(result.collected) });
  } catch {
    await chrome.action.setBadgeBackgroundColor({ color: '#b91c1c' });
    await chrome.action.setBadgeText({ text: '!' });
  }
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case 'AUTH_PING': return getState();
    case 'PAIR_DEVICE': return pairDevice(message.payload || {});
    case 'AUTHENTICATE': return authenticateDevice();
    case 'GET_STATE': return { ok: true, state: (await getState()).state, config: await lsGetConfig() };
    case 'SAVE_CONFIG': return { ok: true, config: await lsSaveConfig(message.payload || {}) };
    case 'CAPTURE_CURRENT_PAGE': return captureCurrentPage();
    default: return { ok: false, error: 'Unsupported extension message' };
  }
}

async function getState() {
  const stored = await chrome.storage.local.get([LS_KEYS.deviceId, LS_KEYS.workspaceId, LS_KEYS.publicKey]);
  return { ok: true, state: { installed: true, paired: Boolean(stored[LS_KEYS.deviceId]), deviceId: stored[LS_KEYS.deviceId], workspaceId: stored[LS_KEYS.workspaceId], hasKey: Boolean(stored[LS_KEYS.publicKey]), version: chrome.runtime.getManifest().version } };
}

async function pairDevice(payload) {
  const pairingCode = String(payload.pairingCode || '').trim();
  if (!pairingCode) throw new Error('Pairing code is required');
  const { publicKeyJwk } = await lsEnsureKeyPair();
  const config = await lsGetConfig();
  const result = await lsApiFetch(config, '/auth/extension/pair', {
    method: 'POST',
    body: JSON.stringify({ pairingCode, publicKeyJwk, deviceLabel: String(payload.deviceLabel || 'LeadSignal Extension').slice(0, 120), displayName: payload.displayName ? String(payload.displayName).slice(0, 100) : undefined }),
  });
  await chrome.storage.local.set({ [LS_KEYS.deviceId]: result.deviceId, [LS_KEYS.workspaceId]: result.workspaceId });
  return { ok: true, deviceId: result.deviceId, workspaceId: result.workspaceId };
}

async function authenticateDevice() {
  const stored = await chrome.storage.local.get(LS_KEYS.deviceId);
  const deviceId = stored[LS_KEYS.deviceId];
  if (!deviceId) throw new Error('Extension has not been paired');
  const config = await lsGetConfig();
  const challenge = await lsApiFetch(config, '/auth/extension/challenge', { method: 'POST', body: JSON.stringify({ deviceId }) });
  const proof = await lsSignText(challenge.message);
  const verified = await lsApiFetch(config, '/auth/extension/verify', { method: 'POST', body: JSON.stringify({ deviceId, challengeId: challenge.challengeId, nonce: challenge.nonce, proof }) });
  return { ok: true, ticket: verified.ticket };
}

async function captureCurrentPage() {
  const stored = await chrome.storage.local.get(LS_KEYS.deviceId);
  const deviceId = stored[LS_KEYS.deviceId];
  if (!deviceId) throw new Error('Pair the extension before capturing posts');
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !isRedditUrl(tab.url)) throw new Error('Open Reddit in the active tab');
  const config = await lsGetConfig();
  const context = detectSourceContext(tab.url);
  const resolved = await readSourceSettings(deviceId, config, context);
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'LEADSIGNAL_CAPTURE_PAGE',
    settings: resolved.source,
    sourceId: resolved.sourceId,
  });
  if (!response?.ok || !response.batch?.posts?.length) throw new Error(response?.error || 'No rendered Reddit posts were found');
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const proof = await lsSignText(`LeadSignal extension ingestion v1\n${timestamp}\n${nonce}\n${lsStableStringify(response.batch)}`);
  const result = await lsApiFetch(config, '/extension/ingest', { method: 'POST', body: JSON.stringify({ deviceId, timestamp, nonce, proof, batch: response.batch }) });
  return { ok: true, collected: response.batch.posts.length, result };
}

async function readSourceSettings(deviceId, config, context) {
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const message = `LeadSignal extension source config v1\n${timestamp}\n${nonce}\n${lsStableStringify(context)}`;
  const proof = await lsSignText(message);
  return lsApiFetch(config, '/extension/source-settings', {
    method: 'POST',
    body: JSON.stringify({ deviceId, timestamp, nonce, proof, context }),
  });
}

function detectSourceContext(value) {
  const url = new URL(value);
  const path = url.pathname;
  if (/^\/r\/popular(?:\/|$)/i.test(path)) return { type: 'POPULAR', url: url.href };
  if (/^\/news(?:\/|$)/i.test(path)) return { type: 'NEWS', url: url.href };
  if (/^\/(?:best|posts)(?:\/|$)/i.test(path)) return { type: 'BEST', url: url.href };
  if (/^\/search(?:\/|$)/i.test(path)) return { type: 'SEARCH', searchQuery: url.searchParams.get('q') || undefined, url: url.href };
  const subreddit = path.match(/^\/r\/([^/]+)/i)?.[1];
  if (subreddit) return { type: 'SUBREDDIT', subreddit, url: url.href };
  if (path === '/' || /^\/(?:home)?$/i.test(path)) return { type: 'FOLLOWING', url: url.href };
  return { type: 'CUSTOM_URL', url: url.href };
}

function isRedditUrl(value) {
  if (!value) return false;
  try { const url = new URL(value); return url.hostname === 'reddit.com' || url.hostname.endsWith('.reddit.com'); }
  catch { return false; }
}
