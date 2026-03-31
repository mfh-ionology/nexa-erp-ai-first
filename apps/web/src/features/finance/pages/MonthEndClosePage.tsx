/* eslint-disable i18next/no-literal-string */
/**
 * FE15: Month-End Close Checklist Page — /finance/month-end/$periodId
 *
 * Checklist UI with auto-check and manual steps, progress bar,
 * and close button (requires all steps complete).
 */

import { useCallback, useMemo } from 'react';

import { PageHeader } from '@/components/templates/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Loader2, Lock, Play, AlertCircle, SkipForward } from 'lucide-react';

import {
  useMonthEndPeriod,
  useCloseMonthEnd,
  useCompleteMonthEndStep,
} from '../hooks/use-month-end';
import type { MonthEndStep, MonthEndStepStatus } from '../types';

const STEP_ICONS: Record<MonthEndStepStatus, React.ReactNode> = {
  PENDING: <Circle className="size-5 text-muted-foreground" />,
  IN_PROGRESS: <Loader2 className="size-5 animate-spin text-primary" />,
  COMPLETED: <CheckCircle className="size-5 text-emerald-600" />,
  SKIPPED: <SkipForward className="size-5 text-muted-foreground" />,
  FAILED: <AlertCircle className="size-5 text-red-600" />,
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'secondary',
  CLOSING: 'outline',
  CLOSED: 'default',
};

interface MonthEndClosePageProps {
  periodId: string;
}

export function MonthEndClosePage({ periodId }: MonthEndClosePageProps) {
  const { period, isLoading } = useMonthEndPeriod(periodId);
  const closeMutation = useCloseMonthEnd();
  const completeStepMutation = useCompleteMonthEndStep();

  const handleCompleteStep = useCallback(
    (stepId: string) => {
      completeStepMutation.mutate({ periodId, stepId });
    },
    [completeStepMutation, periodId],
  );

  const handleClosePeriod = useCallback(() => {
    closeMutation.mutate(periodId);
  }, [closeMutation, periodId]);

  const allStepsComplete = useMemo(() => {
    if (!period?.steps) return false;
    return period.steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED');
  }, [period]);

  const isOpen = period?.status === 'OPEN';

  return (
    <main className="flex flex-col gap-6" aria-label="Month-End Close">
      <PageHeader
        title={period?.periodLabel ?? 'Month-End Close'}
        subtitle={period ? `FY ${period.fiscalYear} - Period ${period.period}` : undefined}
        breadcrumbs={[
          { label: 'Finance', path: '/finance' },
          { label: 'Month-End', path: '/finance/month-end' as string },
          { label: period?.periodLabel ?? 'Close' },
        ]}
        isLoading={isLoading}
        statusBadge={
          period ? (
            <Badge variant={STATUS_BADGE_VARIANT[period.status] ?? 'secondary'}>
              {period.status}
            </Badge>
          ) : undefined
        }
      />

      {/* Progress bar */}
      {period && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Close Progress</span>
            <span className="font-medium">{period.progress}%</span>
          </div>
          <Progress value={period.progress} />
        </div>
      )}

      {/* Checklist steps */}
      {period && (
        <div className="space-y-3">
          {period.steps.map((step: MonthEndStep) => (
            <Card
              key={step.id}
              className={
                step.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : step.status === 'FAILED'
                    ? 'border-red-200 bg-red-50/50'
                    : ''
              }
            >
              <CardContent className="flex items-center gap-4 py-4">
                {/* Step icon */}
                <div className="shrink-0">{STEP_ICONS[step.status]}</div>

                {/* Step details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{step.labelKey}</p>
                    {step.isAutomatic && (
                      <Badge variant="outline" className="text-xs">
                        Auto
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.completedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Completed: {new Date(step.completedAt).toLocaleString('en-GB')}
                    </p>
                  )}
                  {step.error && <p className="mt-1 text-xs text-red-600">{step.error}</p>}
                </div>

                {/* Action button for manual steps */}
                {!step.isAutomatic && step.status === 'PENDING' && isOpen && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteStep(step.id)}
                    disabled={completeStepMutation.isPending}
                  >
                    {completeStepMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Complete
                  </Button>
                )}

                {/* Status badge */}
                <Badge
                  variant={
                    step.status === 'COMPLETED'
                      ? 'default'
                      : step.status === 'FAILED'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {step.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Close period button */}
      {period && isOpen && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">Close Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!allStepsComplete && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-4" />
                <span>All checklist steps must be completed before closing.</span>
              </div>
            )}
            <Button
              onClick={handleClosePeriod}
              disabled={closeMutation.isPending || !allStepsComplete}
              className="w-full"
              size="lg"
            >
              {closeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Close {period.periodLabel}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Closed confirmation */}
      {period?.status === 'CLOSED' && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle className="size-6 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">Period Closed</p>
              {period.closedAt && (
                <p className="text-sm text-emerald-600">
                  Closed on {new Date(period.closedAt).toLocaleString('en-GB')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
