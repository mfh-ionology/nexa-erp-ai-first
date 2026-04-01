/* eslint-disable i18next/no-literal-string */
/**
 * FE6: Profit and Loss Report Page — /finance/reports/profit-and-loss
 *
 * Uses T8 (ReportPage) template with sectioned layout
 * (Revenue, COGS, OPEX, Other Income/Expenses) and subtotals.
 *
 * When a dimension type is selected via "Group by Dimension", the page
 * switches to a pivoted departmental P&L view with columns per dimension value.
 */

import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/templates/report-page';

import { useProfitAndLoss } from '../hooks/use-financial-reports';
import { useDepartmentalPnl } from '../hooks/use-enhanced-reports';
import { ReportParameterForm } from '../components/report-parameter-form';
import { DimensionFilter } from '../components/DimensionFilter';
import type { DimensionFilterValue } from '../components/DimensionFilter';
import { DimensionGroupBy } from '../components/DimensionGroupBy';
import { SimulationToggle } from '../components/SimulationToggle';
import { ExportButtons } from '../components/ExportButtons';
import type { ReportParams, ReportSection } from '../types';
import type { DepartmentalPnlReport } from '../api/reports-enhanced-api';

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
// Standard P&L — Report Section Renderer
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
// Grouped (Departmental) P&L Renderer
// ---------------------------------------------------------------------------

function GroupedPnlView({ data }: { data: DepartmentalPnlReport }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Grouped by {data.dimensionTypeName} — {data.columnHeaders.length} columns
      </p>

      {data.sections.map((section) => (
        <Card key={section.sectionName}>
          <CardContent className="pt-4">
            <h3 className="mb-3 text-sm font-semibold">{section.sectionName}</h3>
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
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function ProfitAndLossPage() {
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

  // Standard P&L query — only active when not grouped
  const {
    data: standardData,
    isFetching: standardFetching,
    refetch: refetchStandard,
  } = useProfitAndLoss(submittedGroupBy === null ? submittedParams : null);

  // Departmental P&L query — only active when grouped
  const { data: groupedData, isFetching: groupedFetching } = useDepartmentalPnl(
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
    const newParams = { ...params };
    setSubmittedParams(newParams);
    setSubmittedGroupBy(groupByDimensionTypeId);
    if (groupByDimensionTypeId === null) {
      // Force refetch for standard P&L even if params haven't changed
      setTimeout(() => void refetchStandard(), 50);
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

  // Standard P&L result content
  const standardResultContent = standardData ? (
    <div className="space-y-4">
      {/* Revenue */}
      <ReportSectionCard section={standardData.revenue} label="Revenue" />

      {/* Cost of Goods Sold */}
      <ReportSectionCard section={standardData.costOfGoodsSold} label="Cost of Goods Sold" />

      {/* Gross Profit */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <SummaryLine label="Gross Profit" value={standardData.grossProfit} isBold />
        </CardContent>
      </Card>

      {/* Operating Expenses */}
      <ReportSectionCard section={standardData.operatingExpenses} label="Operating Expenses" />

      {/* Operating Profit */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <SummaryLine label="Operating Profit" value={standardData.operatingProfit} isBold />
        </CardContent>
      </Card>

      {/* Other Income */}
      {standardData.otherIncome.rows.length > 0 && (
        <ReportSectionCard section={standardData.otherIncome} label="Other Income" />
      )}

      {/* Other Expenses */}
      {standardData.otherExpenses.rows.length > 0 && (
        <ReportSectionCard section={standardData.otherExpenses} label="Other Expenses" />
      )}

      {/* Net Profit */}
      <Card className="border-2 border-primary/40 bg-primary/10">
        <CardContent className="py-4">
          <SummaryLine label="Net Profit" value={standardData.netProfit} isBold isNegative />
        </CardContent>
      </Card>
    </div>
  ) : null;

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
        exportPath={
          isGrouped
            ? '/finance/reports/departmental-pnl/export'
            : '/finance/reports/profit-and-loss/export'
        }
        params={exportParams}
        disabled={!hasData}
        variant="icon"
      />
    </div>
  );

  return (
    <ReportPage
      title="Profit and Loss"
      subtitle={
        isGrouped && groupedData
          ? `Income statement grouped by ${groupedData.dimensionTypeName}`
          : 'Income statement for the selected period'
      }
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Reports', path: '/finance/reports/trial-balance' },
        { label: 'Profit & Loss' },
      ]}
      parameterSlot={parameterSlot}
      hasResults={hasData}
      onRunReport={handleRunReport}
      isRunning={isFetching}
      actionBarSlot={actionBarSlot}
    >
      {/* Loading skeleton */}
      {isFetching && !hasData && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {/* Grouped (departmental) view */}
      {isGrouped && groupedData && <GroupedPnlView data={groupedData} />}

      {/* Standard view */}
      {!isGrouped && standardResultContent}
    </ReportPage>
  );
}
