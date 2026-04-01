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
    budgetVersion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    budgetLine: {
      findMany: vi.fn(),
    },
    budgetLineDimension: {
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
import { budgetVersionsRoutesPlugin } from './budget-versions.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_VERSION_ID = '22222222-2222-4000-a000-222222222222';
const TEST_VERSION_ID_2 = '33333333-3333-4000-a000-333333333333';

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
  await app.register(budgetVersionsRoutesPlugin, { prefix: '/finance' });

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

/** Create a mock budget version as Prisma would return (list shape) */
function makeMockVersionList(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_VERSION_ID,
    fiscalYear: 2026,
    versionNumber: 1,
    versionName: 'Original Budget',
    copiedFromVersionId: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
    _count: { budgets: 3 },
    ...overrides,
  };
}

/** Create a mock budget version detail with copiedFromVersion */
function makeMockVersionDetail(overrides: Record<string, unknown> = {}) {
  return {
    ...makeMockVersionList(overrides),
    copiedFromVersion: null,
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
// GET /finance/budget-versions — list budget versions
// ---------------------------------------------------------------------------

describe('GET /finance/budget-versions', () => {
  it('returns list of budget versions with pagination meta', async () => {
    app = await buildTestApp();
    const versions = [
      makeMockVersionList(),
      makeMockVersionList({
        id: TEST_VERSION_ID_2,
        versionNumber: 2,
        versionName: 'Revised Budget',
      }),
    ];

    mockPrisma.budgetVersion.findMany.mockResolvedValue(versions);
    mockPrisma.budgetVersion.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budget-versions',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].versionName).toBe('Original Budget');
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by fiscalYear', async () => {
    app = await buildTestApp();
    mockPrisma.budgetVersion.findMany.mockResolvedValue([]);
    mockPrisma.budgetVersion.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/budget-versions?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.budgetVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          fiscalYear: 2026,
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budget-versions',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/budget-versions/:id — budget version detail
// ---------------------------------------------------------------------------

describe('GET /finance/budget-versions/:id', () => {
  it('returns budget version detail with copiedFromVersion', async () => {
    app = await buildTestApp();
    const detail = makeMockVersionDetail({
      copiedFromVersionId: TEST_VERSION_ID_2,
      copiedFromVersion: {
        id: TEST_VERSION_ID_2,
        versionName: 'Source Version',
        versionNumber: 1,
      },
    });

    mockPrisma.budgetVersion.findFirst.mockResolvedValue(detail);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budget-versions/${TEST_VERSION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_VERSION_ID);
    expect(body.data.copiedFromVersion).toBeTruthy();
    expect(body.data.copiedFromVersion.versionName).toBe('Source Version');
  });

  it('returns 404 for non-existent version', async () => {
    app = await buildTestApp();
    mockPrisma.budgetVersion.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budget-versions/${TEST_VERSION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/budget-versions/${TEST_VERSION_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/budget-versions — create budget version
// ---------------------------------------------------------------------------

describe('POST /finance/budget-versions', () => {
  it('creates a budget version with auto-assigned versionNumber', async () => {
    app = await buildTestApp();
    const created = makeMockVersionDetail();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    // No existing versions for this fiscal year
    mockPrisma.budgetVersion.findFirst
      .mockResolvedValueOnce(null) // maxResult query
      .mockResolvedValueOnce(created); // final fetch
    mockPrisma.budgetVersion.create.mockResolvedValue({ id: TEST_VERSION_ID });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-versions',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        fiscalYear: 2026,
        versionName: 'Original Budget',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.versionName).toBe('Original Budget');
  });

  it('creates a budget version with copyFromVersionId (copies all budgets + lines)', async () => {
    app = await buildTestApp();
    const created = makeMockVersionDetail({
      versionNumber: 2,
      versionName: 'Revised',
      copiedFromVersionId: TEST_VERSION_ID,
    });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    // maxResult query returns existing version 1
    mockPrisma.budgetVersion.findFirst
      .mockResolvedValueOnce({ versionNumber: 1 }) // max version number
      .mockResolvedValueOnce({ id: TEST_VERSION_ID }) // source version exists
      .mockResolvedValueOnce(created); // final fetch
    mockPrisma.budgetVersion.create.mockResolvedValue({ id: TEST_VERSION_ID_2 });
    // Source budgets to copy
    mockPrisma.budget.findMany.mockResolvedValue([
      {
        name: 'FY2026 Budget',
        fiscalYear: 2026,
        budgetType: 'ANNUAL',
        description: null,
        status: 'DRAFT',
        createdBy: TEST_USER_ID,
        updatedBy: TEST_USER_ID,
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
            totalAmount: 12000,
            dimensionSplits: [],
          },
        ],
      },
    ]);
    mockPrisma.budget.create.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-versions',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        fiscalYear: 2026,
        versionName: 'Revised',
        copyFromVersionId: TEST_VERSION_ID,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.budget.create).toHaveBeenCalled();
  });

  it('returns 404 when copyFromVersionId does not exist', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.budgetVersion.findFirst
      .mockResolvedValueOnce(null) // maxResult
      .mockResolvedValueOnce(null); // source version not found

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-versions',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        fiscalYear: 2026,
        versionName: 'Copy',
        copyFromVersionId: '99999999-9999-4000-a000-999999999999',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budget-versions',
      headers: { 'content-type': 'application/json' },
      payload: {
        fiscalYear: 2026,
        versionName: 'Test',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/budget-versions/:id — update budget version
// ---------------------------------------------------------------------------

describe('PATCH /finance/budget-versions/:id', () => {
  it('updates versionName', async () => {
    app = await buildTestApp();
    const updated = makeMockVersionDetail({ versionName: 'Updated Name' });

    mockPrisma.budgetVersion.findFirst.mockResolvedValue({ id: TEST_VERSION_ID });
    mockPrisma.budgetVersion.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budget-versions/${TEST_VERSION_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { versionName: 'Updated Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.versionName).toBe('Updated Name');
  });

  it('updates isActive (deactivation)', async () => {
    app = await buildTestApp();
    const updated = makeMockVersionDetail({ isActive: false });

    mockPrisma.budgetVersion.findFirst.mockResolvedValue({ id: TEST_VERSION_ID });
    mockPrisma.budgetVersion.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budget-versions/${TEST_VERSION_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.isActive).toBe(false);
  });

  it('returns 404 for non-existent version', async () => {
    app = await buildTestApp();
    mockPrisma.budgetVersion.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budget-versions/${TEST_VERSION_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { versionName: 'Should Fail' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/budget-versions/${TEST_VERSION_ID}`,
      headers: { 'content-type': 'application/json' },
      payload: { versionName: 'Test' },
    });

    expect(res.statusCode).toBe(401);
  });
});
