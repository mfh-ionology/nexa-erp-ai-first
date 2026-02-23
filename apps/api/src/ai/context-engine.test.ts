import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockRedis, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    companyProfile: {
      findUnique: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
    userCompanyRole: {
      findFirst: vi.fn(),
    },
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
  },
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ContextEngine } from './context-engine.js';
import type { UserContext } from './context-engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContextEngine() {
  return new ContextEngine(
    mockRedis as any,
    mockPrisma as any,
    mockLogger as any,
  );
}

const userId = 'user-1';
const companyId = 'company-1';
const tenantId = 'tenant-1';
const redisKey = `${tenantId}:context:${userId}`;

const mockUser = {
  id: userId,
  firstName: 'John',
  lastName: 'Doe',
  locale: 'en-GB',
};

const mockCompany = {
  name: 'Acme Ltd',
  baseCurrencyCode: 'GBP',
  dateFormat: 'DD/MM/YYYY',
};

const mockRole = { role: 'ADMIN' };

const now = new Date('2026-02-22T10:00:00Z');

const mockAuditLogs = [
  {
    entityType: 'CustomerInvoice',
    entityId: 'inv-1',
    action: 'CREATE',
    timestamp: new Date('2026-02-22T09:30:00Z'),
  },
  {
    entityType: 'Customer',
    entityId: 'cust-1',
    action: 'UPDATE',
    timestamp: new Date('2026-02-22T09:00:00Z'),
  },
  {
    entityType: 'CustomerInvoice',
    entityId: 'inv-1',
    action: 'UPDATE',
    timestamp: new Date('2026-02-22T08:30:00Z'),
  },
];

function buildExpectedContext(): UserContext {
  return {
    user: { id: userId, name: 'John Doe', role: 'ADMIN' },
    tenant: { id: tenantId, companyName: 'Acme Ltd', baseCurrency: 'GBP' },
    recentEntities: [
      { type: 'CustomerInvoice', id: 'inv-1', name: 'inv-1', accessedAt: '2026-02-22T09:30:00.000Z' },
      { type: 'Customer', id: 'cust-1', name: 'cust-1', accessedAt: '2026-02-22T09:00:00.000Z' },
    ],
    recentActions: [
      { action: 'CREATE', entity: 'CustomerInvoice:inv-1', timestamp: '2026-02-22T09:30:00.000Z' },
      { action: 'UPDATE', entity: 'Customer:cust-1', timestamp: '2026-02-22T09:00:00.000Z' },
      { action: 'UPDATE', entity: 'CustomerInvoice:inv-1', timestamp: '2026-02-22T08:30:00.000Z' },
    ],
    currentPeriod: expect.objectContaining({
      isLocked: false,
    }),
    preferences: { dateFormat: 'DD/MM/YYYY', locale: 'en-GB' },
  };
}

