import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

process.env.PASSWORD_AUTH_ENABLED = 'true';
process.env.JWT_ACCESS_SECRET ??=
  'source-e2e-access-secret-value-longer-than-thirty-two-characters';
process.env.CREDENTIAL_ENCRYPTION_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.REDDIT_CRAWLER_ENABLED = 'false';

let app: NestFastifyApplication;
let baseUrl: string;
let accessToken: string;
let workspaceId: string;
let sourceId: string;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
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

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registered = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `sources-${suffix}@example.com`,
      displayName: 'Source Admin E2E',
      password: 'correct horse battery staple',
    }),
  });
  assert.equal(registered.response.status, 201);
  accessToken = registered.body.accessToken;
  workspaceId = registered.body.user.workspaceId;
});

after(async () => {
  await app.close();
});

test('creates and lists a configured subreddit source', async () => {
  const created = await request(`/workspaces/${workspaceId}/reddit-sources`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'SUBREDDIT',
      subreddit: 'smallbusiness',
      sort: 'TOP',
      timeRange: 'WEEK',
      targetPostCount: 125,
      maxScrolls: 30,
      maxStallRounds: 5,
      includePinned: true,
      detailEnabled: true,
      commentsTopN: 10,
      collectionMode: 'PUBLIC',
      enabled: true,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.subreddit, 'smallbusiness');
  assert.equal(created.body.targetPostCount, 125);
  assert.equal(created.body.sort, 'TOP');
  sourceId = created.body.id;

  const listed = await request(`/workspaces/${workspaceId}/reddit-sources`);
  assert.equal(listed.response.status, 200);
  assert.ok(listed.body.some((source: any) => source.id === sourceId));
});

test('updates per-source collection settings', async () => {
  const updated = await request(
    `/workspaces/${workspaceId}/reddit-sources/${sourceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        targetPostCount: 200,
        maxScrolls: 40,
        includeNsfw: true,
        enabled: false,
      }),
    },
  );
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.targetPostCount, 200);
  assert.equal(updated.body.maxScrolls, 40);
  assert.equal(updated.body.includeNsfw, true);
  assert.equal(updated.body.enabled, false);
});

test('forces following sources to extension mode', async () => {
  const created = await request(`/workspaces/${workspaceId}/reddit-sources`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'FOLLOWING',
      name: 'My following feed',
      collectionMode: 'PUBLIC',
      enabled: true,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.collectionMode, 'EXTENSION');
});

test('queues a manual collection run', async () => {
  const queued = await request(
    `/workspaces/${workspaceId}/reddit-sources/run`,
    {
      method: 'POST',
      body: JSON.stringify({ sourceIds: [sourceId] }),
    },
  );
  assert.equal(queued.response.status, 201);
  assert.ok(queued.body.jobId);
  assert.equal(queued.body.status, 'QUEUED');
});

test('deletes the configured source', async () => {
  const removed = await request(
    `/workspaces/${workspaceId}/reddit-sources/${sourceId}`,
    { method: 'DELETE' },
  );
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.success, true);
});
