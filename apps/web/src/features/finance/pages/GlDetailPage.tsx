/* eslint-disable i18next/no-literal-string */
/**
 * GL Detail Report Page — /finance/reports/gl-detail
 *
 * Single account activity with running balance.
 * Uses T8 (ReportPage) template.
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { ReportPage } from '@/components/templates/report-page';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useGlDetail } from '../hooks/use-enhanced-reports';
import { DimensionFilter } from '../components/DimensionFilter';
import type { DimensionFilterValue } from '../components/DimensionFilter';
import { SimulationToggle } from '../components/SimulationToggle';
import { ExportButtons } from '../components/ExportButtons';
import { GlAccountPicker } from '../components/gl-account-picker';
import type { GlDetailRow, GlDetailParams } from '../api/reports-enhanced-api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const firstOfYear = new Date(now.getFullYear(), 0, 1);
  return {
    dateFrom: firstOfYear.toISOString().split('T')[0]!,
    dateTo: now.toISOString().split('T')[0]!,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlDetailPage() {
  const defaults = getDefaultDateRange();
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilterValue>({
    dimensionTypeId: null,
    dimensionValueId: null,
  });
  const [includeSimulations, setIncludeSimulations] = useState(false);
  const [submittedParams, setSubmittedParams] = useState<GlDetailParams | null>(null);

  const { data, isFetching } = useGlDetail(submittedParams);

  const handleRunReport = () => {
    if (!accountId) return;
    setSubmittedParams({
      accountId,
      dateFrom,
      dateTo,
      ...(dimensionFilter.dimensionTypeId
        ? { dimensionTypeId: dimensionFilter.dimensionTypeId }
        : {}),
      ...(dimensionFilter.dimensionValueId
        ? { dimensionValueId: dimensionFilter.dimensionValueId }
        : {}),
      ...(includeSimulations ? { includeSimulations: true } : {}),
    });
  };

  const exportParams: Record<string, string | number | boolean> = {
    ...(accountId ? { accountId } : {}),
    dateFrom,
    dateTo,
    ...(includeSimulations ? { includeSimulations: true } : {}),
    ...(dimensionFilter.dimensionTypeId
      ? { dimensionTypeId: dimensionFilter.dimensionTypeId }
      : {}),
    ...(dimensionFilter.dimensionValueId
      ? { dimensionValueId: dimensionFilter.dimensionValueId }
      : {}),
  };

  const columns = useMemo<ColumnDef<GlDetailRow>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ getValue }) =>
          new Date(getValue<string>()).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
      },
      {
        accessorKey: 'journalNumber',
        header: 'Journal #',
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'description',
        header: 'Description',
      },
      {
        accessorKey: 'reference',
        header: 'Reference',
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
        ),
      },
      {
        accessorKey: 'debit',
        header: 'Debit',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className="font-mono text-sm tabular-nums">
              {val > 0 ? formatCurrency(val) : '—'}
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
              {val > 0 ? formatCurrency(val) : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'runningBalance',
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

  const totals = data
    ? {
        date: '',
        journalNumber: '',
        description: 'Total',
        reference: '',
        debit: formatCurrency(data.totalDebit),
        credit: formatCurrency(data.totalCredit),
        runningBalance: formatCurrency(data.closingBalance),
      }
    : undefined;

  const parameterSlot = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Account</Label>
          <GlAccountPicker value={accountId || null} onChange={(id) => setAccountId(id ?? '')} />
        </div>
        <div className="space-y-2">
          <Label>Date From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Date To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
        <DimensionFilter value={dimensionFilter} onChange={setDimensionFilter} />
        <SimulationToggle checked={includeSimulations} onChange={setIncludeSimulations} />
      </div>
    </div>
  );

  const actionBarSlot = (
    <div className="flex items-center gap-2">
      <ExportButtons
        exportPath="/finance/reports/gl-detail/export"
        params={exportParams}
        disabled={!data}
        variant="icon"
      />
    </div>
  );

  // Summary bar for opening/closing balance
  const summarySlot = data ? (
    <div className="flex items-center gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
      <div>
        <span className="text-muted-foreground">Account: </span>
        <span className="font-mono font-medium">{data.accountCode}</span>
        <span className="ml-2">{data.accountName}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Opening: </span>
        <span className="font-mono font-medium tabular-nums">
          {formatCurrency(data.openingBalance)}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Closing: </span>
        <span className="font-mono font-semibold tabular-nums">
          {formatCurrency(data.closingBalance)}
        </span>
      </div>
    </div>
  ) : null;

  return (
    <ReportPage<GlDetailRow>
      title="GL Detail"
      subtitle="Single account activity with running balance"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports' },
        { label: 'GL Detail' },
      ]}
      parameterSlot={parameterSlot}
      hasResults={!!data}
      resultColumns={columns}
      resultData={data?.rows ?? []}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      totals={totals}
      actionBarSlot={actionBarSlot}
    >
      {summarySlot}
    </ReportPage>
  );
}
