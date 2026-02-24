import { useMemo } from 'react';

import { useAuthStore } from '@/stores/auth-store';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PermissionFlags {
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSuperAdmin: boolean;
}

export type FieldVisibilityMap = Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>;

export interface ModuleAccess {
  canAccess: boolean;
  isSuperAdmin: boolean;
}

// ── Default values ──────────────────────────────────────────────────────────

const ALL_DENIED: PermissionFlags = {
  canAccess: false,
  canNew: false,
  canView: false,
  canEdit: false,
  canDelete: false,
  isSuperAdmin: false,
};

const ALL_GRANTED: PermissionFlags = {
  canAccess: true,
  canNew: true,
  canView: true,
  canEdit: true,
  canDelete: true,
  isSuperAdmin: true,
};

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Returns permission flags for a specific resource code (e.g. 'system.users.list').
 * Reads from the Zustand auth store — no API calls.
 *
 * - SUPER_ADMIN → all flags true
 * - Permissions null (loading) → all flags false
 * - Unknown resource code → all flags false (fail-closed)
 */
export function usePermission(resourceCode: string): PermissionFlags {
  const permissions = useAuthStore((s) => s.permissions);

  return useMemo(() => {
    if (!permissions) return ALL_DENIED;
    if (permissions.isSuperAdmin) return ALL_GRANTED;

    const resource = permissions.modules[resourceCode];
    if (!resource) return ALL_DENIED;

    return {
      canAccess: resource.canAccess,
      canNew: resource.canNew,
      canView: resource.canView,
      canEdit: resource.canEdit,
      canDelete: resource.canDelete,
      isSuperAdmin: false,
    };
  }, [permissions, resourceCode]);
}

/**
 * Returns module-level access for a given module key (e.g. 'system', 'finance').
 * Checks the enabledModules array from the Zustand auth store.
 *
 * - SUPER_ADMIN → always canAccess: true
 * - Permissions null (loading) → canAccess: false
 */
export function useModuleAccess(moduleKey: string): ModuleAccess {
  const permissions = useAuthStore((s) => s.permissions);

  return useMemo(() => {
    if (!permissions) return { canAccess: false, isSuperAdmin: false };
    if (permissions.isSuperAdmin) return { canAccess: true, isSuperAdmin: true };

    return {
      canAccess: permissions.enabledModules.includes(moduleKey),
      isSuperAdmin: false,
    };
  }, [permissions, moduleKey]);
}
