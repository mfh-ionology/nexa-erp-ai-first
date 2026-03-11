// ---------------------------------------------------------------------------
// Task Overdue Plugin — Fastify lifecycle for BullMQ overdue detection cron
// E11-3 Task 5.3
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { Worker } from 'bullmq';
import { prisma } from '@nexa/db';

import { parseRedisUrl } from '../../core/events/redis-connection.js';
import { eventBus } from '../../core/events/event-bus.js';
import {
  initTaskOverdueQueue,
  getTaskOverdueQueue,
  type TaskOverdueCheckJobData,
} from './task-overdue.queue.js';
import { createTaskOverdueWorker } from './task-overdue.worker.js';

const taskOverduePluginFn: FastifyPluginAsync = async (fastify) => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    fastify.log.warn('[TaskOverduePlugin] REDIS_URL not set — overdue task detection disabled');
    return;
  }

  let worker: Worker<TaskOverdueCheckJobData> | null = null;

  try {
    const connection = parseRedisUrl(redisUrl);

    // Initialise the queue with repeatable cron job
    await initTaskOverdueQueue(connection);

    // Start the worker that processes overdue checks
    worker = createTaskOverdueWorker(prisma, eventBus, connection, fastify.log);

    fastify.log.info('[TaskOverduePlugin] Queue and worker initialised (daily at 08:00 UTC)');
  } catch (err) {
    fastify.log.warn(
      { error: (err as Error).message },
      '[TaskOverduePlugin] Failed to initialise — overdue task detection disabled',
    );
    return;
  }

  // Graceful shutdown: close worker first, then queue
  fastify.addHook('onClose', async () => {
    if (worker) {
      try {
        await worker.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[TaskOverduePlugin] Error closing worker',
        );
      }
    }

    const queue = getTaskOverdueQueue();
    if (queue) {
      try {
        await queue.client;
      } catch {
        // Connection never established
      }
      try {
        await queue.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[TaskOverduePlugin] Error closing queue',
        );
      }
    }
  });
};

export const taskOverduePlugin = fp(taskOverduePluginFn, {
  name: 'task-overdue',
  dependencies: ['dead-letter'],
});
