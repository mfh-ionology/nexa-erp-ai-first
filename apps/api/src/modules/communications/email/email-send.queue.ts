// ---------------------------------------------------------------------------
// Email Send Queue — BullMQ queue for async SMTP delivery
// E10-1 Task 4.4
// ---------------------------------------------------------------------------

import { Queue, type ConnectionOptions } from 'bullmq';

/** Job data shape for the email-send queue */
export interface EmailSendJobData {
  emailQueueId: string;
}

export const EMAIL_SEND_QUEUE_NAME = 'email-send';

type MinimalLogger = { warn: (...args: unknown[]) => void };

let queue: Queue<EmailSendJobData> | null = null;
let moduleLogger: MinimalLogger = console;

/**
 * Initialise the BullMQ queue for email sending.
 *
 * Called once during Fastify startup. Uses ConnectionOptions (not an ioredis
 * instance) so BullMQ manages its own connection lifecycle.
 */
export function initEmailSendQueue(
  connection: ConnectionOptions,
  logger?: MinimalLogger,
): Queue<EmailSendJobData> {
  if (logger) moduleLogger = logger;
  queue = new Queue<EmailSendJobData>(EMAIL_SEND_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000, age: 24 * 3600 }, // retain last 1000 successes for 24h
      removeOnFail: { count: 500, age: 7 * 24 * 3600 }, // keep last 500 failures for 7 days
      attempts: 3,
      backoff: { type: 'custom' },
    },
  });
  return queue;
}

/**
 * Enqueue an email for SMTP delivery.
 *
 * Called from EmailQueueService after creating an EmailQueue record.
 * If the queue is not initialised (Redis unavailable), logs a warning and
 * returns without throwing — email remains in QUEUED status for manual retry.
 */
export async function enqueueEmailSend(emailQueueId: string): Promise<void> {
  if (!queue) {
    moduleLogger.warn({ emailQueueId }, '[email-send] Queue not initialised — cannot enqueue send');
    return;
  }

  await queue.add(
    'send',
    { emailQueueId },
    {
      jobId: `email-${emailQueueId}`,
    },
  );
}

/**
 * Return the queue instance (for closing during shutdown).
 */
export function getEmailSendQueue(): Queue<EmailSendJobData> | null {
  return queue;
}
