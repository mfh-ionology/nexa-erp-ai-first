import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Play,
  Printer,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableCell,
  TableFooter,
  TableRow,
} from '@/components/ui/table';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { DataTable } from './data-table';
import { PageHeader } from './page-header';
import type { ReportPageProps } from './types';

/**
 * T8: Report Page template.
 *
 * Provides a standardised report layout with a parameter form,
 * run button, optional AI summary, results table, and totals row.
 *
 * Used for Trial Balance, Aged Debtors, P&L, VAT Return,
 * and similar reporting screens (~15 screens in the ERP).
 *
 * Responsive behaviour:
 *  - Desktop (>=1024px): Full layout, parameters always visible
 *  - Tablet (768-1023px): Parameters visible, table results with horizontal scroll
 *  - Phone (<768px): Parameters collapsible (collapsed after first run),
 *    results as cards, AI summary prominent at top
 */
export function ReportPage<TResult>({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  children,
  // ReportPage-specific props
  parameterSlot,
  hasResults = false,
  resultColumns,
  resultData,
  aiSummarySlot,
  onRunReport,
  isRunning = false,
  totals,
  actionBarSlot,
}: ReportPageProps<TResult>) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // On phone, collapse parameters after first run
  const [paramsOpen, setParamsOpen] = useState(true);

  // When the report runs on phone, collapse parameters
  const handleRunReport = () => {
    onRunReport?.();
    if (breakpoint === 'phone') {
      setParamsOpen(false);
    }
  };

  // --- Default action bar: [Run Report] + [⋯ More] ---
  const defaultActionBar = (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleRunReport}
        disabled={isRunning}
        size="sm"
      >
        {isRunning ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
        {t('runReport')}
      </Button>

      {/* Overflow menu: Export PDF, Export Excel, Print */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('actions')}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!hasResults}>
            <Download className="size-4" aria-hidden="true" />
            {t('exportCsv')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasResults}>
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            {t('exportExcel')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasResults}>
            <Printer className="size-4" aria-hidden="true" />
            {t('print')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <main className="flex flex-col gap-6" aria-label={title} aria-busy="true">
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        {/* Parameter skeleton */}
        <div className="space-y-3 rounded-lg border p-6">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        {/* Results skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </main>
    );
  }

  // --- Totals row renderer ---
  const renderTotalsRow = (
    cols: ColumnDef<TResult, unknown>[],
    totalsData: Record<string, string>,
  ) => (
    <Table>
      <TableFooter>
        <TableRow className="font-semibold">
          {cols.map((col, idx) => {
            const accessorKey =
              'accessorKey' in col ? (col.accessorKey as string) : null;
            const id = ('id' in col ? col.id : null) ?? accessorKey ?? `total-${idx}`;
            const value = accessorKey ? totalsData[accessorKey] : null;

            return (
              <TableCell key={id}>
                {idx === 0 && !value ? t('total') : (value ?? '')}
              </TableCell>
            );
          })}
        </TableRow>
      </TableFooter>
    </Table>
  );

  // --- Phone layout ---
  if (breakpoint === 'phone') {
    return (
      <main className="flex flex-col gap-4" aria-label={title}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
        />

        {/* Action bar */}
        <div className="flex items-center justify-end">
          {actionBarSlot ?? defaultActionBar}
        </div>

        {/* AI Summary — prominent at top on phone when available */}
        {hasResults && aiSummarySlot && (
          <section
            className="rounded-lg border border-primary/20 bg-primary/5 p-4"
            aria-label={t('aiSummary')}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
              {t('aiSummary')}
            </div>
            {aiSummarySlot}
          </section>
        )}

        {/* Parameters — collapsible on phone */}
        <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
          <div className="rounded-lg border">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50"
              >
                {t('parameters')}
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform duration-200',
                    paramsOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-4 py-4">{parameterSlot}</div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Results as cards on phone */}
        {hasResults && resultData && resultColumns && (
          <section aria-label={t('results')}>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t('results')}
            </h2>
            {resultData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('noResults')}
              </p>
            ) : (
              <div className="space-y-3">
                {resultData.map((row, index) => {
                  const rowRecord = row as Record<string, unknown>;
                  const firstAccessor = resultColumns[0] && 'accessorKey' in resultColumns[0]
                    ? (resultColumns[0].accessorKey as string)
                    : null;
                  const cardKey = firstAccessor
                    ? String(rowRecord[firstAccessor] ?? index)
                    : String(index);
                  return (
                  <Card key={cardKey}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {resultColumns[0] &&
                        'accessorKey' in resultColumns[0]
                          ? String(
                              (row as Record<string, unknown>)[
                                resultColumns[0].accessorKey as string
                              ] ?? '',
                            )
                          : `${t('row')} ${index + 1}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {resultColumns.slice(1).map((col, colIdx) => {
                          const accessorKey =
                            'accessorKey' in col
                              ? (col.accessorKey as string)
                              : null;
                          if (!accessorKey) return null;
                          const value = (row as Record<string, unknown>)[
                            accessorKey
                          ];
                          const header =
                            typeof col.header === 'string'
                              ? col.header
                              : accessorKey;
                          return (
                            <div key={accessorKey ?? colIdx}>
                              <dt className="text-xs text-muted-foreground">
                                {header}
                              </dt>
                              <dd className="truncate">
                                {String(value ?? '')}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </CardContent>
                  </Card>
                  );
                })}

                {/* Totals card on phone */}
                {totals && (
                  <Card className="border-2 border-primary/30">
                    <CardContent className="pt-4">
                      <dl className="space-y-1 text-sm">
                        {Object.entries(totals).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between"
                          >
                            <dt className="text-muted-foreground">{key}</dt>
                            <dd className="font-semibold">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </section>
        )}

        {children}
      </main>
    );
  }

  // --- Tablet layout ---
  if (breakpoint === 'tablet') {
    return (
      <main className="flex flex-col gap-6" aria-label={title}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          actionBarSlot={actionBarSlot ?? defaultActionBar}
        />

        {/* Parameters — always visible on tablet */}
        <section
          className="rounded-lg border p-6"
          aria-label={t('parameters')}
        >
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            {t('parameters')}
          </h2>
          {parameterSlot}
        </section>

        {/* AI Summary */}
        {hasResults && aiSummarySlot && (
          <section
            className="rounded-lg border border-primary/20 bg-primary/5 p-4"
            aria-label={t('aiSummary')}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
              {t('aiSummary')}
            </div>
            {aiSummarySlot}
          </section>
        )}

        {/* Results table with horizontal scroll */}
        {hasResults && resultData && resultColumns && (
          <section aria-label={t('results')}>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t('results')}
            </h2>
            <div className="overflow-x-auto">
              <DataTable<TResult>
                columns={resultColumns}
                data={resultData}
                enableSorting
                isLoading={isRunning}
              />
              {totals && renderTotalsRow(resultColumns, totals)}
            </div>
          </section>
        )}

        {children}
      </main>
    );
  }

  // --- Desktop layout (>=1024px) ---
  return (
    <main className="flex flex-col gap-6" aria-label={title}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actionBarSlot={actionBarSlot ?? defaultActionBar}
      />

      {/* Parameters — always visible on desktop */}
      <section
        className="rounded-lg border p-6"
        aria-label={t('parameters')}
      >
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          {t('parameters')}
        </h2>
        {parameterSlot}
      </section>

      {/* AI Summary */}
      {hasResults && aiSummarySlot && (
        <section
          className="rounded-lg border border-primary/20 bg-primary/5 p-4"
          aria-label={t('aiSummary')}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            {t('aiSummary')}
          </div>
          {aiSummarySlot}
        </section>
      )}

      {/* Results table */}
      {hasResults && resultData && resultColumns && (
        <section aria-label={t('results')}>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t('results')}
          </h2>
          <DataTable<TResult>
            columns={resultColumns}
            data={resultData}
            enableSorting
            isLoading={isRunning}
          />
          {totals && renderTotalsRow(resultColumns, totals)}
        </section>
      )}

      {children}
    </main>
  );
}
