import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  AppError,
  AuthError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '../errors/index.js';
import { zodSerializerCompiler, zodValidatorCompiler } from '../validation/index.js';

import { registerErrorHandler } from './error-handler.js';

interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

function buildTestApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  return app;
}

describe('error-handler', () => {
  describe('AppError subtypes (7.1)', () => {
    it('maps ValidationError to 400 with details', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new ValidationError('Bad input', { name: ['Required'] });
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Bad input',
          details: { name: ['Required'] },
        },
      });

      await app.close();
    });

    it('maps AuthError 401 to 401', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new AuthError('UNAUTHORIZED', 'Token expired', 401);
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token expired' },
      });

      await app.close();
    });

    it('maps AuthError 403 to 403', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new AuthError('FORBIDDEN', 'Insufficient permissions', 403);
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });

      await app.close();
    });

    it('maps NotFoundError to 404', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new NotFoundError('NOT_FOUND', 'Invoice not found');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });

      await app.close();
    });

    it('maps DomainError to 422 with details', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new DomainError('PERIOD_LOCKED', 'Period is locked', {
          period: ['Cannot post to locked period'],
        });
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'PERIOD_LOCKED',
          message: 'Period is locked',
          details: { period: ['Cannot post to locked period'] },
        },
      });

      await app.close();
    });

    it('maps generic AppError to its statusCode', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new AppError('CONFLICT', 'Resource already exists', 409);
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(409);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: { code: 'CONFLICT', message: 'Resource already exists' },
      });

      await app.close();
    });

    it('omits details when not provided', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new NotFoundError();
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      const body = res.json<ErrorResponse>();
      expect(body.error).not.toHaveProperty('details');

      await app.close();
    });
  });

  describe('Fastify validation errors from Zod (7.2)', () => {
    it('returns 400 with field-level details for invalid body', async () => {
      const app = buildTestApp();
      const bodySchema = z.object({
        email: z.email(),
        name: z.string().min(2),
      });

      app.post('/test', { schema: { body: bodySchema } }, async (_req, reply) => {
        return reply.send({ success: true, data: {} });
      });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test',
        payload: { email: 'not-email', name: 'A' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.details).toBeDefined();
      expect(body.error.details!.email).toBeDefined();
      expect(body.error.details!.name).toBeDefined();

      await app.close();
    });

    it('returns 400 with field errors for missing required fields', async () => {
      const app = buildTestApp();
      const bodySchema = z.object({
        required_field: z.string(),
      });

      app.post('/test', { schema: { body: bodySchema } }, async (_req, reply) => {
        return reply.send({ success: true, data: {} });
      });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();

      await app.close();
    });
  });

  describe('unknown errors (7.3)', () => {
    it('returns 500 INTERNAL_ERROR for unknown errors', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new Error('Something broke');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(500);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });

      await app.close();
    });

    it('does not leak stack traces or internal details for unknown errors', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new TypeError('Cannot read properties of undefined');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(500);
      const body = res.json<ErrorResponse>();
      expect(body.error.message).toBe('An unexpected error occurred');
      expect(body.error).not.toHaveProperty('stack');
      expect(body.error).not.toHaveProperty('details');

      await app.close();
    });

    it('returns generic message even for errors with sensitive info', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new Error('Connection to postgres://user:pass@host failed');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      const body = res.json<ErrorResponse>();
      expect(body.error.message).toBe('An unexpected error occurred');
      expect(JSON.stringify(body)).not.toContain('postgres');

      await app.close();
    });
  });

  describe('Fastify native errors — no internal code leakage (7.3)', () => {
    it('maps Fastify 429 to RATE_LIMITED instead of FST_ERR_* code', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        // Simulate a Fastify-style error with statusCode (like @fastify/rate-limit)
        const err = new Error('Rate limit exceeded') as Error & {
          statusCode: number;
          code: string;
        };
        err.statusCode = 429;
        err.code = 'FST_ERR_RATE_LIMIT';
        throw err;
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(429);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(body.error.code).not.toContain('FST_');

      await app.close();
    });

    it('maps Fastify-style 404 error to NOT_FOUND instead of FST_ERR_* code', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        // Simulate a Fastify-style error with statusCode (like a plugin-generated 404)
        const err = new Error('Entity not found') as Error & {
          statusCode: number;
          code: string;
        };
        err.statusCode = 404;
        err.code = 'FST_ERR_NOT_FOUND';
        throw err;
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.code).not.toContain('FST_');

      await app.close();
    });

    it('uses generic message for Fastify 5xx errors', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        const err = new Error('Internal server detail') as Error & {
          statusCode: number;
          code: string;
        };
        err.statusCode = 503;
        err.code = 'FST_ERR_SOMETHING';
        throw err;
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(503);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('An unexpected error occurred');
      expect(JSON.stringify(body)).not.toContain('Internal server detail');

      await app.close();
    });
  });

  describe('envelope format consistency', () => {
    it('always returns success: false for all error types', async () => {
      const app = buildTestApp();
      app.get('/validation', () => {
        throw new ValidationError();
      });
      app.get('/auth', () => {
        throw new AuthError();
      });
      app.get('/notfound', () => {
        throw new NotFoundError();
      });
      app.get('/domain', () => {
        throw new DomainError();
      });
      app.get('/unknown', () => {
        throw new Error('oops');
      });
      await app.ready();

      for (const url of ['/validation', '/auth', '/notfound', '/domain', '/unknown']) {
        const res = await app.inject({ method: 'GET', url });
        const body = res.json<ErrorResponse>();
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
        expect(typeof body.error.code).toBe('string');
        expect(typeof body.error.message).toBe('string');
      }

      await app.close();
    });
  });
});
