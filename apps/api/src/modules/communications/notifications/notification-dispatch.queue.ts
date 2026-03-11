// ---------------------------------------------------------------------------
// Notification Dispatch Queue — BullMQ queue for async channel delivery
// E9-1 Task 5.1
// ---------------------------------------------------------------------------

import { Queue, type ConnectionOptions } from 'bullmq';
import type { NotificationChannel } from '@nexa/db';

/** Job data shape for the notification-dispatch queue */
export interface NotificationDispatchJobData {
  notificationId: string;
  channel: NotificationChannel;
}

const QUEUE_NAME = 'notification-dispatch';

let queue: Queue<NotificationDispatchJobData> | null = null;

/**
 * Initialise the BullMQ queue for notification delivery.
 *
 * Called once during Fastify startup (see notification-dispatch.plugin.ts).
 * Uses ConnectionOptions (not an ioredis instance) so BullMQ manages its
 * own connection lifecycle.
 */
export function initNotificationDispatchQueue(
  connection: ConnectionOptions,
): Queue<NotificationDispatchJobData> {
  queue = new Queue<NotificationDispatchJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000, age: 24 * 3600 }, // retain last 1000 successes for 24h (monitoring)
      removeOnFail: { count: 500, age: 7 * 24 * 3600 }, // keep last 500 failures for 7 days
      attempts: 3,
      backoff: { type: 'custom' },
    },
  });
  // Prevent unhandled 'error' events from crashing the process if Redis disconnects
  queue.on('error', (err) => {
    console.warn(`[notification-dispatch] Queue error: ${err.message}`);
  });
  return queue;
}

/**
 * Enqueue a notification for async delivery on a specific channel.
 *
 * Called from notification.service.ts after creating a Notification record.
 * If the queue is not initialised (Redis unavailable), logs a warning and
 * returns without throwing — notification remains in PENDING status.
 */
export async function enqueueNotificationDelivery(
  notificationId: string,
  channel: NotificationChannel,
): Promise<void> {
  if (!queue) {
    console.warn(
      `[notification-dispatch] Queue not initialised — cannot enqueue delivery for ${notificationId} on ${channel}`,
    );
    return;
  }

  await queue.add(
    'deliver',
    { notificationId, channel },
    {
      jobId: `notif-${notificationId}-${channel}`,
    },
  );
}

/**
 * Return the queue instance (for closing during shutdown).
 */
export function getNotificationDispatchQueue(): Queue<NotificationDispatchJobData> | null {
  return queue;
}

/** Exported queue name for the worker to reference. */
export { QUEUE_NAME as NOTIFICATION_DISPATCH_QUEUE_NAME };
