import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import {
  ingestionSigningMessage,
  loginSigningMessage,
} from '../src/extension-auth/extension-crypto';
import { PrismaService } from '../src/database/prisma.service';

process.env.EXTENSION_BOOTSTRAP_CODE = 'extension-e2e-bootstrap';
process.env.JWT_ACCESS_SECRET ??=
  'e2e-access-secret-value-longer-than-thirty-two-characters';
process.env.CREDENTIAL_ENCRYPTION_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let app: NestFastifyApplication;
let prisma: PrismaService;
let baseUrl: string;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return { response, body };
}

before(async () => {
  app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve test server address');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  prisma = app.get(PrismaService);
  await prisma.extensionReplayNonce.deleteMany();
  await prisma.extensionLoginTicket.deleteMany();
  await prisma.extensionAuthChallenge.deleteMany();
  await prisma.extensionDevice.deleteMany();
});

after(async () => {
  await app.close();
});

test('extension device authenticates, exchanges one-time ticket and ingests once', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const publicKeyJwk = publicKey.export({ format: 'jwk' });

  const paired = await request('/auth/extension/pair', {
    method: 'POST',
    body: JSON.stringify({
      pairingCode: process.env.EXTENSION_BOOTSTRAP_CODE,
      publicKeyJwk,
      displayName: 'Extension E2E Owner',
      deviceLabel: 'E2E Browser',
    }),
  });
  assert.equal(paired.response.status, 201);
  assert.ok(paired.body.deviceId);
  assert.ok(paired.body.workspaceId);

  const challenge = await request('/auth/extension/challenge', {
    method: 'POST',
    body: JSON.stringify({ deviceId: paired.body.deviceId }),
  });
  assert.equal(challenge.response.status, 201);
  const loginMessage = loginSigningMessage(
    challenge.body.challengeId,
    challenge.body.nonce,
  );
  assert.equal(challenge.body.message, loginMessage);
  const loginProof = sign('sha256', Buffer.from(loginMessage), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');

  const verified = await request('/auth/extension/verify', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: paired.body.deviceId,
      challengeId: challenge.body.challengeId,
      nonce: challenge.body.nonce,
      proof: loginProof,
    }),
  });
  assert.equal(verified.response.status, 201);
  assert.ok(verified.body.ticket);

  const exchanged = await request('/auth/extension/exchange', {
    method: 'POST',
    body: JSON.stringify({ ticket: verified.body.ticket }),
  });
  assert.equal(exchanged.response.status, 201);
  assert.ok(exchanged.body.accessToken);
  assert.ok(exchanged.body.refreshToken);
  assert.equal(exchanged.body.user.workspaceId, paired.body.workspaceId);

  const ticketReplay = await request('/auth/extension/exchange', {
    method: 'POST',
    body: JSON.stringify({ ticket: verified.body.ticket }),
  });
  assert.equal(ticketReplay.response.status, 401);

  const suffix = Date.now().toString(36);
  const batch = {
    source: {
      type: 'SUBREDDIT',
      name: 'r/SaaS extension E2E',
      subreddit: 'SaaS',
      url: 'https://www.reddit.com/r/SaaS/new/',
    },
    posts: [
      {
        externalPostId: `t3_ext${suffix}`,
        title: 'Looking for an E2E sales automation tool',
        body: 'We need a solution this week.',
        authorUsername: 'extension-e2e',
        subreddit: 'SaaS',
        permalink: `https://www.reddit.com/r/SaaS/comments/ext${suffix}/test/`,
        score: 12,
        commentCount: 3,
        postedAt: new Date().toISOString(),
      },
    ],
    capturedAt: new Date().toISOString(),
  };
  const timestamp = new Date().toISOString();
  const nonce = `nonce-${suffix}-1234567890`;
  const ingestionMessage = ingestionSigningMessage(timestamp, nonce, batch);
  const ingestionProof = sign('sha256', Buffer.from(ingestionMessage), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  const ingestionPayload = {
    deviceId: paired.body.deviceId,
    timestamp,
    nonce,
    proof: ingestionProof,
    batch,
  };

  const ingested = await request('/extension/ingest', {
    method: 'POST',
    body: JSON.stringify(ingestionPayload),
  });
  assert.equal(ingested.response.status, 201);
  assert.equal(ingested.body.accepted, 1);
  assert.equal(ingested.body.discovered, 1);

  const replay = await request('/extension/ingest', {
    method: 'POST',
    body: JSON.stringify(ingestionPayload),
  });
  assert.equal(replay.response.status, 409);
});
