CREATE TABLE "RedditSourceConfig" (
  "sourceId" UUID NOT NULL,
  "sort" TEXT NOT NULL DEFAULT 'NEW',
  "timeRange" TEXT NOT NULL DEFAULT 'ALL',
  "targetPostCount" INTEGER NOT NULL DEFAULT 50,
  "maxScrolls" INTEGER NOT NULL DEFAULT 20,
  "maxStallRounds" INTEGER NOT NULL DEFAULT 4,
  "includePromoted" BOOLEAN NOT NULL DEFAULT false,
  "includePinned" BOOLEAN NOT NULL DEFAULT false,
  "includeNsfw" BOOLEAN NOT NULL DEFAULT false,
  "detailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "commentsTopN" INTEGER NOT NULL DEFAULT 0,
  "collectionMode" TEXT NOT NULL DEFAULT 'PUBLIC',
  "lastRunAt" TIMESTAMP(3),
  "lastStatus" TEXT NOT NULL DEFAULT 'IDLE',
  "lastCollected" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedditSourceConfig_pkey" PRIMARY KEY ("sourceId"),
  CONSTRAINT "RedditSourceConfig_targetPostCount_check" CHECK ("targetPostCount" BETWEEN 1 AND 2000),
  CONSTRAINT "RedditSourceConfig_maxScrolls_check" CHECK ("maxScrolls" BETWEEN 1 AND 100),
  CONSTRAINT "RedditSourceConfig_maxStallRounds_check" CHECK ("maxStallRounds" BETWEEN 1 AND 12),
  CONSTRAINT "RedditSourceConfig_commentsTopN_check" CHECK ("commentsTopN" BETWEEN 0 AND 50)
);

ALTER TABLE "RedditSourceConfig"
  ADD CONSTRAINT "RedditSourceConfig_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "RedditSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RedditSourceConfig_collectionMode_lastStatus_idx"
  ON "RedditSourceConfig"("collectionMode", "lastStatus");

INSERT INTO "RedditSourceConfig" ("sourceId")
SELECT id FROM "RedditSource"
ON CONFLICT ("sourceId") DO NOTHING;
