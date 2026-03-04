// ---------------------------------------------------------------------------
// Unit tests for BatchStatementEmailService — E10-3 Task 10.2
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueueAdd = vi.hoisted(() => vi.fn());

const MockQueue = vi.hoisted(() => {
  return class MockQueue {
    add = mockQueueAdd;
    close = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_name: string, _opts?: unknown) {}
  };
});

vi.mock('bullmq', () => ({
  Queue: MockQueue,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { BatchStatementEmailService } from './batch-statement-email.service.js';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BatchStatementEmailService', () => {
  let service: BatchStatementEmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BatchStatementEmailService(mockLogger);
  });

  describe('triggerBatchStatementEmail', () => {
    it('triggers BullMQ job with correct payload', async () => {
      // Init queue first
      service.initQueue({ host: 'localhost', port: 6379 });

      const jobId = `batch-stmt-${TEST_COMPANY_ID}-${Date.now()}`;
      mockQueueAdd.mockResolvedValue({ id: jobId });

      const input = {
        dateRange: { from: '2026-01-01', to: '2026-01-31' },
        customerIds: ['cust-001', 'cust-002'],
      };

      const result = await service.triggerBatchStatementEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        input,
      );

      expect(result.batchJobId).toBe(jobId);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'batch-statement',
        expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          userId: TEST_USER_ID,
          input,
        }),
        expect.objectContaining({
          jobId: expect.stringContaining(`batch-stmt-${TEST_COMPANY_ID}`),
        }),
      );
    });

    it('throws when queue is not initialised', async () => {
      await expect(
        service.triggerBatchStatementEmail(
          { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
          { dateRange: { from: '2026-01-01', to: '2026-01-31' } },
        ),
      ).rejects.toThrow('Batch statement email queue is not available');
    });
  });

  describe('initQueue', () => {
    it('creates a BullMQ queue and returns it', () => {
      const queue = service.initQueue({ host: 'localhost', port: 6379 });
      expect(queue).toBeDefined();
      expect(service.getQueue()).toBe(queue);
    });
  });

  describe('getQueue', () => {
    it('returns null before init', () => {
      expect(service.getQueue()).toBeNull();
    });
  });
});
