import assert from 'node:assert/strict';
import test from 'node:test';
import { emailRetryDelaySeconds } from '../../src/production/email-outbox.service';

test('email retry backoff grows exponentially', () => {
  assert.equal(emailRetryDelaySeconds(1), 15);
  assert.equal(emailRetryDelaySeconds(2), 30);
  assert.equal(emailRetryDelaySeconds(3), 60);
  assert.equal(emailRetryDelaySeconds(4), 120);
});

test('email retry backoff is capped at one hour', () => {
  assert.equal(emailRetryDelaySeconds(20), 3600);
});
