'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { entityIcons, type EntityMention, type EntityType } from './entity-chip';

interface AutocompleteResult {
  entity: EntityMention;
}

interface EntityAutocompleteDropdownProps {
  results: AutocompleteResult[];
  loading: boolean;
  selectedIndex: number;
  entityType: EntityType;
  contextScope?: string;
  onSelect: (entity: EntityMention) => void;
  onClose: () => void;
}

export function EntityAutocompleteDropdown({
  results,
  loading,
  selectedIndex,
  entityType,
  contextScope,
  onSelect,
  onClose,
}: EntityAutocompleteDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const entityLabel =
    entityType === 'purchase-order'
      ? 'Purchase Orders'
      : entityType.charAt(0).toUpperCase() + entityType.slice(1) + 's';

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 animate-fade-in-up rounded-xl border border-border bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {entityLabel}
          {contextScope && <span className="ml-1 text-foreground"> for {contextScope}</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {loading ? '...' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Results */}
      <div ref={listRef} className="max-h-[200px] overflow-y-auto py-1">
        {loading ? (
          <div className="flex flex-col gap-1 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No matching {entityLabel.toLowerCase()} found
          </div>
        ) : (
          results.map((r, i) => {
            const Icon = entityIcons[r.entity.type];
            return (
              <button
                key={r.entity.id}
                type="button"
                onClick={() => onSelect(r.entity)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  i === selectedIndex
                    ? 'bg-[#f5f3ff] text-foreground'
                    : 'text-foreground hover:bg-accent',
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-[#6d28d9]">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.entity.name}</div>
                  {r.entity.subtitle && (
                    <div className="truncate text-xs text-muted-foreground">
                      {r.entity.subtitle}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          Use arrow keys to navigate, Enter to select, Esc to dismiss
        </span>
      </div>
    </div>
  );
}
