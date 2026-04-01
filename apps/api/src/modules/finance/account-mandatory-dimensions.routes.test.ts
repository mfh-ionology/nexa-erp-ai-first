import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db
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
    chartOfAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    dimensionType: {
      findMany: vi.fn(),
    },
    accountMandatoryDimension: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
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
import { accountMandatoryDimensionsRoutesPlugin } from './account-mandatory-dimensions.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_ACCOUNT_ID = '22222222-2222-4000-a000-222222222222';
const TEST_ACCOUNT_ID_2 = '22222222-2222-4000-a000-222222222223';
const TEST_ACCOUNT_ID_3 = '22222222-2222-4000-a000-222222222224';
const TEST_DIM_TYPE_ID_1 = '33333333-3333-4000-a000-333333333333';
const TEST_DIM_TYPE_ID_2 = '44444444-4444-4000-a000-444444444444';

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
  await app.register(accountMandatoryDimensionsRoutesPlugin, { prefix: '/finance' });

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
              'finance.accounts': fullPerm,
              'finance.dimensions': fullPerm,
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
// GET /finance/accounts/:id/mandatory-dimensions
// ---------------------------------------------------------------------------

describe('GET /finance/accounts/:id/mandatory-dimensions', () => {
  it('returns mandatory dimensions for an account', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: TEST_ACCOUNT_ID });
    mockPrisma.accountMandatoryDimension.findMany.mockResolvedValue([
      {
        id: 'md-1',
        dimensionTypeId: TEST_DIM_TYPE_ID_1,
        createdAt: new Date('2026-01-01'),
        dimensionType: { id: TEST_DIM_TYPE_ID_1, code: 'DEPT', name: 'Department' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].dimensionType.code).toBe('DEPT');
  });

  it('returns 404 for non-existent account', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/accounts/:id/mandatory-dimensions
// ---------------------------------------------------------------------------

describe('PUT /finance/accounts/:id/mandatory-dimensions', () => {
  it('replaces mandatory dimensions for an account', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: TEST_ACCOUNT_ID });
    mockPrisma.dimensionType.findMany.mockResolvedValue([
      { id: TEST_DIM_TYPE_ID_1 },
      { id: TEST_DIM_TYPE_ID_2 },
    ]);

    // Mock the transaction
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        accountMandatoryDimension: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      });
    });

    // After set, return the new list
    mockPrisma.accountMandatoryDimension.findMany.mockResolvedValue([
      {
        id: 'md-1',
        dimensionTypeId: TEST_DIM_TYPE_ID_1,
        createdAt: new Date('2026-01-01'),
        dimensionType: { id: TEST_DIM_TYPE_ID_1, code: 'DEPT', name: 'Department' },
      },
      {
        id: 'md-2',
        dimensionTypeId: TEST_DIM_TYPE_ID_2,
        createdAt: new Date('2026-01-01'),
        dimensionType: { id: TEST_DIM_TYPE_ID_2, code: 'PROJ', name: 'Project' },
      },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { dimensionTypeIds: [TEST_DIM_TYPE_ID_1, TEST_DIM_TYPE_ID_2] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('clears mandatory dimensions with empty array', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: TEST_ACCOUNT_ID });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        accountMandatoryDimension: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      });
    });
    mockPrisma.accountMandatoryDimension.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { dimensionTypeIds: [] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(0);
  });

  it('returns 404 for non-existent account', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { dimensionTypeIds: [TEST_DIM_TYPE_ID_1] },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: { 'content-type': 'application/json' },
      payload: { dimensionTypeIds: [TEST_DIM_TYPE_ID_1] },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/mandatory-dimensions/bulk-assign
// ---------------------------------------------------------------------------

describe('POST /finance/mandatory-dimensions/bulk-assign', () => {
  it('bulk assigns by account IDs', async () => {
    app = await buildTestApp();

    mockPrisma.dimensionType.findMany.mockResolvedValue([{ id: TEST_DIM_TYPE_ID_1 }]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { id: TEST_ACCOUNT_ID, code: '1000' },
      { id: TEST_ACCOUNT_ID_2, code: '1100' },
    ]);
    mockPrisma.accountMandatoryDimension.createMany.mockResolvedValue({ count: 2 });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/mandatory-dimensions/bulk-assign',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeIds: [TEST_DIM_TYPE_ID_1],
        accountIds: [TEST_ACCOUNT_ID, TEST_ACCOUNT_ID_2],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountsAffected).toBe(2);
    expect(body.data.dimensionTypesApplied).toBe(1);
  });

  it('bulk assigns by account range', async () => {
    app = await buildTestApp();

    mockPrisma.dimensionType.findMany.mockResolvedValue([
      { id: TEST_DIM_TYPE_ID_1 },
      { id: TEST_DIM_TYPE_ID_2 },
    ]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { id: TEST_ACCOUNT_ID, code: '1000' },
      { id: TEST_ACCOUNT_ID_2, code: '1100' },
      { id: TEST_ACCOUNT_ID_3, code: '1200' },
    ]);
    mockPrisma.accountMandatoryDimension.createMany.mockResolvedValue({ count: 6 });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/mandatory-dimensions/bulk-assign',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeIds: [TEST_DIM_TYPE_ID_1, TEST_DIM_TYPE_ID_2],
        accountRange: { from: '1000', to: '1999' },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.accountsAffected).toBe(3);
    expect(body.data.dimensionTypesApplied).toBe(2);
  });

  it('rejects when neither accountIds nor accountRange provided', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/mandatory-dimensions/bulk-assign',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeIds: [TEST_DIM_TYPE_ID_1],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/mandatory-dimensions/bulk-assign',
      headers: { 'content-type': 'application/json' },
      payload: {
        dimensionTypeIds: [TEST_DIM_TYPE_ID_1],
        accountIds: [TEST_ACCOUNT_ID],
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission enforcement
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('returns 403 for VIEWER on GET', async () => {
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
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER on PUT', async () => {
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
      method: 'PUT',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}/mandatory-dimensions`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { dimensionTypeIds: [TEST_DIM_TYPE_ID_1] },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER on bulk-assign', async () => {
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
      url: '/finance/mandatory-dimensions/bulk-assign',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeIds: [TEST_DIM_TYPE_ID_1],
        accountIds: [TEST_ACCOUNT_ID],
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
