CREATE TABLE "ExtensionPairingCode" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "invitedByUserId" UUID,
  "tokenHash" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "displayName" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtensionPairingCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionDevice" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "publicKeyJwk" JSONB NOT NULL,
  "label" TEXT NOT NULL,
  "redditUsername" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ExtensionDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionAuthChallenge" (
  "id" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtensionAuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionLoginTicket" (
  "id" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtensionLoginTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionReplayNonce" (
  "id" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtensionReplayNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtensionPairingCode_tokenHash_key" ON "ExtensionPairingCode"("tokenHash");
CREATE INDEX "ExtensionPairingCode_workspaceId_expiresAt_idx" ON "ExtensionPairingCode"("workspaceId", "expiresAt");
CREATE INDEX "ExtensionDevice_workspaceId_status_idx" ON "ExtensionDevice"("workspaceId", "status");
CREATE INDEX "ExtensionDevice_userId_status_idx" ON "ExtensionDevice"("userId", "status");
CREATE UNIQUE INDEX "ExtensionAuthChallenge_nonceHash_key" ON "ExtensionAuthChallenge"("nonceHash");
CREATE INDEX "ExtensionAuthChallenge_deviceId_expiresAt_idx" ON "ExtensionAuthChallenge"("deviceId", "expiresAt");
CREATE UNIQUE INDEX "ExtensionLoginTicket_tokenHash_key" ON "ExtensionLoginTicket"("tokenHash");
CREATE INDEX "ExtensionLoginTicket_deviceId_expiresAt_idx" ON "ExtensionLoginTicket"("deviceId", "expiresAt");
CREATE UNIQUE INDEX "ExtensionReplayNonce_deviceId_nonceHash_key" ON "ExtensionReplayNonce"("deviceId", "nonceHash");
CREATE INDEX "ExtensionReplayNonce_expiresAt_idx" ON "ExtensionReplayNonce"("expiresAt");

ALTER TABLE "ExtensionPairingCode"
  ADD CONSTRAINT "ExtensionPairingCode_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionPairingCode"
  ADD CONSTRAINT "ExtensionPairingCode_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExtensionDevice"
  ADD CONSTRAINT "ExtensionDevice_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionDevice"
  ADD CONSTRAINT "ExtensionDevice_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionAuthChallenge"
  ADD CONSTRAINT "ExtensionAuthChallenge_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "ExtensionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionLoginTicket"
  ADD CONSTRAINT "ExtensionLoginTicket_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "ExtensionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionReplayNonce"
  ADD CONSTRAINT "ExtensionReplayNonce_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "ExtensionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
