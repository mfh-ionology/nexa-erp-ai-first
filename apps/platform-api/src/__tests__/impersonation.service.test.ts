// ---------------------------------------------------------------------------
// Impersonation Service Unit Tests — E13b.5 Task 1.5
// Covers: reason validation (BR-PLT-012), session creation, default/custom
// duration (BR-PLT-013), tenant status check, JWT generation, session end,
// getActiveSession, listSessions pagination
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup — must be before imports
// ---------------------------------------------------------------------------

const mockTenantFindUnique = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockSessionFindFirst = vi.fn();
const mockSessionFindMany = vi.fn();
const mockSessionCount = vi.fn();
const mockSessionUpdate = vi.fn();

vi.mock('../client.js', () => ({
  getPlatformPrisma: () => ({
    tenant: { findUnique: mockTenantFindUnique },
    impersonationSession: {
      create: mockSessionCreate,
      findUnique: mockSessionFindUnique,
      findFirst: mockSessionFindFirst,
      findMany: mockSessionFindMany,
      count: mockSessionCount,
      update: mockSessionUpdate,
    },
  }),
}));

// Mock jose SignJWT
vi.mock('jose', () => {
  const mockSign = vi.fn().mockResolvedValue('mock-jwt-token');
  return {
    SignJWT: vi.fn().mockImplementation(() => ({
      setProtectedHeader: vi.fn().mockReturnThis(),
      setSubject: vi.fn().mockReturnThis(),
      setIssuer: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      sign: mockSign,
    })),
  };
});

// Set required env var
process.env.PLATFORM_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

// Import after mocks
import {
  startImpersonation,
  endImpersonation,
  getActiveSession,
  listSessions,
} from '../services/impersonation.service.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const PLATFORM_USER_ID = '00000000-0000-4000-a000-000000000001';
const TENANT_ID = '00000000-0000-4000-a000-000000000002';
const SESSION_ID = '00000000-0000-4000-a000-000000000003';

const ACTIVE_TENANT = { id: TENANT_ID, status: 'ACTIVE' };
const SUSPENDED_TENANT = { id: TENANT_ID, status: 'SUSPENDED' };

