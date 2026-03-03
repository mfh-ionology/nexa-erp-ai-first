/* eslint-disable i18next/no-literal-string */
/**
 * Automation Health dashboard section (AC-6, AC-7).
 *
 * Shows: circuit breaker warnings, automations-by-status donut,
 * failed runs (24h), upcoming scheduled runs, and 7-day token spend chart.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow, format } from 'date-fns';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Play, XCircle } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

import { useUpdateAiAutomation } from '../../api/use-ai-automations';
import { useAutomationHealth } from '../../api/use-ai-automation-health';

// ─── Chart config ────────────────────────────────────────────────────────────

const tokenSpendChartConfig: ChartConfig = {
  tokens: { label: 'Tokens', color: '#7c3aed' },
};

const STATUS_COLORS = {
  active: '#10b981',
  paused: '#f59e0b',
  inactive: '#d1d5db',
} as const;

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

// ─── Circuit Breaker Warning Banner ──────────────────────────────────────────

interface CircuitBreakerBannerProps {
  automationId: string;
  automationName: string;
}

function CircuitBreakerBanner({ automationId, automationName }: CircuitBreakerBannerProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateAiAutomation();
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  function handleResume() {
    updateMutation.mutate(
      { id: automationId, data: { isActive: true } },
      {
        onSuccess: () => {
          setShowResumeDialog(false);
        },
      },
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="size-5 shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1 text-sm text-amber-800">
          <span className="font-semibold">{automationName}</span> has been paused after 3
          consecutive failures.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700 hover:text-amber-900"
            onClick={() =>
              void navigate({
                to: '/ai/admin/automations/runs' as string,
                search: { automationId, status: 'FAILED' } as Record<string, string>,
              })
            }
          >
            View Runs
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setShowResumeDialog(true)}
          >
            <Play className="mr-1 size-3" />
            Resume
          </Button>
        </div>
      </div>

      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent className="animate-step-in sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Resume Automation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resume <strong>{automationName}</strong>? It will run on its
              next scheduled time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResume}
              disabled={updateMutation.isPending}
              className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              {updateMutation.isPending ? 'Resuming...' : 'Resume'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Automations by Status Donut ─────────────────────────────────────────────

interface StatusDonutProps {
  active: number;
  paused: number;
  inactive: number;
  onClick: () => void;
}

function StatusDonut({ active, paused, inactive, onClick }: StatusDonutProps) {
  const total = active + paused + inactive;
  const data = [
    { name: 'Active', value: active, color: STATUS_COLORS.active },
    { name: 'Paused', value: paused, color: STATUS_COLORS.paused },
    { name: 'Inactive', value: inactive, color: STATUS_COLORS.inactive },
  ].filter((d) => d.value > 0);

  // If no automations at all, show placeholder
  if (total === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      >
        <p className="text-sm font-medium text-muted-foreground">Automations by Status</p>
        <p className="mt-2 text-sm text-muted-foreground">No automations yet</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
    >
      <p className="mb-2 text-sm font-medium text-muted-foreground">Automations by Status</p>
      <div className="flex items-center gap-4">
        <PieChart width={80} height={80}>
          <Pie
            data={data}
            cx={40}
            cy={40}
            innerRadius={22}
            outerRadius={36}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
        <div className="flex flex-col gap-1 text-left">
          {active > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-[#10b981]" />
              <span>{active} Active</span>
            </div>
          )}
          {paused > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-[#f59e0b]" />
              <span>{paused} Paused</span>
            </div>
          )}
          {inactive > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-[#d1d5db]" />
              <span>{inactive} Inactive</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Failed Runs Card ────────────────────────────────────────────────────────

interface FailedRunsCardProps {
  count: number;
  onClick: () => void;
}

function FailedRunsCard({ count, onClick }: FailedRunsCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
    >
      <p className="mb-2 text-sm font-medium text-muted-foreground">Failed Runs (24h)</p>
      {count > 0 ? (
        <div className="flex items-center gap-2">
          <XCircle className="size-5 text-red-500" />
          <span className="font-mono text-3xl font-bold text-red-600">{count}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-green-500" />
          <span className="font-mono text-lg font-semibold text-green-600">All healthy</span>
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">failed in last 24 hours</p>
    </button>
  );
}

// ─── Upcoming Runs Card ──────────────────────────────────────────────────────

interface UpcomingRunsCardProps {
  runs: Array<{
    automationId: string;
    automationName: string;
    nextRunAt: string;
  }>;
  onClick: () => void;
}

function UpcomingRunsCard({ runs, onClick }: UpcomingRunsCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
    >
      <p className="mb-2 text-sm font-medium text-muted-foreground">Upcoming Scheduled Runs</p>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming runs</p>
      ) : (
        <div className="space-y-1.5">
          {runs.map((run) => (
            <div key={run.automationId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{run.automationName}</span>
              <span className="shrink-0 text-muted-foreground">
                <Clock className="mr-0.5 inline size-3" />
                {formatDistanceToNow(new Date(run.nextRunAt), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Token Spend Card ────────────────────────────────────────────────────────

interface TokenSpendCardProps {
  data: Array<{ date: string; tokens: number }>;
}

function TokenSpendCard({ data }: TokenSpendCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
      <p className="mb-2 text-sm font-medium text-muted-foreground">Token Spend (7d)</p>
      {data.every((d) => d.tokens === 0) ? (
        <p className="text-sm text-muted-foreground">No automation token usage</p>
      ) : (
        <ChartContainer config={tokenSpendChartConfig} className="h-[100px] w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="healthTokenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => format(new Date(d), 'd MMM')}
              tick={{ fill: '#6b7280', fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTokenCount}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => <span>{Number(value).toLocaleString()} tokens</span>}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="tokens"
              stroke="#7c3aed"
              strokeWidth={2}
              fill="url(#healthTokenGradient)"
            />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}

// ─── Health Section Skeleton ─────────────────────────────────────────────────

function HealthSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AutomationHealthSection() {
  const navigate = useNavigate();
  const { data: health, isLoading } = useAutomationHealth();

  if (isLoading) {
    return (
      <section className="animate-fade-in-up space-y-4" style={{ animationDelay: '600ms' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-sm font-semibold text-foreground">Automation Health</h3>
        </div>
        <HealthSkeleton />
      </section>
    );
  }

  if (!health) return null;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  return (
    <section className="animate-fade-in-up space-y-4" style={{ animationDelay: '600ms' }}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm font-semibold text-foreground">Automation Health</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => void navigate({ to: '/ai/admin/automations/runs' as string })}
        >
          View All Runs
          <ArrowRight className="ml-1 size-3" />
        </Button>
      </div>

      {/* Circuit breaker warnings (AC-7) */}
      {health.circuitBreakerAlerts.length > 0 && (
        <div className="space-y-2">
          {health.circuitBreakerAlerts.map((alert) => (
            <CircuitBreakerBanner
              key={alert.automationId}
              automationId={alert.automationId}
              automationName={alert.automationName}
            />
          ))}
        </div>
      )}

      {/* Stats grid — 2x2 on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatusDonut
          active={health.activeCount}
          paused={health.pausedCount}
          inactive={health.inactiveCount}
          onClick={() => void navigate({ to: '/ai/admin/automations' as string })}
        />

        <FailedRunsCard
          count={health.failedRunsLast24h}
          onClick={() =>
            void navigate({
              to: '/ai/admin/automations/runs' as string,
              search: { status: 'FAILED', dateFrom: twentyFourHoursAgo } as Record<string, string>,
            })
          }
        />

        <UpcomingRunsCard
          runs={health.upcomingRuns}
          onClick={() =>
            void navigate({
              to: '/ai/admin/automations' as string,
              search: { triggerType: 'SCHEDULED' } as Record<string, string>,
            })
          }
        />

        <TokenSpendCard data={health.dailyTokenSpend} />
      </div>
    </section>
  );
}
