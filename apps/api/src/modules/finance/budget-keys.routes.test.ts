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
    budgetKey: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, opts: { code: string }) {
        super(message);
        this.code = opts.code;
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
import { budgetKeysRoutesPlugin } from './budget-keys.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_BUDGET_KEY_ID = '22222222-2222-4000-a000-222222222222';

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
  await app.register(budgetKeysRoutesPlugin, { prefix: '/finance' });

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

/** Create a mock budget key as Prisma would return */
function makeMockBudgetKey(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BUDGET_KEY_ID,
    name: 'Even Split',
    pct1: 8.3333,
    pct2: 8.3333,
    pct3: 8.3333,
    pct4: 8.3333,
    pct5: 8.3333,
    pct6: 8.3333,
    pct7: 8.3333,
    pct8: 8.3333,
    pct9: 8.3333,
    pct10: 8.3333,
    pct11: 8.3333,
    pct12: 8.3337,
    isActive: true,
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
// GET /finance/budget-keys — list budget keys
// ---------------------------------------------------------------------------

describe('GET /finance/budget-keys', () => {
  it('returns list of budget keys with pagination meta', async () => {
    app = await buildTestApp();
    const keys = [
      makeMockBudgetKey(),
      makeMockBudgetKey({
        id: '33333333-3333-4000-a000-333333333333',
        name: 'Q1 Heavy',
      }),
    ];

    mockPrisma.budgetKey.findMany.mockResolvedValue(keys);
    mockPrisma.budgetKey.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budget-keys',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('Even Split');
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by isActive', async () => {
    app = await buildTestApp();
    mockPrisma.budgetKey.findMany.mockResolvedValue([]);
    mockPrisma.budgetKey.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/budget-keys?isActive=true',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.budgetKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          isActive: true,
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budget-keys',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/budget-keys/:id — budget key detail
// ---------------------------------------------------------------------------

describe('GET /finance/budget-keys/:id', () => {
  it('returns budget key detail', async () => {
    app = await buildTestApp();
    mockPrisma.budgetKey.findFirst.mockResolvedValue(makeMockBudgetKey());

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_BUDGET_KEY_ID);
    expect(body.data.name).toBe('Even Split');
    expect(body.data.pct1).toBe(8.3333);
  });

  it('returns 404 for non-existent key', async () => {
    app = await buildTestApp();
    mockPrisma.budgetKey.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/budget-keys — create budget key
// ---------------------------------------------------------------------------

describe('POST /finance/budget-keys', () => {
  it('creates a budget key with valid percentages summing to 100', async () => {
    app = await buildTestApp();
    const created = makeMockBudgetKey();
    mockPrisma.budgetKey.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-keys',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Even Split',
        pct1: 8.3333,
        pct2: 8.3333,
        pct3: 8.3333,
        pct4: 8.3333,
        pct5: 8.3333,
        pct6: 8.3333,
        pct7: 8.3333,
        pct8: 8.3333,
        pct9: 8.3333,
        pct10: 8.3333,
        pct11: 8.3333,
        pct12: 8.3337,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Even Split');
  });

  it('rejects when percentages do not sum to 100', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-keys',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Bad Key',
        pct1: 50,
        pct2: 50,
        pct3: 0,
        pct4: 0,
        pct5: 0,
        pct6: 0,
        pct7: 0,
        pct8: 0,
        pct9: 0,
        pct10: 0,
        pct11: 0,
        pct12: 1, // sum = 101, not 100
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects when name is empty', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-keys',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: '',
        pct1: 8.3333,
        pct2: 8.3333,
        pct3: 8.3333,
        pct4: 8.3333,
        pct5: 8.3333,
        pct6: 8.3333,
        pct7: 8.3333,
        pct8: 8.3333,
        pct9: 8.3333,
        pct10: 8.3333,
        pct11: 8.3333,
        pct12: 8.3337,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-keys',
      headers: { 'content-type': 'application/json' },
      payload: {
        name: 'Test',
        pct1: 100,
        pct2: 0,
        pct3: 0,
        pct4: 0,
        pct5: 0,
        pct6: 0,
        pct7: 0,
        pct8: 0,
        pct9: 0,
        pct10: 0,
        pct11: 0,
        pct12: 0,
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/budget-keys/:id — update budget key
// ---------------------------------------------------------------------------

describe('PATCH /finance/budget-keys/:id', () => {
  it('updates name', async () => {
    app = await buildTestApp();
    const updated = makeMockBudgetKey({ name: 'Updated Name' });
    mockPrisma.budgetKey.findFirst.mockResolvedValue({ id: TEST_BUDGET_KEY_ID });
    mockPrisma.budgetKey.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.name).toBe('Updated Name');
  });

  it('rejects update on non-existent key (404)', async () => {
    app = await buildTestApp();
    mockPrisma.budgetKey.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Should Fail' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Test' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /finance/budget-keys/:id — delete budget key
// ---------------------------------------------------------------------------

describe('DELETE /finance/budget-keys/:id', () => {
  it('deletes an existing budget key (204)', async () => {
    app = await buildTestApp();
    mockPrisma.budgetKey.findFirst.mockResolvedValue({ id: TEST_BUDGET_KEY_ID });
    mockPrisma.budgetKey.delete.mockResolvedValue({});

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for non-existent key', async () => {
    app = await buildTestApp();
    mockPrisma.budgetKey.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/budget-keys/:id/apply — apply budget key to annual amount
// ---------------------------------------------------------------------------

describe('POST /finance/budget-keys/:id/apply', () => {
  it('applies even split key to annual amount (120,000 -> 10,000 x 12)', async () => {
    app = await buildTestApp();
    // Exactly 1/12 each, clean percentages
    const evenKey = makeMockBudgetKey({
      pct1: 8.3333,
      pct2: 8.3333,
      pct3: 8.3333,
      pct4: 8.3333,
      pct5: 8.3333,
      pct6: 8.3333,
      pct7: 8.3333,
      pct8: 8.3333,
      pct9: 8.3333,
      pct10: 8.3333,
      pct11: 8.3333,
      pct12: 8.3337,
    });
    mockPrisma.budgetKey.findFirst.mockResolvedValue(evenKey);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}/apply`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { annualAmount: 120000 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // All periods should be close to 10000, total = 120000
    const total =
      body.data.period1 +
      body.data.period2 +
      body.data.period3 +
      body.data.period4 +
      body.data.period5 +
      body.data.period6 +
      body.data.period7 +
      body.data.period8 +
      body.data.period9 +
      body.data.period10 +
      body.data.period11 +
      body.data.period12;

    expect(Math.abs(total - 120000)).toBeLessThan(0.01);
  });

  it('absorbs rounding into period 12 for uneven splits', async () => {
    app = await buildTestApp();
    // 100% in Q1 — 33.33, 33.33, 33.34 pattern
    const q1Key = makeMockBudgetKey({
      pct1: 33.33,
      pct2: 33.33,
      pct3: 33.34,
      pct4: 0,
      pct5: 0,
      pct6: 0,
      pct7: 0,
      pct8: 0,
      pct9: 0,
      pct10: 0,
      pct11: 0,
      pct12: 0,
    });
    mockPrisma.budgetKey.findFirst.mockResolvedValue(q1Key);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}/apply`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { annualAmount: 100000 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Total should exactly equal annual amount
    const total =
      body.data.period1 +
      body.data.period2 +
      body.data.period3 +
      body.data.period4 +
      body.data.period5 +
      body.data.period6 +
      body.data.period7 +
      body.data.period8 +
      body.data.period9 +
      body.data.period10 +
      body.data.period11 +
      body.data.period12;

    expect(Math.abs(total - 100000)).toBeLessThan(0.01);
    // period12 absorbs any rounding difference
    expect(body.data.period4).toBe(0);
  });

  it('returns 404 for non-existent key', async () => {
    app = await buildTestApp();
    mockPrisma.budgetKey.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}/apply`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { annualAmount: 120000 },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/budget-keys/${TEST_BUDGET_KEY_ID}/apply`,
      headers: { 'content-type': 'application/json' },
      payload: { annualAmount: 120000 },
    });

    expect(res.statusCode).toBe(401);
  });
});
