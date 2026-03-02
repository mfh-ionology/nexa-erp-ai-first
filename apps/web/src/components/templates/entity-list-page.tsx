/* eslint-disable i18next/no-literal-string, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-condition */
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { Loader2, MoreHorizontal, Plus, Search, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useViewState,
  useViewMutations,
  useColumnMutations,
  useFilterState,
  MetadataDataTable,
  ColumnsButton,
  QuickFilterButton,
  AdvancedFilterButton,
  ViewsBar,
  SaveViewButton,
  DeleteViewButton,
} from '@/features/views';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { usePermission } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { BatchActionBar } from './batch-action-bar';
import { DataTable } from './data-table';
import { PageHeader } from './page-header';
import type { EntityListPageProps, OverflowAction } from './types';

import type { ViewState } from '@/features/views/hooks/use-view-state';

// ---------------------------------------------------------------------------
// Internal metadata config — passed from MetadataEntityListPage to the layout
// ---------------------------------------------------------------------------

/** @internal — not part of public API. Only used between MetadataEntityListPage and EntityListPageContent. */
interface MetadataConfig {
  viewKey: string;
  viewState: ViewState;
  onColumnWidthChange: (fieldId: string, width: number) => void;
  activeFilterCount: number;
}

/** Internal-only props for EntityListPageContent — extends the public props with the metadata config. */
type InternalEntityListPageProps<TData> = EntityListPageProps<TData> & {
  /** @internal */ metadataConfig?: MetadataConfig;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * T1: Entity List Page template.
 *
 * Provides a standardised list view with search, filtering, sorting,
 * row selection, batch actions, and cursor-based pagination.
 *
 * When `viewKey` is provided, enables the metadata-driven DataTable with
 * auto-generated columns, SavedViewSelector, ViewsColumnsButton, column
 * resize, and column pinning.
 */
export function EntityListPage<TData>(props: EntityListPageProps<TData>) {
  if (props.viewKey) {
    return <MetadataEntityListPage {...props} viewKey={props.viewKey} />;
  }
  return <EntityListPageContent {...props} />;
}

// ---------------------------------------------------------------------------
// Metadata wrapper — calls view hooks, injects toolbar + metadata config
// ---------------------------------------------------------------------------

function MetadataEntityListPage<TData>({
  viewKey,
  savedViewSlot: _existingSavedViewSlot,
  onFilterChange,
  ...rest
}: Omit<EntityListPageProps<TData>, 'viewKey'> & { viewKey: string }) {
  const { t } = useI18n();
  const viewState = useViewState(viewKey);
  const mutations = useViewMutations(viewKey, t);
  const columnMutations = useColumnMutations(viewKey);
  const filterState = useFilterState(viewState);

  // Handle filter application — updates viewState and notifies parent
  const applyFiltersToViewState = viewState.applyFilters;
  const handleFilterApply = useCallback(
    (result: ReturnType<typeof filterState.applyFilters>) => {
      applyFiltersToViewState(result.conditions, result.sortRules, result.filterLogic);
    },
    [applyFiltersToViewState, filterState.applyFilters],
  );

  // E7.5: Reactively notify parent whenever activeFilters change (from Apply, saved view load, or default view init)
  useEffect(() => {
    onFilterChange?.(viewState.activeFilters, viewState.activeSortRules, viewState.filterLogic);
  }, [viewState.activeFilters, viewState.activeSortRules, viewState.filterLogic, onFilterChange]);

  // Build the two-row toolbar: Row 1 buttons + Row 2 views bar
  const toolbarButtons = viewState.dataView ? (
    <div className="flex items-center gap-2">
      <ColumnsButton viewState={viewState} columnMutations={columnMutations} />
      <QuickFilterButton
        viewKey={viewKey}
        viewState={viewState}
        filterState={filterState}
        onApply={handleFilterApply}
        entityName={rest.title}
      />
      <AdvancedFilterButton
        viewKey={viewKey}
        viewState={viewState}
        filterState={filterState}
        onApply={handleFilterApply}
      />
    </div>
  ) : null;

  const viewsBarSlot = viewState.dataView ? (
    <div className="flex items-center gap-2">
      <ViewsBar viewState={viewState} />
      <SaveViewButton viewKey={viewKey} viewState={viewState} mutations={mutations} />
      <DeleteViewButton viewState={viewState} mutations={mutations} />
    </div>
  ) : null;

  // Use metadata-generated columns when available,
  // fall back to prop columns during loading or if metadata yields no columns
  const effectiveColumns =
    viewState.tanstackColumns.length > 0
      ? (viewState.tanstackColumns as ColumnDef<TData>[])
      : rest.columns;

  const mdConfig: MetadataConfig = {
    viewKey,
    viewState,
    onColumnWidthChange: columnMutations.debouncedUpdateWidth,
    activeFilterCount: viewState.activeFilterCount,
  };

  return (
    <EntityListPageContent
      {...rest}
      columns={effectiveColumns}
      isLoading={rest.isLoading || viewState.isLoading}
      savedViewSlot={viewsBarSlot}
      filterSlot={toolbarButtons}
      metadataConfig={mdConfig}
    />
  );
}

// ---------------------------------------------------------------------------
// Core layout — used by both plain and metadata modes
// ---------------------------------------------------------------------------

function EntityListPageContent<TData>({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  // EntityListPage-specific props
  columns,
  data,
  entityType: _entityType,
  resourceCode,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  filterSlot,
  savedViewSlot,
  canCreate = false,
  onCreateNew,
  batchActions = [],
  onRowClick,
  getRowId,
  overflowActions = [],
  // Internal metadata config (not part of public API)
  metadataConfig,
}: InternalEntityListPageProps<TData>) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // --- Permission gating via resourceCode ---
  const resourcePerms = usePermission(resourceCode ?? '');
  const effectiveCanCreate = canCreate && (!resourceCode || resourcePerms.canNew);

  const filteredBatchActions = useMemo(() => {
    if (!resourceCode) return batchActions;
    return batchActions.filter((action) => {
      if (!action.permissionAction) return true;
      return resourcePerms[action.permissionAction];
    });
  }, [resourceCode, batchActions, resourcePerms]);

  // Internal selection state
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => Object.keys(selectedRowIds).filter((id) => selectedRowIds[id]),
    [selectedRowIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedRowIds({});
  }, []);

  // Group overflow actions by section
  const groupedOverflow = useMemo(() => {
    const sections = new Map<string, OverflowAction[]>();
    for (const action of overflowActions) {
      const section = action.section ?? '_default';
      const group = sections.get(section) ?? [];
      group.push(action);
      sections.set(section, group);
    }
    return sections;
  }, [overflowActions]);

  // --- Header action bar ---
  const headerActions = (
    <div className="flex items-center gap-2">
      {effectiveCanCreate && breakpoint !== 'phone' && (
        <Button onClick={onCreateNew} size="sm">
          <Plus className="size-4" />
          {t('new')}
        </Button>
      )}

      {/* AI placeholder button */}
      <Button variant="ghost" size="icon-sm" aria-label="AI">
        <Sparkles className="size-4" />
      </Button>

      {/* Overflow menu */}
      {overflowActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('actions')}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Array.from(groupedOverflow.entries()).map(([section, actions], sectionIdx) => (
              <div key={section}>
                {sectionIdx > 0 && <DropdownMenuSeparator />}
                {section !== '_default' && <DropdownMenuLabel>{section}</DropdownMenuLabel>}
                {actions.map((action) => (
                  <DropdownMenuItem key={action.key} onClick={action.onAction}>
                    {t(action.labelKey)}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  // --- Phone card view renderer ---
  const renderMobileCards = (rows: TData[], cols: ColumnDef<TData>[]) => {
    if (rows.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          role="status"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-muted/60">
            <Search className="size-6" />
          </div>
          <p className="mt-4 text-sm font-medium">{t('noResults')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {rows.map((row, index) => {
          const rowId = getRowId ? getRowId(row) : String(index);
          return (
            <Card
              key={rowId}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                selectedRowIds[rowId] && 'ring-2 ring-primary',
              )}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick?.(row);
                }
              }}
              tabIndex={0}
              role="article"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {/* Render first column as card title */}
                  {cols[0] && 'accessorKey' in cols[0]
                    ? String((row as Record<string, unknown>)[cols[0].accessorKey as string] ?? '')
                    : `${t('row')} ${index + 1}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {cols.slice(1).map((col, colIdx) => {
                    const accessorKey = 'accessorKey' in col ? (col.accessorKey as string) : null;
                    if (!accessorKey) return null;
                    const value = (row as Record<string, unknown>)[accessorKey];
                    const header = typeof col.header === 'string' ? col.header : accessorKey;

                    // Use column cell renderer when available for consistent formatting
                    let rendered: ReactNode;
                    if (typeof col.cell === 'function') {
                      const cellCtx = {
                        getValue: () => value,
                        row: { original: row },
                      } as unknown as CellContext<TData, unknown>;
                      rendered = flexRender(col.cell, cellCtx);
                    } else {
                      rendered = String(value ?? '');
                    }

                    return (
                      <div key={accessorKey ?? colIdx}>
                        <dt className="text-muted-foreground text-xs">{header}</dt>
                        <dd className="truncate">{rendered}</dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // Show toolbar when there's search, filter, saved view, or metadata mode
  const showToolbar = onSearchChange || filterSlot || savedViewSlot;

  return (
    <main className="flex flex-col gap-6" aria-label={title}>
      {/* Page header with breadcrumbs, title, and actions */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actionBarSlot={headerActions}
        isLoading={isLoading}
      />

      {/* Toolbar: Row 1 (Search + buttons) + Row 2 (Views bar) */}
      {showToolbar && (
        <div className="flex flex-col gap-2 animate-fade-in-up delay-2">
          {/* Row 1: Search + filter/column buttons */}
          <div
            className={cn(
              'flex items-center gap-3',
              breakpoint === 'phone' && 'flex-col items-stretch',
            )}
          >
            {onSearchChange && (
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                  }}
                  placeholder={searchPlaceholder ?? t('search')}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  aria-label={t('search')}
                />
              </div>
            )}

            {filterSlot}
          </div>

          {/* Row 2: Views bar / saved view selector */}
          {savedViewSlot && <div className="flex items-center gap-2">{savedViewSlot}</div>}
        </div>
      )}

      {/* Data display: Table on desktop/tablet, cards on phone */}
      <div className="flex flex-col gap-3 animate-fade-in-up delay-3">
        {breakpoint === 'phone' ? (
          renderMobileCards(data, columns)
        ) : metadataConfig ? (
          <MetadataDataTable
            columns={columns}
            columnState={metadataConfig.viewState.columnState}
            data={data}
            onRowClick={onRowClick}
            getRowId={getRowId}
            enableSelection={filteredBatchActions.length > 0}
            enableSorting
            isLoading={isLoading}
            selectedRowIds={selectedRowIds}
            onSelectionChange={setSelectedRowIds}
            onColumnWidthChange={metadataConfig.onColumnWidthChange}
          />
        ) : (
          <DataTable
            columns={columns}
            data={data}
            onRowClick={onRowClick}
            getRowId={getRowId}
            enableSelection={filteredBatchActions.length > 0}
            enableSorting
            isLoading={isLoading}
            selectedRowIds={selectedRowIds}
            onSelectionChange={setSelectedRowIds}
          />
        )}

        {/* Record count + Load More */}
        {!isLoading && data.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              {t('recordCount', { count: data.length })}
            </p>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="text-xs"
              >
                {isLoadingMore && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {t('loadMore')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Batch action bar — appears when rows are selected */}
      {filteredBatchActions.length > 0 && selectedIds.length > 0 && (
        <BatchActionBar
          selectedCount={selectedIds.length}
          actions={filteredBatchActions}
          onClear={clearSelection}
          selectedIds={selectedIds}
        />
      )}

      {/* Floating action button for phone — [+ New] */}
      {effectiveCanCreate && breakpoint === 'phone' && (
        <Button
          className="fixed bottom-6 right-6 z-30 size-14 rounded-full shadow-lg"
          onClick={onCreateNew}
          aria-label={t('new')}
        >
          <Plus className="size-6" />
        </Button>
      )}
    </main>
  );
}
