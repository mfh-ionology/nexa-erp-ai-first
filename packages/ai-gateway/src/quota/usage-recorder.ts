import type { Logger } from 'pino';
import type { UsageRecord } from '../types/index.js';

// ─── In-Memory Retry Queue ──────────────────────────────────────────────────
// Fallback when Redis/BullMQ is unavailable.

interface InMemoryJob {
  data: UsageRecord;
  attempt: number;
  nextRetryAt: number;
}

class InMemoryRetryQueue {
  private readonly queue: InMemoryJob[] = [];
  private readonly deadLetter: InMemoryJob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly maxRetries: number;
  private readonly maxDeadLetterSize: number;
  private readonly logger?: Logger;
  private processFn?: (data: UsageRecord) => Promise<void>;

  constructor(opts: { maxRetries: number; maxDeadLetterSize?: number; logger?: Logger }) {
    this.maxRetries = opts.maxRetries;
    this.maxDeadLetterSize = opts.maxDeadLetterSize ?? 1000;
    this.logger = opts.logger;
  }

  /** Register the processing function for retries. */
  setProcessor(fn: (data: UsageRecord) => Promise<void>): void {
    this.processFn = fn;
  }

  /** Enqueue a failed record for retry. */
  add(data: UsageRecord, attempt: number): void {
    const delay = this.backoffMs(attempt);
    this.queue.push({
      data,
      attempt,
      nextRetryAt: Date.now() + delay,
    });
    this.ensureTimer();
  }

  /** Get pending queue length. */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Get dead letter queue length. */
  get deadLetterCount(): number {
    return this.deadLetter.length;
  }

  /** Get dead letter queue items (for inspection/admin). */
  getDeadLetterItems(): UsageRecord[] {
    return this.deadLetter.map((j) => j.data);
  }

  /** Process all ready jobs. */
  async processReady(): Promise<void> {
    if (!this.processFn) return;

    const now = Date.now();
    const ready = this.queue.filter((j) => j.nextRetryAt <= now);
    // Remove ready jobs from queue
    for (const job of ready) {
      const idx = this.queue.indexOf(job);
      if (idx !== -1) this.queue.splice(idx, 1);
    }

    for (const job of ready) {
      try {
        await this.processFn(job.data);
        this.logger?.debug(
          { requestId: job.data.requestId, attempt: job.attempt },
          'UsageRecorder: retry succeeded (in-memory)',
        );
      } catch {
        if (job.attempt >= this.maxRetries) {
          this.logger?.error(
            { requestId: job.data.requestId, attempt: job.attempt },
            'UsageRecorder: max retries exceeded, moving to dead letter queue (in-memory)',
          );
          if (this.deadLetter.length >= this.maxDeadLetterSize) {
            this.logger?.warn(
              { maxDeadLetterSize: this.maxDeadLetterSize },
              'UsageRecorder: dead letter queue at capacity, dropping oldest entry',
            );
            this.deadLetter.shift();
          }
          this.deadLetter.push(job);
        } else {
          this.add(job.data, job.attempt + 1);
        }
      }
    }

    if (this.queue.length === 0) {
      this.stopTimer();
    }
  }

  /** Stop the retry timer. */
  close(): void {
    this.stopTimer();
  }

  /** Exponential backoff: 1s, 2s, 4s, 8s, 16s capped. */
  private backoffMs(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt - 1), 16_000);
  }

  private ensureTimer(): void {
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.processReady();
      }, 1000);
      // Allow Node.js process to exit even if timer is running
      if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
        this.timer.unref();
      }
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ─── BullMQ Retry Queue ─────────────────────────────────────────────────────

interface BullMQRetryQueue {
  queue: import('bullmq').Queue;
  worker: import('bullmq').Worker;
  close(): Promise<void>;
}

