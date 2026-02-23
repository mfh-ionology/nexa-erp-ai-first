import type { PrismaClient, FieldVisibility } from '@nexa/db';
import { UserRole } from '@nexa/db';
import type {
  EffectivePermissions,
  PermissionCacheEntry,
  ResourcePermission,
  FieldOverrides,
} from './permission.types.js';

// ---------------------------------------------------------------------------
// Visibility level for most-permissive-wins merge (VISIBLE > READ_ONLY > HIDDEN)
// ---------------------------------------------------------------------------

const VISIBILITY_LEVEL: Record<string, number> = {
  VISIBLE: 3,
  READ_ONLY: 2,
  HIDDEN: 1,
};

// ---------------------------------------------------------------------------
// Permission action → ResourcePermission flag mapping (shared constant)
// ---------------------------------------------------------------------------

export const ACTION_FLAG_MAP: Record<'new' | 'view' | 'edit' | 'delete', keyof ResourcePermission> = {
  new: 'canNew',
  view: 'canView',
  edit: 'canEdit',
  delete: 'canDelete',
};

// ---------------------------------------------------------------------------
// PermissionService — resolves, caches, and invalidates granular permissions
// ---------------------------------------------------------------------------

const DEFAULT_CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 10_000; // Prevent unbounded growth

export class PermissionService {
  private cache = new Map<string, PermissionCacheEntry>();
  private inflight = new Map<string, Promise<EffectivePermissions>>();
  private ttlMs: number;
  private maxCacheSize: number;

  constructor(ttlMs?: number, maxCacheSize?: number) {
    this.ttlMs = ttlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = maxCacheSize ?? MAX_CACHE_SIZE;
  }

  // -------------------------------------------------------------------------
  // Cache key format: permissions:{userId}:{companyId}:{userRole}
  // -------------------------------------------------------------------------

  private cacheKey(userId: string, companyId: string, userRole: string): string {
    return `permissions:${userId}:${companyId}:${userRole}`;
  }

  // -------------------------------------------------------------------------
  // Evict expired entries and enforce max size
  // -------------------------------------------------------------------------

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private enforceMaxSize(): void {
    if (this.cache.size <= this.maxCacheSize) return;
    // Evict expired first
    this.evictExpired();
    // If still over limit, evict oldest entries
    if (this.cache.size > this.maxCacheSize) {
      const toEvict = this.cache.size - this.maxCacheSize;
      let evicted = 0;
      for (const key of this.cache.keys()) {
        if (evicted >= toEvict) break;
        this.cache.delete(key);
        evicted++;
      }
    }
  }

  // -------------------------------------------------------------------------
  // getEffectivePermissions — resolves OR-merged permissions from access groups
  // -------------------------------------------------------------------------

