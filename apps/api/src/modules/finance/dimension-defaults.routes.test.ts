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
    dimensionValue: {
      findFirst: vi.fn(),
    },
    dimensionDefault: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
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
import { dimensionDefaultsRoutesPlugin } from './dimension-defaults.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_DIM_TYPE_ID = '22222222-2222-4000-a000-222222222222';
const TEST_DIM_VALUE_ID = '33333333-3333-4000-a000-333333333333';
const TEST_DEFAULT_ID = '44444444-4444-4000-a000-444444444444';
const TEST_ENTITY_ID = '55555555-5555-4000-a000-555555555555';

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
  await app.register(dimensionDefaultsRoutesPlugin, { prefix: '/finance' });

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

  // By default, dimension value exists and belongs to type
  mockPrisma.dimensionValue.findFirst.mockResolvedValue({
    id: TEST_DIM_VALUE_ID,
    companyId: TEST_COMPANY_ID,
    dimensionTypeId: TEST_DIM_TYPE_ID,
  });

  // By default, no duplicate
  mockPrisma.dimensionDefault.findFirst.mockResolvedValue(null);
}

function makeSampleDefault(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_DEFAULT_ID,
    companyId: TEST_COMPANY_ID,
    dimensionTypeId: TEST_DIM_TYPE_ID,
    dimensionValueId: TEST_DIM_VALUE_ID,
    entityType: 'ACCOUNT',
    entityId: TEST_ENTITY_ID,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    dimensionType: { id: TEST_DIM_TYPE_ID, code: 'DEPT', name: 'Department' },
    dimensionValue: { id: TEST_DIM_VALUE_ID, code: 'SALES', name: 'Sales' },
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
// GET /finance/dimensions/defaults
// ---------------------------------------------------------------------------

describe('GET /finance/dimensions/defaults', () => {
  it('returns list with dimensionType and dimensionValue included', async () => {
    app = await buildTestApp();
    const defaults = [
      makeSampleDefault(),
      makeSampleDefault({
        id: '66666666-6666-4000-a000-666666666666',
        entityType: 'CUSTOMER',
        entityId: '77777777-7777-4000-a000-777777777777',
      }),
    ];

    mockPrisma.dimensionDefault.findMany.mockResolvedValue(defaults);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dimensions/defaults',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].dimensionType.code).toBe('DEPT');
    expect(body.data[0].dimensionValue.code).toBe('SALES');
  });

  it('filters by entityType', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionDefault.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/dimensions/defaults?entityType=ACCOUNT',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.dimensionDefault.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          entityType: 'ACCOUNT',
        }),
      }),
    );
  });

  it('filters by dimensionTypeId', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionDefault.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/finance/dimensions/defaults?dimensionTypeId=${TEST_DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.dimensionDefault.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          dimensionTypeId: TEST_DIM_TYPE_ID,
        }),
      }),
    );
  });

  it('filters by entityId', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionDefault.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/finance/dimensions/defaults?entityId=${TEST_ENTITY_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.dimensionDefault.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          entityId: TEST_ENTITY_ID,
        }),
      }),
    );
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dimensions/defaults',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/dimensions/defaults
// ---------------------------------------------------------------------------

describe('POST /finance/dimensions/defaults', () => {
  it('creates default successfully (201)', async () => {
    app = await buildTestApp();
    const created = makeSampleDefault();
    mockPrisma.dimensionDefault.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        entityId: TEST_ENTITY_ID,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.entityType).toBe('ACCOUNT');
  });

  it('creates company-wide default (entityType=COMPANY, no entityId)', async () => {
    app = await buildTestApp();
    const created = makeSampleDefault({ entityType: 'COMPANY', entityId: null });
    mockPrisma.dimensionDefault.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'COMPANY',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.entityType).toBe('COMPANY');
  });

  it('rejects when dimensionTypeId does not exist', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionType.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        entityId: TEST_ENTITY_ID,
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects when dimensionValueId does not exist', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionValue.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        entityId: TEST_ENTITY_ID,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_VALUE');
  });

  it('rejects when dimensionValueId belongs to different type', async () => {
    app = await buildTestApp();
    // Value exists but with different type ID
    mockPrisma.dimensionValue.findFirst.mockResolvedValue(null); // findFirst with specific typeId returns null

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        entityId: TEST_ENTITY_ID,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_VALUE');
  });

  it('rejects duplicate default for same type+entity (409)', async () => {
    app = await buildTestApp();
    // Duplicate check returns existing
    mockPrisma.dimensionDefault.findFirst.mockResolvedValue({ id: 'existing-id' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        entityId: TEST_ENTITY_ID,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('DUPLICATE_DEFAULT');
  });

  it('requires entityId for non-COMPANY entity types', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        // entityId intentionally missing
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/dimensions/defaults',
      headers: { 'content-type': 'application/json' },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        entityId: TEST_ENTITY_ID,
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /finance/dimensions/defaults/:id
// ---------------------------------------------------------------------------

describe('DELETE /finance/dimensions/defaults/:id', () => {
  it('deletes default successfully (204)', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionDefault.findFirst.mockResolvedValue({ id: TEST_DEFAULT_ID });
    mockPrisma.dimensionDefault.delete.mockResolvedValue({ id: TEST_DEFAULT_ID });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/dimensions/defaults/${TEST_DEFAULT_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for non-existent', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionDefault.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/dimensions/defaults/${TEST_DEFAULT_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/dimensions/defaults/${TEST_DEFAULT_ID}`,
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
      url: '/finance/dimensions/defaults',
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
      url: '/finance/dimensions/defaults',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensionTypeId: TEST_DIM_TYPE_ID,
        dimensionValueId: TEST_DIM_VALUE_ID,
        entityType: 'ACCOUNT',
        entityId: TEST_ENTITY_ID,
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
      url: `/finance/dimensions/defaults/${TEST_DEFAULT_ID}`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
