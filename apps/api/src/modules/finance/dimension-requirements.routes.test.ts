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
    dimensionType: {
      findFirst: vi.fn(),
    },
    dimensionRequirement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    chartOfAccount: {
      findFirst: vi.fn(),
    },
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
import { dimensionRequirementsRoutesPlugin } from './dimension-requirements.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_DIM_TYPE_ID = '22222222-2222-4000-a000-222222222222';
const TEST_REQ_ID = '33333333-3333-4000-a000-333333333333';

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
  await app.register(dimensionRequirementsRoutesPlugin, { prefix: '/finance' });

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
          ? { 'finance.dimensions': fullPerm, 'finance.settings': fullPerm }
          : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );

  // By default, dimension type exists
  mockPrisma.dimensionType.findFirst.mockResolvedValue({
    id: TEST_DIM_TYPE_ID,
    companyId: TEST_COMPANY_ID,
  });

  // By default, chart of account codes exist
  mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
    id: '00000000-0000-0000-0000-000000000001',
    code: '1000',
  });
}

function makeSampleRequirement(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_REQ_ID,
    companyId: TEST_COMPANY_ID,
    dimensionTypeId: TEST_DIM_TYPE_ID,
    accountCodeFrom: '1000',
    accountCodeTo: '1999',
    isRequired: true,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    dimensionType: { id: TEST_DIM_TYPE_ID, code: 'DEPT', name: 'Department' },
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
// GET /finance/dimensions/requirements
// ---------------------------------------------------------------------------

describe('GET /finance/dimensions/requirements', () => {
  it('returns list with pagination meta and dimensionType included', async () => {
    app = await buildTestApp();
    const reqs = [
      makeSampleRequirement(),
      makeSampleRequirement({
        id: '44444444-4444-4000-a000-444444444444',
        accountCodeFrom: '2000',
        accountCodeTo: '2999',
      }),
    ];

    mockPrisma.dimensionRequirement.findMany.mockResolvedValue(reqs);
    mockPrisma.dimensionRequirement.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dimensions/requirements',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].accountCodeFrom).toBe('1000');
    expect(body.data[0].dimensionType.code).toBe('DEPT');
    expect(body.meta.total).toBe(2);
  });

  it('filters by dimensionTypeId', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionRequirement.findMany.mockResolvedValue([]);
    mockPrisma.dimensionRequirement.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: `/finance/dimensions/requirements?dimensionTypeId=${TEST_DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.dimensionRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          dimensionTypeId: TEST_DIM_TYPE_ID,
        }),
      }),
    );
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dimensions/requirements',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/dimensions/requirements
// ---------------------------------------------------------------------------

describe('POST /finance/dimensions/requirements', () => {
  it('creates requirement successfully (201)', async () => {
    app = await buildTestApp();
    const created = makeSampleRequirement();
    mockPrisma.dimensionRequirement.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/requirements',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        accountCodeFrom: '1000',
        accountCodeTo: '1999',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountCodeFrom).toBe('1000');
  });

  it('validates accountCodeFrom <= accountCodeTo', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/requirements',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        accountCodeFrom: '9999',
        accountCodeTo: '1000',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_RANGE');
  });

  it('rejects when accountCodeFrom does not exist in ChartOfAccount', async () => {
    app = await buildTestApp();
    // First call returns null (accountCodeFrom not found)
    mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/requirements',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        accountCodeFrom: '0001',
        accountCodeTo: '1999',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_ACCOUNT');
  });

  it('rejects when accountCodeTo does not exist in ChartOfAccount', async () => {
    app = await buildTestApp();
    // First call returns account (from exists), second returns null (to doesn't exist)
    mockPrisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'account-1', code: '1000' })
      .mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/requirements',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        accountCodeFrom: '1000',
        accountCodeTo: '9999',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_ACCOUNT');
  });

  it('rejects when dimensionTypeId does not exist (404)', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionType.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/requirements',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        accountCodeFrom: '1000',
        accountCodeTo: '1999',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/requirements',
      headers: { 'content-type': 'application/json' },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        accountCodeFrom: '1000',
        accountCodeTo: '1999',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/dimensions/requirements/:id
// ---------------------------------------------------------------------------

describe('PATCH /finance/dimensions/requirements/:id', () => {
  it('updates accountCodeFrom successfully', async () => {
    app = await buildTestApp();
    const existing = makeSampleRequirement();
    const updated = makeSampleRequirement({ accountCodeFrom: '1100' });

    mockPrisma.dimensionRequirement.findFirst.mockResolvedValue(existing);
    mockPrisma.dimensionRequirement.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { accountCodeFrom: '1100' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountCodeFrom).toBe('1100');
  });

  it('updates isActive (deactivate)', async () => {
    app = await buildTestApp();
    const existing = makeSampleRequirement();
    const updated = makeSampleRequirement({ isActive: false });

    mockPrisma.dimensionRequirement.findFirst.mockResolvedValue(existing);
    mockPrisma.dimensionRequirement.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isActive).toBe(false);
  });

  it('re-validates range when codes change', async () => {
    app = await buildTestApp();
    const existing = makeSampleRequirement({ accountCodeFrom: '1000', accountCodeTo: '1999' });
    mockPrisma.dimensionRequirement.findFirst.mockResolvedValue(existing);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { accountCodeFrom: '9999' }, // now from > to (existing 1999)
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_RANGE');
  });

  it('returns 404 for non-existent', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionRequirement.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { isRequired: false },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects empty update body', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: { 'content-type': 'application/json' },
      payload: { isRequired: false },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /finance/dimensions/requirements/:id
// ---------------------------------------------------------------------------

describe('DELETE /finance/dimensions/requirements/:id', () => {
  it('deletes requirement successfully (204)', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionRequirement.findFirst.mockResolvedValue({ id: TEST_REQ_ID });
    mockPrisma.dimensionRequirement.delete.mockResolvedValue({ id: TEST_REQ_ID });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for non-existent', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionRequirement.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
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
      url: '/finance/dimensions/requirements',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER on POST', async () => {
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
      url: '/finance/dimensions/requirements',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        accountCodeFrom: '1000',
        accountCodeTo: '1999',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER on DELETE', async () => {
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
      method: 'DELETE',
      url: `/finance/dimensions/requirements/${TEST_REQ_ID}`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
