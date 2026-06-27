import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRateLimitPolicy } from '../../src/production/rate-limit.policy';

test('health checks are not rate limited', () => {
  assert.equal(resolveRateLimitPolicy('GET', '/api/health'), null);
});

test('authentication endpoints use stricter policies', () => {
  assert.deepEqual(resolveRateLimitPolicy('POST', '/api/auth/login'), {
    id: 'auth-login',
    limit: 10,
    windowSeconds: 900,
  });
  assert.deepEqual(resolveRateLimitPolicy('POST', '/api/auth/register'), {
    id: 'auth-register',
    limit: 5,
    windowSeconds: 3600,
  });
  assert.deepEqual(resolveRateLimitPolicy('POST', '/api/auth/refresh'), {
    id: 'auth-refresh',
    limit: 30,
    windowSeconds: 60,
  });
});

test('OAuth and invitations receive dedicated limits', () => {
  assert.equal(
    resolveRateLimitPolicy(
      'GET',
      '/api/connections/github/authorize?workspaceId=test',
    )?.id,
    'oauth-authorize',
  );
  assert.equal(
    resolveRateLimitPolicy(
      'POST',
      '/api/workspaces/00000000-0000-4000-8000-000000000001/invitations',
    )?.id,
    'workspace-invite',
  );
});

test('regular API requests use the default policy', () => {
  assert.deepEqual(
    resolveRateLimitPolicy('GET', '/api/workspaces/test/leads'),
    { id: 'api-default', limit: 300, windowSeconds: 60 },
  );
});
