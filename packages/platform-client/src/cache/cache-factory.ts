import Redis from 'ioredis';
import type { Logger } from 'pino';
import type { EntitlementCache } from './cache.interface.js';
import { MemoryCache } from './memory-cache.js';
import { RedisCache } from './redis-cache.js';

export function createEntitlementCache(
  redisUrl: string | undefined,
  logger?: Logger,
): EntitlementCache {
  if (redisUrl) {
    const redis = new Redis(redisUrl);
    // Attach error handler to prevent unhandled 'error' events crashing the process
    redis.on('error', (err) => {
      logger?.error({ error: err.message }, 'Entitlement cache: Redis connection error');
    });
    logger?.info('Entitlement cache: Redis backend active');
    return new RedisCache(redis);
  }

  logger?.info('Entitlement cache: in-memory backend active (no REDIS_URL)');
  return new MemoryCache();
}
