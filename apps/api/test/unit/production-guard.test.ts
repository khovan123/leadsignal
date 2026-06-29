import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicProductionRoute } from '../../src/production/production.guard';

test('allows only the intended unauthenticated extension handshake routes', () => {
  assert.equal(isPublicProductionRoute('POST', '/api/auth/extension/pair'), true);
  assert.equal(isPublicProductionRoute('POST', '/api/auth/extension/challenge'), true);
  assert.equal(isPublicProductionRoute('POST', '/api/auth/extension/verify'), true);
  assert.equal(isPublicProductionRoute('POST', '/api/auth/extension/exchange'), true);
  assert.equal(isPublicProductionRoute('POST', '/api/extension/ingest'), true);
  assert.equal(isPublicProductionRoute('POST', '/api/extension/source-settings'), true);
});

test('does not make future extension endpoints public by prefix', () => {
  assert.equal(isPublicProductionRoute('GET', '/api/auth/extension/devices'), false);
  assert.equal(isPublicProductionRoute('POST', '/api/auth/extension/revoke-all'), false);
  assert.equal(isPublicProductionRoute('GET', '/api/extension/ingest'), false);
  assert.equal(isPublicProductionRoute('GET', '/api/extension/source-settings'), false);
});

test('ignores query strings while matching public routes', () => {
  assert.equal(
    isPublicProductionRoute('POST', '/api/auth/extension/challenge?debug=false'),
    true,
  );
});
