import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockResolveUserRole: vi.fn(),
  mockPermissionService: {
    getEffectivePermissions: vi.fn(),
    hasPermission: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateGroup: vi.fn(),
    invalidateAll: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn(),
    deriveEnabledModules: vi.fn(),
    getFieldVisibility: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { auditLogRoutesPlugin } from './audit-log.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const OTHER_COMPANY_ID = '22222222-2222-4000-a000-222222222222';
const OTHER_USER_ID = '33333333-3333-4000-a000-333333333333';
const ENTITY_ID_1 = 'eeeeeeee-0000-4000-a000-000000000001';
const ENTITY_ID_2 = 'eeeeeeee-0000-4000-a000-000000000002';

function sampleAuditRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-0000-4000-a000-000000000001',
    companyId: TEST_COMPANY_ID,
    entityType: 'User',
    entityId: ENTITY_ID_1,
    action: 'UPDATE',
    beforeData: null,
    afterData: { mfaAction: 'setup' },
    userId: TEST_USER_ID,
    isAiAction: false,
    aiConfidence: null,
    correlationId: null,
    timestamp: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(auditLogRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';

  mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
    if (args.where.id === TEST_USER_ID) {
      return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
    }
    return Promise.resolve(null);
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  // Configure permission service mock
  if (resolvedRole === 'SUPER_ADMIN') {
    const fullPerm = { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true };
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'system.audit-log.list': fullPerm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else {
    const hasAccess = ['ADMIN', 'MANAGER'].includes(resolvedRole);
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: hasAccess
        ? { 'system.audit-log.list': { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false } }
        : {},
      fieldOverrides: {},
      accessGroups: hasAccess ? [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }] : [],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: hasAccess ? ['system'] : [],
    });
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction mock: resolve the array of PrismaPromise objects via Promise.all
  mockPrisma.$transaction.mockImplementation((promises: Promise<unknown>[]) => Promise.all(promises));
});

// ---------------------------------------------------------------------------
// GET /system/audit-log — filtered, cursor-paginated query
// ---------------------------------------------------------------------------

