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
    dimensionType: {
      findFirst: vi.fn(),
    },
    dimensionValue: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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
  Prisma: {
    JsonNull: '__JsonNull__',
    DbNull: '__DbNull__',
    AnyNull: '__AnyNull__',
  },
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
import { dimensionValuesRoutesPlugin } from './dimension-values.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_DIM_TYPE_ID = '22222222-2222-4000-a000-222222222222';
const TEST_DIM_VALUE_ID = '33333333-3333-4000-a000-333333333333';
const TEST_PARENT_VALUE_ID = '44444444-4444-4000-a000-444444444444';

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
  await app.register(dimensionValuesRoutesPlugin, { prefix: '/finance' });

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

  // By default, type exists
  mockPrisma.dimensionType.findFirst.mockResolvedValue({
    id: TEST_DIM_TYPE_ID,
    companyId: TEST_COMPANY_ID,
  });
}

function makeSampleDimensionValue(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_DIM_VALUE_ID,
    companyId: TEST_COMPANY_ID,
    dimensionTypeId: TEST_DIM_TYPE_ID,
    code: 'SALES',
    name: 'Sales Department',
    parentId: null,
    isActive: true,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    parent: null,
    children: [],
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
// GET /finance/dimensions/types/:typeId/values
// ---------------------------------------------------------------------------

describe('GET /finance/dimensions/types/:typeId/values', () => {
  it('returns list with pagination meta', async () => {
    app = await buildTestApp();
    const values = [
      makeSampleDimensionValue(),
      makeSampleDimensionValue({
        id: '55555555-5555-4000-a000-555555555555',
        code: 'MKTG',
        name: 'Marketing',
      }),
    ];

    mockPrisma.dimensionValue.findMany.mockResolvedValue(values);
    mockPrisma.dimensionValue.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].code).toBe('SALES');
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by isActive', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionValue.findMany.mockResolvedValue([]);
    mockPrisma.dimensionValue.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values?isActive=true`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.dimensionValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          dimensionTypeId: TEST_DIM_TYPE_ID,
          isActive: true,
        }),
      }),
    );
  });

  it('filters by parentId', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionValue.findMany.mockResolvedValue([]);
    mockPrisma.dimensionValue.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values?parentId=${TEST_PARENT_VALUE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.dimensionValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentId: TEST_PARENT_VALUE_ID,
        }),
      }),
    );
  });

  it('supports search on code and name', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionValue.findMany.mockResolvedValue([]);
    mockPrisma.dimensionValue.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values?search=sales`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.dimensionValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { code: { contains: 'sales', mode: 'insensitive' } },
            { name: { contains: 'sales', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('returns 404 when typeId does not exist', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionType.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/dimensions/types/:typeId/values/:id
// ---------------------------------------------------------------------------

describe('GET /finance/dimensions/types/:typeId/values/:id', () => {
  it('returns value with parent and children', async () => {
    app = await buildTestApp();
    const value = makeSampleDimensionValue({
      parent: { id: TEST_PARENT_VALUE_ID, code: 'ROOT', name: 'Root' },
      children: [
        makeSampleDimensionValue({
          id: '66666666-6666-4000-a000-666666666666',
          code: 'SALES_UK',
          name: 'Sales UK',
        }),
      ],
    });

    mockPrisma.dimensionValue.findFirst.mockResolvedValue(value);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_DIM_VALUE_ID);
    expect(body.data.parent.code).toBe('ROOT');
    expect(body.data.children).toHaveLength(1);
  });

  it('returns 404 for non-existent value', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionValue.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/dimensions/types/:typeId/values
// ---------------------------------------------------------------------------

describe('POST /finance/dimensions/types/:typeId/values', () => {
  it('creates value successfully (201)', async () => {
    app = await buildTestApp();
    const created = makeSampleDimensionValue({ code: 'ENG', name: 'Engineering' });
    mockPrisma.dimensionValue.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: 'ENG',
        name: 'Engineering',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.code).toBe('ENG');
  });

  it('creates value with parentId', async () => {
    app = await buildTestApp();
    // Parent exists in the same type
    mockPrisma.dimensionValue.findFirst.mockResolvedValue({
      id: TEST_PARENT_VALUE_ID,
      companyId: TEST_COMPANY_ID,
      dimensionTypeId: TEST_DIM_TYPE_ID,
      parentId: null,
    });

    const created = makeSampleDimensionValue({
      code: 'SALES_UK',
      name: 'Sales UK',
      parentId: TEST_PARENT_VALUE_ID,
    });
    mockPrisma.dimensionValue.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: 'SALES_UK',
        name: 'Sales UK',
        parentId: TEST_PARENT_VALUE_ID,
      },
    });

    expect(res.statusCode).toBe(201);
  });

  it('returns 409 for duplicate code within type', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionValue.create.mockRejectedValue({ code: 'P2002' });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: 'SALES',
        name: 'Sales Duplicate',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('DUPLICATE_CODE');
  });

  it('returns 404 when typeId does not exist', async () => {
    app = await buildTestApp();
    mockPrisma.dimensionType.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: 'NEW',
        name: 'New Value',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('validates code format (rejects lowercase)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: 'sales',
        name: 'Sales',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('validates code format (rejects special chars)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: 'SALES.1',
        name: 'Sales',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: { 'content-type': 'application/json' },
      payload: {
        code: 'SALES',
        name: 'Sales',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/dimensions/types/:typeId/values/:id
// ---------------------------------------------------------------------------

describe('PATCH /finance/dimensions/types/:typeId/values/:id', () => {
  it('updates name successfully', async () => {
    app = await buildTestApp();
    const existing = makeSampleDimensionValue();
    const updated = makeSampleDimensionValue({ name: 'Updated Sales' });

    // First call: verifyTypeExists, second call: find existing value
    mockPrisma.dimensionValue.findFirst.mockResolvedValue(existing);
    mockPrisma.dimensionValue.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated Sales' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Updated Sales');
  });

  it('updates isActive (deactivate)', async () => {
    app = await buildTestApp();
    const existing = makeSampleDimensionValue();
    const updated = makeSampleDimensionValue({ isActive: false });

    mockPrisma.dimensionValue.findFirst.mockResolvedValue(existing);
    mockPrisma.dimensionValue.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isActive).toBe(false);
  });

  it('rejects self-referencing parentId (CIRCULAR_PARENT)', async () => {
    app = await buildTestApp();
    const existing = makeSampleDimensionValue();
    mockPrisma.dimensionValue.findFirst.mockResolvedValue(existing);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { parentId: TEST_DIM_VALUE_ID },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('CIRCULAR_PARENT');
  });

  it('returns 404 for non-existent value', async () => {
    app = await buildTestApp();
    // Type exists, but value does not
    mockPrisma.dimensionValue.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects empty update body', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
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
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: 'No Auth' },
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
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
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
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { code: 'SALES', name: 'Sales' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER on PATCH', async () => {
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
      method: 'PATCH',
      url: `/finance/dimensions/types/${TEST_DIM_TYPE_ID}/values/${TEST_DIM_VALUE_ID}`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'No Access' },
    });

    expect(res.statusCode).toBe(403);
  });
});
