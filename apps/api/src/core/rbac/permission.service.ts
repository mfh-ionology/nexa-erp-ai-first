import type { PrismaClient } from '@nexa/db';
import { permissionCache, type ResolvedPermissions } from './permission-cache.js';

type VisibilityLevel = 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';

const VISIBILITY_RANK: Record<VisibilityLevel, number> = {
  HIDDEN: 0,
  READ_ONLY: 1,
  VISIBLE: 2,
};

/**
 * Resolve the merged permissions for a user within a company.
 * Uses cache when available. Merges across all access groups using most-permissive-wins.
 */
export async function resolvePermissions(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
): Promise<ResolvedPermissions> {
  // Check cache
  const cached = permissionCache.get(userId, companyId);
  if (cached) return cached;

  // Get user's access group IDs for this company
  const userGroups = await prisma.userAccessGroup.findMany({
    where: { userId, companyId },
    select: { accessGroupId: true },
  });

  const groupIds = userGroups.map((ug) => ug.accessGroupId);

  if (groupIds.length === 0) {
    const empty: ResolvedPermissions = { permissions: {}, fieldOverrides: {}, enabledModules: [] };
    permissionCache.set(userId, companyId, empty);
    return empty;
  }

  // Get all permissions for those groups
  const allPermissions = await prisma.accessGroupPermission.findMany({
    where: { accessGroupId: { in: groupIds } },
  });

  // Get all field overrides for those groups
  const allFieldOverrides = await prisma.accessGroupFieldOverride.findMany({
    where: { accessGroupId: { in: groupIds } },
  });

  // Merge permissions: most-permissive-wins (OR for booleans)
  const permissions: ResolvedPermissions['permissions'] = {};
  for (const perm of allPermissions) {
    const existing = permissions[perm.resourceCode];
    if (!existing) {
      permissions[perm.resourceCode] = {
        canAccess: perm.canAccess,
        canNew: perm.canNew,
        canView: perm.canView,
        canEdit: perm.canEdit,
        canDelete: perm.canDelete,
      };
    } else {
      existing.canAccess = existing.canAccess || perm.canAccess;
      existing.canNew = existing.canNew || perm.canNew;
      existing.canView = existing.canView || perm.canView;
      existing.canEdit = existing.canEdit || perm.canEdit;
      existing.canDelete = existing.canDelete || perm.canDelete;
    }
  }

  // Merge field overrides: most-permissive-wins (VISIBLE > READ_ONLY > HIDDEN)
  const fieldOverrides: ResolvedPermissions['fieldOverrides'] = {};
  for (const fo of allFieldOverrides) {
    let resourceOverrides = fieldOverrides[fo.resourceCode];
    if (!resourceOverrides) {
      resourceOverrides = {};
      fieldOverrides[fo.resourceCode] = resourceOverrides;
    }
    const existing = resourceOverrides[fo.fieldPath];
    const foVisibility = fo.visibility as VisibilityLevel;
    if (!existing || VISIBILITY_RANK[foVisibility] > VISIBILITY_RANK[existing]) {
      resourceOverrides[fo.fieldPath] = foVisibility;
    }
  }

  // Derive enabledModules: modules where at least one resource has canAccess: true
  const enabledModulesSet = new Set<string>();
  const resourceCodes = Object.keys(permissions).filter((code) => permissions[code]?.canAccess);
  if (resourceCodes.length > 0) {
    const resources = await prisma.resource.findMany({
      where: { code: { in: resourceCodes } },
      select: { code: true, module: true },
    });
    for (const r of resources) {
      if (permissions[r.code]?.canAccess) {
        enabledModulesSet.add(r.module);
      }
    }
  }

  const resolved: ResolvedPermissions = {
    permissions,
    fieldOverrides,
    enabledModules: Array.from(enabledModulesSet),
  };

  permissionCache.set(userId, companyId, resolved);
  return resolved;
}

/**
 * Check if user has permission for a specific resource and action.
 */
export async function hasPermission(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
  resourceCode: string,
  action?: 'new' | 'view' | 'edit' | 'delete',
): Promise<boolean> {
  const resolved = await resolvePermissions(prisma, userId, companyId);
  const perm = resolved.permissions[resourceCode];
  if (!perm || !perm.canAccess) return false;
  if (!action) return true;

  const actionMap = {
    new: 'canNew',
    view: 'canView',
    edit: 'canEdit',
    delete: 'canDelete',
  } as const;

  return perm[actionMap[action]];
}

/**
 * Get field visibility for a user on a specific resource field.
 */
export async function getFieldVisibility(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
  resourceCode: string,
  fieldPath: string,
): Promise<'VISIBLE' | 'READ_ONLY' | 'HIDDEN'> {
  const resolved = await resolvePermissions(prisma, userId, companyId);
  return resolved.fieldOverrides[resourceCode]?.[fieldPath] ?? 'VISIBLE';
}
