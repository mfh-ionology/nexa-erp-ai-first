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
    messageKey?: string;
    messageParams?: Record<string, string>;
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
      expect(body.error.message).toBe('Please correct the errors below');
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
          message: 'An internal server error occurred',
          messageKey: 'errors:SERVER_ERROR',
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
      expect(body.error.message).toBe('An internal server error occurred');
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
      expect(body.error.message).toBe('An internal server error occurred');
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
      expect(body.error.messageKey).toBe('errors:RATE_LIMITED');

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
      expect(body.error.messageKey).toBe('errors:NOT_FOUND');

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
      expect(body.error.message).toBe('An internal server error occurred');
      expect(body.error.messageKey).toBe('errors:SERVER_ERROR');
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

  describe('messageKey and messageParams in envelope', () => {
    it('includes messageKey and messageParams when present on AppError', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new AppError(
          'CONFLICT',
          'Resource already exists',
          409,
          undefined,
          'errors:CONFLICT',
          { resource: 'User' },
        );
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(409);
      const body = res.json<ErrorResponse>();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
          messageKey: 'errors:CONFLICT',
          messageParams: { resource: 'User' },
        },
      });

      await app.close();
    });

    it('includes messageKey without messageParams when only key is set', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new AuthError(
          'UNAUTHORIZED',
          'Authentication required',
          401,
          'errors:UNAUTHORIZED',
        );
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.messageKey).toBe('errors:UNAUTHORIZED');
      expect(body.error).not.toHaveProperty('messageParams');

      await app.close();
    });

    it('omits messageKey from envelope when not set on error', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new NotFoundError('NOT_FOUND', 'Invoice not found');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      const body = res.json<ErrorResponse>();
      expect(body.error).not.toHaveProperty('messageKey');
      expect(body.error).not.toHaveProperty('messageParams');

      await app.close();
    });

    it('passes messageKey through for ValidationError subclass', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new ValidationError(
          'Bad input',
          { name: ['Required'] },
          'errors:VALIDATION_ERROR',
        );
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.error.messageKey).toBe('errors:VALIDATION_ERROR');
      expect(body.error.details).toEqual({ name: ['Required'] });

      await app.close();
    });

    it('passes messageKey through for DomainError with params', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new DomainError(
          'PERIOD_LOCKED',
          'Period is locked',
          { period: ['Cannot post to locked period'] },
          'errors:BUSINESS_RULE_VIOLATION',
          { period: '2024-01' },
        );
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.messageKey).toBe('errors:BUSINESS_RULE_VIOLATION');
      expect(body.error.messageParams).toEqual({ period: '2024-01' });
      expect(body.error.details).toEqual({ period: ['Cannot post to locked period'] });

      await app.close();
    });

    it('uses tServer-resolved message for 500 errors instead of hardcoded string', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        throw new Error('Something broke');
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(500);
      const body = res.json<ErrorResponse>();
      // tServer('errors:SERVER_ERROR') resolves to the translation from errors.json
      expect(body.error.message).toBe('An internal server error occurred');
      expect(body.error.messageKey).toBe('errors:SERVER_ERROR');

      await app.close();
    });

    it('uses tServer-resolved message for Fastify 5xx errors', async () => {
      const app = buildTestApp();
      app.get('/test', () => {
        const err = new Error('Internal detail') as Error & {
          statusCode: number;
          code: string;
        };
        err.statusCode = 502;
        err.code = 'FST_ERR_SOMETHING';
        throw err;
      });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/test' });

      expect(res.statusCode).toBe(502);
      const body = res.json<ErrorResponse>();
      expect(body.error.message).toBe('An internal server error occurred');
      expect(body.error.messageKey).toBe('errors:SERVER_ERROR');
      expect(JSON.stringify(body)).not.toContain('Internal detail');

      await app.close();
    });
  });
});
