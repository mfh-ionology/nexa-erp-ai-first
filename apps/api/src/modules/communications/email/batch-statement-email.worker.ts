// ---------------------------------------------------------------------------
// Batch Statement Email Worker — E10-3 Task 4.3
// BullMQ worker that processes batch statement email jobs.
// For each customer with a non-zero AR balance in the period, sends a
// CustomerStatement email via DocumentEmailService.
// ---------------------------------------------------------------------------

import { Worker, type ConnectionOptions, type Job } from 'bullmq';
import { NotificationChannel, NotificationPriority } from '@nexa/db';
import type { PrismaClient } from '@nexa/db';

import type { BatchStatementJobData } from './batch-statement-email.service.js';
import { BATCH_STATEMENT_QUEUE_NAME } from './batch-statement-email.service.js';
import type { DocumentEmailService } from './document-email.service.js';
import { enqueueNotificationDelivery } from '../notifications/notification-dispatch.queue.js';
import type { EventBus } from '../../../core/events/event-bus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export interface BatchStatementWorkerHandle {
  worker: Worker<BatchStatementJobData>;
}

// ---------------------------------------------------------------------------
// Worker factory (subtask 4.3)
// ---------------------------------------------------------------------------

export function createBatchStatementWorker(
  prisma: PrismaClient,
  logger: Logger,
  connection: ConnectionOptions,
  documentEmailService: DocumentEmailService,
  emitter: EventBus,
): BatchStatementWorkerHandle {
  const worker = new Worker<BatchStatementJobData>(
    BATCH_STATEMENT_QUEUE_NAME,
    async (job: Job<BatchStatementJobData>) => {
      const { companyId, userId, tenantId, input } = job.data;
      const { dateRange, customerIds, customerCategoryIds } = input;

      logger.info(
        { jobId: job.id, companyId, dateRange },
        'batch-statement-email: processing batch job',
      );

      // Step 1: Query customers with non-zero AR balance for the period.
      // Uses dynamic Prisma delegate access since CustomerInvoice/Customer
      // models may not be available yet (future epics).
      type DynamicDelegate = { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };

      const invoiceDelegate = (prisma as unknown as Record<string, unknown>).customerInvoice as
        | DynamicDelegate
        | undefined;
      const customerDelegate = (prisma as unknown as Record<string, unknown>).customer as
        | DynamicDelegate
        | undefined;

      if (!invoiceDelegate || typeof invoiceDelegate.findMany !== 'function') {
        logger.warn(
          { jobId: job.id },
          'batch-statement-email: CustomerInvoice model not available — cannot process batch',
        );
        await notifyCompletion(prisma, emitter, logger, userId, 0, 0, job.id!);
        return;
      }

      const whereClause: Record<string, unknown> = {
        companyId,
        issueDate: {
          gte: new Date(dateRange.from),
          lte: new Date(dateRange.to),
        },
        // Only include customers with a non-zero outstanding balance (AC5)
        outstandingAmount: { gt: 0 },
      };

      // Apply optional customer filters
      if (customerIds && customerIds.length > 0) {
        whereClause.customerId = { in: customerIds };
      }

      // For category filter, first get customer IDs in those categories
      if (
        customerCategoryIds &&
        customerCategoryIds.length > 0 &&
        customerDelegate &&
        typeof customerDelegate.findMany === 'function'
      ) {
        const customersInCategory = await customerDelegate.findMany({
          where: {
            companyId,
            categoryId: { in: customerCategoryIds },
          },
          select: { id: true },
        });
        const catCustomerIds = customersInCategory.map(
          (c: Record<string, unknown>) => c.id as string,
        );

        if (catCustomerIds.length === 0) {
          await notifyCompletion(prisma, emitter, logger, userId, 0, 0, job.id!);
          return;
        }

        // Combine with any explicit customer IDs
        if (whereClause.customerId) {
          const explicitIds = (whereClause.customerId as { in: string[] }).in;
          whereClause.customerId = {
            in: explicitIds.filter((id: string) => catCustomerIds.includes(id)),
          };
        } else {
          whereClause.customerId = { in: catCustomerIds };
        }
      }

      // Get distinct customers with outstanding invoices
      const invoicesWithBalance = await invoiceDelegate.findMany({
        where: whereClause,
        select: { customerId: true },
        distinct: ['customerId'],
      });

      const uniqueCustomerIds = [
        ...new Set(
          invoicesWithBalance
            .map((inv: Record<string, unknown>) => inv.customerId as string | null)
            .filter(Boolean),
        ),
      ] as string[];

      if (uniqueCustomerIds.length === 0) {
        logger.info(
          { jobId: job.id, companyId },
          'batch-statement-email: no customers with invoices in period — batch complete',
        );
        await notifyCompletion(prisma, emitter, logger, userId, 0, 0, job.id!);
        return;
      }

      // Step 2: Process each customer sequentially (concurrency: 1 to avoid overwhelming SMTP)
      let sentCount = 0;
      let failedCount = 0;
      const total = uniqueCustomerIds.length;

      for (let i = 0; i < uniqueCustomerIds.length; i++) {
        const customerId = uniqueCustomerIds[i]!;

        try {
          // Use the dedicated batch statement method which resolves customer
          // data directly, without requiring a pre-existing CustomerStatement record.
          await documentEmailService.sendBatchStatementForCustomer(
            { companyId, userId, tenantId },
            customerId,
          );
          sentCount++;
        } catch (err) {
          failedCount++;
          logger.warn(
            {
              jobId: job.id,
              customerId,
              error: err instanceof Error ? err.message : String(err),
            },
            'batch-statement-email: failed to send statement for customer — continuing batch',
          );
        }

        // Update job progress
        const progress = Math.round(((i + 1) / total) * 100);
        await job.updateProgress(progress);
      }

      logger.info(
        { jobId: job.id, companyId, sentCount, failedCount, total },
        'batch-statement-email: batch complete',
      );

      // Step 3: Notify the job creator with summary
      await notifyCompletion(prisma, emitter, logger, userId, sentCount, failedCount, job.id!);
    },
    {
      connection,
      concurrency: 1, // Process batches sequentially to avoid overwhelming SMTP
    },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job?.id }, 'batch-statement-email: job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'batch-statement-email: job failed');
  });

  return { worker };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an in-app notification for the batch job creator with a summary.
 */
async function notifyCompletion(
  prisma: PrismaClient,
  emitter: EventBus,
  log: Logger,
  userId: string,
  sentCount: number,
  failedCount: number,
  batchJobId: string,
): Promise<void> {
  const totalProcessed = sentCount + failedCount;
  const body =
    failedCount > 0
      ? `Batch statement emails complete: ${sentCount} sent, ${failedCount} failed out of ${totalProcessed} customers.`
      : totalProcessed === 0
        ? 'Batch statement emails complete: no customers found with outstanding balances for the selected period.'
        : `Batch statement emails complete: ${sentCount} statement${sentCount === 1 ? '' : 's'} sent successfully.`;

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title: 'Batch Statement Emails',
        body,
        priority: failedCount > 0 ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
        channel: NotificationChannel.IN_APP,
        entityType: 'BatchJob',
        entityId: batchJobId,
      },
      select: { id: true, userId: true, channel: true },
    });

    await enqueueNotificationDelivery(notification.id, NotificationChannel.IN_APP);

    emitter.emit('notification.sent', {
      notificationId: notification.id,
      userId: notification.userId,
      channel: notification.channel,
      templateEventName: 'batch.statement.complete',
    });
  } catch (err) {
    // Non-critical — log and continue
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'batch-statement-email: failed to create completion notification',
    );
  }
}
