import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

// Mock @nexa/db — provide only what we need (avoids DATABASE_URL requirement)
vi.mock('@nexa/db', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
  prisma: {},
}));

// Mock the permission service to avoid real DB calls
vi.mock('./permission.service.js', () => ({
  resolvePermissions: vi.fn(),
}));

import { UserRole } from '@nexa/db';
import { createPermissionGuard } from './permission.guard.js';
import { permissionCache, type ResolvedPermissions } from './permission-cache.js';
import { resolvePermissions } from './permission.service.js';

const mockResolvePermissions = vi.mocked(resolvePermissions);

function makePerms(overrides?: Partial<ResolvedPermissions>): ResolvedPermissions {
  return { permissions: {}, fieldOverrides: {}, enabledModules: [], ...overrides };
}

// Helper to decorate request with enabledModules using Fastify 5 getter/setter
function decorateEnabledModules(app: ReturnType<typeof Fastify>): void {
  app.decorateRequest('enabledModules', {
    getter() {
      return (this as unknown as { _enabledModules?: string[] })._enabledModules ?? [];
    },
    setter(value: string[]) {
      (this as unknown as { _enabledModules?: string[] })._enabledModules = value;
    },
  });
}

describe('createPermissionGuard', () => {
  beforeEach(() => {
    permissionCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows SUPER_ADMIN without checking permissions', async () => {
    const app = Fastify();
    app.decorateRequest('userId', '');
    app.decorateRequest('tenantId', '');
    app.decorateRequest('companyId', '');
    app.decorateRequest('userRole', '');
    decorateEnabledModules(app);

    app.addHook('preHandler', async (request) => {
      request.userId = 'user1';
      request.companyId = 'company1';
      request.userRole = UserRole.SUPER_ADMIN;
    });

    app.get(
      '/test',
      { preHandler: createPermissionGuard('system.users.list', 'view') },
      async () => ({ ok: true }),
    );
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    expect(mockResolvePermissions).not.toHaveBeenCalled();
    await app.close();
  });

  it('denies when user has no company context', async () => {
    const app = Fastify();
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

    app.addHook('preHandler', async (request) => {
      request.userId = 'user1';
      request.companyId = '';
      request.userRole = UserRole.STAFF;
    });

    app.get(
      '/test',
      { preHandler: createPermissionGuard('system.users.list', 'view') },
      async () => ({ ok: true }),
    );
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('denies when canAccess is false', async () => {
    mockResolvePermissions.mockResolvedValue(
      makePerms({
        permissions: {
          'system.users.list': {
            canAccess: false,
            canNew: false,
            canView: false,
            canEdit: false,
            canDelete: false,
          },
        },
      }),
    );

    const app = Fastify();
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

    app.addHook('preHandler', async (request) => {
      request.userId = 'user1';
      request.companyId = 'company1';
      request.userRole = UserRole.STAFF;
    });

    app.get(
      '/test',
      { preHandler: createPermissionGuard('system.users.list', 'view') },
      async () => ({ ok: true }),
    );
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('denies when canAccess is true but action flag is false', async () => {
    mockResolvePermissions.mockResolvedValue(
      makePerms({
        permissions: {
          'system.users.list': {
            canAccess: true,
            canNew: false,
            canView: true,
            canEdit: false,
            canDelete: false,
          },
        },
      }),
    );

    const app = Fastify();
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

    app.addHook('preHandler', async (request) => {
      request.userId = 'user1';
      request.companyId = 'company1';
      request.userRole = UserRole.STAFF;
    });

    app.get(
      '/test',
      { preHandler: createPermissionGuard('system.users.list', 'new') },
      async () => ({ ok: true }),
    );
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('allows when canAccess and action flag are both true', async () => {
    mockResolvePermissions.mockResolvedValue(
      makePerms({
        permissions: {
          'system.users.list': {
            canAccess: true,
            canNew: true,
            canView: true,
            canEdit: true,
            canDelete: true,
          },
        },
      }),
    );

    const app = Fastify();
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

    app.addHook('preHandler', async (request) => {
      request.userId = 'user1';
      request.companyId = 'company1';
      request.userRole = UserRole.STAFF;
    });

    app.get(
      '/test',
      { preHandler: createPermissionGuard('system.users.list', 'new') },
      async () => ({ ok: true }),
    );
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('allows access-only check (no action) when canAccess is true', async () => {
    mockResolvePermissions.mockResolvedValue(
      makePerms({
        permissions: {
          'system.dashboard': {
            canAccess: true,
            canNew: false,
            canView: true,
            canEdit: false,
            canDelete: false,
          },
        },
      }),
    );

    const app = Fastify();
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

    app.addHook('preHandler', async (request) => {
      request.userId = 'user1';
      request.companyId = 'company1';
      request.userRole = UserRole.STAFF;
    });

    app.get('/test', { preHandler: createPermissionGuard('system.dashboard') }, async () => ({
      ok: true,
    }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('denies when resource has no permissions at all', async () => {
    mockResolvePermissions.mockResolvedValue(makePerms());

    const app = Fastify();
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

    app.addHook('preHandler', async (request) => {
      request.userId = 'user1';
      request.companyId = 'company1';
      request.userRole = UserRole.STAFF;
    });

    app.get(
      '/test',
      { preHandler: createPermissionGuard('nonexistent.resource', 'view') },
      async () => ({ ok: true }),
    );
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
