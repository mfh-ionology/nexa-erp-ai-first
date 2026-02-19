import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import * as OTPAuth from 'otpauth';

import { _clearAll } from './login-rate-limiter.js';
import { appEvents } from '../events/event-emitter.js';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000002';
const TEST_ADMIN_USER_ID = '00000000-0000-4000-a000-000000000003';
const TEST_COMPANY_ID = '00000000-0000-4000-a000-000000000001';
const TEST_OTHER_COMPANY_ID = '00000000-0000-4000-a000-000000000099';
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

// ---------------------------------------------------------------------------
// Mock @nexa/db
// ---------------------------------------------------------------------------

const mockFindUniqueUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();
const mockFindUniqueUserCompanyRole = vi.fn();
const mockFindFirstUserCompanyRole = vi.fn();

vi.mock('@nexa/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUniqueUser(...args),
      update: (...args: unknown[]) => mockUpdateUser(...args),
    },
    refreshToken: {
      create: (...args: unknown[]) => mockCreateRefreshToken(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyRefreshToken(...args),
      findFirst: (...args: unknown[]) => mockFindFirstRefreshToken(...args),
    },
    userCompanyRole: {
      findUnique: (...args: unknown[]) => mockFindUniqueUserCompanyRole(...args),
      findFirst: (...args: unknown[]) => mockFindFirstUserCompanyRole(...args),
    },
  },
  resolveUserRole: vi.fn(),
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

// Import mocked modules after mock setup
import argon2 from 'argon2';
import { resolveUserRole } from '@nexa/db';
import { authRoutesPlugin } from './auth.routes.js';
import { jwtVerifyPlugin } from './jwt-verify.hook.js';
import { registerErrorHandler } from '../middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../validation/index.js';
import { generateAccessToken } from './auth.service.js';
import { generateTotpSecret } from './mfa.service.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mockhash',
    firstName: 'Admin',
    lastName: 'User',
    companyId: TEST_COMPANY_ID,
    mfaEnabled: false,
    mfaSecret: null,
    isActive: true,
    lastLoginAt: null,
    enabledModules: ['FINANCE', 'SALES'],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    company: {
      id: TEST_COMPANY_ID,
      name: 'Test Company Ltd',
    },
    ...overrides,
  };
}

/**
 * Generate a valid JWT for authenticated endpoints.
 */
async function makeAuthToken(
  overrides: {
    sub?: string;
    tenantId?: string;
    role?: string;
    enabledModules?: string[];
  } = {},
): Promise<string> {
  return generateAccessToken({
    sub: overrides.sub ?? TEST_USER_ID,
    tenantId: overrides.tenantId ?? TEST_COMPANY_ID,
    role: overrides.role ?? 'SUPER_ADMIN',
    enabledModules: overrides.enabledModules ?? ['FINANCE', 'SALES'],
  });
}

/**
 * Generate a valid TOTP code from a base32 secret (for test verification).
 */
function generateValidTotpCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'Nexa ERP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}

/**
 * Derive an invalid TOTP code by shifting each digit of the valid code by 5.
 * Avoids hardcoded values like '000000' which could theoretically be valid.
 */
function deriveInvalidTotpCode(secret: string): string {
  const valid = generateValidTotpCode(secret);
  return valid
    .split('')
    .map((d) => ((parseInt(d, 10) + 5) % 10).toString())
    .join('');
}

