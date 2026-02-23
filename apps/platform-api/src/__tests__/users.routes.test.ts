import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const ADMIN_USER_ID = '00000000-0000-4000-b000-000000000020';
const VIEWER_USER_ID = '00000000-0000-4000-b000-000000000021';
const TARGET_USER_ID = '00000000-0000-4000-b000-000000000030';

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

const mockFindManyPlatformUser = vi.fn();
const mockFindUniquePlatformUser = vi.fn();
const mockCreatePlatformUser = vi.fn();
const mockUpdatePlatformUser = vi.fn();
const mockCountPlatformUser = vi.fn();
const mockCreateAuditLog = vi.fn();

// These are required by the auth/refresh plugins even though not exercised directly
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    platformUser: {
      findMany: (...args: unknown[]) => mockFindManyPlatformUser(...args),
      findUnique: (...args: unknown[]) => mockFindUniquePlatformUser(...args),
      create: (...args: unknown[]) => mockCreatePlatformUser(...args),
      update: (...args: unknown[]) => mockUpdatePlatformUser(...args),
      count: (...args: unknown[]) => mockCountPlatformUser(...args),
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

const mockArgon2Hash = vi.fn();
const mockArgon2Verify = vi.fn();

vi.mock('argon2', () => ({
  default: {
    hash: (...args: unknown[]) => mockArgon2Hash(...args),
    verify: (...args: unknown[]) => mockArgon2Verify(...args),
    argon2id: 2,
  },
  hash: (...args: unknown[]) => mockArgon2Hash(...args),
  verify: (...args: unknown[]) => mockArgon2Verify(...args),
  argon2id: 2,
}));

// ---------------------------------------------------------------------------
// Mock otpauth (required by platform-auth.service.ts import graph)
// ---------------------------------------------------------------------------

vi.mock('otpauth', () => {
  class MockSecret {
    base32 = 'JBSWY3DPEHPK3PXP';
    static fromBase32() {
      return new MockSecret();
    }
    constructor() {
      // no-op
    }
  }
  class MockTOTP {
    validate() {
      return null;
    }
    toString() {
      return 'otpauth://totp/test';
    }
  }
  return { Secret: MockSecret, TOTP: MockTOTP };
});

// ---------------------------------------------------------------------------
// JWT Helper
// ---------------------------------------------------------------------------

async function generateTestJwt(
  userId: string,
  role: string,
): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET);
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('nexa-platform')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(() => {
  process.env.PLATFORM_JWT_SECRET = TEST_JWT_SECRET;
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Default mocks
  mockArgon2Hash.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockhash');
  mockArgon2Verify.mockResolvedValue(false);
  mockCreateAuditLog.mockResolvedValue({ id: 'audit-1' });
  mockCountPlatformUser.mockResolvedValue(0);

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

function makeUserRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_USER_ID,
    email: 'newuser@nexa-platform.local',
    displayName: 'New User',
    role: 'PLATFORM_VIEWER',
    mfaEnabled: false,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Platform User Management Routes (Task 7)', () => {
  // =========================================================================
  // GET /admin/users
  // =========================================================================
  describe('GET /admin/users', () => {
    it('PLATFORM_ADMIN can list users', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const users = [
        makeUserRecord({ id: ADMIN_USER_ID, email: 'admin@nexa-platform.local', role: 'PLATFORM_ADMIN' }),
        makeUserRecord(),
      ];
      mockFindManyPlatformUser.mockResolvedValue(users);
      mockCountPlatformUser.mockResolvedValue(2);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<UserProfile[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]!.email).toBe('admin@nexa-platform.local');
      expect(body.data[1]!.email).toBe('newuser@nexa-platform.local');
    });

    it('PLATFORM_VIEWER cannot list users → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 401 without auth header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/users',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // POST /admin/users
  // =========================================================================
  describe('POST /admin/users', () => {
    it('PLATFORM_ADMIN can create a user', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue(null); // no existing user with this email
      const newUser = makeUserRecord();
      mockCreatePlatformUser.mockResolvedValue(newUser);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'newuser@nexa-platform.local',
          password: 'StrongP@ss123',
          displayName: 'New User',
          role: 'PLATFORM_VIEWER',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<SuccessResponse<UserProfile>>();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('newuser@nexa-platform.local');
      expect(body.data.displayName).toBe('New User');
      expect(body.data.role).toBe('PLATFORM_VIEWER');
    });

    it('creates audit log with the new user ID as targetId (BR-PLT-017)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue(null);
      const newUser = makeUserRecord();
      mockCreatePlatformUser.mockResolvedValue(newUser);

      await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'newuser@nexa-platform.local',
          password: 'StrongP@ss123',
          displayName: 'New User',
          role: 'PLATFORM_VIEWER',
        },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'platform_user.create',
            platformUserId: ADMIN_USER_ID,
            targetType: 'platform_user',
            targetId: TARGET_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('hashes password with Argon2id', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue(null);
      mockCreatePlatformUser.mockResolvedValue(makeUserRecord());

      await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'newuser@nexa-platform.local',
          password: 'StrongP@ss123',
          displayName: 'New User',
          role: 'PLATFORM_VIEWER',
        },
      });

      expect(mockArgon2Hash).toHaveBeenCalledWith(
        'StrongP@ss123',
        expect.objectContaining({ type: 2 }) as Record<string, unknown>,
      );
    });

    it('returns 409 CONFLICT when email already exists', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue({ id: TARGET_USER_ID }); // existing user

      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'existing@nexa-platform.local',
          password: 'StrongP@ss123',
          displayName: 'Duplicate',
          role: 'PLATFORM_VIEWER',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('CONFLICT');
    });

    it('PLATFORM_VIEWER cannot create users → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'newuser@nexa-platform.local',
          password: 'StrongP@ss123',
          displayName: 'New User',
          role: 'PLATFORM_VIEWER',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 for invalid email', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'not-an-email',
          password: 'StrongP@ss123',
          displayName: 'Test',
          role: 'PLATFORM_VIEWER',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for password not meeting complexity requirements', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'newuser@nexa-platform.local',
          password: 'short',
          displayName: 'Test',
          role: 'PLATFORM_VIEWER',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // PATCH /admin/users/:id
  // =========================================================================
  describe('PATCH /admin/users/:id', () => {
    it('PLATFORM_ADMIN can update a user role', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue({ id: TARGET_USER_ID });
      const updatedUser = makeUserRecord({ role: 'PLATFORM_ADMIN' });
      mockUpdatePlatformUser.mockResolvedValue(updatedUser);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/users/${TARGET_USER_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'PLATFORM_ADMIN' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<UserProfile>>();
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('PLATFORM_ADMIN');
    });

    it('PLATFORM_ADMIN can deactivate another user', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue({ id: TARGET_USER_ID });
      const updatedUser = makeUserRecord({ isActive: false });
      mockUpdatePlatformUser.mockResolvedValue(updatedUser);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/users/${TARGET_USER_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<UserProfile>>();
      expect(body.data.isActive).toBe(false);
    });

    it('cannot deactivate own account → 400', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/users/${ADMIN_USER_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('SELF_DEACTIVATION');
    });

    it('MFA reset clears mfaEnabled and mfaSecret', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue({ id: TARGET_USER_ID });
      const updatedUser = makeUserRecord({ mfaEnabled: false });
      mockUpdatePlatformUser.mockResolvedValue(updatedUser);

      await app.inject({
        method: 'PATCH',
        url: `/admin/users/${TARGET_USER_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { mfaReset: true },
      });

      expect(mockUpdatePlatformUser).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mfaEnabled: false,
            mfaSecret: null,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('returns 404 for non-existent user', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindUniquePlatformUser.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/users/${TARGET_USER_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('PLATFORM_VIEWER cannot update users → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/users/${TARGET_USER_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 for invalid UUID param', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: '/admin/users/not-a-uuid',
        headers: { authorization: `Bearer ${token}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // Role guard
  // =========================================================================
  describe('Role guard (requirePlatformRole)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/users',
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects PLATFORM_VIEWER for admin-only routes with 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const getRes = await app.inject({
        method: 'GET',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(403);

      const postRes = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: 'test@example.com',
          password: 'StrongP@ss123',
          displayName: 'Test',
          role: 'PLATFORM_VIEWER',
        },
      });
      expect(postRes.statusCode).toBe(403);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/admin/users/${TARGET_USER_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isActive: false },
      });
      expect(patchRes.statusCode).toBe(403);
    });

    it('allows PLATFORM_ADMIN for all user routes', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockFindManyPlatformUser.mockResolvedValue([]);

      const getRes = await app.inject({
        method: 'GET',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);
    });
  });
});
