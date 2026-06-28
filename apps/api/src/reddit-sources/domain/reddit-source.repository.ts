export const REDDIT_SOURCE_REPOSITORY = Symbol('REDDIT_SOURCE_REPOSITORY');

export const REDDIT_SOURCE_TYPES = [
  'HOME',
  'POPULAR',
  'NEWS',
  'BEST',
  'FOLLOWING',
  'LATEST',
  'SUBREDDIT',
  'SEARCH',
  'CUSTOM_URL',
] as const;

export const REDDIT_SOURCE_SORTS = [
  'HOT',
  'NEW',
  'TOP',
  'RISING',
  'RELEVANCE',
  'COMMENTS',
] as const;

export const REDDIT_SOURCE_TIME_RANGES = [
  'HOUR',
  'DAY',
  'WEEK',
  'MONTH',
  'YEAR',
  'ALL',
] as const;

export type RedditSourceType = (typeof REDDIT_SOURCE_TYPES)[number];
export type RedditSourceSort = (typeof REDDIT_SOURCE_SORTS)[number];
export type RedditSourceTimeRange = (typeof REDDIT_SOURCE_TIME_RANGES)[number];
export type RedditCollectionMode = 'PUBLIC' | 'EXTENSION';

export interface RedditSourceConfiguration {
  id: string;
  workspaceId: string;
  name: string;
  type: RedditSourceType;
  subreddit: string | null;
  searchQuery: string | null;
  enabled: boolean;
  sort: RedditSourceSort;
  timeRange: RedditSourceTimeRange;
  targetPostCount: number;
  maxScrolls: number;
  maxStallRounds: number;
  includePromoted: boolean;
  includePinned: boolean;
  includeNsfw: boolean;
  detailEnabled: boolean;
  commentsTopN: number;
  collectionMode: RedditCollectionMode;
  lastRunAt: Date | null;
  lastStatus: string;
  lastCollected: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveRedditSourceInput {
  name?: string;
  type?: string;
  subreddit?: string | null;
  searchQuery?: string | null;
  enabled?: boolean;
  sort?: string;
  timeRange?: string;
  targetPostCount?: number;
  maxScrolls?: number;
  maxStallRounds?: number;
  includePromoted?: boolean;
  includePinned?: boolean;
  includeNsfw?: boolean;
  detailEnabled?: boolean;
  commentsTopN?: number;
  collectionMode?: string;
}

export interface IRedditSourceRepository {
  list(workspaceId: string): Promise<RedditSourceConfiguration[]>;
  get(workspaceId: string, sourceId: string): Promise<RedditSourceConfiguration | null>;
  create(workspaceId: string, input: SaveRedditSourceInput): Promise<RedditSourceConfiguration>;
  update(
    workspaceId: string,
    sourceId: string,
    input: SaveRedditSourceInput,
  ): Promise<RedditSourceConfiguration>;
  remove(workspaceId: string, sourceId: string): Promise<void>;
  assertCanManage(workspaceId: string, userId: string): Promise<void>;
}
