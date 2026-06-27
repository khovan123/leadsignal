import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { AppModule, LlmPoolRouterService, PrismaService } from '@leadsignal/api';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const prisma = app.get(PrismaService);
  const router = app.get(LlmPoolRouterService);

  const redis = new Redis(process.env.VALKEY_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  const worker = new Worker('post-classification', async (job) => {
    const { workspaceId, postId } = job.data as { workspaceId: string; postId: string };
    const post = await prisma.redditPost.findUniqueOrThrow({ where: { id: postId } });
    const result = await router.classify(workspaceId, post);
    const priorityScore = Math.round(result.output.buyingIntentScore * 0.5 + result.output.fitScore * 0.3 + result.output.urgencyScore * 0.2);
    const classification = await prisma.postClassification.create({ data: {
      workspaceId, postId, correlationId: result.correlationId,
      method: result.provider === 'RULE_ENGINE' ? 'RULE_ENGINE' : 'LLM',
      isBuyingSignal: result.output.isBuyingSignal, signalType: result.output.signalType,
      confidence: result.output.confidence, buyingIntentScore: result.output.buyingIntentScore,
      urgencyScore: result.output.urgencyScore, fitScore: result.output.fitScore,
      priorityScore, priorityLevel: result.priority, summary: result.output.summary,
      evidence: result.output.evidence, provider: result.provider, model: result.model,
    }});
    if (result.output.isBuyingSignal && priorityScore >= 50) {
      await prisma.lead.upsert({
        where: { workspaceId_postId: { workspaceId, postId } },
        update: { classificationId: classification.id, priorityScore, priorityLevel: result.priority },
        create: { workspaceId, postId, classificationId: classification.id, priorityScore, priorityLevel: result.priority },
      });
    }
    return { classificationId: classification.id, leadCreated: result.output.isBuyingSignal && priorityScore >= 50 };
  }, { connection: redis, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 20) });

  const stop = async () => { await worker.close(); await redis.quit(); await app.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  console.log('LeadSignal worker started');
}
bootstrap();
