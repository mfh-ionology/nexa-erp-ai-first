import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock BullMQ — no actual Redis connection required ─────────────────────

const {
  mockQueueAdd,
  mockQueueClose,
  mockQueueGetRepeatableJobs,
  mockQueueRemoveRepeatableByKey,
  mockWorkerClose,
  mockWorkerOn,
} = vi.hoisted(() => ({
  mockQueueAdd: vi.fn().mockResolvedValue({ id: 'job-1' }),
  mockQueueClose: vi.fn().mockResolvedValue(undefined),
  mockQueueGetRepeatableJobs: vi.fn().mockResolvedValue([]),
  mockQueueRemoveRepeatableByKey: vi.fn().mockResolvedValue(undefined),
  mockWorkerClose: vi.fn().mockResolvedValue(undefined),
  mockWorkerOn: vi.fn(),
}));

vi.mock('bullmq', () => {
  class MockQueue {
    add = mockQueueAdd;
    close = mockQueueClose;
    getRepeatableJobs = mockQueueGetRepeatableJobs;
    removeRepeatableByKey = mockQueueRemoveRepeatableByKey;
    constructor(_name: string, _opts?: unknown) {}
  }

  class MockWorker {
    close = mockWorkerClose;
    on = mockWorkerOn;
    constructor(_name: string, _processor?: unknown, _opts?: unknown) {}
  }

  return { Queue: MockQueue, Worker: MockWorker };
});

// ─── Mock cron-parser ──────────────────────────────────────────────────────

const { mockCronParse } = vi.hoisted(() => ({
  mockCronParse: vi.fn(),
}));

