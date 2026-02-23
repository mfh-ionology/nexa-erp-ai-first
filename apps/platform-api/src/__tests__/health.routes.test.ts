import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma — control DB health check results
// ---------------------------------------------------------------------------

const mockQueryRawUnsafe = vi.fn();

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    // Auth routes use these — provide stubs to avoid errors during app build
    platformUser: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    platformAuditLog: {
      create: vi.fn(),
    },
    platformRefreshToken: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock argon2 (required by auth routes loaded during buildApp)
// ---------------------------------------------------------------------------

vi.mock('argon2', () => ({
  default: {
    verify: vi.fn().mockResolvedValue(false),
    hash: vi.fn().mockResolvedValue('$argon2id$dummy'),
    argon2id: 2,
  },
  verify: vi.fn().mockResolvedValue(false),
  hash: vi.fn().mockResolvedValue('$argon2id$dummy'),
  argon2id: 2,
}));

// ---------------------------------------------------------------------------
// Mock otpauth (required by auth routes loaded during buildApp)
// ---------------------------------------------------------------------------

vi.mock('otpauth', () => {
  class MockSecret {
    base32 = 'JBSWY3DPEHPK3PXP';
    static fromBase32() {
      return new MockSecret();
    }
  }
  class MockTOTP {
    validate() {
      return null;
    }
  }
  return { Secret: MockSecret, TOTP: MockTOTP };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { buildApp } from '../app.js';

// Read package.json to compare version
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

interface HealthData {
  status: 'ok' | 'degraded';
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    latencyMs: number;
  };
  redis?: {
    connected: boolean;
    latencyMs: number;
  };
}

interface HealthResponse {
  success: true;
  data: HealthData;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /admin/monitoring/health (Task 5)', () => {
  let app: FastifyInstance | undefined;
  let adminAuthHeader: string;

  beforeAll(async () => {
    process.env.PLATFORM_JWT_SECRET = TEST_JWT_SECRET;
    // DB health check succeeds by default
    mockQueryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);

    // Generate admin JWT for authenticated health check tests
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    const token = await new SignJWT({ role: 'PLATFORM_ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test-health-user-id')
      .setIssuer('nexa-platform')
      .setExpirationTime('1h')
      .sign(secret);
    adminAuthHeader = `Bearer ${token}`;
  });

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
    // Re-set default mock after restoreAllMocks
    mockQueryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('returns 200 with correct structure including database health (authenticated)', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/admin/monitoring/health',
      headers: { authorization: adminAuthHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<HealthResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(
      expect.objectContaining({
        status: 'ok',
        version: expect.any(String) as string,
        uptime: expect.any(Number) as number,
        database: expect.objectContaining({
          connected: true,
          latencyMs: expect.any(Number) as number,
        }) as HealthData['database'],
      }),
    );
  });

  it('returns minimal response without authentication (public endpoint)', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // No Authorization header — should get minimal response
    const res = await app.inject({ method: 'GET', url: '/admin/monitoring/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: true; data: { status: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    // Detailed fields should NOT be present for unauthenticated callers
    expect(body.data).not.toHaveProperty('database');
    expect(body.data).not.toHaveProperty('version');
    expect(body.data).not.toHaveProperty('uptime');
  });

  it('reports database as connected when SELECT 1 succeeds (authenticated)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/admin/monitoring/health',
      headers: { authorization: adminAuthHeader },
    });

    const body = res.json<HealthResponse>();
    expect(body.data.database.connected).toBe(true);
    expect(body.data.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.data.status).toBe('ok');
  });

  it('reports database as disconnected and status degraded when SELECT 1 fails (authenticated)', async () => {
    mockQueryRawUnsafe.mockRejectedValue(new Error('Connection refused'));
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/admin/monitoring/health',
      headers: { authorization: adminAuthHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<HealthResponse>();
    expect(body.data.database.connected).toBe(false);
    expect(body.data.status).toBe('degraded');
  });

  it('version matches package.json version (authenticated)', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/admin/monitoring/health',
      headers: { authorization: adminAuthHeader },
    });

    const body = res.json<HealthResponse>();
    expect(body.data.version).toBe(pkg.version);
  });

  it('uptime is a positive number (authenticated)', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/admin/monitoring/health',
      headers: { authorization: adminAuthHeader },
    });

    const body = res.json<HealthResponse>();
    expect(body.data.uptime).toBeGreaterThan(0);
  });

  it('omits redis field when REDIS_URL is not configured (authenticated)', async () => {
    delete process.env.REDIS_URL;
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/admin/monitoring/health',
      headers: { authorization: adminAuthHeader },
    });

    const body = res.json<HealthResponse>();
    expect(body.data.redis).toBeUndefined();
  });
});
