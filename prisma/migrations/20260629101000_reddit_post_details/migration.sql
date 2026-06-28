ALTER TABLE "RedditPost"
  ADD COLUMN "mediaUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "topComments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "detailFetchedAt" TIMESTAMP(3);
