import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import {
  assertNoCredentialFields,
  loginSigningMessage,
  stableStringify,
  verifyExtensionSignature,
} from '../../src/extension-auth/extension-crypto';

test('verifies an ECDSA P-256 extension proof', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const message = loginSigningMessage('challenge-id', 'nonce-value');
  const proof = sign('sha256', Buffer.from(message), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');

  assert.doesNotThrow(() =>
    verifyExtensionSignature(publicKey.export({ format: 'jwk' }), message, proof),
  );
});

test('stableStringify sorts object keys recursively', () => {
  assert.equal(
    stableStringify({ z: 1, a: { y: 2, b: 3 }, list: [{ d: 4, c: 5 }] }),
    '{"a":{"b":3,"y":2},"list":[{"c":5,"d":4}],"z":1}',
  );
});

test('rejects credential-shaped fields from ingestion payloads', () => {
  assert.throws(
    () => assertNoCredentialFields({ source: { cookies: ['not-accepted'] } }),
    /Credential field is not accepted/,
  );
});
