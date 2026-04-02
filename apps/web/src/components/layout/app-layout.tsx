import { Outlet, useRouterState } from '@tanstack/react-router';
import { Component, useCallback, useEffect, useRef } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useBreakpoint, usePrefersReducedMotion } from '@/hooks/use-breakpoint';
import { usePageContext } from '@/hooks/use-page-context';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';

import { useI18n } from '@nexa/i18n';

import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { CopilotMinimisedPill } from '@/components/copilot/CopilotMinimisedPill';
import { useAiChat } from '@/hooks/use-ai-chat';
import { NotificationProvider } from '@/features/notifications/notification-provider';

// New navigation components
import { MegaMenu } from './mega-menu';
import { FavouritesToolbar } from './favourites-toolbar';
import { ModuleContextBar } from './module-context-bar';

/**
 * Silent error boundary for the notification system.
 * If notifications crash, the rest of the app continues working.
 */
class NotificationErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[NotificationErrorBoundary] Notification system error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Silently render children without notification features
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}

import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { BottomTabBar } from './bottom-tab-bar';

/**
 * Top-level app shell that composes:
 *
 * **New navigation** (VITE_USE_NEW_NAVIGATION !== 'false'):
 *   - `<AppHeader>` with hamburger at all breakpoints
 *   - `<FavouritesToolbar>` — pinned page chips
 *   - `<ModuleContextBar>` — active module context with category pills
 *   - `<MegaMenu>` — fixed-position overlay panel (opened by hamburger)
 *   - Full-width content area (no sidebar)
 *
 * **Legacy navigation** (feature flag off):
 *   - `<AppSidebar>` (desktop/tablet inline, mobile off-canvas Sheet)
 *   - `<AppHeader>` with mobile-only hamburger
 *   - Content area with sidebar margin compensation
 */
