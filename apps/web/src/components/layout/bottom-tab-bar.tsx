/**
 * Bottom tab navigation bar for phone breakpoint (<768px).
 *
 * Per UX Design Spec (responsive-design-accessibility.md):
 *   Phone: "No sidebar — bottom tab navigation instead"
 *
 * Supports 3 mobile nav modes (when VITE_USE_NEW_NAVIGATION is active):
 *   - CLASSIC_TABS: 5-tab layout (Home, Modules, AI, Notifications, Profile)
 *     — "Modules" opens the mega-menu instead of the old sidebar sheet
 *   - MINIMAL: Returns null (don't render). Mobile favourites bar renders separately.
 *   - MY_SHORTCUTS: Renders user's first 4 pinned favourite pages + "More" button.
 *
 * When feature flag is off, uses original behaviour (sidebar toggle).
 */

import { useCallback } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { Bell, Home, LayoutGrid, MessageSquare, MoreHorizontal, User } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';
import { resolveIcon } from '@/lib/icon-resolver';
import { useCopilotStore } from '@/stores/copilot-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useMegaMenuStore } from '@/stores/mega-menu-store';
import { useAuthStore } from '@/stores/auth-store';
import type { MobileNavStyle } from '@/stores/auth-store';
import { useFavouritePages } from '@/hooks/use-favourite-pages';

// ── Shared tab button styles ──

const TAB_BASE =
  'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md';
const TAB_INACTIVE = 'text-muted-foreground';

// ── CLASSIC_TABS layout (new nav — mega-menu variant) ──

function ClassicTabsNew() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const toggleMegaMenu = useMegaMenuStore((s) => s.toggle);
  const toggleCopilot = useCopilotStore((s) => s.toggleDrawer);

  const handleModulesTab = useCallback(() => {
    toggleMegaMenu();
  }, [toggleMegaMenu]);

  const isHome = pathname === '/';

  return (
    <nav
      role="navigation"
      aria-label={t('navigation:bottomTabs')}
      className="flex h-14 shrink-0 items-center justify-around border-t border-border bg-surface"
    >
      {/* Briefing / Home */}
      <Link
        to="/"
        className={cn(TAB_BASE, isHome ? 'text-primary' : TAB_INACTIVE)}
        aria-current={isHome ? 'page' : undefined}
      >
        <Home className="size-5" />
        <span>{t('navigation:dashboard')}</span>
      </Link>

      {/* Modules — opens mega-menu */}
      <button
        type="button"
        onClick={handleModulesTab}
        className={cn(TAB_BASE, TAB_INACTIVE)}
        aria-label={t('navigation:modules')}
      >
        <LayoutGrid className="size-5" />
        <span>{t('navigation:modules')}</span>
      </button>

      {/* AI Co-Pilot (placeholder) */}
      <button
        type="button"
        onClick={toggleCopilot}
        disabled
        className={cn(TAB_BASE, TAB_INACTIVE, 'disabled:opacity-50')}
        aria-label={t('navigation:chatButton')}
      >
        <MessageSquare className="size-5" />
        <span>AI</span>
      </button>

      {/* Notifications (placeholder) */}
      <Link
        to="/"
        className={cn(TAB_BASE, TAB_INACTIVE)}
        aria-label={t('navigation:notifications')}
      >
        <Bell className="size-5" />
        <span>{t('navigation:notifications')}</span>
      </Link>

      {/* Profile */}
      <Link
        to={'/system/profile' as string}
        className={cn(TAB_BASE, TAB_INACTIVE)}
        aria-label={t('navigation:myProfile')}
      >
        <User className="size-5" />
        <span>{t('navigation:myProfile')}</span>
      </Link>
    </nav>
  );
}

// ── MY_SHORTCUTS layout — user's first 4 pinned favourites + "More" ──

