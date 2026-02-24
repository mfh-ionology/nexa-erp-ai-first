import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useAuthStore } from '@/stores/auth-store';

interface ModuleGuardProps {
  module: string;
  children: ReactNode;
}

/**
 * Module-level permission guard component.
 *
 * @deprecated Use `createModuleBeforeLoad` from `@/lib/route-guards` instead.
 * The beforeLoad approach prevents a flash of unauthorized content by blocking
 * the route before the component renders, unlike this component which redirects
 * via useEffect after the component mounts.
 *
 * - Checks user's resolved permissions (from GET /system/my-permissions, cached in Zustand)
 * - SUPER_ADMIN bypasses all checks
 * - If canAccess === false → redirect to /403
 * - If canAccess === true → render children
 */
export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const permissions = useAuthStore((s) => s.permissions);
  const navigate = useNavigate();

  const isSuperAdmin = permissions?.isSuperAdmin === true;
  const modulePermissions = permissions?.modules[module];
  const canAccess = isSuperAdmin || modulePermissions?.canAccess === true;

  useEffect(() => {
    if (permissions && !canAccess) {
      void navigate({ to: '/403' });
    }
  }, [permissions, canAccess, navigate]);

  if (!permissions) {
    return null;
  }

  if (!canAccess) {
    return null;
  }

  return <>{children}</>;
}
