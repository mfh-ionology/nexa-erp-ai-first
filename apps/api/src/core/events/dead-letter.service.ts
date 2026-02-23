// ---------------------------------------------------------------------------
// DeadLetterService — BullMQ-backed persistence for events that fail all retries
// E3-3 Task 5
// ---------------------------------------------------------------------------

import { Job, Queue, type ConnectionOptions } from 'bullmq';
import type { DeadLetterEntry } from './retry.types.js';

/** Shape of the data stored in each BullMQ job */
interface DeadLetterJobData {
  eventName: string;
  payload: unknown;
  error: string;
  stack?: string;
  retryCount: number;
  originalTimestamp: string;
  reprocessed: boolean;
  reprocessedAt?: string;
}

/** Options for listing dead-letter entries */
export interface DeadLetterListOptions {
  limit?: number;
  cursor?: string;
  eventName?: string;
  reprocessed?: boolean;
}

/** Paginated result from list() */
export interface DeadLetterListResult {
  items: DeadLetterEntry[];
  cursor: string | null;
  hasMore: boolean;
}

const QUEUE_NAME = 'event-dead-letter';

export class DeadLetterService {
  private readonly queue: Queue;
  private logger: { error: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void } | null =
    null;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: false, // Keep completed (reprocessed) jobs for audit
        removeOnFail: false,     // Keep failed jobs
        attempts: 1,             // No BullMQ-level retry; retry handled by EventBus
      },
    });
  }

  setLogger(
    logger: { error: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void } | null,
  ): void {
    this.logger = logger;
  }

  /**
   * Add a failed event to the dead-letter queue.
   *
   * Returns the BullMQ job ID. If Redis/BullMQ is unavailable, logs the error
   * but does NOT throw — the event bus must remain functional without Redis.
   */
  async add(
    entry: Omit<DeadLetterEntry, 'id' | 'createdAt' | 'reprocessed'>,
  ): Promise<string | null> {
    try {
      const jobData: DeadLetterJobData = {
        eventName: entry.eventName,
        payload: entry.payload,
        error: entry.error,
        stack: entry.stack,
        retryCount: entry.retryCount,
        originalTimestamp: entry.originalTimestamp,
        reprocessed: false,
      };

      const job = await this.queue.add('dead-letter', jobData);
      return job.id ?? null;
    } catch (err) {
      const log = this.logger ?? console;
      log.error(
        '[DeadLetterService] Failed to add entry to DLQ — Redis may be unavailable:',
        err,
      );
      return null;
    }
  }

  /**
   * List dead-letter entries with optional filtering and cursor pagination.
   *
   * Uses BullMQ Queue.getJobs() with status filters. Applies in-memory filtering
   * by eventName and reprocessed status — DLQ volume is expected to be low.
   * Cursor pagination uses BullMQ job IDs.
   */
  async list(opts: DeadLetterListOptions = {}): Promise<DeadLetterListResult> {
    const { limit = 20, cursor, eventName, reprocessed } = opts;

    try {
      // Fetch DLQ jobs with a cap to prevent unbounded memory usage.
      // In-memory filtering is applied after fetch, so we over-fetch relative
      // to the requested limit. If DLQ volume grows beyond this cap, consider
      // migrating to a Prisma model with indexed queries.
      const MAX_FETCH = 1000;
      const jobs = await this.queue.getJobs(['waiting', 'completed', 'failed'], 0, MAX_FETCH - 1);

      // Warn when the fetch cap is reached — entries beyond this limit are
      // silently excluded from results. Consider migrating to a Prisma model
      // with indexed queries if DLQ volume regularly exceeds this threshold.
      if (jobs.length >= MAX_FETCH) {
        const log = this.logger ?? console;
        (log.warn ?? log.error).call(
          log,
          `[DeadLetterService] DLQ contains ${String(jobs.length)}+ entries (cap: ${String(MAX_FETCH)}). ` +
            'Entries beyond this limit are not returned. Consider migrating to a Prisma-backed DLQ model.',
        );
      }

      // Sort by creation time descending (newest first)
      jobs.sort((a, b) => b.timestamp - a.timestamp);

      // Apply in-memory filters
      let filtered = jobs.filter((job): job is Job<DeadLetterJobData> => {
        const data = job.data as DeadLetterJobData;
        if (eventName !== undefined && data.eventName !== eventName) return false;
        if (reprocessed !== undefined && data.reprocessed !== reprocessed) return false;
        return true;
      });

      // Apply cursor: skip all items up to and including the cursor job ID
      if (cursor) {
        const cursorIndex = filtered.findIndex((job) => job.id === cursor);
        if (cursorIndex >= 0) {
          filtered = filtered.slice(cursorIndex + 1);
        }
      }

      // Paginate
      const page = filtered.slice(0, limit);
      const hasMore = filtered.length > limit;
      const lastJob = page[page.length - 1];
      const nextCursor = lastJob ? (lastJob.id ?? null) : null;

      const items: DeadLetterEntry[] = page.map((job) => this.jobToEntry(job));

      return { items, cursor: hasMore ? nextCursor : null, hasMore };
    } catch (err) {
      const log = this.logger ?? console;
      log.error('[DeadLetterService] Failed to list DLQ entries:', err);
      return { items: [], cursor: null, hasMore: false };
    }
  }

  /**
   * Get a single dead-letter entry by its BullMQ job ID.
   */
  async getById(id: string): Promise<DeadLetterEntry | null> {
    try {
      const job = await Job.fromId<DeadLetterJobData>(this.queue, id);
      if (!job) return null;
      return this.jobToEntry(job);
    } catch (err) {
      const log = this.logger ?? console;
      log.error(`[DeadLetterService] Failed to get DLQ entry "${id}":`, err);
      return null;
    }
  }

  /**
   * Mark a dead-letter entry as reprocessed with a timestamp.
   */
  async markReprocessed(id: string): Promise<void> {
    try {
      const job = await Job.fromId<DeadLetterJobData>(this.queue, id);
      if (!job) return;

      await job.updateData({
        ...job.data,
        reprocessed: true,
        reprocessedAt: new Date().toISOString(),
      });
    } catch (err) {
      const log = this.logger ?? console;
      log.error(`[DeadLetterService] Failed to mark DLQ entry "${id}" as reprocessed:`, err);
    }
  }

  /**
   * Gracefully close the BullMQ queue connection.
   *
   * Waits for BullMQ to finish initializing its internal connection before
   * closing. This prevents unhandled rejections from pending script-loading
   * promises when close() is called shortly after Queue construction.
   */
  async close(): Promise<void> {
    try {
      // Ensure BullMQ's internal connection is fully established before closing.
      // BullMQ loads Lua scripts asynchronously on Queue creation; closing before
      // that completes causes unhandled rejections from pending operations.
      await this.queue.client;
    } catch {
      // Connection never established — nothing to drain
    }
    try {
      await this.queue.close();
    } catch (err) {
      const log = this.logger ?? console;
      log.error('[DeadLetterService] Error closing BullMQ queue:', err);
    }
  }

  /** Convert a BullMQ Job to a DeadLetterEntry */
  private jobToEntry(job: Job<DeadLetterJobData>): DeadLetterEntry {
    const data = job.data;
    return {
      id: job.id ?? '',
      eventName: data.eventName,
      payload: data.payload,
      error: data.error,
      stack: data.stack,
      retryCount: data.retryCount,
      originalTimestamp: data.originalTimestamp,
      createdAt: new Date(job.timestamp).toISOString(),
      reprocessed: data.reprocessed,
      reprocessedAt: data.reprocessedAt,
    };
  }
}
