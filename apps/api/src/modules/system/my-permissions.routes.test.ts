import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    resource: { findMany: vi.fn() },
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
import { myPermissionsRoutesPlugin } from './my-permissions.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Test app builder
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(myPermissionsRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

function setupMocks(role = 'ADMIN') {
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });
  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });
  mockResolveUserRole.mockResolvedValue(role);
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

describe('GET /system/my-permissions', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with effective permissions for authenticated user', async () => {
    setupMocks('ADMIN');

    const effective = {
      permissions: {
        'system.users.list': { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
      },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: 'ADMIN',
      isSuperAdmin: false,
      enabledModules: ['system'],
    };
    mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/my-permissions',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('ADMIN');
    expect(body.data.isSuperAdmin).toBe(false);
    expect(body.data.permissions['system.users.list'].canAccess).toBe(true);
    expect(body.data.accessGroups).toHaveLength(1);
    expect(body.data.enabledModules).toContain('system');
  });

  it('calls permissionService.getEffectivePermissions with correct args', async () => {
    setupMocks('STAFF');

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'STAFF',
      isSuperAdmin: false,
      enabledModules: [],
    });

    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/system/my-permissions',
      headers: authHeaders(testJwt),
    });

    expect(mockPermissionService.getEffectivePermissions).toHaveBeenCalledWith(
      mockPrisma,
      TEST_USER_ID,
      TEST_COMPANY_ID,
      'STAFF',
    );
  });

  it('is accessible to VIEWER role (no permission guard)', async () => {
    setupMocks('VIEWER');

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    app = await buildTestApp();

    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
    const res = await app.inject({
      method: 'GET',
      url: '/system/my-permissions',
      headers: authHeaders(viewerJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('VIEWER');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/my-permissions',
    });

    expect(res.statusCode).toBe(401);
  });
});
