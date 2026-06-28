const LS_KEYS = {
  config: 'leadsignalConfig',
  privateKey: 'leadsignalPrivateKeyJwk',
  publicKey: 'leadsignalPublicKeyJwk',
  deviceId: 'leadsignalDeviceId',
  workspaceId: 'leadsignalWorkspaceId',
};

async function lsEnsureKeyPair() {
  const stored = await chrome.storage.local.get([
    LS_KEYS.privateKey,
    LS_KEYS.publicKey,
  ]);
  if (stored[LS_KEYS.privateKey] && stored[LS_KEYS.publicKey]) {
    return {
      privateKeyJwk: stored[LS_KEYS.privateKey],
      publicKeyJwk: stored[LS_KEYS.publicKey],
    };
  }
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  await chrome.storage.local.set({
    [LS_KEYS.privateKey]: privateKeyJwk,
    [LS_KEYS.publicKey]: publicKeyJwk,
  });
  return { privateKeyJwk, publicKeyJwk };
}

async function lsSignText(message) {
  const { privateKeyJwk } = await lsEnsureKeyPair();
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(message),
  );
  return lsBase64Url(new Uint8Array(bytes));
}

function lsStableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => lsStableStringify(item)).join(',')}]`;
  }
  return `{${Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${lsStableStringify(child)}`)
    .join(',')}}`;
}

function lsBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
