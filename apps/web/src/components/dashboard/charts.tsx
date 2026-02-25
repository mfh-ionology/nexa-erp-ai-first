/* eslint-disable i18next/no-literal-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-argument */
/**
 * Dashboard charts — Revenue & Payments bar chart + Cash Flow area chart.
 * Uses Recharts via shadcn/ui ChartContainer.
 * Visual design from v0 Concept D prototype.
 */

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  ReferenceLine,
  Dot,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

import { useI18n } from '@nexa/i18n';

/* ── Static data ────────────────────────────────────────────── */

const revenueData = [
  { month: 'Sep', revenue: 285000, payments: 260000 },
  { month: 'Oct', revenue: 298000, payments: 275000 },
  { month: 'Nov', revenue: 305000, payments: 290000 },
  { month: 'Dec', revenue: 320000, payments: 310000 },
  { month: 'Jan', revenue: 312800, payments: 298000 },
  { month: 'Feb', revenue: 347200, payments: 335000 },
];

const revenueConfig: ChartConfig = {
  revenue: { label: 'Revenue', color: '#7c3aed' },
  payments: { label: 'Payments Received', color: '#c4b5fd' },
};

const cashFlowData = [
  { week: 'W1', value: 94900 },
  { week: 'W2', value: 42700 },
  { week: 'W3', value: 61700 },
  { week: 'W4', value: 57700 },
  { week: 'W5', value: 54700 },
  { week: 'W6', value: 41200 },
  { week: 'W7', value: 62200 },
  { week: 'W8', value: 68200 },
];

const cashFlowConfig: ChartConfig = {
  value: { label: 'Cash Flow', color: '#7c3aed' },
};

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `\u00A3${Math.round(value / 1000)}k`;
  }
  return `\u00A3${value}`;
}

const CASH_FLOW_THRESHOLD = 40000;

function CashFlowDot(props: { cx?: number; cy?: number; payload?: { value: number } }) {
  const { cx, cy, payload } = props;
  // Infinity fallback: treat missing data as non-critical (show purple dot, not red)
  const isCritical = (payload?.value ?? Infinity) <= CASH_FLOW_THRESHOLD;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={4}
      fill={isCritical ? '#ef4444' : '#7c3aed'}
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

/* ── Revenue & Payments Chart ───────────────────────────────── */

export function RevenueChart() {
  const { t } = useI18n();

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '350ms' }}
    >
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        {t('dashboard.charts.revenuePayments')}
      </h3>
      <ChartContainer config={revenueConfig} className="h-[260px] w-full">
        <BarChart data={revenueData} barGap={4}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            width={55}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  const label =
                    name === 'revenue'
                      ? t('dashboard.charts.revenue')
                      : t('dashboard.charts.payments');
                  return (
                    <span>
                      {label}: {formatCurrency(Number(value))}
                    </span>
                  );
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="revenue"
            fill="var(--color-revenue)"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="payments"
            fill="var(--color-payments)"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

/* ── Cash Flow Forecast Chart ───────────────────────────────── */

export function CashFlowChart() {
  const { t } = useI18n();

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '400ms' }}
    >
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        {t('dashboard.charts.cashFlowForecast')}
      </h3>
      <ChartContainer config={cashFlowConfig} className="h-[260px] w-full">
        <AreaChart data={cashFlowData}>
          <defs>
            <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            width={55}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span>
                    {t('dashboard.charts.cash')}: {formatCurrency(Number(value))}
                  </span>
                )}
              />
            }
          />
          <ReferenceLine
            y={40000}
            stroke="#ef4444"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: t('dashboard.charts.safetyThreshold'),
              position: 'insideTopRight',
              fill: '#ef4444',
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#7c3aed"
            strokeWidth={2}
            fill="url(#cashGradient)"
            dot={<CashFlowDot />}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
