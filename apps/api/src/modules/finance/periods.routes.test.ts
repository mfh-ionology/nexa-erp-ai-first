import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockEventBus } = vi.hoisted(() => ({
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    drain: vi.fn(),
  },
  mockPrisma: {
    user: { findUnique: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    systemSetting: { findMany: vi.fn() },
    financialPeriod: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  SettingCategory: {
    GENERAL: 'GENERAL',
    FINANCE: 'FINANCE',
  },
  SettingValueType: {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    JSON: 'JSON',
  },
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
import { periodsRoutesPlugin } from './periods.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_PERIOD_ID = '22222222-2222-4000-a000-222222222222';

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTestJwt(overrides: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({
    tenantId: TEST_TENANT_ID,
    role: 'ADMIN',
    enabledModules: ['FINANCE'],
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(TEST_USER_ID)
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secretBytes);
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  registerErrorHandler(app);
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);

  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(periodsRoutesPlugin, { prefix: '/finance' });

  await app.ready();
  return app;
}

function setupMocks() {
  // Middleware queries
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });

  mockResolveUserRole.mockResolvedValue('ADMIN');

  // Default: fiscal year start month = 1 (January)
  mockPrisma.systemSetting.findMany.mockResolvedValue([]);

  // Configure permission service: full access for ADMIN
  mockPermissionService.getEffectivePermissions.mockImplementation(
    async (_prisma: unknown, _userId: string, _companyId: string, userRole: string) => {
      const hasAccess = ['ADMIN', 'MANAGER'].includes(userRole);
      const fullPerm = {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      };
      return {
        permissions: hasAccess ? { 'finance.periods': fullPerm, 'finance.settings': fullPerm } : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

/** Create a mock period row as Prisma would return */
function makeMockPeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_PERIOD_ID,
    name: 'January 2026',
    periodNumber: 1,
    fiscalYear: 2026,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
    status: 'OPEN',
    closedAt: null,
    closedBy: null,
    lockedAt: null,
    lockedBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;
let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

afterEach(async () => {
  if (app) await app.close();
});

// ---------------------------------------------------------------------------
// POST /finance/periods/year — AC-1: Create fiscal year
// ---------------------------------------------------------------------------

describe('POST /finance/periods/year', () => {
  it('creates 12 monthly periods for January fiscal year start (AC-1)', async () => {
    app = await buildTestApp();

    // No existing year
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    // Mock transaction to execute callback
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Track created periods
    const createdPeriods: Array<Record<string, unknown>> = [];
    mockPrisma.financialPeriod.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        const period = makeMockPeriod({
          id: `period-${String(data.periodNumber)}`,
          name: data.name,
          periodNumber: data.periodNumber,
          fiscalYear: data.fiscalYear,
          startDate: data.startDate,
          endDate: data.endDate,
        });
        createdPeriods.push(period);
        return period;
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/finance/periods/year',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { fiscalYear: 2026 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(12);

    // Verify period 1 is January 2026
    expect(body.data[0].periodNumber).toBe(1);
    expect(body.data[0].name).toBe('January 2026');
    expect(body.data[0].startDate).toBe('2026-01-01');
    expect(body.data[0].endDate).toBe('2026-01-31');

    // Verify period 12 is December 2026
    expect(body.data[11].periodNumber).toBe(12);
    expect(body.data[11].name).toBe('December 2026');
    expect(body.data[11].startDate).toBe('2026-12-01');
    expect(body.data[11].endDate).toBe('2026-12-31');

    // All periods should be OPEN by default
    for (const period of body.data) {
      expect(period.status).toBe('OPEN');
    }
  });

  it('creates 12 periods for April fiscal year start (AC-1)', async () => {
    app = await buildTestApp();

    // Override fiscal year start month to April (4)
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'general.fiscalYearStartMonth', value: '4', valueType: 'NUMBER' },
    ]);

    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.financialPeriod.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        return makeMockPeriod({
          id: `period-${String(data.periodNumber)}`,
          name: data.name,
          periodNumber: data.periodNumber,
          fiscalYear: data.fiscalYear,
          startDate: data.startDate,
          endDate: data.endDate,
        });
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/finance/periods/year',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { fiscalYear: 2026 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveLength(12);

    // Period 1 = April 2026
    expect(body.data[0].periodNumber).toBe(1);
    expect(body.data[0].name).toBe('April 2026');
    expect(body.data[0].startDate).toBe('2026-04-01');
    expect(body.data[0].endDate).toBe('2026-04-30');

    // Period 12 = March 2027
    expect(body.data[11].periodNumber).toBe(12);
    expect(body.data[11].name).toBe('March 2027');
    expect(body.data[11].startDate).toBe('2027-03-01');
    expect(body.data[11].endDate).toBe('2027-03-31');
  });

  it('creates 13 periods when includeP13=true (Period 13)', async () => {
    app = await buildTestApp();

    // April start month
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'general.fiscalYearStartMonth', value: '4', valueType: 'NUMBER' },
    ]);

    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.financialPeriod.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        return makeMockPeriod({
          id: `period-${String(data.periodNumber)}`,
          name: data.name,
          periodNumber: data.periodNumber,
          fiscalYear: data.fiscalYear,
          startDate: data.startDate,
          endDate: data.endDate,
        });
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/finance/periods/year',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { fiscalYear: 2026, includeP13: true },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveLength(13);

    // Period 13 = year-end adjustments
    expect(body.data[12].periodNumber).toBe(13);
    expect(body.data[12].name).toBe('Year-End Adjustments 2026/27');
    // P13 start and end dates match last period's end date
    expect(body.data[12].startDate).toBe('2027-03-31');
    expect(body.data[12].endDate).toBe('2027-03-31');
  });

  it('rejects duplicate fiscal year (AC-6)', async () => {
    app = await buildTestApp();

    // Year already exists
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({ id: 'existing-id' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/periods/year',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { fiscalYear: 2026 },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DUPLICATE_FISCAL_YEAR');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/periods/year',
      headers: { 'content-type': 'application/json' },
      payload: { fiscalYear: 2026 },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid fiscal year', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/periods/year',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { fiscalYear: 1999 },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/periods — AC-2: List periods grouped by fiscal year
// ---------------------------------------------------------------------------

describe('GET /finance/periods', () => {
  it('returns periods grouped by fiscal year with summary (AC-2)', async () => {
    app = await buildTestApp();

    const mockPeriods = [
      makeMockPeriod({ periodNumber: 1, name: 'January 2026', status: 'OPEN' }),
      makeMockPeriod({
        periodNumber: 2,
        name: 'February 2026',
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: TEST_USER_ID,
      }),
      makeMockPeriod({
        periodNumber: 3,
        name: 'March 2026',
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy: TEST_USER_ID,
      }),
    ];

    mockPrisma.financialPeriod.findMany.mockResolvedValue(mockPeriods);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/periods',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1); // One fiscal year group

    const yearGroup = body.data[0];
    expect(yearGroup.fiscalYear).toBe(2026);
    expect(yearGroup.periods).toHaveLength(3);
    expect(yearGroup.summary.total).toBe(3);
    expect(yearGroup.summary.open).toBe(1);
    expect(yearGroup.summary.closed).toBe(1);
    expect(yearGroup.summary.locked).toBe(1);
  });

  it('filters by fiscalYear query param', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/periods?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.financialPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fiscalYear: 2026 }),
      }),
    );
  });

  it('filters by status query param', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/periods?status=OPEN',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.financialPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'OPEN' }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/periods',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/periods/:id/close — AC-3: Close period
// ---------------------------------------------------------------------------

describe('POST /finance/periods/:id/close', () => {
  it('closes an OPEN period (AC-3)', async () => {
    app = await buildTestApp();

    const openPeriod = makeMockPeriod({ status: 'OPEN' });
    const closedPeriod = makeMockPeriod({
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: TEST_USER_ID,
    });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(openPeriod);
    mockPrisma.financialPeriod.update.mockResolvedValue(closedPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CLOSED');
    expect(body.data.closedBy).toBe(TEST_USER_ID);
  });

  it('rejects closing a CLOSED period (AC-6)', async () => {
    app = await buildTestApp();

    const closedPeriod = makeMockPeriod({ status: 'CLOSED' });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(closedPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects closing a LOCKED period (AC-6)', async () => {
    app = await buildTestApp();

    const lockedPeriod = makeMockPeriod({ status: 'LOCKED' });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(lockedPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 404 for non-existent period', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/periods/:id/reopen — AC-4: Reopen period
// ---------------------------------------------------------------------------

describe('POST /finance/periods/:id/reopen', () => {
  it('reopens a CLOSED period (AC-4)', async () => {
    app = await buildTestApp();

    const closedPeriod = makeMockPeriod({
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: TEST_USER_ID,
    });
    const openPeriod = makeMockPeriod({
      status: 'OPEN',
      closedAt: null,
      closedBy: null,
    });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(closedPeriod);
    mockPrisma.financialPeriod.update.mockResolvedValue(openPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/reopen`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('OPEN');
    expect(body.data.closedAt).toBeNull();
    expect(body.data.closedBy).toBeNull();
  });

  it('rejects reopening a LOCKED period (AC-6, BR-FIN-016)', async () => {
    app = await buildTestApp();

    const lockedPeriod = makeMockPeriod({
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedBy: TEST_USER_ID,
    });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(lockedPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/reopen`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('PERIOD_LOCKED');
  });

  it('rejects reopening an OPEN period', async () => {
    app = await buildTestApp();

    const openPeriod = makeMockPeriod({ status: 'OPEN' });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(openPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/reopen`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('returns 404 for non-existent period', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/reopen`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/periods/:id/lock — AC-5: Lock period (BR-FIN-016)
// ---------------------------------------------------------------------------

describe('POST /finance/periods/:id/lock', () => {
  it('locks a CLOSED period (AC-5)', async () => {
    app = await buildTestApp();

    const closedPeriod = makeMockPeriod({
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: TEST_USER_ID,
    });
    const lockedPeriod = makeMockPeriod({
      status: 'LOCKED',
      closedAt: new Date(),
      closedBy: TEST_USER_ID,
      lockedAt: new Date(),
      lockedBy: TEST_USER_ID,
    });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(closedPeriod);
    mockPrisma.financialPeriod.update.mockResolvedValue(lockedPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/lock`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('LOCKED');
    expect(body.data.lockedBy).toBe(TEST_USER_ID);
    expect(body.data.lockedAt).toBeTruthy();
  });

  it('rejects locking an OPEN period (AC-6)', async () => {
    app = await buildTestApp();

    const openPeriod = makeMockPeriod({ status: 'OPEN' });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(openPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/lock`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('CANNOT_LOCK_OPEN_PERIOD');
  });

  it('rejects locking an already LOCKED period (AC-6)', async () => {
    app = await buildTestApp();

    const lockedPeriod = makeMockPeriod({
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedBy: TEST_USER_ID,
    });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(lockedPeriod);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/lock`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('PERIOD_ALREADY_LOCKED');
  });

  it('returns 404 for non-existent period', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/lock`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Permission checks
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('returns 403 for VIEWER role on POST /periods/year', async () => {
    app = await buildTestApp();
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/periods/year',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { fiscalYear: 2026 },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on GET /periods', async () => {
    app = await buildTestApp();
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/periods',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /periods/:id/lock', async () => {
    app = await buildTestApp();
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/periods/${TEST_PERIOD_ID}/lock`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
