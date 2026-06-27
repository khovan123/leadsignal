ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AuthSession" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "familyId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "replacedByHash" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX IF NOT EXISTS "AuthSession_familyId_idx" ON "AuthSession"("familyId");

CREATE TABLE IF NOT EXISTS "WorkspaceInvitation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "tokenHash" TEXT NOT NULL UNIQUE,
  "invitedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_workspaceId_idx" ON "WorkspaceInvitation"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_email_idx" ON "WorkspaceInvitation"("email");

CREATE TABLE IF NOT EXISTS "OAuthState" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stateHash" TEXT NOT NULL UNIQUE,
  "provider" TEXT NOT NULL,
  "workspaceId" UUID REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" UUID REFERENCES "User"("id") ON DELETE CASCADE,
  "redirectUri" TEXT NOT NULL,
  "codeVerifier" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

CREATE TABLE IF NOT EXISTS "RedditConnection" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "ownerUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "redditUserId" TEXT,
  "redditUsername" TEXT,
  "encryptedCredential" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastCollectedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ProviderOAuthCredential" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "connectionId" UUID NOT NULL UNIQUE REFERENCES "LlmConnection"("id") ON DELETE CASCADE,
  "provider" "LlmProvider" NOT NULL,
  "encryptedCredential" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CollectorLease" (
  "name" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
