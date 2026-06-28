export interface RateLimitPolicy { id: string; limit: number; windowSeconds: number; }
const DEFAULT_POLICY: RateLimitPolicy = { id: 'api-default', limit: 300, windowSeconds: 60 };

export function resolveRateLimitPolicy(method: string, rawPath: string): RateLimitPolicy | null {
  const path = rawPath.split('?')[0];
  const verb = method.toUpperCase();
  if (path.endsWith('/health')) return null;
  if (verb === 'POST' && path.endsWith('/auth/login')) return { id: 'auth-login', limit: 10, windowSeconds: 900 };
  if (verb === 'POST' && path.endsWith('/auth/register')) return { id: 'auth-register', limit: 5, windowSeconds: 3600 };
  if (verb === 'POST' && path.endsWith('/auth/refresh')) return { id: 'auth-refresh', limit: 30, windowSeconds: 60 };
  if (verb === 'POST' && path.endsWith('/auth/extension/pair')) return { id: 'device-pair', limit: 10, windowSeconds: 3600 };
  if (verb === 'POST' && path.endsWith('/auth/extension/challenge')) return { id: 'device-challenge', limit: 60, windowSeconds: 60 };
  if (verb === 'POST' && path.endsWith('/auth/extension/verify')) return { id: 'device-verify', limit: 30, windowSeconds: 60 };
  if (verb === 'POST' && path.endsWith('/auth/extension/exchange')) return { id: 'device-exchange', limit: 30, windowSeconds: 60 };
  if (verb === 'POST' && path.endsWith('/extension/ingest')) return { id: 'device-ingest', limit: 120, windowSeconds: 60 };
  if (verb === 'GET' && /\/connections\/[^/]+\/authorize$/.test(path)) return { id: 'oauth-authorize', limit: 20, windowSeconds: 600 };
  if (verb === 'POST' && /\/workspaces\/[^/]+\/invitations$/.test(path)) return { id: 'workspace-invite', limit: 30, windowSeconds: 3600 };
  if (verb === 'POST' && /\/workspaces\/[^/]+\/extension-devices\/pairing-codes$/.test(path)) return { id: 'device-code', limit: 20, windowSeconds: 3600 };
  if (verb === 'POST' && /\/workspaces\/[^/]+\/reddit-sources\/run$/.test(path)) return { id: 'reddit-source-run', limit: 10, windowSeconds: 600 };
  if (['POST', 'PATCH', 'DELETE'].includes(verb) && /\/workspaces\/[^/]+\/reddit-sources(?:\/[^/]+)?$/.test(path)) return { id: 'reddit-source-write', limit: 60, windowSeconds: 3600 };
  return DEFAULT_POLICY;
}
