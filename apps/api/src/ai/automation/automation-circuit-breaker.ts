// ---------------------------------------------------------------------------
// AutomationCircuitBreaker — Auto-pauses automations after consecutive failures
// E5c-1 Task 9: AC #19 (Circuit breaker — 3 consecutive failures → auto-pause)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../../core/events/event-bus.js';
import type { BusinessEvents, EventHandler } from '../../core/events/event-bus.types.js';
import type { AutomationSchedulerService } from './automation-scheduler.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Number of consecutive failures before the circuit breaker trips */
const FAILURE_THRESHOLD = 3;

// ─── AutomationCircuitBreaker ───────────────────────────────────────────────

export class AutomationCircuitBreaker {
  /** In-memory consecutive failure count per automationId */
  private failureCounts = new Map<string, number>();
  private started = false;

  /** Stored handler references for cleanup (off()) */
  private failedHandler: EventHandler<'ai.automation.failed'> | null = null;
  private completedHandler: EventHandler<'ai.automation.completed'> | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly eventBus: EventBus,
    private readonly scheduler: AutomationSchedulerService | null,
    private readonly logger: Logger,
  ) {}

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Start the circuit breaker: rehydrate failure counts from DB, then
   * subscribe to failure and success events.
   */
  async start(): Promise<void> {
    if (this.started) {
      this.logger.warn('AutomationCircuitBreaker: already started');
      return;
    }

    // Rehydrate consecutive failure counts from DB so state survives restarts.
    // For each active automation, count trailing consecutive FAILED runs.
    await this.rehydrateFailureCounts();

    // Subscribe to ai.automation.failed
    this.failedHandler = (data: BusinessEvents['ai.automation.failed']) => {
      void this.onAutomationFailed(data);
    };
    this.eventBus.on('ai.automation.failed', this.failedHandler);

    // Subscribe to ai.automation.completed
    this.completedHandler = (data: BusinessEvents['ai.automation.completed']) => {
      this.onAutomationCompleted(data);
    };
    this.eventBus.on('ai.automation.completed', this.completedHandler);

    this.started = true;
    this.logger.info('AutomationCircuitBreaker: started');
  }

  /**
   * Stop the circuit breaker: unsubscribe from events and clear state.
   */
  stop(): void {
    if (!this.started) return;

    if (this.failedHandler) {
      this.eventBus.off('ai.automation.failed', this.failedHandler);
      this.failedHandler = null;
    }

    if (this.completedHandler) {
      this.eventBus.off('ai.automation.completed', this.completedHandler);
      this.completedHandler = null;
    }

    this.failureCounts.clear();
    this.started = false;
    this.logger.info('AutomationCircuitBreaker: stopped');
  }

  // ─── Event Handlers ────────────────────────────────────────────────────

  /**
   * Handle an automation failure event.
   * Increments the consecutive failure counter for the automation.
   * When the counter reaches FAILURE_THRESHOLD (3):
   *   1. Pauses the schedule (isPaused = true)
   *   2. Deactivates the automation (isActive = false)
   *   3. Emits ai.automation.paused event
   *   4. Removes the schedule from BullMQ
   */
  private async onAutomationFailed(data: BusinessEvents['ai.automation.failed']): Promise<void> {
    const { automationId, companyId } = data;
    const count = (this.failureCounts.get(automationId) ?? 0) + 1;
    this.failureCounts.set(automationId, count);

    this.logger.warn(
      { automationId, consecutiveFailures: count, threshold: FAILURE_THRESHOLD },
      'AutomationCircuitBreaker: failure recorded',
    );

    if (count < FAILURE_THRESHOLD) {
      return;
    }

    // ── Circuit breaker trips ──
    this.logger.error(
      { automationId, companyId, consecutiveFailures: count },
      'AutomationCircuitBreaker: threshold reached — pausing automation',
    );

    try {
      // 1. Pause the schedule
      await this.db.aiAutomationSchedule.updateMany({
        where: { automationId },
        data: { isPaused: true },
      });

      // 2. Deactivate the automation
      await this.db.aiAutomation.update({
        where: { id: automationId },
        data: { isActive: false },
      });

      // 3. Emit ai.automation.paused event
      this.eventBus.emit('ai.automation.paused', {
        automationId,
        companyId,
        consecutiveFailures: count,
      });

      // 4. Remove schedule from BullMQ
      if (this.scheduler) {
        await this.scheduler.removeSchedule(automationId);
      }

      // Reset counter after tripping (automation is now paused, no further runs expected)
      this.failureCounts.delete(automationId);

      this.logger.info(
        { automationId, companyId },
        'AutomationCircuitBreaker: automation paused and schedule removed',
      );
    } catch (err) {
      this.logger.error(
        { automationId, error: (err as Error).message },
        'AutomationCircuitBreaker: failed to pause automation',
      );
    }
  }

  /**
   * Handle an automation success event.
   * Resets the consecutive failure counter for the automation to 0.
   */
  private onAutomationCompleted(data: BusinessEvents['ai.automation.completed']): void {
    const { automationId } = data;

    if (this.failureCounts.has(automationId)) {
      this.logger.debug(
        { automationId, previousFailures: this.failureCounts.get(automationId) },
        'AutomationCircuitBreaker: resetting failure counter on success',
      );
      this.failureCounts.delete(automationId);
    }
  }

  // ─── DB Rehydration ────────────────────────────────────────────────────

  /**
   * Rehydrate failure counts from the database on startup.
   * For each active automation, count trailing consecutive FAILED runs
   * (most recent runs until a non-FAILED run is found).
   */
  private async rehydrateFailureCounts(): Promise<void> {
    try {
      const activeAutomations = await this.db.aiAutomation.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const automation of activeAutomations) {
        const recentRuns = await this.db.aiAutomationRun.findMany({
          where: { automationId: automation.id },
          orderBy: { createdAt: 'desc' },
          take: FAILURE_THRESHOLD,
          select: { status: true },
        });

        let consecutiveFailures = 0;
        for (const run of recentRuns) {
          if (run.status === 'FAILED') {
            consecutiveFailures++;
          } else {
            break;
          }
        }

        if (consecutiveFailures > 0) {
          this.failureCounts.set(automation.id, consecutiveFailures);
        }
      }

      this.logger.info(
        { rehydratedCount: this.failureCounts.size },
        'AutomationCircuitBreaker: rehydrated failure counts from DB',
      );
    } catch (err) {
      this.logger.error(
        { error: (err as Error).message },
        'AutomationCircuitBreaker: failed to rehydrate failure counts',
      );
    }
  }

  // ─── Inspection (for testing) ──────────────────────────────────────────

  /**
   * Get the current consecutive failure count for an automation.
   * Returns 0 if no failures recorded.
   */
  getFailureCount(automationId: string): number {
    return this.failureCounts.get(automationId) ?? 0;
  }
}
