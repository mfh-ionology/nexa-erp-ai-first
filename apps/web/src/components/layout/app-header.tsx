/**
 * Top-level header bar for the Nexa ERP app shell.
 *
 * Layout (left → right):
 *   [≡ Hamburger (mobile)]  [🔍 UnifiedSearch...]  [💬 Chat] [🔔 Notifications] [👤 User]
 *
 * - Hamburger visible only on mobile (<768px), toggles off-canvas sidebar
 * - UnifiedSearch (Cmd+K command palette) collapses to icon on mobile
 * - Chat button toggles Co-Pilot drawer (E6.5)
 * - Notifications bell placeholder with badge (wired in E9)
 * - User avatar triggers <UserMenu /> (Task 5)
 * - Full ARIA landmarks and keyboard accessibility (WCAG 2.1 AA)
 */

import { useState } from 'react';
import { Bell, Menu, MessageSquare, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NexaLogo } from '@/components/ui/nexa-logo';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCopilotStore } from '@/stores/copilot-store';
import { useSidebarStore } from '@/stores/sidebar-store';

import { useI18n } from '@nexa/i18n';

import { UnifiedSearch } from '../header/UnifiedSearch';
import { UserMenu } from './user-menu';

export function AppHeader() {
  const { t } = useI18n();
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const isSidebarOpen = useSidebarStore((s) => s.isOpen);
  const toggleCopilotDrawer = useCopilotStore((s) => s.toggleDrawer);
  const isDrawerOpen = useCopilotStore((s) => s.isDrawerOpen);
  const isStreaming = useCopilotStore((s) => s.isStreaming);

  // Mobile search expansion state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Placeholder notification count (wired to real system in E9)
  const notificationCount = 0;

  return (
    <TooltipProvider delayDuration={200}>
      <header
        role="banner"
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-border bg-surface px-4',
          'gap-2',
        )}
      >
        {/* ── Hamburger menu (mobile only) ────────────────────── */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="md:hidden"
          aria-label={t('navigation:toggleMenu')}
          aria-expanded={isSidebarOpen}
        >
          <Menu className="size-5" />
        </Button>

        {/* ── Logo mark (desktop only) ─────────────────────────── */}
        <NexaLogo size="sm" className="hidden md:flex" />

        {/* ── Search / Command palette ────────────────────────── */}
        {/* Desktop: UnifiedSearch always visible */}
        <div className="hidden flex-1 md:block">
          <UnifiedSearch />
        </div>

        {/* Mobile: search icon button that expands to show UnifiedSearch */}
        {!isSearchExpanded && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchExpanded(true)}
            className="md:hidden"
            aria-label={t('search.ariaLabel')}
          >
            <Search className="size-5" />
          </Button>
        )}

        {/* Mobile expanded search */}
        {isSearchExpanded && (
          <div className="flex flex-1 items-center gap-2 md:hidden">
            <div className="flex-1">
              <UnifiedSearch />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchExpanded(false)}
              aria-label={t('common:close')}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        {/* ── Spacer (pushes icon buttons to the right on desktop) ─ */}
        <div className="flex-1 md:hidden" />

        {/* ── Right-side action buttons ───────────────────────── */}
        <div
          className={cn(
            'flex items-center gap-1',
            isSearchExpanded && 'hidden md:flex',
          )}
        >
          {/* Co-Pilot chat toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCopilotDrawer}
                className="relative"
                aria-label={
                  isDrawerOpen
                    ? t('navigation:closeCopilot')
                    : t('navigation:openCopilot')
                }
              >
                <MessageSquare className="size-5" />
                {isStreaming && (
                  <span className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isDrawerOpen
                ? t('navigation:closeCopilot')
                : t('navigation:openCopilot')}
            </TooltipContent>
          </Tooltip>

          {/* Notifications bell placeholder (E9) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={t('navigation:notifications')}
              >
                <Bell className="size-5" />
                {notificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center p-0 text-[10px]"
                    aria-live="polite"
                  >
                    {notificationCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('navigation:notifications')}</TooltipContent>
          </Tooltip>

          {/* User avatar menu */}
          <UserMenu />
        </div>
      </header>
    </TooltipProvider>
  );
}
