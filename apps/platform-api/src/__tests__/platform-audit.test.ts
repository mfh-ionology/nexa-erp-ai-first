import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

import { buildApp } from '../app.js';
import { sendSuccess } from '../core/utils/response.js';

// A valid test JWT secret (must match PLATFORM_JWT_SECRET env used by the hook)
const TEST_JWT_SECRET = 'test-platform-jwt-secret-for-audit-tests-min32!!';
let adminAuthHeader: string;

describe('Platform Audit Middleware (Task 6)', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    process.env.PLATFORM_JWT_SECRET = TEST_JWT_SECRET;

    // Generate a valid admin JWT
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    const token = await new SignJWT({ role: 'PLATFORM_ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test-audit-user-id')
      .setIssuer('nexa-platform')
      .setExpirationTime('1h')
      .sign(secret);
    adminAuthHeader = `Bearer ${token}`;
  });

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  describe('platformAudit decorator', () => {
    it('fastify.platformAudit is available after registration', async () => {
      app = await buildApp({ logger: false });
      await app.ready();

      expect(app.platformAudit).toBeDefined();
      expect(typeof app.platformAudit.log).toBe('function');
    });
  });

  describe('audit-on-response hook — state-changing routes', () => {
    it('creates audit log for POST routes with audit config returning 2xx', async () => {
      app = await buildApp({ logger: false });

      // Track calls to platformAudit.log
      const auditCalls: unknown[] = [];
      const originalLog = app.platformAudit.log.bind(app.platformAudit);
      app.platformAudit.log = async (params) => {
        auditCalls.push(params);
        return originalLog(params);
      };

      // Register a test route that opts-in to audit logging
      app.post(
        '/test-audit-post',
        {
          config: {
            audit: { action: 'test.create', targetType: 'test_entity' },
          },
        },
        async (_request, reply) => {
          return sendSuccess(reply, { created: true }, undefined, 201);
        },
      );
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test-audit-post',
        headers: { authorization: adminAuthHeader },
        payload: {},
      });

      expect(res.statusCode).toBe(201);
      expect(auditCalls).toHaveLength(1);

      const call = auditCalls[0] as Record<string, unknown>;
      expect(call.platformUserId).toBe('test-audit-user-id');
      expect(call.action).toBe('test.create');
      expect(call.targetType).toBe('test_entity');
      expect(call.ipAddress).toBeDefined();
    });

    it('creates audit log for DELETE routes with audit config', async () => {
      app = await buildApp({ logger: false });

      const auditCalls: unknown[] = [];
      app.platformAudit.log = async (params) => {
        auditCalls.push(params);
      };

      app.delete(
        '/test-audit-delete/:id',
        {
          config: {
            audit: { action: 'test.delete', targetType: 'test_entity' },
          },
        },
        async (_request, reply) => {
          return sendSuccess(reply, { deleted: true });
        },
      );
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: '/test-audit-delete/some-entity-id',
        headers: { authorization: adminAuthHeader },
      });

      expect(res.statusCode).toBe(200);
      expect(auditCalls).toHaveLength(1);

      const call = auditCalls[0] as Record<string, unknown>;
      expect(call.action).toBe('test.delete');
      expect(call.targetId).toBe('some-entity-id');
    });

    it('creates audit log for PATCH routes with audit config', async () => {
      app = await buildApp({ logger: false });

      const auditCalls: unknown[] = [];
      app.platformAudit.log = async (params) => {
        auditCalls.push(params);
      };

      app.patch(
        '/test-audit-patch/:id',
        {
          config: {
            audit: { action: 'test.update', targetType: 'test_entity' },
          },
        },
        async (_request, reply) => {
          return sendSuccess(reply, { updated: true });
        },
      );
      await app.ready();

      const res = await app.inject({
        method: 'PATCH',
        url: '/test-audit-patch/entity-123',
        headers: { authorization: adminAuthHeader },
        payload: { name: 'updated' },
      });

      expect(res.statusCode).toBe(200);
      expect(auditCalls).toHaveLength(1);

      const call = auditCalls[0] as Record<string, unknown>;
      expect(call.action).toBe('test.update');
      expect(call.targetId).toBe('entity-123');
    });

    it('captures all required fields (actor, action, target, IP, timestamp)', async () => {
      app = await buildApp({ logger: false });

      const auditCalls: unknown[] = [];
      app.platformAudit.log = async (params) => {
        auditCalls.push(params);
      };

      app.post(
        '/test-audit-fields',
        {
          config: {
            audit: { action: 'test.action', targetType: 'test_target' },
          },
        },
        async (_request, reply) => {
          return sendSuccess(reply, { ok: true }, undefined, 201);
        },
      );
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test-audit-fields',
        headers: {
          authorization: adminAuthHeader,
          'user-agent': 'TestAgent/1.0',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(201);
      expect(auditCalls).toHaveLength(1);

      const call = auditCalls[0] as Record<string, unknown>;
      // Actor
      expect(call.platformUserId).toBe('test-audit-user-id');
      // Action
      expect(call.action).toBe('test.action');
      // Target
      expect(call.targetType).toBe('test_target');
      // IP
      expect(call.ipAddress).toBeDefined();
      expect(typeof call.ipAddress).toBe('string');
      // User-Agent
      expect(call.userAgent).toBe('TestAgent/1.0');
    });
  });

  describe('audit-on-response hook — GET requests', () => {
    it('does NOT create audit records for GET requests', async () => {
      app = await buildApp({ logger: false });

      const auditCalls: unknown[] = [];
      app.platformAudit.log = async (params) => {
        auditCalls.push(params);
      };

      app.get(
        '/test-audit-get',
        {
          config: {
            audit: { action: 'test.read', targetType: 'test_entity' },
          },
        },
        async (_request, reply) => {
          return sendSuccess(reply, { items: [] });
        },
      );
      await app.ready();

      await app.inject({
        method: 'GET',
        url: '/test-audit-get',
        headers: { authorization: adminAuthHeader },
      });

      expect(auditCalls).toHaveLength(0);
    });
  });

  describe('audit-on-response hook — routes without audit config', () => {
    it('does NOT create audit records for routes without audit config', async () => {
      app = await buildApp({ logger: false });

      const auditCalls: unknown[] = [];
      app.platformAudit.log = async (params) => {
        auditCalls.push(params);
      };

      // No config.audit on this route
      app.post('/test-no-audit', async (_request, reply) => {
        return sendSuccess(reply, { ok: true }, undefined, 201);
      });
      await app.ready();

      await app.inject({
        method: 'POST',
        url: '/test-no-audit',
        headers: { authorization: adminAuthHeader },
        payload: {},
      });

      expect(auditCalls).toHaveLength(0);
    });
  });

  describe('audit-on-response hook — non-2xx responses', () => {
    it('does NOT create audit records for error responses', async () => {
      app = await buildApp({ logger: false });

      const auditCalls: unknown[] = [];
      app.platformAudit.log = async (params) => {
        auditCalls.push(params);
      };

      app.post(
        '/test-audit-error',
        {
          config: {
            audit: { action: 'test.create', targetType: 'test_entity' },
          },
        },
        async () => {
          throw new Error('Something went wrong');
        },
      );
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test-audit-error',
        headers: { authorization: adminAuthHeader },
        payload: {},
      });

      expect(res.statusCode).toBe(500);
      expect(auditCalls).toHaveLength(0);
    });
  });

  describe('audit service error resilience', () => {
    it('audit service errors do not crash the request', async () => {
      app = await buildApp({ logger: false });

      // Make audit.log throw an error
      app.platformAudit.log = async () => {
        throw new Error('Database connection lost');
      };

      app.post(
        '/test-audit-crash',
        {
          config: {
            audit: { action: 'test.create', targetType: 'test_entity' },
          },
        },
        async (_request, reply) => {
          return sendSuccess(reply, { created: true }, undefined, 201);
        },
      );
      await app.ready();

      // The request should still succeed even when audit fails
      const res = await app.inject({
        method: 'POST',
        url: '/test-audit-crash',
        headers: { authorization: adminAuthHeader },
        payload: {},
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
    });
  });
});
