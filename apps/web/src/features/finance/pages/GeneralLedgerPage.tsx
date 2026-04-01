/* eslint-disable i18next/no-literal-string */
/**
 * General Ledger Report Page — /finance/reports/general-ledger
 *
 * Multi-account general ledger. Shows each account with its entries
 * grouped in collapsible sections.
 * Uses T8 (ReportPage) template with custom result content.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/templates/report-page';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { useGeneralLedger } from '../hooks/use-enhanced-reports';
import { DimensionFilter } from '../components/DimensionFilter';
import type { DimensionFilterValue } from '../components/DimensionFilter';
import { SimulationToggle } from '../components/SimulationToggle';
import { ExportButtons } from '../components/ExportButtons';
import type { GeneralLedgerParams, GeneralLedgerAccount } from '../api/reports-enhanced-api';

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
// Account Section Component
// ---------------------------------------------------------------------------

function AccountSection({ account }: { account: GeneralLedgerAccount }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {account.accountCode}
                </span>
                <span>{account.accountName}</span>
              </CardTitle>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">
                  {account.entries.length} entries
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatCurrency(account.closingBalance)}
                </span>
                <ChevronDown
                  className={cn(
                    'size-4 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Opening balance */}
            <div className="flex items-center justify-between border-b py-2 text-sm text-muted-foreground">
              <span>Opening Balance</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(account.openingBalance)}
              </span>
            </div>

            {/* Entries */}
            <div className="divide-y">
              {account.entries.map((entry, idx) => (
                <div
                  key={`${entry.journalNumber}-${idx}`}
                  className="grid grid-cols-7 gap-2 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  <span className="font-mono text-xs">{entry.journalNumber}</span>
                  <span className="col-span-2 truncate">{entry.description}</span>
                  <span className="font-mono tabular-nums text-right">
                    {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                  </span>
                  <span className="font-mono tabular-nums text-right">
                    {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                  </span>
                  <span className="font-mono tabular-nums font-medium text-right">
                    {formatCurrency(entry.runningBalance)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-7 gap-2 border-t-2 py-2 text-sm font-semibold">
              <span className="col-span-4">Totals</span>
              <span className="font-mono tabular-nums text-right">
                {formatCurrency(account.totalDebit)}
              </span>
              <span className="font-mono tabular-nums text-right">
                {formatCurrency(account.totalCredit)}
              </span>
              <span className="font-mono tabular-nums text-right">
                {formatCurrency(account.closingBalance)}
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function GeneralLedgerPage() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [accountCodeFrom, setAccountCodeFrom] = useState('');
  const [accountCodeTo, setAccountCodeTo] = useState('');
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilterValue>({
    dimensionTypeId: null,
    dimensionValueId: null,
  });
  const [includeSimulations, setIncludeSimulations] = useState(false);
  const [submittedParams, setSubmittedParams] = useState<GeneralLedgerParams | null>(null);

  const { data, isFetching } = useGeneralLedger(submittedParams);

  // Auto-run support: when navigated from copilot with autoRun=true
  const autoRunTriggered = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoRun') === 'true' && !autoRunTriggered.current) {
      autoRunTriggered.current = true;

      const urlDateFrom = urlParams.get('dateFrom') || undefined;
      const urlDateTo = urlParams.get('dateTo') || undefined;
      const urlAccountCodeFrom = urlParams.get('accountCodeFrom') || undefined;
      const urlAccountCodeTo = urlParams.get('accountCodeTo') || undefined;
      const urlDimensionTypeId = urlParams.get('dimensionTypeId') || undefined;
      const urlDimensionValueId = urlParams.get('dimensionValueId') || undefined;
      const urlIncludeSimulations = urlParams.get('includeSimulations') === 'true';

      const effectiveDateFrom = urlDateFrom ?? dateFrom;
      const effectiveDateTo = urlDateTo ?? dateTo;

      if (urlDateFrom) setDateFrom(urlDateFrom);
      if (urlDateTo) setDateTo(urlDateTo);
      if (urlAccountCodeFrom) setAccountCodeFrom(urlAccountCodeFrom);
      if (urlAccountCodeTo) setAccountCodeTo(urlAccountCodeTo);
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
        ...(urlAccountCodeFrom ? { accountCodeFrom: urlAccountCodeFrom } : {}),
        ...(urlAccountCodeTo ? { accountCodeTo: urlAccountCodeTo } : {}),
        ...(urlDimensionTypeId ? { dimensionTypeId: urlDimensionTypeId } : {}),
        ...(urlDimensionValueId ? { dimensionValueId: urlDimensionValueId } : {}),
        ...(urlIncludeSimulations ? { includeSimulations: true } : {}),
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunReport = () => {
    setSubmittedParams({
      dateFrom,
      dateTo,
      ...(accountCodeFrom ? { accountCodeFrom } : {}),
      ...(accountCodeTo ? { accountCodeTo } : {}),
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
    dateFrom,
    dateTo,
    ...(accountCodeFrom ? { accountCodeFrom } : {}),
    ...(accountCodeTo ? { accountCodeTo } : {}),
    ...(includeSimulations ? { includeSimulations: true } : {}),
    ...(dimensionFilter.dimensionTypeId
      ? { dimensionTypeId: dimensionFilter.dimensionTypeId }
      : {}),
    ...(dimensionFilter.dimensionValueId
      ? { dimensionValueId: dimensionFilter.dimensionValueId }
      : {}),
  };

  const parameterSlot = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Date From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Date To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Account From (optional)</Label>
          <Input
            value={accountCodeFrom}
            onChange={(e) => setAccountCodeFrom(e.target.value)}
            placeholder="e.g. 1000"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>Account To (optional)</Label>
          <Input
            value={accountCodeTo}
            onChange={(e) => setAccountCodeTo(e.target.value)}
            placeholder="e.g. 9999"
            className="font-mono"
          />
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
        exportPath="/finance/reports/general-ledger/export"
        params={exportParams}
        disabled={!data}
        variant="icon"
      />
    </div>
  );

  const resultContent = data ? (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''} with activity
      </p>
      {data.accounts.map((account) => (
        <AccountSection key={account.accountCode} account={account} />
      ))}
    </div>
  ) : null;

  return (
    <ReportPage
      title="General Ledger"
      subtitle="Multi-account ledger with running balances"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports' },
        { label: 'General Ledger' },
      ]}
      parameterSlot={parameterSlot}
      hasResults={!!data}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      actionBarSlot={actionBarSlot}
    >
      {isFetching && !data && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {resultContent}
    </ReportPage>
  );
}
