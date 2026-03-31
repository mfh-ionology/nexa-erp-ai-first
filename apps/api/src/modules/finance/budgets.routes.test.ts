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
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    budgetLine: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    chartOfAccount: {
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
import { budgetsRoutesPlugin } from './budgets.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_BUDGET_ID = '22222222-2222-4000-a000-222222222222';
const TEST_LINE_ID_1 = '33333333-3333-4000-a000-333333333333';
const TEST_LINE_ID_2 = '44444444-4444-4000-a000-444444444444';

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
  await app.register(budgetsRoutesPlugin, { prefix: '/finance' });

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
        permissions: hasAccess ? { 'finance.budgets': fullPerm, 'finance.accounts': fullPerm } : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

/** Create a mock budget line as Prisma would return */
function makeMockBudgetLine(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_LINE_ID_1,
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Create a mock budget as Prisma would return (list shape) */
function makeMockBudgetList(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BUDGET_ID,
    name: 'FY2026 Operating Budget',
    fiscalYear: 2026,
    budgetType: 'ANNUAL',
    status: 'DRAFT',
    description: 'Annual operating budget for 2026',
    approvedAt: null,
    approvedBy: null,
    originalBudgetId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    _count: { lines: 2 },
    ...overrides,
  };
}

/** Create a mock budget as Prisma would return (detail shape with lines) */
function makeMockBudgetDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BUDGET_ID,
    name: 'FY2026 Operating Budget',
    fiscalYear: 2026,
    budgetType: 'ANNUAL',
    status: 'DRAFT',
    description: 'Annual operating budget for 2026',
    approvedAt: null,
    approvedBy: null,
    originalBudgetId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    lines: [
      makeMockBudgetLine(),
      makeMockBudgetLine({
        id: TEST_LINE_ID_2,
        accountCode: '5000',
        period1: 500,
        period2: 500,
        period3: 500,
        period4: 500,
        period5: 500,
        period6: 500,
        period7: 500,
        period8: 500,
        period9: 500,
        period10: 500,
        period11: 500,
        period12: 500,
        totalAmount: 6000,
      }),
    ],
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
// GET /finance/budgets — AC-1: list budgets with status and fiscal year
// ---------------------------------------------------------------------------

describe('GET /finance/budgets', () => {
  it('returns list of budgets with pagination meta', async () => {
    app = await buildTestApp();
    const budgets = [
      makeMockBudgetList(),
      makeMockBudgetList({ id: '55555555-5555-4000-a000-555555555555', name: 'Q2 Revised' }),
    ];

    mockPrisma.budget.findMany.mockResolvedValue(budgets);
    mockPrisma.budget.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('FY2026 Operating Budget');
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by status', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findMany.mockResolvedValue([]);
    mockPrisma.budget.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/budgets?status=APPROVED',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, status: 'APPROVED' }),
      }),
    );
  });

  it('filters by fiscalYear', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findMany.mockResolvedValue([]);
    mockPrisma.budget.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/budgets?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, fiscalYear: 2026 }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/budgets/:id — AC-2: budget detail with all lines
// ---------------------------------------------------------------------------

