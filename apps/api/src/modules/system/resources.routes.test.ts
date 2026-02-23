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
    resource: {
      findMany: vi.fn(),
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
import { resourceRoutesPlugin } from './resources.routes.js';
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

const now = new Date();

function sampleResource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-0000-4000-a000-000000000001',
    code: 'system.users.list',
    name: 'User Management',
    module: 'system',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 100,
    icon: null,
    description: 'User list view',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const sampleResources = [
  sampleResource(),
  sampleResource({
    id: 'aaaaaaaa-0000-4000-a000-000000000002',
    code: 'system.users.detail',
    name: 'User Detail',
    parentCode: 'system.users.list',
    sortOrder: 101,
    description: 'User detail view',
  }),
  sampleResource({
    id: 'aaaaaaaa-0000-4000-a000-000000000003',
    code: 'system.company-profile.detail',
    name: 'Company Profile',
    type: 'SETTING',
    sortOrder: 200,
    description: 'Company profile settings',
  }),
  sampleResource({
    id: 'aaaaaaaa-0000-4000-a000-000000000004',
    code: 'system.resources.list',
    name: 'Resource Registry',
    sortOrder: 300,
    description: 'Resource registry list',
  }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(resourceRoutesPlugin, { prefix: '/system' });
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
        ? { 'system.resources.list': { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true } }
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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /system/resources', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC #1 — ADMIN user gets 200 with resource list
  it('returns 200 with resource list for ADMIN user (AC #1)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.resource.findMany.mockResolvedValue(sampleResources);
    mockPrisma.resource.count.mockResolvedValue(sampleResources.length);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(4);
    expect(body.meta.total).toBe(4);
    expect(body.data[0].code).toBe('system.users.list');
    expect(body.data[0]).toHaveProperty('id');
    expect(body.data[0]).toHaveProperty('name');
    expect(body.data[0]).toHaveProperty('module');
    expect(body.data[0]).toHaveProperty('type');
    expect(body.data[0]).toHaveProperty('sortOrder');
    expect(body.data[0]).toHaveProperty('isActive');
  });

  // AC #3 — STAFF user gets 403 Forbidden
  it('returns 403 FORBIDDEN for STAFF user (AC #3)', async () => {
    setupMocks({ role: 'STAFF' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // AC #3 — VIEWER user gets 403 Forbidden
  it('returns 403 FORBIDDEN for VIEWER user (AC #3)', async () => {
    setupMocks({ role: 'VIEWER' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // AC #3 — SUPER_ADMIN gets 200 (bypass)
  it('returns 200 for SUPER_ADMIN user (AC #3)', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });
    mockPrisma.resource.findMany.mockResolvedValue(sampleResources);
    mockPrisma.resource.count.mockResolvedValue(sampleResources.length);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(4);
  });

  // AC #1 — query filter by module returns filtered results
  it('passes module filter to service (AC #1)', async () => {
    setupMocks();
    const systemResources = sampleResources.filter((r) => r.module === 'system');
    mockPrisma.resource.findMany.mockResolvedValue(systemResources);
    mockPrisma.resource.count.mockResolvedValue(systemResources.length);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources?module=system',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify module filter was passed to Prisma
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ module: 'system' }),
      }),
    );
  });

  // AC #1 — query filter by type returns filtered results
  it('passes type filter to service (AC #1)', async () => {
    setupMocks();
    const settingResources = sampleResources.filter((r) => r.type === 'SETTING');
    mockPrisma.resource.findMany.mockResolvedValue(settingResources);
    mockPrisma.resource.count.mockResolvedValue(settingResources.length);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources?type=SETTING',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify type filter was passed to Prisma
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'SETTING' }),
      }),
    );
  });

  // AC #1 — search parameter filters by code/name
  it('passes search filter to service (AC #1)', async () => {
    setupMocks();
    const matched = [sampleResources[0]!];
    mockPrisma.resource.findMany.mockResolvedValue(matched);
    mockPrisma.resource.count.mockResolvedValue(1);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources?search=users',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify search filter was passed via OR clause
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              code: expect.objectContaining({ contains: 'users', mode: 'insensitive' }),
            }),
            expect.objectContaining({
              name: expect.objectContaining({ contains: 'users', mode: 'insensitive' }),
            }),
          ]),
        }),
      }),
    );
  });

  // AC #1 — isActive filter works
  it('passes isActive=false filter to service (AC #1)', async () => {
    setupMocks();
    const inactiveResource = sampleResource({
      id: 'bbbbbbbb-0000-4000-a000-000000000001',
      isActive: false,
    });
    mockPrisma.resource.findMany.mockResolvedValue([inactiveResource]);
    mockPrisma.resource.count.mockResolvedValue(1);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources?isActive=false',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].isActive).toBe(false);

    // Verify isActive=false was passed to Prisma
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  // Unauthenticated — no auth → 401
  it('returns 401 UNAUTHORIZED without Authorization header', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/resources',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
