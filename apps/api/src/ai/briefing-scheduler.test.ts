import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock BullMQ — no actual Redis connection required
// E5-5 Task 6.4
// ---------------------------------------------------------------------------

const {
  mockQueueAdd,
  mockQueueClose,
  mockQueueGetRepeatableJobs,
  mockQueueRemoveRepeatableByKey,
  mockWorkerClose,
  mockWorkerOn,
} = vi.hoisted(() => ({
  mockQueueAdd: vi.fn(),
  mockQueueClose: vi.fn(),
  mockQueueGetRepeatableJobs: vi.fn(),
  mockQueueRemoveRepeatableByKey: vi.fn(),
  mockWorkerClose: vi.fn(),
  mockWorkerOn: vi.fn(),
}));

vi.mock('bullmq', () => {
  class MockQueue {
    add = mockQueueAdd;
    close = mockQueueClose;
    getRepeatableJobs = mockQueueGetRepeatableJobs;
    removeRepeatableByKey = mockQueueRemoveRepeatableByKey;
    client = Promise.resolve();
    constructor(_name: string, _opts?: unknown) {}
  }

  class MockWorker {
    close = mockWorkerClose;
    on = mockWorkerOn;
    constructor(_name: string, _processor?: unknown, _opts?: unknown) {}
  }

  return { Queue: MockQueue, Worker: MockWorker };
});

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const { mockGenerateBriefing, mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockGenerateBriefing: vi.fn(),
  mockPrisma: {
    companyProfile: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  } as Record<string, any>,
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { BriefingScheduler } from './briefing-scheduler.js';
import type { BriefingEngine } from './briefing-engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBriefingEngine(): BriefingEngine {
  return {
    generateBriefing: mockGenerateBriefing,
  } as unknown as BriefingEngine;
}

