import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

import { _clearAll } from '../core/auth/login-rate-limiter.js';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const TEST_PLATFORM_USER_ID = '00000000-0000-4000-b000-000000000020';
const TEST_EMAIL = 'admin@nexa-platform.local';
const TEST_PASSWORD = 'platform-admin-dev';
const TEST_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$mockhash';
const TEST_MFA_SECRET = 'JBSWY3DPEHPK3PXP'; // well-known test secret

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

const mockFindUniquePlatformUser = vi.fn();
const mockUpdatePlatformUser = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    platformUser: {
      findUnique: (...args: unknown[]) => mockFindUniquePlatformUser(...args),
      update: (...args: unknown[]) => mockUpdatePlatformUser(...args),
    },
    platformAuditLog: {
      create: (...args: unknown[]) => mockCreateAuditLog(...args),
    },
    platformRefreshToken: {
      create: (...args: unknown[]) => mockCreateRefreshToken(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyRefreshToken(...args),
      findFirst: (...args: unknown[]) => mockFindFirstRefreshToken(...args),
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock argon2
// ---------------------------------------------------------------------------

const mockArgon2Verify = vi.fn();
const mockArgon2Hash = vi.fn();

vi.mock('argon2', () => ({
  default: {
    verify: (...args: unknown[]) => mockArgon2Verify(...args),
    hash: (...args: unknown[]) => mockArgon2Hash(...args),
    argon2id: 2,
  },
  verify: (...args: unknown[]) => mockArgon2Verify(...args),
  hash: (...args: unknown[]) => mockArgon2Hash(...args),
  argon2id: 2,
}));

// ---------------------------------------------------------------------------
// Mock otpauth
// ---------------------------------------------------------------------------

const mockTotpValidate = vi.fn();

vi.mock('otpauth', () => {
  class MockSecret {
    base32 = TEST_MFA_SECRET;
    static fromBase32() {
      return new MockSecret();
    }
    constructor() {
      // no-op
    }
  }
  class MockTOTP {
    validate: (...args: unknown[]) => unknown;
    constructor() {
      this.validate = mockTotpValidate;
    }
    toString() {
      return `otpauth://totp/test?secret=${TEST_MFA_SECRET}`;
    }
  }
  return {
    Secret: MockSecret,
    TOTP: MockTOTP,
  };
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(() => {
  process.env.PLATFORM_JWT_SECRET = TEST_JWT_SECRET;
});

beforeEach(async () => {
  vi.clearAllMocks();
  _clearAll();

  // Default mock: argon2 hash returns a dummy hash
  mockArgon2Hash.mockResolvedValue(TEST_PASSWORD_HASH);

  // Default mock: argon2 verify returns false
  mockArgon2Verify.mockResolvedValue(false);

  // Default mock: update returns the user
  mockUpdatePlatformUser.mockResolvedValue({ id: TEST_PLATFORM_USER_ID });

  // Default mock: audit log create succeeds
  mockCreateAuditLog.mockResolvedValue({ id: 'audit-1' });

  // Default mock: refresh token create succeeds
  mockCreateRefreshToken.mockResolvedValue({ id: 'rt-1' });

  // Default mock: refresh token updateMany succeeds
  mockUpdateManyRefreshToken.mockResolvedValue({ count: 1 });

  // Dynamically import buildApp (after mocks are set)
  const { buildApp } = await import('../app.js');
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  await app?.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_PLATFORM_USER_ID,
    email: TEST_EMAIL,
    passwordHash: TEST_PASSWORD_HASH,
    displayName: 'Platform Admin',
    role: 'PLATFORM_ADMIN',
    mfaEnabled: true,
    mfaSecret: TEST_MFA_SECRET,
    isActive: true,
    lastLoginAt: null,
    ...overrides,
  };
}

function makeViewerUser(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-b000-000000000021',
    email: 'viewer@nexa-platform.local',
    passwordHash: TEST_PASSWORD_HASH,
    displayName: 'Platform Viewer',
    role: 'PLATFORM_VIEWER',
    mfaEnabled: false,
    mfaSecret: null,
    isActive: true,
    lastLoginAt: null,
    ...overrides,
  };
}

async function generateTestJwt(userId: string, role: string): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET);
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('nexa-platform')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

interface LoginSuccessResponse {
  success: true;
  data: {
    accessToken: string;
    expiresIn: number;
    platformUser: {
      id: string;
      email: string;
      displayName: string;
      role: string;
    };
  };
}

interface MfaChallengeSuccessResponse {
  success: true;
  data: {
    requiresMfa: true;
  };
}

interface RefreshSuccessResponse {
  success: true;
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Platform Auth Routes (Task 3)', () => {
  // =========================================================================
  // POST /admin/auth/login
  // =========================================================================
  describe('POST /admin/auth/login', () => {
    it('returns 200 with JWT for valid PLATFORM_ADMIN with MFA', async () => {
      const user = makeAdminUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(true);
      mockTotpValidate.mockReturnValue(0); // valid TOTP

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaCode: '123456' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<LoginSuccessResponse>();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(typeof body.data.accessToken).toBe('string');
      expect(body.data.expiresIn).toBe(900); // 15m = 900s
      expect(body.data.platformUser.id).toBe(TEST_PLATFORM_USER_ID);
      expect(body.data.platformUser.email).toBe(TEST_EMAIL);
      expect(body.data.platformUser.role).toBe('PLATFORM_ADMIN');
    });

    it('sets httpOnly refresh token cookie on successful login', async () => {
      const user = makeAdminUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(true);
      mockTotpValidate.mockReturnValue(0);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaCode: '123456' },
      });

      expect(res.statusCode).toBe(200);
      const setCookie = String(res.headers['set-cookie']);
      expect(setCookie).toContain('nexa_platform_refresh_token=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/admin/auth');
    });

    it('creates PlatformAuditLog entry on successful login', async () => {
      const user = makeAdminUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(true);
      mockTotpValidate.mockReturnValue(0);

      await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaCode: '123456' },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'auth.login',
            platformUserId: TEST_PLATFORM_USER_ID,
            targetType: 'platform_user',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('returns 403 for PLATFORM_ADMIN without MFA enabled (BR-PLT-018)', async () => {
      const user = makeAdminUser({ mfaEnabled: false, mfaSecret: null });
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('MFA_REQUIRED');
    });

    it('allows PLATFORM_VIEWER without MFA', async () => {
      const user = makeViewerUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: 'viewer@nexa-platform.local', password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<LoginSuccessResponse>();
      expect(body.data.platformUser.role).toBe('PLATFORM_VIEWER');
    });

    it('returns 202 MFA challenge when mfaEnabled but no mfaCode provided', async () => {
      const user = makeAdminUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
        // no mfaCode
      });

      expect(res.statusCode).toBe(202);
      const body = res.json<MfaChallengeSuccessResponse>();
      expect(body.data.requiresMfa).toBe(true);
    });

    it('returns 401 for wrong password (no timing leak)', async () => {
      const user = makeAdminUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(false); // password mismatch

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: 'wrong-password', mfaCode: '123456' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for wrong MFA code', async () => {
      const user = makeAdminUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockArgon2Verify.mockResolvedValue(true);
      mockTotpValidate.mockReturnValue(null); // invalid TOTP

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD, mfaCode: '000000' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('MFA_INVALID');
    });

    it('returns 401 for non-existent email (timing-safe)', async () => {
      mockFindUniquePlatformUser.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: 'nonexistent@example.com', password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      // Should have called argon2 verify to equalise timing
      expect(mockArgon2Verify).toHaveBeenCalled();
    });

    it('returns 401 for inactive user', async () => {
      const user = makeAdminUser({ isActive: false });
      mockFindUniquePlatformUser.mockResolvedValue(user);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 400 for missing email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for missing password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 429 when account is locked from too many failed attempts', async () => {
      mockFindUniquePlatformUser.mockResolvedValue(null);
      mockArgon2Verify.mockResolvedValue(false);

      // Simulate 5 failed attempts to trigger lock
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/admin/auth/login',
          payload: { email: TEST_EMAIL, password: 'wrong' },
        });
      }

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        payload: { email: TEST_EMAIL, password: 'wrong' },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  // =========================================================================
  // POST /admin/auth/mfa/verify
  // =========================================================================
  describe('POST /admin/auth/mfa/verify', () => {
    it('enables MFA when valid code is provided (authenticated)', async () => {
      const user = makeAdminUser({ mfaEnabled: false });
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockTotpValidate.mockReturnValue(0); // valid TOTP
      const token = await generateTestJwt(TEST_PLATFORM_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/mfa/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { mfaCode: '123456' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: true; data: { message: string } }>();
      expect(body.data.message).toBe('MFA enabled successfully');
      expect(mockUpdatePlatformUser).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_PLATFORM_USER_ID },
          data: { mfaEnabled: true },
        }),
      );
    });

    it('returns success when MFA is already enabled', async () => {
      const user = makeAdminUser({ mfaEnabled: true });
      mockFindUniquePlatformUser.mockResolvedValue(user);
      const token = await generateTestJwt(TEST_PLATFORM_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/mfa/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { mfaCode: '123456' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: true; data: { message: string } }>();
      expect(body.data.message).toBe('MFA is already enabled');
    });

    it('returns 401 for invalid MFA code', async () => {
      const user = makeAdminUser({ mfaEnabled: false });
      mockFindUniquePlatformUser.mockResolvedValue(user);
      mockTotpValidate.mockReturnValue(null); // invalid
      const token = await generateTestJwt(TEST_PLATFORM_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/mfa/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { mfaCode: '000000' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('MFA_INVALID');
    });

    it('returns 400 when mfaSecret is not set up', async () => {
      const user = makeAdminUser({ mfaEnabled: false, mfaSecret: null });
      mockFindUniquePlatformUser.mockResolvedValue(user);
      const token = await generateTestJwt(TEST_PLATFORM_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/mfa/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { mfaCode: '123456' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('MFA_SETUP_REQUIRED');
    });

    it('returns 401 without JWT authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/mfa/verify',
        payload: { mfaCode: '123456' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // POST /admin/auth/refresh
  // =========================================================================
  describe('POST /admin/auth/refresh', () => {
    it('returns new access token when valid refresh token cookie is present', async () => {
      // Set up: mock findFirst returns a valid refresh token
      mockFindFirstRefreshToken.mockResolvedValue({
        id: 'rt-1',
        platformUserId: TEST_PLATFORM_USER_ID,
        tokenHash: 'somehash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      const user = makeAdminUser();
      mockFindUniquePlatformUser.mockResolvedValue(user);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
        cookies: { nexa_platform_refresh_token: 'valid-refresh-token-hex' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<RefreshSuccessResponse>();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.expiresIn).toBe(900);

      // Should revoke old token
      expect(mockUpdateManyRefreshToken).toHaveBeenCalled();
      // Should create new token
      expect(mockCreateRefreshToken).toHaveBeenCalled();
    });

    it('creates PlatformAuditLog entry on successful refresh (BR-PLT-017)', async () => {
      mockFindFirstRefreshToken.mockResolvedValue({
        id: 'rt-1',
        platformUserId: TEST_PLATFORM_USER_ID,
        tokenHash: 'somehash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });
      mockFindUniquePlatformUser.mockResolvedValue(makeAdminUser());

      await app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
        cookies: { nexa_platform_refresh_token: 'valid-refresh-token-hex' },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'auth.refresh',
            platformUserId: TEST_PLATFORM_USER_ID,
            targetType: 'platform_user',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('sets new refresh token cookie after refresh', async () => {
      mockFindFirstRefreshToken.mockResolvedValue({
        id: 'rt-1',
        platformUserId: TEST_PLATFORM_USER_ID,
        tokenHash: 'somehash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });
      mockFindUniquePlatformUser.mockResolvedValue(makeAdminUser());

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
        cookies: { nexa_platform_refresh_token: 'valid-refresh-token-hex' },
      });

      const setCookie = String(res.headers['set-cookie']);
      expect(setCookie).toContain('nexa_platform_refresh_token=');
      expect(setCookie).toContain('HttpOnly');
    });

    it('returns 401 when no refresh token cookie is present', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when refresh token is invalid (not found in DB)', async () => {
      mockFindFirstRefreshToken.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
        cookies: { nexa_platform_refresh_token: 'invalid-token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when user is inactive', async () => {
      mockFindFirstRefreshToken.mockResolvedValue({
        id: 'rt-1',
        platformUserId: TEST_PLATFORM_USER_ID,
        tokenHash: 'somehash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });
      mockFindUniquePlatformUser.mockResolvedValue(makeAdminUser({ isActive: false }));

      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
        cookies: { nexa_platform_refresh_token: 'valid-token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // POST /admin/auth/logout
  // =========================================================================
  describe('POST /admin/auth/logout', () => {
    it('clears refresh token cookie and returns success', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/logout',
        cookies: { nexa_platform_refresh_token: 'some-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: true; data: { message: string } }>();
      expect(body.data.message).toBe('Logged out');

      // Should revoke token in DB
      expect(mockUpdateManyRefreshToken).toHaveBeenCalled();

      // Cookie should be cleared
      const setCookie = String(res.headers['set-cookie']);
      expect(setCookie).toContain('nexa_platform_refresh_token=');
    });

    it('succeeds even without a refresh token cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/logout',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: true; data: { message: string } }>();
      expect(body.data.message).toBe('Logged out');
    });

    it('creates PlatformAuditLog entry when user is authenticated (BR-PLT-017)', async () => {
      const token = await generateTestJwt(TEST_PLATFORM_USER_ID, 'PLATFORM_ADMIN');

      await app.inject({
        method: 'POST',
        url: '/admin/auth/logout',
        headers: { authorization: `Bearer ${token}` },
        cookies: { nexa_platform_refresh_token: 'some-token' },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'auth.logout',
            platformUserId: TEST_PLATFORM_USER_ID,
            targetType: 'platform_user',
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  // =========================================================================
  // JWT verification hook
  // =========================================================================
  describe('JWT verification hook', () => {
    it('public routes do not require authentication', async () => {
      // Health endpoint is public
      const res = await app.inject({
        method: 'GET',
        url: '/admin/monitoring/health',
      });
      expect(res.statusCode).toBe(200);
    });

    it('non-public routes return 401 without auth header', async () => {
      // Any non-public URL will hit the JWT hook before 404 handler
      const res = await app.inject({
        method: 'GET',
        url: '/admin/some-protected-route',
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('non-public routes return 401 with invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/some-protected-route',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('non-public routes return 401 with missing Bearer prefix', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/some-protected-route',
        headers: { authorization: 'some-token-no-bearer' },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
