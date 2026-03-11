// ---------------------------------------------------------------------------
// Spike Detection Service Unit Tests — E13b.4 Task 2.6
// Covers: spike detection logic (3x rolling average), alert deduplication,
// threshold handling
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpikeDetectionService } from '../services/spike-detection.service.js';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockQueryRaw = vi.fn();
const mockAlertFindFirst = vi.fn();
const mockAlertCreate = vi.fn();

const mockPrisma = {
  $queryRaw: mockQueryRaw,
  platformAiAlert: {
    findFirst: mockAlertFindFirst,
    create: mockAlertCreate,
  },
} as unknown as Parameters<
  typeof SpikeDetectionService.prototype.detectSpikes extends (...args: infer A) => unknown
    ? never
    : never
>;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpikeDetectionService', () => {
  let service: SpikeDetectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error — mock Prisma client
    service = new SpikeDetectionService(mockPrisma, mockLogger);
  });

  it('detects a spike when daily usage > 3x rolling average', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        tenant_id: 'tenant-1',
        daily_tokens: BigInt(150000),
        rolling_avg_tokens: 40000,
      },
    ]);
    mockAlertFindFirst.mockResolvedValueOnce(null); // no existing alert
    mockAlertCreate.mockResolvedValueOnce({ id: 'alert-1' });

    const result = await service.detectSpikes(new Date('2026-03-11'));

    expect(result.tenantsChecked).toBe(1);
    expect(result.spikesDetected).toBe(1);
    expect(result.alertsCreated).toBe(1);
    expect(mockAlertCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'USAGE_SPIKE',
        tenantId: 'tenant-1',
        dailyTokens: BigInt(150000),
        rollingAvgTokens: BigInt(40000),
      }),
    });
  });

  it('does NOT detect a spike when daily usage <= 3x rolling average', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        tenant_id: 'tenant-1',
        daily_tokens: BigInt(100000),
        rolling_avg_tokens: 50000, // 100000 / 50000 = 2x, below 3x
      },
    ]);

    const result = await service.detectSpikes(new Date('2026-03-11'));

    expect(result.tenantsChecked).toBe(1);
    expect(result.spikesDetected).toBe(0);
    expect(result.alertsCreated).toBe(0);
    expect(mockAlertCreate).not.toHaveBeenCalled();
  });

  it('skips tenants with zero rolling average', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        tenant_id: 'new-tenant',
        daily_tokens: BigInt(50000),
        rolling_avg_tokens: 0,
      },
    ]);

    const result = await service.detectSpikes(new Date('2026-03-11'));

    expect(result.tenantsChecked).toBe(1);
    expect(result.spikesDetected).toBe(0);
    expect(result.alertsCreated).toBe(0);
  });

  it('does NOT create duplicate alert for same tenant and date', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        tenant_id: 'tenant-1',
        daily_tokens: BigInt(200000),
        rolling_avg_tokens: 30000,
      },
    ]);
    // Existing alert found
    mockAlertFindFirst.mockResolvedValueOnce({ id: 'existing-alert' });

    const result = await service.detectSpikes(new Date('2026-03-11'));

    expect(result.spikesDetected).toBe(1);
    expect(result.alertsCreated).toBe(0); // skipped because alert exists
    expect(mockAlertCreate).not.toHaveBeenCalled();
  });

  it('handles multiple tenants with mixed spike/no-spike', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        tenant_id: 'tenant-spike',
        daily_tokens: BigInt(400000),
        rolling_avg_tokens: 100000, // 4x > 3x
      },
      {
        tenant_id: 'tenant-normal',
        daily_tokens: BigInt(90000),
        rolling_avg_tokens: 100000, // 0.9x < 3x
      },
    ]);
    mockAlertFindFirst.mockResolvedValueOnce(null);
    mockAlertCreate.mockResolvedValueOnce({ id: 'alert-1' });

    const result = await service.detectSpikes(new Date('2026-03-11'));

    expect(result.tenantsChecked).toBe(2);
    expect(result.spikesDetected).toBe(1);
    expect(result.alertsCreated).toBe(1);
  });

  it('uses yesterday as default date when none provided', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    await service.detectSpikes();

    // $queryRaw with Prisma.sql tagged template is called with a single
    // tagged template argument — verify it was called once
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);

    // Verify the logger recorded yesterday's date
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ date: yesterday }),
      expect.stringContaining('starting daily check'),
    );
  });

  it('handles empty result set gracefully', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await service.detectSpikes(new Date('2026-03-11'));

    expect(result.tenantsChecked).toBe(0);
    expect(result.spikesDetected).toBe(0);
    expect(result.alertsCreated).toBe(0);
  });
});
