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
    budget: {
      findFirst: vi.fn(),
    },
    budgetLine: {
      findFirst: vi.fn(),
    },
    budgetLineDimension: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    dimensionType: {
      findFirst: vi.fn(),
    },
    dimensionValue: {
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
        this.value = Number(v);
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
import { budgetDimensionSplitsRoutesPlugin } from './budget-dimension-splits.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_BUDGET_ID = '22222222-2222-4000-a000-222222222222';
const TEST_BUDGET_LINE_ID = '33333333-3333-4000-a000-333333333333';
const TEST_DIM_TYPE_ID = '44444444-4444-4000-a000-444444444444';
const TEST_DIM_VALUE_ID_1 = '55555555-5555-4000-a000-555555555555';
const TEST_DIM_VALUE_ID_2 = '66666666-6666-4000-a000-666666666666';
const TEST_SPLIT_ID_1 = '77777777-7777-4000-a000-777777777777';

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
  await app.register(budgetDimensionSplitsRoutesPlugin, { prefix: '/finance' });

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

  mockPrisma.systemSetting.findMany.mockResolvedValue([]);

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
        permissions: hasAccess ? { 'finance.budgets': fullPerm } : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

function makeMockBudgetLine(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BUDGET_LINE_ID,
    budgetId: TEST_BUDGET_ID,
    accountCode: '4000',
    period1: 1000,
    period2: 1000,
    period3: 1000,
    period4: 1000,
    period5: 1000,
    period6: 1000,
    period7: 1000,
    period8: 1000,
    period9: 1000,
    period10: 1000,
    period11: 1000,
    period12: 1000,
    totalAmount: 12000,
    ...overrides,
  };
}

