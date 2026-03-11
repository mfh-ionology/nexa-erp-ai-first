// ---------------------------------------------------------------------------
// AI Usage Overview — Cross-tenant dashboard
// Story E13b-4 Task 4.2 (AC#1)
// KPI cards, 30-day usage trend chart, top consumers table
// ---------------------------------------------------------------------------

import { useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Coins, Calendar, TrendingUp, Download, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

import { cn } from '@/lib/utils';
import { RequirePlatformRole } from '@/components/auth/require-platform-role';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/features/intelligence/components/kpi-card';

import { useAiUsageSummary, useExportAiUsageCsv } from '../hooks/use-ai-usage';
import type { DailyTrendItem, TopConsumer } from '../hooks/use-ai-usage';

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-GB');
}

function formatGbp(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: DailyTrendItem }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  if (!first) return null;
  const item = first.payload;

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatTokens(item.tokens)} tokens</p>
      <p className="text-xs text-muted-foreground">{formatGbp(item.cost)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top consumers table
// ---------------------------------------------------------------------------

function TopConsumersTable({ consumers }: { consumers: TopConsumer[] }) {
  if (consumers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No usage data available yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 pr-4 font-medium text-muted-foreground">#</th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">Tenant</th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">Code</th>
            <th className="pb-2 text-right font-medium text-muted-foreground">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {consumers.slice(0, 10).map((consumer, idx) => (
            <tr
              key={consumer.tenantId}
              className="border-b border-border/50 transition-colors hover:bg-muted/30"
            >
              <td className="py-2.5 pr-4 text-muted-foreground">{idx + 1}</td>
              <td className="py-2.5 pr-4">
                <Link
                  to="/tenants/$tenantId"
                  params={{ tenantId: consumer.tenantId }}
                  className="font-medium text-primary hover:text-[var(--primary-dark)] hover:underline"
                >
                  {consumer.tenantName}
                </Link>
              </td>
              <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                {consumer.tenantCode}
              </td>
              <td className="py-2.5 text-right font-mono font-medium">
                {formatTokens(consumer.tokens)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export Button
// ---------------------------------------------------------------------------

function CsvExportButton() {
  const exportMutation = useExportAiUsageCsv();
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleExport = () => {
    exportMutation.mutate({ startDate, endDate });
    setShowDatePicker(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDatePicker(!showDatePicker)}
        disabled={exportMutation.isPending}
      >
        {exportMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export CSV
      </Button>

      {showDatePicker && (
        <div className="absolute right-0 top-full z-20 mt-2 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleExport} disabled={exportMutation.isPending}>
                {exportMutation.isPending ? 'Exporting…' : 'Download'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDatePicker(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Overview Component
// ---------------------------------------------------------------------------

export function AiUsageOverview() {
  const { data: summary, isLoading, error, refetch } = useAiUsageSummary();
  const gradientId = useId();

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Usage Overview</h2>
        <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
          <CsvExportButton />
        </RequirePlatformRole>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Usage KPIs">
        <KpiCard
          label="Tokens Today"
          value={summary?.tokensToday ?? null}
          icon={Coins}
          isLoading={isLoading}
          error={error ?? undefined}
          onRetry={() => void refetch()}
          className="animate-fade-in-up"
        />
        <KpiCard
          label="Tokens This Month"
          value={summary?.tokensThisMonth ?? null}
          icon={Calendar}
          isLoading={isLoading}
          error={error ?? undefined}
          onRetry={() => void refetch()}
          className="animate-fade-in-up delay-1"
        />
        <KpiCard
          label="Cost Estimate (Month)"
          value={summary ? formatGbp(summary.costEstimateThisMonth) : null}
          icon={TrendingUp}
          isLoading={isLoading}
          error={error ?? undefined}
          onRetry={() => void refetch()}
          className="animate-fade-in-up delay-2"
        />
      </section>

      {/* Daily Usage Chart */}
      <section
        className={cn(
          'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
          'animate-fade-in-up delay-2',
        )}
        aria-label="Daily usage trend"
      >
        <h3 className="mb-4 text-sm font-semibold text-foreground">Daily Token Usage (30 days)</h3>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-destructive">
            <p className="text-sm">Failed to load chart data</p>
            <Button variant="ghost" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={summary?.dailyTrend ?? []}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val: number) => formatTokens(val)}
                width={60}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#7c3aed"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Top Consumers Table */}
      <section
        className={cn(
          'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
          'animate-fade-in-up delay-3',
        )}
        aria-label="Top consumers"
      >
        <h3 className="mb-4 text-sm font-semibold text-foreground">Top Consumers (This Period)</h3>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-destructive">
            <p className="text-sm">Failed to load</p>
            <Button variant="ghost" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <TopConsumersTable consumers={summary?.topConsumers ?? []} />
        )}
      </section>
    </div>
  );
}