export function AppLayout() {
  const useNewNavigation = import.meta.env.VITE_USE_NEW_NAVIGATION !== 'false';

  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { isOpen, isCollapsed, isHoverExpanded, toggle, setHoverExpanded } = useSidebarStore();

  // Keep copilot store context in sync with current route
  usePageContext();

  // Connect AI chat socket at app level (not inside drawer) so it's ready before user opens copilot
  useAiChat();

  const isMobile = breakpoint === 'phone';
  const isTablet = breakpoint === 'tablet';

  // ── Legacy sidebar hover-to-expand logic (only used when old nav active) ──
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarMouseEnter = useCallback(() => {
    if (!isTablet || !isCollapsed) return;
    hoverTimerRef.current = setTimeout(() => {
      setHoverExpanded(true);
    }, 200);
  }, [isTablet, isCollapsed, setHoverExpanded]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverExpanded(false);
  }, [setHoverExpanded]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Close mobile drawer on route change (legacy sidebar)
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      if (!useNewNavigation && isMobile && isOpen) {
        toggle();
      }
      // Also clear hover expansion on navigation
      if (!useNewNavigation) {
        setHoverExpanded(false);
      }
    }
  }, [pathname, isMobile, isOpen, toggle, setHoverExpanded, useNewNavigation]);

  /* eslint-disable i18next/no-literal-string -- CSS class names, not user-facing text */
  const transitionClasses = prefersReducedMotion ? '' : 'transition-[width] duration-200 ease-out';
  /* eslint-enable i18next/no-literal-string */

  // ────────────────────────────────────────────────────────
  // New navigation layout (mega-menu + toolbars, no sidebar)
  // ────────────────────────────────────────────────────────
  if (useNewNavigation) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        {/* ── Skip link (WCAG 2.1 AA) ──────────────────────── */}
        <a
          href="#main-content"
          className={cn(
            'sr-only focus:not-sr-only',
            'focus:fixed focus:left-4 focus:top-4 focus:z-[100]',
            'focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-lg',
            'focus:outline-none',
          )}
        >
          {t('navigation:skipToContent')}
        </a>

        {/* ── Mega-menu overlay (fixed-position, opened by hamburger) ── */}
        <MegaMenu />

        {/* ── Main content area (full-width, no sidebar margin) ── */}
        <NotificationErrorBoundary>
          <NotificationProvider>
            <AppHeader />
            <FavouritesToolbar />
            <ModuleContextBar />
            <div className="flex flex-1 overflow-hidden">
              <main
                id="main-content"
                role="main"
                aria-label={t('navigation:mainContent')}
                className="flex-1 overflow-auto p-6"
              >
                <Outlet />
              </main>
              {/* Co-Pilot Drawer (desktop/tablet) */}
              {!isMobile && <CopilotDrawer />}
            </div>
            {/* ── Phone bottom tab bar (<768px) ───────────────── */}
            {isMobile && <BottomTabBar />}
          </NotificationProvider>
        </NotificationErrorBoundary>

        {/* Mobile Co-Pilot overlay + minimised pill */}
        {isMobile && <CopilotDrawer />}
        {isMobile && <CopilotMinimisedPill />}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // Legacy navigation layout (sidebar + header)
  // ────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Skip link (WCAG 2.1 AA) ──────────────────────── */}
      <a
        href="#main-content"
        className={cn(
          'sr-only focus:not-sr-only',
          'focus:fixed focus:left-4 focus:top-4 focus:z-[100]',
          'focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-lg',
          'focus:outline-none',
        )}
      >
        {t('navigation:skipToContent')}
      </a>

      {/* ── Desktop/Tablet sidebar (inline, >=768px) ─────── */}
      {!isMobile && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- hover zone for sidebar expand/collapse, not interactive content
        <div
          className={cn('relative shrink-0', transitionClasses)}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
          {/* Inline sidebar (takes up layout space) */}
          <aside className={cn('h-full', transitionClasses, isCollapsed ? 'w-16' : 'w-64')}>
            {!isHoverExpanded && <AppSidebar />}
          </aside>

          {/* Hover-expanded overlay sidebar (tablet mode) */}
          {isHoverExpanded && isCollapsed && (
            <aside
              className={cn(
                'absolute left-0 top-0 z-40 h-full w-64 shadow-lg',
                !prefersReducedMotion && 'animate-in slide-in-from-left-2 duration-200',
              )}
            >
              <AppSidebar forceExpanded />
            </aside>
          )}
        </div>
      )}

      {/* ── Mobile sidebar (off-canvas Sheet, <768px) ────── */}
      {isMobile && (
        <Sheet
          open={isOpen}
          onOpenChange={(open) => {
            if (!open && isOpen) toggle();
          }}
        >
          <SheetContent side="left" showCloseButton={false} className="w-64 p-0">
            <SheetTitle className="sr-only">{t('navigation:sidebar')}</SheetTitle>
            <AppSidebar forceExpanded />
          </SheetContent>
        </Sheet>
      )}

      {/* ── Main content area ────────────────────────────── */}
      <NotificationErrorBoundary>
        <NotificationProvider>
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader />
            <div className="flex flex-1 overflow-hidden">
              <main
                id="main-content"
                role="main"
                aria-label={t('navigation:mainContent')}
                className={cn(
                  'flex-1 overflow-auto p-6',
                  prefersReducedMotion ? '' : 'transition-[width] duration-200 ease-out',
                )}
              >
                <Outlet />
              </main>
              {/* Co-Pilot Drawer (desktop/tablet) */}
              {!isMobile && <CopilotDrawer />}
            </div>
            {/* ── Phone bottom tab bar (<768px) ───────────────── */}
            {isMobile && <BottomTabBar />}
          </div>
        </NotificationProvider>
      </NotificationErrorBoundary>

      {/* Mobile Co-Pilot overlay + minimised pill */}
      {isMobile && <CopilotDrawer />}
      {isMobile && <CopilotMinimisedPill />}
    </div>
  );
}
