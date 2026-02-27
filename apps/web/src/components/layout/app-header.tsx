/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { useState } from 'react';
import { Bell, Menu, MessageSquare, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NexaLogo } from '@/components/ui/nexa-logo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCopilotStore } from '@/stores/copilot-store';
import { useSidebarStore } from '@/stores/sidebar-store';

import { useI18n, useLocale } from '@nexa/i18n';

import { UnifiedSearch } from '../header/UnifiedSearch';
import { FavouritesDropdown } from '@/features/views/components/favourites-dropdown';
import { UserMenu } from './user-menu';

export function AppHeader() {
  const { t } = useI18n();
  const locale = useLocale();
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const isSidebarOpen = useSidebarStore((s) => s.isOpen);
  const toggleCopilotDrawer = useCopilotStore((s) => s.toggleDrawer);
  const isDrawerOpen = useCopilotStore((s) => s.isDrawerOpen);
  const isStreaming = useCopilotStore((s) => s.isStreaming);

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Placeholder notification count (wired in E9)
  const notificationCount = 3;

  return (
    <TooltipProvider delayDuration={200}>
      <header
        role="banner"
        className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4"
      >
        {/* Left side */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="lg:hidden"
            aria-label={t('navigation:toggleMenu')}
            aria-expanded={isSidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo - visible on mobile */}
          <div className="lg:hidden">
            <NexaLogo size="sm" />
          </div>
        </div>

        {/* Centre search bar (v0 style) */}
        <div className="mx-4 hidden max-w-[400px] flex-1 sm:block">
          <UnifiedSearch />
        </div>

        {/* Mobile search */}
        {!isSearchExpanded && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsSearchExpanded(true);
            }}
            className="sm:hidden"
            aria-label={t('search.ariaLabel')}
          >
            <Search className="h-5 w-5" />
          </Button>
        )}
        {isSearchExpanded && (
          <div className="flex flex-1 items-center gap-2 sm:hidden">
            <div className="flex-1">
              <UnifiedSearch />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearchExpanded(false);
              }}
              aria-label={t('common:close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Right side */}
        <div className={cn('flex items-center gap-3', isSearchExpanded && 'hidden sm:flex')}>
          {/* Date display */}
          <span className="hidden text-sm text-muted-foreground md:block">
            {new Date().toLocaleDateString(locale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>

          {/* Co-Pilot chat toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCopilotDrawer}
                className="relative"
                aria-label={
                  isDrawerOpen ? t('navigation:closeCopilot') : t('navigation:openCopilot')
                }
              >
                <MessageSquare className="h-4 w-4" />
                {isStreaming && (
                  <span className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isDrawerOpen ? t('navigation:closeCopilot') : t('navigation:openCopilot')}
            </TooltipContent>
          </Tooltip>

          {/* Notification bell (v0 style with badge) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={t('navigation:notifications')}
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {notificationCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('navigation:notifications')}</TooltipContent>
          </Tooltip>

          {/* Favourites star dropdown */}
          <FavouritesDropdown />

          {/* User avatar menu */}
          <UserMenu />
        </div>
      </header>
    </TooltipProvider>
  );
}
