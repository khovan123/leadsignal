import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CreateRedditSourceCommand,
  CreateRedditSourceHandler,
  ListRedditSourcesHandler,
  ListRedditSourcesQuery,
} from '../../src/reddit-sources/application/reddit-source.use-cases';
import type {
  IRedditSourceRepository,
  RedditSourceConfiguration,
} from '../../src/reddit-sources/domain/reddit-source.repository';

const source: RedditSourceConfiguration = {
  id: 'source-1',
  workspaceId: 'workspace-1',
  ownerUserId: 'member-1',
  name: 'r/startups',
  type: 'SUBREDDIT',
  subreddit: 'startups',
  searchQuery: null,
  enabled: true,
  sort: 'NEW',
  timeRange: 'ALL',
  targetPostCount: 50,
  maxScrolls: 20,
  maxStallRounds: 4,
  includePromoted: false,
  includePinned: false,
  includeNsfw: false,
  detailEnabled: true,
  commentsTopN: 0,
  collectionMode: 'PUBLIC',
  lastRunAt: null,
  lastStatus: 'IDLE',
  lastCollected: 0,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repository(
  overrides: Partial<IRedditSourceRepository> = {},
): IRedditSourceRepository {
  return {
    list: async () => [source],
    get: async () => source,
    create: async () => source,
    update: async () => source,
    remove: async () => undefined,
    assertWorkspaceMember: async () => undefined,
    ...overrides,
  };
}

test('members can create their own Reddit source configuration', async () => {
  const calls: unknown[] = [];
  const handler = new CreateRedditSourceHandler(
    repository({
      assertWorkspaceMember: async (workspaceId, userId) => {
        calls.push({ type: 'membership', workspaceId, userId });
      },
      create: async (workspaceId, userId, input) => {
        calls.push({ type: 'create', workspaceId, userId, input });
        return source;
      },
    }),
  );

  const result = await handler.execute(
    new CreateRedditSourceCommand('workspace-1', 'member-1', {
      type: 'SUBREDDIT',
      subreddit: 'startups',
    }),
  );

  assert.equal(result.ownerUserId, 'member-1');
  assert.deepEqual(calls, [
    {
      type: 'membership',
      workspaceId: 'workspace-1',
      userId: 'member-1',
    },
    {
      type: 'create',
      workspaceId: 'workspace-1',
      userId: 'member-1',
      input: { type: 'SUBREDDIT', subreddit: 'startups' },
    },
  ]);
});

test('source listing is scoped to the authenticated member', async () => {
  const calls: unknown[] = [];
  const handler = new ListRedditSourcesHandler(
    repository({
      assertWorkspaceMember: async (workspaceId, userId) => {
        calls.push({ type: 'membership', workspaceId, userId });
      },
      list: async (workspaceId, userId) => {
        calls.push({ type: 'list', workspaceId, userId });
        return [source];
      },
    }),
  );

  const result = await handler.execute(
    new ListRedditSourcesQuery('workspace-1', 'member-1'),
  );

  assert.equal(result.length, 1);
  assert.deepEqual(calls, [
    {
      type: 'membership',
      workspaceId: 'workspace-1',
      userId: 'member-1',
    },
    {
      type: 'list',
      workspaceId: 'workspace-1',
      userId: 'member-1',
    },
  ]);
});
