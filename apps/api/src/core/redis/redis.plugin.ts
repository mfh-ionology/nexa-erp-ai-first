import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

/**
 * Shared Redis plugin — decorates `fastify.redis` with an ioredis instance.
 *
 * Must be registered before any plugin that depends on `fastify.redis`
 * (e.g. viewsModulePlugin).
 *
 * Wrapped with fastify-plugin to break encapsulation so the `redis`
 * decorator is visible to sibling plugins (views, etc.).
 *
 * Reads `REDIS_URL` env var, defaults to `redis://localhost:6379`.
 */
const redisPlugin = fp(
  async function redisPlugin(fastify: FastifyInstance): Promise<void> {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      fastify.log.info('Redis connected');
    } catch (err) {
      fastify.log.warn(
        { error: (err as Error).message },
        'Redis connection failed — decorating fastify.redis as null (graceful degradation)',
      );
      // Suppress further error events from the failed connection
      redis.on('error', () => {});
      try {
        redis.disconnect();
      } catch {
        /* ignore */
      }
      fastify.decorate('redis', null);
      return;
    }

    fastify.decorate('redis', redis);

    fastify.addHook('onClose', async () => {
      await redis.quit();
      fastify.log.info('Redis disconnected');
    });
  },
  { name: 'redis' },
);

export { redisPlugin };
