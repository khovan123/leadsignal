import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

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

@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly classification = new Queue('post-classification', {
    connection: createValkeyConnection(),
  });

  readonly redditCollection = new Queue('reddit-collection', {
    connection: createValkeyConnection(),
  });

  enqueueClassification(workspaceId: string, postId: string) {
    const safeKey = `${workspaceId}-${postId}`;
    return this.classification.add(
      'classify-post',
      { workspaceId, postId },
      {
        jobId: safeKey,
        attempts: 4,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }

  enqueueRedditCollection(
    workspaceId: string,
    userId: string,
    sourceIds?: string[],
  ) {
    return this.redditCollection.add(
      'collect-reddit-sources',
      {
        workspaceId,
        userId,
        sourceIds: sourceIds?.length ? sourceIds : undefined,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );
  }

  async getRedditCollectionJob(jobId: string) {
    const job = await this.redditCollection.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      id: String(job.id),
      workspaceId: String(job.data?.workspaceId ?? ''),
      userId: String(job.data?.userId ?? ''),
      state,
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason || null,
      createdAt: new Date(job.timestamp),
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.classification.close(),
      this.redditCollection.close(),
    ]);
  }
}