const NOW = new Date('2026-03-11T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startImpersonation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects empty reason (BR-PLT-012)', async () => {
    await expect(
      startImpersonation({
        platformUserId: PLATFORM_USER_ID,
        tenantId: TENANT_ID,
        reason: '',
      }),
    ).rejects.toThrow('Impersonation reason is required');
  });

  it('rejects whitespace-only reason (BR-PLT-012)', async () => {
    await expect(
      startImpersonation({
        platformUserId: PLATFORM_USER_ID,
        tenantId: TENANT_ID,
        reason: '   ',
      }),
    ).rejects.toThrow('Impersonation reason is required');
  });

  it('creates session with correct expiresAt for custom duration', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(ACTIVE_TENANT);
    mockSessionFindFirst.mockResolvedValueOnce(null); // No active session
    mockSessionCreate.mockResolvedValueOnce({ id: SESSION_ID });

    const result = await startImpersonation({
      platformUserId: PLATFORM_USER_ID,
      tenantId: TENANT_ID,
      reason: 'Debugging billing issue',
      durationMinutes: 120,
    });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.token).toBe('mock-jwt-token');

    // expiresAt should be NOW + 120 minutes
    const expectedExpiry = new Date(NOW.getTime() + 120 * 60 * 1000);
    expect(result.expiresAt).toBe(expectedExpiry.toISOString());

    // Verify session was created with correct data
    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platformUserId: PLATFORM_USER_ID,
        tenantId: TENANT_ID,
        reason: 'Debugging billing issue',
        expiresAt: expectedExpiry,
      }),
    });
  });

  it('defaults to 60-minute duration', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(ACTIVE_TENANT);
    mockSessionFindFirst.mockResolvedValueOnce(null); // No active session
    mockSessionCreate.mockResolvedValueOnce({ id: SESSION_ID });

    const result = await startImpersonation({
      platformUserId: PLATFORM_USER_ID,
      tenantId: TENANT_ID,
      reason: 'Checking configuration',
    });

    const expectedExpiry = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(result.expiresAt).toBe(expectedExpiry.toISOString());
  });

  it('rejects impersonation of non-ACTIVE tenant', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(SUSPENDED_TENANT);

    await expect(
      startImpersonation({
        platformUserId: PLATFORM_USER_ID,
        tenantId: TENANT_ID,
        reason: 'Test reason',
      }),
    ).rejects.toThrow('Can only impersonate active tenants');
  });

  it('rejects impersonation of non-existent tenant', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(null);

    await expect(
      startImpersonation({
        platformUserId: PLATFORM_USER_ID,
        tenantId: TENANT_ID,
        reason: 'Test reason',
      }),
    ).rejects.toThrow('Tenant not found');
  });

  it('generates valid impersonation JWT', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(ACTIVE_TENANT);
    mockSessionFindFirst.mockResolvedValueOnce(null); // No active session
    mockSessionCreate.mockResolvedValueOnce({ id: SESSION_ID });

    const result = await startImpersonation({
      platformUserId: PLATFORM_USER_ID,
      tenantId: TENANT_ID,
      reason: 'Debugging issue',
    });

    expect(result.token).toBe('mock-jwt-token');

    // Verify SignJWT was constructed
    const { SignJWT } = await import('jose');
    expect(SignJWT).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        sessionId: SESSION_ID,
        type: 'impersonation',
      }),
    );
  });

  it('trims reason before saving', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(ACTIVE_TENANT);
    mockSessionFindFirst.mockResolvedValueOnce(null); // No active session
    mockSessionCreate.mockResolvedValueOnce({ id: SESSION_ID });

    await startImpersonation({
      platformUserId: PLATFORM_USER_ID,
      tenantId: TENANT_ID,
      reason: '  Trimmed reason  ',
    });

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'Trimmed reason',
      }),
    });
  });

  it('rejects duration exceeding 480 minutes', async () => {
    await expect(
      startImpersonation({
        platformUserId: PLATFORM_USER_ID,
        tenantId: TENANT_ID,
        reason: 'Test',
        durationMinutes: 500,
      }),
    ).rejects.toThrow('Duration must be between 1 and 480 minutes');
  });

  it('rejects when admin already has an active session (Fix #7)', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(ACTIVE_TENANT);
    // Simulate an existing active session
    mockSessionFindFirst.mockResolvedValueOnce({ id: 'existing-session-id' });

    await expect(
      startImpersonation({
        platformUserId: PLATFORM_USER_ID,
        tenantId: TENANT_ID,
        reason: 'Second session attempt',
      }),
    ).rejects.toThrow('You already have an active impersonation session');

    // Should NOT have created a new session
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('allows new session when no active session exists (Fix #7)', async () => {
    mockTenantFindUnique.mockResolvedValueOnce(ACTIVE_TENANT);
    // No active session
    mockSessionFindFirst.mockResolvedValueOnce(null);
    mockSessionCreate.mockResolvedValueOnce({ id: SESSION_ID });

    const result = await startImpersonation({
      platformUserId: PLATFORM_USER_ID,
      tenantId: TENANT_ID,
      reason: 'First session',
    });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(mockSessionCreate).toHaveBeenCalled();
  });
});

describe('endImpersonation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets endedAt and returns duration', async () => {
    const sessionStartedAt = new Date(NOW.getTime() - 30 * 60 * 1000); // 30 min ago
    mockSessionFindUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUserId: PLATFORM_USER_ID,
      tenantId: TENANT_ID,
      startedAt: sessionStartedAt,
      endedAt: null,
    });
    mockSessionUpdate.mockResolvedValueOnce({});

    const result = await endImpersonation(SESSION_ID, PLATFORM_USER_ID);

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.endedAt).toBe(NOW.toISOString());
    expect(result.duration).toBe(30 * 60); // 1800 seconds

    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { endedAt: NOW },
    });
  });

  it('throws if session not found', async () => {
    mockSessionFindUnique.mockResolvedValueOnce(null);

    await expect(endImpersonation(SESSION_ID, PLATFORM_USER_ID)).rejects.toThrow(
      'Impersonation session not found',
    );
  });

  it('throws if session belongs to different user', async () => {
    mockSessionFindUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUserId: 'other-user-id',
      endedAt: null,
    });

    await expect(endImpersonation(SESSION_ID, PLATFORM_USER_ID)).rejects.toThrow(
      'Session does not belong to caller',
    );
  });

  it('throws if session already ended', async () => {
    mockSessionFindUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUserId: PLATFORM_USER_ID,
      endedAt: new Date('2026-03-11T09:30:00.000Z'),
    });

    await expect(endImpersonation(SESSION_ID, PLATFORM_USER_ID)).rejects.toThrow(
      'Impersonation session has already ended',
    );
  });
});

