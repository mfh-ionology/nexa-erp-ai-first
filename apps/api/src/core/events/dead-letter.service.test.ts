import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeadLetterService } from './dead-letter.service.js';

// ---------------------------------------------------------------------------
// Mock BullMQ — no actual Redis connection required
// E3-3 Task 13
// ---------------------------------------------------------------------------

const { mockAdd, mockGetJobs, mockClose, mockUpdateData, mockFromId } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockGetJobs: vi.fn(),
  mockClose: vi.fn(),
  mockUpdateData: vi.fn(),
  mockFromId: vi.fn(),
}));

vi.mock('bullmq', () => {
  class MockQueue {
    add = mockAdd;
    getJobs = mockGetJobs;
    close = mockClose;
    // BullMQ Queue.client is a Promise that resolves when internal connection is ready
    client = Promise.resolve();
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(_name: string, _opts?: unknown) {}
  }

  const MockJob = {
    fromId: mockFromId,
  };

  return { Queue: MockQueue, Job: MockJob };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockJob(overrides: {
  id?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}) {
  return {
    id: overrides.id ?? '1',
    data: overrides.data ?? {
      eventName: 'invoice.posted',
      payload: { invoiceId: 'inv-1' },
      error: 'Something failed',
      stack: 'Error: Something failed\n  at ...',
      retryCount: 3,
      originalTimestamp: '2026-02-21T10:00:00.000Z',
      reprocessed: false,
    },
    timestamp: overrides.timestamp ?? 1740132000000,
    updateData: mockUpdateData,
  };
}

// ---------------------------------------------------------------------------
// Tests — DeadLetterService
// ---------------------------------------------------------------------------

describe('DeadLetterService', () => {
  let service: DeadLetterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeadLetterService({ host: 'localhost', port: 6379 });
  });

  // =========================================================================
  // 13.3 — add() creates a BullMQ job with correct data (AC #2)
  // =========================================================================

  it('add() creates a BullMQ job with correct data', async () => {
    mockAdd.mockResolvedValueOnce({ id: 'job-42' });

    await service.add({
      eventName: 'invoice.posted',
      payload: { invoiceId: 'inv-1' },
      error: 'Handler exploded',
      stack: 'Error: Handler exploded\n  at handler.ts:10',
      retryCount: 3,
      originalTimestamp: '2026-02-21T10:00:00.000Z',
    });

    expect(mockAdd).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledWith('dead-letter', {
      eventName: 'invoice.posted',
      payload: { invoiceId: 'inv-1' },
      error: 'Handler exploded',
      stack: 'Error: Handler exploded\n  at handler.ts:10',
      retryCount: 3,
      originalTimestamp: '2026-02-21T10:00:00.000Z',
      reprocessed: false,
    });
  });

  // =========================================================================
  // 13.4 — add() returns the BullMQ job ID (AC #2)
  // =========================================================================

  it('add() returns the BullMQ job ID', async () => {
    mockAdd.mockResolvedValueOnce({ id: 'job-42' });

    const id = await service.add({
      eventName: 'user.login',
      payload: { userId: 'u1' },
      error: 'fail',
      retryCount: 3,
      originalTimestamp: '2026-02-21T10:00:00.000Z',
    });

    expect(id).toBe('job-42');
  });

  // =========================================================================
  // 13.5 — list() returns paginated entries with cursor (AC #3)
  // =========================================================================

  it('list() returns paginated entries with cursor', async () => {
    const jobs = [
      createMockJob({ id: '3', timestamp: 1740132003000 }),
      createMockJob({ id: '2', timestamp: 1740132002000 }),
      createMockJob({ id: '1', timestamp: 1740132001000 }),
    ];
    mockGetJobs.mockResolvedValueOnce(jobs);

    const result = await service.list({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.id).toBe('3');
    expect(result.items[1]!.id).toBe('2');
    expect(result.hasMore).toBe(true);
    expect(result.cursor).toBe('2');
  });

  it('list() uses cursor to skip previous entries', async () => {
    const jobs = [
      createMockJob({ id: '3', timestamp: 1740132003000 }),
      createMockJob({ id: '2', timestamp: 1740132002000 }),
      createMockJob({ id: '1', timestamp: 1740132001000 }),
    ];
    mockGetJobs.mockResolvedValueOnce(jobs);

    const result = await service.list({ limit: 10, cursor: '3' });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.id).toBe('2');
    expect(result.items[1]!.id).toBe('1');
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeNull();
  });

  // =========================================================================
  // 13.6 — list() filters by eventName (AC #3)
  // =========================================================================

  it('list() filters by eventName', async () => {
    const jobs = [
      createMockJob({
        id: '1',
        data: {
          eventName: 'invoice.posted',
          payload: {},
          error: 'fail',
          retryCount: 3,
          originalTimestamp: '2026-02-21T10:00:00.000Z',
          reprocessed: false,
        },
        timestamp: 1740132002000,
      }),
      createMockJob({
        id: '2',
        data: {
          eventName: 'user.login',
          payload: {},
          error: 'fail',
          retryCount: 3,
          originalTimestamp: '2026-02-21T10:00:00.000Z',
          reprocessed: false,
        },
        timestamp: 1740132001000,
      }),
    ];
    mockGetJobs.mockResolvedValueOnce(jobs);

    const result = await service.list({ eventName: 'invoice.posted' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.eventName).toBe('invoice.posted');
  });

  // =========================================================================
  // 13.7 — list() filters by reprocessed status (AC #3)
  // =========================================================================

  it('list() filters by reprocessed status', async () => {
    const jobs = [
      createMockJob({
        id: '1',
        data: {
          eventName: 'invoice.posted',
          payload: {},
          error: 'fail',
          retryCount: 3,
          originalTimestamp: '2026-02-21T10:00:00.000Z',
          reprocessed: true,
          reprocessedAt: '2026-02-21T11:00:00.000Z',
        },
        timestamp: 1740132002000,
      }),
      createMockJob({
        id: '2',
        data: {
          eventName: 'user.login',
          payload: {},
          error: 'fail',
          retryCount: 3,
          originalTimestamp: '2026-02-21T10:00:00.000Z',
          reprocessed: false,
        },
        timestamp: 1740132001000,
      }),
    ];
    mockGetJobs.mockResolvedValueOnce(jobs);

    const result = await service.list({ reprocessed: false });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe('2');
    expect(result.items[0]!.reprocessed).toBe(false);
  });

  // =========================================================================
  // 13.8 — getById() returns the correct entry (AC #3)
  // =========================================================================

  it('getById() returns the correct entry', async () => {
    const mockJob = createMockJob({ id: 'job-99' });
    mockFromId.mockResolvedValueOnce(mockJob as never);

    const entry = await service.getById('job-99');

    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('job-99');
    expect(entry!.eventName).toBe('invoice.posted');
    expect(entry!.payload).toEqual({ invoiceId: 'inv-1' });
    expect(entry!.error).toBe('Something failed');
    expect(entry!.retryCount).toBe(3);
    expect(entry!.reprocessed).toBe(false);
  });

  // =========================================================================
  // 13.9 — getById() returns null for non-existent ID (AC #3)
  // =========================================================================

  it('getById() returns null for non-existent ID', async () => {
    mockFromId.mockResolvedValueOnce(null as never);

    const entry = await service.getById('nonexistent');

    expect(entry).toBeNull();
  });

  // =========================================================================
  // 13.10 — markReprocessed() updates job data (AC #4)
  // =========================================================================

  it('markReprocessed() updates the job data with reprocessed=true and timestamp', async () => {
    const originalData = {
      eventName: 'invoice.posted',
      payload: { invoiceId: 'inv-1' },
      error: 'fail',
      retryCount: 3,
      originalTimestamp: '2026-02-21T10:00:00.000Z',
      reprocessed: false,
    };
    const mockJob = createMockJob({ id: 'job-50', data: originalData });
    mockFromId.mockResolvedValueOnce(mockJob as never);
    mockUpdateData.mockResolvedValueOnce(undefined);

    await service.markReprocessed('job-50');

    expect(mockUpdateData).toHaveBeenCalledOnce();
    const updatedData = mockUpdateData.mock.calls[0]![0];
    expect(updatedData.reprocessed).toBe(true);
    expect(updatedData.reprocessedAt).toBeDefined();
    // Verify original fields are preserved
    expect(updatedData.eventName).toBe('invoice.posted');
    expect(updatedData.error).toBe('fail');
    expect(updatedData.retryCount).toBe(3);
  });

  // =========================================================================
  // 13.11 — When Redis/BullMQ is unavailable, add() logs error but does not throw (AC #2)
  // =========================================================================

  it('add() logs error but does not throw when Redis/BullMQ is unavailable', async () => {
    const mockLogger = { error: vi.fn() };
    service.setLogger(mockLogger);

    mockAdd.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const id = await service.add({
      eventName: 'invoice.posted',
      payload: { invoiceId: 'inv-1' },
      error: 'fail',
      retryCount: 3,
      originalTimestamp: '2026-02-21T10:00:00.000Z',
    });

    // Should return null (not throw)
    expect(id).toBeNull();
    // Should log the error
    expect(mockLogger.error).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[DeadLetterService] Failed to add entry to DLQ — Redis may be unavailable:',
      expect.any(Error),
    );
  });

  // =========================================================================
  // close() — graceful shutdown of BullMQ queue
  // =========================================================================

  it('close() waits for BullMQ initialization then closes the queue', async () => {
    mockClose.mockResolvedValueOnce(undefined);

    await service.close();

    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('close() handles BullMQ client initialization failure gracefully', async () => {
    // Create a service whose queue.client rejects (simulating connection failure).
    // The mock Queue's client is set to resolve by default, so we need a fresh
    // service with a failing client to test this path.
    const mockLogger = { error: vi.fn() };
    const failService = new DeadLetterService({ host: 'unreachable', port: 6379 });
    failService.setLogger(mockLogger);

    // Override the queue.client to reject
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (failService as any).queue.client = Promise.reject(new Error('ECONNREFUSED'));

    mockClose.mockResolvedValueOnce(undefined);

    // close() should NOT throw even when client init fails
    await expect(failService.close()).resolves.toBeUndefined();
    expect(mockClose).toHaveBeenCalled();
  });
});
