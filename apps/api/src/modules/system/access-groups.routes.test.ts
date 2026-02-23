import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    accessGroup: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    accessGroupPermission: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    accessGroupFieldOverride: { findMany: vi.fn() },
    userAccessGroup: { count: vi.fn() },
    resource: { findMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
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
  FieldVisibility: {
    VISIBLE: 'VISIBLE',
    READ_ONLY: 'READ_ONLY',
    HIDDEN: 'HIDDEN',
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
import { eventBusPlugin } from '../../core/events/event-bus.plugin.js';
import { accessGroupRoutesPlugin } from './access-groups.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = new Date('2026-01-01');
const GROUP_ID = 'aaaaaaaa-0000-4000-a000-000000000001';

function sampleAccessGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    companyId: TEST_COMPANY_ID,
    code: 'CUSTOM_ROLE',
    name: 'Custom Role',
    description: 'A custom access group',
    isSystem: false,
    isActive: true,
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function samplePermission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bbbbbbbb-0000-4000-a000-000000000001',
    accessGroupId: GROUP_ID,
    resourceCode: 'system.users.list',
    canAccess: true,
    canNew: false,
    canView: true,
    canEdit: false,
    canDelete: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(eventBusPlugin);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(accessGroupRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';

  mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
    if (args.where.id === TEST_USER_ID) {
      return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
    }
    return Promise.resolve(null);
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  // Configure permission service mock — guard calls getEffectivePermissions for ALL roles
  if (resolvedRole === 'SUPER_ADMIN') {
    const fullPerm = { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true };
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'system.access-groups.list': fullPerm, 'system.access-groups.detail': fullPerm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else {
    const hasAccess = ['ADMIN', 'MANAGER'].includes(resolvedRole);
    const fullPerm = { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true };
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: hasAccess
        ? { 'system.access-groups.list': fullPerm, 'system.access-groups.detail': fullPerm }
        : {},
      fieldOverrides: {},
      accessGroups: hasAccess ? [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }] : [],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: hasAccess ? ['system'] : [],
    });
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset $transaction to pass-through
  mockPrisma.$transaction.mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
  );
});

// ---------------------------------------------------------------------------
// POST /system/access-groups
// ---------------------------------------------------------------------------

