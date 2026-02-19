import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db (buildApp now transitively imports it via auth routes)
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ companyId: '00000000-0000-4000-a000-000000000001', isActive: true }),
      update: vi.fn(),
    },
    refreshToken: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
    companyProfile: {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    },
  },
  resolveUserRole: vi.fn().mockResolvedValue('ADMIN'),
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

// Mock argon2 to avoid native module issues in unit tests
vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: vi.fn(),
    argon2id: 2,
  },
}));

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

// Generate a valid test JWT for authenticated test requests
async function makeTestJwt(): Promise<string> {
  return new SignJWT({
    sub: '00000000-0000-4000-a000-000000000099',
    tenantId: '00000000-0000-4000-a000-000000000001',
    role: 'ADMIN',
    enabledModules: ['FINANCE'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(new TextEncoder().encode(TEST_JWT_SECRET));
}

/** Returns auth headers with a valid test JWT */
function authHeaders(): { authorization: string } {
  return { authorization: `Bearer ${testJwt}` };
}

import { buildApp } from './app.js';
import { AuthError, DomainError, NotFoundError, ValidationError } from './core/errors/index.js';

interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

interface HealthData {
  status: string;
  version: string;
  uptime: number;
}

interface HealthResponse {
  success: true;
  data: HealthData;
}

interface OpenApiSpec {
  openapi: string;
  info: { title: string };
  paths: Record<string, unknown>;
}

describe('buildApp (Task 8)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns a FastifyInstance', async () => {
    app = await buildApp({ logger: false });
    expect(app).toBeDefined();
    expect(typeof app.inject).toBe('function');
  });

  describe('plugin registration (8.2)', () => {
    it('registers CORS — returns access-control-allow-origin header', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { origin: 'http://localhost:5173' },
      });

      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('registers Helmet — returns security headers', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      // Helmet sets various security headers
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('registers rate-limit — returns rate-limit headers', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test', headers: authHeaders() });

      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('registers correlation-id — generates ID when not provided', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(typeof res.headers['x-correlation-id']).toBe('string');
    });

    it('registers correlation-id — passes through existing ID', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-correlation-id': 'test-corr-123' },
      });

      expect(res.headers['x-correlation-id']).toBe('test-corr-123');
    });

    it('registers error handler — returns standard error envelope', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', () => {
        throw new NotFoundError('NOT_FOUND', 'Resource not found');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test', headers: authHeaders() });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    });

    it('registers Zod validator — returns 400 on validation failure', async () => {
      app = await buildApp({ logger: false });
      const bodySchema = z.object({
        email: z.email(),
      });
      app.post('/test', { schema: { body: bodySchema } }, async (_req, reply) => {
        return reply.send({ success: true, data: {} });
      });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test',
        payload: { email: 'not-valid' },
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
    });
  });

  describe('CORS configuration (8.3)', () => {
    it('allows all origins by default (CORS_ORIGIN not set)', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { origin: 'http://example.com' },
      });

      expect(res.headers['access-control-allow-origin']).toBe('http://example.com');
    });
  });

  describe('rate-limit configuration (8.4)', () => {
    it('defaults to 100 req/min limit', async () => {
      app = await buildApp({ logger: false });
      app.get('/test', async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test', headers: authHeaders() });

      expect(res.headers['x-ratelimit-limit']).toBe('100');
    });
  });

  describe('swagger configuration (8.5)', () => {
    it('serves OpenAPI docs at /documentation', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/documentation/json' });

      expect(res.statusCode).toBe(200);
      const body = res.json<OpenApiSpec>();
      expect(body.openapi).toMatch(/^3\./);
      expect(body.info.title).toBe('Nexa ERP API');
    });

    it('serves Swagger UI HTML at /documentation', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/documentation' });

      // Swagger UI redirects or returns HTML
      expect([200, 302]).toContain(res.statusCode);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 12 — Integration test suite (AC #1–#6)
// ---------------------------------------------------------------------------
describe('Integration test suite (Task 12)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  // 12.1 Verify all plugins registered
  describe('12.1 — Plugin registration (CORS, Helmet, rate-limit)', () => {
    it('returns CORS access-control-allow-origin header on cross-origin request', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'http://localhost:5173' },
      });

      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('returns CORS headers on OPTIONS preflight request', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBeDefined();
      expect(res.headers['access-control-allow-methods']).toBeDefined();
    });

    it('returns Helmet security headers (x-content-type-options, x-frame-options)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/health' });

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('returns rate-limit headers (x-ratelimit-limit, x-ratelimit-remaining)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/health' });

      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  // 12.2 Verify correlation ID generation and pass-through
  describe('12.2 — Correlation ID', () => {
    it('generates a UUID correlation ID when header is not present', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/health' });

      const correlationId = res.headers['x-correlation-id'] as string;
      expect(correlationId).toBeDefined();
      // UUID v4 format: 8-4-4-4-12 hex characters
      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('passes through an existing correlation ID from request header', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-correlation-id': 'my-custom-correlation-id' },
      });

      expect(res.headers['x-correlation-id']).toBe('my-custom-correlation-id');
    });

    it('returns the same correlation ID on the response as was generated', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res1 = await app.inject({ method: 'GET', url: '/health' });
      const res2 = await app.inject({ method: 'GET', url: '/health' });

      // Each request should get its own unique correlation ID
      expect(res1.headers['x-correlation-id']).not.toBe(res2.headers['x-correlation-id']);
    });
  });

  // 12.3 Verify error envelope format for each error type
  describe('12.3 — Error envelope format for each error type', () => {
    it('NotFoundError → 404 with correct envelope', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-not-found', () => {
        throw new NotFoundError('NOT_FOUND', 'Item not found');
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test-not-found',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    });

    it('AuthError (401) → 401 with correct envelope', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-unauthorized', () => {
        throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test-unauthorized' });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    });

    it('AuthError (403) → 403 with correct envelope', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-forbidden', () => {
        throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test-forbidden',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    });

    it('DomainError → 422 with correct envelope', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-domain', () => {
        throw new DomainError('BUSINESS_RULE_VIOLATION', 'Period is locked');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test-domain', headers: authHeaders() });

      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({
        success: false,
        error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Period is locked' },
      });
    });

    it('ValidationError → 400 with details', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-validation', () => {
        throw new ValidationError('Validation failed', {
          email: ['Invalid email format'],
        });
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test-validation',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { email: ['Invalid email format'] },
        },
      });
    });

    it('Unknown error → 500 INTERNAL_ERROR with generic message', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-unknown', () => {
        throw new Error('Something went wrong internally');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test-unknown', headers: authHeaders() });

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });

    it('all error responses include success: false', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-err-success', () => {
        throw new NotFoundError();
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test-err-success',
        headers: authHeaders(),
      });

      expect(res.json<ErrorResponse>().success).toBe(false);
    });
  });

  // 12.4 Verify Zod validation returns 400 with field errors
  describe('12.4 — Zod validation', () => {
    it('returns 400 with field-level errors for invalid body', async () => {
      app = await buildApp({ logger: false });
      const bodySchema = z.object({
        name: z.string().min(1),
        email: z.email(),
        age: z.number().int().positive(),
      });
      app.post('/test-validate', { schema: { body: bodySchema } }, async (_req, reply) =>
        reply.send({ success: true, data: {} }),
      );
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test-validate',
        payload: { name: '', email: 'bad', age: -5 },
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
      // Field-level errors should be present for each invalid field
      expect(body.error.details!.name).toBeDefined();
      expect(body.error.details!.email).toBeDefined();
      expect(body.error.details!.age).toBeDefined();
    });

    it('returns 400 with field errors for missing required fields', async () => {
      app = await buildApp({ logger: false });
      const bodySchema = z.object({
        title: z.string(),
        amount: z.number(),
      });
      app.post('/test-validate-missing', { schema: { body: bodySchema } }, async (_req, reply) =>
        reply.send({ success: true, data: {} }),
      );
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test-validate-missing',
        payload: {},
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
    });

    it('passes validation and returns success for valid body', async () => {
      app = await buildApp({ logger: false });
      const bodySchema = z.object({
        email: z.email(),
      });
      app.post('/test-validate-ok', { schema: { body: bodySchema } }, async (_req, reply) =>
        reply.send({ success: true, data: { ok: true } }),
      );
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test-validate-ok',
        payload: { email: 'user@example.com' },
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true, data: { ok: true } });
    });
  });

  // 12.5 Verify health endpoint response shape
  describe('12.5 — Health endpoint', () => {
    it('GET /health returns 200 with success envelope { success, data: { status, version, uptime } }', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/health' });

      expect(res.statusCode).toBe(200);
      const body = res.json<HealthResponse>();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
      expect(typeof body.data.version).toBe('string');
      expect(typeof body.data.uptime).toBe('number');
      expect(body.data.uptime).toBeGreaterThan(0);
    });

    it('health response data contains exactly status, version, uptime keys', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/health' });
      const body = res.json<HealthResponse>();

      expect(Object.keys(body).sort()).toEqual(['data', 'success']);
      expect(Object.keys(body.data).sort()).toEqual(['status', 'uptime', 'version']);
    });
  });

  // 12.6 Verify OpenAPI docs accessible at /documentation
  describe('12.6 — OpenAPI documentation', () => {
    it('GET /documentation/json returns OpenAPI 3.x spec', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/documentation/json' });

      expect(res.statusCode).toBe(200);
      const body = res.json<OpenApiSpec>();
      expect(body.openapi).toMatch(/^3\./);
      expect(body.info.title).toBe('Nexa ERP API');
    });

    it('GET /documentation serves Swagger UI', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/documentation' });

      // Swagger UI may return 200 with HTML or redirect to /documentation/
      expect([200, 302]).toContain(res.statusCode);
    });

    it('OpenAPI spec contains /health path', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/documentation/json' });
      const body = res.json<OpenApiSpec>();

      expect(body.paths).toBeDefined();
      expect(body.paths['/health']).toBeDefined();
    });
  });

  // E2.1-API-006 — Rate limiter returns 429 when limit exceeded
  describe('12.7 — Rate limit enforcement (E2.1-API-006)', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-rate', async () => ({ ok: true }));
      await app.ready();

      // Default rate limit is 100 req/min — send 101 requests
      const requests = Array.from({ length: 101 }, () =>
        app!.inject({ method: 'GET', url: '/test-rate', headers: authHeaders() }),
      );
      const responses = await Promise.all(requests);

      const rateLimited = responses.filter((r) => r.statusCode === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Task 7.2 — Auth plugin registration (E2-2)
  // -------------------------------------------------------------------------
  describe('7.2 — Auth plugin registration', () => {
    it('auth routes are registered — POST /auth/login responds (not 404)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@test.com', password: 'test' },
      });

      // Should NOT be 404 (route exists). Will be 401 since user doesn't exist.
      expect(res.statusCode).not.toBe(404);
    });

    it('auth routes are registered — POST /auth/refresh responds (not 404)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
      });

      // Should NOT be 404. Will be 401 since no cookie.
      expect(res.statusCode).not.toBe(404);
    });

    it('auth routes are registered — POST /auth/logout responds (not 404)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      // Should NOT be 404. Logout without cookie returns 200.
      expect(res.statusCode).not.toBe(404);
    });

    it('JWT hook is active — non-public route returns 401 without Bearer token', async () => {
      app = await buildApp({ logger: false });
      app.get('/api/v1/protected', async () => ({ data: 'secret' }));
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/protected',
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('JWT hook skips public routes — /health accessible without token', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
    });

    it('JWT hook skips /auth/login — accessible without token', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@test.com', password: 'test' },
      });

      // Should get auth error (401), not JWT error
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('cookie plugin is registered — Set-Cookie header works', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-cookie', async (_req, reply) => {
        void reply.setCookie('test', 'value', { httpOnly: true });
        return { ok: true };
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test-cookie',
        headers: authHeaders(),
      });

      expect(res.headers['set-cookie']).toBeDefined();
      expect(String(res.headers['set-cookie'])).toContain('test=value');
    });
  });
});