function MyShortcutsBar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { pages } = useFavouritePages();
  const toggleMegaMenu = useMegaMenuStore((s) => s.toggle);

  const pinnedPages = pages.slice(0, 4);

  return (
    <nav
      role="navigation"
      aria-label={t('navigation:bottomTabs')}
      className="flex h-14 shrink-0 items-center justify-around border-t border-border bg-surface"
    >
      {pinnedPages.map((page) => {
        const Icon = resolveIcon(page.iconKey);
        const isActive = pathname === page.path || pathname.startsWith(page.path + '/');

        return (
          <button
            key={page.id}
            type="button"
            onClick={() => navigate({ to: page.path })}
            className={cn(TAB_BASE, isActive ? 'text-primary' : TAB_INACTIVE)}
            aria-current={isActive ? 'page' : undefined}
          >
            {Icon ? <Icon className="size-5" /> : <LayoutGrid className="size-5" />}
            <span className="max-w-[64px] truncate">{page.label}</span>
          </button>
        );
      })}

      {/* Fill empty slots if fewer than 4 pinned pages */}
      {pinnedPages.length < 4 &&
        Array.from({ length: 4 - pinnedPages.length }).map((_, i) => (
          <div key={`empty-${String(i)}`} className="w-12" />
        ))}

      {/* "More" button — opens mega-menu */}
      <button
        type="button"
        onClick={toggleMegaMenu}
        className={cn(TAB_BASE, TAB_INACTIVE)}
        aria-label={t('navigation:modules')}
      >
        <MoreHorizontal className="size-5" />
        <span>{t('navigation:modules')}</span>
      </button>
    </nav>
  );
}

// ── Legacy CLASSIC_TABS layout (sidebar toggle variant) ──

function ClassicTabsLegacy() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const toggleCopilot = useCopilotStore((s) => s.toggleDrawer);

  const handleModulesTab = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const isHome = pathname === '/';

  return (
    <nav
      role="navigation"
      aria-label={t('navigation:bottomTabs')}
      className="flex h-14 shrink-0 items-center justify-around border-t border-border bg-surface"
    >
      {/* Briefing / Home */}
      <Link
        to="/"
        className={cn(TAB_BASE, isHome ? 'text-primary' : TAB_INACTIVE)}
        aria-current={isHome ? 'page' : undefined}
      >
        <Home className="size-5" />
        <span>{t('navigation:dashboard')}</span>
      </Link>

      {/* Modules — opens sidebar drawer */}
      <button
        type="button"
        onClick={handleModulesTab}
        className={cn(TAB_BASE, TAB_INACTIVE)}
        aria-label={t('navigation:modules')}
      >
        <LayoutGrid className="size-5" />
        <span>{t('navigation:modules')}</span>
      </button>

      {/* AI Co-Pilot (placeholder) */}
      <button
        type="button"
        onClick={toggleCopilot}
        disabled
        className={cn(TAB_BASE, TAB_INACTIVE, 'disabled:opacity-50')}
        aria-label={t('navigation:chatButton')}
      >
        <MessageSquare className="size-5" />
        <span>AI</span>
      </button>

      {/* Notifications (placeholder) */}
      <Link
        to="/"
        className={cn(TAB_BASE, TAB_INACTIVE)}
        aria-label={t('navigation:notifications')}
      >
        <Bell className="size-5" />
        <span>{t('navigation:notifications')}</span>
      </Link>

      {/* Profile */}
      <Link
        to={'/system/profile' as string}
        className={cn(TAB_BASE, TAB_INACTIVE)}
        aria-label={t('navigation:myProfile')}
      >
        <User className="size-5" />
        <span>{t('navigation:myProfile')}</span>
      </Link>
    </nav>
  );
}

// ── Main export ──

export function BottomTabBar() {
  const useNewNavigation = import.meta.env.VITE_USE_NEW_NAVIGATION !== 'false';
  const mobileNavStyle = useAuthStore((s) => s.user?.mobileNavStyle) as MobileNavStyle | undefined;

  // When feature flag is off, use legacy behaviour
  if (!useNewNavigation) {
    return <ClassicTabsLegacy />;
  }

  // New navigation: apply mode logic
  const mode: MobileNavStyle = mobileNavStyle ?? 'CLASSIC_TABS';

  switch (mode) {
    case 'MINIMAL':
      return null;

    case 'MY_SHORTCUTS':
      return <MyShortcutsBar />;

    case 'CLASSIC_TABS':
    default:
      return <ClassicTabsNew />;
  }
}
