import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';

import { _clearAll } from './login-rate-limiter.js';
import { appEvents } from '../events/event-emitter.js';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000002';
const TEST_COMPANY_ID = '00000000-0000-4000-a000-000000000001';
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';
const TEST_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$mockhash';

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
import { registerErrorHandler } from '../middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../validation/index.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    passwordHash: TEST_PASSWORD_HASH,
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

// ---------------------------------------------------------------------------
// App builder for auth route tests
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  await app.register(cookie);
  registerErrorHandler(app);
  await app.register(authRoutesPlugin, { prefix: '/auth' });
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Extract cookie from Set-Cookie header
// ---------------------------------------------------------------------------

function extractRefreshTokenCookie(response: {
  headers: Record<string, unknown>;
}): string | undefined {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return undefined;
  const cookieStr = Array.isArray(setCookie) ? String(setCookie[0]) : String(setCookie);
  const match = cookieStr.match(/nexa_refresh_token=([^;]*)/);
  return match?.[1];
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

describe('auth routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // =========================================================================
  // POST /auth/login
  // =========================================================================

  describe('POST /auth/login', () => {
    it('returns correct response shape on successful login', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockUpdateUser.mockResolvedValue(makeTestUser());
      mockCreateRefreshToken.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(typeof body.data.accessToken).toBe('string');
      // refreshToken must NOT be in response body (httpOnly cookie only)
      expect(body.data.refreshToken).toBeUndefined();
      expect(body.data.expiresIn).toBe(900); // 15 * 60
      expect(body.data.user).toEqual({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        firstName: 'Admin',
        lastName: 'User',
        role: 'SUPER_ADMIN',
        enabledModules: ['FINANCE', 'SALES'],
        tenantId: TEST_COMPANY_ID,
        tenantName: 'Test Company Ltd',
        mfaEnabled: false,
      });
    });

    it('sets httpOnly cookie on successful login', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockUpdateUser.mockResolvedValue(makeTestUser());
      mockCreateRefreshToken.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      const setCookie = res.headers['set-cookie'] as string;
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('nexa_refresh_token=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/auth');
      expect(setCookie).toContain('SameSite=Strict');
    });

    it('returns 401 INVALID_CREDENTIALS for wrong email (user not found)', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'nonexistent@test.com', password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toBe('Invalid email or password');
    });

    it('returns 401 INVALID_CREDENTIALS for wrong password (same error message)', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(false);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: 'wrong-password' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      // Same message for both wrong email and wrong password
      expect(body.error.message).toBe('Invalid email or password');
    });

    it('returns 401 for inactive user', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser({ isActive: false }));

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 400 for invalid request body (missing email)', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(400);
    });

    it('records failed attempt on wrong password', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: 'wrong' },
      });

      // After 4 more failed attempts, account should be locked
      for (let i = 0; i < 4; i++) {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: TEST_EMAIL, password: 'wrong' },
        });
      }

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: 'wrong' },
      });

      expect(res.statusCode).toBe(423);
      const body = res.json();
      expect(body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('returns 423 ACCOUNT_LOCKED after 5 failed attempts', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(false);

      // 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: TEST_EMAIL, password: 'wrong' },
        });
      }

      // 6th attempt should be locked
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: 'wrong' },
      });

      expect(res.statusCode).toBe(423);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('updates lastLoginAt on successful login', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockUpdateUser.mockResolvedValue(makeTestUser());
      mockCreateRefreshToken.mockResolvedValue({});

      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_USER_ID },
          data: { lastLoginAt: expect.any(Date) },
        }),
      );
    });

    it('stores refresh token hash in DB on successful login', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockUpdateUser.mockResolvedValue(makeTestUser());
      mockCreateRefreshToken.mockResolvedValue({});

      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(mockCreateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: TEST_USER_ID,
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('emits user.login event on successful login', async () => {
      app = await buildTestApp();

      mockFindUniqueUser.mockResolvedValue(makeTestUser());
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
          payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
        });

        expect(eventSpy).toHaveBeenCalledOnce();
        expect(eventSpy).toHaveBeenCalledWith({
          userId: TEST_USER_ID,
          loginMethod: 'password',
          ipAddress: expect.any(String),
        });
      } finally {
        appEvents.off('user.login', eventSpy);
      }
    });
  });

  // =========================================================================
  // POST /auth/refresh
  // =========================================================================

  describe('POST /auth/refresh', () => {
    it('rotates token on valid refresh', async () => {
      app = await buildTestApp();

      // First login to get a refresh token
      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockUpdateUser.mockResolvedValue(makeTestUser());
      mockCreateRefreshToken.mockResolvedValue({});

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      const refreshTokenCookie = extractRefreshTokenCookie(loginRes);
      expect(refreshTokenCookie).toBeDefined();

      // Set up mocks for refresh
      mockFindFirstRefreshToken.mockResolvedValue({
        id: 'rt-id-1',
        userId: TEST_USER_ID,
        tokenHash: 'old-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });
      mockUpdateManyRefreshToken.mockResolvedValue({ count: 1 });
      mockFindUniqueUser.mockResolvedValue(makeTestUser());

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { nexa_refresh_token: refreshTokenCookie! },
      });

      expect(refreshRes.statusCode).toBe(200);
      const body = refreshRes.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.expiresIn).toBe(900);

      // Verify old token was revoked
      expect(mockUpdateManyRefreshToken).toHaveBeenCalled();
      // Verify new token was created
      expect(mockCreateRefreshToken).toHaveBeenCalled();
    });

    it('returns 401 without cookie', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with old/revoked token', async () => {
      app = await buildTestApp();

      // Token not found in DB (already revoked)
      mockFindFirstRefreshToken.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { nexa_refresh_token: 'some-old-revoked-token' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('sets new httpOnly cookie on refresh', async () => {
      app = await buildTestApp();

      mockFindFirstRefreshToken.mockResolvedValue({
        id: 'rt-id-1',
        userId: TEST_USER_ID,
        tokenHash: 'old-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });
      mockUpdateManyRefreshToken.mockResolvedValue({ count: 1 });
      mockFindUniqueUser.mockResolvedValue(makeTestUser());
      vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
      mockCreateRefreshToken.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { nexa_refresh_token: 'valid-token-value' },
      });

      expect(res.statusCode).toBe(200);
      const setCookie = res.headers['set-cookie'] as string;
      expect(setCookie).toContain('nexa_refresh_token=');
      expect(setCookie).toContain('HttpOnly');
    });
  });

  // =========================================================================
  // POST /auth/logout
  // =========================================================================

  describe('POST /auth/logout', () => {
    it('clears cookie and revokes token', async () => {
      app = await buildTestApp();

      mockUpdateManyRefreshToken.mockResolvedValue({ count: 1 });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: { nexa_refresh_token: 'some-refresh-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Logged out');

      // Verify token was revoked in DB
      expect(mockUpdateManyRefreshToken).toHaveBeenCalled();

      // Verify cookie is cleared (set to empty with past expiry)
      const setCookie = res.headers['set-cookie'] as string;
      expect(setCookie).toContain('nexa_refresh_token=');
    });

    it('succeeds even without a cookie (idempotent)', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.message).toBe('Logged out');

      // No DB call made since no token was present
      expect(mockUpdateManyRefreshToken).not.toHaveBeenCalled();
    });
  });
});
