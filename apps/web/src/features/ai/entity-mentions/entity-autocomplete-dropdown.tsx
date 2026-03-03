import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';

import { getEntityIcon } from './entity-chip';
import type { EntitySearchResult } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Naive pluralisation for the header label.
 * Multi-word types like "SavedView" are split into "Saved Views".
 */
function pluraliseEntityType(entityType: string): string {
  // Split PascalCase into words: "SavedView" → "Saved View"
  const spaced = entityType.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Simple pluralisation — add "s" unless it already ends with "s"
  return spaced.endsWith('s') ? spaced : `${spaced}s`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EntityAutocompleteDropdownProps {
  results: EntitySearchResult[];
  loading: boolean;
  selectedIndex: number;
  entityType: string;
  contextScope?: string;
  onSelect: (result: EntitySearchResult) => void;
  onClose: () => void;
  isMobile: boolean;
}

// ---------------------------------------------------------------------------
// Shared result list (used by both desktop dropdown and mobile bottom sheet)
// ---------------------------------------------------------------------------

function ResultList({
  results,
  loading,
  selectedIndex,
  entityType,
  contextScope,
  onSelect,
  listRef,
}: {
  results: EntitySearchResult[];
  loading: boolean;
  selectedIndex: number;
  entityType: string;
  contextScope?: string;
  onSelect: (result: EntitySearchResult) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const entityLabel = pluraliseEntityType(entityType);

  return (
    <>
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
                <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-3.5 w-24" />
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
          results.map((result, i) => {
            const Icon = getEntityIcon(result.entityType);
            return (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelect(result)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 text-left text-sm transition-colors',
                  'py-2 min-h-[44px]',
                  i === selectedIndex
                    ? 'bg-[#f5f3ff] text-foreground'
                    : 'text-foreground hover:bg-accent',
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-[#6d28d9]">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{result.displayName}</div>
                  {result.subtitle && (
                    <div className="truncate text-xs text-muted-foreground">{result.subtitle}</div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Desktop dropdown
// ---------------------------------------------------------------------------

function DesktopDropdown({
  results,
  loading,
  selectedIndex,
  entityType,
  contextScope,
  onSelect,
}: Omit<EntityAutocompleteDropdownProps, 'onClose' | 'isMobile'>) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only scroll when results are visible (not during loading/empty states
    // where children[selectedIndex] would target skeleton wrappers)
    if (loading || results.length === 0) return;
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, loading, results.length]);

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-xl border border-border bg-card shadow-lg">
      <ResultList
        results={results}
        loading={loading}
        selectedIndex={selectedIndex}
        entityType={entityType}
        contextScope={contextScope}
        onSelect={onSelect}
        listRef={listRef}
      />

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          Use arrow keys to navigate, Enter to select, Esc to dismiss
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom sheet (Vaul drawer)
// ---------------------------------------------------------------------------

function MobileBottomSheet({
  results,
  loading,
  selectedIndex,
  entityType,
  contextScope,
  onSelect,
  onClose,
}: Omit<EntityAutocompleteDropdownProps, 'isMobile'>) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || results.length === 0) return;
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, loading, results.length]);

  const entityLabel = pluraliseEntityType(entityType);

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[50vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{entityLabel}</DrawerTitle>
        </DrawerHeader>

        <ResultList
          results={results}
          loading={loading}
          selectedIndex={selectedIndex}
          entityType={entityType}
          contextScope={contextScope}
          onSelect={onSelect}
          listRef={listRef}
        />
      </DrawerContent>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// EntityAutocompleteDropdown — public API
// ---------------------------------------------------------------------------

export function EntityAutocompleteDropdown(props: EntityAutocompleteDropdownProps) {
  if (props.isMobile) {
    return <MobileBottomSheet {...props} />;
  }
  return <DesktopDropdown {...props} />;
}
