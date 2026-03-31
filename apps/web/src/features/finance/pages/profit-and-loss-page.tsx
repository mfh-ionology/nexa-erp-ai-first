/* eslint-disable i18next/no-literal-string */
/**
 * FE6: Profit and Loss Report Page — /finance/reports/profit-and-loss
 *
 * Uses T8 (ReportPage) template with sectioned layout
 * (Revenue, COGS, OPEX, Other Income/Expenses) and subtotals.
 */

import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/templates/report-page';

import { useProfitAndLoss } from '../hooks/use-financial-reports';
import { ReportParameterForm } from '../components/report-parameter-form';
import type { ReportParams, ReportSection } from '../types';

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
// Report Section Renderer
// ---------------------------------------------------------------------------

function ReportSectionCard({ section, label }: { section: ReportSection; label: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {section.rows.map((row) => (
            <div key={row.accountCode} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{row.accountCode}</span>
                <span className="text-sm">{row.accountName}</span>
              </div>
              <span className="font-mono text-sm tabular-nums">{formatCurrency(row.amount)}</span>
            </div>
          ))}
          {/* Subtotal */}
          <div className="flex items-center justify-between py-2 font-semibold">
            <span className="text-sm">Total {label}</span>
            <span className="font-mono text-sm tabular-nums">
              {formatCurrency(section.subtotal)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Summary Line
// ---------------------------------------------------------------------------

function SummaryLine({
  label,
  value,
  isBold = false,
  isNegative = false,
}: {
  label: string;
  value: number;
  isBold?: boolean;
  isNegative?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b py-3 ${
        isBold ? 'font-bold text-base' : 'text-sm'
      }`}
    >
      <span>{label}</span>
      <span
        className={`font-mono tabular-nums ${isNegative && value < 0 ? 'text-destructive' : ''}`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function ProfitAndLossPage() {
  const [params, setParams] = useState<ReportParams>(DEFAULT_PARAMS);
  const [submittedParams, setSubmittedParams] = useState<ReportParams | null>(null);

  const { data, isFetching } = useProfitAndLoss(submittedParams);

  const handleRunReport = () => {
    setSubmittedParams({ ...params });
  };

  // Custom result rendering (no table — sectioned layout)
  const resultContent = data ? (
    <div className="space-y-4">
      {/* Revenue */}
      <ReportSectionCard section={data.revenue} label="Revenue" />

      {/* Cost of Goods Sold */}
      <ReportSectionCard section={data.costOfGoodsSold} label="Cost of Goods Sold" />

      {/* Gross Profit */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <SummaryLine label="Gross Profit" value={data.grossProfit} isBold />
        </CardContent>
      </Card>

      {/* Operating Expenses */}
      <ReportSectionCard section={data.operatingExpenses} label="Operating Expenses" />

      {/* Operating Profit */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <SummaryLine label="Operating Profit" value={data.operatingProfit} isBold />
        </CardContent>
      </Card>

      {/* Other Income */}
      {data.otherIncome.rows.length > 0 && (
        <ReportSectionCard section={data.otherIncome} label="Other Income" />
      )}

      {/* Other Expenses */}
      {data.otherExpenses.rows.length > 0 && (
        <ReportSectionCard section={data.otherExpenses} label="Other Expenses" />
      )}

      {/* Net Profit */}
      <Card className="border-2 border-primary/40 bg-primary/10">
        <CardContent className="py-4">
          <SummaryLine label="Net Profit" value={data.netProfit} isBold isNegative />
        </CardContent>
      </Card>
    </div>
  ) : null;

  return (
    <ReportPage
      title="Profit and Loss"
      subtitle="Income statement for the selected period"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports', path: '/finance/reports/trial-balance' },
        { label: 'Profit & Loss' },
      ]}
      parameterSlot={<ReportParameterForm params={params} onChange={setParams} />}
      hasResults={!!data}
      onRunReport={handleRunReport}
      isRunning={isFetching}
    >
      {/* Custom sectioned content instead of table */}
      {isFetching && !data && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {resultContent}
    </ReportPage>
  );
}
