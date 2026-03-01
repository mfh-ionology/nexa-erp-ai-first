import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import type { ViewState } from '../hooks/use-view-state';
import { SavedViewSelector } from './saved-view-selector';

interface ViewsBarProps {
  viewState: ViewState;
}

// ---------------------------------------------------------------------------
// Pill component
// ---------------------------------------------------------------------------

function ViewPill({
  label,
  isActive,
  isFavourite,
  onClick,
}: {
  label: string;
  isActive: boolean;
  isFavourite?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-muted-foreground hover:bg-accent/50',
      )}
    >
      {label}
      {isFavourite && <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Overflow dropdown
// ---------------------------------------------------------------------------

function OverflowPill({
  count,
  items,
  activeViewId,
  onSelect,
}: {
  count: number;
  items: Array<{ id: string | null; name: string; isFavourite?: boolean }>;
  activeViewId: string | null;
  onSelect: (viewId: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors',
            'border border-border bg-card text-muted-foreground hover:bg-accent/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          {t('views.viewsBar.more', { count })}
          <ChevronDown className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[200px] p-1 rounded-xl shadow-[0_4px_24px_rgba(124,58,237,0.08)]"
      >
        <ScrollArea className="max-h-[240px]">
          {items.map((item) => {
            const isActive = item.id === activeViewId;
            return (
              <button
                key={item.id ?? 'all'}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  'hover:bg-accent/50',
                  isActive && 'bg-primary/10 text-primary font-medium',
                )}
              >
                <span className="flex-1 truncate text-left">{item.name}</span>
                {item.isFavourite && (
                  <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                )}
              </button>
            );
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ViewsBar({ viewState }: ViewsBarProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxVisible, setMaxVisible] = useState<number>(Infinity);

  const { savedViews, activeViewId, setActiveView } = viewState;

  // Sort views: favourites first, then alphabetical
  const sortedViews = useMemo(() => {
    if (!savedViews || savedViews.length === 0) return [];
    return [...savedViews].sort((a, b) => {
      // Favourites first
      if (a.isFavourite && !b.isFavourite) return -1;
      if (!a.isFavourite && b.isFavourite) return 1;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [savedViews]);

  // All items: "All" first, then sorted views
  const allItems = useMemo(
    () => [
      { id: null as string | null, name: t('views.viewsBar.all'), isFavourite: false },
      ...sortedViews.map((v) => ({
        id: v.id as string | null,
        name: v.name,
        isFavourite: v.isFavourite,
      })),
    ],
    [sortedViews, t],
  );

  // Overflow detection via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container || breakpoint === 'phone') return;

    const checkOverflow = () => {
      // Reset to show all, then check
      if (container.scrollWidth <= container.clientWidth) {
        setMaxVisible(Infinity);
        return;
      }

      // Binary search for the right count (accounting for "+N more" pill ~80px)
      const overflowPillWidth = 80;
      const availableWidth = container.clientWidth - overflowPillWidth;
      // eslint-disable-next-line i18next/no-literal-string
      const pills = container.querySelectorAll('[data-view-pill]');
      let cumulativeWidth = 0;
      let fitCount = 0;

      for (const pill of pills) {
        cumulativeWidth += (pill as HTMLElement).offsetWidth + 6; // 6px gap
        if (cumulativeWidth > availableWidth) break;
        fitCount++;
      }

      setMaxVisible(Math.max(1, fitCount));
    };

    // Use ResizeObserver for responsive overflow
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(container);

    // Also check after a frame to account for paint
    requestAnimationFrame(checkOverflow);

    return () => {
      observer.disconnect();
    };
  }, [allItems.length, breakpoint]);

  const handleSelect = useCallback(
    (viewId: string | null) => {
      setActiveView(viewId);
    },
    [setActiveView],
  );

  // Arrow key navigation for tablist pattern (WCAG 2.1 AA)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const container = containerRef.current;
    if (!container) return;

    // eslint-disable-next-line i18next/no-literal-string
    const tabs = container.querySelectorAll<HTMLElement>('[role="tab"]');
    if (tabs.length === 0) return;

    const currentIndex = Array.from(tabs).findIndex((t) => t === document.activeElement);
    let nextIndex: number;

    if (e.key === 'ArrowRight') {
      nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
    }

    tabs[nextIndex]?.focus();
    e.preventDefault();
  }, []);

  // Phone layout: use SavedViewSelector dropdown
  if (breakpoint === 'phone') {
    return <SavedViewSelector viewState={viewState} />;
  }

  const visibleItems = maxVisible === Infinity ? allItems : allItems.slice(0, maxVisible);
  const overflowItems = maxVisible === Infinity ? [] : allItems.slice(maxVisible);

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- tablist delegates focus to child tab elements
    <div
      ref={containerRef}
      className="flex flex-1 items-center gap-1.5 overflow-hidden animate-fade-in-up"
      role="tablist"
      aria-label={t('views.views')}
      onKeyDown={handleKeyDown}
    >
      {visibleItems.map((item) => (
        <div key={item.id ?? 'all'} data-view-pill>
          <ViewPill
            label={item.name}
            isActive={item.id === activeViewId || (item.id === null && !activeViewId)}
            isFavourite={item.isFavourite}
            onClick={() => {
              handleSelect(item.id);
            }}
          />
        </div>
      ))}
      {overflowItems.length > 0 && (
        <OverflowPill
          count={overflowItems.length}
          items={overflowItems}
          activeViewId={activeViewId}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
