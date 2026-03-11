import { redirect } from '@tanstack/react-router';

import { useAuthStore } from '@/stores/auth-store';

const ROLE_LEVELS: Record<string, number> = {
  VIEWER: 0,
  STAFF: 1,
  MANAGER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

/**
 * Creates a TanStack Router beforeLoad function that checks minimum role.
 * Used for cross-cutting routes (no module key) that still require a role threshold.
 * SUPER_ADMIN always passes.
 */
export function createRoleBeforeLoad(minimumRole: string) {
  return () => {
    const { permissions } = useAuthStore.getState();

    if (!permissions) {
      throw redirect({ to: '/login' });
    }

    if (permissions.isSuperAdmin) return;

    const userLevel = ROLE_LEVELS[permissions.role] ?? 0;
    const requiredLevel = ROLE_LEVELS[minimumRole] ?? 0;

    if (userLevel < requiredLevel) {
      throw redirect({ to: '/403' });
    }
  };
}

/**
 * Creates a TanStack Router beforeLoad function that checks module-level access.
 * Redirects to /403 if the user lacks access to any resource in the module.
 * SUPER_ADMIN always passes.
 * Redirects to /login if permissions are null (not yet loaded).
 */
export function createModuleBeforeLoad(moduleKey: string) {
  return () => {
    const { permissions } = useAuthStore.getState();

    if (!permissions) {
      throw redirect({ to: '/login' });
    }

    if (permissions.isSuperAdmin) return;

    if (!permissions.enabledModules.includes(moduleKey)) {
      throw redirect({ to: '/403' });
    }
  };
}

/**
 * Creates a TanStack Router beforeLoad function that checks module-level access
 * AND requires ADMIN or SUPER_ADMIN role.
 * Used for admin-only routes like /system/resources, /system/users, /system/access-groups.
 */
export function createAdminModuleBeforeLoad(moduleKey: string) {
  return () => {
    const { permissions } = useAuthStore.getState();

    if (!permissions) {
      throw redirect({ to: '/login' });
    }

    if (permissions.isSuperAdmin) return;

    if (permissions.role !== 'ADMIN') {
      throw redirect({ to: '/403' });
    }

    if (!permissions.enabledModules.includes(moduleKey)) {
      throw redirect({ to: '/403' });
    }
  };
}
