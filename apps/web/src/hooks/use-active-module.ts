import { useRouterState } from '@tanstack/react-router';

import { NAVIGATION_MODULES } from '@/lib/navigation-config';

/**
 * Returns the currently active module key based on the URL path,
 * or null if not inside a module (e.g., Dashboard, Tasks).
 */
export function useActiveModule(): string | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  for (const mod of NAVIGATION_MODULES) {
    if (pathname.startsWith(mod.pathPrefix)) {
      return mod.key;
    }
  }

  return null;
}
