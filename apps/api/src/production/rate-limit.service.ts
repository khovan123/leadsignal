import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { RateLimitPolicy } from './rate-limit.policy';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis = new Redis(
    process.env.VALKEY_URL ?? 'redis://localhost:6379',
    { maxRetriesPerRequest: 1 },
  );

  async consume(
    subject: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitResult> {
    const windowId = Math.floor(Date.now() / 1_000 / policy.windowSeconds);
    const key = `rate:${policy.id}:${windowId}:${subject}`;
    const current = await this.redis.incr(key);
    if (current === 1) await this.redis.expire(key, policy.windowSeconds);
    const ttl = await this.redis.ttl(key);

    return {
      allowed: current <= policy.limit,
      remaining: Math.max(0, policy.limit - current),
      resetSeconds: Math.max(1, ttl),
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
