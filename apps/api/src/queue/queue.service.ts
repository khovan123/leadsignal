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

  async onModuleDestroy(): Promise<void> {
    await this.classification.close();
  }
}
