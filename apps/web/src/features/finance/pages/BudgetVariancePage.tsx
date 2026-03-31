/* eslint-disable i18next/no-literal-string */
/**
 * FE12: Budget Variance Report Page — /finance/reports/budget-variance
 *
 * Uses T8 (ReportPage) template. Budget vs actual with % variance.
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { ReportPage } from '@/components/templates/report-page';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useBudgets } from '../hooks/use-budgets';
import { useBudgetVarianceReport } from '../hooks/use-additional-reports';
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

export function BudgetVariancePage() {
  const { budgets } = useBudgets({ status: 'APPROVED' });
  const [budgetId, setBudgetId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(1);
  const [periodTo, setPeriodTo] = useState(12);
  const [submittedParams, setSubmittedParams] = useState<BudgetVarianceParams | null>(null);

  const { rows, totals, isFetching } = useBudgetVarianceReport(submittedParams);

  const handleRunReport = () => {
    if (!budgetId) return;
    setSubmittedParams({ budgetId, periodFrom, periodTo });
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
              {Number.isNaN(val) ? '—' : `${val > 0 ? '+' : ''}${val.toFixed(1)}%`}
            </span>
          );
        },
      },
    ],
    [],
  );

  const parameterSlot = (
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
  );

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
      hasResults={rows.length > 0}
      resultColumns={columns}
      resultData={rows}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      totals={totals ?? undefined}
    />
  );
}
