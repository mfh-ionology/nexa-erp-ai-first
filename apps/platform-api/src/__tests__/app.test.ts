import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SignJWT } from 'jose';

import { buildApp } from '../app.js';
import { NotFoundError, ValidationError } from '../core/errors/app-error.js';

// A valid test JWT secret (must match PLATFORM_JWT_SECRET env used by the hook)
const TEST_JWT_SECRET = 'test-platform-jwt-secret-for-app-tests-min32!!';
let testAuthHeader: string;

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

describe('Platform API — buildApp (Task 1)', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    process.env.PLATFORM_JWT_SECRET = TEST_JWT_SECRET;
    // Generate a valid test JWT for authenticated route tests
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    const token = await new SignJWT({ role: 'PLATFORM_ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test-user-id')
      .setIssuer('nexa-platform')
      .setExpirationTime('1h')
      .sign(secret);
    testAuthHeader = `Bearer ${token}`;
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns a FastifyInstance', async () => {
    app = await buildApp({ logger: false });
    expect(app).toBeDefined();
    expect(typeof app.inject).toBe('function');
  });

  describe('Health endpoint', () => {
    it('GET /admin/monitoring/health returns 200 with success envelope', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/admin/monitoring/health' });

      expect(res.statusCode).toBe(200);
      const body = res.json<HealthResponse>();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
    });

    it('includes version from package.json (authenticated)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/monitoring/health',
        headers: { authorization: testAuthHeader },
      });

      const body = res.json<HealthResponse>();
      expect(body.data.version).toBeDefined();
      expect(typeof body.data.version).toBe('string');
    });

    it('includes uptime as a positive number (authenticated)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/monitoring/health',
        headers: { authorization: testAuthHeader },
      });

      const body = res.json<HealthResponse>();
      expect(typeof body.data.uptime).toBe('number');
      expect(body.data.uptime).toBeGreaterThan(0);
    });

    it('returns the full expected shape (authenticated)', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/monitoring/health',
        headers: { authorization: testAuthHeader },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<HealthResponse>();
      expect(body).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'ok',
            version: expect.any(String) as string,
            uptime: expect.any(Number) as number,
          }) as HealthData,
        }),
      );
    });
  });

  describe('404 handling', () => {
    it('unknown routes return 404 with standard error envelope', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/nonexistent-route',
        headers: { authorization: testAuthHeader },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    });
  });

  describe('CORS', () => {
    it('returns access-control-allow-origin header on cross-origin request', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/monitoring/health',
        headers: { origin: 'http://localhost:5174' },
      });

      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('returns CORS headers on OPTIONS preflight request', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'OPTIONS',
        url: '/admin/monitoring/health',
        headers: {
          origin: 'http://localhost:5174',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBeDefined();
      expect(res.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Helmet security headers', () => {
    it('returns x-content-type-options and x-frame-options headers', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/admin/monitoring/health' });

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Rate limiting', () => {
    it('returns rate-limit headers', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/admin/monitoring/health' });

      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('defaults to 100 req/min limit', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/admin/monitoring/health' });

      expect(res.headers['x-ratelimit-limit']).toBe('100');
    });
  });

  describe('Correlation ID', () => {
    it('generates a UUID when header is not provided', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/admin/monitoring/health' });

      const correlationId = res.headers['x-correlation-id'] as string;
      expect(correlationId).toBeDefined();
      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('passes through an existing correlation ID', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/monitoring/health',
        headers: { 'x-correlation-id': 'my-test-correlation-id' },
      });

      expect(res.headers['x-correlation-id']).toBe('my-test-correlation-id');
    });
  });

  describe('Error handling', () => {
    it('AppError returns correct status code and envelope', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-not-found', () => {
        throw new NotFoundError('NOT_FOUND', 'Item not found');
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test-not-found',
        headers: { authorization: testAuthHeader },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    });

    it('ValidationError returns 400 with field details', async () => {
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
        headers: { authorization: testAuthHeader },
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

    it('Zod validation errors return 400 VALIDATION_ERROR with field details', async () => {
      app = await buildApp({ logger: false });
      const bodySchema = z.object({
        email: z.email(),
      });
      app.post('/test-zod', { schema: { body: bodySchema } }, async (_req, reply) => {
        return reply.send({ success: true, data: {} });
      });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test-zod',
        payload: { email: 'not-valid' },
        headers: { authorization: testAuthHeader },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
    });

    it('unknown errors return 500 INTERNAL_ERROR with generic message', async () => {
      app = await buildApp({ logger: false });
      app.get('/test-unknown', () => {
        throw new Error('Something went wrong internally');
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/test-unknown',
        headers: { authorization: testAuthHeader },
      });

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });
  });

  describe('Cookie plugin', () => {
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
        headers: { authorization: testAuthHeader },
      });

      expect(res.headers['set-cookie']).toBeDefined();
      expect(String(res.headers['set-cookie'])).toContain('test=value');
    });
  });
});
