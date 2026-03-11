import type { ReactNode } from 'react';

import { usePlatformAuthStore, type PlatformRole } from '@/stores/auth-store';

interface RequirePlatformRoleProps {
  /** Roles that are allowed to see the children. Empty = any authenticated user. */
  roles?: PlatformRole[];
  children: ReactNode;
  /** Fallback to render when the user doesn't have the required role (hides children). */
  fallback?: ReactNode;
  /** When true, renders children wrapped in a disabled container instead of hiding them. */
  disabledFallback?: boolean;
}

/**
 * Guard component that only renders children if the current user
 * has one of the specified platform roles.
 *
 * With `disabledFallback`, children are rendered but visually disabled
 * (pointer-events: none, reduced opacity) instead of being hidden.
 */
export function RequirePlatformRole({
  roles,
  children,
  fallback = null,
  disabledFallback = false,
}: RequirePlatformRoleProps) {
  const user = usePlatformAuthStore((s) => s.user);

  if (!user) return fallback;

  const hasRole = !roles || roles.length === 0 || roles.includes(user.role);

  if (hasRole) return <>{children}</>;

  if (disabledFallback) {
    return (
      <div inert aria-disabled="true" className="pointer-events-none opacity-50">
        {children}
      </div>
    );
  }

  return <>{fallback}</>;
}
