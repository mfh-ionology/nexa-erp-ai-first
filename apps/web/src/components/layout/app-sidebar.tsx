import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getFilteredModules } from '@/lib/navigation-config';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

import { useI18n } from '@nexa/i18n';

import { CompanySwitcher } from './company-switcher';
import { SidebarGroup } from './sidebar-group';

interface AppSidebarProps {
  /** When true, render in expanded mode regardless of store state (used for hover overlay and mobile drawer) */
  forceExpanded?: boolean;
}

/**
 * Main sidebar navigation component.
 *
 * - Reads user permissions to filter visible modules
 * - Uses sidebar store for open/collapsed/expanded-groups state
 * - Renders CompanySwitcher at the top for multi-company switching
 * - Collapse/expand toggle at bottom (hidden when forceExpanded)
 * - All strings via i18n translation keys
 */
export function AppSidebar({ forceExpanded = false }: AppSidebarProps) {
  const { t } = useI18n();
  const permissions = useAuthStore((s) => s.permissions);
  const isRefreshingPermissions = useAuthStore((s) => s.isRefreshingPermissions);
  const { isCollapsed: storeCollapsed, expandedGroups, toggleGroup, collapse, expand } =
    useSidebarStore();

  // When forceExpanded (hover overlay or mobile drawer), always show expanded
  const isCollapsed = forceExpanded ? false : storeCollapsed;

  const enabledModules = permissions?.enabledModules ?? [];
  const isSuperAdmin = permissions?.isSuperAdmin ?? false;
  const modules = getFilteredModules(
    enabledModules,
    isSuperAdmin,
    permissions?.modules,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        role="navigation"
        aria-label={t('navigation:sidebar')}
        className={cn(
          'flex h-full flex-col border-r border-sidebar-border bg-sidebar-background',
          isCollapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Company Switcher */}
        <CompanySwitcher isCollapsed={isCollapsed} />

        {/* Module groups — show skeleton during permission refresh */}
        <ScrollArea className="flex-1">
          <div className="py-2">
            {isRefreshingPermissions ? (
              <div className="space-y-3 px-3 py-2" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full rounded" />
                ))}
              </div>
            ) : (
              modules.map((mod) => (
                <SidebarGroup
                  key={mod.key}
                  module={mod}
                  isCollapsed={isCollapsed}
                  isExpanded={expandedGroups.includes(mod.key)}
                  onToggle={() => toggleGroup(mod.key)}
                  onExpandSidebar={expand}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Collapse/expand toggle (hidden in forceExpanded mode) */}
        {!forceExpanded && (
          <div className="shrink-0 border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size={isCollapsed ? 'icon' : 'sm'}
              onClick={isCollapsed ? expand : collapse}
              className="w-full"
              aria-label={
                isCollapsed
                  ? t('navigation:expand')
                  : t('navigation:collapse')
              }
            >
              {isCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <>
                  <ChevronLeft className="size-4" />
                  <span className="flex-1 text-left text-xs text-muted-foreground">
                    {t('navigation:collapse')}
                  </span>
                </>
              )}
            </Button>
          </div>
        )}
      </nav>
    </TooltipProvider>
  );
}
