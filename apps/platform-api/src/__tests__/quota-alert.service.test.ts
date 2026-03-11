// ---------------------------------------------------------------------------
// Quota Alert Service Unit Tests — E13b.4 Task 2.6
// Covers: alert creation on threshold crossing, deduplication,
// error resilience (fire-and-forget)
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuotaAlertIfNeeded } from '../services/quota-alert.service.js';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockAlertFindFirst = vi.fn();
const mockAlertCreate = vi.fn();

const mockPrisma = {
  // $transaction calls the callback with the mock prisma itself (acting as tx)
  $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
  platformAiAlert: {
    findFirst: mockAlertFindFirst,
    create: mockAlertCreate,
  },
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
};

const TENANT_ID = '00000000-0000-4000-a000-000000000001';
const PERIOD_START = new Date('2026-03-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createQuotaAlertIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a QUOTA_WARNING alert when none exists', async () => {
    mockAlertFindFirst.mockResolvedValueOnce(null);
    mockAlertCreate.mockResolvedValueOnce({ id: 'new-alert' });

    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_WARNING',
      usagePct: 82,
      threshold: 80,
      periodStart: PERIOD_START,
    });

    expect(mockAlertCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'QUOTA_WARNING',
        tenantId: TENANT_ID,
        usagePct: 82,
        threshold: 80,
      }),
    });
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('creates a QUOTA_EXCEEDED alert when none exists', async () => {
    mockAlertFindFirst.mockResolvedValueOnce(null);
    mockAlertCreate.mockResolvedValueOnce({ id: 'new-alert' });

    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_EXCEEDED',
      usagePct: 102,
      threshold: 100,
      periodStart: PERIOD_START,
    });

    expect(mockAlertCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'QUOTA_EXCEEDED',
        tenantId: TENANT_ID,
        usagePct: 102,
        threshold: 100,
      }),
    });
  });

  it('does NOT create alert when one already exists for this period', async () => {
    mockAlertFindFirst.mockResolvedValueOnce({ id: 'existing-alert' });

    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_WARNING',
      usagePct: 85,
      threshold: 80,
      periodStart: PERIOD_START,
    });

    expect(mockAlertCreate).not.toHaveBeenCalled();
  });

  it('checks for non-acknowledged alerts only', async () => {
    mockAlertFindFirst.mockResolvedValueOnce(null);
    mockAlertCreate.mockResolvedValueOnce({ id: 'new-alert' });

    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_WARNING',
      usagePct: 82,
      threshold: 80,
      periodStart: PERIOD_START,
    });

    expect(mockAlertFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: TENANT_ID,
        type: 'QUOTA_WARNING',
        acknowledged: false,
        createdAt: { gte: PERIOD_START },
      }),
    });
  });

  it('does NOT throw when alert creation fails', async () => {
    mockAlertFindFirst.mockResolvedValueOnce(null);
    mockAlertCreate.mockRejectedValueOnce(new Error('DB connection lost'));

    // Should not throw
    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_WARNING',
      usagePct: 82,
      threshold: 80,
      periodStart: PERIOD_START,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
      expect.stringContaining('failed to create alert'),
    );
  });

  it('does NOT throw when findFirst fails', async () => {
    mockAlertFindFirst.mockRejectedValueOnce(new Error('DB timeout'));

    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_EXCEEDED',
      usagePct: 105,
      threshold: 100,
      periodStart: PERIOD_START,
    });

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('generates correct message for QUOTA_WARNING', async () => {
    mockAlertFindFirst.mockResolvedValueOnce(null);
    mockAlertCreate.mockResolvedValueOnce({ id: 'new-alert' });

    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_WARNING',
      usagePct: 85,
      threshold: 80,
      periodStart: PERIOD_START,
    });

    const createCall = mockAlertCreate.mock.calls[0][0] as { data: { message: string } };
    expect(createCall.data.message).toContain('85%');
    expect(createCall.data.message).toContain('soft limit');
    expect(createCall.data.message).toContain('80%');
  });

  it('generates correct message for QUOTA_EXCEEDED', async () => {
    mockAlertFindFirst.mockResolvedValueOnce(null);
    mockAlertCreate.mockResolvedValueOnce({ id: 'new-alert' });

    // @ts-expect-error — mock Prisma
    await createQuotaAlertIfNeeded(mockPrisma, mockLogger, {
      tenantId: TENANT_ID,
      type: 'QUOTA_EXCEEDED',
      usagePct: 105,
      threshold: 100,
      periodStart: PERIOD_START,
    });

    const createCall = mockAlertCreate.mock.calls[0][0] as { data: { message: string } };
    expect(createCall.data.message).toContain('105%');
    expect(createCall.data.message).toContain('hard limit');
    expect(createCall.data.message).toContain('100%');
  });
});
