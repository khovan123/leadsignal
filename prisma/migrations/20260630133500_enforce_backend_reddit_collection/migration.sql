UPDATE "RedditSourceConfig"
SET
  "collectionMode" = 'PUBLIC',
  "lastStatus" = CASE
    WHEN "lastStatus" = 'EXTENSION_REQUIRED' THEN 'IDLE'
    ELSE "lastStatus"
  END,
  "lastError" = CASE
    WHEN "lastStatus" = 'EXTENSION_REQUIRED' THEN NULL
    ELSE "lastError"
  END,
  "updatedAt" = NOW()
WHERE "collectionMode" <> 'PUBLIC'
   OR "lastStatus" = 'EXTENSION_REQUIRED';

ALTER TABLE "RedditSourceConfig"
ALTER COLUMN "collectionMode" SET DEFAULT 'PUBLIC';

CREATE OR REPLACE FUNCTION "forceBackendRedditCollectionMode"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."collectionMode" := 'PUBLIC';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "RedditSourceConfig_force_backend_mode"
ON "RedditSourceConfig";

CREATE TRIGGER "RedditSourceConfig_force_backend_mode"
BEFORE INSERT OR UPDATE OF "collectionMode"
ON "RedditSourceConfig"
FOR EACH ROW
EXECUTE FUNCTION "forceBackendRedditCollectionMode"();
