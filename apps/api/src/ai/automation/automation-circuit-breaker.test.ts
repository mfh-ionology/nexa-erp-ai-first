import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomationCircuitBreaker } from './automation-circuit-breaker.js';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function createMockDb() {
  return {
    aiAutomationSchedule: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    aiAutomation: {
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function createMockEventBus() {
  const handlers = new Map<string, Function[]>();
  return {
    on: vi.fn().mockImplementation((event: string, handler: Function) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    // Helper to simulate event firing
    _fire: (event: string, data: any) => {
      const fns = handlers.get(event) ?? [];
      for (const fn of fns) fn(data);
    },
    _handlers: handlers,
  };
}

function createMockScheduler() {
  return {
    removeSchedule: vi.fn().mockResolvedValue(undefined),
  } as any;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AutomationCircuitBreaker', () => {
  let db: ReturnType<typeof createMockDb>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let scheduler: ReturnType<typeof createMockScheduler>;
  let breaker: AutomationCircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    eventBus = createMockEventBus();
    scheduler = createMockScheduler();
    breaker = new AutomationCircuitBreaker(db, eventBus as any, scheduler, mockLogger as any);
  });

  // =========================================================================
  // Lifecycle
  // =========================================================================

  describe('lifecycle', () => {
    it('subscribes to failed and completed events on start', () => {
      breaker.start();

      expect(eventBus.on).toHaveBeenCalledWith('ai.automation.failed', expect.any(Function));
      expect(eventBus.on).toHaveBeenCalledWith('ai.automation.completed', expect.any(Function));
    });

    it('does not double-start', () => {
      breaker.start();
      breaker.start();

      // on() should have been called only twice (once for failed, once for completed)
      expect(eventBus.on).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith('AutomationCircuitBreaker: already started');
    });

    it('unsubscribes and clears state on stop', () => {
      breaker.start();
      breaker.stop();

      expect(eventBus.off).toHaveBeenCalledWith('ai.automation.failed', expect.any(Function));
      expect(eventBus.off).toHaveBeenCalledWith('ai.automation.completed', expect.any(Function));
    });

    it('stop is safe to call when not started', () => {
      breaker.stop(); // should not throw
      expect(eventBus.off).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3 consecutive failures → auto-pause (AC-19)
  // =========================================================================

  describe('3 consecutive failures → auto-pause', () => {
    it('does not trip on 1 or 2 failures', async () => {
      breaker.start();

      const failedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-1',
        error: 'err',
      };

      // Simulate 2 failures
      eventBus._fire('ai.automation.failed', failedData);
      await vi.waitFor(() => {
        expect(breaker.getFailureCount('auto-1')).toBe(1);
      });

      eventBus._fire('ai.automation.failed', failedData);
      await vi.waitFor(() => {
        expect(breaker.getFailureCount('auto-1')).toBe(2);
      });

      // Should NOT have paused
      expect(db.aiAutomationSchedule.updateMany).not.toHaveBeenCalled();
      expect(db.aiAutomation.update).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('trips circuit breaker on 3rd consecutive failure', async () => {
      breaker.start();

      const failedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-1',
        error: 'err',
      };

      // Simulate 3 failures
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);

      // Wait for all async side effects to complete
      await vi.waitFor(() => {
        // 1. Schedule paused
        expect(db.aiAutomationSchedule.updateMany).toHaveBeenCalledWith({
          where: { automationId: 'auto-1' },
          data: { isPaused: true },
        });

        // 2. Automation deactivated
        expect(db.aiAutomation.update).toHaveBeenCalledWith({
          where: { id: 'auto-1' },
          data: { isActive: false },
        });

        // 3. Emits ai.automation.paused event
        expect(eventBus.emit).toHaveBeenCalledWith('ai.automation.paused', {
          automationId: 'auto-1',
          companyId: 'comp-1',
          consecutiveFailures: 3,
        });

        // 4. Removes schedule from BullMQ
        expect(scheduler.removeSchedule).toHaveBeenCalledWith('auto-1');
      });
    });

    it('resets failure counter after tripping', async () => {
      breaker.start();

      const failedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-1',
        error: 'err',
      };

      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);

      await vi.waitFor(() => {
        expect(db.aiAutomation.update).toHaveBeenCalled();
      });

      // Counter should be reset after tripping
      expect(breaker.getFailureCount('auto-1')).toBe(0);
    });

    it('handles null scheduler gracefully', async () => {
      const breakerNoScheduler = new AutomationCircuitBreaker(
        db,
        eventBus as any,
        null,
        mockLogger as any,
      );
      breakerNoScheduler.start();

      const failedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-1',
        error: 'err',
      };

      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);

      await vi.waitFor(() => {
        expect(db.aiAutomation.update).toHaveBeenCalled();
      });

      // Should not throw even without scheduler
      expect(eventBus.emit).toHaveBeenCalledWith('ai.automation.paused', expect.any(Object));
    });
  });

  // =========================================================================
  // Reset on success
  // =========================================================================

  describe('reset on success', () => {
    it('resets failure counter to 0 on completed event', async () => {
      breaker.start();

      const failedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-1',
        error: 'err',
      };
      const completedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-2',
        totalTokens: 1000,
        totalCost: 0.05,
        durationMs: 5000,
      };

      // 2 failures
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);

      await vi.waitFor(() => {
        expect(breaker.getFailureCount('auto-1')).toBe(2);
      });

      // 1 success — should reset
      eventBus._fire('ai.automation.completed', completedData);

      expect(breaker.getFailureCount('auto-1')).toBe(0);
    });

    it('does not trip after success resets the counter', async () => {
      breaker.start();

      const failedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-1',
        error: 'err',
      };
      const completedData = {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'run-2',
        totalTokens: 1000,
        totalCost: 0.05,
        durationMs: 5000,
      };

      // 2 failures → success → 2 more failures
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.completed', completedData);
      eventBus._fire('ai.automation.failed', failedData);
      eventBus._fire('ai.automation.failed', failedData);

      await vi.waitFor(() => {
        expect(breaker.getFailureCount('auto-1')).toBe(2);
      });

      // Should NOT have tripped — only 2 consecutive, not 3
      expect(db.aiAutomationSchedule.updateMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Multiple automations tracked independently
  // =========================================================================

  describe('independent tracking per automation', () => {
    it('tracks failure counts independently per automationId', async () => {
      breaker.start();

      eventBus._fire('ai.automation.failed', {
        automationId: 'auto-1',
        companyId: 'comp-1',
        runId: 'r1',
        error: 'err',
      });
      eventBus._fire('ai.automation.failed', {
        automationId: 'auto-2',
        companyId: 'comp-1',
        runId: 'r2',
        error: 'err',
      });

      await vi.waitFor(() => {
        expect(breaker.getFailureCount('auto-1')).toBe(1);
        expect(breaker.getFailureCount('auto-2')).toBe(1);
      });
    });
  });

  // =========================================================================
  // getFailureCount
  // =========================================================================

  describe('getFailureCount()', () => {
    it('returns 0 for unknown automationId', () => {
      breaker.start();
      expect(breaker.getFailureCount('nonexistent')).toBe(0);
    });
  });
});
