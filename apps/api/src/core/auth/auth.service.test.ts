import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock @nexa/db to avoid PrismaClient initialisation (requires DATABASE_URL)
vi.mock('@nexa/db', () => ({
  resolveUserRole: vi.fn(),
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from './auth.service.js';

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

describe('password hashing', () => {
  it('hashPassword and verifyPassword roundtrip succeeds', async () => {
    const password = 'S3cureP@ssw0rd!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(await verifyPassword(hash, password)).toBe(true);
  });

  it('verifyPassword rejects wrong password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JWT access tokens
// ---------------------------------------------------------------------------

describe('JWT access tokens', () => {
  const payload = {
    sub: '00000000-0000-4000-a000-000000000001',
    tenantId: 'tenant-1',
    role: 'ADMIN',
    enabledModules: ['FINANCE', 'SALES'],
  };

  it('sign and verify roundtrip returns correct claims', async () => {
    const token = await generateAccessToken(payload);
    const decoded = await verifyAccessToken(token);

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.enabledModules).toEqual(payload.enabledModules);
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it('rejects expired tokens', async () => {
    // Temporarily override expiry to 0s
    vi.stubEnv('JWT_ACCESS_EXPIRY', '0s');

    // We need to reimport to pick up the new env value, but since the module
    // reads env at call time via the top-level const, we need to work around it.
    // Instead, generate a token with jose directly for this test.
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);

    const expiredToken = await new SignJWT({
      tenantId: 'tenant-1',
      role: 'ADMIN',
      enabledModules: [],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-id')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600) // 1 hour ago
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800) // 30 min ago
      .sign(secret);

    await expect(verifyAccessToken(expiredToken)).rejects.toThrow();

    vi.stubEnv('JWT_ACCESS_EXPIRY', '15m');
  });

  it('rejects malformed tokens', async () => {
    await expect(verifyAccessToken('not.a.valid.token')).rejects.toThrow();
  });

  it('rejects tokens signed with wrong secret', async () => {
    const { SignJWT } = await import('jose');
    const wrongSecret = new TextEncoder().encode('wrong-secret-that-is-long-enough-32ch');

    const token = await new SignJWT({ tenantId: 't', role: 'ADMIN', enabledModules: [] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-id')
      .setExpirationTime('15m')
      .sign(wrongSecret);

    await expect(verifyAccessToken(token)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

describe('refresh tokens', () => {
  it('generateRefreshToken returns a 64-char hex string', () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates unique tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
  });

  it('hashRefreshToken is deterministic', () => {
    const token = 'abc123';
    const hash1 = hashRefreshToken(token);
    const hash2 = hashRefreshToken(token);
    expect(hash1).toBe(hash2);
  });

  it('hashRefreshToken produces different hashes for different inputs', () => {
    const hash1 = hashRefreshToken('token-a');
    const hash2 = hashRefreshToken('token-b');
    expect(hash1).not.toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// JWT_SECRET validation
// ---------------------------------------------------------------------------

describe('JWT_SECRET validation', () => {
  it('throws when JWT_SECRET is not set', async () => {
    vi.stubEnv('JWT_SECRET', '');

    await expect(
      generateAccessToken({
        sub: 'user-id',
        tenantId: 'tenant-1',
        role: 'ADMIN',
        enabledModules: [],
      }),
    ).rejects.toThrow('JWT_SECRET environment variable is required');

    vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  });

  it('throws when JWT_SECRET is shorter than 32 characters', async () => {
    vi.stubEnv('JWT_SECRET', 'short-secret');

    await expect(
      generateAccessToken({
        sub: 'user-id',
        tenantId: 'tenant-1',
        role: 'ADMIN',
        enabledModules: [],
      }),
    ).rejects.toThrow('JWT_SECRET must be at least 32 characters');

    vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  });
});
