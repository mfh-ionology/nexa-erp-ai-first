/* eslint-disable i18next/no-literal-string */
/**
 * FE6: Trial Balance Report Page — /finance/reports/trial-balance
 *
 * Uses T8 (ReportPage) template with debit/credit columns.
 *
 * When a dimension type is selected via "Group by Dimension", the page
 * adds columns per dimension value showing the balance breakdown.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/templates/report-page';
import { apiGet, buildQueryString } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

import { useTrialBalance } from '../hooks/use-financial-reports';
import { ReportParameterForm } from '../components/report-parameter-form';
import { DimensionFilter } from '../components/DimensionFilter';
import type { DimensionFilterValue } from '../components/DimensionFilter';
import { DimensionGroupBy } from '../components/DimensionGroupBy';
import { SimulationToggle } from '../components/SimulationToggle';
import { ExportButtons } from '../components/ExportButtons';
import type { ReportParams, TrialBalanceRow } from '../types';

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_PARAMS: ReportParams = {
  fiscalYear: CURRENT_YEAR,
  periodFrom: 1,
  periodTo: 12,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Grouped TB types & hook
// ---------------------------------------------------------------------------

interface GroupedTbRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  columns: Record<string, number>;
  debit: number;
  credit: number;
  balance: number;
}

interface GroupedTbReport {
  columnHeaders: Array<{ id: string; code: string; name: string }>;
  rows: GroupedTbRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    columns: Record<string, number>;
  };
  generatedAt: string;
}

interface GroupedTbParams {
  fiscalYear: number;
  periodFrom: number;
  periodTo: number;
  dimensionTypeId: string;
  includeSimulations?: boolean;
}

function useGroupedTrialBalance(params: GroupedTbParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<GroupedTbReport>({
    queryKey: ['finance', 'trial-balance-grouped', params],
    queryFn: async () => {
      const qs = buildQueryString(params as unknown as Record<string, unknown>);
      const result = await apiGet<GroupedTbReport>(`/finance/reports/trial-balance${qs}`);
      return result.data;
    },
    enabled: isAuthenticated && !!params,
  });
}

// ---------------------------------------------------------------------------
// Grouped TB Renderer
// ---------------------------------------------------------------------------

function GroupedTrialBalanceView({ data }: { data: GroupedTbReport }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left font-medium text-muted-foreground">Account Code</th>
              <th className="py-2 text-left font-medium text-muted-foreground">Account Name</th>
              <th className="py-2 text-left font-medium text-muted-foreground">Type</th>
              {data.columnHeaders.map((col) => (
                <th key={col.id} className="py-2 text-right font-medium text-muted-foreground">
                  {col.name}
                </th>
              ))}
              <th className="py-2 text-right font-medium text-muted-foreground">Debit</th>
              <th className="py-2 text-right font-medium text-muted-foreground">Credit</th>
              <th className="py-2 text-right font-semibold text-muted-foreground">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.rows.map((row) => (
              <tr key={row.accountCode}>
                <td className="py-2 font-mono text-xs">{row.accountCode}</td>
                <td className="py-2">{row.accountName}</td>
                <td className="py-2 text-xs text-muted-foreground">{row.accountType}</td>
                {data.columnHeaders.map((col) => (
                  <td key={col.id} className="py-2 text-right font-mono tabular-nums">
                    {formatCurrency(row.columns[col.id] ?? 0)}
                  </td>
                ))}
                <td className="py-2 text-right font-mono tabular-nums">
                  {row.debit > 0 ? formatCurrency(row.debit) : '\u2014'}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {row.credit > 0 ? formatCurrency(row.credit) : '\u2014'}
                </td>
                <td className="py-2 text-right font-mono font-medium tabular-nums">
                  {formatCurrency(row.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td className="py-2" colSpan={3}>
                Total
              </td>
              {data.columnHeaders.map((col) => (
                <td key={col.id} className="py-2 text-right font-mono tabular-nums">
                  {formatCurrency(data.totals.columns[col.id] ?? 0)}
                </td>
              ))}
              <td className="py-2 text-right font-mono tabular-nums">
                {formatCurrency(data.totals.totalDebit)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {formatCurrency(data.totals.totalCredit)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">{'\u2014'}</td>
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

export function TrialBalancePage() {
  const [params, setParams] = useState<ReportParams>(DEFAULT_PARAMS);
  const [submittedParams, setSubmittedParams] = useState<ReportParams | null>(DEFAULT_PARAMS);
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilterValue>({
    dimensionTypeId: null,
    dimensionValueId: null,
  });
  const [groupByDimensionTypeId, setGroupByDimensionTypeId] = useState<string | null>(null);
  const [includeSimulations, setIncludeSimulations] = useState(false);

  // Submitted grouping state (only changes on "Run Report")
  const [submittedGroupBy, setSubmittedGroupBy] = useState<string | null>(null);

  // Standard TB query — only active when not grouped
  const {
    data: standardData,
    isFetching: standardFetching,
    refetch,
  } = useTrialBalance(submittedGroupBy === null ? submittedParams : null);

  // Grouped TB query — only active when grouped
  const { data: groupedData, isFetching: groupedFetching } = useGroupedTrialBalance(
    submittedGroupBy !== null && submittedParams
      ? {
          fiscalYear: submittedParams.fiscalYear,
          periodFrom: submittedParams.periodFrom,
          periodTo: submittedParams.periodTo,
          dimensionTypeId: submittedGroupBy,
          ...(includeSimulations ? { includeSimulations: true } : {}),
        }
      : null,
  );

  const isGrouped = submittedGroupBy !== null;
  const isFetching = isGrouped ? groupedFetching : standardFetching;
  const hasData = isGrouped ? !!groupedData : !!standardData;

  const handleRunReport = () => {
    const newParams: ReportParams = {
      ...params,
      ...(dimensionFilter.dimensionTypeId
        ? { dimensionTypeId: dimensionFilter.dimensionTypeId }
        : {}),
      ...(dimensionFilter.dimensionValueId
        ? { dimensionValueId: dimensionFilter.dimensionValueId }
        : {}),
      ...(includeSimulations ? { includeSimulations: true } : {}),
    };
    setSubmittedParams(newParams);
    setSubmittedGroupBy(groupByDimensionTypeId);
    if (groupByDimensionTypeId === null) {
      setTimeout(() => void refetch(), 50);
    }
  };

  const exportParams: Record<string, string | number | boolean> = {
    fiscalYear: params.fiscalYear,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    ...(includeSimulations ? { includeSimulations: true } : {}),
    ...(dimensionFilter.dimensionTypeId
      ? { dimensionTypeId: dimensionFilter.dimensionTypeId }
      : {}),
    ...(dimensionFilter.dimensionValueId
      ? { dimensionValueId: dimensionFilter.dimensionValueId }
      : {}),
    ...(groupByDimensionTypeId ? { groupByDimensionTypeId } : {}),
  };

  const columns = useMemo<ColumnDef<TrialBalanceRow>[]>(
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
        accessorKey: 'accountType',
        header: 'Type',
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'debit',
        header: 'Debit',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className="font-mono text-sm tabular-nums">
              {val > 0 ? formatCurrency(val) : '\u2014'}
            </span>
          );
        },
      },
      {
        accessorKey: 'credit',
        header: 'Credit',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className="font-mono text-sm tabular-nums">
              {val > 0 ? formatCurrency(val) : '\u2014'}
            </span>
          );
        },
      },
      {
        accessorKey: 'balance',
        header: 'Balance',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className="font-mono text-sm font-medium tabular-nums">
              {formatCurrency(val)}
            </span>
          );
        },
      },
    ],
    [],
  );

  const totals = standardData?.totals
    ? {
        accountCode: '',
        accountName: 'Total',
        accountType: '',
        debit: formatCurrency(standardData.totals.totalDebit),
        credit: formatCurrency(standardData.totals.totalCredit),
        balance: '',
      }
    : undefined;

  const parameterSlot = (
    <div className="space-y-4">
      <ReportParameterForm params={params} onChange={setParams} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
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
        exportPath="/finance/reports/trial-balance/export"
        params={exportParams}
        disabled={!hasData}
        variant="icon"
      />
    </div>
  );

  // Grouped view uses custom rendering; standard view uses ReportPage table
  if (isGrouped) {
    return (
      <ReportPage
        title="Trial Balance"
        subtitle={
          groupedData
            ? `Verify debits equal credits — grouped by ${groupedData.columnHeaders.length} dimension values`
            : 'Verify that debits equal credits across all accounts'
        }
        breadcrumbs={[
          { label: 'Finance', path: '/finance' },
          { label: 'Reports', path: '/finance/reports/trial-balance' },
          { label: 'Trial Balance' },
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
        {groupedData && <GroupedTrialBalanceView data={groupedData} />}
      </ReportPage>
    );
  }

  return (
    <ReportPage<TrialBalanceRow>
      title="Trial Balance"
      subtitle="Verify that debits equal credits across all accounts"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports', path: '/finance/reports/trial-balance' },
        { label: 'Trial Balance' },
      ]}
      parameterSlot={parameterSlot}
      hasResults={!!standardData}
      resultColumns={columns}
      resultData={standardData?.rows ?? []}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      totals={totals}
      actionBarSlot={actionBarSlot}
    />
  );
}
