export interface RateLimitPolicy {
  id: string;
  limit: number;
  windowSeconds: number;
}

const DEFAULT_POLICY: RateLimitPolicy = {
  id: 'api-default',
  limit: 300,
  windowSeconds: 60,
};

export function resolveRateLimitPolicy(
  method: string,
  rawPath: string,
): RateLimitPolicy | null {
  const path = rawPath.split('?')[0];
  const verb = method.toUpperCase();

  if (path.endsWith('/health')) return null;

  if (verb === 'POST' && path.endsWith('/auth/login')) {
    return { id: 'auth-login', limit: 10, windowSeconds: 15 * 60 };
  }
  if (verb === 'POST' && path.endsWith('/auth/register')) {
    return { id: 'auth-register', limit: 5, windowSeconds: 60 * 60 };
  }
  if (verb === 'POST' && path.endsWith('/auth/refresh')) {
    return { id: 'auth-refresh', limit: 30, windowSeconds: 60 };
  }
  if (
    verb === 'GET' &&
    /\/connections\/[^/]+\/authorize$/.test(path)
  ) {
    return { id: 'oauth-authorize', limit: 20, windowSeconds: 10 * 60 };
  }
  if (
    verb === 'POST' &&
    /\/workspaces\/[^/]+\/invitations$/.test(path)
  ) {
    return { id: 'workspace-invite', limit: 30, windowSeconds: 60 * 60 };
  }

  return DEFAULT_POLICY;
}
