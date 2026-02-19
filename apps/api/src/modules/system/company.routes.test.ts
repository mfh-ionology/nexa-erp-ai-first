import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
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
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { companyRoutesPlugin } from './company.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const CURRENT_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TARGET_COMPANY_ID = '22222222-2222-4000-a000-222222222222';
const NONEXISTENT_COMPANY_ID = '33333333-3333-4000-a000-333333333333';

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

/**
 * Builds a minimal Fastify app with jwt-verify + company-context plugins
 * and the system company routes registered under /system prefix.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Zod compilers (required for route schema validation)
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  registerErrorHandler(app);

  // Register plugins in correct order: jwt-verify first, then company-context
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Register company routes under /system prefix
  await app.register(companyRoutesPlugin, { prefix: '/system' });

  await app.ready();
  return app;
}

/**
 * Configure argument-based mock implementations instead of fragile sequential
 * mockResolvedValueOnce chains. Mocks inspect call arguments to return the
 * correct value regardless of call order or count.
 */
function setupMocks(
  config: {
    companies?: Record<string, { name?: string; isActive: boolean } | null>;
    roles?: Record<string, string | null>;
    userUpdate?: boolean;
  } = {},
) {
  const companies: Record<string, { name?: string; isActive: boolean } | null> = {
    [CURRENT_COMPANY_ID]: { isActive: true },
    ...config.companies,
  };

  const roles: Record<string, string | null> = {
    [CURRENT_COMPANY_ID]: 'ADMIN',
    ...config.roles,
  };

  // Middleware always queries user for isActive + default companyId
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: CURRENT_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve(companies[where.id] ?? null),
  );

  mockResolveUserRole.mockImplementation((_prisma: unknown, _userId: string, companyId: string) =>
    Promise.resolve(roles[companyId] ?? null),
  );

  if (config.userUpdate !== false) {
    mockPrisma.user.update.mockResolvedValue({});
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

function authHeaders(companyId: string = CURRENT_COMPANY_ID) {
  return {
    authorization: `Bearer ${testJwt}`,
    'x-company-id': companyId,
  };
}

// ---------------------------------------------------------------------------
// Company switch endpoint tests (Task 8)
// ---------------------------------------------------------------------------

describe('POST /system/companies/:id/switch', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
  });

  // -------------------------------------------------------------------------
  // 8.2 — Valid switch to accessible company → 200 with new company context
  // -------------------------------------------------------------------------
  describe('valid switch to accessible company', () => {
    it('returns 200 with new company context', async () => {
      setupMocks({
        companies: { [TARGET_COMPANY_ID]: { name: 'Target Company Ltd', isActive: true } },
        roles: { [TARGET_COMPANY_ID]: 'MANAGER' },
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/system/companies/${TARGET_COMPANY_ID}/switch`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        companyId: TARGET_COMPANY_ID,
        companyName: 'Target Company Ltd',
        role: 'MANAGER',
      });
    });
  });

  // -------------------------------------------------------------------------
  // 8.3 — Switch to company without access → 403 COMPANY_ACCESS_DENIED
  // -------------------------------------------------------------------------
  describe('switch to company without access', () => {
    it('returns 403 COMPANY_ACCESS_DENIED', async () => {
      setupMocks({
        companies: { [TARGET_COMPANY_ID]: { name: 'Target Company', isActive: true } },
        roles: { [TARGET_COMPANY_ID]: null },
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/system/companies/${TARGET_COMPANY_ID}/switch`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPANY_ACCESS_DENIED');
      expect(body.error.message).toBe('You do not have access to this company');
    });
  });

  // -------------------------------------------------------------------------
  // 8.4 — Switch to non-existent company → 404 COMPANY_NOT_FOUND
  // -------------------------------------------------------------------------
  describe('switch to non-existent company', () => {
    it('returns 404 COMPANY_NOT_FOUND when company does not exist', async () => {
      // NONEXISTENT_COMPANY_ID not in companies map → returns null
      setupMocks();

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/system/companies/${NONEXISTENT_COMPANY_ID}/switch`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPANY_NOT_FOUND');
    });

    it('returns 404 COMPANY_NOT_FOUND when company is inactive', async () => {
      setupMocks({
        companies: { [TARGET_COMPANY_ID]: { name: 'Inactive Corp', isActive: false } },
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/system/companies/${TARGET_COMPANY_ID}/switch`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPANY_NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // 8.5 — Switch updates User.companyId in database
  // -------------------------------------------------------------------------
  describe('switch updates User.companyId in database', () => {
    it('calls prisma.user.update with the target companyId', async () => {
      setupMocks({
        companies: { [TARGET_COMPANY_ID]: { name: 'New Company', isActive: true } },
        roles: { [TARGET_COMPANY_ID]: 'STAFF' },
      });

      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: `/system/companies/${TARGET_COMPANY_ID}/switch`,
        headers: authHeaders(),
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { companyId: TARGET_COMPANY_ID },
      });
    });
  });

  // -------------------------------------------------------------------------
  // 8.6 — Unauthenticated request → 401
  // -------------------------------------------------------------------------
  describe('unauthenticated request', () => {
    it('returns 401 UNAUTHORIZED without Authorization header', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/system/companies/${TARGET_COMPANY_ID}/switch`,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with invalid Bearer token', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/system/companies/${TARGET_COMPANY_ID}/switch`,
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // -------------------------------------------------------------------------
  // 8.7 — Invalid UUID in :id param → 400 validation error
  // -------------------------------------------------------------------------
  describe('invalid UUID in :id param', () => {
    it('returns 400 VALIDATION_ERROR for malformed UUID in URL', async () => {
      setupMocks();
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/companies/not-a-uuid/switch',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // RBAC guard is wired to the company switch route
  // -------------------------------------------------------------------------
  describe('RBAC guard enforcement', () => {
    it('denies user with invalid role via RBAC guard (proves guard is applied)', async () => {
      // Mock resolveUserRole to return an invalid role string.
      // Company-context sets request.userRole = 'BOGUS' (it doesn't validate).
      // The RBAC guard then catches it with 'Insufficient permissions'.
      setupMocks({
        roles: { [CURRENT_COMPANY_ID]: 'BOGUS' },
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/system/companies/${CURRENT_COMPANY_ID}/switch`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Insufficient permissions');
    });
  });
});
