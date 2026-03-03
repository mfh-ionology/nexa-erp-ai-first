'use client';

import React from 'react';

const sparklineData: Record<string, number[]> = {
  revenue: [30, 35, 32, 40, 38, 50],
  ar: [20, 22, 25, 30, 35, 42],
  cash: [50, 45, 42, 38, 35, 30],
  overdue: [2, 3, 3, 4, 4, 7],
  pipeline: [30, 32, 35, 38, 42, 48],
  margin: [38, 37, 36, 35, 35, 34],
};

function Sparkline({ dataKey, color }: { dataKey: string; color: string }) {
  const data = sparklineData[dataKey] || [30, 35, 32, 40, 38, 50];
  const width = 120;
  const height = 24;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-2"
      role="img"
      aria-label="Trend sparkline"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

interface KpiData {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  trendNeutral?: boolean;
  comparison: string;
  iconBg: string;
  iconColor: string;
  sparklineColor: string;
  sparklineKey: string;
  icon: React.ReactNode;
}

const kpis: KpiData[] = [
  {
    id: 'revenue',
    label: 'REVENUE',
    value: '\u00A3347,200',
    trend: '+11.0%',
    trendUp: true,
    comparison: 'vs \u00A3312,800 last month',
    iconBg: '#ede9fe',
    iconColor: '#7c3aed',
    sparklineColor: '#7c3aed',
    sparklineKey: 'revenue',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2v16M6 6l4-4 4 4M4 18h12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'ar',
    label: 'OUTSTANDING AR',
    value: '\u00A3127,400',
    trend: '+29.7%',
    trendUp: false,
    comparison: 'vs \u00A398,200 last month',
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
    sparklineColor: '#ef4444',
    sparklineKey: 'ar',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'cash',
    label: 'CASH POSITION',
    value: '\u00A389,300',
    trend: '-12.9%',
    trendUp: false,
    trendNeutral: true,
    comparison: 'vs \u00A3102,500 last month',
    iconBg: '#dbeafe',
    iconColor: '#3b82f6',
    sparklineColor: '#f59e0b',
    sparklineKey: 'cash',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6v8M8 8h4M8 12h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'overdue',
    label: 'OVERDUE INVOICES',
    value: '7',
    trend: '+75%',
    trendUp: false,
    comparison: 'vs 4 last month',
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
    sparklineColor: '#ef4444',
    sparklineKey: 'overdue',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2l8 14H2L10 2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M10 8v3M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'pipeline',
    label: 'PIPELINE VALUE',
    value: '\u00A3215,000',
    trend: '+14.4%',
    trendUp: true,
    comparison: 'vs \u00A3187,900 last month',
    iconBg: '#ede9fe',
    iconColor: '#7c3aed',
    sparklineColor: '#10b981',
    sparklineKey: 'pipeline',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 4h12l-4 5v5l-4 2V9L4 4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'margin',
    label: 'GROSS MARGIN',
    value: '34.2%',
    trend: '-2.6pp',
    trendUp: false,
    trendNeutral: true,
    comparison: 'vs 36.8% last month',
    iconBg: '#fef3c7',
    iconColor: '#f59e0b',
    sparklineColor: '#f59e0b',
    sparklineKey: 'margin',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6v4l3 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi, index) => (
        <div
          key={kpi.id}
          className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: kpi.iconBg, color: kpi.iconColor }}
              >
                {kpi.icon}
              </div>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                {kpi.label}
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                kpi.trendUp
                  ? 'bg-[#d1fae5] text-[#065f46]'
                  : kpi.trendNeutral
                    ? 'bg-[#fef3c7] text-[#d97706]'
                    : 'bg-[#fee2e2] text-[#991b1b]'
              }`}
            >
              {kpi.trend}
            </span>
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {kpi.value}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{kpi.comparison}</p>
          <Sparkline dataKey={kpi.sparklineKey} color={kpi.sparklineColor} />
        </div>
      ))}
    </div>
  );
}
