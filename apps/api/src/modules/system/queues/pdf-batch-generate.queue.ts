// ---------------------------------------------------------------------------
// PDF Batch Generate Queue — BullMQ queue for async batch PDF generation
// E12-1 Task 7.1
// ---------------------------------------------------------------------------

import { Queue, type ConnectionOptions } from 'bullmq';
import type { DocumentType } from '@nexa/db';

/** Job data shape for the pdf-batch-generate queue */
export interface PdfBatchJobData {
  batchId: string;
  companyId: string;
  documentType: DocumentType;
  recordIds: string[];
  userId: string;
}

export const PDF_BATCH_GENERATE_QUEUE_NAME = 'pdf-batch-generate';

type MinimalLogger = { warn: (...args: unknown[]) => void };

let queue: Queue<PdfBatchJobData> | null = null;
let moduleLogger: MinimalLogger = console;

/**
 * Initialise the BullMQ queue for batch PDF generation.
 *
 * Called once during Fastify startup. Uses ConnectionOptions (not an ioredis
 * instance) so BullMQ manages its own connection lifecycle.
 */
export function initPdfBatchQueue(
  connection: ConnectionOptions,
  logger?: MinimalLogger,
): Queue<PdfBatchJobData> {
  if (logger) moduleLogger = logger;
  queue = new Queue<PdfBatchJobData>(PDF_BATCH_GENERATE_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 200, age: 7 * 24 * 3600 }, // retain last 200 for 7 days
      removeOnFail: { count: 100, age: 14 * 24 * 3600 }, // keep last 100 failures for 14 days
      attempts: 1, // No retries — individual record failures handled within the job
    },
  });
  // Prevent unhandled 'error' events from crashing the process if Redis disconnects
  queue.on('error', (err) => {
    moduleLogger.warn(`[pdf-batch-generate] Queue error: ${err.message}`);
  });
  return queue;
}

/**
 * Enqueue a batch PDF generation job.
 *
 * Called from the batch-generate route handler after validation.
 * If the queue is not initialised (Redis unavailable), logs a warning and
 * returns without throwing.
 */
export async function enqueuePdfBatch(data: PdfBatchJobData): Promise<void> {
  if (!queue) {
    throw new Error(
      `[pdf-batch-generate] Queue not initialised — cannot enqueue batch ${data.batchId}`,
    );
  }

  await queue.add('batch-generate', data, {
    jobId: `pdf-batch-${data.batchId}`,
  });
}

/**
 * Return the queue instance (for job lookups and closing during shutdown).
 */
export function getPdfBatchQueue(): Queue<PdfBatchJobData> | null {
  return queue;
}
