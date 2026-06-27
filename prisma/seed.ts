import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, LlmProvider, LlmTaskType, PriorityLevel, WorkspaceRole } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const userId = '00000000-0000-4000-8000-000000000001';
  const workspaceId = '00000000-0000-4000-8000-000000000001';

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: 'demo@leadsignal.local', displayName: 'Demo Member' },
  });

  await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: { id: workspaceId, name: 'LeadSignal Demo', slug: 'demo' },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { role: WorkspaceRole.OWNER },
    create: { workspaceId, userId, role: WorkspaceRole.OWNER },
  });

  const policy = await prisma.llmRoutingPolicy.upsert({
    where: {
      workspaceId_taskType_version: {
        workspaceId,
        taskType: LlmTaskType.BUYING_SIGNAL_CLASSIFICATION,
        version: 1,
      },
    },
    update: {},
    create: {
      workspaceId,
      taskType: LlmTaskType.BUYING_SIGNAL_CLASSIFICATION,
      mode: 'CONSISTENCY_FIRST',
      version: 1,
    },
  });

  await prisma.llmModelRoute.upsert({
    where: {
      policyId_tier_provider_model: {
        policyId: policy.id,
        tier: 999,
        provider: LlmProvider.RULE_ENGINE,
        model: 'deterministic-buying-signal-v1',
      },
    },
    update: {},
    create: {
      policyId: policy.id,
      tier: 999,
      provider: LlmProvider.RULE_ENGINE,
      model: 'deterministic-buying-signal-v1',
      maxRetries: 0,
      timeoutMs: 5000,
    },
  });

  const source = await prisma.redditSource.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      workspaceId,
      name: 'r/SaaS demo',
      type: 'SHARED_SUBREDDIT',
      subreddit: 'SaaS',
    },
  });

  const post = await prisma.redditPost.upsert({
    where: { externalPostId: 't3_leadsignal_demo' },
    update: {},
    create: {
      externalPostId: 't3_leadsignal_demo',
      subreddit: 'SaaS',
      authorUsername: 'demo-founder',
      title: 'Looking for a tool to automate lead qualification',
      body: 'Our sales team spends hours qualifying inbound leads. We are looking for a solution that can detect buying intent and prioritize outreach.',
      permalink: 'https://reddit.com/r/SaaS/comments/leadsignal_demo',
      score: 24,
      commentCount: 11,
      postedAt: new Date(),
    },
  });

  await prisma.postDiscovery.upsert({
    where: { workspaceId_postId_sourceId: { workspaceId, postId: post.id, sourceId: source.id } },
    update: {},
    create: { workspaceId, postId: post.id, sourceId: source.id },
  });

  const classification = await prisma.postClassification.create({
    data: {
      workspaceId,
      postId: post.id,
      correlationId: 'seed-demo',
      method: 'RULE_ENGINE',
      isBuyingSignal: true,
      signalType: 'LOOKING_FOR_SOLUTION',
      confidence: 0.6,
      buyingIntentScore: 86,
      urgencyScore: 64,
      fitScore: 82,
      priorityScore: 80,
      priorityLevel: PriorityLevel.CRITICAL,
      summary: 'The author is actively looking for a lead qualification solution.',
      evidence: [{ quote: 'We are looking for a solution', reason: 'Direct solution-seeking language' }],
      provider: LlmProvider.RULE_ENGINE,
      model: 'deterministic-buying-signal-v1',
    },
  });

  await prisma.lead.upsert({
    where: { workspaceId_postId: { workspaceId, postId: post.id } },
    update: { classificationId: classification.id },
    create: {
      workspaceId,
      postId: post.id,
      classificationId: classification.id,
      priorityScore: 80,
      priorityLevel: PriorityLevel.CRITICAL,
    },
  });
}

main().finally(() => prisma.$disconnect());
