// ---------------------------------------------------------------------------
// AutomationSchedulerService — BullMQ-based cron scheduler for AI automations
// E5c-1 Task 6: AC #2 (Scheduled automation execution)
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import { CronExpressionParser } from 'cron-parser';
import type { AutomationExecutor } from './automation-executor.js';
import type { EventBus } from '../../core/events/event-bus.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Data carried by each automation scheduler job */
export interface AutomationJobData {
  automationId: string;
  companyId: string;
  cronExpression: string;
  timezone: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const QUEUE_NAME = 'automation-scheduler';
const DEFAULT_TIMEZONE = 'Europe/London';

// ─── AutomationSchedulerService ─────────────────────────────────────────────

export class AutomationSchedulerService {
  private queue: Queue<AutomationJobData> | null = null;
  private worker: Worker<AutomationJobData> | null = null;
  private started = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly automationExecutor: AutomationExecutor,
    private readonly logger: Logger,
    private readonly connection: ConnectionOptions,
    private readonly eventBus?: EventBus,
  ) {}

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Start the scheduler: create BullMQ queue + worker, load all active
   * unpaused schedules, and register repeatable jobs for each.
   */
  async start(): Promise<void> {
    if (this.started) {
      this.logger.warn('AutomationScheduler: already started');
      return;
    }

    // ── Queue ──────────────────────────────────────────────────────────
    this.queue = new Queue<AutomationJobData>(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 500, age: 7 * 24 * 3600 },
        attempts: 1, // Automations handle their own retries via circuit breaker
      },
    });

    // ── Worker ─────────────────────────────────────────────────────────
    this.worker = new Worker<AutomationJobData>(
      QUEUE_NAME,
      async (job: Job<AutomationJobData>) => {
        await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: 3, // Max 3 automations executing concurrently
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(
        { jobId: job?.id, automationId: job?.data.automationId },
        'AutomationScheduler: job completed',
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        { jobId: job?.id, automationId: job?.data.automationId, error: err.message },
        'AutomationScheduler: job failed',
      );
    });

    // ── Load and register all active schedules ─────────────────────────
    await this.refreshSchedules();

    this.started = true;
    this.logger.info('AutomationScheduler: started');
  }

  /**
   * Stop the scheduler: close worker and queue connections gracefully.
   */
  async stop(): Promise<void> {
    if (!this.started) return;

    try {
      if (this.worker) {
        await this.worker.close();
        this.worker = null;
      }
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'AutomationScheduler: error closing worker',
      );
    }

    try {
      if (this.queue) {
        await this.queue.close();
        this.queue = null;
      }
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'AutomationScheduler: error closing queue',
      );
    }

    this.started = false;
    this.logger.info('AutomationScheduler: stopped');
  }

  // ─── Schedule Management ──────────────────────────────────────────────

  /**
   * Reload all schedules from the database: remove all existing repeatable
   * jobs, then re-add active/unpaused ones.
   */
  async refreshSchedules(): Promise<void> {
    if (!this.queue) {
      this.logger.warn('AutomationScheduler: queue not initialised — call start() first');
      return;
    }

    // Remove all existing repeatable jobs to avoid stale schedules
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Load all active, unpaused schedules
    const schedules = await this.db.aiAutomationSchedule.findMany({
      where: {
        isPaused: false,
        automation: { isActive: true },
      },
      include: {
        automation: {
          select: { id: true, companyId: true },
        },
      },
    });

    let registered = 0;
    for (const schedule of schedules) {
      try {
        await this.registerRepeatableJob(
          schedule.automation.id,
          schedule.automation.companyId,
          schedule.cronExpression,
          schedule.timezone,
        );

        // Update nextRunAt
        const nextRunAt = this.calculateNextRunAt(schedule.cronExpression, schedule.timezone);
        if (nextRunAt) {
          await this.db.aiAutomationSchedule.update({
            where: { id: schedule.id },
            data: { nextRunAt },
          });
        }

        registered++;
      } catch (err) {
        this.logger.warn(
          {
            automationId: schedule.automation.id,
            cronExpression: schedule.cronExpression,
            error: (err as Error).message,
          },
          'AutomationScheduler: failed to register schedule',
        );
      }
    }

    this.logger.info(
      { totalSchedules: schedules.length, registered },
      'AutomationScheduler: schedules refreshed',
    );
  }

  /**
   * Add a schedule for a specific automation (called when a SCHEDULED
   * automation is created or reactivated).
   */
  async addSchedule(
    automationId: string,
    companyId: string,
    cronExpression: string,
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<void> {
    if (!this.queue) {
      this.logger.warn('AutomationScheduler: queue not initialised — call start() first');
      return;
    }

    await this.registerRepeatableJob(automationId, companyId, cronExpression, timezone);

    this.logger.info(
      { automationId, cronExpression, timezone },
      'AutomationScheduler: schedule added',
    );
  }

  /**
   * Remove a schedule for a specific automation (called when automation is
   * deactivated, schedule paused, or automation deleted).
   */
  async removeSchedule(automationId: string): Promise<void> {
    if (!this.queue) return;

    const repeatableJobs = await this.queue.getRepeatableJobs();
    const matching = repeatableJobs.filter((j) => j.name === this.jobName(automationId));

    for (const job of matching) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    if (matching.length > 0) {
      this.logger.info(
        { automationId, removedCount: matching.length },
        'AutomationScheduler: schedule removed',
      );
    }
  }

  /**
   * Update a schedule: remove the old repeatable job and add a new one.
   * Called when an automation's cron expression or timezone changes.
   */
  async updateSchedule(
    automationId: string,
    companyId: string,
    cronExpression: string,
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<void> {
    await this.removeSchedule(automationId);
    await this.addSchedule(automationId, companyId, cronExpression, timezone);
  }

  // ─── Job Processor ──────────────────────────────────────────────────────

  /**
   * Process a single automation scheduler job.
   * Executes the automation and updates lastRunAt / nextRunAt.
   */
  private async processJob(job: Job<AutomationJobData>): Promise<void> {
    const { automationId, cronExpression, timezone } = job.data;

    this.logger.info(
      { automationId, cronExpression },
      'AutomationScheduler: executing scheduled automation',
    );

    try {
      // Execute the automation via the executor
      await this.automationExecutor.execute({
        automationId,
        triggeredBy: 'scheduler',
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      this.logger.error(
        { automationId, error: errorMessage },
        'AutomationScheduler: automation execution failed',
      );

      // Record a FAILED run so the circuit breaker can count it
      const failedRunId = randomUUID();
      try {
        await this.db.aiAutomationRun.create({
          data: {
            id: failedRunId,
            automationId,
            triggeredBy: 'scheduler',
            status: 'FAILED',
            error: `Scheduler execution error: ${errorMessage}`,
            completedAt: new Date(),
          },
        });

        // Emit failed event so circuit breaker is notified
        if (this.eventBus) {
          this.eventBus.emit('ai.automation.failed', {
            automationId,
            companyId: job.data.companyId,
            runId: failedRunId,
            error: errorMessage,
          });
        }
      } catch (dbErr) {
        this.logger.warn(
          { automationId, error: (dbErr as Error).message },
          'AutomationScheduler: failed to record error run',
        );
      }
    }

    // Update lastRunAt and nextRunAt regardless of execution outcome
    // (circuit breaker handles consecutive failures separately)
    try {
      const now = new Date();
      const nextRunAt = this.calculateNextRunAt(cronExpression, timezone);

      await this.db.aiAutomationSchedule.update({
        where: { automationId },
        data: {
          lastRunAt: now,
          ...(nextRunAt ? { nextRunAt } : {}),
        },
      });
    } catch (err) {
      this.logger.warn(
        { automationId, error: (err as Error).message },
        'AutomationScheduler: failed to update schedule timestamps',
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Register a BullMQ repeatable job for an automation.
   */
  private async registerRepeatableJob(
    automationId: string,
    companyId: string,
    cronExpression: string,
    timezone: string,
  ): Promise<void> {
    if (!this.queue) return;

    await this.queue.add(
      this.jobName(automationId),
      {
        automationId,
        companyId,
        cronExpression,
        timezone,
      },
      {
        repeat: {
          pattern: cronExpression,
          tz: timezone,
        },
        jobId: `automation-${automationId}`,
      },
    );
  }

  /**
   * Calculate the next run time for a cron expression in the given timezone.
   * Returns null if the expression cannot be parsed.
   */
  private calculateNextRunAt(cronExpression: string, timezone: string): Date | null {
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: timezone,
        currentDate: new Date(),
      });
      return interval.next().toDate();
    } catch (err) {
      this.logger.warn(
        { cronExpression, timezone, error: (err as Error).message },
        'AutomationScheduler: failed to parse cron expression',
      );
      return null;
    }
  }

  /**
   * Generate a consistent job name for an automation's repeatable job.
   */
  private jobName(automationId: string): string {
    return `automation-run-${automationId}`;
  }
}