describe('getActiveSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no active session', async () => {
    mockSessionFindFirst.mockResolvedValueOnce(null);

    const result = await getActiveSession(PLATFORM_USER_ID);

    expect(result).toBeNull();
  });

  it('returns formatted session detail when active session exists', async () => {
    mockSessionFindFirst.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUser: { id: PLATFORM_USER_ID, email: 'admin@nexa.co', displayName: 'Admin' },
      tenant: { id: TENANT_ID, code: 'acme', displayName: 'Acme Corp' },
      reason: 'Debugging',
      startedAt: new Date('2026-03-11T09:00:00.000Z'),
      endedAt: null,
      expiresAt: new Date('2026-03-11T10:00:00.000Z'),
      actionsLog: [{ action: 'view_dashboard' }, { action: 'view_invoice' }],
    });

    const result = await getActiveSession(PLATFORM_USER_ID);

    expect(result).toEqual({
      id: SESSION_ID,
      platformUser: { id: PLATFORM_USER_ID, email: 'admin@nexa.co', displayName: 'Admin' },
      tenant: { id: TENANT_ID, code: 'acme', displayName: 'Acme Corp' },
      reason: 'Debugging',
      startedAt: '2026-03-11T09:00:00.000Z',
      endedAt: null,
      expiresAt: '2026-03-11T10:00:00.000Z',
      actionsCount: 2,
    });
  });

  it('returns actionsCount 0 when actionsLog is null', async () => {
    mockSessionFindFirst.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUser: { id: PLATFORM_USER_ID, email: 'admin@nexa.co', displayName: 'Admin' },
      tenant: { id: TENANT_ID, code: 'acme', displayName: 'Acme Corp' },
      reason: 'Test',
      startedAt: new Date('2026-03-11T09:00:00.000Z'),
      endedAt: null,
      expiresAt: new Date('2026-03-11T10:00:00.000Z'),
      actionsLog: null,
    });

    const result = await getActiveSession(PLATFORM_USER_ID);
    expect(result?.actionsCount).toBe(0);
  });
});

describe('listSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated results', async () => {
    const sessions = [
      {
        id: SESSION_ID,
        platformUser: { id: PLATFORM_USER_ID, email: 'admin@nexa.co', displayName: 'Admin' },
        tenant: { id: TENANT_ID, code: 'acme', displayName: 'Acme Corp' },
        reason: 'Test',
        startedAt: new Date('2026-03-11T09:00:00.000Z'),
        endedAt: new Date('2026-03-11T09:30:00.000Z'),
        expiresAt: new Date('2026-03-11T10:00:00.000Z'),
        actionsLog: null,
      },
    ];
    mockSessionFindMany.mockResolvedValueOnce(sessions);
    mockSessionCount.mockResolvedValueOnce(1);

    const result = await listSessions({ limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.items[0]!.id).toBe(SESSION_ID);
  });

  it('indicates hasMore when more results exist', async () => {
    // Return limit+1 items to trigger hasMore
    const sessions = Array.from({ length: 3 }, (_, i) => ({
      id: `session-${String(i)}`,
      platformUser: { id: PLATFORM_USER_ID, email: 'admin@nexa.co', displayName: 'Admin' },
      tenant: { id: TENANT_ID, code: 'acme', displayName: 'Acme Corp' },
      reason: 'Test',
      startedAt: new Date('2026-03-11T09:00:00.000Z'),
      endedAt: null,
      expiresAt: new Date('2026-03-11T10:00:00.000Z'),
      actionsLog: null,
    }));
    mockSessionFindMany.mockResolvedValueOnce(sessions);
    mockSessionCount.mockResolvedValueOnce(5);

    const result = await listSessions({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(5);
  });

  it('applies tenantId filter', async () => {
    mockSessionFindMany.mockResolvedValueOnce([]);
    mockSessionCount.mockResolvedValueOnce(0);

    await listSessions({ tenantId: TENANT_ID });

    expect(mockSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      }),
    );
  });

  it('applies date range filter', async () => {
    mockSessionFindMany.mockResolvedValueOnce([]);
    mockSessionCount.mockResolvedValueOnce(0);

    await listSessions({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-11T23:59:59.000Z',
    });

    expect(mockSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startedAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lte: new Date('2026-03-11T23:59:59.000Z'),
          },
        }),
      }),
    );
  });

  it('uses cursor-based pagination', async () => {
    mockSessionFindMany.mockResolvedValueOnce([]);
    mockSessionCount.mockResolvedValueOnce(0);

    await listSessions({ cursor: SESSION_ID });

    expect(mockSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: SESSION_ID },
        skip: 1,
      }),
    );
  });
});