function createScheduler(opts?: {
  cronExpression?: string;
  concurrency?: number;
}): BriefingScheduler {
  // Reset repeatable-job scheduling mocks before each construction
  mockQueueGetRepeatableJobs.mockResolvedValue([]);
  mockQueueAdd.mockResolvedValue({ id: 'trigger-1' });

  return new BriefingScheduler(
    createMockBriefingEngine(),
    mockPrisma as any,
    mockLogger as any,
    { host: 'localhost', port: 6379 },
    {
      cronExpression: opts?.cronExpression ?? '0 6 * * *',
      concurrency: opts?.concurrency ?? 5,
      tenantId: 'tenant-1',
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BriefingScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Construction and scheduling
  // =========================================================================

  describe('construction', () => {
    it('creates queue and worker with correct names', () => {
      createScheduler();

      // Worker's on() should have been called for event listeners
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('schedules repeatable job with default cron pattern', async () => {
      createScheduler();

      // Give the async scheduleRepeatable time to execute
      await vi.waitFor(() => {
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'briefing-trigger',
          expect.objectContaining({ tenantId: 'tenant-1' }),
          expect.objectContaining({
            repeat: { pattern: '0 6 * * *' },
            jobId: 'briefing-trigger-tenant-1',
          }),
        );
      });
    });

    it('schedules repeatable job with custom cron pattern', async () => {
      createScheduler({ cronExpression: '0 7 * * 1-5' });

      await vi.waitFor(() => {
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'briefing-trigger',
          expect.any(Object),
          expect.objectContaining({
            repeat: { pattern: '0 7 * * 1-5' },
          }),
        );
      });
    });

    it('removes existing repeatable jobs before adding new one', async () => {
      // Set mocks BEFORE constructing — scheduleRepeatable fires from constructor
      mockQueueGetRepeatableJobs.mockResolvedValue([
        { key: 'old-key-1', pattern: '0 5 * * *' },
      ]);
      mockQueueAdd.mockResolvedValue({ id: 'trigger-1' });
      mockQueueRemoveRepeatableByKey.mockResolvedValue(undefined);

      new BriefingScheduler(
        createMockBriefingEngine(),
        mockPrisma as any,
        mockLogger as any,
        { host: 'localhost', port: 6379 },
        { tenantId: 'tenant-1' },
      );

      await vi.waitFor(() => {
        expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalledWith('old-key-1');
      });
    });

    it('logs warning if scheduling fails but does not throw', async () => {
      // Set mocks BEFORE constructing — scheduleRepeatable fires from constructor
      mockQueueGetRepeatableJobs.mockRejectedValue(new Error('Redis error'));
      mockQueueAdd.mockResolvedValue({ id: 'trigger-1' });

      const scheduler = new BriefingScheduler(
        createMockBriefingEngine(),
        mockPrisma as any,
        mockLogger as any,
        { host: 'localhost', port: 6379 },
        { tenantId: 'tenant-1' },
      );

      await vi.waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Redis error' }),
          'BriefingScheduler: failed to schedule repeatable job — briefings will only generate on-demand',
        );
      });

      // Clean up
      await scheduler.close();
    });
  });

  // =========================================================================
  // enqueueAllUsers
  // =========================================================================

  describe('enqueueAllUsers()', () => {
    it('queries active users and enqueues a job for each', async () => {
      const scheduler = createScheduler();

      mockPrisma.companyProfile.findMany.mockResolvedValue([
        { id: 'company-1' },
        { id: 'company-2' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', companyId: 'company-1' },
        { id: 'user-2', companyId: 'company-1' },
        { id: 'user-3', companyId: 'company-2' },
      ]);
      mockQueueAdd.mockResolvedValue({ id: 'job-1' });

      const result = await scheduler.enqueueAllUsers();

      expect(result.totalUsers).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify company scoping query
      expect(mockPrisma.companyProfile.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true },
      });

      // Verify user query filtered by isActive and scoped to active companies
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true, companyId: { in: ['company-1', 'company-2'] } },
        select: { id: true, companyId: true },
      });

      // Verify job enqueue calls (3 user jobs + 1 trigger from constructor)
      // The add calls include the initial trigger call from scheduleRepeatable
      const addCalls = mockQueueAdd.mock.calls.filter(
        (call: any[]) => call[0] === 'daily-briefing-pregen',
      );
      expect(addCalls).toHaveLength(3);
    });

    it('isolates per-user errors (one failure does not stop batch)', async () => {
      const scheduler = createScheduler();

      mockPrisma.companyProfile.findMany.mockResolvedValue([
        { id: 'company-1' },
        { id: 'company-2' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', companyId: 'company-1' },
        { id: 'user-2', companyId: 'company-1' },
        { id: 'user-3', companyId: 'company-2' },
      ]);

      let callCount = 0;
      mockQueueAdd.mockImplementation(async (name: string) => {
        // Only count user jobs, not the trigger
        if (name === 'daily-briefing-pregen') {
          callCount++;
          if (callCount === 2) {
            throw new Error('Redis write failure');
          }
        }
        return { id: `job-${callCount}` };
      });

      const result = await scheduler.enqueueAllUsers();

      expect(result.totalUsers).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);

      // Verify error was logged for the failed user
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          error: 'Redis write failure',
        }),
        'BriefingScheduler: failed to enqueue briefing job for user',
      );
    });

    it('returns zero counts when no active users found', async () => {
      const scheduler = createScheduler();

      mockPrisma.companyProfile.findMany.mockResolvedValue([{ id: 'company-1' }]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await scheduler.enqueueAllUsers();

      expect(result.totalUsers).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'BriefingScheduler: no active users found — skipping pre-generation',
      );
    });

    it('handles database query failure gracefully', async () => {
      const scheduler = createScheduler();

      mockPrisma.companyProfile.findMany.mockResolvedValue([{ id: 'company-1' }]);
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB connection lost'));

      const result = await scheduler.enqueueAllUsers();

      expect(result.totalUsers).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB connection lost' }),
        'BriefingScheduler: failed to query active users for batch pre-generation',
      );
    });

    it('includes tenantId in job data', async () => {
      const scheduler = createScheduler();

      mockPrisma.companyProfile.findMany.mockResolvedValue([{ id: 'company-1' }]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', companyId: 'company-1' },
      ]);
      mockQueueAdd.mockResolvedValue({ id: 'job-1' });

      await scheduler.enqueueAllUsers();

      const userJobCall = mockQueueAdd.mock.calls.find(
        (call: any[]) => call[0] === 'daily-briefing-pregen',
      );
      expect(userJobCall).toBeDefined();
      expect(userJobCall![1]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          companyId: 'company-1',
          tenantId: 'tenant-1',
          scheduledAt: expect.any(String),
        }),
      );
    });

    it('sets unique jobId per user per day to prevent duplicates', async () => {
      const scheduler = createScheduler();

      mockPrisma.companyProfile.findMany.mockResolvedValue([{ id: 'company-1' }]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', companyId: 'company-1' },
      ]);
      mockQueueAdd.mockResolvedValue({ id: 'job-1' });

      await scheduler.enqueueAllUsers();

      const userJobCall = mockQueueAdd.mock.calls.find(
        (call: any[]) => call[0] === 'daily-briefing-pregen',
      );
      const opts = userJobCall![2] as { jobId: string };
      expect(opts.jobId).toMatch(/^briefing-tenant-1-user-1-\d{4}-\d{2}-\d{2}$/);
    });
  });

  // =========================================================================
  // getSchedule
  // =========================================================================

  describe('getSchedule()', () => {
    it('returns the cron pattern of the repeatable job', async () => {
      const scheduler = createScheduler();

      mockQueueGetRepeatableJobs.mockResolvedValue([
        { key: 'key-1', pattern: '0 6 * * *' },
      ]);

      const schedule = await scheduler.getSchedule();

      expect(schedule).toBe('0 6 * * *');
    });

    it('returns null when no repeatable jobs exist', async () => {
      const scheduler = createScheduler();

      mockQueueGetRepeatableJobs.mockResolvedValue([]);

      const schedule = await scheduler.getSchedule();

      expect(schedule).toBeNull();
    });

    it('returns null on error', async () => {
      const scheduler = createScheduler();

      mockQueueGetRepeatableJobs.mockRejectedValue(new Error('Redis error'));

      const schedule = await scheduler.getSchedule();

      expect(schedule).toBeNull();
    });
  });

  // =========================================================================
  // close
  // =========================================================================

  describe('close()', () => {
    it('closes both worker and queue', async () => {
      const scheduler = createScheduler();

      mockWorkerClose.mockResolvedValue(undefined);
      mockQueueClose.mockResolvedValue(undefined);

      await scheduler.close();

      expect(mockWorkerClose).toHaveBeenCalledOnce();
      expect(mockQueueClose).toHaveBeenCalledOnce();
    });

    it('handles worker close failure gracefully', async () => {
      const scheduler = createScheduler();

      mockWorkerClose.mockRejectedValue(new Error('Worker close error'));
      mockQueueClose.mockResolvedValue(undefined);

      await scheduler.close();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Worker close error' }),
        'BriefingScheduler: error closing worker',
      );
      // Queue should still be closed
      expect(mockQueueClose).toHaveBeenCalledOnce();
    });

    it('handles queue close failure gracefully', async () => {
      const scheduler = createScheduler();

      mockWorkerClose.mockResolvedValue(undefined);
      mockQueueClose.mockRejectedValue(new Error('Queue close error'));

      await scheduler.close();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Queue close error' }),
        'BriefingScheduler: error closing queue',
      );
    });
  });

  // =========================================================================
  // Worker event listeners
  // =========================================================================

  describe('worker events', () => {
    it('registers completed and failed event listeners', () => {
      createScheduler();

      const onCalls = mockWorkerOn.mock.calls;
      const eventNames = onCalls.map((call: any[]) => call[0]);

      expect(eventNames).toContain('completed');
      expect(eventNames).toContain('failed');
    });

    it('completed handler logs debug with job details', () => {
      createScheduler();

      const completedHandler = mockWorkerOn.mock.calls.find(
        (call: any[]) => call[0] === 'completed',
      )?.[1];

      expect(completedHandler).toBeDefined();
      completedHandler({ id: 'job-1', data: { userId: 'user-1' } });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { jobId: 'job-1', userId: 'user-1' },
        'BriefingScheduler: job completed',
      );
    });

    it('failed handler logs warning with error details', () => {
      createScheduler();

      const failedHandler = mockWorkerOn.mock.calls.find(
        (call: any[]) => call[0] === 'failed',
      )?.[1];

      expect(failedHandler).toBeDefined();
      failedHandler(
        { id: 'job-2', data: { userId: 'user-2' } },
        new Error('Briefing gen failed'),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { jobId: 'job-2', userId: 'user-2', error: 'Briefing gen failed' },
        'BriefingScheduler: job failed',
      );
    });
  });
});
