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
    { maxRetriesPerRequest: 1, enableOfflineQueue: false },
  );

  async consume(
    subject: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitResult> {
    const windowId = Math.floor(
      Date.now() / 1_000 / policy.windowSeconds,
    );
    const key = `rate:${policy.id}:${windowId}:${subject}`;
    const result = (await this.redis.eval(
      `local current=redis.call('INCR',KEYS[1]); if current==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; local ttl=redis.call('TTL',KEYS[1]); return {current,ttl}`,
      1,
      key,
      policy.windowSeconds,
    )) as [number, number];
    const current = Number(result[0]);
    const resetSeconds = Math.max(1, Number(result[1]));

    return {
      allowed: current <= policy.limit,
      remaining: Math.max(0, policy.limit - current),
      resetSeconds,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
