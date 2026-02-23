import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db
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

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { PermissionService } from './permission.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    resource: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    userAccessGroup: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as never;
}

/** Create a UserAccessGroup result with permissions and field overrides. */
function makeUserAccessGroup(config: {
  groupId?: string;
  code?: string;
  name?: string;
  isActive?: boolean;
  permissions?: Array<{
    resourceCode: string;
    canAccess: boolean;
    canNew: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
  fieldOverrides?: Array<{
    resourceCode: string;
    fieldPath: string;
    visibility: string;
  }>;
}) {
  return {
    accessGroup: {
      id: config.groupId ?? 'group-1',
      code: config.code ?? 'GROUP',
      name: config.name ?? 'Test Group',
      isActive: config.isActive ?? true,
      permissions: config.permissions ?? [],
      fieldOverrides: config.fieldOverrides ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService(60_000);
    service.clearCache();
  });

  // =========================================================================
  // SUPER_ADMIN bypass
  // =========================================================================

  describe('getEffectivePermissions — SUPER_ADMIN bypass', () => {
    it('returns isSuperAdmin: true with empty permissions and all resource modules', async () => {
      const prisma = makeMockPrisma({
        resource: {
          findMany: vi.fn().mockResolvedValue([
            { module: 'system' },
            { module: 'finance' },
            { module: 'system' }, // duplicate
          ]),
        },
      });

      const result = await service.getEffectivePermissions(
        prisma, 'user-1', 'company-1', 'SUPER_ADMIN',
      );

      expect(result.isSuperAdmin).toBe(true);
      expect(result.permissions).toEqual({});
      expect(result.fieldOverrides).toEqual({});
      expect(result.accessGroups).toEqual([]);
      expect(result.enabledModules).toEqual(expect.arrayContaining(['system', 'finance']));
      expect(result.enabledModules).toHaveLength(2); // deduplicated
    });

    it('does not query userAccessGroup for SUPER_ADMIN', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const prisma = makeMockPrisma({
        resource: { findMany: vi.fn().mockResolvedValue([]) },
        userAccessGroup: { findMany: mockFindMany },
      });

      await service.getEffectivePermissions(prisma, 'user-1', 'company-1', 'SUPER_ADMIN');

      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // OR-merge logic (most-permissive-wins)
  // =========================================================================

  describe('getEffectivePermissions — OR merge', () => {
    it('merges permissions across multiple groups with OR logic', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              groupId: 'g1',
              code: 'GROUP_A',
              name: 'Group A',
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
              ],
            }),
            makeUserAccessGroup({
              groupId: 'g2',
              code: 'GROUP_B',
              name: 'Group B',
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: true, canView: false, canEdit: true, canDelete: false },
              ],
            }),
          ]),
        },
      });

      const result = await service.getEffectivePermissions(
        prisma, 'user-1', 'company-1', 'ADMIN',
      );

      // OR merge: true wins over false for each flag
      expect(result.permissions['system.users.list']).toEqual({
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: false,
      });
    });

    it('includes permissions from single group', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              permissions: [
                { resourceCode: 'system.resources.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
              ],
            }),
          ]),
        },
      });

      const result = await service.getEffectivePermissions(
        prisma, 'user-1', 'company-1', 'STAFF',
      );

      expect(result.permissions['system.resources.list']).toEqual({
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: false,
        canDelete: false,
      });
    });

    it('filters out inactive groups', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              groupId: 'active',
              code: 'ACTIVE',
              name: 'Active',
              isActive: true,
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
              ],
            }),
            makeUserAccessGroup({
              groupId: 'inactive',
              code: 'INACTIVE',
              name: 'Inactive',
              isActive: false,
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
              ],
            }),
          ]),
        },
      });

      const result = await service.getEffectivePermissions(
        prisma, 'user-1', 'company-1', 'STAFF',
      );

      // Only active group's permissions should be included
      expect(result.permissions['system.users.list']?.canNew).toBe(false);
      expect(result.accessGroups).toHaveLength(1);
      expect(result.accessGroups[0]?.code).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // Field overrides merge (most-permissive-wins)
  // =========================================================================

  describe('getEffectivePermissions — field overrides', () => {
    it('merges field overrides with most-permissive-wins (VISIBLE > READ_ONLY > HIDDEN)', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              groupId: 'g1',
              code: 'G1',
              name: 'G1',
              fieldOverrides: [
                { resourceCode: 'system.users.list', fieldPath: 'email', visibility: 'HIDDEN' },
                { resourceCode: 'system.users.list', fieldPath: 'phone', visibility: 'READ_ONLY' },
              ],
            }),
            makeUserAccessGroup({
              groupId: 'g2',
              code: 'G2',
              name: 'G2',
              fieldOverrides: [
                { resourceCode: 'system.users.list', fieldPath: 'email', visibility: 'READ_ONLY' },
                { resourceCode: 'system.users.list', fieldPath: 'phone', visibility: 'VISIBLE' },
              ],
            }),
          ]),
        },
      });

      const result = await service.getEffectivePermissions(
        prisma, 'user-1', 'company-1', 'STAFF',
      );

      // Most permissive wins: READ_ONLY > HIDDEN, VISIBLE > READ_ONLY
      expect(result.fieldOverrides['system.users.list']).toEqual({
        email: 'READ_ONLY',
        phone: 'VISIBLE',
      });
    });
  });

  // =========================================================================
  // Cache behavior
  // =========================================================================

  describe('cache', () => {
    it('returns cached result on second call within TTL', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const prisma = makeMockPrisma({
        userAccessGroup: { findMany: mockFindMany },
      });

      await service.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');
      await service.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');

      // Only one DB call — second was cached
      expect(mockFindMany).toHaveBeenCalledTimes(1);
    });

    it('invalidateUser removes cache for specific user+company', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const prisma = makeMockPrisma({
        userAccessGroup: { findMany: mockFindMany },
      });

      await service.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');
      expect(service.getCacheSize()).toBe(1);

      service.invalidateUser('user-1', 'company-1');
      expect(service.getCacheSize()).toBe(0);

      // Next call should hit DB again
      await service.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });

    it('invalidateGroup removes cache for all users in the group', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn()
            .mockResolvedValueOnce([]) // first getEffective (user-1)
            .mockResolvedValueOnce([]) // second getEffective (user-2)
            .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]), // invalidateGroup query
        },
      });

      await service.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');
      await service.getEffectivePermissions(prisma, 'user-2', 'company-1', 'ADMIN');
      expect(service.getCacheSize()).toBe(2);

      await service.invalidateGroup(prisma, 'group-1', 'company-1');
      expect(service.getCacheSize()).toBe(0);
    });

    it('invalidateAll removes all cache entries for a company', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const prisma = makeMockPrisma({
        userAccessGroup: { findMany: mockFindMany },
      });

      await service.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');
      await service.getEffectivePermissions(prisma, 'user-2', 'company-1', 'ADMIN');
      await service.getEffectivePermissions(prisma, 'user-3', 'company-2', 'ADMIN');
      expect(service.getCacheSize()).toBe(3);

      service.invalidateAll('company-1');
      expect(service.getCacheSize()).toBe(1); // only company-2 entry remains
    });

    it('expired cache entry triggers fresh DB call', async () => {
      const shortTtlService = new PermissionService(1); // 1ms TTL
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const prisma = makeMockPrisma({
        userAccessGroup: { findMany: mockFindMany },
      });

      await shortTtlService.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      await shortTtlService.getEffectivePermissions(prisma, 'user-1', 'company-1', 'ADMIN');
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // hasPermission
  // =========================================================================

  describe('hasPermission', () => {
    it('returns true for SUPER_ADMIN without DB call', async () => {
      const mockFindMany = vi.fn();
      const prisma = makeMockPrisma({
        userAccessGroup: { findMany: mockFindMany },
      });

      const result = await service.hasPermission(
        prisma, 'user-1', 'company-1', 'SUPER_ADMIN', 'system.users.list', 'edit',
      );

      expect(result).toBe(true);
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it('returns false when resource has no permission entry', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: { findMany: vi.fn().mockResolvedValue([]) },
      });

      const result = await service.hasPermission(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list',
      );

      expect(result).toBe(false);
    });

    it('returns false when canAccess is false', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              permissions: [
                { resourceCode: 'system.users.list', canAccess: false, canNew: true, canView: true, canEdit: true, canDelete: true },
              ],
            }),
          ]),
        },
      });

      const result = await service.hasPermission(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list',
      );

      expect(result).toBe(false);
    });

    it('returns true for canAccess check only (no action specified)', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: false, canEdit: false, canDelete: false },
              ],
            }),
          ]),
        },
      });

      const result = await service.hasPermission(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list',
      );

      expect(result).toBe(true);
    });

    it('returns true for action=access', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: false, canEdit: false, canDelete: false },
              ],
            }),
          ]),
        },
      });

      const result = await service.hasPermission(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list', 'access',
      );

      expect(result).toBe(true);
    });

    it('returns false when specific action flag is false', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
              ],
            }),
          ]),
        },
      });

      const result = await service.hasPermission(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list', 'edit',
      );

      expect(result).toBe(false);
    });

    it('returns true when specific action flag is true', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              permissions: [
                { resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
              ],
            }),
          ]),
        },
      });

      const result = await service.hasPermission(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list', 'view',
      );

      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // deriveEnabledModules
  // =========================================================================

  describe('deriveEnabledModules', () => {
    it('returns unique modules from resources with canAccess=true', () => {
      const modules = service.deriveEnabledModules({
        'system.users.list': { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
        'system.resources.list': { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
        'finance.ledger.list': { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
        'sales.orders.list': { canAccess: false, canNew: false, canView: false, canEdit: false, canDelete: false },
      });

      expect(modules).toEqual(expect.arrayContaining(['system', 'finance']));
      expect(modules).toHaveLength(2); // deduplicated, excludes sales (canAccess=false)
    });

    it('returns empty array when no resources have canAccess=true', () => {
      const modules = service.deriveEnabledModules({
        'system.users.list': { canAccess: false, canNew: false, canView: false, canEdit: false, canDelete: false },
      });

      expect(modules).toEqual([]);
    });
  });

  // =========================================================================
  // getFieldVisibility
  // =========================================================================

  describe('getFieldVisibility', () => {
    it('returns merged field overrides for a specific resource (via cache)', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              groupId: 'g1',
              code: 'G1',
              name: 'G1',
              fieldOverrides: [
                { resourceCode: 'system.users.list', fieldPath: 'email', visibility: 'HIDDEN' },
                { resourceCode: 'system.users.list', fieldPath: 'phone', visibility: 'READ_ONLY' },
              ],
            }),
            makeUserAccessGroup({
              groupId: 'g2',
              code: 'G2',
              name: 'G2',
              fieldOverrides: [
                { resourceCode: 'system.users.list', fieldPath: 'email', visibility: 'VISIBLE' },
              ],
            }),
          ]),
        },
      });

      const result = await service.getFieldVisibility(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list',
      );

      expect(result).toEqual({
        email: 'VISIBLE',     // VISIBLE > HIDDEN
        phone: 'READ_ONLY',   // only one entry
      });
    });

    it('skips inactive groups', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              isActive: false,
              fieldOverrides: [
                { resourceCode: 'system.users.list', fieldPath: 'email', visibility: 'VISIBLE' },
              ],
            }),
          ]),
        },
      });

      const result = await service.getFieldVisibility(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list',
      );

      expect(result).toEqual({});
    });

    it('returns empty object when no overrides for resource', async () => {
      const prisma = makeMockPrisma({
        userAccessGroup: {
          findMany: vi.fn().mockResolvedValue([
            makeUserAccessGroup({
              fieldOverrides: [
                { resourceCode: 'other.resource', fieldPath: 'email', visibility: 'HIDDEN' },
              ],
            }),
          ]),
        },
      });

      const result = await service.getFieldVisibility(
        prisma, 'user-1', 'company-1', 'STAFF', 'system.users.list',
      );

      expect(result).toEqual({});
    });
  });
});
