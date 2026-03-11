// ---------------------------------------------------------------------------
// EnforcementTimeline — Visual step indicator for enforcement escalation levels
// Shows NONE → WARNING → READ_ONLY → SUSPENDED with current level highlighted
// Story: E13b.3 Task 4.3
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';
import type { EnforcementAction } from '@/types/tenant';

const ENFORCEMENT_STEPS: {
  action: EnforcementAction;
  label: string;
  colour: string;
  activeBg: string;
  description: string;
}[] = [
  {
    action: 'NONE',
    label: 'None',
    colour: 'text-green-600',
    activeBg: 'bg-green-600',
    description: 'Normal operation — no restrictions',
  },
  {
    action: 'WARNING',
    label: 'Warning',
    colour: 'text-amber-500',
    activeBg: 'bg-amber-500',
    description: 'Payment overdue — grace period active. Warning banner shown in tenant ERP.',
  },
  {
    action: 'READ_ONLY',
    label: 'Read Only',
    colour: 'text-red-500',
    activeBg: 'bg-red-500',
    description: 'Grace period expired — all write operations blocked. Tenant can view data only.',
  },
  {
    action: 'SUSPENDED',
    label: 'Suspended',
    colour: 'text-red-700',
    activeBg: 'bg-red-700',
    description: 'Hard stop — login blocked, data inaccessible.',
  },
];

interface EnforcementTimelineProps {
  currentAction: EnforcementAction;
}

export function EnforcementTimeline({ currentAction }: EnforcementTimelineProps) {
  const currentIndex = ENFORCEMENT_STEPS.findIndex((s) => s.action === currentAction);
  const currentStep = ENFORCEMENT_STEPS[currentIndex] ?? ENFORCEMENT_STEPS[0];

  return (
    <div data-testid="enforcement-timeline">
      {/* Step indicators with connecting arrows */}
      <div className="flex items-center justify-between">
        {ENFORCEMENT_STEPS.map((step, idx) => {
          const isActive = step.action === currentAction;
          const isPast = idx < currentIndex;

          return (
            <div key={step.action} className="flex items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                    isActive
                      ? `${step.activeBg} border-transparent text-white`
                      : isPast
                        ? 'border-slate-300 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-400',
                  )}
                  data-testid={`timeline-step-${step.action}`}
                >
                  {idx + 1}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-xs font-medium',
                    isActive ? step.colour : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting arrow (not after last step) */}
              {idx < ENFORCEMENT_STEPS.length - 1 && (
                <div className="mx-2 flex items-center" aria-hidden="true">
                  <div
                    className={cn(
                      'h-0.5 w-6 sm:w-10',
                      idx < currentIndex ? 'bg-slate-300' : 'bg-slate-200',
                    )}
                  />
                  <div
                    className={cn(
                      'h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent',
                      idx < currentIndex ? 'border-l-slate-300' : 'border-l-slate-200',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current state description */}
      <div
        className={cn(
          'mt-4 rounded-md border px-3 py-2 text-sm',
          currentAction === 'NONE'
            ? 'border-green-200 bg-green-50 text-green-700'
            : currentAction === 'WARNING'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : currentAction === 'READ_ONLY'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-red-300 bg-red-50 text-red-800',
        )}
        data-testid="enforcement-description"
      >
        <span className="font-medium">Current state:</span> {currentStep?.description}
      </div>
    </div>
  );
}
