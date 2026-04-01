/* eslint-disable i18next/no-literal-string */
/**
 * FE12: Budget Variance Report Page — /finance/reports/budget-variance
 *
 * Uses T8 (ReportPage) template. Budget vs actual with % variance.
 *
 * When a dimension type is selected via "Group by Dimension", the page
 * adds columns per dimension value showing the variance breakdown.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/templates/report-page';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, buildQueryString } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

import { useBudgets } from '../hooks/use-budgets';
import { useBudgetVarianceReport } from '../hooks/use-additional-reports';
import { DimensionFilter } from '../components/DimensionFilter';
import type { DimensionFilterValue } from '../components/DimensionFilter';
import { DimensionGroupBy } from '../components/DimensionGroupBy';
import { SimulationToggle } from '../components/SimulationToggle';
import { BudgetVersionFilter } from '../components/BudgetVersionFilter';
import { ExportButtons } from '../components/ExportButtons';
import type { BudgetVarianceRow, BudgetVarianceParams } from '../types';

function formatCurrency(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatCurrencyNum(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

const PERIODS = Array.from({ length: 12 }, (_, i) => i + 1);
const PERIOD_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ---------------------------------------------------------------------------
// Grouped Budget Variance types & hook
// ---------------------------------------------------------------------------

interface GroupedBudgetVarianceRow {
  accountCode: string;
  accountName: string;
  columns: Record<
    string,
    { budget: number; actual: number; variance: number; variancePercent: number }
  >;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
}

interface GroupedBudgetVarianceReport {
  columnHeaders: Array<{ id: string; code: string; name: string }>;
  rows: GroupedBudgetVarianceRow[];
  totals: {
    columns: Record<string, { budget: number; actual: number; variance: number }>;
    budgetTotal: number;
    actualTotal: number;
    varianceTotal: number;
  };
  generatedAt: string;
}

interface GroupedBudgetVarianceParams {
  budgetId: string;
  periodFrom: number;
  periodTo: number;
  dimensionTypeId: string;
  includeSimulations?: boolean;
}

function useGroupedBudgetVariance(params: GroupedBudgetVarianceParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<GroupedBudgetVarianceReport>({
    queryKey: ['finance', 'budget-variance-grouped', params],
    queryFn: async () => {
      const qs = buildQueryString(params as unknown as Record<string, unknown>);
      const result = await apiGet<GroupedBudgetVarianceReport>(
        `/finance/reports/budget-variance${qs}`,
      );
      return result.data;
    },
    enabled: isAuthenticated && !!params,
  });
}

// ---------------------------------------------------------------------------
// Grouped Budget Variance Renderer
// ---------------------------------------------------------------------------

function GroupedBudgetVarianceView({ data }: { data: GroupedBudgetVarianceReport }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left font-medium text-muted-foreground">Account</th>
              {data.columnHeaders.map((col) => (
                <th
                  key={col.id}
                  className="py-2 text-right font-medium text-muted-foreground"
                  colSpan={2}
                >
                  {col.name}
                </th>
              ))}
              <th className="py-2 text-right font-medium text-muted-foreground">Budget</th>
              <th className="py-2 text-right font-medium text-muted-foreground">Actual</th>
              <th className="py-2 text-right font-semibold text-muted-foreground">Variance</th>
            </tr>
            <tr className="border-b text-xs text-muted-foreground">
              <th />
              {data.columnHeaders.map((col) => (
                <>
                  <th key={`${col.id}-b`} className="py-1 text-right">
                    Budget
                  </th>
                  <th key={`${col.id}-a`} className="py-1 text-right">
                    Actual
                  </th>
                </>
              ))}
              <th />
              <th />
              <th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.rows.map((row) => (
              <tr key={row.accountCode}>
                <td className="py-2">
                  <span className="font-mono text-xs text-muted-foreground">{row.accountCode}</span>
                  <span className="ml-2">{row.accountName}</span>
                </td>
                {data.columnHeaders.map((col) => {
                  const cell = row.columns[col.id];
                  return (
                    <>
                      <td key={`${col.id}-b`} className="py-2 text-right font-mono tabular-nums">
                        {formatCurrencyNum(cell?.budget ?? 0)}
                      </td>
                      <td key={`${col.id}-a`} className="py-2 text-right font-mono tabular-nums">
                        {formatCurrencyNum(cell?.actual ?? 0)}
                      </td>
                    </>
                  );
                })}
                <td className="py-2 text-right font-mono tabular-nums">
                  {formatCurrencyNum(row.budgetAmount)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {formatCurrencyNum(row.actualAmount)}
                </td>
                <td
                  className={`py-2 text-right font-mono font-medium tabular-nums ${
                    row.variance < 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrencyNum(row.variance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td className="py-2">Total</td>
              {data.columnHeaders.map((col) => {
                const cell = data.totals.columns[col.id];
                return (
                  <>
                    <td key={`${col.id}-b`} className="py-2 text-right font-mono tabular-nums">
                      {formatCurrencyNum(cell?.budget ?? 0)}
                    </td>
                    <td key={`${col.id}-a`} className="py-2 text-right font-mono tabular-nums">
                      {formatCurrencyNum(cell?.actual ?? 0)}
                    </td>
                  </>
                );
              })}
              <td className="py-2 text-right font-mono tabular-nums">
                {formatCurrencyNum(data.totals.budgetTotal)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {formatCurrencyNum(data.totals.actualTotal)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {formatCurrencyNum(data.totals.varianceTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function BudgetVariancePage() {
  const { budgets } = useBudgets({ status: 'APPROVED' });
  const [budgetId, setBudgetId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(1);
  const [periodTo, setPeriodTo] = useState(12);
  const [submittedParams, setSubmittedParams] = useState<BudgetVarianceParams | null>(null);
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilterValue>({
    dimensionTypeId: null,
    dimensionValueId: null,
  });
  const [groupByDimensionTypeId, setGroupByDimensionTypeId] = useState<string | null>(null);
  const [includeSimulations, setIncludeSimulations] = useState(false);
  const [budgetVersionId, setBudgetVersionId] = useState<string | null>(null);

  // Submitted grouping state (only changes on "Run Report")
  const [submittedGroupBy, setSubmittedGroupBy] = useState<string | null>(null);

  // Standard query — only active when not grouped
  const {
    rows: standardRows,
    totals: standardTotals,
    isFetching: standardFetching,
  } = useBudgetVarianceReport(submittedGroupBy === null ? submittedParams : null);

  // Grouped query — only active when grouped
  const { data: groupedData, isFetching: groupedFetching } = useGroupedBudgetVariance(
    submittedGroupBy !== null && submittedParams
      ? {
          budgetId: submittedParams.budgetId,
          periodFrom: submittedParams.periodFrom ?? 1,
          periodTo: submittedParams.periodTo ?? 12,
          dimensionTypeId: submittedGroupBy,
          ...(includeSimulations ? { includeSimulations: true } : {}),
        }
      : null,
  );

  const isGrouped = submittedGroupBy !== null;
  const isFetching = isGrouped ? groupedFetching : standardFetching;
  const hasData = isGrouped ? !!groupedData : standardRows.length > 0;

  const handleRunReport = () => {
    if (!budgetId) return;
    setSubmittedParams({
      budgetId,
      periodFrom,
      periodTo,
      ...(dimensionFilter.dimensionTypeId
        ? { dimensionTypeId: dimensionFilter.dimensionTypeId }
        : {}),
      ...(dimensionFilter.dimensionValueId
        ? { dimensionValueId: dimensionFilter.dimensionValueId }
        : {}),
      ...(includeSimulations ? { includeSimulations: true } : {}),
      ...(budgetVersionId ? { budgetVersionId } : {}),
    });
    setSubmittedGroupBy(groupByDimensionTypeId);
  };

  const exportParams: Record<string, string | number | boolean> = {
    ...(budgetId ? { budgetId } : {}),
    periodFrom,
    periodTo,
    ...(includeSimulations ? { includeSimulations: true } : {}),
    ...(budgetVersionId ? { budgetVersionId } : {}),
    ...(dimensionFilter.dimensionTypeId
      ? { dimensionTypeId: dimensionFilter.dimensionTypeId }
      : {}),
    ...(dimensionFilter.dimensionValueId
      ? { dimensionValueId: dimensionFilter.dimensionValueId }
      : {}),
    ...(groupByDimensionTypeId ? { groupByDimensionTypeId } : {}),
  };

  const columns = useMemo<ColumnDef<BudgetVarianceRow>[]>(
    () => [
      {
        accessorKey: 'accountCode',
        header: 'Account Code',
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'accountName',
        header: 'Account Name',
      },
      {
        accessorKey: 'budgetAmount',
        header: 'Budget',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'actualAmount',
        header: 'Actual',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'variance',
        header: 'Variance',
        cell: ({ getValue }) => {
          const val = Number(getValue<string>());
          const isNegative = val < 0;
          return (
            <span
              className={`font-mono text-sm tabular-nums ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}
            >
              {formatCurrency(getValue<string>())}
            </span>
          );
        },
      },
      {
        accessorKey: 'variancePercent',
        header: '% Variance',
        cell: ({ getValue }) => {
          const val = Number(getValue<string>());
          const isNegative = val < 0;
          return (
            <span
              className={`font-mono text-sm tabular-nums ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}
            >
              {Number.isNaN(val) ? '\u2014' : `${val > 0 ? '+' : ''}${val.toFixed(1)}%`}
            </span>
          );
        },
      },
    ],
    [],
  );

  const parameterSlot = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Budget</Label>
          <Select value={budgetId} onValueChange={setBudgetId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a budget..." />
            </SelectTrigger>
            <SelectContent>
              {budgets.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} (FY {b.fiscalYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Period From</Label>
          <Select value={String(periodFrom)} onValueChange={(v) => setPeriodFrom(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p} - {PERIOD_NAMES[p - 1]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Period To</Label>
          <Select value={String(periodTo)} onValueChange={(v) => setPeriodTo(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p} - {PERIOD_NAMES[p - 1]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <BudgetVersionFilter value={budgetVersionId} onChange={setBudgetVersionId} />
        <DimensionGroupBy value={groupByDimensionTypeId} onChange={setGroupByDimensionTypeId} />
        {!groupByDimensionTypeId && (
          <DimensionFilter value={dimensionFilter} onChange={setDimensionFilter} />
        )}
        <SimulationToggle checked={includeSimulations} onChange={setIncludeSimulations} />
      </div>
    </div>
  );

  const actionBarSlot = (
    <div className="flex items-center gap-2">
      <ExportButtons
        exportPath="/finance/reports/budget-variance/export"
        params={exportParams}
        disabled={!hasData}
        variant="icon"
      />
    </div>
  );

  // Grouped view uses custom rendering
  if (isGrouped) {
    return (
      <ReportPage
        title="Budget Variance"
        subtitle="Compare budget vs actual amounts with variance analysis"
        breadcrumbs={[
          { label: 'Finance', path: '/finance' },
          { label: 'Reports' },
          { label: 'Budget Variance' },
        ]}
        parameterSlot={parameterSlot}
        hasResults={hasData}
        onRunReport={handleRunReport}
        isRunning={isFetching}
        actionBarSlot={actionBarSlot}
      >
        {isFetching && !groupedData && (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {groupedData && <GroupedBudgetVarianceView data={groupedData} />}
      </ReportPage>
    );
  }

  return (
    <ReportPage<BudgetVarianceRow>
      title="Budget Variance"
      subtitle="Compare budget vs actual amounts with variance analysis"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports' },
        { label: 'Budget Variance' },
      ]}
      parameterSlot={parameterSlot}
      hasResults={standardRows.length > 0}
      resultColumns={columns}
      resultData={standardRows}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      totals={standardTotals ?? undefined}
      actionBarSlot={actionBarSlot}
    />
  );
}