/** Set up DB mocks to return standard test data */
function setupDbMocks() {
  mockPrisma.user.findUnique.mockResolvedValue(mockUser);
  mockPrisma.companyProfile.findUnique.mockResolvedValue(mockCompany);
  mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);
  mockPrisma.userCompanyRole.findFirst.mockResolvedValue(mockRole);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContextEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getUserContext', () => {
    it('builds context from DB on cache miss', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue(null);
      setupDbMocks();

      const context = await engine.getUserContext(userId, companyId, tenantId);

      // Verify DB queries were called
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, locale: true },
      });
      expect(mockPrisma.companyProfile.findUnique).toHaveBeenCalledWith({
        where: { id: companyId },
        select: { name: true, baseCurrencyCode: true, dateFormat: true },
      });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { companyId, userId },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: { entityType: true, entityId: true, action: true, timestamp: true },
      });
      expect(mockPrisma.userCompanyRole.findFirst).toHaveBeenCalledWith({
        where: { userId, companyId },
        select: { role: true },
      });

      // Verify context shape
      expect(context).toEqual(buildExpectedContext());

      // Verify it was cached in Redis with 15-minute TTL
      expect(mockRedis.set).toHaveBeenCalledWith(
        redisKey,
        expect.any(String),
        'EX',
        900,
      );
    });

    it('serves context from Redis on cache hit', async () => {
      const engine = createContextEngine();
      const cachedContext: UserContext = {
        user: { id: userId, name: 'Cached User', role: 'STAFF' },
        tenant: { id: tenantId, companyName: 'Cached Co', baseCurrency: 'USD' },
        recentEntities: [],
        recentActions: [],
        currentPeriod: { start: '2026-02-01', end: '2026-02-28', isLocked: false },
        preferences: { dateFormat: 'MM/DD/YYYY', locale: 'en-US' },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedContext));

      const context = await engine.getUserContext(userId, companyId, tenantId);

      // Should return cached data without DB queries
      expect(context).toEqual(cachedContext);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.companyProfile.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('rebuilds from DB if cached JSON is invalid', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue('not-valid-json{{{');
      setupDbMocks();

      const context = await engine.getUserContext(userId, companyId, tenantId);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { redisKey },
        'Failed to parse cached context, rebuilding',
      );
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      expect(context.user.name).toBe('John Doe');
    });

    it('uses defaults when user is not found', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.companyProfile.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.userCompanyRole.findFirst.mockResolvedValue(null);

      const context = await engine.getUserContext(userId, companyId, tenantId);

      expect(context.user.name).toBe('Unknown');
      expect(context.user.role).toBe('STAFF');
      expect(context.preferences.locale).toBe('en');
    });

    it('uses defaults when company is not found', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.companyProfile.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.userCompanyRole.findFirst.mockResolvedValue(null);

      const context = await engine.getUserContext(userId, companyId, tenantId);

      expect(context.tenant.companyName).toBe('Unknown');
      expect(context.tenant.baseCurrency).toBe('GBP');
      expect(context.preferences.dateFormat).toBe('DD/MM/YYYY');
    });

    it('deduplicates recent entities by type+id', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue(null);
      setupDbMocks();

      const context = await engine.getUserContext(userId, companyId, tenantId);

      // inv-1 appears twice in audit logs but should only appear once in recentEntities
      expect(context.recentEntities).toHaveLength(2);
      expect(context.recentEntities[0]!.id).toBe('inv-1');
      expect(context.recentEntities[1]!.id).toBe('cust-1');
    });
  });

  describe('updateContext', () => {
    it('merges update into existing cached context', async () => {
      const engine = createContextEngine();
      const existing: UserContext = {
        user: { id: userId, name: 'John Doe', role: 'ADMIN' },
        tenant: { id: tenantId, companyName: 'Acme Ltd', baseCurrency: 'GBP' },
        recentEntities: [],
        recentActions: [],
        currentPeriod: { start: '2026-02-01', end: '2026-02-28', isLocked: false },
        preferences: { dateFormat: 'DD/MM/YYYY', locale: 'en-GB' },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(existing));

      await engine.updateContext(userId, tenantId, {
        recentActions: [
          { action: 'CREATE', entity: 'Invoice:inv-99', timestamp: '2026-02-22T11:00:00Z' },
        ],
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        redisKey,
        expect.any(String),
        'EX',
        900,
      );

      // Parse the stored value and verify merge
      const storedJson = mockRedis.set.mock.calls[0]![1] as string;
      const stored = JSON.parse(storedJson) as UserContext;
      expect(stored.user.name).toBe('John Doe'); // preserved
      expect(stored.recentActions).toHaveLength(1); // updated
      expect(stored.recentActions[0]!.action).toBe('CREATE');
    });

    it('does nothing when no cached context exists', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue(null);

      await engine.updateContext(userId, tenantId, {
        user: { id: userId, name: 'Updated', role: 'MANAGER' },
      });

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { userId, tenantId },
        'No cached context to update',
      );
    });

    it('handles invalid cached JSON gracefully', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue('invalid-json');

      await engine.updateContext(userId, tenantId, {
        user: { id: userId, name: 'Updated', role: 'MANAGER' },
      });

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { redisKey },
        'Failed to parse cached context for update',
      );
    });
  });

  describe('refreshContext', () => {
    it('rebuilds context from DB and stores in Redis', async () => {
      const engine = createContextEngine();
      setupDbMocks();

      await engine.refreshContext(userId, companyId, tenantId);

      // DB queries should have been called
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      expect(mockPrisma.companyProfile.findUnique).toHaveBeenCalled();
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalled();

      // Should store in Redis with TTL
      expect(mockRedis.set).toHaveBeenCalledWith(
        redisKey,
        expect.any(String),
        'EX',
        900,
      );
    });
  });

  describe('TTL', () => {
    it('sets 15-minute (900s) TTL on getUserContext cache write', async () => {
      const engine = createContextEngine();
      mockRedis.get.mockResolvedValue(null);
      setupDbMocks();

      await engine.getUserContext(userId, companyId, tenantId);

      expect(mockRedis.set).toHaveBeenCalledWith(
        redisKey,
        expect.any(String),
        'EX',
        900,
      );
    });

    it('sets 15-minute (900s) TTL on updateContext cache write', async () => {
      const engine = createContextEngine();
      const existing: UserContext = {
        user: { id: userId, name: 'John Doe', role: 'ADMIN' },
        tenant: { id: tenantId, companyName: 'Acme Ltd', baseCurrency: 'GBP' },
        recentEntities: [],
        recentActions: [],
        currentPeriod: { start: '2026-02-01', end: '2026-02-28', isLocked: false },
        preferences: { dateFormat: 'DD/MM/YYYY', locale: 'en-GB' },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(existing));

      await engine.updateContext(userId, tenantId, {
        preferences: { locale: 'cy' },
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        redisKey,
        expect.any(String),
        'EX',
        900,
      );
    });
  });
});
