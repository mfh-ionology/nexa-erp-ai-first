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
    vatReturn: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    vatCode: {
      findMany: vi.fn(),
    },
    journalLine: {
      findMany: vi.fn(),
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
  Prisma: {
    Decimal: class Decimal {
      private value: number;
      constructor(v: number | string) {
        this.value = typeof v === 'string' ? parseFloat(v) : v;
      }
      toNumber() {
        return this.value;
      }
      toString() {
        return String(this.value);
      }
    },
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
import { vatReturnsRoutesPlugin } from './vat-returns.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_VAT_RETURN_ID = '22222222-2222-4000-a000-222222222222';

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
  await app.register(vatReturnsRoutesPlugin, { prefix: '/finance' });

  await app.ready();
  return app;
}

function setupMocks() {
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });

  mockResolveUserRole.mockResolvedValue('ADMIN');

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
        permissions: hasAccess
          ? {
              'finance.vatReturns': fullPerm,
            }
          : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

/** Sample VAT return data matching the Prisma model shape */
function makeSampleVatReturn(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_VAT_RETURN_ID,
    companyId: TEST_COMPANY_ID,
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-03-31'),
    status: 'DRAFT',
    box1: 0,
    box2: 0,
    box3: 0,
    box4: 0,
    box5: 0,
    box6: 0,
    box7: 0,
    box8: 0,
    box9: 0,
    calculatedAt: null,
    submittedAt: null,
    submittedBy: null,
    hmrcSubmissionId: null,
    hmrcResponse: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
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
// GET /finance/vat-returns — AC-1: list VAT returns with status
// ---------------------------------------------------------------------------

describe('GET /finance/vat-returns', () => {
  it('returns list of VAT returns with pagination meta', async () => {
    app = await buildTestApp();
    const returns = [
      makeSampleVatReturn(),
      makeSampleVatReturn({
        id: '33333333-3333-4000-a000-333333333333',
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-06-30'),
      }),
    ];

    mockPrisma.vatReturn.findMany.mockResolvedValue(returns);
    mockPrisma.vatReturn.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/vat-returns',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by status', async () => {
    app = await buildTestApp();
    mockPrisma.vatReturn.findMany.mockResolvedValue([]);
    mockPrisma.vatReturn.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/vat-returns?status=CALCULATED',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.vatReturn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          status: 'CALCULATED',
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/vat-returns',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/vat-returns/:id — AC-4: VAT return detail with all 9 boxes
// ---------------------------------------------------------------------------

describe('GET /finance/vat-returns/:id', () => {
  it('returns full VAT return detail with all 9 boxes', async () => {
    app = await buildTestApp();
    const sample = makeSampleVatReturn({
      status: 'CALCULATED',
      box1: 1500,
      box3: 1500,
      box5: 1500,
    });
    mockPrisma.vatReturn.findFirst.mockResolvedValue(sample);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_VAT_RETURN_ID);
    expect(body.data.box1).toBe(1500);
    expect(body.data.box3).toBe(1500);
    expect(body.data.box5).toBe(1500);
    expect(body.data.status).toBe('CALCULATED');
    expect(body.data).toHaveProperty('submittedAt');
    expect(body.data).toHaveProperty('hmrcSubmissionId');
  });

  it('returns 404 for non-existent VAT return', async () => {
    app = await buildTestApp();
    mockPrisma.vatReturn.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/vat-returns — AC-2, AC-5: create draft VAT return
// ---------------------------------------------------------------------------

describe('POST /finance/vat-returns', () => {
  it('creates a new draft VAT return', async () => {
    app = await buildTestApp();
    const created = makeSampleVatReturn();
    mockPrisma.vatReturn.findFirst.mockResolvedValue(null); // no overlap
    mockPrisma.vatReturn.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/vat-returns',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.id).toBe(TEST_VAT_RETURN_ID);
  });

  it('rejects overlapping period (AC-5)', async () => {
    app = await buildTestApp();
    // Simulate overlapping return found
    mockPrisma.vatReturn.findFirst.mockResolvedValue({ id: 'existing-id' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/vat-returns',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('OVERLAPPING_PERIOD');
  });

  it('rejects period where start >= end', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/vat-returns',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: {
        periodStart: '2026-03-31',
        periodEnd: '2026-01-01',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/vat-returns',
      payload: {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/vat-returns/:id/calculate — AC-3: calculate 9 boxes
// ---------------------------------------------------------------------------

describe('POST /finance/vat-returns/:id/calculate', () => {
  it('calculates boxes from posted journal lines', async () => {
    app = await buildTestApp();

    // Return a DRAFT vat return for the initial findFirst
    mockPrisma.vatReturn.findFirst.mockResolvedValue({
      id: TEST_VAT_RETURN_ID,
      status: 'DRAFT',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-03-31'),
    });

    // VAT codes: one standard output, one standard input
    mockPrisma.vatCode.findMany.mockResolvedValue([
      {
        code: 'STD',
        type: 'STANDARD',
        rate: 20,
        salesAccountCode: '2200',
        purchaseAccountCode: '2201',
      },
    ]);

    // Journal lines: one output VAT credit (sales), one input VAT debit (purchases)
    mockPrisma.journalLine.findMany.mockResolvedValue([
      // Output VAT: credit of 200 on sales VAT account
      { accountCode: '2200', debit: 0, credit: 200, vatCode: 'STD' },
      // Input VAT: debit of 50 on purchase VAT account
      { accountCode: '2201', debit: 50, credit: 0, vatCode: 'STD' },
    ]);

    // After update, return the calculated result
    const calculatedReturn = makeSampleVatReturn({
      status: 'CALCULATED',
      box1: 200,
      box2: 0,
      box3: 200,
      box4: 50,
      box5: 150,
      box6: 1000,
      box7: 250,
      box8: 0,
      box9: 0,
      calculatedAt: new Date(),
    });
    mockPrisma.vatReturn.update.mockResolvedValue(calculatedReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/calculate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CALCULATED');
    expect(body.data.box1).toBe(200);
    expect(body.data.box4).toBe(50);
    expect(body.data.box5).toBe(150);

    // Verify the update was called with calculated values
    expect(mockPrisma.vatReturn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_VAT_RETURN_ID },
        data: expect.objectContaining({
          box1: 200,
          box3: 200,
          box4: 50,
          box5: 150,
          box6: 1000,
          box7: 250,
          status: 'CALCULATED',
        }),
      }),
    );
  });

  it('handles empty journal lines (no VAT activity)', async () => {
    app = await buildTestApp();

    mockPrisma.vatReturn.findFirst.mockResolvedValue({
      id: TEST_VAT_RETURN_ID,
      status: 'DRAFT',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-03-31'),
    });

    mockPrisma.vatCode.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.findMany.mockResolvedValue([]);

    const calculatedReturn = makeSampleVatReturn({
      status: 'CALCULATED',
      calculatedAt: new Date(),
    });
    mockPrisma.vatReturn.update.mockResolvedValue(calculatedReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/calculate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.box1).toBe(0);
    expect(body.data.box5).toBe(0);

    // All boxes should be 0
    expect(mockPrisma.vatReturn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          box1: 0,
          box2: 0,
          box3: 0,
          box4: 0,
          box5: 0,
          box6: 0,
          box7: 0,
          box8: 0,
          box9: 0,
          status: 'CALCULATED',
        }),
      }),
    );
  });

  it('rejects calculate on SUBMITTED status', async () => {
    app = await buildTestApp();

    mockPrisma.vatReturn.findFirst.mockResolvedValue({
      id: TEST_VAT_RETURN_ID,
      status: 'SUBMITTED',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-03-31'),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/calculate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  it('returns 404 for non-existent VAT return', async () => {
    app = await buildTestApp();
    mockPrisma.vatReturn.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/calculate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('allows recalculation on CALCULATED status', async () => {
    app = await buildTestApp();

    mockPrisma.vatReturn.findFirst.mockResolvedValue({
      id: TEST_VAT_RETURN_ID,
      status: 'CALCULATED',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-03-31'),
    });

    mockPrisma.vatCode.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.findMany.mockResolvedValue([]);

    const calculatedReturn = makeSampleVatReturn({
      status: 'CALCULATED',
      calculatedAt: new Date(),
    });
    mockPrisma.vatReturn.update.mockResolvedValue(calculatedReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/calculate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CALCULATED');
  });
});
