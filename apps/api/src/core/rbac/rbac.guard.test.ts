import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — only need UserRole enum for the guard
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

import { createRbacGuard } from './rbac.guard.js';
import { UserRole } from '@nexa/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ErrorResponse {
  success: boolean;
  error: { code: string; message: string };
}

/**
 * Build a minimal Fastify app with request decorations (matching jwt-verify.hook.ts)
 * and a hook that sets userRole / enabledModules from custom test headers.
 *
 * This isolates the RBAC guard from the full app stack for unit testing.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Decorate request like jwt-verify.hook.ts does
  app.decorateRequest('userId', '');
  app.decorateRequest('tenantId', '');
  app.decorateRequest('companyId', '');
  app.decorateRequest('userRole', '');
  app.decorateRequest('enabledModules', {
    getter() {
      return (this as unknown as { _enabledModules?: string[] })._enabledModules ?? [];
    },
    setter(value: string[]) {
      (this as unknown as { _enabledModules?: string[] })._enabledModules = value;
    },
  });

  // Register error handler matching the project's envelope format
  app.setErrorHandler((error, _request, reply) => {
    const err = error as { statusCode?: number; code?: string; message: string };
    const statusCode = err.statusCode ?? 500;
    void reply.status(statusCode).send({
      success: false,
      error: {
        code: err.code ?? 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  });

  // Hook to set request context from test headers
  app.addHook('onRequest', async (request) => {
    const role = request.headers['x-test-role'] as string | undefined;
    if (role !== undefined) {
      request.userRole = role;
    }
    const modules = request.headers['x-test-modules'] as string | undefined;
    if (modules) {
      request.enabledModules = modules.split(',');
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createRbacGuard', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  // 3.2 — STAFF denied on MANAGER-minimum route → 403 FORBIDDEN (AC #1)
  it('denies STAFF user on MANAGER-minimum route with 403 FORBIDDEN', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      { preHandler: createRbacGuard({ minimumRole: UserRole.MANAGER }) },
      async () => ({ success: true, data: {} }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': 'STAFF' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toBe('Insufficient permissions');
  });

  // 3.3 — VIEWER denied on STAFF-minimum route → 403
  it('denies VIEWER user on STAFF-minimum route with 403', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      { preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }) },
      async () => ({ success: true, data: {} }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': 'VIEWER' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<ErrorResponse>().error.code).toBe('FORBIDDEN');
  });

  // 3.4 — MANAGER, ADMIN, SUPER_ADMIN all pass on MANAGER-minimum route (AC #4)
  it.each([
    ['MANAGER', UserRole.MANAGER],
    ['ADMIN', UserRole.ADMIN],
    ['SUPER_ADMIN', UserRole.SUPER_ADMIN],
  ])('allows %s on MANAGER-minimum route', async (_label, role) => {
    app = await buildTestApp();
    app.get(
      '/test',
      { preHandler: createRbacGuard({ minimumRole: UserRole.MANAGER }) },
      async () => ({ success: true, data: { passed: true } }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': role },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Close after each parameterised iteration
    await app.close();
    app = undefined;
  });

  // 3.5 — SUPER_ADMIN passes on any minimum role
  it.each([
    ['VIEWER', UserRole.VIEWER],
    ['STAFF', UserRole.STAFF],
    ['MANAGER', UserRole.MANAGER],
    ['ADMIN', UserRole.ADMIN],
    ['SUPER_ADMIN', UserRole.SUPER_ADMIN],
  ])('allows SUPER_ADMIN on %s-minimum route', async (_label, minimumRole) => {
    app = await buildTestApp();
    app.get('/test', { preHandler: createRbacGuard({ minimumRole }) }, async () => ({
      success: true,
      data: { passed: true },
    }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': 'SUPER_ADMIN' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    await app.close();
    app = undefined;
  });

  // 3.6 — VIEWER passes on VIEWER-minimum route
  it('allows VIEWER on VIEWER-minimum route', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      { preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }) },
      async () => ({ success: true, data: { passed: true } }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': 'VIEWER' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // 3.7 — user with no role (empty string) → 403 (AC #3)
  it('denies user with no role (empty string) with 403', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      { preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }) },
      async () => ({ success: true, data: {} }),
    );
    await app.ready();

    // Empty string is the default decoration value — simulate no role set
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      // No x-test-role header → userRole stays as '' (default)
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toBe('Insufficient permissions');
  });

  // Invalid role value → 403 with 'Invalid role' message
  it('denies user with invalid/unknown role value with 403', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      { preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }) },
      async () => ({ success: true, data: {} }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': 'BOGUS_ROLE' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toBe('Insufficient permissions');
  });

  // 3.8 — module gating: user without module → 403 MODULE_NOT_ENABLED (AC #5)
  it('denies user without required module with 403 MODULE_NOT_ENABLED', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      {
        preHandler: createRbacGuard({
          minimumRole: UserRole.STAFF,
          module: 'FINANCE',
        }),
      },
      async () => ({ success: true, data: {} }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-role': 'ADMIN',
        'x-test-modules': 'HR,CRM', // Does NOT include 'FINANCE'
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('MODULE_NOT_ENABLED');
    expect(body.error.message).toBe('You do not have access to this module');
  });

  // 3.9 — module gating: user with correct module → passes
  it('allows user with correct module', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      {
        preHandler: createRbacGuard({
          minimumRole: UserRole.STAFF,
          module: 'FINANCE',
        }),
      },
      async () => ({ success: true, data: { passed: true } }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-role': 'ADMIN',
        'x-test-modules': 'HR,FINANCE,CRM',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // 3.10 — no module specified in options → module check skipped
  it('skips module check when no module specified in guard options', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      {
        preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
        // No module option — module gating should be skipped
      },
      async () => ({ success: true, data: { passed: true } }),
    );
    await app.ready();

    // User has STAFF role but NO modules — should still pass (no module required)
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': 'STAFF' },
      // No x-test-modules header → enabledModules stays as []
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // Additional: module gating with empty modules array should deny
  it('denies when module required but user has empty modules array', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      {
        preHandler: createRbacGuard({
          minimumRole: UserRole.VIEWER,
          module: 'INVENTORY',
        }),
      },
      async () => ({ success: true, data: {} }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-role': 'ADMIN' },
      // No modules header → enabledModules is []
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<ErrorResponse>().error.code).toBe('MODULE_NOT_ENABLED');
  });

  // SUPER_ADMIN bypasses module gating (full system access)
  it('allows SUPER_ADMIN even without the required module', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      {
        preHandler: createRbacGuard({
          minimumRole: UserRole.STAFF,
          module: 'FINANCE',
        }),
      },
      async () => ({ success: true, data: { passed: true } }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-role': 'SUPER_ADMIN',
        // No x-test-modules — SUPER_ADMIN should bypass module gating
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // Module name comparison is case-insensitive
  it('matches module names case-insensitively', async () => {
    app = await buildTestApp();
    app.get(
      '/test',
      {
        preHandler: createRbacGuard({
          minimumRole: UserRole.STAFF,
          module: 'finance', // lowercase in guard config
        }),
      },
      async () => ({ success: true, data: { passed: true } }),
    );
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-role': 'ADMIN',
        'x-test-modules': 'HR,FINANCE,CRM', // uppercase in JWT
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});
