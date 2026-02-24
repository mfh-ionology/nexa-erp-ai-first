/**
 * Bottom tab navigation bar for phone breakpoint (<768px).
 *
 * Per UX Design Spec (responsive-design-accessibility.md):
 *   Phone: "No sidebar — bottom tab navigation instead"
 *   Tabs: Briefing, Modules, AI, Notifications, Profile
 *
 * - Briefing navigates to dashboard (/)
 * - Modules opens the off-canvas sidebar drawer
 * - AI opens the Co-Pilot drawer (placeholder, disabled)
 * - Notifications navigates to notifications (placeholder)
 * - Profile opens the user menu dropdown
 */

import { useCallback } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Bell, Home, LayoutGrid, MessageSquare, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCopilotStore } from '@/stores/copilot-store';
import { useSidebarStore } from '@/stores/sidebar-store';

import { useI18n } from '@nexa/i18n';

export function BottomTabBar() {
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
        className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md',
          isHome ? 'text-primary' : 'text-text-muted',
        )}
        aria-current={isHome ? 'page' : undefined}
      >
        <Home className="size-5" />
        <span>{t('navigation:dashboard')}</span>
      </Link>

      {/* Modules — opens sidebar drawer */}
      <button
        type="button"
        onClick={handleModulesTab}
        className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-text-muted',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md',
        )}
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
        className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-text-muted',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md',
          'disabled:opacity-50',
        )}
        aria-label={t('navigation:chatButton')}
      >
        <MessageSquare className="size-5" />
        <span>AI</span>
      </button>

      {/* Notifications (placeholder) */}
      <Link
        to="/"
        className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-text-muted',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md',
        )}
        aria-label={t('navigation:notifications')}
      >
        <Bell className="size-5" />
        <span>{t('navigation:notifications')}</span>
      </Link>

      {/* Profile */}
      <Link
        to={'/system/profile' as string}
        className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-text-muted',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md',
        )}
        aria-label={t('navigation:myProfile')}
      >
        <User className="size-5" />
        <span>{t('navigation:myProfile')}</span>
      </Link>
    </nav>
  );
}
