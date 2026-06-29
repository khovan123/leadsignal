import assert from 'node:assert/strict';
import test from 'node:test';
import { readSmtpConfiguration } from '../../src/production/email-outbox.service';

test('uses Google SMTP defaults and strips spaces from app passwords', () => {
  const config = readSmtpConfiguration({
    SMTP_USER: 'sender@gmail.com',
    SMTP_PASSWORD: 'abcd efgh ijkl mnop',
    INVITATION_FROM_EMAIL: 'LeadSignal <sender@gmail.com>',
  });

  assert.deepEqual(config, {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'sender@gmail.com',
    password: 'abcdefghijklmnop',
    from: 'LeadSignal <sender@gmail.com>',
  });
});

test('requires SMTP user and password together', () => {
  assert.throws(
    () => readSmtpConfiguration({ SMTP_USER: 'sender@gmail.com' }),
    /must be configured together/,
  );
});

test('supports STARTTLS SMTP configuration', () => {
  const config = readSmtpConfiguration({
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'sender@gmail.com',
    SMTP_PASSWORD: 'abcdefghijklmnop',
  });

  assert.equal(config?.port, 587);
  assert.equal(config?.secure, false);
});

test('returns undefined when SMTP is not configured', () => {
  assert.equal(readSmtpConfiguration({}), undefined);
});
