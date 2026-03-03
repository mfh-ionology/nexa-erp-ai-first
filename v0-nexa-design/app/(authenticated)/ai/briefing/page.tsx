'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BriefingActionCard } from '@/components/ai/briefing-action-card';
import {
  RefreshCw,
  AlertTriangle,
  Banknote,
  TrendingUp,
  ClipboardList,
  Sparkles,
} from 'lucide-react';

/* ── Sparkline (reusable mini chart) ── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120;
  const h = 24;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
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
        points={pts}
      />
    </svg>
  );
}

/* ── Summary metrics data ── */
const metrics = [
  {
    label: 'REVENUE',
    value: '\u00A3347,200',
    trend: '+11%',
    trendUp: true,
    sparkline: [30, 35, 32, 40, 38, 50],
    color: '#7c3aed',
    iconBg: '#ede9fe',
  },
  {
    label: 'CASH POSITION',
    value: '\u00A3128,400',
    trend: '-12%',
    trendUp: false,
    sparkline: [50, 45, 42, 38, 35, 30],
    color: '#f59e0b',
    iconBg: '#fef3c7',
  },
  {
    label: 'OVERDUE',
    value: '7',
    trend: '+3',
    trendUp: false,
    sparkline: [2, 3, 3, 4, 4, 7],
    color: '#ef4444',
    iconBg: '#fee2e2',
  },
  {
    label: 'PIPELINE',
    value: '\u00A3215,000',
    trend: '+14%',
    trendUp: true,
    sparkline: [30, 32, 35, 38, 42, 48],
    color: '#10b981',
    iconBg: '#d1fae5',
  },
];

/* ── Briefing cards data ── */
const briefingCards = [
  {
    icon: <AlertTriangle className="h-5 w-5" />,
    title: '3 invoices overdue >30 days (\u00A342,100)',
    entities: [
      { name: 'Acme Ltd', amount: '\u00A318,200' },
      { name: 'Bolt Industries', amount: '\u00A314,600' },
      { name: 'Crown Services', amount: '\u00A39,300' },
    ],
    aiRecommendation:
      'Recommend chasing Acme first \u2014 largest amount, good payment history. Bolt has been escalated twice already.',
    actions: [
      { label: 'Chase All', variant: 'primary' as const },
      { label: 'Review Details \u2192', variant: 'outline' as const },
    ],
  },
  {
    icon: <Banknote className="h-5 w-5" />,
    title: 'AP run due Friday \u2014 12 invoices (\u00A367,300)',
    entities: [
      { name: 'Total invoices:', amount: '12' },
      { name: 'Total value:', amount: '\u00A367,300' },
    ],
    aiRecommendation:
      'All within credit terms. Approve to maintain supplier relationships and early payment discounts.',
    actions: [
      { label: 'Approve All', variant: 'primary' as const },
      { label: 'Review Batch \u2192', variant: 'outline' as const },
    ],
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: 'Cash flow forecast: 14-day safety window',
    entities: [
      { name: 'Projected inflow:', amount: '\u00A389,200' },
      { name: 'Projected outflow:', amount: '\u00A3112,500' },
    ],
    aiRecommendation:
      'Revenue pipeline is strong. Consider accelerating collections on 7 overdue items to improve the buffer.',
    actions: [{ label: 'View Forecast \u2192', variant: 'outline' as const }],
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: '3 POs awaiting approval (\u00A323,800)',
    entities: [
      { name: 'Within policy:', amount: '2' },
      { name: 'Needs review:', amount: '1' },
    ],
    aiRecommendation:
      '2 are within policy limits. 1 needs review \u2014 exceeds department budget by 12%.',
    actions: [
      { label: 'Approve 2', variant: 'primary' as const },
      { label: 'Review 1 \u2192', variant: 'outline' as const },
    ],
  },
];

/* ── Loading skeleton ── */
function BriefingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="mb-2 h-8 w-32" />
            <Skeleton className="h-6 w-full" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-64" />
              <Skeleton className="mb-4 h-4 w-48" />
              <Skeleton className="mb-3 h-16 w-full rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Greeting helper ── */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ── Page Component ── */
export default function AIBriefingPage() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-fade-in-up">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[#7c3aed]" />
            <span>AI &gt; Morning Briefing</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">{getGreeting()}, Sarah</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatDate()}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="animate-fade-in-up rounded-lg border-border hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
          style={{ animationDelay: '100ms' }}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <BriefingSkeleton />
      ) : (
        <>
          {/* Summary Metrics */}
          <section>
            <h2 className="sr-only">Summary Metrics</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((m, i) => (
                <div
                  key={m.label}
                  className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                      {m.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        m.trendUp ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#fee2e2] text-[#991b1b]'
                      }`}
                    >
                      {m.trend} {m.trendUp ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                      {m.value}
                    </span>
                  </div>
                  <Sparkline data={m.sparkline} color={m.color} />
                </div>
              ))}
            </div>
          </section>

          {/* Actionable Items */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actionable Items
            </h2>
            <div className="space-y-4">
              {briefingCards.map((card, i) => (
                <BriefingActionCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  entities={card.entities}
                  aiRecommendation={card.aiRecommendation}
                  actions={card.actions}
                  delay={i * 80}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
