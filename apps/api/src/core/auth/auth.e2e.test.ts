import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

import { _clearAll } from './login-rate-limiter.js';

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
const mockCompanyProfileFindUnique = vi.fn();

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
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    companyProfile: {
      findUnique: (...args: unknown[]) => mockCompanyProfileFindUnique(...args),
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
  VatScheme: {
    STANDARD: 'STANDARD',
    FLAT_RATE: 'FLAT_RATE',
    CASH: 'CASH',
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
import { buildApp } from '../../app.js';

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
// Helpers
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

/** Set up mocks for a successful login flow. */
function setupLoginMocks(): void {
  mockFindUniqueUser.mockResolvedValue(makeTestUser());
  vi.mocked(argon2.verify).mockResolvedValue(true);
  vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
  mockUpdateUser.mockResolvedValue(makeTestUser());
  mockCreateRefreshToken.mockResolvedValue({});
  mockCompanyProfileFindUnique.mockResolvedValue({ isActive: true });
}

/** Set up mocks for a successful refresh flow. */
function setupRefreshMocks(): void {
  mockFindFirstRefreshToken.mockResolvedValue({
    id: 'rt-id-1',
    userId: TEST_USER_ID,
    tokenHash: 'stored-hash',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
  });
  mockUpdateManyRefreshToken.mockResolvedValue({ count: 1 });
  mockFindUniqueUser.mockResolvedValue(makeTestUser());
  vi.mocked(resolveUserRole).mockResolvedValue('SUPER_ADMIN');
  mockCreateRefreshToken.mockResolvedValue({});
  mockCompanyProfileFindUnique.mockResolvedValue({ isActive: true });
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
// E2E Auth Flow Tests (Task 9)
// ---------------------------------------------------------------------------

describe('E2E auth flow (Task 9)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // =========================================================================
  // Task 9.1 — Full lifecycle test
  // =========================================================================

  it('full lifecycle: login -> protected route -> expired token -> refresh -> access again -> logout -> refresh fails', async () => {
    app = await buildApp({ logger: false });

    // Register a test protected route (not in PUBLIC_ROUTE_PREFIXES)
    app.get('/api/v1/me', async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          userId: request.userId,
          tenantId: request.tenantId,
          userRole: request.userRole,
          enabledModules: request.enabledModules,
        },
      });
    });
    await app.ready();

    // --- Step 1: Login ---
    setupLoginMocks();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.success).toBe(true);
    const accessToken = loginBody.data.accessToken as string;
    const refreshCookie = extractRefreshTokenCookie(loginRes);
    expect(accessToken).toBeDefined();
    expect(refreshCookie).toBeDefined();

    // --- Step 2: Access protected route with valid token ---
    const protectedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(protectedRes.statusCode).toBe(200);
    const protectedBody = protectedRes.json();
    expect(protectedBody.data.userId).toBe(TEST_USER_ID);
    expect(protectedBody.data.tenantId).toBe(TEST_COMPANY_ID);
    expect(protectedBody.data.userRole).toBe('SUPER_ADMIN');
    expect(protectedBody.data.enabledModules).toEqual(['FINANCE', 'SALES']);

    // --- Step 3: Token expires (simulate with an already-expired JWT) ---
    const expiredToken = await new SignJWT({
      tenantId: TEST_COMPANY_ID,
      role: 'SUPER_ADMIN',
      enabledModules: ['FINANCE', 'SALES'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(TEST_USER_ID)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(TEST_JWT_SECRET));

    const expiredRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    expect(expiredRes.statusCode).toBe(401);
    expect(expiredRes.json().success).toBe(false);
    expect(expiredRes.json().error.code).toBe('UNAUTHORIZED');

    // --- Step 4: Refresh token to get new access token ---
    setupRefreshMocks();

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { nexa_refresh_token: refreshCookie! },
    });

    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json();
    expect(refreshBody.success).toBe(true);
    const newAccessToken = refreshBody.data.accessToken as string;
    const newRefreshCookie = extractRefreshTokenCookie(refreshRes);
    expect(newAccessToken).toBeDefined();
    expect(newRefreshCookie).toBeDefined();
    // New access token is a valid JWT
    expect(newAccessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    // --- Step 5: Access protected route with new token ---
    const protectedRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${newAccessToken}` },
    });

    expect(protectedRes2.statusCode).toBe(200);
    expect(protectedRes2.json().data.userId).toBe(TEST_USER_ID);

    // --- Step 6: Logout ---
    mockUpdateManyRefreshToken.mockResolvedValue({ count: 1 });

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { nexa_refresh_token: newRefreshCookie! },
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().success).toBe(true);
    expect(logoutRes.json().data.message).toBe('Logged out');

    // --- Step 7: Refresh fails after logout (token revoked) ---
    mockFindFirstRefreshToken.mockResolvedValue(null);

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { nexa_refresh_token: newRefreshCookie! },
    });

    expect(refreshAfterLogout.statusCode).toBe(401);
    expect(refreshAfterLogout.json().success).toBe(false);
    expect(refreshAfterLogout.json().error.code).toBe('UNAUTHORIZED');
  });

  // =========================================================================
  // Task 9.2 — Response envelope format verification
  // =========================================================================

  describe('response envelope format', () => {
    it('login success envelope: { success: true, data: { accessToken, expiresIn, user } }', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      setupLoginMocks();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      // Top-level envelope
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body).not.toHaveProperty('error');

      // Data contains required auth fields (refreshToken is cookie-only)
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).not.toHaveProperty('refreshToken');
      expect(body.data).toHaveProperty('expiresIn');
      expect(body.data).toHaveProperty('user');

      // accessToken is a valid JWT (3-part dot-separated base64url)
      expect(body.data.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

      // expiresIn is 900 seconds (15 minutes)
      expect(body.data.expiresIn).toBe(900);

      // User profile shape
      const { user } = body.data;
      expect(user).toEqual({
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

    it('refresh success envelope: { success: true, data: { accessToken, expiresIn } }', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      setupRefreshMocks();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: { nexa_refresh_token: 'valid-token-value' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      // Top-level envelope
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body).not.toHaveProperty('error');

      // Data shape
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('expiresIn', 900);
      expect(body.data.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('logout success envelope: { success: true, data: { message } }', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      mockUpdateManyRefreshToken.mockResolvedValue({ count: 1 });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: { nexa_refresh_token: 'some-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      // Top-level envelope
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body).not.toHaveProperty('error');
      expect(body.data).toEqual({ message: 'Logged out' });
    });

    it('error envelope: { success: false, error: { code, message } }', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      mockFindUniqueUser.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'wrong@test.com', password: 'wrong' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();

      // Top-level envelope
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      expect(body).not.toHaveProperty('data');

      // Error shape
      expect(body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(body.error).toHaveProperty('message', 'Invalid email or password');
    });
  });
});
