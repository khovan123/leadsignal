import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

@Injectable()
export class SlotManagerService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.VALKEY_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

  async tryAcquire(workspaceId: string, connectionId: string, model: string, limit: number) {
    const key = `llm:slots:${workspaceId}:${connectionId}:${model}`;
    const leaseId = randomUUID();
    const count = await this.redis.eval(`local c=tonumber(redis.call('get',KEYS[1]) or '0'); if c >= tonumber(ARGV[1]) then return -1 end; c=redis.call('incr',KEYS[1]); redis.call('pexpire',KEYS[1],ARGV[2]); return c`, 1, key, limit, 120000);
    return Number(count) < 0 ? null : { key, leaseId };
  }

  async release(lease: { key: string }) {
    await this.redis.eval(`local c=tonumber(redis.call('get',KEYS[1]) or '0'); if c <= 1 then return redis.call('del',KEYS[1]) else return redis.call('decr',KEYS[1]) end`, 1, lease.key);
  }

  async onModuleDestroy() { await this.redis.quit(); }
}
