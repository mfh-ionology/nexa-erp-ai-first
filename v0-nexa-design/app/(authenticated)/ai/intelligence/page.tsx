'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  TrendingUp,
  Brain,
  Lightbulb,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Sparkles,
  BarChart3,
  Zap,
  RefreshCw,
} from 'lucide-react';

/* ── Types ── */
interface Insight {
  id: string;
  title: string;
  summary: string;
  source: string;
  confidence: number;
  category: 'Financial' | 'Operational' | 'Market' | 'Risk';
  status: 'New' | 'Reviewed' | 'Applied' | 'Dismissed';
  date: string;
  impact: 'High' | 'Medium' | 'Low';
}

interface Benchmark {
  metric: string;
  yourValue: string;
  industryAvg: string;
  percentile: number;
  trend: 'up' | 'down' | 'flat';
}

interface Evolution {
  month: string;
  accuracy: number;
  queries: number;
  learnings: number;
}

/* ── Data ── */
const insights: Insight[] = [
  {
    id: 'i1',
    title: 'Revenue concentration risk detected',
    summary:
      'Top 3 customers represent 52% of total revenue. Industry best practice is below 30%. Consider diversification strategy.',
    source: 'Cross-Tenant Analysis',
    confidence: 0.91,
    category: 'Risk',
    status: 'New',
    date: 'Today',
    impact: 'High',
  },
  {
    id: 'i2',
    title: 'AP processing time 40% above benchmark',
    summary:
      'Average AP invoice processing takes 4.2 days vs industry average of 2.5 days. Automation of 3-way matching could reduce by 60%.',
    source: 'Industry Benchmark',
    confidence: 0.88,
    category: 'Operational',
    status: 'Reviewed',
    date: 'Yesterday',
    impact: 'High',
  },
  {
    id: 'i3',
    title: 'Cash conversion cycle improvement opportunity',
    summary:
      'Your CCC of 48 days is in the 35th percentile. Reducing DSO by 5 days would improve working capital by approximately 85k.',
    source: 'Financial Pattern',
    confidence: 0.85,
    category: 'Financial',
    status: 'New',
    date: 'Yesterday',
    impact: 'Medium',
  },
  {
    id: 'i4',
    title: 'Seasonal demand pattern identified',
    summary:
      'Historical data shows 23% revenue increase in Q3 across similar businesses. Recommend pre-stocking inventory by June.',
    source: 'Cross-Tenant Analysis',
    confidence: 0.79,
    category: 'Market',
    status: 'Applied',
    date: '3 days ago',
    impact: 'Medium',
  },
  {
    id: 'i5',
    title: 'Supplier price inflation above market',
    summary:
      'Your raw material costs increased 8% YoY while market index shows 4%. 3 suppliers are above benchmark pricing.',
    source: 'Market Intelligence',
    confidence: 0.82,
    category: 'Financial',
    status: 'New',
    date: '4 days ago',
    impact: 'High',
  },
];

const benchmarks: Benchmark[] = [
  {
    metric: 'Days Sales Outstanding',
    yourValue: '38 days',
    industryAvg: '32 days',
    percentile: 42,
    trend: 'up',
  },
  {
    metric: 'Days Payable Outstanding',
    yourValue: '28 days',
    industryAvg: '35 days',
    percentile: 65,
    trend: 'flat',
  },
  {
    metric: 'Inventory Turnover',
    yourValue: '6.2x',
    industryAvg: '7.1x',
    percentile: 38,
    trend: 'up',
  },
  { metric: 'Gross Margin', yourValue: '42%', industryAvg: '38%', percentile: 72, trend: 'up' },
  {
    metric: 'Operating Expense Ratio',
    yourValue: '24%',
    industryAvg: '22%',
    percentile: 45,
    trend: 'down',
  },
  {
    metric: 'Revenue per Employee',
    yourValue: '168k',
    industryAvg: '155k',
    percentile: 62,
    trend: 'up',
  },
];

const evolution: Evolution[] = [
  { month: 'Sep', accuracy: 72, queries: 340, learnings: 12 },
  { month: 'Oct', accuracy: 76, queries: 520, learnings: 28 },
  { month: 'Nov', accuracy: 81, queries: 680, learnings: 45 },
  { month: 'Dec', accuracy: 84, queries: 720, learnings: 62 },
  { month: 'Jan', accuracy: 88, queries: 890, learnings: 78 },
  { month: 'Feb', accuracy: 91, queries: 1020, learnings: 94 },
];

const impactColors: Record<string, string> = {
  High: 'bg-[#fee2e2] text-[#991b1b]',
  Medium: 'bg-[#fef3c7] text-[#92400e]',
  Low: 'bg-[#d1fae5] text-[#065f46]',
};

const categoryColors: Record<string, string> = {
  Financial: 'bg-[#ede9fe] text-[#5b21b6]',
  Operational: 'bg-[#dbeafe] text-[#1e40af]',
  Market: 'bg-[#d1fae5] text-[#065f46]',
  Risk: 'bg-[#fee2e2] text-[#991b1b]',
};

