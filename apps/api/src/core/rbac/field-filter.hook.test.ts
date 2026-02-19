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

// Mock the permission service
vi.mock('./permission.service.js', () => ({
  resolvePermissions: vi.fn(),
}));

import { UserRole } from '@nexa/db';
import { filterFieldsByPermission } from './field-filter.hook.js';
import { permissionCache, type ResolvedPermissions } from './permission-cache.js';
import { resolvePermissions } from './permission.service.js';

const mockResolvePermissions = vi.mocked(resolvePermissions);

function makePerms(overrides?: Partial<ResolvedPermissions>): ResolvedPermissions {
  return { permissions: {}, fieldOverrides: {}, enabledModules: [], ...overrides };
}

describe('filterFieldsByPermission', () => {
  beforeEach(() => {
    permissionCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through when SUPER_ADMIN', async () => {
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
      request.userRole = UserRole.SUPER_ADMIN;
    });

    app.get('/test', { onSend: filterFieldsByPermission('sales.orders.detail') }, async () => ({
      costPrice: 100,
      sellingPrice: 150,
      name: 'Widget',
    }));

    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = JSON.parse(res.body);
    expect(body.costPrice).toBe(100);
    expect(body.sellingPrice).toBe(150);
    expect(body._fieldMeta).toBeUndefined();
    await app.close();
  });

  it('removes HIDDEN fields from response', async () => {
    mockResolvePermissions.mockResolvedValue(
      makePerms({
        fieldOverrides: {
          'sales.orders.detail': {
            costPrice: 'HIDDEN',
            margin: 'HIDDEN',
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

    app.get('/test', { onSend: filterFieldsByPermission('sales.orders.detail') }, async () => ({
      costPrice: 100,
      margin: 50,
      sellingPrice: 150,
      name: 'Widget',
    }));

    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = JSON.parse(res.body);
    expect(body.costPrice).toBeUndefined();
    expect(body.margin).toBeUndefined();
    expect(body.sellingPrice).toBe(150);
    expect(body.name).toBe('Widget');
    await app.close();
  });

  it('marks READ_ONLY fields in _fieldMeta', async () => {
    mockResolvePermissions.mockResolvedValue(
      makePerms({
        fieldOverrides: {
          'sales.orders.detail': {
            totalExVat: 'READ_ONLY',
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

    app.get('/test', { onSend: filterFieldsByPermission('sales.orders.detail') }, async () => ({
      totalExVat: 1500,
      name: 'Order 1',
    }));

    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = JSON.parse(res.body);
    expect(body.totalExVat).toBe(1500); // still present
    expect(body.name).toBe('Order 1');
    expect(body._fieldMeta).toEqual({ totalExVat: 'readOnly' });
    await app.close();
  });

  it('leaves VISIBLE fields unchanged', async () => {
    mockResolvePermissions.mockResolvedValue(
      makePerms({
        fieldOverrides: {
          'sales.orders.detail': {
            costPrice: 'VISIBLE',
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

    app.get('/test', { onSend: filterFieldsByPermission('sales.orders.detail') }, async () => ({
      costPrice: 100,
      name: 'Widget',
    }));

    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = JSON.parse(res.body);
    expect(body.costPrice).toBe(100);
    expect(body._fieldMeta).toBeUndefined();
    await app.close();
  });

  it('passes through when no overrides exist', async () => {
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

    app.get('/test', { onSend: filterFieldsByPermission('sales.orders.detail') }, async () => ({
      costPrice: 100,
      name: 'Widget',
    }));

    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = JSON.parse(res.body);
    expect(body.costPrice).toBe(100);
    expect(body.name).toBe('Widget');
    await app.close();
  });
});
