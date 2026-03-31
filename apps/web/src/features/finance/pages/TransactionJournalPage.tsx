/* eslint-disable i18next/no-literal-string */
/**
 * FE12: Transaction Journal Report Page — /finance/reports/transaction-journal
 *
 * Uses T8 (ReportPage) template. Detailed posting log with date range filter.
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { ReportPage } from '@/components/templates/report-page';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useTransactionJournal } from '../hooks/use-additional-reports';
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

  const { rows, totals, isFetching } = useTransactionJournal(submittedParams);

  const handleRunReport = () => {
    setSubmittedParams({ dateFrom, dateTo });
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
    />
  );
}
