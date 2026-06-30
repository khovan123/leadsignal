const LS_DEFAULT_CONFIG = {
  apiBase: "http://localhost:4000/api",
  appOrigin: "http://localhost:3001",
};

async function lsGetConfig() {
  const stored = await chrome.storage.local.get(LS_KEYS.config);
  return { ...LS_DEFAULT_CONFIG, ...(stored[LS_KEYS.config] || {}) };
}

function lsNormalizeConfig(payload) {
  return {
    apiBase: lsNormalizeUrl(payload.apiBase || LS_DEFAULT_CONFIG.apiBase, true),
    appOrigin: lsNormalizeUrl(
      payload.appOrigin || LS_DEFAULT_CONFIG.appOrigin,
      false,
    ),
  };
}

async function lsSaveConfig(payload) {
  const config = lsNormalizeConfig(payload);
  await chrome.storage.local.set({ [LS_KEYS.config]: config });
  await lsRegisterAppOrigin(config.appOrigin);
  return config;
}

async function lsRequestHostPermissions(config) {
  const origins = [
    ...new Set(
      [
        lsOptionalOriginPattern(config.apiBase),
        lsOptionalOriginPattern(config.appOrigin),
      ].filter(Boolean),
    ),
  ];

  if (origins.length === 0) return true;
  const accepted = await chrome.permissions.request({ origins });
  if (!accepted) {
    throw new Error(
      "Host permission is required for the LeadSignal API and app.",
    );
  }
  return true;
}

async function lsApiFetch(config, path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${config.apiBase}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const message =
        data?.message || data?.error || data || `HTTP ${response.status}`;
      throw new Error(
        typeof message === "string" ? message : JSON.stringify(message),
      );
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("LeadSignal API timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function lsRegisterAppOrigin(value) {
  if (!value) return;
  const url = new URL(value);
  if (lsIsLocalHost(url.hostname)) return;
  const pattern = lsOriginPattern(value);
  await chrome.scripting
    .unregisterContentScripts({ ids: ["leadsignal-app"] })
    .catch(() => undefined);
  await chrome.scripting.registerContentScripts([
    {
      id: "leadsignal-app",
      matches: [pattern],
      js: ["content-leadsignal.js"],
      runAt: "document_start",
      persistAcrossSessions: true,
    },
  ]);
}

function lsOptionalOriginPattern(value) {
  const url = new URL(String(value));
  if (lsIsLocalHost(url.hostname)) return null;
  return lsOriginPattern(value);
}

function lsOriginPattern(value) {
  const url = new URL(String(value));
  return `${url.protocol}//${url.hostname}/*`;
}

function lsIsLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function lsNormalizeUrl(value, keepPath) {
  const url = new URL(String(value));
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only HTTP(S) URLs are supported");
  url.hash = "";
  url.search = "";
  if (!keepPath) url.pathname = "";
  return url.href.replace(/\/$/, "");
}
