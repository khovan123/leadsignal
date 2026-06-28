const LS_DEFAULT_CONFIG = {
  apiBase: 'http://localhost:4000/api',
  appOrigin: 'http://localhost:3000',
};

async function lsGetConfig() {
  const stored = await chrome.storage.local.get(LS_KEYS.config);
  return { ...LS_DEFAULT_CONFIG, ...(stored[LS_KEYS.config] || {}) };
}

async function lsSaveConfig(payload) {
  const config = {
    apiBase: lsNormalizeUrl(payload.apiBase || LS_DEFAULT_CONFIG.apiBase, true),
    appOrigin: lsNormalizeUrl(payload.appOrigin || LS_DEFAULT_CONFIG.appOrigin, false),
  };
  await lsEnsureHostPermissions(config);
  await chrome.storage.local.set({ [LS_KEYS.config]: config });
  await lsRegisterAppOrigin(config.appOrigin);
  return config;
}

async function lsApiFetch(config, path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${config.apiBase}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = text; }
    }
    if (!response.ok) {
      const message = data?.message || data?.error || data || `HTTP ${response.status}`;
      throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('LeadSignal API timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function lsEnsureHostPermissions(config) {
  const origins = [...new Set([
    lsOriginPattern(config.apiBase),
    lsOriginPattern(config.appOrigin),
  ])];
  const granted = await chrome.permissions.contains({ origins });
  if (granted) return;
  const accepted = await chrome.permissions.request({ origins });
  if (!accepted) throw new Error('Host permission is required for the LeadSignal API and app.');
}

async function lsRegisterAppOrigin(value) {
  if (!value) return;
  const url = new URL(value);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;
  const pattern = lsOriginPattern(value);
  await chrome.scripting.unregisterContentScripts({ ids: ['leadsignal-app'] }).catch(() => undefined);
  await chrome.scripting.registerContentScripts([
    {
      id: 'leadsignal-app',
      matches: [pattern],
      js: ['content-leadsignal.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    },
  ]);
}

function lsOriginPattern(value) {
  const url = new URL(String(value));
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/*`;
}

function lsNormalizeUrl(value, keepPath) {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are supported');
  url.hash = '';
  url.search = '';
  if (!keepPath) url.pathname = '';
  return url.href.replace(/\/$/, '');
}
