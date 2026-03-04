// ---------------------------------------------------------------------------
// Batch Statement Email Service — E10-3 Task 4
// Triggers batch emailing of customer statements for a date range.
// Uses BullMQ for async processing to avoid blocking the API.
// ---------------------------------------------------------------------------

import { Queue, type ConnectionOptions } from 'bullmq';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export interface BatchStatementInput {
  dateRange: { from: string; to: string };
  customerIds?: string[];
  customerCategoryIds?: string[];
}

export interface BatchStatementJobData {
  companyId: string;
  userId: string;
  tenantId?: string;
  input: BatchStatementInput;
}

export const BATCH_STATEMENT_QUEUE_NAME = 'batch-statement-email';

// ---------------------------------------------------------------------------
// BatchStatementEmailService (subtasks 4.1, 4.2)
// ---------------------------------------------------------------------------

export class BatchStatementEmailService {
  private queue: Queue<BatchStatementJobData> | null = null;

  constructor(private readonly logger: Logger) {}

  /**
   * Initialise the BullMQ queue for batch statement emails.
   * Called once during Fastify startup.
   */
  initQueue(connection: ConnectionOptions): Queue<BatchStatementJobData> {
    this.queue = new Queue<BatchStatementJobData>(BATCH_STATEMENT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100, age: 7 * 24 * 3600 },
        removeOnFail: { count: 50, age: 14 * 24 * 3600 },
        attempts: 1, // batch jobs are not retried — individual emails retry via email-send queue
      },
    });
    return this.queue;
  }

  /**
   * Get the queue instance (for closing during shutdown).
   */
  getQueue(): Queue<BatchStatementJobData> | null {
    return this.queue;
  }

  /**
   * Trigger a batch statement email job (subtask 4.2).
   *
   * Creates a BullMQ job that will:
   * 1. Query customers with non-zero AR balance for the period
   * 2. For each customer: generate statement + email via DocumentEmailService
   * 3. Track progress and emit completion notification
   *
   * Returns the BullMQ job ID for progress tracking.
   */
  async triggerBatchStatementEmail(
    ctx: { companyId: string; userId: string; tenantId?: string },
    input: BatchStatementInput,
  ): Promise<{ batchJobId: string }> {
    if (!this.queue) {
      this.logger.warn('batch-statement-email: Queue not initialised — cannot trigger batch');
      throw new Error('Batch statement email queue is not available. Ensure Redis is configured.');
    }

    const jobData: BatchStatementJobData = {
      companyId: ctx.companyId,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      input,
    };

    const job = await this.queue.add('batch-statement', jobData, {
      jobId: `batch-stmt-${ctx.companyId}-${Date.now()}`,
    });

    this.logger.info(
      {
        batchJobId: job.id,
        companyId: ctx.companyId,
        dateRange: input.dateRange,
        customerIds: input.customerIds?.length ?? 'all',
      },
      'batch statement email job created',
    );

    return { batchJobId: job.id! };
  }
}