async function createBullMQRetryQueue(opts: {
  redisUrl: string;
  maxRetries: number;
  logger?: Logger;
  processFn: (data: UsageRecord) => Promise<void>;
}): Promise<BullMQRetryQueue> {
  const { Queue, Worker } = await import('bullmq');
  const IORedis = (await import('ioredis')).default;

  const queueConnection = new IORedis(opts.redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
  const workerConnection = new IORedis(opts.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const queueName = 'ai-usage-recording';

  const queue = new Queue(queueName, {
    connection: queueConnection as unknown as import('bullmq').ConnectionOptions,
    defaultJobOptions: {
      attempts: opts.maxRetries,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s base → 1s, 2s, 4s, 8s, 16s...
      },
      removeOnComplete: true,
      removeOnFail: { count: 1000, age: 7 * 24 * 3600 }, // Keep max 1000 failed jobs for 7 days
    },
  });

  const worker = new Worker(
    queueName,
    async (job) => {
      opts.logger?.debug(
        { requestId: job.data.requestId, attempt: job.attemptsMade + 1 },
        'UsageRecorder: processing retry (BullMQ)',
      );
      await opts.processFn(job.data as UsageRecord);
    },
    {
      connection: workerConnection as unknown as import('bullmq').ConnectionOptions,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    opts.logger?.debug(
      { requestId: job?.data?.requestId },
      'UsageRecorder: retry succeeded (BullMQ)',
    );
  });

  worker.on('failed', (job, err) => {
    if (job && job.attemptsMade >= opts.maxRetries) {
      opts.logger?.error(
        { requestId: job.data?.requestId, error: err.message, attempts: job.attemptsMade },
        'UsageRecorder: max retries exceeded, job moved to dead letter (BullMQ)',
      );
    } else {
      opts.logger?.warn(
        { requestId: job?.data?.requestId, error: err.message, attempt: job?.attemptsMade },
        'UsageRecorder: retry failed, will retry again (BullMQ)',
      );
    }
  });

  return {
    queue,
    worker,
    async close() {
      await worker.close();
      await queue.close();
      await queueConnection.quit();
      await workerConnection.quit();
    },
  };
}

// ─── UsageRecorder ──────────────────────────────────────────────────────────

export interface UsageRecorderConfig {
  /** Platform API base URL (e.g. http://localhost:3001/api/v1). */
  platformApiUrl: string;
  /** Service token for Platform API authentication. */
  serviceToken: string;
  /** Logger instance. */
  logger?: Logger;
  /** Redis URL for BullMQ durable retry queue. If omitted, uses in-memory fallback. */
  redisUrl?: string;
  /** Maximum retry attempts before dead letter queue. Default: 10. */
  maxRetries?: number;
}

/**
 * UsageRecorder — fire-and-forget AI usage recording with durable retry queue.
 *
 * Calls `POST /platform/tenants/:id/ai/record` to record AI usage.
 * On failure, enqueues to a BullMQ retry queue (Redis-backed) or falls back
 * to an in-memory queue if Redis is unavailable.
 *
 * Zero-loss guarantee: every call is eventually recorded (BR-PLT-009, NFR50).
 *
 * The `record()` method is fire-and-forget — it NEVER throws.
 */
export class UsageRecorder {
  private readonly platformApiUrl: string;
  private readonly serviceToken: string;
  private readonly logger?: Logger;
  private readonly maxRetries: number;

  private bullmqQueue?: BullMQRetryQueue;
  private bullmqInitializing = false;
  private inMemoryQueue: InMemoryRetryQueue;

  constructor(config: UsageRecorderConfig) {
    this.platformApiUrl = config.platformApiUrl.replace(/\/$/, '');
    this.serviceToken = config.serviceToken;
    this.logger = config.logger;
    this.maxRetries = config.maxRetries ?? 10;

    // Always create in-memory queue as fallback
    this.inMemoryQueue = new InMemoryRetryQueue({
      maxRetries: this.maxRetries,
      logger: config.logger,
    });

    this.inMemoryQueue.setProcessor((data) => this.sendToApi(data));

    // ISSUE #17 FIX: Track BullMQ initialisation state so we can warn about
    // records arriving before the durable queue is ready (they use in-memory fallback)
    if (config.redisUrl) {
      this.bullmqInitializing = true;
      void this.initBullMQ(config.redisUrl).finally(() => {
        this.bullmqInitializing = false;
      });
    } else {
      this.logger?.warn(
        'UsageRecorder: no Redis URL provided, using in-memory retry queue (not durable across restarts)',
      );
    }
  }

  /**
   * Record AI usage — fire-and-forget.
   *
   * This method NEVER throws. On failure, the record is enqueued
   * for retry via BullMQ (durable) or in-memory queue (fallback).
   */
  record(data: UsageRecord): void {
    // Fire-and-forget — no await, catch all errors
    void this.recordAsync(data).catch((err) => {
      this.logger?.error(
        { requestId: data.requestId, error: (err as Error).message },
        'UsageRecorder: unexpected error in record() — should not happen',
      );
    });
  }

  /** Close the recorder, draining any pending retries. */
  async close(): Promise<void> {
    this.inMemoryQueue.close();
    if (this.bullmqQueue) {
      await this.bullmqQueue.close();
    }
  }

  /** Get pending in-memory retry count (for monitoring/testing). */
  get pendingInMemoryCount(): number {
    return this.inMemoryQueue.pendingCount;
  }

  /** Get dead letter count from in-memory queue (for monitoring/testing). */
  get deadLetterCount(): number {
    return this.inMemoryQueue.deadLetterCount;
  }

  /** Get dead letter items (for admin inspection). */
  getDeadLetterItems(): UsageRecord[] {
    return this.inMemoryQueue.getDeadLetterItems();
  }

  /** Whether BullMQ (durable) queue is active. */
  get isDurable(): boolean {
    return !!this.bullmqQueue;
  }

  /** Exposed for testing — process ready in-memory retries. */
  async processInMemoryRetries(): Promise<void> {
    await this.inMemoryQueue.processReady();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async recordAsync(data: UsageRecord): Promise<void> {
    try {
      await this.sendToApi(data);
    } catch (err) {
      // ISSUE #18 FIX: Don't retry 4xx errors — they'll never succeed
      if ((err as Error & { nonRetryable?: boolean }).nonRetryable) {
        this.logger?.error(
          { requestId: data.requestId, error: (err as Error).message },
          'UsageRecorder: non-retryable error, moving to dead letter immediately',
        );
        return;
      }
      // Primary send failed — enqueue for retry
      this.enqueueForRetry(data);
    }
  }

  /** HTTP POST to Platform API /ai/record endpoint. */
  private async sendToApi(data: UsageRecord): Promise<void> {
    const url = `${this.platformApiUrl}/platform/tenants/${data.tenantId}/ai/record`;

    this.logger?.debug(
      { requestId: data.requestId, tenantId: data.tenantId, url },
      'UsageRecorder: sending usage record',
    );

    // ISSUE #10 FIX: Add timeout via AbortSignal to prevent indefinite hangs
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.serviceToken}`,
      },
      body: JSON.stringify({
        userId: data.userId,
        featureKey: data.featureKey,
        provider: data.provider,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        costEstimate: data.costEstimate,
        requestId: data.requestId,
        isByok: data.isByok,
        latencyMs: data.latencyMs,
        fallbackUsed: data.fallbackUsed,
        fallbackFrom: data.fallbackFrom,
      }),
      signal: AbortSignal.timeout(10_000), // 10s timeout for usage recording
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const statusCode = response.status;
      // ISSUE #18 FIX: Don't retry 4xx client errors (they'll never succeed)
      // Throw a specific error so enqueueForRetry can detect it
      if (statusCode >= 400 && statusCode < 500) {
        const err = new Error(`Platform API returned ${statusCode}: ${body}`);
        (err as Error & { nonRetryable: boolean }).nonRetryable = true;
        throw err;
      }
      throw new Error(`Platform API returned ${statusCode}: ${body}`);
    }

    this.logger?.debug(
      { requestId: data.requestId },
      'UsageRecorder: usage record sent successfully',
    );
  }

  /** Enqueue a failed record for retry via BullMQ or in-memory fallback. */
  private enqueueForRetry(data: UsageRecord): void {
    this.logger?.warn(
      { requestId: data.requestId },
      'UsageRecorder: recording failed, enqueueing for retry',
    );

    if (this.bullmqInitializing) {
      this.logger?.warn(
        { requestId: data.requestId },
        'UsageRecorder: BullMQ still initializing, using in-memory queue (not durable)',
      );
    }

    if (this.bullmqQueue) {
      // Use durable BullMQ queue
      void this.bullmqQueue.queue
        .add('record', data, { jobId: data.requestId })
        .catch((err) => {
          this.logger?.error(
            { requestId: data.requestId, error: (err as Error).message },
            'UsageRecorder: BullMQ enqueue failed, falling back to in-memory',
          );
          this.inMemoryQueue.add(data, 1);
        });
    } else {
      // Fallback to in-memory queue
      this.inMemoryQueue.add(data, 1);
    }
  }

  /** Initialize BullMQ durable queue. Falls back to in-memory on failure. */
  private async initBullMQ(redisUrl: string): Promise<void> {
    try {
      this.bullmqQueue = await createBullMQRetryQueue({
        redisUrl,
        maxRetries: this.maxRetries,
        logger: this.logger,
        processFn: (data) => this.sendToApi(data),
      });

      this.logger?.info('UsageRecorder: BullMQ durable retry queue initialized');
    } catch (err) {
      this.logger?.warn(
        { error: (err as Error).message },
        'UsageRecorder: BullMQ initialization failed, using in-memory retry queue',
      );
    }
  }
}
