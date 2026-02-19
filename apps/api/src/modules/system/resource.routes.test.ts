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
    resource: { findMany: vi.fn() },
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
  ResourceType: {
    PAGE: 'PAGE',
    REPORT: 'REPORT',
    SETTING: 'SETTING',
    MAINTENANCE: 'MAINTENANCE',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { resourceRoutesPlugin } from './resource.routes.js';
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

function sampleResource(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a000-000000000100',
    code: 'system.dashboard',
    name: 'Dashboard',
    module: 'system',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 0,
    icon: 'dashboard',
    description: 'System dashboard',
    isActive: true,
    createdAt: now,
    updatedAt: now,
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
  await app.register(resourceRoutesPlugin, { prefix: '/system' });
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

describe('Resource routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  describe('GET /system/resources', () => {
    it('returns list of resources for ADMIN', async () => {
      setupMocks();
      const resources = [
        sampleResource(),
        sampleResource({
          id: '00000000-0000-4000-a000-000000000101',
          code: 'system.users.list',
          name: 'Users List',
        }),
      ];
      mockPrisma.resource.findMany.mockResolvedValue(resources);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/system/resources',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].code).toBe('system.dashboard');
    });

    it('filters by module query param', async () => {
      setupMocks();
      mockPrisma.resource.findMany.mockResolvedValue([sampleResource()]);

      app = await buildTestApp();
      await app.inject({
        method: 'GET',
        url: '/system/resources?module=system',
        headers: authHeaders(testJwt),
      });

      expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ module: 'system' }),
        }),
      );
    });

    it('filters by type query param', async () => {
      setupMocks();
      mockPrisma.resource.findMany.mockResolvedValue([]);

      app = await buildTestApp();
      await app.inject({
        method: 'GET',
        url: '/system/resources?type=REPORT',
        headers: authHeaders(testJwt),
      });

      expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'REPORT' }),
        }),
      );
    });

    it('supports search query param', async () => {
      setupMocks();
      mockPrisma.resource.findMany.mockResolvedValue([]);

      app = await buildTestApp();
      await app.inject({
        method: 'GET',
        url: '/system/resources?search=dash',
        headers: authHeaders(testJwt),
      });

      expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'dash', mode: 'insensitive' } },
              { code: { contains: 'dash', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('denies STAFF role with 403', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/system/resources',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
