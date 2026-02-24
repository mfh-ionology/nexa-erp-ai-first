import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useSidebarStore } from '@/stores/sidebar-store';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

const DESKTOP_QUERY = '(min-width: 1024px)';
const TABLET_QUERY = '(min-width: 768px)';

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'phone';
}

function subscribe(callback: () => void): () => void {
  const desktopMql = window.matchMedia(DESKTOP_QUERY);
  const tabletMql = window.matchMedia(TABLET_QUERY);

  desktopMql.addEventListener('change', callback);
  tabletMql.addEventListener('change', callback);

  return () => {
    desktopMql.removeEventListener('change', callback);
    tabletMql.removeEventListener('change', callback);
  };
}

/**
 * Returns the current viewport breakpoint and keeps it in sync
 * with `window.matchMedia` listeners.
 *
 * Also auto-updates the sidebar store mode when the breakpoint changes:
 *   - Desktop (>=1024px): expanded sidebar
 *   - Tablet  (768–1023px): collapsed sidebar (icon-only)
 *   - Phone   (<768px): sidebar hidden (bottom tab navigation)
 *
 * Respects `prefers-reduced-motion` by disabling CSS transitions when enabled.
 */
export function useBreakpoint(): Breakpoint {
  const breakpoint = useSyncExternalStore(subscribe, getBreakpoint, () => 'desktop' as Breakpoint);
  const setMode = useSidebarStore((s) => s.setMode);

  const syncSidebar = useCallback(
    (bp: Breakpoint) => {
      switch (bp) {
        case 'desktop':
          setMode('expanded');
          break;
        case 'tablet':
          setMode('collapsed');
          break;
        case 'phone':
          setMode('hidden');
          break;
      }
    },
    [setMode],
  );

  useEffect(() => {
    syncSidebar(breakpoint);
  }, [breakpoint, syncSidebar]);

  return breakpoint;
}

/**
 * Returns true when the user prefers reduced motion.
 * Used to disable sidebar transitions.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}
