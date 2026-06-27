const baseUrl = required('STAGING_BASE_URL').replace(/\/$/, '');
const email = required('STAGING_SMOKE_EMAIL');
const password = required('STAGING_SMOKE_PASSWORD');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function json(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${String(text).slice(0, 300)}`);
  }
  return body;
}

console.log('1/5 API health');
const health = await json('/api/health');
if (health.status !== 'ok') throw new Error('Health response is not ok');

console.log('2/5 Web login page');
const loginPage = await fetch(`${baseUrl}/vi/login`, {
  redirect: 'follow',
  signal: AbortSignal.timeout(20_000),
});
if (!loginPage.ok) throw new Error(`Login page returned ${loginPage.status}`);

console.log('3/5 Login');
const session = await json('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
if (!session.accessToken || !session.refreshToken) {
  throw new Error('Login response is missing tokens');
}
const workspaceId =
  process.env.STAGING_WORKSPACE_ID || session.user?.workspaceId;
if (!workspaceId) throw new Error('Smoke account has no workspace');

console.log('4/5 Refresh rotation');
const rotated = await json('/api/auth/refresh', {
  method: 'POST',
  body: JSON.stringify({ refreshToken: session.refreshToken }),
});
if (!rotated.accessToken || rotated.refreshToken === session.refreshToken) {
  throw new Error('Refresh token did not rotate');
}

console.log('5/5 Authenticated workspace');
await json(`/api/workspaces/${workspaceId}`, {
  headers: { authorization: `Bearer ${rotated.accessToken}` },
});

const oauthProviders = (process.env.STAGING_SMOKE_OAUTH_PROVIDERS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
for (const provider of oauthProviders) {
  console.log(`OAuth start: ${provider}`);
  const result = await json(
    `/api/connections/${encodeURIComponent(provider)}/authorize?workspaceId=${encodeURIComponent(workspaceId)}`,
    { headers: { authorization: `Bearer ${rotated.accessToken}` } },
  );
  if (!result.authorizationUrl) {
    throw new Error(`${provider} did not return an authorization URL`);
  }
}

console.log('Staging smoke checks passed');
