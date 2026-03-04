import type { ReactNode } from 'react';

import { usePlatformAuthStore, type PlatformRole } from '@/stores/auth-store';

interface RequirePlatformRoleProps {
  /** Roles that are allowed to see the children. Empty = any authenticated user. */
  roles?: PlatformRole[];
  children: ReactNode;
  /** Fallback to render when the user doesn't have the required role. */
  fallback?: ReactNode;
}

/**
 * Guard component that only renders children if the current user
 * has one of the specified platform roles.
 */
export function RequirePlatformRole({
  roles,
  children,
  fallback = null,
}: RequirePlatformRoleProps) {
  const user = usePlatformAuthStore((s) => s.user);

  if (!user) return fallback;
  if (roles && roles.length > 0 && !roles.includes(user.role)) return fallback;

  return <>{children}</>;
}
