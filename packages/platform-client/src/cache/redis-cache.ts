import type Redis from 'ioredis';
import type { TenantEntitlements } from '../types/index.js';
import type { EntitlementCache } from './cache.interface.js';

const KEY_PREFIX = 'platform:entitlements:';

export class RedisCache implements EntitlementCache {
  constructor(private readonly redis: Redis) {}

  async get(tenantId: string): Promise<TenantEntitlements | null> {
    const raw = await this.redis.get(`${KEY_PREFIX}${tenantId}`);
    if (raw === null) return null;
    return JSON.parse(raw) as TenantEntitlements;
  }

  async set(tenantId: string, data: TenantEntitlements, ttlMs: number): Promise<void> {
    await this.redis.set(`${KEY_PREFIX}${tenantId}`, JSON.stringify(data), 'PX', ttlMs);
  }

  async delete(tenantId: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${tenantId}`);
  }

  async destroy(): Promise<void> {
    await this.redis.quit();
  }
}