describe('POST /system/access-groups', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #1 — ADMIN creates group — 201
  it('creates access group for ADMIN (AC #1) — 201', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.create.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
      payload: { code: 'CUSTOM_ROLE', name: 'Custom Role', description: 'A custom access group' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(GROUP_ID);
    expect(body.data.code).toBe('CUSTOM_ROLE');
    expect(body.data.name).toBe('Custom Role');
    expect(body.data.userCount).toBe(0);
    expect(body.data.permissions).toEqual([]);
    expect(body.data.fieldOverrides).toEqual([]);
  });

  // AC #1 — 409 on duplicate code
  it('returns 409 on duplicate code (AC #1)', async () => {
    setupMocks({ role: 'ADMIN' });
    const p2002Error = new Error('Unique constraint failed') as Error & { code: string };
    p2002Error.code = 'P2002';
    mockPrisma.accessGroup.create.mockRejectedValue(p2002Error);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
      payload: { code: 'DUPLICATE', name: 'Dup' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DUPLICATE_CODE');
  });

  // Validation — invalid code format returns 400
  it('returns 400 for invalid code format', async () => {
    setupMocks({ role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
      payload: { code: 'lower-case', name: 'Test' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /system/access-groups
// ---------------------------------------------------------------------------

describe('GET /system/access-groups', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #2 — paginated list with userCount — 200
  it('returns paginated list with userCount for ADMIN (AC #2) — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    const groups = [
      { ...sampleAccessGroup(), _count: { userAccessGroups: 3 } },
      {
        ...sampleAccessGroup({
          id: 'aaaaaaaa-0000-4000-a000-000000000002',
          code: 'OTHER_ROLE',
          name: 'Other Role',
        }),
        _count: { userAccessGroups: 1 },
      },
    ];
    mockPrisma.accessGroup.findMany.mockResolvedValue(groups);
    mockPrisma.accessGroup.count.mockResolvedValue(2);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].userCount).toBe(3);
    expect(body.data[1].userCount).toBe(1);
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  // AC #2 — supports search and isActive filter
  it('supports search and isActive filter (AC #2)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroup.count.mockResolvedValue(0);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/access-groups?search=manager&isActive=true',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);

    // Verify search filter was passed via OR clause
    expect(mockPrisma.accessGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          isActive: true,
          OR: [
            { code: { contains: 'manager', mode: 'insensitive' } },
            { name: { contains: 'manager', mode: 'insensitive' } },
            { description: { contains: 'manager', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// GET /system/access-groups/:id
// ---------------------------------------------------------------------------

describe('GET /system/access-groups/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #3 — full detail with permissions and fieldOverrides — 200
  it('returns full detail with permissions and fieldOverrides (AC #3) — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    const permissions = [samplePermission()];
    const fieldOverrides = [
      {
        id: 'cccccccc-0000-4000-a000-000000000001',
        accessGroupId: GROUP_ID,
        resourceCode: 'system.users.list',
        fieldPath: 'email',
        visibility: 'READ_ONLY',
      },
    ];
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions,
      fieldOverrides,
      _count: { userAccessGroups: 5 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(GROUP_ID);
    expect(body.data.permissions).toHaveLength(1);
    expect(body.data.permissions[0].resourceCode).toBe('system.users.list');
    expect(body.data.fieldOverrides).toHaveLength(1);
    expect(body.data.fieldOverrides[0].visibility).toBe('READ_ONLY');
    expect(body.data.userCount).toBe(5);
  });

  // AC #3 — 404 for wrong company (findFirst returns null)
  it('returns 404 for wrong company', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// PATCH /system/access-groups/:id
// ---------------------------------------------------------------------------

describe('PATCH /system/access-groups/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #4 — update metadata — 200
  it('updates metadata (AC #4) — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
    });
    mockPrisma.accessGroup.update.mockResolvedValue({
      ...sampleAccessGroup({ name: 'Updated Name', description: 'New desc' }),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
      payload: { name: 'Updated Name', description: 'New desc' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Updated Name');
    expect(body.data.description).toBe('New desc');
  });

  // Validation — empty body returns 400 (at least one field required)
  it('returns 400 for empty body (at least one field required)', async () => {
    setupMocks({ role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT /system/access-groups/:id/permissions
// ---------------------------------------------------------------------------

describe('PUT /system/access-groups/:id/permissions', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #5 — replace permissions — 200
  it('replaces permissions (AC #5) — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isActive: true,
      isSystem: false,
    });

    const inputPermissions = [
      { resourceCode: 'system.users.list', canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: false },
    ];

    mockPrisma.resource.findMany.mockResolvedValue([{ code: 'system.users.list' }]);
    mockPrisma.accessGroupPermission.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.accessGroupPermission.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.accessGroupPermission.findMany.mockResolvedValue([
      {
        id: 'perm-001',
        accessGroupId: GROUP_ID,
        resourceCode: 'system.users.list',
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: false,
      },
    ]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/access-groups/${GROUP_ID}/permissions`,
      headers: authHeaders(testJwt),
      payload: inputPermissions,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].resourceCode).toBe('system.users.list');
    expect(body.data[0].canAccess).toBe(true);
    expect(body.data[0].canNew).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELETE /system/access-groups/:id
// ---------------------------------------------------------------------------

describe('DELETE /system/access-groups/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #7 — system group returns 409
  it('DELETE system group returns 409 (AC #7)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: true,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SYSTEM_GROUP_PROTECTED');
  });

  // AC #8 — custom group with no users returns 204
  it('DELETE custom group with no users returns 204 (AC #8)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });
    mockPrisma.userAccessGroup.count.mockResolvedValue(0);
    mockPrisma.accessGroup.update.mockResolvedValue({});

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(204);
  });

  // Custom group with active users returns 409
  it('DELETE custom group with active users returns 409', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });
    mockPrisma.userAccessGroup.count.mockResolvedValue(5);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('GROUP_HAS_USERS');
  });
});

// ---------------------------------------------------------------------------
// RBAC — STAFF gets 403
// ---------------------------------------------------------------------------

describe('RBAC — STAFF user gets 403 on all endpoints', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('POST /system/access-groups — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
      payload: { code: 'TEST', name: 'Test' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('GET /system/access-groups — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('GET /system/access-groups/:id — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('PATCH /system/access-groups/:id — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
      payload: { name: 'X' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('DELETE /system/access-groups/:id — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('PUT /system/access-groups/:id/permissions — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/access-groups/${GROUP_ID}/permissions`,
      headers: authHeaders(testJwt),
      payload: [],
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// RBAC — SUPER_ADMIN gets 200/201
// ---------------------------------------------------------------------------

describe('RBAC — SUPER_ADMIN gets 200/201 on all endpoints', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('POST /system/access-groups — 201 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.accessGroup.create.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
      payload: { code: 'CUSTOM_ROLE', name: 'Custom Role' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
  });

  it('GET /system/access-groups — 200 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroup.count.mockResolvedValue(0);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/access-groups',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('GET /system/access-groups/:id — 200 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('PATCH /system/access-groups/:id — 200 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
    });
    mockPrisma.accessGroup.update.mockResolvedValue({
      ...sampleAccessGroup({ name: 'New' }),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
      payload: { name: 'New' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('DELETE /system/access-groups/:id — 204 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });
    mockPrisma.userAccessGroup.count.mockResolvedValue(0);
    mockPrisma.accessGroup.update.mockResolvedValue({});

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/system/access-groups/${GROUP_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(204);
  });

  it('PUT /system/access-groups/:id/permissions — 200 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isActive: true,
      isSystem: false,
    });
    mockPrisma.resource.findMany.mockResolvedValue([]);
    mockPrisma.accessGroupPermission.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.accessGroupPermission.findMany.mockResolvedValue([]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/access-groups/${GROUP_ID}/permissions`,
      headers: authHeaders(testJwt),
      payload: [],
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated — 401
// ---------------------------------------------------------------------------

describe('Unauthenticated requests get 401', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('POST /system/access-groups — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/access-groups',
      payload: { code: 'TEST', name: 'Test' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('GET /system/access-groups — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/access-groups',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('GET /system/access-groups/:id — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/access-groups/${GROUP_ID}`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /system/access-groups/:id — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/system/access-groups/${GROUP_ID}`,
      payload: { name: 'X' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('DELETE /system/access-groups/:id — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/system/access-groups/${GROUP_ID}`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('PUT /system/access-groups/:id/permissions — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/access-groups/${GROUP_ID}/permissions`,
      payload: [],
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});
