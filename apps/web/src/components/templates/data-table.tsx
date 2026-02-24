import { useCallback, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from 'lucide-react';

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

export interface DataTableProps<TData> {
  /** Column definitions for TanStack Table */
  columns: ColumnDef<TData, unknown>[];
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
}

export function DataTable<TData>({
  columns,
  data,
  onRowClick,
  getRowId,
  enableSelection = false,
  enableSorting = true,
  isLoading = false,
  skeletonRowCount = 5,
  selectedRowIds,
  onSelectionChange,
}: DataTableProps<TData>) {
  const { t } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([]);

  // Use controlled selection if provided, otherwise internal state
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});
  const rowSelection = selectedRowIds ?? internalSelection;

  // Resolve TanStack's Updater<RowSelectionState> (value or function) before
  // passing the resolved value to the external onSelectionChange callback.
  const handleSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      if (onSelectionChange) {
        const resolved = typeof updater === 'function'
          ? updater(selectedRowIds ?? {})
          : updater;
        onSelectionChange(resolved);
      } else {
        setInternalSelection(updater);
      }
    },
    [onSelectionChange, selectedRowIds],
  );

  // Prepend selection checkbox column if enabled
  const allColumns: ColumnDef<TData, unknown>[] = enableSelection
    ? [
        {
          id: '_select',
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label={t('selectAll') || 'Select all'}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={
                t('selectRow') || `Select row ${row.index + 1}`
              }
              onClick={(e) => e.stopPropagation()}
            />
          ),
          enableSorting: false,
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
    },
    onSortingChange: setSorting,
    onRowSelectionChange: handleSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getRowId,
    enableRowSelection: enableSelection,
  });

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="w-full" role="grid" aria-busy="true" aria-label={t('loading')}>
        <Table>
          <TableHeader>
            <TableRow>
              {allColumns.map((col, i) => (
                <TableHead key={('id' in col ? col.id : null) ?? `col-${i}`}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
              <TableRow key={`skeleton-${rowIdx}`}>
                {allColumns.map((col, colIdx) => (
                  <TableCell
                    key={`skeleton-${rowIdx}-${('id' in col ? col.id : null) ?? colIdx}`}
                  >
                    <Skeleton className="h-4 w-full" />
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
      <div className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                )),
              )}
            </TableRow>
          </TableHeader>
        </Table>
        <div
          className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          role="status"
        >
          <SearchX className="mb-3 size-10 opacity-40" aria-hidden="true" />
          <p className="text-sm">{t('noResults')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" role="grid">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : canSort
                            ? 'none'
                            : undefined
                    }
                    className={cn(canSort && 'cursor-pointer select-none')}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
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
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {canSort && (
                        <span className="ml-1" aria-hidden="true">
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
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
              className={cn(onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(row.original)}
              onKeyDown={(e) => {
                if (
                  onRowClick &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  e.preventDefault();
                  onRowClick(row.original);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              role="row"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