describe('GET /system/audit-log', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 10.2 — returns audit records scoped to the user's companyId (AC #3)
  it('returns audit records scoped to companyId (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });
    const records = [
      sampleAuditRecord(),
      sampleAuditRecord({
        id: 'aaaaaaaa-0000-4000-a000-000000000002',
        action: 'LOGIN',
        entityType: 'User',
      }),
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(records);
    mockPrisma.auditLog.count.mockResolvedValue(2);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/audit-log',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);

    // Verify companyId filter was passed to Prisma
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
      }),
    );
    expect(mockPrisma.auditLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
      }),
    );
  });

  // 10.3 — entityType filter returns only matching records (AC #3)
  it('filters by entityType (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });
    const records = [sampleAuditRecord({ entityType: 'AccessGroup' })];
    mockPrisma.auditLog.findMany.mockResolvedValue(records);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/audit-log?entityType=AccessGroup',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          entityType: 'AccessGroup',
        }),
      }),
    );
  });

  // 10.4 — userId filter returns only matching records (AC #3)
  it('filters by userId (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });
    const records = [sampleAuditRecord({ userId: OTHER_USER_ID })];
    mockPrisma.auditLog.findMany.mockResolvedValue(records);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/audit-log?userId=${OTHER_USER_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          userId: OTHER_USER_ID,
        }),
      }),
    );
  });

  // 10.5 — action filter returns only matching records (AC #3)
  it('filters by action (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });
    const records = [sampleAuditRecord({ action: 'CREATE' })];
    mockPrisma.auditLog.findMany.mockResolvedValue(records);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/audit-log?action=CREATE',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          action: 'CREATE',
        }),
      }),
    );
  });

  // 10.6 — dateFrom/dateTo filters return records in range (AC #3)
  it('filters by dateFrom and dateTo (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });
    const records = [sampleAuditRecord({ timestamp: new Date('2026-01-15T10:00:00Z') })];
    mockPrisma.auditLog.findMany.mockResolvedValue(records);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    app = await buildTestApp();

    const dateFrom = '2026-01-01T00:00:00Z';
    const dateTo = '2026-01-31T23:59:59Z';

    const res = await app.inject({
      method: 'GET',
      url: `/system/audit-log?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          timestamp: {
            gte: new Date(dateFrom),
            lte: new Date(dateTo),
          },
        }),
      }),
    );
  });

  // 10.7 — cursor pagination (AC #3)
  it('supports cursor pagination (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });

    // First page — fetch limit+1 (3) records to detect hasMore; route returns 2
    const firstPageRecords = [
      sampleAuditRecord({ id: 'aaaaaaaa-0000-4000-a000-000000000001' }),
      sampleAuditRecord({ id: 'aaaaaaaa-0000-4000-a000-000000000002' }),
      sampleAuditRecord({ id: 'aaaaaaaa-0000-4000-a000-000000000003' }), // extra for hasMore
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(firstPageRecords);
    mockPrisma.auditLog.count.mockResolvedValue(5);

    app = await buildTestApp();

    const firstRes = await app.inject({
      method: 'GET',
      url: '/system/audit-log?limit=2',
      headers: authHeaders(testJwt),
    });

    expect(firstRes.statusCode).toBe(200);
    const firstBody = firstRes.json();
    expect(firstBody.success).toBe(true);
    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.meta.hasMore).toBe(true);
    expect(firstBody.meta.cursor).toBe('aaaaaaaa-0000-4000-a000-000000000002');
    expect(firstBody.meta.total).toBe(5);

    // Second page — use cursor from first page
    const secondPageRecords = [
      sampleAuditRecord({ id: 'aaaaaaaa-0000-4000-a000-000000000003' }),
      sampleAuditRecord({ id: 'aaaaaaaa-0000-4000-a000-000000000004' }),
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(secondPageRecords);

    const cursorId = firstBody.meta.cursor;
    const secondRes = await app.inject({
      method: 'GET',
      url: `/system/audit-log?limit=2&cursor=${cursorId}`,
      headers: authHeaders(testJwt),
    });

    expect(secondRes.statusCode).toBe(200);
    const secondBody = secondRes.json();
    expect(secondBody.success).toBe(true);
    expect(secondBody.data).toHaveLength(2);

    // Verify cursor was passed to Prisma with skip: 1 and take: limit+1
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: { id: cursorId },
        skip: 1,
        take: 3,
      }),
    );
  });

  // 10.12 — records older than 6 years are still accessible (AC #6)
  it('returns records older than 6 years (AC #6)', async () => {
    setupMocks({ role: 'ADMIN' });

    // Record from 7 years ago
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    const oldRecord = sampleAuditRecord({
      id: 'aaaaaaaa-0000-4000-a000-000000000099',
      timestamp: sevenYearsAgo,
      action: 'CREATE',
      entityType: 'CompanyProfile',
    });
    mockPrisma.auditLog.findMany.mockResolvedValue([oldRecord]);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/audit-log',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);

    // The record from 7 years ago is returned — no automatic filtering by age
    const returnedTimestamp = new Date(body.data[0].timestamp);
    const yearsDiff = (Date.now() - returnedTimestamp.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    expect(yearsDiff).toBeGreaterThan(6);
  });
});

// ---------------------------------------------------------------------------
// GET /system/audit-log/:entityType/:entityId — entity change history
// ---------------------------------------------------------------------------

describe('GET /system/audit-log/:entityType/:entityId', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 10.8 — returns full history in chronological order (AC #4)
  it('returns full history in chronological order (AC #4)', async () => {
    setupMocks({ role: 'ADMIN' });
    const records = [
      sampleAuditRecord({
        id: 'aaaaaaaa-0000-4000-a000-000000000001',
        action: 'CREATE',
        timestamp: new Date('2026-01-01T10:00:00Z'),
      }),
      sampleAuditRecord({
        id: 'aaaaaaaa-0000-4000-a000-000000000002',
        action: 'UPDATE',
        timestamp: new Date('2026-01-15T10:00:00Z'),
      }),
      sampleAuditRecord({
        id: 'aaaaaaaa-0000-4000-a000-000000000003',
        action: 'DELETE',
        timestamp: new Date('2026-02-01T10:00:00Z'),
      }),
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(records);
    mockPrisma.auditLog.count.mockResolvedValue(3);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/audit-log/User/${ENTITY_ID_1}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);
    expect(body.meta.total).toBe(3);

    // Verify chronological order (ascending) — CREATE before UPDATE before DELETE
    expect(body.data[0].action).toBe('CREATE');
    expect(body.data[1].action).toBe('UPDATE');
    expect(body.data[2].action).toBe('DELETE');

    // Verify ascending order was passed to Prisma
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { timestamp: 'asc' },
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          entityType: 'User',
          entityId: ENTITY_ID_1,
        }),
      }),
    );
  });

  // 10.9 — does not return records from other companies (AC #4)
  it('does not return records from other companies (AC #4)', async () => {
    setupMocks({ role: 'ADMIN' });
    // Return empty — the other company's records are filtered out
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.count.mockResolvedValue(0);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/audit-log/User/${ENTITY_ID_2}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);

    // Verify companyId was always passed as filter — only the user's company
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
        }),
      }),
    );

    // Confirm OTHER_COMPANY_ID was NOT used
    const callArgs = mockPrisma.auditLog.findMany.mock.calls[0]![0] as { where: { companyId: string } };
    expect(callArgs.where.companyId).not.toBe(OTHER_COMPANY_ID);
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated — 401
// ---------------------------------------------------------------------------

describe('Unauthenticated requests get 401', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 10.10 — unauthenticated request to GET /system/audit-log returns 401
  it('GET /system/audit-log — 401 without auth (AC #3)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/audit-log',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // 10.10 — unauthenticated request to GET /system/audit-log/:entityType/:entityId returns 401
  it('GET /system/audit-log/:entityType/:entityId — 401 without auth (AC #3)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/audit-log/User/${ENTITY_ID_1}`,
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// RBAC — 403 for users without permission
// ---------------------------------------------------------------------------

describe('RBAC — user without system.audit-log.list permission gets 403', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 10.11 — user without permission returns 403
  it('GET /system/audit-log — 403 for STAFF (AC #3)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/audit-log',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('GET /system/audit-log/:entityType/:entityId — 403 for STAFF (AC #3)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/audit-log/User/${ENTITY_ID_1}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('GET /system/audit-log — 403 for VIEWER (AC #3)', async () => {
    setupMocks({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/audit-log',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
