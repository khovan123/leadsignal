import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createPkce,
  hashPassword,
  signAccessToken,
  tokenHash,
  verifyAccessToken,
  verifyPassword,
} from '../../src/production/security';

process.env.JWT_ACCESS_SECRET =
  'unit-test-access-secret-value-longer-than-thirty-two-characters';
process.env.JWT_ACCESS_TTL_SECONDS = '900';

test('password hashes verify only the original password', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$/);
  assert.equal(
    await verifyPassword('correct horse battery staple', hash),
    true,
  );
  assert.equal(await verifyPassword('incorrect password', hash), false);
});

test('access tokens round-trip and reject signature tampering', () => {
  const token = signAccessToken({
    userId: 'user-1',
    email: 'member@example.com',
    sessionId: 'session-1',
  });
  const claims = verifyAccessToken(token);
  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.sid, 'session-1');
  assert.throws(() => verifyAccessToken(`${token.slice(0, -1)}x`));
});

test('PKCE challenge is the SHA-256 digest of the verifier', () => {
  const { verifier, challenge } = createPkce();
  assert.equal(
    challenge,
    createHash('sha256').update(verifier).digest('base64url'),
  );
});

test('token hashes are deterministic and do not expose the token', () => {
  const token = 'refresh-token-value';
  assert.equal(tokenHash(token), tokenHash(token));
  assert.notEqual(tokenHash(token), token);
});
