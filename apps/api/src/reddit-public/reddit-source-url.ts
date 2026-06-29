import type { RedditPublicSource } from './reddit-public.types';

const REDDIT_HOSTS = new Set([
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
]);

const SORTS = new Set(['hot', 'new', 'top', 'rising']);
const SEARCH_SORTS = new Set(['relevance', 'hot', 'top', 'new', 'comments']);
const TIME_RANGES = new Set(['hour', 'day', 'week', 'month', 'year', 'all']);

export function resolvePublicRedditSourceUrl(
  source: RedditPublicSource,
  useOldReddit = false,
): string {
  const host = useOldReddit ? 'old.reddit.com' : 'www.reddit.com';
  const type = source.type.trim().toUpperCase();
  const subreddit = source.subreddit?.trim().replace(/^r\//i, '');
  const query = source.searchQuery?.trim();
  const sort = String(source.sort || 'NEW').toLowerCase();
  const timeRange = String(source.timeRange || 'ALL').toLowerCase();

  if (type === 'FOLLOWING' || type === 'HOME') {
    return `https://${host}/`;
  }

  if (subreddit || type === 'SUBREDDIT') {
    if (!subreddit) throw new Error(`Reddit source ${source.id} has no subreddit`);
    const selectedSort = SORTS.has(sort) ? sort : 'new';
    const url = new URL(
      `https://${host}/r/${encodeURIComponent(subreddit)}/${selectedSort}/`,
    );
    if (selectedSort === 'top' && TIME_RANGES.has(timeRange)) {
      url.searchParams.set('t', timeRange);
    }
    return url.href;
  }

  if (type === 'POPULAR') return `https://${host}/r/popular/`;
  if (type === 'NEWS') return `https://${host}/news/`;
  if (type === 'BEST') return `https://${host}/best/`;

  if (query?.startsWith('http://') || query?.startsWith('https://')) {
    const url = new URL(query);
    if (!REDDIT_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error('Custom Reddit source URL must use reddit.com');
    }
    url.protocol = 'https:';
    url.hostname = host;
    url.hash = '';
    return url.href;
  }

  if (query || type === 'SEARCH') {
    if (!query) throw new Error(`Reddit source ${source.id} has no search query`);
    const url = new URL(`https://${host}/search/`);
    url.searchParams.set('q', query);
    url.searchParams.set('sort', SEARCH_SORTS.has(sort) ? sort : 'new');
    if (TIME_RANGES.has(timeRange)) url.searchParams.set('t', timeRange);
    return url.href;
  }

  throw new Error(`Reddit source ${source.id} has no supported configuration`);
}
