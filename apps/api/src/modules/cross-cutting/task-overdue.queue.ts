// ---------------------------------------------------------------------------
// Task Overdue Queue — BullMQ queue for daily overdue task detection cron
// E11-3 Task 5.1
// ---------------------------------------------------------------------------

import { Queue, type ConnectionOptions } from 'bullmq';

/** Job data shape — empty for the cron job (no per-job data needed) */
export interface TaskOverdueCheckJobData {
  // intentionally empty — the cron job processes all overdue tasks
}

const QUEUE_NAME = 'task-overdue-check';

let queue: Queue<TaskOverdueCheckJobData> | null = null;

/**
 * Initialise the BullMQ queue for overdue task detection.
 *
 * Adds a repeatable job that runs daily at 08:00 UTC.
 * Called once during Fastify startup (see task-overdue.plugin.ts).
 */
export async function initTaskOverdueQueue(
  connection: ConnectionOptions,
): Promise<Queue<TaskOverdueCheckJobData>> {
  queue = new Queue<TaskOverdueCheckJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100, age: 7 * 24 * 3600 },
      removeOnFail: { count: 100, age: 7 * 24 * 3600 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
    },
  });
  // Prevent unhandled 'error' events from crashing the process if Redis disconnects
  queue.on('error', (err) => {
    console.warn(`[task-overdue] Queue error: ${err.message}`);
  });

  // Add repeatable cron job — daily at 08:00 UTC
  await queue.add(
    'check-overdue',
    {},
    {
      repeat: { pattern: '0 8 * * *' },
      jobId: 'task-overdue-daily',
    },
  );

  return queue;
}

/**
 * Return the queue instance (for closing during shutdown).
 */
export function getTaskOverdueQueue(): Queue<TaskOverdueCheckJobData> | null {
  return queue;
}

/** Exported queue name for the worker to reference. */
export { QUEUE_NAME as TASK_OVERDUE_QUEUE_NAME };