vi.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: mockCronParse,
  },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { AutomationSchedulerService } from './automation-scheduler.js';

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
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function createMockExecutor() {
  return {
    execute: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'COMPLETED' }),
  } as any;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCronNext(date: Date) {
  return {
    next: () => ({
      toDate: () => date,
    }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AutomationSchedulerService', () => {
  let db: ReturnType<typeof createMockDb>;
  let executor: ReturnType<typeof createMockExecutor>;
  let scheduler: AutomationSchedulerService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    executor = createMockExecutor();
    mockCronParse.mockReturnValue(makeCronNext(new Date('2026-03-04T07:00:00Z')));
    scheduler = new AutomationSchedulerService(db, executor, mockLogger as any, {
      host: 'localhost',
      port: 6379,
    });
  });

  // =========================================================================
  // Cron schedule registration
  // =========================================================================

  describe('cron schedule registration', () => {
    it('registers repeatable jobs for all active schedules on start()', async () => {
      db.aiAutomationSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          automationId: 'auto-1',
          cronExpression: '0 7 * * 1-5',
          timezone: 'Europe/London',
          automation: { id: 'auto-1', companyId: 'comp-1' },
        },
      ]);

      await scheduler.start();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'automation-run-auto-1',
        expect.objectContaining({
          automationId: 'auto-1',
          companyId: 'comp-1',
          cronExpression: '0 7 * * 1-5',
          timezone: 'Europe/London',
        }),
        expect.objectContaining({
          repeat: { pattern: '0 7 * * 1-5', tz: 'Europe/London' },
          jobId: 'automation-auto-1',
        }),
      );
    });

    it('updates nextRunAt after registering schedule', async () => {
      const nextRunDate = new Date('2026-03-04T07:00:00Z');
      mockCronParse.mockReturnValue(makeCronNext(nextRunDate));

      db.aiAutomationSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          automationId: 'auto-1',
          cronExpression: '0 7 * * 1-5',
          timezone: 'Europe/London',
          automation: { id: 'auto-1', companyId: 'comp-1' },
        },
      ]);

      await scheduler.start();

      expect(db.aiAutomationSchedule.update).toHaveBeenCalledWith({
        where: { id: 'sched-1' },
        data: { nextRunAt: nextRunDate },
      });
    });

    it('removes all existing repeatable jobs before refreshing', async () => {
      mockQueueGetRepeatableJobs.mockResolvedValue([
        { key: 'old-key-1', name: 'automation-run-old' },
      ]);

      db.aiAutomationSchedule.findMany.mockResolvedValue([]);

      await scheduler.start();

      expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalledWith('old-key-1');
    });
  });

  // =========================================================================
  // Timezone-aware execution timing
  // =========================================================================

  describe('timezone-aware execution', () => {
    it('passes timezone to cron-parser for next run calculation', async () => {
      db.aiAutomationSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          automationId: 'auto-1',
          cronExpression: '0 9 * * *',
          timezone: 'America/New_York',
          automation: { id: 'auto-1', companyId: 'comp-1' },
        },
      ]);

      await scheduler.start();

      expect(mockCronParse).toHaveBeenCalledWith('0 9 * * *', {
        tz: 'America/New_York',
        currentDate: expect.any(Date),
      });
    });

    it('defaults timezone to Europe/London when not specified', async () => {
      await scheduler.start();
      await scheduler.addSchedule('auto-1', 'comp-1', '0 8 * * *');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'automation-run-auto-1',
        expect.objectContaining({
          timezone: 'Europe/London',
        }),
        expect.objectContaining({
          repeat: expect.objectContaining({ tz: 'Europe/London' }),
        }),
      );
    });
  });

  // =========================================================================
  // Schedule lifecycle (create, update, pause, resume, delete)
  // =========================================================================

  describe('schedule lifecycle', () => {
    it('addSchedule() registers a repeatable job', async () => {
      await scheduler.start();

      await scheduler.addSchedule('auto-1', 'comp-1', '0 7 * * 1-5', 'Europe/London');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'automation-run-auto-1',
        expect.objectContaining({ automationId: 'auto-1' }),
        expect.objectContaining({
          repeat: { pattern: '0 7 * * 1-5', tz: 'Europe/London' },
        }),
      );
    });

    it('removeSchedule() removes matching repeatable jobs', async () => {
      await scheduler.start();

      mockQueueGetRepeatableJobs.mockResolvedValue([
        { key: 'key-1', name: 'automation-run-auto-1', pattern: '0 7 * * 1-5' },
        { key: 'key-2', name: 'automation-run-auto-2', pattern: '0 8 * * *' },
      ]);

      await scheduler.removeSchedule('auto-1');

      expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalledWith('key-1');
      expect(mockQueueRemoveRepeatableByKey).not.toHaveBeenCalledWith('key-2');
    });

    it('updateSchedule() removes old and adds new job', async () => {
      await scheduler.start();

      mockQueueGetRepeatableJobs.mockResolvedValue([
        { key: 'old-key', name: 'automation-run-auto-1', pattern: '0 7 * * *' },
      ]);

      await scheduler.updateSchedule('auto-1', 'comp-1', '0 9 * * *', 'Europe/Berlin');

      // Should remove old
      expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalledWith('old-key');
      // Should add new
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'automation-run-auto-1',
        expect.objectContaining({
          cronExpression: '0 9 * * *',
          timezone: 'Europe/Berlin',
        }),
        expect.any(Object),
      );
    });

    it('addSchedule() warns if queue not initialised', async () => {
      // Don't call start() — queue is null
      await scheduler.addSchedule('auto-1', 'comp-1', '0 7 * * *');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AutomationScheduler: queue not initialised — call start() first',
      );
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Lifecycle (start/stop)
  // =========================================================================

  describe('lifecycle', () => {
    it('does not double-start', async () => {
      await scheduler.start();
      await scheduler.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('AutomationScheduler: already started');
    });

    it('closes worker and queue on stop()', async () => {
      await scheduler.start();
      await scheduler.stop();

      expect(mockWorkerClose).toHaveBeenCalledOnce();
      expect(mockQueueClose).toHaveBeenCalledOnce();
    });

    it('stop() is safe when not started', async () => {
      await scheduler.stop();
      expect(mockWorkerClose).not.toHaveBeenCalled();
    });

    it('handles worker close error gracefully', async () => {
      await scheduler.start();
      mockWorkerClose.mockRejectedValue(new Error('Worker close error'));

      await scheduler.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Worker close error' }),
        'AutomationScheduler: error closing worker',
      );
      expect(mockQueueClose).toHaveBeenCalledOnce();
    });

    it('handles queue close error gracefully', async () => {
      await scheduler.start();
      mockQueueClose.mockRejectedValue(new Error('Queue close error'));

      await scheduler.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Queue close error' }),
        'AutomationScheduler: error closing queue',
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('logs warning when cron expression fails to parse', async () => {
      mockCronParse.mockImplementation(() => {
        throw new Error('Invalid cron expression');
      });

      db.aiAutomationSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          automationId: 'auto-1',
          cronExpression: 'bad-cron',
          timezone: 'Europe/London',
          automation: { id: 'auto-1', companyId: 'comp-1' },
        },
      ]);

      await scheduler.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ cronExpression: 'bad-cron' }),
        expect.stringContaining('failed'),
      );
    });
  });
});
