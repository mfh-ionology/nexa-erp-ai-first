import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

export interface LineItemsTableMeta {
  onLineChange?: (index: number, field: string, value: unknown) => void;
  isEditable?: boolean;
}

export interface LineItemsTableProps<TLine> {
  /** Column definitions for line items */
  columns: ColumnDef<TLine, unknown>[];
  /** Line items data */
  lines: TLine[];
  /** Callback to add a new line */
  onAddLine?: () => void;
  /** Callback to remove a line by index */
  onRemoveLine?: (index: number) => void;
  /** Callback when a line cell is edited */
  onLineChange?: (index: number, field: string, value: unknown) => void;
  /** Whether lines are editable */
  isEditable?: boolean;
  /** Unique line key extractor */
  getLineId?: (line: TLine) => string;
}

/**
 * Editable line items table used by the T3 HeaderLinesPage template.
 *
 * Renders a TanStack Table with line numbers, user-defined columns,
 * and a remove button column. Switches to card layout on phone.
 */
export function LineItemsTable<TLine>({
  columns,
  lines,
  onAddLine,
  onRemoveLine,
  onLineChange,
  isEditable = true,
  getLineId,
}: LineItemsTableProps<TLine>) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // Build full column list: line number + user columns + remove button
  const allColumns: ColumnDef<TLine, unknown>[] = [
    // Line number column
    {
      id: '_lineNumber',
      header: '#',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.index + 1}</span>
      ),
      size: 48,
      enableSorting: false,
    },
    // User-provided columns
    ...columns,
    // Remove button column (only when editable)
    ...(isEditable
      ? [
          {
            id: '_remove',
            header: '',
            cell: ({ row }: { row: { index: number } }) => (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveLine?.(row.index);
                }}
                aria-label={t('removeLine')}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            ),
            size: 40,
            enableSorting: false,
          } satisfies ColumnDef<TLine, unknown>,
        ]
      : []),
  ];

  const table = useReactTable({
    data: lines,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getLineId
      ? (row, index) => getLineId(row) ?? String(index)
      : (_, index) => String(index),
    meta: {
      onLineChange,
      isEditable,
    } satisfies LineItemsTableMeta,
  });

  // --- Phone: render each line as a card ---
  if (breakpoint === 'phone') {
    return (
      <div className="space-y-3" role="grid" aria-label={t('addLine')}>
        {lines.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            {t('noResults')}
          </p>
        )}

        {lines.map((line, index) => {
          const lineId = getLineId ? getLineId(line) : String(index);
          return (
            <Card key={lineId} role="row">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemoveLine?.(index)}
                      aria-label={t('removeLine')}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                  {columns.map((col, colIdx) => {
                    const accessorKey =
                      'accessorKey' in col
                        ? (col.accessorKey as string)
                        : null;
                    if (!accessorKey) return null;
                    const value = (line as Record<string, unknown>)[
                      accessorKey
                    ];
                    const header =
                      typeof col.header === 'string' ? col.header : accessorKey;
                    return (
                      <div key={accessorKey ?? colIdx} role="gridcell">
                        <dt className="text-muted-foreground text-xs">
                          {header}
                        </dt>
                        <dd className="truncate">{String(value ?? '')}</dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          );
        })}

        {isEditable && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddLine}
            className="w-full"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('addLine')}
          </Button>
        )}
      </div>
    );
  }

  // --- Desktop/Tablet: standard table ---
  return (
    <div className="space-y-3">
      <div className="w-full" role="grid" aria-label={t('addLine')}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.id === '_lineNumber' && 'w-12',
                      header.column.id === '_remove' && 'w-10',
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  className="text-center text-muted-foreground py-6"
                >
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      role="gridcell"
                      aria-label={
                        cell.column.id !== '_lineNumber' &&
                        cell.column.id !== '_remove'
                          ? typeof cell.column.columnDef.header === 'string'
                            ? cell.column.columnDef.header
                            : undefined
                          : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isEditable && (
        <Button variant="outline" size="sm" onClick={onAddLine}>
          <Plus className="size-4" aria-hidden="true" />
          {t('addLine')}
        </Button>
      )}
    </div>
  );
}
