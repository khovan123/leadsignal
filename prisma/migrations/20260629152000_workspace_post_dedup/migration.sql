-- Keep one discovery row per workspace/post.
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

CREATE UNIQUE INDEX "PostDiscovery_workspaceId_postId_key"
  ON "PostDiscovery"("workspaceId", "postId");

CREATE UNIQUE INDEX "PostDiscovery_workspaceId_postId_sourceId_key"
  ON "PostDiscovery"("workspaceId", "postId", "sourceId");

-- Existing application upserts target the old source-scoped key. Normalize the
-- incoming source to the canonical workspace discovery before conflict handling.
CREATE OR REPLACE FUNCTION "normalizePostDiscoverySource"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_source UUID;
BEGIN
  SELECT "sourceId"
  INTO canonical_source
  FROM "PostDiscovery"
  WHERE "workspaceId" = NEW."workspaceId"
    AND "postId" = NEW."postId"
  LIMIT 1;

  IF canonical_source IS NOT NULL THEN
    NEW."sourceId" := canonical_source;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PostDiscovery_normalize_source" ON "PostDiscovery";
CREATE TRIGGER "PostDiscovery_normalize_source"
BEFORE INSERT ON "PostDiscovery"
FOR EACH ROW
EXECUTE FUNCTION "normalizePostDiscoverySource"();

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
