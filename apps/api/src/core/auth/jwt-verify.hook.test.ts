import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000002';
const TEST_TENANT_ID = 'tenant-001';
const TEST_ROLE = 'ADMIN';
const TEST_MODULES = ['FINANCE', 'SALES'];

// ---------------------------------------------------------------------------
// Mock @nexa/db (required to avoid PrismaClient initialisation)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from './jwt-verify.hook.js';
import { registerErrorHandler } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET);

async function generateTestToken(
  overrides: {
    sub?: string;
    tenantId?: string;
    role?: string;
    enabledModules?: string[];
    expiredSeconds?: number;
    secret?: Uint8Array;
  } = {},
): Promise<string> {
  const jwt = new SignJWT({
    tenantId: overrides.tenantId ?? TEST_TENANT_ID,
    role: overrides.role ?? TEST_ROLE,
    enabledModules: overrides.enabledModules ?? TEST_MODULES,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(overrides.sub ?? TEST_USER_ID)
    .setIssuedAt();

  if (overrides.expiredSeconds !== undefined) {
    // Create an already-expired token
    const now = Math.floor(Date.now() / 1000);
    jwt.setExpirationTime(now - overrides.expiredSeconds);
  } else {
    jwt.setExpirationTime('15m');
  }

  return jwt.sign(overrides.secret ?? secretBytes);
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);

  // Protected test route
  app.get('/protected', async (request) => {
    return {
      userId: request.userId,
      tenantId: request.tenantId,
      userRole: request.userRole,
      enabledModules: request.enabledModules,
    };
  });

  // Public route stubs (to test bypass behaviour)
  app.get('/health', async () => ({ status: 'ok' }));
  app.post('/auth/login', async () => ({ ok: true }));
  app.get('/documentation', async () => ({ docs: true }));
  app.post('/auth/password/reset-request', async () => ({ ok: true }));
  app.post('/auth/password/reset', async () => ({ ok: true }));

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jwt-verify hook', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // =========================================================================
  // Valid token decorates request correctly
  // =========================================================================

  it('decorates request with JWT claims on valid token', async () => {
    app = await buildTestApp();
    const token = await generateTestToken();

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe(TEST_USER_ID);
    expect(body.tenantId).toBe(TEST_TENANT_ID);
    expect(body.userRole).toBe(TEST_ROLE);
    expect(body.enabledModules).toEqual(TEST_MODULES);
  });

  // =========================================================================
  // Missing Authorization header returns 401
  // =========================================================================

  it('returns 401 when Authorization header is missing', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Authentication required');
  });

  // =========================================================================
  // Malformed header (no "Bearer") returns 401
  // =========================================================================

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    app = await buildTestApp();
    const token = await generateTestToken();

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Basic ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // =========================================================================
  // Expired token returns 401
  // =========================================================================

  it('returns 401 for expired token', async () => {
    app = await buildTestApp();
    const token = await generateTestToken({ expiredSeconds: 3600 });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // =========================================================================
  // Invalid signature returns 401
  // =========================================================================

  it('returns 401 for token with invalid signature', async () => {
    app = await buildTestApp();
    const wrongSecret = new TextEncoder().encode('wrong-secret-that-is-long-enough-32ch');
    const token = await generateTestToken({ secret: wrongSecret });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // =========================================================================
  // Public routes bypass verification
  // =========================================================================

  describe('public route bypass', () => {
    it('allows /health without Authorization header', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
    });

    it('allows /auth/login without Authorization header', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
      });

      expect(res.statusCode).toBe(200);
    });

    it('allows /documentation without Authorization header', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/documentation',
      });

      expect(res.statusCode).toBe(200);
    });

    it('allows /auth/password/reset-request without Authorization header', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/password/reset-request',
      });

      expect(res.statusCode).toBe(200);
    });

    it('allows /auth/password/reset without Authorization header', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/password/reset',
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('returns 401 when Bearer token is empty', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer ' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for completely malformed token string', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer not-a-valid-jwt' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
