// ---------------------------------------------------------------------------
// Dead-Letter Plugin — Fastify plugin that wires up retry + DLQ on the EventBus
// E3-3 Task 7
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import IORedis from 'ioredis';
import { DeadLetterService } from './dead-letter.service.js';
import { RetryableHandlerExecutor } from './retry-handler.js';
import { parseRedisUrl } from './redis-connection.js';

declare module 'fastify' {
  interface FastifyInstance {
    deadLetterService: DeadLetterService | null;
  }
}

const deadLetterPluginFn: FastifyPluginAsync = async (fastify) => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  // Retry executor (works even without Redis).
  // Jitter (±25%) is applied to backoff delays to prevent thundering herd
  // on coordinated failures. Story AC says "1s, 2s, 4s" — production uses
  // approximate values; tests verify exact timing with jitterFraction: 0.
  const retryExecutor = new RetryableHandlerExecutor({ jitterFraction: 0.25 });
  retryExecutor.setLogger(fastify.log);
  fastify.eventBus.setRetryExecutor(retryExecutor);

  // Check if Redis is reachable before setting up DLQ.
  // Retry the probe up to 3 times to survive transient blips at startup.
  let redisAvailable = false;
  const PROBE_ATTEMPTS = 3;
  const PROBE_DELAY_MS = 1000;
  for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt++) {
    let probe: IORedis | null = null;
    try {
      probe = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
        enableReadyCheck: false,
      });
      probe.on('error', () => {}); // suppress during probe
      await probe.connect();
      await probe.ping();
      redisAvailable = true;
      break;
    } catch {
      if (attempt < PROBE_ATTEMPTS) {
        fastify.log.warn(
          `[DeadLetterPlugin] Redis probe attempt ${String(attempt)}/${String(PROBE_ATTEMPTS)} failed — retrying in ${String(PROBE_DELAY_MS)}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, PROBE_DELAY_MS));
      } else {
        fastify.log.warn(
          '[DeadLetterPlugin] Redis connection failed after all probe attempts — dead-letter queue disabled',
        );
      }
    } finally {
      // Always disconnect the probe to prevent connection leaks,
      // regardless of whether connect/ping succeeded or failed.
      if (probe) {
        try {
          probe.disconnect();
        } catch {
          // Ignore disconnect errors during probe cleanup
        }
      }
    }
  }

  // Dead-letter service (requires Redis)
  if (redisAvailable) {
    // Pass connection OPTIONS (not an ioredis instance) so BullMQ creates and
    // manages its own internal connection. This prevents unhandled rejections
    // from pending BullMQ operations when the connection is closed externally.
    const connectionOpts = parseRedisUrl(redisUrl);
    const deadLetterService = new DeadLetterService(connectionOpts);
    deadLetterService.setLogger(fastify.log);
    fastify.eventBus.setDeadLetterService(deadLetterService);
    fastify.decorate('deadLetterService', deadLetterService);

    fastify.addHook('onClose', async () => {
      // BullMQ manages its own connection when passed options (not instance),
      // so Queue.close() handles full cleanup including the Redis connection.
      await deadLetterService.close();
    });
  } else {
    // Decorate with null — routes check availability before use
    fastify.decorate('deadLetterService', null);
  }
};

export const deadLetterPlugin = fp(deadLetterPluginFn, {
  name: 'dead-letter',
  dependencies: ['event-bus'],
});
