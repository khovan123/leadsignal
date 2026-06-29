import assert from 'node:assert/strict';
import test from 'node:test';
import type { RedditPublicSource } from '../../src/reddit-public/reddit-public.types';
import { resolvePublicRedditSourceUrl } from '../../src/reddit-public/reddit-source-url';

function source(overrides: Partial<RedditPublicSource>): RedditPublicSource {
  return {
    id: 'source-1',
    workspaceId: 'workspace-1',
    name: 'Test source',
    type: 'SUBREDDIT',
    subreddit: null,
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
    ...overrides,
  };
}

test('resolves subreddit sources with configured sort', () => {
  assert.equal(
    resolvePublicRedditSourceUrl(
      source({ subreddit: 'r/SaaS', sort: 'HOT' }),
    ),
    'https://www.reddit.com/r/SaaS/hot/',
  );
});

test('supports old Reddit fallback and top time ranges', () => {
  const url = new URL(
    resolvePublicRedditSourceUrl(
      source({ subreddit: 'startups', sort: 'TOP', timeRange: 'WEEK' }),
      true,
    ),
  );
  assert.equal(url.origin, 'https://old.reddit.com');
  assert.equal(url.pathname, '/r/startups/top/');
  assert.equal(url.searchParams.get('t'), 'week');
});

test('resolves built-in home feed', () => {
  assert.equal(
    resolvePublicRedditSourceUrl(source({ type: 'HOME' })),
    'https://www.reddit.com/',
  );
});

test('resolves plain queries with sort and time range', () => {
  const url = new URL(
    resolvePublicRedditSourceUrl(
      source({
        type: 'SEARCH',
        searchQuery: 'looking for CRM',
        sort: 'TOP',
        timeRange: 'MONTH',
      }),
    ),
  );
  assert.equal(url.pathname, '/search/');
  assert.equal(url.searchParams.get('q'), 'looking for CRM');
  assert.equal(url.searchParams.get('sort'), 'top');
  assert.equal(url.searchParams.get('t'), 'month');
});

test('marks following as extension-only', () => {
  assert.throws(
    () => resolvePublicRedditSourceUrl(source({ type: 'FOLLOWING' })),
    /require the browser extension/,
  );
});

test('rejects custom URLs outside Reddit', () => {
  assert.throws(
    () =>
      resolvePublicRedditSourceUrl(
        source({ type: 'CUSTOM_URL', searchQuery: 'https://example.com/feed' }),
      ),
    /must use reddit\.com/,
  );
});
