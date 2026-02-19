import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
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

import { jwtVerifyPlugin } from '../auth/jwt-verify.hook.js';
import { companyContextPlugin } from './company-context.js';
import { registerErrorHandler } from './error-handler.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const OTHER_COMPANY_ID = '22222222-2222-4000-a000-222222222222';

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
 * and a test route that exposes the resolved request context.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  // Register plugins in correct order: jwt-verify first, then company-context
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Protected test route that exposes resolved context
  app.get('/protected', async (request) => ({
    userId: request.userId,
    tenantId: request.tenantId,
    companyId: request.companyId,
    userRole: request.userRole,
  }));

  // Public route stubs
  app.get('/health', async () => ({ status: 'ok' }));
  app.post('/auth/login', async () => ({ ok: true }));

  await app.ready();
  return app;
}

/**
 * Configure default mock responses so the middleware succeeds.
 * Individual tests override specific mocks to test failure scenarios.
 */
function setupHappyPath(companyId: string = TEST_COMPANY_ID, role: string = 'ADMIN') {
  mockPrisma.user.findUnique.mockResolvedValue({ companyId, isActive: true });
  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
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

function authHeaders(): { authorization: string } {
  return { authorization: `Bearer ${testJwt}` };
}

// ---------------------------------------------------------------------------
// Company context middleware tests (Task 4)
// ---------------------------------------------------------------------------

describe('Company context middleware', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user exists and is active (middleware always checks isActive).
    // Individual tests override via setupHappyPath() or direct mockResolvedValue.
    mockPrisma.user.findUnique.mockResolvedValue({
      companyId: TEST_COMPANY_ID,
      isActive: true,
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  // -------------------------------------------------------------------------
  // 4.2 — X-Company-ID header present + user has access → companyId set
  // -------------------------------------------------------------------------
  describe('X-Company-ID header present + user has access', () => {
    it('sets companyId from header and resolves role', async () => {
      setupHappyPath(TEST_COMPANY_ID, 'ADMIN');
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': TEST_COMPANY_ID,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ companyId: string; userRole: string }>();
      expect(body.companyId).toBe(TEST_COMPANY_ID);
      expect(body.userRole).toBe('ADMIN');
    });

    it('still queries user table for isActive check even when header is provided', async () => {
      setupHappyPath();
      app = await buildTestApp();

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': TEST_COMPANY_ID,
        },
      });

      // User is always queried to verify isActive status
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { companyId: true, isActive: true },
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4.3 — X-Company-ID header absent → falls back to user's default company
  // -------------------------------------------------------------------------
  describe('X-Company-ID header absent', () => {
    it('falls back to user default company from database', async () => {
      setupHappyPath(TEST_COMPANY_ID, 'ADMIN');
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ companyId: string; userRole: string }>();
      expect(body.companyId).toBe(TEST_COMPANY_ID);
      expect(body.userRole).toBe('ADMIN');
    });

    it('queries user table with userId (tenantId is implicit via database-per-tenant)', async () => {
      setupHappyPath();
      app = await buildTestApp();

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: authHeaders(),
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { companyId: true, isActive: true },
      });
    });

    it('returns 403 when user has no default company assigned', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ companyId: null, isActive: true });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPANY_ACCESS_DENIED');
    });

    it('returns 401 when user is deactivated', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ companyId: TEST_COMPANY_ID, isActive: false });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // -------------------------------------------------------------------------
  // 4.4 — X-Company-ID for company user has NO access to → 403
  // -------------------------------------------------------------------------
  describe('X-Company-ID for company user has NO access to', () => {
    it('returns 403 COMPANY_ACCESS_DENIED', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
      mockResolveUserRole.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': OTHER_COMPANY_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<{ success: boolean; error: { code: string; message: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPANY_ACCESS_DENIED');
      expect(body.error.message).toBe('You do not have access to this company');
    });
  });

  // -------------------------------------------------------------------------
  // 4.5 — X-Company-ID with invalid UUID → 400 validation error
  // -------------------------------------------------------------------------
  describe('X-Company-ID with invalid UUID', () => {
    it('returns 400 VALIDATION_ERROR for malformed UUID', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': 'not-a-uuid',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for partial UUID', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': '11111111-1111-4000',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // 4.6 — X-Company-ID for inactive/non-existent company → 403
  // Security: uniform 403 prevents company-ID enumeration via 404-vs-403
  // -------------------------------------------------------------------------
  describe('X-Company-ID for inactive or non-existent company', () => {
    it('returns 403 COMPANY_ACCESS_DENIED for non-existent company', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': OTHER_COMPANY_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPANY_ACCESS_DENIED');
    });

    it('returns 403 COMPANY_ACCESS_DENIED for inactive company', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: false });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': OTHER_COMPANY_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPANY_ACCESS_DENIED');
    });
  });

  // -------------------------------------------------------------------------
  // 4.7 — Public routes skip company context middleware
  // -------------------------------------------------------------------------
  describe('Public routes skip company context middleware', () => {
    it('/health is accessible without company context', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.companyProfile.findUnique).not.toHaveBeenCalled();
      expect(mockResolveUserRole).not.toHaveBeenCalled();
    });

    it('/auth/login is accessible without company context', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.companyProfile.findUnique).not.toHaveBeenCalled();
      expect(mockResolveUserRole).not.toHaveBeenCalled();
    });

    it('unauthenticated request to protected route returns 401 not company error', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      // JWT verify hook returns 401 before company context runs
      expect(res.statusCode).toBe(401);
      const body = res.json<{ error: { code: string } }>();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(mockPrisma.companyProfile.findUnique).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4.8 — Per-company role override takes effect
  // -------------------------------------------------------------------------
  describe('Per-company role override', () => {
    it('uses company-specific role when it differs from JWT global role', async () => {
      // JWT says ADMIN, but resolveUserRole returns VIEWER for this company
      mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
      mockResolveUserRole.mockResolvedValue('VIEWER');
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(), // JWT has role: 'ADMIN'
          'x-company-id': TEST_COMPANY_ID,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ companyId: string; userRole: string }>();
      // userRole should be VIEWER (company override), not ADMIN (JWT global)
      expect(body.userRole).toBe('VIEWER');
    });

    it('calls resolveUserRole with the correct userId and companyId', async () => {
      setupHappyPath(TEST_COMPANY_ID, 'STAFF');
      app = await buildTestApp();

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          ...authHeaders(),
          'x-company-id': TEST_COMPANY_ID,
        },
      });

      expect(mockResolveUserRole).toHaveBeenCalledWith(mockPrisma, TEST_USER_ID, TEST_COMPANY_ID);
    });
  });
});
