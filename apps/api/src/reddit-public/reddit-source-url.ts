import type { RedditPublicSource } from './reddit-public.types';

const REDDIT_HOSTS = new Set([
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
]);

export function resolvePublicRedditSourceUrl(
  source: RedditPublicSource,
  useOldReddit = false,
): string {
  const host = useOldReddit ? 'old.reddit.com' : 'www.reddit.com';
  const type = source.type.trim().toUpperCase();
  const subreddit = source.subreddit?.trim().replace(/^r\//i, '');
  const query = source.searchQuery?.trim();

  if (subreddit) {
    return `https://${host}/r/${encodeURIComponent(subreddit)}/new/`;
  }

  if (type.includes('POPULAR')) return `https://${host}/r/popular/`;
  if (type.includes('NEWS')) return `https://${host}/news/`;
  if (type.includes('BEST')) return `https://${host}/best/`;

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

  if (query) {
    const url = new URL(`https://${host}/search/`);
    url.searchParams.set('q', query);
    url.searchParams.set('sort', 'new');
    return url.href;
  }

  throw new Error(`Reddit source ${source.id} has no subreddit or search query`);
}