  async getEffectivePermissions(
    prisma: PrismaClient,
    userId: string,
    companyId: string,
    userRole: string,
  ): Promise<EffectivePermissions> {
    // SUPER_ADMIN bypass — query all resource modules for complete enabledModules
    // (no permission matrix resolution needed, but frontend needs the module list)
    if (userRole === UserRole.SUPER_ADMIN) {
      const resources = await prisma.resource.findMany({
        where: { isActive: true },
        select: { module: true },
      });
      const allModules = [...new Set(resources.map((r: { module: string }) => r.module))];

      return {
        permissions: {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: true,
        enabledModules: allModules,
      };
    }

    // Check cache (key now includes userRole)
    const key = this.cacheKey(userId, companyId, userRole);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Request coalescing — if an in-flight request exists for the same key, await it
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    // Create the promise and store it for coalescing
    const promise = this.resolvePermissions(prisma, userId, companyId, userRole, key);
    this.inflight.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async resolvePermissions(
    prisma: PrismaClient,
    userId: string,
    companyId: string,
    userRole: string,
    cacheKey: string,
  ): Promise<EffectivePermissions> {
    // Query DB: User → UserAccessGroup → AccessGroup → permissions + fieldOverrides
    const userAccessGroups = await prisma.userAccessGroup.findMany({
      where: { userId, companyId },
      include: {
        accessGroup: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            permissions: {
              select: {
                resourceCode: true,
                canAccess: true,
                canNew: true,
                canView: true,
                canEdit: true,
                canDelete: true,
              },
            },
            fieldOverrides: {
              select: {
                resourceCode: true,
                fieldPath: true,
                visibility: true,
              },
            },
          },
        },
      },
    });

    // Filter to active groups only
    const activeGroups = userAccessGroups.filter((uag) => uag.accessGroup.isActive);

    // Merge permissions with OR logic (most-permissive-wins per AC1/BR-RBAC-001)
    const permissions: Record<string, ResourcePermission> = {};
    for (const uag of activeGroups) {
      for (const perm of uag.accessGroup.permissions) {
        const existingPerm = permissions[perm.resourceCode];
        if (existingPerm) {
          existingPerm.canAccess = existingPerm.canAccess || perm.canAccess;
          existingPerm.canNew = existingPerm.canNew || perm.canNew;
          existingPerm.canView = existingPerm.canView || perm.canView;
          existingPerm.canEdit = existingPerm.canEdit || perm.canEdit;
          existingPerm.canDelete = existingPerm.canDelete || perm.canDelete;
        } else {
          permissions[perm.resourceCode] = {
            canAccess: perm.canAccess,
            canNew: perm.canNew,
            canView: perm.canView,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete,
          };
        }
      }
    }

    // Merge field overrides (most-permissive-wins: VISIBLE > READ_ONLY > HIDDEN)
    const fieldOverrides: Record<string, FieldOverrides> = {};
    for (const uag of activeGroups) {
      for (const override of uag.accessGroup.fieldOverrides) {
        const resOverrides = (fieldOverrides[override.resourceCode] ??= {});
        const current = resOverrides[override.fieldPath];
        const currentLevel = current ? (VISIBILITY_LEVEL[current] ?? 0) : 0;
        const newLevel = VISIBILITY_LEVEL[override.visibility] ?? 0;
        if (newLevel > currentLevel) {
          resOverrides[override.fieldPath] = override.visibility as FieldVisibility;
        }
      }
    }

    // Build access groups list
    const accessGroupsList = activeGroups.map((uag) => ({
      id: uag.accessGroup.id,
      code: uag.accessGroup.code,
      name: uag.accessGroup.name,
    }));

    // Derive enabled modules from permissions (FR231)
    const derivedModules = this.deriveEnabledModules(permissions);

    const result: EffectivePermissions = {
      permissions,
      fieldOverrides,
      accessGroups: accessGroupsList,
      role: userRole,
      isSuperAdmin: false,
      enabledModules: derivedModules,
    };

    // Cache result with TTL, enforce size limit
    this.enforceMaxSize();
    this.cache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + this.ttlMs,
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // hasPermission — checks specific resource+action from resolved permissions
  // -------------------------------------------------------------------------

  async hasPermission(
    prisma: PrismaClient,
    userId: string,
    companyId: string,
    userRole: string,
    resourceCode: string,
    action?: 'access' | 'new' | 'view' | 'edit' | 'delete',
  ): Promise<boolean> {
    // SUPER_ADMIN always allowed (AC2/BR-RBAC-002)
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    const effective = await this.getEffectivePermissions(
      prisma, userId, companyId, userRole,
    );

    const resource = effective.permissions[resourceCode];

    // No permission entry for this resource → deny (AC3)
    if (!resource || !resource.canAccess) {
      return false;
    }

    // canAccess check only (no specific action)
    if (!action || action === 'access') {
      return true;
    }

    // Action-level check (AC4)
    const flag = ACTION_FLAG_MAP[action];
    return flag ? resource[flag] : false;
  }

  // -------------------------------------------------------------------------
  // Cache invalidation methods (AC7, AC8)
  // -------------------------------------------------------------------------

  invalidateUser(userId: string, companyId: string): void {
    // Delete all cache entries for this user+company regardless of role
    const prefix = `permissions:${userId}:${companyId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async invalidateGroup(
    prisma: PrismaClient,
    accessGroupId: string,
    companyId: string,
  ): Promise<void> {
    // Find all users in this access group and invalidate their cache
    const assignments = await prisma.userAccessGroup.findMany({
      where: { accessGroupId, companyId },
      select: { userId: true },
    });

    for (const assignment of assignments) {
      this.invalidateUser(assignment.userId, companyId);
    }
  }

  invalidateAll(companyId: string): void {
    const suffix = `:${companyId}:`;
    for (const key of this.cache.keys()) {
      // Match keys that contain :companyId: (not just end with it since role is appended)
      if (key.includes(suffix)) {
        this.cache.delete(key);
      }
    }
  }

  // -------------------------------------------------------------------------
  // getFieldVisibility — per-resource field overrides (uses cache)
  // -------------------------------------------------------------------------

  async getFieldVisibility(
    prisma: PrismaClient,
    userId: string,
    companyId: string,
    userRole: string,
    resourceCode: string,
  ): Promise<FieldOverrides> {
    // Use the cached effective permissions instead of querying DB directly
    const effective = await this.getEffectivePermissions(
      prisma, userId, companyId, userRole,
    );
    return effective.fieldOverrides[resourceCode] ?? {};
  }

  // -------------------------------------------------------------------------
  // deriveEnabledModules — modules where any resource has canAccess=true (FR231)
  // -------------------------------------------------------------------------

  deriveEnabledModules(permissions: Record<string, ResourcePermission>): string[] {
    const modules = new Set<string>();
    for (const [resourceCode, perm] of Object.entries(permissions)) {
      if (perm.canAccess) {
        // Resource code format: module.entity.view (e.g., system.users.list)
        const module = resourceCode.split('.')[0];
        if (module) {
          modules.add(module);
        }
      }
    }
    return Array.from(modules);
  }

  // -------------------------------------------------------------------------
  // Test helpers
  // -------------------------------------------------------------------------

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const permissionService = new PermissionService();
