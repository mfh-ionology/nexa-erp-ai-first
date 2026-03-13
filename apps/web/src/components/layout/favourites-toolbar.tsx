/**
 * FavouritesToolbar — 40px bar below the header showing pinned page chips.
 *
 * Uses ResizeObserver to measure available width and collapse overflow chips
 * into a "+N more" popover. A dashed "+ Add" button opens the mega-menu.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Plus, Star } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';
import { resolveIcon } from '@/lib/icon-resolver';
import { useFavouritePages } from '@/hooks/use-favourite-pages';
import { useMegaMenuStore } from '@/stores/mega-menu-store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

/** Average chip width in px — used for overflow calculation */
const CHIP_WIDTH = 120;
/** Gap between chips in px */
const CHIP_GAP = 6;
/** Reserved space for overflow indicator + add button (px) */
const RESERVED_TAIL = 160;

export function FavouritesToolbar() {
  const { t } = useI18n();
  const { pages, isLoading } = useFavouritePages();
  const openMegaMenu = useMegaMenuStore((s) => s.open);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(pages.length);

  const recalculate = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const availableWidth = el.clientWidth - RESERVED_TAIL;
    const count = Math.max(1, Math.floor(availableWidth / (CHIP_WIDTH + CHIP_GAP)));
    setVisibleCount(count);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    recalculate();

    const observer = new ResizeObserver(() => {
      recalculate();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [recalculate]);

  // Also recalculate when the number of pages changes
  useEffect(() => {
    recalculate();
  }, [pages.length, recalculate]);

  const visibleChips = pages.slice(0, visibleCount);
  const overflowChips = pages.slice(visibleCount);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 border-b border-border/50 bg-card px-4">
        <Skeleton className="h-5 w-20 rounded" />
        <div className="mx-2 h-4 w-px bg-border" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
    );
  }

  // --- Empty state ---
  if (pages.length === 0) {
    return (
      <div className="flex h-10 items-center gap-2 border-b border-border/50 bg-card px-4">
        <Star className="size-3.5 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/60">
          {t('navigation:favourites.emptyHint')}
        </span>
        <button
          onClick={openMegaMenu}
          className="ml-2 flex items-center gap-1 rounded-full border border-dashed border-primary/30 px-3 py-1 text-xs text-primary/70 transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="size-3" />
          {t('navigation:favourites.add')}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-10 items-center gap-1.5 border-b border-border/50 bg-card px-4"
    >
      {/* Label */}
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {t('navigation:favourites.label')}
      </span>

      {/* Vertical divider */}
      <div className="mx-1.5 h-4 w-px shrink-0 bg-border" />

      {/* Visible chips */}
      {visibleChips.map((page) => {
        const Icon = resolveIcon(page.iconKey);
        const isActive = pathname === page.path || pathname.startsWith(page.path + '/');

        return (
          <Link
            key={page.id}
            to={page.path}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all',
              isActive
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {Icon && <Icon className="size-3" />}
            <span className="max-w-[80px] truncate">{page.label}</span>
          </Link>
        );
      })}

      {/* Overflow popover */}
      {overflowChips.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              +{overflowChips.length} {t('navigation:favourites.more')}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="space-y-0.5">
              {overflowChips.map((page) => {
                const Icon = resolveIcon(page.iconKey);
                const isActive = pathname === page.path || pathname.startsWith(page.path + '/');

                return (
                  <Link
                    key={page.id}
                    to={page.path}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    <span className="truncate">{page.label}</span>
                  </Link>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* + Add button */}
      <button
        onClick={openMegaMenu}
        className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/30 px-2.5 py-1 text-xs text-primary/70 transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="size-3" />
        {t('navigation:favourites.add')}
      </button>
    </div>
  );
}
