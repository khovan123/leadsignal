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
    ...overrides,
  };
}

test('resolves subreddit sources to the new listing', () => {
  assert.equal(
    resolvePublicRedditSourceUrl(source({ subreddit: 'r/SaaS' })),
    'https://www.reddit.com/r/SaaS/new/',
  );
});

test('supports old Reddit fallback for subreddit sources', () => {
  assert.equal(
    resolvePublicRedditSourceUrl(source({ subreddit: 'startups' }), true),
    'https://old.reddit.com/r/startups/new/',
  );
});

test('resolves plain queries through Reddit public search', () => {
  const url = new URL(
    resolvePublicRedditSourceUrl(
      source({ type: 'SEARCH', searchQuery: 'looking for CRM' }),
    ),
  );
  assert.equal(url.pathname, '/search/');
  assert.equal(url.searchParams.get('q'), 'looking for CRM');
  assert.equal(url.searchParams.get('sort'), 'new');
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
