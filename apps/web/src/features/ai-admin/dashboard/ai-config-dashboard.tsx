/* eslint-disable i18next/no-literal-string */
/**
 * AI Configuration Dashboard — summary cards, token usage chart,
 * and quick-navigation links to Model Registry & Prompt Templates.
 *
 * AC-1: Dashboard with Active Models, Active Agents, Active Skills,
 * Automations cards + daily token usage line chart.
 */

import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Brain, Bot, Zap, Workflow, Database, FileCode, Wand2, ArrowRight } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/templates/page-header';

import { useAiDashboard } from '../api/use-ai-dashboard';

// ─── Chart config ────────────────────────────────────────────────────────────

const tokenChartConfig: ChartConfig = {
  inputTokens: { label: 'Input Tokens', color: '#7c3aed' },
  outputTokens: { label: 'Output Tokens', color: '#c4b5fd' },
};

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Summary card component ─────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  delay: number;
}

function SummaryCard({ icon, title, value, subtitle, delay }: SummaryCardProps) {
  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="font-mono text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
      </div>
    </div>
  );
}

// ─── Navigation card component ──────────────────────────────────────────────

interface NavCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
}

function NavCard({ icon, title, description, onClick, delay }: NavCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-fade-in-up group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ─── Skeleton loaders ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main dashboard component ───────────────────────────────────────────────

export function AiConfigDashboard() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading } = useAiDashboard();

  const breadcrumbs = useMemo(() => [{ label: 'AI Administration' }], []);

  // Format monthly cost for display
  const monthlyCostDisplay = dashboard
    ? `£${Number(dashboard.activeModels.monthlyCost).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '£0.00';

  // Count unique modules in skills
  const moduleCount = dashboard ? Object.keys(dashboard.activeSkills.byModule).length : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader title="AI Configuration" breadcrumbs={breadcrumbs} isLoading={isLoading} />

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* ── Summary cards ───────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<Brain className="size-5" />}
              title="Active Models"
              value={dashboard?.activeModels.count ?? 0}
              subtitle={<span className="font-mono text-xs">{monthlyCostDisplay} this month</span>}
              delay={50}
            />
            <SummaryCard
              icon={<Bot className="size-5" />}
              title="Active Agents"
              value={dashboard?.activeAgents.count ?? 0}
              delay={100}
            />
            <SummaryCard
              icon={<Zap className="size-5" />}
              title="Active Skills"
              value={dashboard?.activeSkills.total ?? 0}
              subtitle={`across ${moduleCount} modules`}
              delay={150}
            />
            <SummaryCard
              icon={<Workflow className="size-5" />}
              title="Automations"
              value={(dashboard?.automations.active ?? 0) + (dashboard?.automations.paused ?? 0)}
              subtitle={
                <span className="space-y-1">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {dashboard?.automations.active ?? 0} active
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {dashboard?.automations.paused ?? 0} paused
                    </span>
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Last 24h: {dashboard?.automations.last24hRuns?.success ?? 0} succeeded,{' '}
                    {dashboard?.automations.last24hRuns?.failed ?? 0} failed
                  </span>
                </span>
              }
              delay={200}
            />
          </div>

          {/* ── Token usage chart ───────────────────────────── */}
          <TokenUsageChart data={dashboard?.dailyTokenUsage ?? []} />

          {/* ── Quick navigation cards ─────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NavCard
              icon={<Database className="size-5" />}
              title="Model Registry"
              description="View and manage AI models, providers, costs, and routing tags"
              onClick={() => void navigate({ to: '/ai/admin/models' as string })}
              delay={350}
            />
            <NavCard
              icon={<FileCode className="size-5" />}
              title="Prompt Templates"
              description="Edit prompt templates, manage versions, and test variable rendering"
              onClick={() => void navigate({ to: '/ai/admin/prompts' as string })}
              delay={400}
            />
            <NavCard
              icon={<Bot className="size-5" />}
              title="Agent Configuration"
              description="Configure AI agents, models, tools, and guardrails"
              onClick={() => void navigate({ to: '/ai/admin/agents' as string })}
              delay={450}
            />
            <NavCard
              icon={<Wand2 className="size-5" />}
              title="Skill Packs"
              description="Manage skill packs, trigger phrases, and orchestration patterns"
              onClick={() => void navigate({ to: '/ai/admin/skills' as string })}
              delay={500}
            />
            <NavCard
              icon={<Workflow className="size-5" />}
              title="Automations"
              description="Build and manage autonomous AI workflows with chained agent steps"
              onClick={() => void navigate({ to: '/ai/admin/automations' as string })}
              delay={550}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Token usage chart ──────────────────────────────────────────────────────

interface TokenUsageChartProps {
  data: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: string;
  }>;
}

function TokenUsageChart({ data }: TokenUsageChartProps) {
  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '250ms' }}
    >
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        Token Usage (Last 30 Days)
      </h3>

      {data.length === 0 ? (
        <div className="flex aspect-[3/1] items-center justify-center text-sm text-muted-foreground">
          No token usage data available yet
        </div>
      ) : (
        <ChartContainer
          config={tokenChartConfig}
          className="aspect-[3/1] w-full max-md:aspect-[2/1]"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="inputGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c4b5fd" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatDate}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTokenCount}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              width={55}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    if (!payload?.[0]?.payload) return '';
                    const dateStr = payload[0].payload.date as string;
                    return new Date(dateStr).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    });
                  }}
                  formatter={(value, name) => {
                    const label = name === 'inputTokens' ? 'Input' : 'Output';
                    return (
                      <span>
                        {label}: {Number(value).toLocaleString()}
                      </span>
                    );
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="inputTokens"
              stroke="#7c3aed"
              strokeWidth={2}
              fill="url(#inputGradient)"
            />
            <Area
              type="monotone"
              dataKey="outputTokens"
              stroke="#c4b5fd"
              strokeWidth={2}
              fill="url(#outputGradient)"
            />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}