const statusColors: Record<string, string> = {
  New: 'bg-[#dbeafe] text-[#1e40af]',
  Reviewed: 'bg-[#fef3c7] text-[#92400e]',
  Applied: 'bg-[#d1fae5] text-[#065f46]',
  Dismissed: 'bg-secondary text-muted-foreground',
};

/* ── Insight Card ── */
function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${categoryColors[insight.category]}`}
            >
              {insight.category}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${impactColors[insight.impact]}`}
            >
              {insight.impact} Impact
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusColors[insight.status]}`}
            >
              {insight.status}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{insight.summary}</p>
          <div className="mt-3 flex items-center gap-4">
            <span className="text-[10px] text-muted-foreground">{insight.source}</span>
            <span className="text-[10px] text-muted-foreground">{insight.date}</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Brain className="h-3 w-3" />
              {(insight.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[#d1fae5] hover:text-[#065f46]"
            title="Helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fee2e2] hover:text-[#991b1b]"
            title="Not helpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Percentile Bar ── */
function PercentileBar({ value }: { value: number }) {
  const color = value >= 60 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium" style={{ color }}>
        {value}th
      </span>
    </div>
  );
}

/* ── Mini Bar Chart ── */
function MiniBarChart({
  data,
  dataKey,
  color,
}: {
  data: Evolution[];
  dataKey: keyof Evolution;
  color: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[dataKey])));
  return (
    <div className="flex items-end gap-1.5 h-12">
      {data.map((d) => {
        const h = (Number(d[dataKey]) / max) * 100;
        return (
          <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full max-w-[24px] rounded-sm"
              style={{ height: `${h}%`, backgroundColor: color, minHeight: 4 }}
            />
            <span className="text-[9px] text-muted-foreground">{d.month}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ── */
export default function IntelligenceDashboard() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5 text-[#7c3aed]" />
            <span>AI &gt; Intelligence</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Intelligence Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated insights, benchmarks, and knowledge evolution metrics.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="rounded-lg hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Insights', value: '23', sub: '5 new', icon: Lightbulb, color: '#7c3aed' },
          {
            label: 'Accuracy',
            value: '91%',
            sub: '+3% this month',
            icon: Sparkles,
            color: '#10b981',
          },
          {
            label: 'Queries',
            value: '1,020',
            sub: 'This month',
            icon: BarChart3,
            color: '#3b82f6',
          },
          { label: 'Learnings', value: '94', sub: 'Total patterns', icon: Zap, color: '#f59e0b' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="animate-fade-in-up rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2">
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="insights">
        <TabsList className="mb-4 rounded-lg border border-border bg-secondary/50 p-1">
          <TabsTrigger
            value="insights"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Insights
          </TabsTrigger>
          <TabsTrigger
            value="benchmarks"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Benchmarks
          </TabsTrigger>
          <TabsTrigger
            value="evolution"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Evolution
          </TabsTrigger>
        </TabsList>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={insight.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <InsightCard insight={insight} />
            </div>
          ))}
        </TabsContent>

        {/* Benchmarks Tab */}
        <TabsContent value="benchmarks">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Metric
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    You
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                    Industry Avg
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Percentile
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b) => (
                  <tr
                    key={b.metric}
                    className="border-b border-border last:border-0 transition-colors hover:bg-[#f5f3ff]"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{b.metric}</td>
                    <td className="px-4 py-3 font-mono text-sm text-foreground">{b.yourValue}</td>
                    <td className="hidden px-4 py-3 font-mono text-sm text-muted-foreground sm:table-cell">
                      {b.industryAvg}
                    </td>
                    <td className="px-4 py-3">
                      <PercentileBar value={b.percentile} />
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span
                        className={`text-xs font-medium ${b.trend === 'up' ? 'text-[#065f46]' : b.trend === 'down' ? 'text-[#991b1b]' : 'text-muted-foreground'}`}
                      >
                        {b.trend === 'up'
                          ? 'Improving'
                          : b.trend === 'down'
                            ? 'Declining'
                            : 'Stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Benchmarks are derived from anonymized, aggregated cross-tenant data across similar
            industry segments.
          </p>
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accuracy Over Time
              </h3>
              <MiniBarChart data={evolution} dataKey="accuracy" color="#7c3aed" />
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Queries
              </h3>
              <MiniBarChart data={evolution} dataKey="queries" color="#3b82f6" />
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Learnings Captured
              </h3>
              <MiniBarChart data={evolution} dataKey="learnings" color="#10b981" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Knowledge Evolution Timeline
            </h3>
            <div className="space-y-4">
              {evolution
                .slice()
                .reverse()
                .map((e, i) => (
                  <div key={e.month} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${i === 0 ? 'bg-[#7c3aed] text-white' : 'bg-secondary text-muted-foreground'}`}
                      >
                        <Brain className="h-3.5 w-3.5" />
                      </div>
                      {i < evolution.length - 1 && <div className="h-8 w-px bg-border" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{e.month} 2026</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.accuracy}% accuracy &middot; {e.queries} queries &middot; {e.learnings}{' '}
                        patterns learned
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
