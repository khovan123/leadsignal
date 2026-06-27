CREATE TABLE "EmailOutbox" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient" TEXT NOT NULL,
  "subjectLine" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EmailOutbox_pending_idx"
  ON "EmailOutbox" ("availableAt", "createdAt")
  WHERE "sentAt" IS NULL;
