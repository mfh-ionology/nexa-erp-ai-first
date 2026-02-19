import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
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

// Mock argon2 for speed (no real Argon2id hashing in tests)
vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: vi.fn(),
    argon2id: 2,
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../middleware/company-context.js';
import { authRoutesPlugin } from '../auth/auth.routes.js';
import { registerErrorHandler } from '../middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../validation/index.js';
import { createRbacGuard } from './index.js';
import { UserRole } from '@nexa/db';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_ADMIN_USER_ID = '00000000-0000-4000-a000-000000000003';
const TEST_TARGET_USER_ID = '00000000-0000-4000-a000-000000000004';
const TEST_COMPANY_ID = '00000000-0000-4000-a000-000000000001';

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ErrorBody {
  success: boolean;
  error: { code: string; message: string };
}

/**
 * Create a signed JWT with the given claims.
 */
async function makeTestJwt(
  overrides: {
    sub?: string;
    tenantId?: string;
    role?: string;
    enabledModules?: string[];
  } = {},
): Promise<string> {
  return new SignJWT({
    tenantId: overrides.tenantId ?? TEST_COMPANY_ID,
    role: overrides.role ?? 'ADMIN',
    enabledModules: overrides.enabledModules ?? ['FINANCE', 'SALES'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(overrides.sub ?? TEST_ADMIN_USER_ID)
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secretBytes);
}

/**
 * Configure mocks so the company-context middleware succeeds:
 *   - user exists and is active
 *   - company exists and is active
 *   - resolveUserRole returns the specified role
 */
function setupCompanyContext(role: string) {
  mockPrisma.user.findUnique.mockResolvedValueOnce({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });
  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(role);
}

/**
 * Build test app with the full middleware pipeline:
 *   jwt-verify → company-context → routes (auth + test MANAGER route)
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  await app.register(cookie);
  registerErrorHandler(app);

  // Middleware pipeline matching production order
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Test route requiring MANAGER role (for AC #4 / subtask 6.4)
  app.get(
    '/test-manager-route',
    { preHandler: createRbacGuard({ minimumRole: UserRole.MANAGER }) },
    async () => ({ success: true, data: { passed: true } }),
  );

  // Auth routes (includes MFA reset with RBAC guard requiring ADMIN)
  await app.register(authRoutesPlugin, { prefix: '/auth' });

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  vi.stubEnv('NODE_ENV', 'test');
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Integration tests for RBAC on existing routes (Task 6)
// ---------------------------------------------------------------------------

describe('RBAC integration tests', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // =========================================================================
  // 6.2 — STAFF user calls POST /auth/mfa/reset → 403 FORBIDDEN
  // =========================================================================
  describe('POST /auth/mfa/reset — RBAC enforcement', () => {
    it('denies STAFF user with 403 FORBIDDEN (AC #1)', async () => {
      // Company-context resolves effective role to STAFF
      setupCompanyContext('STAFF');
      app = await buildTestApp();

      const staffToken = await makeTestJwt({ role: 'STAFF' });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        headers: { authorization: `Bearer ${staffToken}` },
        payload: { userId: TEST_TARGET_USER_ID },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorBody>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Insufficient permissions');

      // Route handler should NOT have been reached — no user update attempted
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    // =========================================================================
    // 6.3 — ADMIN user calls POST /auth/mfa/reset → 200 (succeeds)
    // =========================================================================
    it('allows ADMIN user and resets MFA successfully (AC #4)', async () => {
      // Use argument-based mock to avoid fragile call ordering.
      // Company-context calls findUnique with the JWT subject (admin user),
      // then the MFA handler calls findUnique with the target user.
      mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === TEST_ADMIN_USER_ID) {
          return Promise.resolve({
            companyId: TEST_COMPANY_ID,
            isActive: true,
          });
        }
        if (args.where.id === TEST_TARGET_USER_ID) {
          return Promise.resolve({
            id: TEST_TARGET_USER_ID,
            companyId: TEST_COMPANY_ID,
            mfaEnabled: true,
            mfaSecret: 'SOMESECRET',
          });
        }
        return Promise.resolve(null);
      });
      mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
      mockResolveUserRole.mockResolvedValue('ADMIN');
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      app = await buildTestApp();

      const adminToken = await makeTestJwt({
        sub: TEST_ADMIN_USER_ID,
        role: 'ADMIN',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { userId: TEST_TARGET_USER_ID },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { message: string } }>();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('MFA reset successfully');

      // Verify MFA was cleared on the target user
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_TARGET_USER_ID },
          data: { mfaEnabled: false, mfaSecret: null },
        }),
      );

      // Verify sessions were revoked
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_TARGET_USER_ID, revokedAt: null },
        }),
      );
    });
  });

  // =========================================================================
  // 6.4 — Company-specific VIEWER override denies access to MANAGER-minimum route
  // =========================================================================
  describe('Company-specific role override — RBAC enforcement', () => {
    it('denies user with VIEWER company override on MANAGER-minimum route (AC #2, #4)', async () => {
      // JWT carries ADMIN global role, but company-context resolves to VIEWER
      setupCompanyContext('VIEWER');
      app = await buildTestApp();

      const adminToken = await makeTestJwt({ role: 'ADMIN' });

      const res = await app.inject({
        method: 'GET',
        url: '/test-manager-route',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorBody>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Insufficient permissions');
    });
  });
});
