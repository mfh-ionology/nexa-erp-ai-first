// ---------------------------------------------------------------------------
// BriefingScheduler — BullMQ scheduled job for pre-generating daily briefings
// E5-5 Task 6
// ---------------------------------------------------------------------------

import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { BriefingEngine } from './briefing-engine.js';

// ─── Types ────────────────────────────────────────────────────────────────

/** Data carried by each briefing pre-generation job */
export interface BriefingJobData {
  userId: string;
  companyId: string;
  tenantId: string;
  scheduledAt: string;
}

/** Stats returned after a batch pre-generation run */
export interface BriefingBatchResult {
  totalUsers: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const QUEUE_NAME = 'briefing-generation';
const REPEATABLE_JOB_NAME = 'daily-briefing-pregen';
const TRIGGER_JOB_NAME = 'briefing-trigger';

// ─── BriefingScheduler ───────────────────────────────────────────────────

export class BriefingScheduler {
  private readonly queue: Queue;
  private readonly worker: Worker<BriefingJobData>;
  private readonly tenantId: string;

  constructor(
    private readonly briefingEngine: BriefingEngine,
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    connection: ConnectionOptions,
    opts: {
      cronExpression?: string;
      concurrency?: number;
      tenantId: string;
    },
  ) {
    this.tenantId = opts.tenantId;

    const cronExpression = opts.cronExpression ?? '0 6 * * *';
    const concurrency = opts.concurrency ?? 5;

    // ── Queue ──────────────────────────────────────────────────────────
    this.queue = new Queue<BriefingJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 1000, age: 7 * 24 * 3600 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    });

    // ── Worker ─────────────────────────────────────────────────────────
    this.worker = new Worker<BriefingJobData>(
      QUEUE_NAME,
      async (job: Job<BriefingJobData>) => {
        if (job.name === TRIGGER_JOB_NAME) {
          await this.enqueueAllUsers();
        } else {
          await this.processJob(job);
        }
      },
      {
        connection,
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(
        { jobId: job?.id, userId: job?.data.userId },
        'BriefingScheduler: job completed',
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        { jobId: job?.id, userId: job?.data.userId, error: err.message },
        'BriefingScheduler: job failed',
      );
    });

    // ── Schedule repeatable job ────────────────────────────────────────
    void this.scheduleRepeatable(cronExpression);
  }

  // ─── Job Processor ──────────────────────────────────────────────────────

  /**
   * Process a single briefing pre-generation job.
   * Calls BriefingEngine.generateBriefing() which handles caching internally.
   */
  private async processJob(job: Job<BriefingJobData>): Promise<void> {
    const { userId, companyId, tenantId } = job.data;

    this.logger.debug(
      { userId, companyId, tenantId },
      'BriefingScheduler: generating briefing for user',
    );

    // forceRefresh=true to ensure fresh data is generated and cached
    await this.briefingEngine.generateBriefing(userId, companyId, tenantId, true);
  }

  // ─── Batch Pre-generation ──────────────────────────────────────────────

  /**
   * Enqueue briefing generation jobs for all active users.
   * Called by the repeatable job and can also be invoked manually.
   *
   * Each user gets their own job so that one user's failure doesn't block others.
   */
  async enqueueAllUsers(): Promise<BriefingBatchResult> {
    const startTime = Date.now();
    let totalUsers = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      // Query active users scoped to this tenant's companies
      const companies = await this.db.companyProfile.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      const companyIds = companies.map((c: { id: string }) => c.id);

      const users = await this.db.user.findMany({
        where: { isActive: true, companyId: { in: companyIds } },
        select: { id: true, companyId: true },
      });

      totalUsers = users.length;

      if (totalUsers === 0) {
        this.logger.info('BriefingScheduler: no active users found — skipping pre-generation');
        return { totalUsers: 0, succeeded: 0, failed: 0, durationMs: Date.now() - startTime };
      }

      this.logger.info(
        { totalUsers },
        'BriefingScheduler: enqueuing briefing pre-generation for active users',
      );

      for (const user of users) {
        try {
          const jobData: BriefingJobData = {
            userId: user.id,
            companyId: user.companyId,
            tenantId: this.tenantId,
            scheduledAt: new Date().toISOString(),
          };

          await this.queue.add(REPEATABLE_JOB_NAME, jobData, {
            jobId: `briefing-${this.tenantId}-${user.id}-${new Date().toISOString().slice(0, 10)}`,
          });

          succeeded++;
        } catch (err) {
          failed++;
          this.logger.warn(
            { userId: user.id, companyId: user.companyId, error: (err as Error).message },
            'BriefingScheduler: failed to enqueue briefing job for user',
          );
        }
      }
    } catch (err) {
      this.logger.error(
        { error: (err as Error).message },
        'BriefingScheduler: failed to query active users for batch pre-generation',
      );
    }

    const durationMs = Date.now() - startTime;

    this.logger.info(
      { totalUsers, succeeded, failed, durationMs },
      'BriefingScheduler: batch pre-generation enqueue complete',
    );

    return { totalUsers, succeeded, failed, durationMs };
  }

  // ─── Schedule Management ───────────────────────────────────────────────

  /**
   * Set up the repeatable cron job for daily briefing pre-generation.
   * The repeatable job triggers enqueueAllUsers() on schedule.
   */
  private async scheduleRepeatable(cronExpression: string): Promise<void> {
    try {
      // Remove any existing repeatable jobs to avoid duplicates
      const existing = await this.queue.getRepeatableJobs();
      for (const job of existing) {
        await this.queue.removeRepeatableByKey(job.key);
      }

      // Add the repeatable trigger job
      await this.queue.add(
        'briefing-trigger',
        {
          userId: '',
          companyId: '',
          tenantId: this.tenantId,
          scheduledAt: new Date().toISOString(),
        },
        {
          repeat: { pattern: cronExpression },
          jobId: `briefing-trigger-${this.tenantId}`,
        },
      );

      this.logger.info(
        { cronExpression, queueName: QUEUE_NAME },
        'BriefingScheduler: repeatable job scheduled',
      );
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'BriefingScheduler: failed to schedule repeatable job — briefings will only generate on-demand',
      );
    }
  }

  /**
   * Get the configured cron expression for the repeatable job.
   */
  async getSchedule(): Promise<string | null> {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      return jobs[0]?.pattern ?? null;
    } catch {
      return null;
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Gracefully close queue and worker connections.
   */
  async close(): Promise<void> {
    try {
      await this.worker.close();
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'BriefingScheduler: error closing worker',
      );
    }
    try {
      await this.queue.client;
    } catch {
      // Connection never established
    }
    try {
      await this.queue.close();
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'BriefingScheduler: error closing queue',
      );
    }
  }
}
