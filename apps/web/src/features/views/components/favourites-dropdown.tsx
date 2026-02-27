/**
 * FavouritesDropdown — star icon in the app header that shows all
 * favourite saved views grouped by groupName (AC #7).
 *
 * Self-contained: uses useFavourites() hook internally.
 * Navigation: uses a viewKey-to-route mapping to navigate to entity
 * list pages with the view pre-selected via Zustand store update.
 */

import { useState } from 'react';
import { Star } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useViewStore } from '@/stores/view-store';

import { useFavourites } from '../hooks/use-favourites';

// ---------------------------------------------------------------------------
// viewKey → route mapping
// ---------------------------------------------------------------------------

/**
 * Maps DataView viewKey values to their corresponding route paths.
 * Extend this registry as new entity list pages are added in
 * subsequent epics (Sales, Purchasing, Finance, etc.).
 */
const VIEW_KEY_ROUTE_MAP: Record<string, string> = {
  USERS: '/system/users',
  ACCESS_GROUPS: '/system/access-groups',
  RESOURCES: '/system/resources',
  // Future modules — added as epics are implemented:
  // INVOICES: '/ar/invoices',
  // CUSTOMERS: '/crm/customers',
  // SALES_ORDERS: '/sales/orders',
  // PURCHASE_ORDERS: '/purchasing/orders',
  // ITEMS: '/inventory/items',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FavouritesDropdown() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setActiveView = useViewStore((s) => s.setActiveView);
  const { favourites, groupedFavourites, isLoading } = useFavourites();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasFavourites = favourites.length > 0;
  const groupNames = Object.keys(groupedFavourites).sort();

  function handleSelectFavourite(viewKey: string, viewId: string, viewName: string) {
    const route = VIEW_KEY_ROUTE_MAP[viewKey];
    if (!route) return;

    // Pre-select the view in the Zustand store before navigating
    setActiveView(viewKey, viewId, viewName);
    void navigate({ to: route });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip open={popoverOpen ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={t('views.favourites')}
              >
                <Star
                  className={cn(
                    'h-4 w-4',
                    hasFavourites ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
                  )}
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('views.favourites')}</TooltipContent>
        </Tooltip>

        <PopoverContent align="end" className="w-[280px] rounded-lg p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-sm text-muted-foreground">{t('loading')}</span>
            </div>
          ) : !hasFavourites ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('views.noFavourites')}
            </div>
          ) : (
            <ScrollArea className="max-h-[320px]">
              <div className="py-1">
                {groupNames.map((group, groupIndex) => {
                  const views = groupedFavourites[group];
                  if (!views?.length) return null;

                  return (
                    <div key={group}>
                      {groupIndex > 0 && <div className="mx-3 my-1 border-t border-border" />}
                      <div className="px-3 pb-1 pt-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group}
                        </span>
                      </div>
                      {views.map((fav) => {
                        const hasRoute = !!VIEW_KEY_ROUTE_MAP[fav.viewKey];

                        return (
                          <button
                            key={fav.id}
                            type="button"
                            disabled={!hasRoute}
                            onClick={() => {
                              handleSelectFavourite(fav.viewKey, fav.id, fav.name);
                            }}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                              hasRoute
                                ? 'hover:bg-[#f5f3ff] focus-visible:bg-[#f5f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
                                : 'cursor-not-allowed opacity-50',
                            )}
                          >
                            <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                            <span className="truncate">{fav.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
