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
    userCompanyRole: { findFirst: vi.fn() },
    userAccessGroup: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    accessGroup: { findMany: vi.fn() },
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
  ResourceType: {
    PAGE: 'PAGE',
    REPORT: 'REPORT',
    SETTING: 'SETTING',
    MAINTENANCE: 'MAINTENANCE',
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
import { userAccessGroupRoutesPlugin } from './user-access-groups.routes.js';
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

const TARGET_USER_ID = '22222222-2222-4000-a000-222222222222';
const TEST_GROUP_ID_1 = 'aaaaaaaa-0000-4000-a000-000000000001';
const TEST_GROUP_ID_2 = 'aaaaaaaa-0000-4000-a000-000000000002';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function sampleUserAccessGroupResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bbbbbbbb-0000-4000-b000-000000000001',
    userId: TARGET_USER_ID,
    accessGroupId: TEST_GROUP_ID_1,
    companyId: TEST_COMPANY_ID,
    assignedBy: TEST_USER_ID,
    createdAt: CREATED_AT,
    accessGroup: {
      id: TEST_GROUP_ID_1,
      code: 'FULL_ACCESS',
      name: 'Full Access',
      description: 'All permissions on all resources',
      isSystem: true,
    },
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
  await app.register(userAccessGroupRoutesPlugin, { prefix: '/system' });
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

  // Configure permission service mock (SUPER_ADMIN bypasses guard entirely)
  if (resolvedRole !== 'SUPER_ADMIN') {
    const hasAccess = ['ADMIN', 'MANAGER'].includes(resolvedRole);
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: hasAccess
        ? { 'system.users.detail': { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true } }
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
// GET /system/users/:id/access-groups
// ---------------------------------------------------------------------------

describe('GET /system/users/:id/access-groups', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #1 — returns assigned groups for ADMIN — 200
  it('returns assigned groups for ADMIN (AC #1) — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([
      sampleUserAccessGroupResult(),
      sampleUserAccessGroupResult({
        id: 'bbbbbbbb-0000-4000-b000-000000000002',
        accessGroupId: TEST_GROUP_ID_2,
        accessGroup: {
          id: TEST_GROUP_ID_2,
          code: 'REPORT_VIEWER',
          name: 'Report Viewer',
          description: null,
          isSystem: false,
        },
      }),
    ]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe(TARGET_USER_ID);
    expect(body.data.companyId).toBe(TEST_COMPANY_ID);
    expect(body.data.accessGroups).toHaveLength(2);
    expect(body.data.accessGroups[0].id).toBe(TEST_GROUP_ID_1);
    expect(body.data.accessGroups[0].code).toBe('FULL_ACCESS');
    expect(body.data.accessGroups[0].assignedBy).toBe(TEST_USER_ID);
    expect(body.data.accessGroups[0].assignedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(body.data.accessGroups[1].id).toBe(TEST_GROUP_ID_2);
    expect(body.data.accessGroups[1].description).toBeNull();
  });

  // AC #1 — returns 404 for user not in company
  it('returns 404 for user not in company', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });

  // Returns empty accessGroups array for user with no groups
  it('returns empty accessGroups array for user with no groups', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe(TARGET_USER_ID);
    expect(body.data.accessGroups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PUT /system/users/:id/access-groups
// ---------------------------------------------------------------------------

describe('PUT /system/users/:id/access-groups', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #2 — assigns groups for ADMIN — 200
  it('assigns groups for ADMIN (AC #2) — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([
      { id: TEST_GROUP_ID_1 },
      { id: TEST_GROUP_ID_2 },
    ]);
    mockPrisma.userAccessGroup.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.userAccessGroup.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([
      sampleUserAccessGroupResult(),
      sampleUserAccessGroupResult({
        id: 'bbbbbbbb-0000-4000-b000-000000000002',
        accessGroupId: TEST_GROUP_ID_2,
        accessGroup: {
          id: TEST_GROUP_ID_2,
          code: 'REPORT_VIEWER',
          name: 'Report Viewer',
          description: null,
          isSystem: false,
        },
      }),
    ]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_1, TEST_GROUP_ID_2] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe(TARGET_USER_ID);
    expect(body.data.companyId).toBe(TEST_COMPANY_ID);
    expect(body.data.accessGroups).toHaveLength(2);
    expect(body.data.accessGroups[0]).toEqual({
      id: TEST_GROUP_ID_1,
      code: 'FULL_ACCESS',
      name: 'Full Access',
      description: 'All permissions on all resources',
      isSystem: true,
      assignedBy: TEST_USER_ID,
      assignedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(body.data.accessGroups[1]).toEqual({
      id: TEST_GROUP_ID_2,
      code: 'REPORT_VIEWER',
      name: 'Report Viewer',
      description: null,
      isSystem: false,
      assignedBy: TEST_USER_ID,
      assignedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  // AC #2 — replaces existing assignments
  it('replaces existing assignments (AC #2)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([{ id: TEST_GROUP_ID_2 }]);
    mockPrisma.userAccessGroup.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAccessGroup.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([
      sampleUserAccessGroupResult({
        accessGroupId: TEST_GROUP_ID_2,
        accessGroup: {
          id: TEST_GROUP_ID_2,
          code: 'REPORT_VIEWER',
          name: 'Report Viewer',
          description: null,
          isSystem: false,
        },
      }),
    ]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_2] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.accessGroups).toHaveLength(1);
    expect(body.data.accessGroups[0].id).toBe(TEST_GROUP_ID_2);

    // Verify deleteMany was called with companyId
    expect(mockPrisma.userAccessGroup.deleteMany).toHaveBeenCalledWith({
      where: { userId: TARGET_USER_ID, companyId: TEST_COMPANY_ID },
    });
  });

  // AC #2 — records assignedBy
  it('records assignedBy (AC #2)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([{ id: TEST_GROUP_ID_1 }]);
    mockPrisma.userAccessGroup.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.userAccessGroup.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([sampleUserAccessGroupResult()]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_1] },
    });

    expect(res.statusCode).toBe(200);

    // Verify assignedBy is the authenticated admin (TEST_USER_ID)
    expect(mockPrisma.userAccessGroup.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ assignedBy: TEST_USER_ID }),
      ],
    });
  });

  // AC #3 — empty array returns 422
  it('with empty array returns 422 (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [] },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('MIN_GROUPS_REQUIRED');
  });

  // AC #4 — invalid company group returns 400
  it('with invalid company group returns 400 (AC #4)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    // Only one group found (the other belongs to a different company)
    mockPrisma.accessGroup.findMany.mockResolvedValue([{ id: TEST_GROUP_ID_1 }]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_1, TEST_GROUP_ID_2] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ACCESS_GROUP');
  });

  // AC #4 — non-existent group ID returns 400
  it('with non-existent group ID returns 400 (AC #4)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);

    app = await buildTestApp();

    const nonExistentId = 'ffffffff-0000-4000-a000-000000000001';
    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [nonExistentId] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ACCESS_GROUP');
  });

  // Inactive group returns 400
  it('with inactive group returns 400', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    // findMany with isActive: true returns empty for inactive group
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_1] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ACCESS_GROUP');
  });

  // Duplicate access group IDs returns 400
  it('with duplicate accessGroupIds returns 400', async () => {
    setupMocks({ role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_1, TEST_GROUP_ID_1] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
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

  it('GET /system/users/:id/access-groups — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('PUT /system/users/:id/access-groups — 403 for STAFF', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_1] },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// RBAC — SUPER_ADMIN gets 200
// ---------------------------------------------------------------------------

describe('RBAC — SUPER_ADMIN gets 200 on all endpoints', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('GET /system/users/:id/access-groups — 200 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('PUT /system/users/:id/access-groups — 200 for SUPER_ADMIN', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([{ id: TEST_GROUP_ID_1 }]);
    mockPrisma.userAccessGroup.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.userAccessGroup.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([sampleUserAccessGroupResult()]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      headers: authHeaders(testJwt),
      payload: { accessGroupIds: [TEST_GROUP_ID_1] },
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

  it('GET /system/users/:id/access-groups — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('PUT /system/users/:id/access-groups — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: `/system/users/${TARGET_USER_ID}/access-groups`,
      payload: { accessGroupIds: [TEST_GROUP_ID_1] },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});
