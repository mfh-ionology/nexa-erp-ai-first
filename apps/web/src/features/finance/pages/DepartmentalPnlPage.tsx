/* eslint-disable i18next/no-literal-string */
/**
 * Departmental P&L Report Page — /finance/reports/departmental-pnl
 *
 * P&L with columns by dimension value. Requires a dimension type to be selected.
 * Uses T8 (ReportPage) template with custom table rendering.
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/templates/report-page';
import { apiGet } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

import { useDepartmentalPnl } from '../hooks/use-enhanced-reports';
import { ReportParameterForm } from '../components/report-parameter-form';
import { SimulationToggle } from '../components/SimulationToggle';
import { ExportButtons } from '../components/ExportButtons';
import type { ReportParams } from '../types';
import type { DepartmentalPnlParams } from '../api/reports-enhanced-api';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface DimensionType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_PARAMS: ReportParams = {
  fiscalYear: CURRENT_YEAR,
  periodFrom: 1,
  periodTo: 12,
};

// ---------------------------------------------------------------------------
// Hook for dimension types
// ---------------------------------------------------------------------------

function useDimensionTypes() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['finance', 'dimension-types', 'active'],
    queryFn: async () => {
      const result = await apiGet<{ data: DimensionType[] }>(
        '/finance/dimensions/types?isActive=true',
      );
      return result.data.data ?? result.data;
    },
    enabled: isAuthenticated,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepartmentalPnlPage() {
  const [params, setParams] = useState<ReportParams>(DEFAULT_PARAMS);
  const [dimensionTypeId, setDimensionTypeId] = useState('');
  const [includeSimulations, setIncludeSimulations] = useState(false);
  const [submittedParams, setSubmittedParams] = useState<DepartmentalPnlParams | null>(null);

  const { data: types } = useDimensionTypes();
  const dimensionTypes = Array.isArray(types) ? types : [];

  const { data, isFetching } = useDepartmentalPnl(submittedParams);

  // Auto-run support: when navigated from copilot with autoRun=true
  const autoRunTriggered = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoRun') === 'true' && !autoRunTriggered.current) {
      autoRunTriggered.current = true;

      const urlFiscalYear = urlParams.get('fiscalYear')
        ? Number(urlParams.get('fiscalYear'))
        : undefined;
      const urlPeriodFrom = urlParams.get('periodFrom')
        ? Number(urlParams.get('periodFrom'))
        : undefined;
      const urlPeriodTo = urlParams.get('periodTo') ? Number(urlParams.get('periodTo')) : undefined;
      const urlDimensionTypeId = urlParams.get('dimensionTypeId') || undefined;
      const urlIncludeSimulations = urlParams.get('includeSimulations') === 'true';

      if (urlFiscalYear && urlDimensionTypeId) {
        setParams({
          fiscalYear: urlFiscalYear,
          periodFrom: urlPeriodFrom ?? 1,
          periodTo: urlPeriodTo ?? 12,
        });
        setDimensionTypeId(urlDimensionTypeId);
        if (urlIncludeSimulations) setIncludeSimulations(true);
        setSubmittedParams({
          fiscalYear: urlFiscalYear,
          periodFrom: urlPeriodFrom ?? 1,
          periodTo: urlPeriodTo ?? 12,
          dimensionTypeId: urlDimensionTypeId,
          ...(urlIncludeSimulations ? { includeSimulations: true } : {}),
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunReport = () => {
    if (!dimensionTypeId) return;
    setSubmittedParams({
      fiscalYear: params.fiscalYear,
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
      dimensionTypeId,
      ...(includeSimulations ? { includeSimulations: true } : {}),
    });
  };

  const exportParams: Record<string, string | number | boolean> = {
    fiscalYear: params.fiscalYear,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    ...(dimensionTypeId ? { dimensionTypeId } : {}),
    ...(includeSimulations ? { includeSimulations: true } : {}),
  };

  const parameterSlot = (
    <div className="space-y-4">
      <ReportParameterForm params={params} onChange={setParams} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
        <div className="space-y-2">
          <Label>Dimension Type</Label>
          <Select value={dimensionTypeId} onValueChange={setDimensionTypeId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a dimension type..." />
            </SelectTrigger>
            <SelectContent>
              {dimensionTypes.map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>
                  {dt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SimulationToggle checked={includeSimulations} onChange={setIncludeSimulations} />
      </div>
    </div>
  );

  const actionBarSlot = (
    <div className="flex items-center gap-2">
      <ExportButtons
        exportPath="/finance/reports/departmental-pnl/export"
        params={exportParams}
        disabled={!data}
        variant="icon"
      />
    </div>
  );

  // Custom table rendering with dynamic columns
  const resultContent = data ? (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        P&L by {data.dimensionTypeName} — {data.columnHeaders.length} columns
      </p>

      {data.sections.map((section) => (
        <Card key={section.sectionName}>
          <CardContent className="pt-4">
            <h3 className="mb-3 text-sm font-semibold">{section.sectionName}</h3>
            {/* Header row */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium text-muted-foreground">Account</th>
                    {data.columnHeaders.map((col) => (
                      <th
                        key={col.id}
                        className="py-2 text-right font-medium text-muted-foreground"
                      >
                        {col.name}
                      </th>
                    ))}
                    <th className="py-2 text-right font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {section.rows.map((row) => (
                    <tr key={row.accountCode}>
                      <td className="py-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.accountCode}
                        </span>
                        <span className="ml-2">{row.accountName}</span>
                      </td>
                      {data.columnHeaders.map((col) => (
                        <td key={col.id} className="py-2 text-right font-mono tabular-nums">
                          {formatCurrency(row.columns[col.id] ?? 0)}
                        </td>
                      ))}
                      <td className="py-2 text-right font-mono font-medium tabular-nums">
                        {formatCurrency(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2">Total {section.sectionName}</td>
                    {data.columnHeaders.map((col) => (
                      <td key={col.id} className="py-2 text-right font-mono tabular-nums">
                        {formatCurrency(section.subtotals[col.id] ?? 0)}
                      </td>
                    ))}
                    <td className="py-2 text-right font-mono tabular-nums">
                      {formatCurrency(section.subtotalTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Grand totals */}
      <Card className="border-2 border-primary/40 bg-primary/10">
        <CardContent className="py-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-semibold">
              <tbody>
                <tr>
                  <td className="py-2">Net Profit / (Loss)</td>
                  {data.columnHeaders.map((col) => (
                    <td key={col.id} className="py-2 text-right font-mono tabular-nums">
                      {formatCurrency(data.grandTotals[col.id] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2 text-right font-mono tabular-nums">
                    {formatCurrency(data.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  ) : null;

  return (
    <ReportPage
      title="Departmental P&L"
      subtitle="Profit and Loss statement with columns by dimension"
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports' },
        { label: 'Departmental P&L' },
      ]}
      parameterSlot={parameterSlot}
      hasResults={!!data}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      actionBarSlot={actionBarSlot}
    >
      {isFetching && !data && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {resultContent}
    </ReportPage>
  );
}
