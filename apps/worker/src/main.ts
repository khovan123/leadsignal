import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import {
  AppModule,
  EmailOutboxService,
  LlmPoolRouterService,
  PrismaService,
  RedditPublicCollectorService,
} from '@leadsignal/api';

function createValkeyConnection() {
  const url = new URL(process.env.VALKEY_URL ?? 'redis://localhost:6379');

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const router = app.get(LlmPoolRouterService);
  const redditCollector = app.get(RedditPublicCollectorService);
  const emailOutbox = app.get(EmailOutboxService);
  const workerId = randomUUID();
  const connection = createValkeyConnection();

  const worker = new Worker(
    'post-classification',
    async (job) => {
      const { workspaceId, postId } = job.data as {
        workspaceId: string;
        postId: string;
      };
      const post = await prisma.redditPost.findUniqueOrThrow({
        where: { id: postId },
      });
      const result = await router.classify(workspaceId, post);
      const priorityScore = Math.round(
        result.output.buyingIntentScore * 0.5 +
          result.output.fitScore * 0.3 +
          result.output.urgencyScore * 0.2,
      );
      const classification = await prisma.postClassification.create({
        data: {
          workspaceId,
          postId,
          correlationId: result.correlationId,
          method: result.provider === 'RULE_ENGINE' ? 'RULE_ENGINE' : 'LLM',
          isBuyingSignal: result.output.isBuyingSignal,
          signalType: result.output.signalType,
          confidence: result.output.confidence,
          buyingIntentScore: result.output.buyingIntentScore,
          urgencyScore: result.output.urgencyScore,
          fitScore: result.output.fitScore,
          priorityScore,
          priorityLevel: result.priority,
          summary: result.output.summary,
          evidence: result.output.evidence,
          provider: result.provider,
          model: result.model,
        },
      });

      if (result.output.isBuyingSignal && priorityScore >= 50) {
        await prisma.lead.upsert({
          where: { workspaceId_postId: { workspaceId, postId } },
          update: {
            classificationId: classification.id,
            priorityScore,
            priorityLevel: result.priority,
          },
          create: {
            workspaceId,
            postId,
            classificationId: classification.id,
            priorityScore,
            priorityLevel: result.priority,
          },
        });
      }

      return {
        classificationId: classification.id,
        leadCreated: result.output.isBuyingSignal && priorityScore >= 50,
      };
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 20),
    },
  );

  const redditWorker = new Worker(
    'reddit-collection',
    async (job) => {
      const { workspaceId, sourceIds } = job.data as {
        workspaceId: string;
        userId: string;
        sourceIds?: string[];
      };
      await job.updateProgress({ status: 'RUNNING' });
      const result = await redditCollector.collect({ workspaceId, sourceIds });
      await job.updateProgress({
        status: 'COMPLETED',
        sources: result.sourceResults,
      });
      return result;
    },
    {
      connection,
      concurrency: Math.max(
        1,
        Number(process.env.REDDIT_COLLECTION_CONCURRENCY ?? 1),
      ),
    },
  );

  const collect = async () => {
    const leaseSeconds = Math.max(
      60,
      Number(process.env.REDDIT_COLLECTOR_INTERVAL_SECONDS ?? 300),
    );
    const acquired = await prisma.$queryRaw<{ ownerId: string }[]>`
      INSERT INTO "CollectorLease" (name,"ownerId","expiresAt","updatedAt")
      VALUES ('reddit',${workerId},NOW() + (${leaseSeconds} * INTERVAL '1 second'),NOW())
      ON CONFLICT (name) DO UPDATE
      SET "ownerId"=EXCLUDED."ownerId","expiresAt"=EXCLUDED."expiresAt","updatedAt"=NOW()
      WHERE "CollectorLease"."expiresAt" < NOW()
         OR "CollectorLease"."ownerId"=${workerId}
      RETURNING "ownerId"
    `;
    if (acquired[0]?.ownerId !== workerId) return;

    try {
      const result = await redditCollector.collect();
      console.log('Reddit public crawler completed', result);
    } catch (error) {
      console.error('Reddit public crawler failed', error);
    }
  };

  let processingOutbox = false;
  const deliverEmails = async () => {
    if (processingOutbox) return;
    processingOutbox = true;
    try {
      const result = await emailOutbox.processBatch(
        workerId,
        Number(process.env.EMAIL_OUTBOX_BATCH_SIZE ?? 20),
      );
      if (result.claimed > 0) console.log('Email outbox processed', result);
    } catch (error) {
      console.error('Email outbox processing failed', error);
    } finally {
      processingOutbox = false;
    }
  };

  const collectorInterval = setInterval(
    collect,
    Number(process.env.REDDIT_COLLECTOR_INTERVAL_SECONDS ?? 300) * 1_000,
  );
  collectorInterval.unref();
  const emailInterval = setInterval(
    deliverEmails,
    Number(process.env.EMAIL_OUTBOX_INTERVAL_SECONDS ?? 10) * 1_000,
  );
  emailInterval.unref();
  void collect();
  void deliverEmails();

  const stop = async () => {
    clearInterval(collectorInterval);
    clearInterval(emailInterval);
    await Promise.all([worker.close(), redditWorker.close()]);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log('LeadSignal worker started');
}

bootstrap();
