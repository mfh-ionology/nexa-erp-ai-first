/* eslint-disable i18next/no-literal-string */
/**
 * FE12: Transaction Journal Report Page — /finance/reports/transaction-journal
 *
 * Uses T8 (ReportPage) template. Detailed posting log with date range filter.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { ReportPage } from '@/components/templates/report-page';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useTransactionJournal } from '../hooks/use-additional-reports';
import { DimensionFilter } from '../components/DimensionFilter';
import type { DimensionFilterValue } from '../components/DimensionFilter';
import { SimulationToggle } from '../components/SimulationToggle';
import { ExportButtons } from '../components/ExportButtons';
import type { TransactionJournalEntry, TransactionJournalParams } from '../types';

function formatCurrency(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: firstOfMonth.toISOString().split('T')[0]!,
    dateTo: now.toISOString().split('T')[0]!,
  };
}

export function TransactionJournalPage() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [submittedParams, setSubmittedParams] = useState<TransactionJournalParams | null>(null);
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilterValue>({
    dimensionTypeId: null,
    dimensionValueId: null,
  });
  const [includeSimulations, setIncludeSimulations] = useState(false);

  const { rows, totals, isFetching } = useTransactionJournal(submittedParams);

  // Auto-run support: when navigated from copilot with autoRun=true
  const autoRunTriggered = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoRun') === 'true' && !autoRunTriggered.current) {
      autoRunTriggered.current = true;

      const urlDateFrom = urlParams.get('dateFrom') || undefined;
      const urlDateTo = urlParams.get('dateTo') || undefined;
      const urlDimensionTypeId = urlParams.get('dimensionTypeId') || undefined;
      const urlDimensionValueId = urlParams.get('dimensionValueId') || undefined;
      const urlIncludeSimulations = urlParams.get('includeSimulations') === 'true';

      const effectiveDateFrom = urlDateFrom ?? dateFrom;
      const effectiveDateTo = urlDateTo ?? dateTo;

      if (urlDateFrom) setDateFrom(urlDateFrom);
      if (urlDateTo) setDateTo(urlDateTo);
      if (urlDimensionTypeId) {
        setDimensionFilter({
          dimensionTypeId: urlDimensionTypeId,
          dimensionValueId: urlDimensionValueId ?? null,
        });
      }
      if (urlIncludeSimulations) setIncludeSimulations(true);

      setSubmittedParams({
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunReport = () => {
    setSubmittedParams({ dateFrom, dateTo });
  };

  const exportParams: Record<string, string | number | boolean> = {
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

  const columns = useMemo<ColumnDef<TransactionJournalEntry>[]>(
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
        accessorKey: 'accountCode',
        header: 'Account',
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'accountName',
        header: 'Account Name',
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'debit',
        header: 'Debit',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'credit',
        header: 'Credit',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'reference',
        header: 'Reference',
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: 'Created By',
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
    ],
    [],
  );

  const parameterSlot = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        exportPath="/finance/reports/transaction-journal/export"
        params={exportParams}
        disabled={rows.length === 0}
        variant="icon"
      />
    </div>
  );

  return (
    <ReportPage<TransactionJournalEntry>
      title="Transaction Journal"
      subtitle="Detailed posting log of all journal entries"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports' },
        { label: 'Transaction Journal' },
      ]}
      parameterSlot={parameterSlot}
      hasResults={rows.length > 0}
      resultColumns={columns}
      resultData={rows}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      totals={totals ?? undefined}
      actionBarSlot={actionBarSlot}
    />
  );
}
