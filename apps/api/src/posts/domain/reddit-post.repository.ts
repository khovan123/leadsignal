export const REDDIT_POST_REPOSITORY = Symbol('REDDIT_POST_REPOSITORY');

export interface IngestRedditPostInput {
  externalPostId: string;
  title: string;
  body: string;
  subreddit: string;
  authorUsername: string | null;
  permalink: string;
  score: number;
  commentCount: number;
  postedAt: Date;
  sourceId: string;
}

export interface IngestedPost {
  postId: string;
}

export interface RedditPostRepository {
  ingest(
    workspaceId: string,
    userId: string,
    input: IngestRedditPostInput,
  ): Promise<IngestedPost>;
}
