-- Keep one discovery row per workspace/post. Source is optional provenance only.
WITH ranked_discoveries AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "workspaceId", "postId"
      ORDER BY "discoveredAt" ASC, id ASC
    ) AS position
  FROM "PostDiscovery"
)
DELETE FROM "PostDiscovery" target
USING ranked_discoveries ranked
WHERE target.id = ranked.id
  AND ranked.position > 1;

DROP INDEX IF EXISTS "PostDiscovery_workspaceId_postId_sourceId_key";

ALTER TABLE "PostDiscovery"
  DROP CONSTRAINT IF EXISTS "PostDiscovery_sourceId_fkey";

ALTER TABLE "PostDiscovery"
  ALTER COLUMN "sourceId" DROP NOT NULL;

ALTER TABLE "PostDiscovery"
  ADD CONSTRAINT "PostDiscovery_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "RedditSource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PostDiscovery_workspaceId_postId_key"
  ON "PostDiscovery"("workspaceId", "postId");

-- Keep the newest classification per workspace/post and preserve lead references.
WITH ranked_classifications AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY "workspaceId", "postId"
      ORDER BY "createdAt" DESC, id DESC
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY "workspaceId", "postId"
      ORDER BY "createdAt" DESC, id DESC
    ) AS position
  FROM "PostClassification"
)
UPDATE "Lead" lead
SET "classificationId" = ranked.keeper_id
FROM ranked_classifications ranked
WHERE lead."classificationId" = ranked.id
  AND ranked.position > 1;

WITH ranked_classifications AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "workspaceId", "postId"
      ORDER BY "createdAt" DESC, id DESC
    ) AS position
  FROM "PostClassification"
)
DELETE FROM "PostClassification" target
USING ranked_classifications ranked
WHERE target.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX "PostClassification_workspaceId_postId_key"
  ON "PostClassification"("workspaceId", "postId");
