/* eslint-disable i18next/no-literal-string */
/**
 * StepTimeline — Vertical step-by-step execution timeline for automation runs.
 *
 * AC-3: Step timeline with status indicators, expandable details, token/latency metrics
 * AC-4: Failed step detail view with error alert, retry action, skipped step labels
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MinusCircle,
  RotateCcw,
  XCircle,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { AiAutomationStepRun } from '../../api/types';
import { STEP_STATUS_CONFIG, formatLatency } from '../../shared/automation-constants';
import { JsonViewer } from './json-viewer';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepTimelineProps {
  /** Array of step runs to display, will be sorted by stepOrder */
  stepRuns: AiAutomationStepRun[];
  /** Called when the user clicks "Retry from This Step" on a failed step */
  onRetryStep?: () => void;
}

// ─── StepTimeline (container) ─────────────────────────────────────────────────

export function StepTimeline({ stepRuns, onRetryStep }: StepTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const hasAutoExpanded = useRef(false);

  const sortedSteps = useMemo(
    () => [...stepRuns].sort((a, b) => a.stepOrder - b.stepOrder),
    [stepRuns],
  );

  // Auto-expand the first failed step on initial load only (not on subsequent refetches)
  useEffect(() => {
    if (hasAutoExpanded.current) return;
    const failedSteps = stepRuns.filter((s) => s.status === 'FAILED');
    if (failedSteps.length === 1 && failedSteps[0]) {
      setExpandedSteps(new Set([failedSteps[0].id]));
      hasAutoExpanded.current = true;
    }
  }, [stepRuns]);

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  if (sortedSteps.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No steps recorded for this run.</p>;
  }

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        <Zap className="mr-2 inline-block size-5 text-[#7c3aed]" />
        Step Execution Timeline
      </h2>
      <div className="relative pl-0">
        {sortedSteps.map((step, index) => (
          <StepTimelineItem
            key={step.id}
            step={step}
            isExpanded={expandedSteps.has(step.id)}
            onToggle={() => toggleStep(step.id)}
            isLast={index === sortedSteps.length - 1}
            onRetry={step.status === 'FAILED' ? onRetryStep : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── StepTimelineItem ─────────────────────────────────────────────────────────

interface StepTimelineItemProps {
  step: AiAutomationStepRun;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
  onRetry?: () => void;
}

function StepTimelineItem({ step, isExpanded, onToggle, isLast, onRetry }: StepTimelineItemProps) {
  const config = STEP_STATUS_CONFIG[step.status];
  const isFailed = step.status === 'FAILED';
  const isSkipped = step.status === 'SKIPPED';
  const isRunning = step.status === 'RUNNING';
  const totalTokens = step.inputTokens + step.outputTokens;
  const agentLabel = step.agentDisplayName || step.agentName || step.agentId;

  return (
    <div className="relative flex gap-4">
      {/* Purple connector line between steps */}
      {!isLast && <div className="absolute left-[11px] top-7 bottom-0 w-0.5 bg-[#7c3aed]/30" />}

      {/* Status circle */}
      <div className="relative z-10 mt-1 flex-shrink-0">
        <div
          className={cn(
            'flex size-6 items-center justify-center rounded-full border-2',
            step.status === 'COMPLETED' && 'border-[#10b981] bg-[#10b981]',
            step.status === 'FAILED' && 'border-[#dc2626] bg-[#dc2626]',
            step.status === 'RUNNING' && 'border-[#f59e0b] bg-[#f59e0b] animate-pulse',
            step.status === 'PENDING' && 'border-[#d1d5db] bg-transparent',
            step.status === 'SKIPPED' && 'border-[#9ca3af] bg-[#9ca3af]',
          )}
        >
          {step.status === 'COMPLETED' && <Check className="size-3 text-white" />}
          {step.status === 'FAILED' && <XCircle className="size-3 text-white" />}
          {step.status === 'RUNNING' && <Loader2 className="size-3 animate-spin text-white" />}
          {step.status === 'SKIPPED' && <MinusCircle className="size-3 text-white" />}
        </div>
      </div>

      {/* Step content card */}
      <div
        className={cn(
          'mb-6 flex-1 rounded-xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
          isFailed && 'border-l-4 border-l-red-500',
          isSkipped && 'opacity-60',
        )}
      >
        {/* Step header — clickable */}
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[#f5f3ff]/50 transition-colors rounded-xl"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-foreground">
              Step {step.stepOrder}:{' '}
              <span className={cn(isSkipped && 'line-through italic')}>{agentLabel}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn('size-2 rounded-full', config.dotColor, isRunning && 'animate-pulse')}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">{config.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {step.latencyMs !== null && (
              <span className="text-xs font-mono text-muted-foreground">
                {formatLatency(step.latencyMs)}
              </span>
            )}
            {totalTokens > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                {totalTokens.toLocaleString()} tokens
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded details */}
        {isExpanded && (
          <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-4">
            {/* Skipped label */}
            {isSkipped && (
              <p className="text-sm italic text-muted-foreground">Skipped (previous step failed)</p>
            )}

            {/* Goal */}
            {step.goal && (
              <div className="rounded-lg bg-[#f5f3ff] p-3">
                <p className="text-sm text-foreground/80">{step.goal}</p>
              </div>
            )}

            {/* Error alert for failed steps */}
            {isFailed && step.error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="mt-1 text-sm text-red-700 break-words">{step.error}</p>
                </div>
              </div>
            )}

            {/* Input/Output JSON */}
            <div className="space-y-3">
              <JsonViewer data={step.input} label="Input" />
              <JsonViewer data={step.output} label="Output" />
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Model</span>
                <p className="font-mono text-xs">{step.modelId ?? '\u2014'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Turns</span>
                <p className="font-mono text-xs">{step.turns}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tokens</span>
                <p className="font-mono text-xs">
                  In: {step.inputTokens.toLocaleString()} / Out:{' '}
                  {step.outputTokens.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Started</span>
                <p className="font-mono text-xs">
                  {step.startedAt ? format(new Date(step.startedAt), 'HH:mm:ss') : '\u2014'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Completed</span>
                <p className="font-mono text-xs">
                  {step.completedAt ? format(new Date(step.completedAt), 'HH:mm:ss') : '\u2014'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Latency</span>
                <p className="font-mono text-xs">
                  {step.latencyMs !== null ? `${step.latencyMs.toLocaleString()}ms` : '\u2014'}
                </p>
              </div>
            </div>

            {/* Retry button for failed steps */}
            {isFailed && onRetry && (
              <div className="pt-2 flex gap-2">
                <Button
                  size="sm"
                  className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
                  onClick={onRetry}
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Retry from This Step
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