// ---------------------------------------------------------------------------
// App builder (includes jwtVerifyPlugin for auth-required MFA routes)
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  await app.register(cookie);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
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
  _clearAll();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MFA routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // =========================================================================
  // POST /auth/mfa/setup
  // =========================================================================

  describe('POST /auth/mfa/setup', () => {
    it('returns secret and URI for authenticated user', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      mockUpdateUser.mockResolvedValue(makeTestUser());

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/setup',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.secret).toBeDefined();
      expect(body.data.secret).toMatch(/^[A-Z2-7]+=*$/);
      expect(body.data.uri).toMatch(/^otpauth:\/\/totp\//);
      expect(body.data.uri).toContain('issuer=Nexa%20ERP');
    });

    it('returns 401 for unauthenticated user', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/setup',
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 409 if MFA already enabled', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      mockFindUniqueUser.mockResolvedValue(
        makeTestUser({ mfaEnabled: true, mfaSecret: 'EXISTINGSECRET' }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/setup',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MFA_ALREADY_ENABLED');
    });

    it('allows re-setup when setup was started but not verified (overwrites pending secret)', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      // User has mfaSecret set but mfaEnabled is still false (abandoned setup)
      mockFindUniqueUser.mockResolvedValue(
        makeTestUser({ mfaEnabled: false, mfaSecret: 'PENDINGSECRET' }),
      );
      mockUpdateUser.mockResolvedValue(makeTestUser());

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/setup',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.secret).toBeDefined();
      expect(body.data.secret).not.toBe('PENDINGSECRET');
      expect(body.data.uri).toMatch(/^otpauth:\/\/totp\//);

      // Verify DB was updated with new secret
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mfaSecret: expect.any(String) }),
        }),
      );
    });

    it('emits user.mfa.setup event on successful setup', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      mockUpdateUser.mockResolvedValue(makeTestUser());

      const eventSpy = vi.fn();
      appEvents.on('user.mfa.setup', eventSpy);

      try {
        await app.inject({
          method: 'POST',
          url: '/auth/mfa/setup',
          headers: { authorization: `Bearer ${token}` },
        });

        expect(eventSpy).toHaveBeenCalledOnce();
        expect(eventSpy).toHaveBeenCalledWith({ userId: TEST_USER_ID });
      } finally {
        appEvents.off('user.mfa.setup', eventSpy);
      }
    });
  });

  // =========================================================================
  // POST /auth/mfa/verify
  // =========================================================================

  describe('POST /auth/mfa/verify', () => {
    it('returns 401 for unauthenticated user', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/verify',
        payload: { token: '123456' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('enables MFA with valid TOTP token', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      // Generate a real TOTP secret
      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaSecret: secret }));
      mockUpdateUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: secret }));

      // Generate a valid TOTP code from the same secret
      const totpCode = generateValidTotpCode(secret);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { token: totpCode },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('MFA enabled successfully');

      // Verify user was updated with mfaEnabled: true
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_USER_ID },
          data: { mfaEnabled: true },
        }),
      );
    });

    it('returns 401 MFA_INVALID with invalid TOTP token', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);
      const invalidCode = deriveInvalidTotpCode(secret);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaSecret: secret }));

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { token: invalidCode },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MFA_INVALID');
    });

    it('returns 400 MFA_SETUP_REQUIRED without prior setup', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaSecret: null }));

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { token: '123456' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MFA_SETUP_REQUIRED');
    });

    it('emits user.mfa.enabled event on successful verification', async () => {
      app = await buildTestApp();
      const token = await makeAuthToken();

      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaSecret: secret }));
      mockUpdateUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: secret }));

      const totpCode = generateValidTotpCode(secret);

      const eventSpy = vi.fn();
      appEvents.on('user.mfa.enabled', eventSpy);

      try {
        await app.inject({
          method: 'POST',
          url: '/auth/mfa/verify',
          headers: { authorization: `Bearer ${token}` },
          payload: { token: totpCode },
        });

        expect(eventSpy).toHaveBeenCalledOnce();
        expect(eventSpy).toHaveBeenCalledWith({ userId: TEST_USER_ID });
      } finally {
        appEvents.off('user.mfa.enabled', eventSpy);
      }
    });
  });

  // =========================================================================
  // POST /auth/login (MFA flow)
  // =========================================================================

  describe('POST /auth/login (MFA flow)', () => {
    it('returns requiresMfa: true when MFA enabled but no mfaToken provided', async () => {
      app = await buildTestApp();

      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: secret }));
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.requiresMfa).toBe(true);
      // No tokens should be issued
      expect(body.data.accessToken).toBeUndefined();
    });

    it('issues full JWT tokens when MFA enabled + valid TOTP token provided', async () => {
      app = await buildTestApp();

      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);
      const totpCode = generateValidTotpCode(secret);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: secret }));
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockUpdateUser.mockResolvedValue(makeTestUser());
      mockCreateRefreshToken.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaToken: totpCode },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(typeof body.data.accessToken).toBe('string');
      expect(body.data.expiresIn).toBe(900);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe(TEST_EMAIL);
      expect(body.data.user.mfaEnabled).toBe(true);
    });

    it('returns 400 MFA_SETUP_REQUIRED when mfaEnabled=true but mfaSecret is null', async () => {
      app = await buildTestApp();

      // Data integrity edge case: mfaEnabled=true but mfaSecret was cleared
      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: null }));
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaToken: '123456' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MFA_SETUP_REQUIRED');
    });

    it('emits user.login with loginMethod password+mfa when MFA verified', async () => {
      app = await buildTestApp();

      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);
      const totpCode = generateValidTotpCode(secret);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: secret }));
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockUpdateUser.mockResolvedValue(makeTestUser());
      mockCreateRefreshToken.mockResolvedValue({});

      const eventSpy = vi.fn();
      appEvents.on('user.login', eventSpy);

      try {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaToken: totpCode },
        });

        expect(eventSpy).toHaveBeenCalledOnce();
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ loginMethod: 'password+mfa' }),
        );
      } finally {
        appEvents.off('user.login', eventSpy);
      }
    });

    it('returns 401 MFA_INVALID when MFA enabled + invalid TOTP token provided', async () => {
      app = await buildTestApp();

      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);
      const invalidCode = deriveInvalidTotpCode(secret);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: secret }));
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaToken: invalidCode },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MFA_INVALID');
    });

    it('locks account after 5 failed MFA token attempts during login', async () => {
      app = await buildTestApp();

      const { secret } = generateTotpSecret('Nexa ERP', TEST_EMAIL);
      const invalidCode = deriveInvalidTotpCode(secret);

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ mfaEnabled: true, mfaSecret: secret }));
      vi.mocked(argon2.verify).mockResolvedValue(true);

      // 5 failed MFA token attempts (password is valid each time)
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaToken: invalidCode },
        });
      }

      // 6th attempt should be locked
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaToken: invalidCode },
      });

      expect(res.statusCode).toBe(423);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  // =========================================================================
  // POST /auth/mfa/reset (admin only)
  // =========================================================================

  describe('POST /auth/mfa/reset', () => {
    it('returns 401 for unauthenticated user', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        payload: { userId: TEST_USER_ID },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('admin can reset user MFA and revokes sessions', async () => {
      app = await buildTestApp();
      const adminToken = await makeAuthToken({ sub: TEST_ADMIN_USER_ID, role: 'ADMIN' });

      mockFindUniqueUser.mockResolvedValue(
        makeTestUser({ mfaEnabled: true, mfaSecret: 'SOMESECRET' }),
      );
      mockUpdateUser.mockResolvedValue(makeTestUser({ mfaEnabled: false, mfaSecret: null }));
      mockUpdateManyRefreshToken.mockResolvedValue({ count: 2 });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { userId: TEST_USER_ID },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('MFA reset successfully');

      // Verify MFA was cleared on the target user
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_USER_ID },
          data: { mfaEnabled: false, mfaSecret: null },
        }),
      );

      // Verify all sessions were revoked for the target user (ISSUE #6)
      expect(mockUpdateManyRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER_ID, revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('returns 403 for non-admin user', async () => {
      app = await buildTestApp();
      const staffToken = await makeAuthToken({ role: 'STAFF' });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        headers: { authorization: `Bearer ${staffToken}` },
        payload: { userId: TEST_USER_ID },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');

      // Verify no DB update was attempted
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('returns 403 when admin tries to reset their own MFA', async () => {
      app = await buildTestApp();
      // Admin token with sub = TEST_ADMIN_USER_ID, trying to reset same userId
      const adminToken = await makeAuthToken({ sub: TEST_ADMIN_USER_ID, role: 'ADMIN' });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { userId: TEST_ADMIN_USER_ID },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('own MFA');

      // Verify no DB operations were attempted
      expect(mockFindUniqueUser).not.toHaveBeenCalled();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('returns 403 when company ADMIN tries to reset user in another company', async () => {
      app = await buildTestApp();
      // Admin is in TEST_COMPANY_ID
      const adminToken = await makeAuthToken({ sub: TEST_ADMIN_USER_ID, role: 'ADMIN' });

      // Target user is in a different company
      mockFindUniqueUser.mockResolvedValue(
        makeTestUser({
          companyId: TEST_OTHER_COMPANY_ID,
          mfaEnabled: true,
          mfaSecret: 'SOMESECRET',
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { userId: TEST_USER_ID },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('outside your company');

      // Verify MFA was NOT cleared
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN to reset user in any company', async () => {
      app = await buildTestApp();
      // SUPER_ADMIN with TEST_COMPANY_ID as their tenant
      const superAdminToken = await makeAuthToken({
        sub: TEST_ADMIN_USER_ID,
        role: 'SUPER_ADMIN',
      });

      // Target user is in a different company
      mockFindUniqueUser.mockResolvedValue(
        makeTestUser({
          companyId: TEST_OTHER_COMPANY_ID,
          mfaEnabled: true,
          mfaSecret: 'SOMESECRET',
        }),
      );
      mockUpdateUser.mockResolvedValue(makeTestUser({ mfaEnabled: false, mfaSecret: null }));
      mockUpdateManyRefreshToken.mockResolvedValue({ count: 0 });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/mfa/reset',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { userId: TEST_USER_ID },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('MFA reset successfully');
    });
  });
});
