import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.VALKEY_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  readonly classification = new Queue('post-classification', { connection: this.redis });

  enqueueClassification(workspaceId: string, postId: string) {
    return this.classification.add('classify-post', { workspaceId, postId }, {
      jobId: `${workspaceId}:${postId}`, attempts: 4, backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 1000, removeOnFail: 5000,
    });
  }
  async onModuleDestroy() { await this.classification.close(); await this.redis.quit(); }
}
