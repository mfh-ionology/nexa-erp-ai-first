import type { UserRole } from '@nexa/db';

/**
 * Numeric level for each role — higher number = more privilege.
 */
export const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  MANAGER: 3,
  STAFF: 2,
  VIEWER: 1,
};

/**
 * Returns true if `userRole` meets or exceeds `minimumRole` in the hierarchy.
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimumRole];
}

/**
 * Route-level configuration for the RBAC guard.
 */
export type RbacGuardOptions = {
  minimumRole: UserRole;
  module?: string;
};
