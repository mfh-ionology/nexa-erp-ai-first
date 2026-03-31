/* eslint-disable i18next/no-literal-string */
/**
 * FE6: Trial Balance Report Page — /finance/reports/trial-balance
 *
 * Uses T8 (ReportPage) template with debit/credit columns.
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { ReportPage } from '@/components/templates/report-page';

import { useTrialBalance } from '../hooks/use-financial-reports';
import { ReportParameterForm } from '../components/report-parameter-form';
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

export function TrialBalancePage() {
  const [params, setParams] = useState<ReportParams>(DEFAULT_PARAMS);
  const [submittedParams, setSubmittedParams] = useState<ReportParams | null>(null);

  const { data, isFetching } = useTrialBalance(submittedParams);

  const handleRunReport = () => {
    setSubmittedParams({ ...params });
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

  const totals = data?.totals
    ? {
        accountCode: '',
        accountName: 'Total',
        accountType: '',
        debit: formatCurrency(data.totals.totalDebit),
        credit: formatCurrency(data.totals.totalCredit),
        balance: '',
      }
    : undefined;

  return (
    <ReportPage<TrialBalanceRow>
      title="Trial Balance"
      subtitle="Verify that debits equal credits across all accounts"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports', path: '/finance/reports/trial-balance' },
        { label: 'Trial Balance' },
      ]}
      parameterSlot={<ReportParameterForm params={params} onChange={setParams} />}
      hasResults={!!data}
      resultColumns={columns}
      resultData={data?.rows ?? []}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      totals={totals}
    />
  );
}
