/* eslint-disable i18next/no-literal-string */
/**
 * Automation Run Detail Page — T2 Record Detail for a single automation run.
 *
 * AC-3: Run summary header, metrics cards row, step-by-step timeline
 * AC-4: Failed step detail view with error and retry action
 * AC-5: Retry from failed step with confirmation dialog
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { format } from 'date-fns';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { PageHeader } from '@/components/templates/page-header';
import type { BreadcrumbSegment } from '@/components/templates/types';
import { cn } from '@/lib/utils';

import { useAutomationRun, useRetryAutomationRun } from '../api/use-ai-automation-runs';
import {
  RUN_STATUS_CONFIG,
  formatDuration,
  formatTriggeredBy,
} from '../shared/automation-constants';
import { StepTimeline } from './components/step-timeline';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Failed to copy');
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
// Step timeline and JSON viewer extracted to components/step-timeline.tsx and
// components/json-viewer.tsx respectively (Task 5).

interface AutomationRunDetailPageProps {
  runId: string;
}

export function AutomationRunDetailPage({ runId }: AutomationRunDetailPageProps) {
  const navigate = useNavigate();
  const { data: run, isLoading, isError, refetch } = useAutomationRun(runId);
  const retryMutation = useRetryAutomationRun();
  const [showRetryDialog, setShowRetryDialog] = useState(false);

  // Auto-refetch every 5s for active runs
  useEffect(() => {
    if (!run || (run.status !== 'RUNNING' && run.status !== 'PENDING')) return;
    const interval = setInterval(() => {
      void refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [run?.status, refetch]);

  // Tick every second for RUNNING runs so duration counter updates live
  const [, setDurationTick] = useState(0);
  useEffect(() => {
    if (!run || run.status !== 'RUNNING') return;
    const timer = setInterval(() => setDurationTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [run?.status]);

  // Computed metrics
  const metrics = useMemo(() => {
    if (!run) return null;
    const totalInputTokens = run.stepRuns.reduce((sum, s) => sum + s.inputTokens, 0);
    const totalOutputTokens = run.stepRuns.reduce((sum, s) => sum + s.outputTokens, 0);
    const completedSteps = run.stepRuns.filter((s) => s.status === 'COMPLETED').length;
    const totalSteps = run.stepRuns.length;
    const totalTurns = run.stepRuns.reduce((sum, s) => sum + s.turns, 0);
    return { totalInputTokens, totalOutputTokens, completedSteps, totalSteps, totalTurns };
  }, [run]);

  // Breadcrumbs
  const breadcrumbs = useMemo<BreadcrumbSegment[]>(() => {
    const crumbs: BreadcrumbSegment[] = [
      { label: 'AI Administration', path: '/ai/admin' },
      { label: 'Automations', path: '/ai/admin/automations' },
    ];
    if (run) {
      crumbs.push({
        label: run.automationName,
        path: `/ai/admin/automations/${run.automationId}`,
      });
    }
    crumbs.push({ label: `Run ${runId.slice(0, 8)}` });
    return crumbs;
  }, [run, runId]);

  // Find the first failed step for retry dialog context
  const failedStep = run?.stepRuns.find((s) => s.status === 'FAILED');

  // Retry handler
  const handleRetryConfirm = useCallback(() => {
    retryMutation.mutate(runId, {
      onSuccess: (data) => {
        setShowRetryDialog(false);
        // Navigate to the new run's detail page (AC-5)
        if (data?.newRunId) {
          void navigate({
            to: `/ai/admin/automations/runs/${data.newRunId}` as string,
          });
        } else {
          // Fallback: if backend doesn't return newRunId, go to runs list
          void navigate({
            to: '/ai/admin/automations/runs' as string,
            search: run
              ? { automationId: run.automationId, automationName: run.automationName }
              : {},
          });
        }
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to retry automation run');
        setShowRetryDialog(false);
      },
    });
  }, [runId, retryMutation, navigate, run]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="animate-fade-in-up space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-4 w-20" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="rounded-xl">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (isError || !run) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card className="rounded-xl border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertTriangle className="size-10 text-red-400" />
            <div>
              <p className="text-lg font-semibold text-red-800">Failed to load run</p>
              <p className="mt-1 text-sm text-red-600">
                The automation run could not be found or an error occurred.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => void navigate({ to: '/ai/admin/automations/runs' as string })}
            >
              <ArrowLeft className="mr-1.5 size-4" />
              Back to Runs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const statusConfig = RUN_STATUS_CONFIG[run.status];
  const totalCostNum = parseFloat(run.totalCost);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 animate-fade-in-up">
      {/* Page Header */}
      <PageHeader
        title={`Run ${runId.slice(0, 8)}`}
        breadcrumbs={breadcrumbs}
        statusBadge={
          <div className="flex items-center gap-2 rounded-full border px-3 py-1">
            <span
              className={cn(
                'size-2.5 rounded-full',
                statusConfig.dotColor,
                run.status === 'RUNNING' && 'animate-pulse',
              )}
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{statusConfig.label}</span>
          </div>
        }
        actionBarSlot={
          <div className="flex items-center gap-2">
            {run.status === 'FAILED' && (
              <Button
                size="sm"
                className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
                onClick={() => setShowRetryDialog(true)}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() =>
                void navigate({
                  to: `/ai/admin/automations/${run.automationId}` as string,
                })
              }
            >
              <ExternalLink className="mr-1.5 size-3.5" />
              View Automation
            </Button>
          </div>
        }
      />

      {/* Run summary sub-header */}
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <span>
          Triggered by{' '}
          <span className="font-medium text-foreground">{formatTriggeredBy(run.triggeredBy)}</span>
        </span>
        {run.startedAt && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Started {format(new Date(run.startedAt), 'dd MMM yyyy HH:mm:ss')}
          </span>
        )}
        {run.completedAt && (
          <span>Completed {format(new Date(run.completedAt), 'dd MMM yyyy HH:mm:ss')}</span>
        )}
      </div>

      {/* Metrics Cards Row */}
      {metrics && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up"
          style={{ animationDelay: '100ms' }}
        >
          {/* Total Tokens */}
          <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)] transition-shadow">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Tokens
              </p>
              <p className="mt-1 text-3xl font-bold font-mono text-foreground">
                {run.totalTokens.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-mono text-muted-foreground">
                In: {metrics.totalInputTokens.toLocaleString()} / Out:{' '}
                {metrics.totalOutputTokens.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Total Cost */}
          <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)] transition-shadow">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Cost
              </p>
              <p className="mt-1 text-3xl font-bold font-mono text-foreground">
                {isNaN(totalCostNum) ? '\u2014' : `\u00A3${totalCostNum.toFixed(4)}`}
              </p>
            </CardContent>
          </Card>

          {/* Steps */}
          <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)] transition-shadow">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Steps
              </p>
              <p className="mt-1 text-3xl font-bold font-mono text-foreground">
                {metrics.completedSteps}
                <span className="text-lg text-muted-foreground">/{metrics.totalSteps}</span>
              </p>
              {/* Mini progress bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
                <div
                  className="h-full rounded-full bg-[#7c3aed] transition-all duration-500"
                  style={{
                    width:
                      metrics.totalSteps > 0
                        ? `${(metrics.completedSteps / metrics.totalSteps) * 100}%`
                        : '0%',
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Duration */}
          <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)] transition-shadow">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Duration
              </p>
              <p className="mt-1 text-3xl font-bold font-mono text-foreground">
                {formatDuration(run.startedAt, run.completedAt, run.status)}
              </p>
              {run.status === 'RUNNING' && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#f59e0b]">
                  <Loader2 className="size-3 animate-spin" />
                  In progress...
                </p>
              )}
              {metrics.totalTurns > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {metrics.totalTurns} turn{metrics.totalTurns !== 1 ? 's' : ''} total
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Banner (only if run is FAILED) */}
      {run.status === 'FAILED' && run.error && (
        <div
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 animate-fade-in-up"
          style={{ animationDelay: '150ms' }}
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Run Failed</p>
            <p className="mt-1 text-sm text-red-700 break-words">{run.error}</p>
          </div>
          <Button
            size="sm"
            className="shrink-0 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            onClick={() => setShowRetryDialog(true)}
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Retry from Failed Step
          </Button>
        </div>
      )}

      {/* Step Timeline */}
      <Card
        className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up"
        style={{ animationDelay: '200ms' }}
      >
        <CardContent className="p-6">
          <StepTimeline stepRuns={run.stepRuns} onRetryStep={() => setShowRetryDialog(true)} />
        </CardContent>
      </Card>

      {/* Run Metadata Footer */}
      <Card
        className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up"
        style={{ animationDelay: '250ms' }}
      >
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Run ID</span>
              <div className="flex items-center gap-1.5">
                <code className="font-mono text-xs text-foreground">{run.id}</code>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => void copyToClipboard(run.id)}
                  aria-label="Copy run ID"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
            {run.retryOfRunId && (
              <div>
                <span className="text-muted-foreground">Retry of</span>
                <div>
                  <Link
                    to={`/ai/admin/automations/runs/${run.retryOfRunId}` as string}
                    className="font-mono text-xs text-[#7c3aed] hover:underline"
                  >
                    {run.retryOfRunId.slice(0, 8)}&hellip;
                  </Link>
                </div>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-mono text-xs text-foreground">
                {format(new Date(run.createdAt), 'dd MMM yyyy HH:mm:ss')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retry Confirmation Dialog */}
      <AlertDialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <AlertDialogContent className="animate-step-in sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Retry from Failed Step</AlertDialogTitle>
            <AlertDialogDescription>
              {failedStep ? (
                <>
                  This will create a new run starting from step {failedStep.stepOrder}
                  {failedStep.goal ? ` (${failedStep.goal})` : ''}. Previous step outputs will be
                  preserved.
                </>
              ) : (
                'This will create a new run starting from the failed step. Previous step outputs will be preserved.'
              )}
            </AlertDialogDescription>
            <div className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
              {run.automationName} &mdash; {run.id.slice(0, 8)}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRetryConfirm}
              disabled={retryMutation.isPending}
              className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              {retryMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 size-3.5" />
              )}
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
