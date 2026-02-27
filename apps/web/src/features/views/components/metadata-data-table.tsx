/* eslint-disable i18next/no-literal-string, @typescript-eslint/restrict-template-expressions, react-hooks/incompatible-library */
/**
 * MetadataDataTable — Column-resizable wrapper around TanStack Table.
 *
 * Consumes metadata-driven column definitions from `useViewState` and adds:
 *   - Real-time column drag-resize (`columnResizeMode: 'onChange'`)
 *   - Styled resize handles (purple accent on hover/active)
 *   - Debounced width persistence via `useColumnMutations.debouncedUpdateWidth`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnPinningState,
  type ColumnSizingState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, SearchX } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useI18n } from '@nexa/i18n';

import type { ColumnState } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MetadataDataTableProps<TData> {
  /** Column definitions generated from view metadata (via useViewState.tanstackColumns) */
  columns: ColumnDef<TData>[];
  /** Resolved column state from useViewState — used to map fieldId for width persistence */
  columnState: ColumnState[];
  /** Data rows */
  data: TData[];
  /** Callback when a row is clicked */
  onRowClick?: (row: TData) => void;
  /** Unique row key extractor */
  getRowId?: (row: TData) => string;
  /** Enable row selection with checkboxes */
  enableSelection?: boolean;
  /** Enable column sorting */
  enableSorting?: boolean;
  /** Whether the table is in a loading state */
  isLoading?: boolean;
  /** Number of skeleton rows to show when loading */
  skeletonRowCount?: number;
  /** Controlled selected row IDs (external state) */
  selectedRowIds?: Record<string, boolean>;
  /** Callback when selection changes */
  onSelectionChange?: (selection: Record<string, boolean>) => void;
  /** Debounced width update callback from useColumnMutations */
  onColumnWidthChange?: (fieldId: string, width: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetadataDataTable<TData>({
  columns,
  columnState,
  data,
  onRowClick,
  getRowId,
  enableSelection = false,
  enableSorting = true,
  isLoading = false,
  skeletonRowCount = 5,
  selectedRowIds,
  onSelectionChange,
  onColumnWidthChange,
}: MetadataDataTableProps<TData>) {
  const { t } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // Use controlled selection if provided, otherwise internal state
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});
  const rowSelection = selectedRowIds ?? internalSelection;

  const handleSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      if (onSelectionChange) {
        const resolved = typeof updater === 'function' ? updater(selectedRowIds ?? {}) : updater;
        onSelectionChange(resolved);
      } else {
        setInternalSelection(updater);
      }
    },
    [onSelectionChange, selectedRowIds],
  );

  // Build a map from fieldKey → fieldId for width persistence lookup
  const fieldKeyToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of columnState) {
      map.set(col.fieldKey, col.fieldId);
    }
    return map;
  }, [columnState]);

  // ---------------------------------------------------------------------------
  // Column pinning state (derived from columnState prop)
  // ---------------------------------------------------------------------------

  const columnPinning = useMemo<ColumnPinningState>(() => {
    const left: string[] = [];
    const right: string[] = [];
    for (const col of columnState) {
      if (col.visible) {
        if (col.pinned === 'LEFT') left.push(col.fieldKey);
        else if (col.pinned === 'RIGHT') right.push(col.fieldKey);
      }
    }
    return { left, right };
  }, [columnState]);

  // Edge pinned column IDs — only these get shadow indicators
  const lastLeftPinnedId = columnPinning.left?.length
    ? columnPinning.left[columnPinning.left.length - 1]
    : null;
  const firstRightPinnedId = columnPinning.right?.length ? columnPinning.right[0] : null;
  const hasPinnedColumns = !!(columnPinning.left?.length || columnPinning.right?.length);

  // ---------------------------------------------------------------------------
  // Scroll state tracking for pinned column shadow visibility
  // ---------------------------------------------------------------------------

  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  useEffect(() => {
    if (!hasPinnedColumns) return;

    const container = containerRef.current?.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    );
    if (!container) return;

    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftShadow(scrollLeft > 0);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1);
    };

    updateScrollState();
    container.addEventListener('scroll', updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [hasPinnedColumns]);

  // Handle column sizing changes — update local state + fire debounced persistence
  const handleColumnSizingChange = useCallback(
    (updater: Updater<ColumnSizingState>) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;

        // Determine which columns changed and persist their widths
        if (onColumnWidthChange) {
          for (const [fieldKey, width] of Object.entries(next)) {
            if (prev[fieldKey] !== width) {
              const fieldId = fieldKeyToIdMap.get(fieldKey);
              if (fieldId) {
                onColumnWidthChange(fieldId, width);
              }
            }
          }
        }

        return next;
      });
    },
    [onColumnWidthChange, fieldKeyToIdMap],
  );

  // Prepend selection checkbox column if enabled
  const allColumns: ColumnDef<TData>[] = enableSelection
    ? [
        {
          id: '_select',
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) => {
                table.toggleAllPageRowsSelected(!!value);
              }}
              aria-label={t('selectAll') || 'Select all'}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => {
                row.toggleSelected(!!value);
              }}
              aria-label={t('selectRow') || `Select row ${row.index + 1}`}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          ),
          enableSorting: false,
          enableResizing: false,
          size: 40,
        },
        ...columns,
      ]
    : columns;

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      rowSelection,
      columnSizing,
      columnPinning,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: handleSelectionChange,
    onColumnSizingChange: handleColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getRowId,
    enableRowSelection: enableSelection,
    enableColumnPinning: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
  });

  // Loading skeleton state
  if (isLoading) {
    return (
      <div
        className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        role="grid"
        aria-busy="true"
        aria-label={t('loading')}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
              {allColumns.map((col, i) => (
                <TableHead key={('id' in col ? col.id : null) ?? `col-${i}`}>
                  <Skeleton className="h-3.5 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
              <TableRow key={`skeleton-${rowIdx}`} className="border-border/60">
                {allColumns.map((col, colIdx) => (
                  <TableCell key={`skeleton-${rowIdx}-${('id' in col ? col.id : null) ?? colIdx}`}>
                    <Skeleton
                      className={cn(
                        'h-4',
                        colIdx === 0 ? 'w-32' : colIdx === allColumns.length - 1 ? 'w-20' : 'w-24',
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
              {table
                .getHeaderGroups()
                .map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )),
                )}
            </TableRow>
          </TableHeader>
        </Table>
        <div
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          role="status"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-muted/60">
            <SearchX className="size-6" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium">{t('noResults')}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{t('noResultsHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      role="grid"
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]"
            >
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const canResize = header.column.getCanResize();
                const isPinned = header.column.getIsPinned();

                // Compute pinning styles: sticky position + offset + shadow
                const pinnedStyle: React.CSSProperties = isPinned
                  ? {
                      position: 'sticky',
                      zIndex: 20,
                      ...(isPinned === 'left'
                        ? { left: `${header.column.getStart('left')}px` }
                        : { right: `${header.column.getAfter('right')}px` }),
                      ...(isPinned === 'left' &&
                      header.column.id === lastLeftPinnedId &&
                      showLeftShadow
                        ? { boxShadow: 'inset -4px 0 4px -4px rgba(0, 0, 0, 0.1)' }
                        : isPinned === 'right' &&
                            header.column.id === firstRightPinnedId &&
                            showRightShadow
                          ? { boxShadow: 'inset 4px 0 4px -4px rgba(0, 0, 0, 0.1)' }
                          : {}),
                    }
                  : {};

                return (
                  <TableHead
                    key={header.id}
                    data-pinned={isPinned || undefined}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : canSort
                            ? 'none'
                            : undefined
                    }
                    className={cn(
                      'relative',
                      canSort && 'cursor-pointer select-none group/sort',
                      isPinned && 'bg-card',
                    )}
                    style={{ width: header.getSize(), ...pinnedStyle }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    onKeyDown={
                      canSort
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              header.column.toggleSorting();
                            }
                          }
                        : undefined
                    }
                    tabIndex={canSort ? 0 : undefined}
                    role={canSort ? 'columnheader' : undefined}
                  >
                    <div className="flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="inline-flex" aria-hidden="true">
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5 text-foreground" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5 text-foreground" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-0 group-hover/sort:opacity-50 transition-opacity" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Resize handle */}
                    {canResize && (
                      /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- resize handle is mouse/touch-only by design */
                      <div
                        onDoubleClick={() => {
                          header.column.resetSize();
                        }}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={t('views.columns.resizeHandle')}
                        tabIndex={-1}
                        className={cn(
                          'absolute top-0 right-0 h-full cursor-col-resize select-none touch-none',
                          // Hit area: 8px wide for touch, visual line centered
                          'w-2 group/resize',
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        {/* Visual resize line */}
                        <div
                          className={cn(
                            'absolute right-0 top-0 h-full w-0.5 transition-colors',
                            // Default: transparent
                            'bg-transparent',
                            // Hover: primary purple
                            'group-hover/resize:bg-primary',
                            // Active (dragging): darker purple
                            header.column.getIsResizing() && 'bg-[#5b21b6]',
                          )}
                        />
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row: Row<TData>) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              aria-selected={row.getIsSelected() || undefined}
              className={cn('border-border/60', onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(row.original)}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onRowClick(row.original);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              role="row"
            >
              {row.getVisibleCells().map((cell) => {
                const cellPinned = cell.column.getIsPinned();

                const cellPinnedStyle: React.CSSProperties = cellPinned
                  ? {
                      position: 'sticky',
                      zIndex: 10,
                      ...(cellPinned === 'left'
                        ? { left: `${cell.column.getStart('left')}px` }
                        : { right: `${cell.column.getAfter('right')}px` }),
                      ...(cellPinned === 'left' &&
                      cell.column.id === lastLeftPinnedId &&
                      showLeftShadow
                        ? { boxShadow: 'inset -4px 0 4px -4px rgba(0, 0, 0, 0.1)' }
                        : cellPinned === 'right' &&
                            cell.column.id === firstRightPinnedId &&
                            showRightShadow
                          ? { boxShadow: 'inset 4px 0 4px -4px rgba(0, 0, 0, 0.1)' }
                          : {}),
                    }
                  : {};

                return (
                  <TableCell
                    key={cell.id}
                    data-pinned={cellPinned || undefined}
                    className={cn(cellPinned && 'bg-card')}
                    style={{ width: cell.column.getSize(), ...cellPinnedStyle }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
