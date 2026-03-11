// ---------------------------------------------------------------------------
// Notification Dispatch Plugin — Fastify lifecycle for BullMQ queue + worker
// E9-1 Task 5.3
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { Worker } from 'bullmq';
import { prisma } from '@nexa/db';

import { parseRedisUrl } from '../../../core/events/redis-connection.js';
import {
  initNotificationDispatchQueue,
  getNotificationDispatchQueue,
  type NotificationDispatchJobData,
} from './notification-dispatch.queue.js';
import { createNotificationDispatchWorker } from './notification-dispatch.worker.js';
import {
  isEmailConfigured,
  getEmailConfig,
  createEmailSender,
  type EmailSender,
} from '../email/index.js';

const notificationDispatchPluginFn: FastifyPluginAsync = async (fastify) => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    fastify.log.warn(
      '[NotificationDispatchPlugin] REDIS_URL not set — notification delivery queue disabled',
    );
    return;
  }

  // The dead-letter plugin (our dependency) probes Redis on startup.
  // If Redis was unreachable, deadLetterService is null — skip BullMQ init
  // to avoid unhandled 'error' events from failed connections.
  if (fastify.deadLetterService === null) {
    fastify.log.warn(
      '[NotificationDispatchPlugin] Redis unavailable (dead-letter probe failed) — notification delivery queue disabled',
    );
    return;
  }

  let worker: Worker<NotificationDispatchJobData> | null = null;
  let emailSender: EmailSender | null = null;

  try {
    const connection = parseRedisUrl(redisUrl);

    // Initialise the queue (makes enqueueNotificationDelivery() functional)
    initNotificationDispatchQueue(connection);

    // Create email sender if SMTP is configured (graceful degradation if not)
    if (isEmailConfigured()) {
      emailSender = createEmailSender(getEmailConfig(), fastify.log);
      // Non-blocking connection verification — log warning if SMTP unreachable
      emailSender
        .verifyConnection()
        .then((ok) => {
          if (ok) {
            fastify.log.info('[NotificationDispatchPlugin] SMTP connection verified');
          }
          // Warning is logged inside verifyConnection() on failure
        })
        .catch((err) => {
          fastify.log.warn(
            { error: (err as Error).message },
            '[NotificationDispatchPlugin] Unexpected error during SMTP verification',
          );
        });
    } else {
      fastify.log.info(
        '[NotificationDispatchPlugin] SMTP not configured — email delivery will be a no-op',
      );
    }

    // Start the worker that processes delivery jobs
    worker = createNotificationDispatchWorker(prisma, fastify.log, connection, emailSender);

    fastify.log.info('[NotificationDispatchPlugin] Queue and worker initialised');
  } catch (err) {
    fastify.log.warn(
      { error: (err as Error).message },
      '[NotificationDispatchPlugin] Failed to initialise — notification delivery queue disabled',
    );
    return;
  }

  // Graceful shutdown: close worker first, then email sender, then queue
  fastify.addHook('onClose', async () => {
    if (worker) {
      try {
        await worker.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[NotificationDispatchPlugin] Error closing worker',
        );
      }
    }

    if (emailSender) {
      try {
        emailSender.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[NotificationDispatchPlugin] Error closing email sender',
        );
      }
    }

    const queue = getNotificationDispatchQueue();
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
          '[NotificationDispatchPlugin] Error closing queue',
        );
      }
    }
  });
};

export const notificationDispatchPlugin = fp(notificationDispatchPluginFn, {
  name: 'notification-dispatch',
  dependencies: ['dead-letter'], // ensures Redis probe + event bus are ready
});
