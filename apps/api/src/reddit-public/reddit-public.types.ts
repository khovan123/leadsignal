export interface RedditPublicSource {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  subreddit: string | null;
  searchQuery: string | null;
  enabled: boolean;
  sort: string;
  timeRange: string;
  targetPostCount: number;
  maxScrolls: number;
  maxStallRounds: number;
  includePromoted: boolean;
  includePinned: boolean;
  includeNsfw: boolean;
  detailEnabled: boolean;
  commentsTopN: number;
  collectionMode: string;
}

export interface RedditPublicPost {
  externalPostId: string;
  canonicalUrl: string;
  subreddit: string;
  authorUsername: string | null;
  title: string;
  body: string;
  score: number;
  commentCount: number;
  postedAt: Date;
  mediaUrls: string[];
  topComments: string[];
  detailFetched: boolean;
}

export interface RedditPublicCollectionResult {
  workspaces: number;
  sources: number;
  posts: number;
  failures: Array<{ sourceId: string; message: string }>;
  sourceResults?: Array<{
    sourceId: string;
    status: string;
    collected: number;
    requested: number;
    message?: string;
  }>;
}