function makeMockSplit(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SPLIT_ID_1,
    budgetLineId: TEST_BUDGET_LINE_ID,
    dimensionTypeId: TEST_DIM_TYPE_ID,
    dimensionValueId: TEST_DIM_VALUE_ID_1,
    period1: 600,
    period2: 600,
    period3: 600,
    period4: 600,
    period5: 600,
    period6: 600,
    period7: 600,
    period8: 600,
    period9: 600,
    period10: 600,
    period11: 600,
    period12: 600,
    totalAmount: 7200,
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
// GET /finance/budgets/:budgetId/lines/:lineId/dimension-splits
// ---------------------------------------------------------------------------

describe('GET /finance/budgets/:budgetId/lines/:lineId/dimension-splits', () => {
  it('returns splits for a budget line', async () => {
    app = await buildTestApp();
    const splits = [
      makeMockSplit(),
      makeMockSplit({
        id: '88888888-8888-4000-a000-888888888888',
        dimensionValueId: TEST_DIM_VALUE_ID_2,
        period1: 400,
        period2: 400,
        period3: 400,
        period4: 400,
        period5: 400,
        period6: 400,
        period7: 400,
        period8: 400,
        period9: 400,
        period10: 400,
        period11: 400,
        period12: 400,
        totalAmount: 4800,
      }),
    ];

    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine());
    mockPrisma.budgetLineDimension.findMany.mockResolvedValue(splits);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('filters by dimensionTypeId', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine());
    mockPrisma.budgetLineDimension.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits?dimensionTypeId=${TEST_DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.budgetLineDimension.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          budgetLineId: TEST_BUDGET_LINE_ID,
          dimensionTypeId: TEST_DIM_TYPE_ID,
        }),
      }),
    );
  });

  it('returns 404 when budget does not exist', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when budget line does not exist', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/budgets/:budgetId/lines/:lineId/dimension-splits
// ---------------------------------------------------------------------------

describe('PUT /finance/budgets/:budgetId/lines/:lineId/dimension-splits', () => {
  it('creates dimension splits when sums match parent line periods', async () => {
    app = await buildTestApp();
    const createdSplit1 = makeMockSplit();
    const createdSplit2 = makeMockSplit({
      id: '88888888-8888-4000-a000-888888888888',
      dimensionValueId: TEST_DIM_VALUE_ID_2,
      period1: 400,
      period2: 400,
      period3: 400,
      period4: 400,
      period5: 400,
      period6: 400,
      period7: 400,
      period8: 400,
      period9: 400,
      period10: 400,
      period11: 400,
      period12: 400,
      totalAmount: 4800,
    });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine());
    mockPrisma.dimensionType.findFirst.mockResolvedValue({ id: TEST_DIM_TYPE_ID });
    mockPrisma.dimensionValue.findMany.mockResolvedValue([
      { id: TEST_DIM_VALUE_ID_1 },
      { id: TEST_DIM_VALUE_ID_2 },
    ]);
    mockPrisma.budgetLineDimension.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.budgetLineDimension.create
      .mockResolvedValueOnce(createdSplit1)
      .mockResolvedValueOnce(createdSplit2);

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        splits: [
          {
            dimensionValueId: TEST_DIM_VALUE_ID_1,
            period1: 600,
            period2: 600,
            period3: 600,
            period4: 600,
            period5: 600,
            period6: 600,
            period7: 600,
            period8: 600,
            period9: 600,
            period10: 600,
            period11: 600,
            period12: 600,
          },
          {
            dimensionValueId: TEST_DIM_VALUE_ID_2,
            period1: 400,
            period2: 400,
            period3: 400,
            period4: 400,
            period5: 400,
            period6: 400,
            period7: 400,
            period8: 400,
            period9: 400,
            period10: 400,
            period11: 400,
            period12: 400,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('rejects when period sums do not match parent line (SPLIT_SUM_MISMATCH)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine()); // 1000 per period
    mockPrisma.dimensionType.findFirst.mockResolvedValue({ id: TEST_DIM_TYPE_ID });
    mockPrisma.dimensionValue.findMany.mockResolvedValue([{ id: TEST_DIM_VALUE_ID_1 }]);

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        splits: [
          {
            dimensionValueId: TEST_DIM_VALUE_ID_1,
            period1: 500, // Only 500, but parent line has 1000
            period2: 1000,
            period3: 1000,
            period4: 1000,
            period5: 1000,
            period6: 1000,
            period7: 1000,
            period8: 1000,
            period9: 1000,
            period10: 1000,
            period11: 1000,
            period12: 1000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('SPLIT_SUM_MISMATCH');
  });

  it('rejects when budget is not DRAFT (409)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'APPROVED',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        splits: [
          {
            dimensionValueId: TEST_DIM_VALUE_ID_1,
            period1: 1000,
            period2: 1000,
            period3: 1000,
            period4: 1000,
            period5: 1000,
            period6: 1000,
            period7: 1000,
            period8: 1000,
            period9: 1000,
            period10: 1000,
            period11: 1000,
            period12: 1000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('rejects when dimension type does not exist (404)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine());
    mockPrisma.dimensionType.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        splits: [
          {
            dimensionValueId: TEST_DIM_VALUE_ID_1,
            period1: 1000,
            period2: 1000,
            period3: 1000,
            period4: 1000,
            period5: 1000,
            period6: 1000,
            period7: 1000,
            period8: 1000,
            period9: 1000,
            period10: 1000,
            period11: 1000,
            period12: 1000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects when dimension value does not exist (400)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine());
    mockPrisma.dimensionType.findFirst.mockResolvedValue({ id: TEST_DIM_TYPE_ID });
    mockPrisma.dimensionValue.findMany.mockResolvedValue([]); // No matching values

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        splits: [
          {
            dimensionValueId: TEST_DIM_VALUE_ID_1,
            period1: 1000,
            period2: 1000,
            period3: 1000,
            period4: 1000,
            period5: 1000,
            period6: 1000,
            period7: 1000,
            period8: 1000,
            period9: 1000,
            period10: 1000,
            period11: 1000,
            period12: 1000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_DIMENSION_VALUE');
  });

  it('returns 404 when budget does not exist', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        splits: [
          {
            dimensionValueId: TEST_DIM_VALUE_ID_1,
            period1: 1000,
            period2: 1000,
            period3: 1000,
            period4: 1000,
            period5: 1000,
            period6: 1000,
            period7: 1000,
            period8: 1000,
            period9: 1000,
            period10: 1000,
            period11: 1000,
            period12: 1000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits`,
      headers: { 'content-type': 'application/json' },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        splits: [
          {
            dimensionValueId: TEST_DIM_VALUE_ID_1,
            period1: 1000,
            period2: 1000,
            period3: 1000,
            period4: 1000,
            period5: 1000,
            period6: 1000,
            period7: 1000,
            period8: 1000,
            period9: 1000,
            period10: 1000,
            period11: 1000,
            period12: 1000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /finance/budgets/:budgetId/lines/:lineId/dimension-splits/:dimensionTypeId
// ---------------------------------------------------------------------------

describe('DELETE /finance/budgets/:budgetId/lines/:lineId/dimension-splits/:dimensionTypeId', () => {
  it('deletes all splits for a dimension type on a line (204)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine());
    mockPrisma.budgetLineDimension.deleteMany.mockResolvedValue({ count: 2 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits/${TEST_DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when no splits exist for that dimension type', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budgetLine.findFirst.mockResolvedValue(makeMockBudgetLine());
    mockPrisma.budgetLineDimension.deleteMany.mockResolvedValue({ count: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits/${TEST_DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects when budget is not DRAFT (409)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'APPROVED',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits/${TEST_DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/budgets/${TEST_BUDGET_ID}/lines/${TEST_BUDGET_LINE_ID}/dimension-splits/${TEST_DIM_TYPE_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});
