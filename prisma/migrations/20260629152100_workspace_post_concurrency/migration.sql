-- Serialize concurrent inserts for the same workspace/post before the unique
-- constraints are evaluated. The transaction-scoped advisory lock is released
-- automatically on commit or rollback.
CREATE OR REPLACE FUNCTION "normalizePostDiscoverySource"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_source UUID;
  discovery_lock_key BIGINT;
BEGIN
  discovery_lock_key := hashtextextended(
    NEW."workspaceId"::text || ':' || NEW."postId"::text,
    0
  );

  PERFORM pg_advisory_xact_lock(discovery_lock_key);

  SELECT "sourceId"
  INTO canonical_source
  FROM "PostDiscovery"
  WHERE "workspaceId" = NEW."workspaceId"
    AND "postId" = NEW."postId"
  ORDER BY "discoveredAt" ASC, id ASC
  LIMIT 1;

  IF canonical_source IS NOT NULL THEN
    NEW."sourceId" := canonical_source;
  END IF;

  RETURN NEW;
END;
$$;
