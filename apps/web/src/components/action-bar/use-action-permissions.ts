import { useMemo } from 'react';

import { useAuthStore } from '@/stores/auth-store';
import type { ActionDefinition } from './types';

/**
 * Filters an array of actions based on the current user's permissions.
 *
 * - Actions without `permissionResource` / `permissionAction` pass through.
 * - SUPER_ADMIN users see all actions (permission checks bypassed).
 * - For other users, checks the resolved module permissions from the auth store.
 *   Uses most-permissive-wins: if the user has the required flag in their
 *   resolved permissions, the action is included.
 */
export function useActionPermissions<T extends ActionDefinition>(
  actions: T[],
): T[] {
  const permissions = useAuthStore((s) => s.permissions);

  return useMemo(() => {
    if (!permissions) return [];

    // SUPER_ADMIN bypasses all permission checks
    if (permissions.isSuperAdmin) return actions;

    return actions.filter((action) => {
      // Actions without permission requirements always pass
      if (!action.permissionResource || !action.permissionAction) return true;

      // Look up the module permission by resource code.
      // Resource codes follow the pattern `module.entity.detail` — we match
      // against the modules record which is keyed by resource code.
      const modulePermission = permissions.modules[action.permissionResource];
      if (!modulePermission) return false;

      return modulePermission[action.permissionAction] === true;
    });
  }, [actions, permissions]);
}
