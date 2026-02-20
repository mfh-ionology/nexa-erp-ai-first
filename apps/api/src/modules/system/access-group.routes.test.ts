import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    accessGroup: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    accessGroupPermission: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    accessGroupFieldOverride: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockResolveUserRole: vi.fn(),
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { accessGroupRoutesPlugin } from './access-group.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();
const GROUP_ID = '22222222-2222-4000-a000-222222222222';

function sampleAccessGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    companyId: TEST_COMPANY_ID,
    code: 'FULL_ACCESS',
    name: 'Full Access',
    description: 'Full access to all resources',
    isSystem: true,
    isActive: true,
    createdBy: 'system-seed',
    updatedBy: 'system-seed',
    createdAt: now,
    updatedAt: now,
    permissions: [],
    fieldOverrides: [],
    _count: { userAccessGroups: 3 },
    ...overrides,
  };
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(accessGroupRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });
  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });
  mockResolveUserRole.mockResolvedValue(resolvedRole);
  mockPrisma.$transaction.mockImplementation(async (commands: unknown[]) => commands);
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

describe('Access Group routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  describe('GET /system/access-groups', () => {
    it('returns list of access groups for ADMIN', async () => {
      setupMocks();
      mockPrisma.accessGroup.findMany.mockResolvedValue([
        sampleAccessGroup(),
        sampleAccessGroup({
          id: '33333333-3333-4000-a000-333333333333',
          code: 'READ_ONLY',
          name: 'Read Only',
          isSystem: true,
        }),
      ]);

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
    });

    it('denies STAFF role with 403', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/system/access-groups',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /system/access-groups/:id', () => {
    it('returns access group detail with permissions', async () => {
      setupMocks();
      mockPrisma.accessGroup.findFirst.mockResolvedValue(
        sampleAccessGroup({
          permissions: [
            {
              id: 'p1',
              resourceCode: 'system.dashboard',
              canAccess: true,
              canNew: false,
              canView: true,
              canEdit: false,
              canDelete: false,
            },
          ],
          fieldOverrides: [],
        }),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: `/system/access-groups/${GROUP_ID}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.code).toBe('FULL_ACCESS');
      expect(body.data.permissions).toHaveLength(1);
    });

    it('returns 404 for unknown group', async () => {
      setupMocks();
      mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: `/system/access-groups/${GROUP_ID}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /system/access-groups', () => {
    it('creates a new access group', async () => {
      setupMocks();
      mockPrisma.accessGroup.findUnique.mockResolvedValue(null);
      mockPrisma.accessGroup.create.mockResolvedValue(
        sampleAccessGroup({ code: 'SALES_TEAM', name: 'Sales Team', isSystem: false }),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/system/access-groups',
        headers: authHeaders(testJwt),
        payload: { code: 'SALES_TEAM', name: 'Sales Team' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.code).toBe('SALES_TEAM');
    });

    it('returns 409 for duplicate code', async () => {
      setupMocks();
      mockPrisma.accessGroup.findUnique.mockResolvedValue(sampleAccessGroup());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/system/access-groups',
        headers: authHeaders(testJwt),
        payload: { code: 'FULL_ACCESS', name: 'Duplicate' },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('DELETE /system/access-groups/:id', () => {
    it('soft-deletes a non-system group', async () => {
      setupMocks();
      mockPrisma.accessGroup.findFirst.mockResolvedValue(
        sampleAccessGroup({ isSystem: false, _count: { userAccessGroups: 0 } }),
      );
      mockPrisma.accessGroup.update.mockResolvedValue({});

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/system/access-groups/${GROUP_ID}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(204);
    });

    it('returns 403 when trying to delete system group', async () => {
      setupMocks();
      mockPrisma.accessGroup.findFirst.mockResolvedValue(sampleAccessGroup({ isSystem: true }));

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/system/access-groups/${GROUP_ID}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /system/access-groups/:id/permissions', () => {
    it('replaces permissions for an access group', async () => {
      setupMocks();
      mockPrisma.accessGroup.findFirst.mockResolvedValue(sampleAccessGroup());
      const newPerms = [
        {
          id: 'p1',
          accessGroupId: GROUP_ID,
          resourceCode: 'system.dashboard',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
      ];
      mockPrisma.accessGroupPermission.findMany.mockResolvedValue(newPerms);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PUT',
        url: `/system/access-groups/${GROUP_ID}/permissions`,
        headers: authHeaders(testJwt),
        payload: {
          permissions: [
            {
              resourceCode: 'system.dashboard',
              canAccess: true,
              canNew: false,
              canView: true,
              canEdit: false,
              canDelete: false,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
    });
  });
});