describe('GET /finance/budgets/:id', () => {
  it('returns budget detail with all lines', async () => {
    app = await buildTestApp();
    const budget = makeMockBudgetDetail();

    mockPrisma.budget.findFirst.mockResolvedValue(budget);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_BUDGET_ID);
    expect(body.data.name).toBe('FY2026 Operating Budget');
    expect(body.data.fiscalYear).toBe(2026);
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.lines).toHaveLength(2);
    expect(body.data.lines[0].accountCode).toBe('4000');
    expect(body.data.lines[0].totalAmount).toBe(12000);
    expect(body.data.lines[1].accountCode).toBe('5000');
    expect(body.data.lines[1].totalAmount).toBe(6000);
  });

  it('returns 404 for non-existent budget', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budgets/${TEST_BUDGET_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/budgets — AC-3: create budget with lines
// ---------------------------------------------------------------------------

describe('POST /finance/budgets', () => {
  it('creates a budget with lines successfully', async () => {
    app = await buildTestApp();
    const created = makeMockBudgetDetail();

    // Account validation: both codes exist
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '4000' }, { code: '5000' }]);
    mockPrisma.budget.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'FY2026 Operating Budget',
        fiscalYear: 2026,
        description: 'Annual operating budget for 2026',
        lines: [
          {
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
          },
          {
            accountCode: '5000',
            period1: 500,
            period2: 500,
            period3: 500,
            period4: 500,
            period5: 500,
            period6: 500,
            period7: 500,
            period8: 500,
            period9: 500,
            period10: 500,
            period11: 500,
            period12: 500,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('FY2026 Operating Budget');
    expect(body.data.lines).toHaveLength(2);
  });

  it('rejects when account code does not exist', async () => {
    app = await buildTestApp();

    // Only one account found but two provided
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '4000' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Budget',
        fiscalYear: 2026,
        lines: [
          { accountCode: '4000', period1: 100 },
          { accountCode: '9999', period1: 200 },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_ACCOUNT_CODE');
  });

  it('rejects duplicate account codes in lines', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Budget',
        fiscalYear: 2026,
        lines: [
          { accountCode: '4000', period1: 100 },
          { accountCode: '4000', period1: 200 },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('DUPLICATE_ACCOUNT_CODE');
  });

  it('rejects empty lines array', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Budget',
        fiscalYear: 2026,
        lines: [],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets',
      headers: { 'content-type': 'application/json' },
      payload: {
        name: 'Test',
        fiscalYear: 2026,
        lines: [{ accountCode: '4000', period1: 100 }],
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/budgets/:id — AC-4: update budget (only DRAFT)
// ---------------------------------------------------------------------------

describe('PATCH /finance/budgets/:id', () => {
  it('updates a DRAFT budget name', async () => {
    app = await buildTestApp();
    const updated = makeMockBudgetDetail({ name: 'Updated Budget Name' });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budget.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budgets/${TEST_BUDGET_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated Budget Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Updated Budget Name');
  });

  it('updates DRAFT budget lines (replace all)', async () => {
    app = await buildTestApp();
    const updated = makeMockBudgetDetail();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '4000' }]);
    mockPrisma.budgetLine.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.budgetLine.create.mockResolvedValue({});
    mockPrisma.budget.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budgets/${TEST_BUDGET_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          {
            accountCode: '4000',
            period1: 2000,
            period2: 2000,
            period3: 2000,
            period4: 2000,
            period5: 2000,
            period6: 2000,
            period7: 2000,
            period8: 2000,
            period9: 2000,
            period10: 2000,
            period11: 2000,
            period12: 2000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.budgetLine.deleteMany).toHaveBeenCalledWith({
      where: { budgetId: TEST_BUDGET_ID },
    });
    expect(mockPrisma.budgetLine.create).toHaveBeenCalled();
  });

  it('rejects update on APPROVED budget', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'APPROVED',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budgets/${TEST_BUDGET_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Should Fail' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('BUDGET_NOT_DRAFT');
  });

  it('returns 404 for non-existent budget', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budgets/${TEST_BUDGET_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Should Fail' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/budgets/:id/approve — AC-5: DRAFT → APPROVED
// ---------------------------------------------------------------------------

describe('POST /finance/budgets/:id/approve', () => {
  it('approves a DRAFT budget', async () => {
    app = await buildTestApp();
    const approved = makeMockBudgetDetail({
      status: 'APPROVED',
      approvedAt: new Date('2026-03-01T00:00:00Z'),
      approvedBy: TEST_USER_ID,
    });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'DRAFT',
    });
    mockPrisma.budget.update.mockResolvedValue(approved);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budgets/${TEST_BUDGET_ID}/approve`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('APPROVED');
    expect(body.data.approvedBy).toBe(TEST_USER_ID);
  });

  it('rejects approval of already APPROVED budget', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: TEST_BUDGET_ID,
      status: 'APPROVED',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budgets/${TEST_BUDGET_ID}/approve`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('BUDGET_NOT_DRAFT');
  });

  it('returns 404 for non-existent budget', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budgets/${TEST_BUDGET_ID}/approve`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/budgets/:id/copy — AC-6: create revised budget (BR-FIN-019)
// ---------------------------------------------------------------------------

describe('POST /finance/budgets/:id/copy', () => {
  it('copies a budget as revised with link to original', async () => {
    app = await buildTestApp();
    const original = makeMockBudgetDetail({ status: 'APPROVED', _count: { lines: 2 } });
    const copy = makeMockBudgetDetail({
      id: '66666666-6666-4000-a000-666666666666',
      name: 'FY2026 Operating Budget (Revised)',
      budgetType: 'REVISED',
      status: 'DRAFT',
      originalBudgetId: TEST_BUDGET_ID,
    });

    mockPrisma.budget.findFirst.mockResolvedValue(original);
    mockPrisma.budget.create.mockResolvedValue(copy);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budgets/${TEST_BUDGET_ID}/copy`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.budgetType).toBe('REVISED');
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.originalBudgetId).toBe(TEST_BUDGET_ID);
  });

  it('returns 404 for non-existent budget', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budgets/${TEST_BUDGET_ID}/copy`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/budgets/search — AC-7: search by name
// ---------------------------------------------------------------------------

describe('GET /finance/budgets/search', () => {
  it('searches budgets by name', async () => {
    app = await buildTestApp();
    const results = [makeMockBudgetList()];

    mockPrisma.budget.findMany.mockResolvedValue(results);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets/search?search=FY2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('FY2026 Operating Budget');
  });

  it('returns empty array when no match', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets/search?search=nonexistent',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it('rejects empty search term', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets/search?search=',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets/search?search=test',
    });

    expect(res.statusCode).toBe(401);
  });
});
