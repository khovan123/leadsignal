CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER','ADMIN','MEMBER','VIEWER');
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING','ACTIVE','DEGRADED','RATE_LIMITED','INVALID','DRAINING','DISABLED');
CREATE TYPE "LlmProvider" AS ENUM ('OPENAI','ANTHROPIC','GEMINI','OPENROUTER','GITHUB_MODELS','CUSTOM_OPENAI_COMPATIBLE','RULE_ENGINE');
CREATE TYPE "LlmTaskType" AS ENUM ('BUYING_SIGNAL_CLASSIFICATION','LEAD_ENRICHMENT','REPORT_SUMMARY');
CREATE TYPE "RoutingMode" AS ENUM ('CONSISTENCY_FIRST','AVAILABILITY_FIRST','OWNER_PRIORITY');
CREATE TYPE "LeadStatus" AS ENUM ('NEW','REVIEWING','QUALIFIED','ASSIGNED','CONTACTED','CONVERTED','REJECTED','ARCHIVED');
CREATE TYPE "PriorityLevel" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING','SUCCEEDED','FAILED','SKIPPED_CAPACITY','SKIPPED_CIRCUIT_OPEN');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Workspace" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "locale" TEXT NOT NULL DEFAULT 'vi',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WorkspaceMember" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "WorkspaceMember_workspaceId_userId_key" UNIQUE ("workspaceId","userId")
);

CREATE TABLE "RedditSource" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subreddit" TEXT,
  "searchQuery" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedditSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE
);

CREATE TABLE "RedditPost" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "externalPostId" TEXT NOT NULL UNIQUE,
  "subreddit" TEXT NOT NULL,
  "authorUsername" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "permalink" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "postedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PostDiscovery" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostDiscovery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "PostDiscovery_postId_fkey" FOREIGN KEY ("postId") REFERENCES "RedditPost"("id") ON DELETE CASCADE,
  CONSTRAINT "PostDiscovery_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RedditSource"("id") ON DELETE CASCADE,
  CONSTRAINT "PostDiscovery_workspaceId_postId_sourceId_key" UNIQUE ("workspaceId","postId","sourceId")
);
CREATE INDEX "PostDiscovery_workspaceId_discoveredAt_idx" ON "PostDiscovery"("workspaceId","discoveredAt");

CREATE TABLE "LlmConnection" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "provider" "LlmProvider" NOT NULL,
  "name" TEXT NOT NULL,
  "accountLabel" TEXT,
  "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
  "poolEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "baseUrl" TEXT,
  "encryptedCredential" TEXT,
  "credentialIv" TEXT,
  "credentialAuthTag" TEXT,
  "ownerConcurrencyLimit" INTEGER NOT NULL DEFAULT 2,
  "workspaceConcurrencyCap" INTEGER,
  "healthScore" INTEGER NOT NULL DEFAULT 100,
  "cooldownUntil" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "LlmConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "LlmConnection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "LlmConnection_workspaceId_provider_status_poolEnabled_idx" ON "LlmConnection"("workspaceId","provider","status","poolEnabled");
CREATE INDEX "LlmConnection_ownerUserId_idx" ON "LlmConnection"("ownerUserId");

CREATE TABLE "LlmConnectionModel" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "connectionId" UUID NOT NULL,
  "model" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "concurrencyLimit" INTEGER,
  "supportsJsonSchema" BOOLEAN NOT NULL DEFAULT FALSE,
  "averageLatencyMs" INTEGER,
  "successRate" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmConnectionModel_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "LlmConnection"("id") ON DELETE CASCADE,
  CONSTRAINT "LlmConnectionModel_connectionId_model_key" UNIQUE ("connectionId","model")
);
CREATE INDEX "LlmConnectionModel_model_enabled_idx" ON "LlmConnectionModel"("model","enabled");

CREATE TABLE "LlmRoutingPolicy" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "taskType" "LlmTaskType" NOT NULL,
  "mode" "RoutingMode" NOT NULL DEFAULT 'CONSISTENCY_FIRST',
  "workspaceConcurrency" INTEGER NOT NULL DEFAULT 20,
  "allowCrossProvider" BOOLEAN NOT NULL DEFAULT TRUE,
  "allowRuleFallback" BOOLEAN NOT NULL DEFAULT TRUE,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmRoutingPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "LlmRoutingPolicy_workspaceId_taskType_version_key" UNIQUE ("workspaceId","taskType","version")
);

CREATE TABLE "LlmModelRoute" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "policyId" UUID NOT NULL,
  "tier" INTEGER NOT NULL,
  "provider" "LlmProvider" NOT NULL,
  "model" TEXT NOT NULL,
  "maxRetries" INTEGER NOT NULL DEFAULT 1,
  "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "LlmModelRoute_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LlmRoutingPolicy"("id") ON DELETE CASCADE,
  CONSTRAINT "LlmModelRoute_policyId_tier_provider_model_key" UNIQUE ("policyId","tier","provider","model")
);
CREATE INDEX "LlmModelRoute_policyId_tier_idx" ON "LlmModelRoute"("policyId","tier");

CREATE TABLE "LlmExecution" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlationId" TEXT NOT NULL,
  "workspaceId" UUID NOT NULL,
  "connectionId" UUID,
  "connectionOwnerUserId" UUID,
  "taskType" "LlmTaskType" NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "provider" "LlmProvider" NOT NULL,
  "model" TEXT NOT NULL,
  "routeTier" INTEGER NOT NULL,
  "accountAttempt" INTEGER NOT NULL,
  "status" "ExecutionStatus" NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "latencyMs" INTEGER,
  "fallbackReason" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "LlmExecution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "LlmExecution_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "LlmConnection"("id") ON DELETE SET NULL
);
CREATE INDEX "LlmExecution_correlationId_idx" ON "LlmExecution"("correlationId");
CREATE INDEX "LlmExecution_workspaceId_taskType_createdAt_idx" ON "LlmExecution"("workspaceId","taskType","createdAt");

CREATE TABLE "PostClassification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "correlationId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "isBuyingSignal" BOOLEAN NOT NULL,
  "signalType" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "buyingIntentScore" INTEGER NOT NULL,
  "urgencyScore" INTEGER NOT NULL,
  "fitScore" INTEGER NOT NULL,
  "priorityScore" INTEGER NOT NULL,
  "priorityLevel" "PriorityLevel" NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "provider" "LlmProvider" NOT NULL,
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostClassification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "PostClassification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "RedditPost"("id") ON DELETE CASCADE
);
CREATE INDEX "PostClassification_workspaceId_priorityScore_idx" ON "PostClassification"("workspaceId","priorityScore");

CREATE TABLE "Lead" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "classificationId" UUID NOT NULL,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "priorityScore" INTEGER NOT NULL,
  "priorityLevel" "PriorityLevel" NOT NULL,
  "assignedToUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "Lead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "RedditPost"("id") ON DELETE CASCADE,
  CONSTRAINT "Lead_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "PostClassification"("id") ON DELETE RESTRICT,
  CONSTRAINT "Lead_workspaceId_postId_key" UNIQUE ("workspaceId","postId")
);
CREATE INDEX "Lead_workspaceId_status_priorityScore_idx" ON "Lead"("workspaceId","status","priorityScore");
