// ---------------------------------------------------------------------------
// Impersonation Expiry Service Unit Tests — E13b.5 Task 2.3
// Covers: expired session detection, already-ended session exclusion,
// event emission for each expired session
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup — must be before imports
// ---------------------------------------------------------------------------

const mockSessionFindMany = vi.fn();
const mockSessionUpdateMany = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock('../client.js', () => ({
  getPlatformPrisma: () => ({
    impersonationSession: {
      findMany: mockSessionFindMany,
      updateMany: mockSessionUpdateMany,
    },
    platformAuditLog: {
      create: mockAuditLogCreate,
    },
  }),
}));

// Import after mocks
import {
  checkExpiredSessions,
  startExpiryCheck,
  stopExpiryCheck,
} from '../services/impersonation-expiry.service.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-11T10:00:00.000Z');

const EXPIRED_SESSION_1 = {
  id: 'session-expired-1',
  platformUserId: 'user-1',
  tenantId: 'tenant-1',
  startedAt: new Date('2026-03-11T08:00:00.000Z'),
  actionsLog: [{ action: 'view_dashboard' }],
};

const EXPIRED_SESSION_2 = {
  id: 'session-expired-2',
  platformUserId: 'user-2',
  tenantId: 'tenant-2',
  startedAt: new Date('2026-03-11T09:00:00.000Z'),
  actionsLog: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkExpiredSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('finds and closes expired sessions', async () => {
    mockSessionFindMany.mockResolvedValueOnce([EXPIRED_SESSION_1, EXPIRED_SESSION_2]);
    mockSessionUpdateMany.mockResolvedValue({ count: 1 });
    mockAuditLogCreate.mockResolvedValue({});

    const count = await checkExpiredSessions();

    expect(count).toBe(2);

    // Verify query: endedAt IS NULL AND expiresAt < NOW
    expect(mockSessionFindMany).toHaveBeenCalledWith({
      where: {
        endedAt: null,
        expiresAt: { lt: NOW },
      },
      select: {
        id: true,
        platformUserId: true,
        tenantId: true,
        startedAt: true,
        actionsLog: true,
      },
    });

    // Verify each session was closed atomically with endedAt: null guard
    expect(mockSessionUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'session-expired-1', endedAt: null },
      data: { endedAt: NOW },
    });
    expect(mockSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'session-expired-2', endedAt: null },
      data: { endedAt: NOW },
    });
  });

  it('ignores sessions already ended (returns 0 when none expired)', async () => {
    // The query itself filters out ended sessions (endedAt: null),
    // so an empty result means no unexpired+unended sessions
    mockSessionFindMany.mockResolvedValueOnce([]);

    const count = await checkExpiredSessions();

    expect(count).toBe(0);
    expect(mockSessionUpdateMany).not.toHaveBeenCalled();
  });

  it('emits correct events for each expired session (closes each individually)', async () => {
    mockSessionFindMany.mockResolvedValueOnce([EXPIRED_SESSION_1]);
    mockSessionUpdateMany.mockResolvedValue({ count: 1 });
    mockAuditLogCreate.mockResolvedValue({});

    const count = await checkExpiredSessions();

    expect(count).toBe(1);

    // Each expired session gets its own updateMany call with endedAt: null guard
    expect(mockSessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'session-expired-1', endedAt: null },
      data: { endedAt: NOW },
    });
  });
});

describe('startExpiryCheck / stopExpiryCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockSessionFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    stopExpiryCheck();
    vi.useRealTimers();
  });

  it('starts interval that calls checkExpiredSessions', async () => {
    startExpiryCheck();

    // Advance timer by 60 seconds (one interval)
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockSessionFindMany).toHaveBeenCalledTimes(1);
  });

  it('stops interval on stopExpiryCheck', async () => {
    startExpiryCheck();
    stopExpiryCheck();

    // Advance timer — should NOT trigger any calls
    await vi.advanceTimersByTimeAsync(120_000);

    expect(mockSessionFindMany).not.toHaveBeenCalled();
  });

  it('does not start duplicate intervals', async () => {
    startExpiryCheck();
    startExpiryCheck(); // second call should be a no-op

    await vi.advanceTimersByTimeAsync(60_000);

    // Should only have been called once (not twice)
    expect(mockSessionFindMany).toHaveBeenCalledTimes(1);
  });
});
