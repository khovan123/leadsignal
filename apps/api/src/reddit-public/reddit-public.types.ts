export interface RedditPublicSource {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  subreddit: string | null;
  searchQuery: string | null;
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
}

export interface RedditPublicCollectionResult {
  workspaces: number;
  sources: number;
  posts: number;
  failures: Array<{ sourceId: string; message: string }>;
}
