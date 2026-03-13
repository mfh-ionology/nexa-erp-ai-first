/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Menu, MessageSquare, Search, Star, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NexaLogo } from '@/components/ui/nexa-logo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { NAVIGATION_MODULES } from '@/lib/navigation-config';
import { useCopilotStore } from '@/stores/copilot-store';
import { useMegaMenuStore } from '@/stores/mega-menu-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useFavouritePages } from '@/hooks/use-favourite-pages';

import { useI18n, useLocale } from '@nexa/i18n';

import { NotificationDropdown } from '@/features/notifications/components/notification-dropdown';
import { UnifiedSearch } from '../header/UnifiedSearch';
import { FavouritesDropdown } from '@/features/views/components/favourites-dropdown';
import { UserMenu } from './user-menu';

/** Find the navigation item matching the current path */
function findNavItem(pathname: string) {
  for (const mod of NAVIGATION_MODULES) {
    for (const item of mod.items) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) {
        return item;
      }
    }
  }
  return null;
}

export function AppHeader() {
  const useNewNavigation = import.meta.env.VITE_USE_NEW_NAVIGATION !== 'false';

  const { t } = useI18n();
  const locale = useLocale();
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const isSidebarOpen = useSidebarStore((s) => s.isOpen);
  const megaMenuToggle = useMegaMenuStore((s) => s.toggle);
  const isMegaMenuOpen = useMegaMenuStore((s) => s.isOpen);
  const toggleCopilotDrawer = useCopilotStore((s) => s.toggleDrawer);
  const isDrawerOpen = useCopilotStore((s) => s.isDrawerOpen);
  const isStreaming = useCopilotStore((s) => s.isStreaming);

  // Favourite pages pin star
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPinned, togglePin } = useFavouritePages();
  const currentNavItem = findNavItem(pathname);
  const isCurrentPagePinned = currentNavItem ? isPinned(currentNavItem.path) : false;

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const handleHamburgerClick = useNewNavigation ? megaMenuToggle : toggleSidebar;
  const hamburgerExpanded = useNewNavigation ? isMegaMenuOpen : isSidebarOpen;

  return (
    <TooltipProvider delayDuration={200}>
      <header
        role="banner"
        className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4"
      >
        {/* Left side */}
        <div className="flex items-center gap-3">
          {/* Hamburger menu — always visible with new nav, mobile-only with old nav */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleHamburgerClick}
            className={useNewNavigation ? '' : 'lg:hidden'}
            aria-label={t('navigation:toggleMenu')}
            aria-expanded={hamburgerExpanded}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo - visible on mobile (old nav) or always (new nav uses it as branding) */}
          <div className={useNewNavigation ? '' : 'lg:hidden'}>
            <NexaLogo size="sm" />
          </div>

          {/* Pin star — toggle pinning current page to favourites toolbar */}
          {useNewNavigation && currentNavItem && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    togglePin(currentNavItem.path, t(currentNavItem.labelKey), currentNavItem.icon)
                  }
                  className="size-8"
                  aria-label={
                    isCurrentPagePinned
                      ? t('navigation:favourites.unpin')
                      : t('navigation:favourites.pin')
                  }
                >
                  <Star
                    className={cn(
                      'size-4 transition-colors',
                      isCurrentPagePinned
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground',
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCurrentPagePinned
                  ? t('navigation:favourites.unpin')
                  : t('navigation:favourites.pin')}
              </TooltipContent>
            </Tooltip>
          )}
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

          {/* Notification bell with dropdown */}
          <NotificationDropdown />

          {/* Favourites star dropdown */}
          <FavouritesDropdown />

          {/* User avatar menu */}
          <UserMenu />
        </div>
      </header>
    </TooltipProvider>
  );
}
