import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {},
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

// ---------------------------------------------------------------------------
// Mock permission service
// ---------------------------------------------------------------------------

const { mockPermissionService } = vi.hoisted(() => ({
  mockPermissionService: {
    getEffectivePermissions: vi.fn(),
    hasPermission: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateGroup: vi.fn(),
    invalidateAll: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn(),
    deriveEnabledModules: vi.fn(),
    getFieldVisibility: vi.fn(),
  },
}));

vi.mock('./permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: {
    new: 'canNew',
    view: 'canView',
    edit: 'canEdit',
    delete: 'canDelete',
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { createPermissionGuard } from './permission.guard.js';
import type { EffectivePermissions } from './permission.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    companyId: 'company-1',
    userRole: 'ADMIN',
    enabledModules: ['system'],
    permissions: undefined,
    ...overrides,
  } as never;
}

function makeReply() {
  return {} as never;
}

// Strip Fastify `this` context for direct test invocation (arrow fn doesn't use `this`)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function testGuard(...args: Parameters<typeof createPermissionGuard>): (...a: any[]) => Promise<void> {
  return createPermissionGuard(...args) as never;
}

function makeEffectivePermissions(overrides: Partial<EffectivePermissions> = {}): EffectivePermissions {
  return {
    permissions: {},
    fieldOverrides: {},
    accessGroups: [],
    role: 'ADMIN',
    isSuperAdmin: false,
    enabledModules: ['system'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPermissionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // SUPER_ADMIN bypass
  // =========================================================================

  describe('SUPER_ADMIN bypass', () => {
    it('allows SUPER_ADMIN and attaches permissions to request', async () => {
      const effective = makeEffectivePermissions({
        isSuperAdmin: true,
        role: 'SUPER_ADMIN',
      });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list', 'edit');
      const request = makeRequest({ userRole: 'SUPER_ADMIN' });

      await guard(request, makeReply(), vi.fn());

      // SUPER_ADMIN resolves permissions (for downstream hooks) but skips access check
      expect(mockPermissionService.getEffectivePermissions).toHaveBeenCalledTimes(1);
      expect((request as unknown as { permissions: EffectivePermissions }).permissions).toBe(effective);
    });
  });

  // =========================================================================
  // canAccess check
  // =========================================================================

  describe('canAccess check', () => {
    it('allows when resource has canAccess=true (access-only check)', async () => {
      const effective = makeEffectivePermissions({
        permissions: {
          'system.users.list': { canAccess: true, canNew: false, canView: false, canEdit: false, canDelete: false },
        },
      });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list', 'access');
      const request = makeRequest();

      await guard(request, makeReply(), vi.fn());

      // Should not throw — access granted
      expect(mockPermissionService.getEffectivePermissions).toHaveBeenCalledTimes(1);
    });

    it('denies with 403 when resource not in permissions', async () => {
      const effective = makeEffectivePermissions({ permissions: {} });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list');
      const request = makeRequest();

      await expect(guard(request, makeReply(), vi.fn()))
        .rejects.toThrow('Insufficient permissions');
    });

    it('denies with 403 when canAccess is false', async () => {
      const effective = makeEffectivePermissions({
        permissions: {
          'system.users.list': { canAccess: false, canNew: true, canView: true, canEdit: true, canDelete: true },
        },
      });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list');
      const request = makeRequest();

      await expect(guard(request, makeReply(), vi.fn()))
        .rejects.toThrow('Insufficient permissions');
    });
  });

  // =========================================================================
  // Action-level checks
  // =========================================================================

  describe('action-level checks', () => {
    it('allows when action flag is true', async () => {
      const effective = makeEffectivePermissions({
        permissions: {
          'system.users.list': { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
        },
      });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list', 'view');
      const request = makeRequest();

      await guard(request, makeReply(), vi.fn());
      // Should not throw
    });

    it('denies when action flag is false', async () => {
      const effective = makeEffectivePermissions({
        permissions: {
          'system.users.list': { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
        },
      });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list', 'edit');
      const request = makeRequest();

      await expect(guard(request, makeReply(), vi.fn()))
        .rejects.toThrow('Insufficient permissions');
    });

    it.each([
      ['new', 'canNew'],
      ['view', 'canView'],
      ['edit', 'canEdit'],
      ['delete', 'canDelete'],
    ] as const)('checks %s action against %s flag', async (action, flag) => {
      const perm = { canAccess: true, canNew: false, canView: false, canEdit: false, canDelete: false };
      (perm as Record<string, boolean>)[flag] = true;

      const effective = makeEffectivePermissions({
        permissions: { 'system.users.list': perm },
      });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list', action as 'new' | 'view' | 'edit' | 'delete');
      const request = makeRequest();

      await guard(request, makeReply(), vi.fn());
      // Should not throw
    });
  });

  // =========================================================================
  // Request decoration
  // =========================================================================

  describe('request decoration', () => {
    it('attaches resolved permissions to request.permissions', async () => {
      const effective = makeEffectivePermissions({
        permissions: {
          'system.users.list': { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
        },
      });
      mockPermissionService.getEffectivePermissions.mockResolvedValue(effective);

      const guard = testGuard('system.users.list');
      const request = makeRequest();

      await guard(request, makeReply(), vi.fn());

      expect((request as unknown as { permissions: EffectivePermissions }).permissions).toBe(effective);
    });
  });
});
