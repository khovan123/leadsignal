ALTER TABLE "RedditSource"
  ADD COLUMN "ownerUserId" UUID;

UPDATE "RedditSource" source
SET "ownerUserId" = (
  SELECT wm."userId"
  FROM "WorkspaceMember" wm
  WHERE wm."workspaceId" = source."workspaceId"
  ORDER BY
    CASE wm.role
      WHEN 'OWNER' THEN 0
      WHEN 'ADMIN' THEN 1
      WHEN 'MEMBER' THEN 2
      ELSE 3
    END,
    wm."createdAt" ASC
  LIMIT 1
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RedditSource"
    WHERE "ownerUserId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot assign Reddit sources without a workspace member';
  END IF;
END $$;

ALTER TABLE "RedditSource"
  ALTER COLUMN "ownerUserId" SET NOT NULL;

ALTER TABLE "RedditSource"
  ADD CONSTRAINT "RedditSource_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RedditSource_workspaceId_ownerUserId_createdAt_idx"
  ON "RedditSource"("workspaceId", "ownerUserId", "createdAt");
