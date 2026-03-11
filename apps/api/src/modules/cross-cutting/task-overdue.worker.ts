// ---------------------------------------------------------------------------
// Task Overdue Worker — BullMQ worker that detects overdue tasks and emits events
// E11-3 Task 5.2
// ---------------------------------------------------------------------------

import { Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { PrismaClient } from '@nexa/db';

import type { TaskOverdueCheckJobData } from './task-overdue.queue.js';
import { TASK_OVERDUE_QUEUE_NAME } from './task-overdue.queue.js';
import type { EventBus } from '../../core/events/event-bus.js';

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

/**
 * Create and return a BullMQ Worker that processes overdue task detection.
 *
 * On each cron run:
 * 1. Queries all overdue tasks (OPEN/IN_PROGRESS with dueDate < now, not deleted)
 * 2. Checks deduplication — skips tasks already notified within 24h
 * 3. Emits task.overdue event for each newly-overdue task
 */
export function createTaskOverdueWorker(
  prisma: PrismaClient,
  eventBus: EventBus,
  connection: ConnectionOptions,
  logger: Logger,
): Worker<TaskOverdueCheckJobData> {
  const worker = new Worker<TaskOverdueCheckJobData>(
    TASK_OVERDUE_QUEUE_NAME,
    async (_job: Job<TaskOverdueCheckJobData>) => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 1. Query all overdue tasks (across all companies)
      const overdueTasks = await prisma.task.findMany({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueDate: { lt: now },
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          companyId: true,
          createdById: true,
          entityType: true,
          entityId: true,
          assignees: {
            select: { userId: true },
          },
        },
      });

      if (overdueTasks.length === 0) {
        logger.info('[task-overdue] No overdue tasks found');
        return;
      }

      // 2. Batch deduplication — find task IDs already notified within 24h
      // Look up the task.overdue template to get its ID for querying notifications
      const overdueTemplate = await prisma.notificationTemplate.findFirst({
        where: { eventName: 'task.overdue', isActive: true },
        select: { id: true },
      });

      const alreadyNotifiedTaskIds = new Set<string>();

      if (overdueTemplate) {
        const recentNotifications = await prisma.notification.findMany({
          where: {
            templateId: overdueTemplate.id,
            createdAt: { gte: twentyFourHoursAgo },
            entityType: 'Task',
          },
          select: { entityId: true },
          distinct: ['entityId'],
        });
        for (const n of recentNotifications) {
          if (n.entityId) alreadyNotifiedTaskIds.add(n.entityId);
        }
      }

      // 3. Emit events for tasks not yet notified
      let emittedCount = 0;

      for (const task of overdueTasks) {
        if (alreadyNotifiedTaskIds.has(task.id)) continue;

        try {
          const assigneeUserIds = task.assignees.map((a) => a.userId);

          eventBus.emit('task.overdue', {
            taskId: task.id,
            taskTitle: task.title,
            dueDate: task.dueDate ? task.dueDate.toISOString() : new Date().toISOString(),
            companyId: task.companyId,
            assigneeUserIds,
            createdById: task.createdById,
            // Use task's own identity for notification entityType/entityId
            // so deduplication can match by taskId (not the linked entity)
            entityType: 'Task',
            entityId: task.id,
          });

          emittedCount++;
        } catch (err) {
          logger.error(
            { taskId: task.id, error: (err as Error).message },
            '[task-overdue] Failed to emit event for task — continuing with remaining tasks',
          );
        }
      }

      logger.info(
        `[task-overdue] Processed ${overdueTasks.length} overdue tasks, emitted ${emittedCount} events`,
      );
    },
    {
      connection,
      concurrency: 1, // Cron job — single concurrent execution
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, '[task-overdue] Job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job?.id }, '[task-overdue] Job completed');
  });

  return worker;
}
