/* eslint-disable i18next/no-literal-string */
/**
 * FE6: Balance Sheet Report Page — /finance/reports/balance-sheet
 *
 * Uses T8 (ReportPage) template with sectioned layout
 * (Assets, Liabilities, Equity) with totals.
 */

import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/templates/report-page';

import { useBalanceSheet } from '../hooks/use-financial-reports';
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
// Section Renderer
// ---------------------------------------------------------------------------

function SectionRows({ section, label }: { section: ReportSection; label: string }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
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
        <div className="flex items-center justify-between py-2 font-semibold">
          <span className="text-sm">Total {label}</span>
          <span className="font-mono text-sm tabular-nums">{formatCurrency(section.subtotal)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Total Line
// ---------------------------------------------------------------------------

function TotalLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3 text-base font-bold">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function BalanceSheetPage() {
  const [params, setParams] = useState<ReportParams>(DEFAULT_PARAMS);
  const [submittedParams, setSubmittedParams] = useState<ReportParams | null>(DEFAULT_PARAMS);

  const { data, isFetching, refetch } = useBalanceSheet(submittedParams);

  const handleRunReport = () => {
    const newParams = { ...params };
    setSubmittedParams(newParams);
    setTimeout(() => void refetch(), 50);
  };

  const resultContent = data ? (
    <div className="space-y-6">
      {/* Assets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <SectionRows section={data.assets.currentAssets} label="Current Assets" />
          <Separator />
          <SectionRows section={data.assets.fixedAssets} label="Fixed Assets" />
          <Separator />
          <TotalLine label="Total Assets" value={data.assets.totalAssets} />
        </CardContent>
      </Card>

      {/* Liabilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Liabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <SectionRows section={data.liabilities.currentLiabilities} label="Current Liabilities" />
          <Separator />
          <SectionRows
            section={data.liabilities.longTermLiabilities}
            label="Long-term Liabilities"
          />
          <Separator />
          <TotalLine label="Total Liabilities" value={data.liabilities.totalLiabilities} />
        </CardContent>
      </Card>

      {/* Equity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Equity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SectionRows section={data.equity} label="Equity" />
        </CardContent>
      </Card>

      {/* Balance check */}
      <Card className="border-2 border-primary/40 bg-primary/10">
        <CardContent className="py-4">
          <TotalLine label="Total Liabilities & Equity" value={data.totalLiabilitiesAndEquity} />
          {/* Show balance check */}
          {Math.abs(data.assets.totalAssets - data.totalLiabilitiesAndEquity) > 0.01 && (
            <p className="mt-2 text-sm text-destructive font-medium">
              Warning: Assets do not equal Liabilities + Equity. Difference:{' '}
              {formatCurrency(data.assets.totalAssets - data.totalLiabilitiesAndEquity)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  ) : null;

  return (
    <ReportPage
      title="Balance Sheet"
      subtitle="Statement of financial position at period end"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports', path: '/finance/reports/trial-balance' },
        { label: 'Balance Sheet' },
      ]}
      parameterSlot={<ReportParameterForm params={params} onChange={setParams} />}
      hasResults={!!data}
      onRunReport={handleRunReport}
      isRunning={isFetching}
    >
      {isFetching && !data && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {resultContent}
    </ReportPage>
  );
}
