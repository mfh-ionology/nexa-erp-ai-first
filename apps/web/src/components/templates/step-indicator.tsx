import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import type { WizardStep } from './types';

export interface StepIndicatorProps {
  /** Step definitions */
  steps: WizardStep[];
  /** Current active step index (0-based) */
  activeStep: number;
  /** Layout orientation */
  orientation: 'horizontal' | 'vertical';
}

/**
 * Step indicator for the Wizard (T6) template.
 *
 * Renders numbered steps with labels. Completed steps show a
 * checkmark (green), the current step is highlighted (purple),
 * and future steps are greyed out. Connecting lines between
 * steps are solid for completed and dashed for future.
 */
export function StepIndicator({
  steps,
  activeStep,
  orientation,
}: StepIndicatorProps) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t('step', {
        current: activeStep + 1,
        total: steps.length,
      })}
      className={cn(
        'flex',
        orientation === 'vertical'
          ? 'flex-col gap-0'
          : 'items-start gap-0',
      )}
    >
      {steps.map((step, index) => {
        const isCompleted = index < activeStep;
        const isCurrent = index === activeStep;
        const isFuture = index > activeStep;

        return (
          <div
            key={step.key}
            className={cn(
              'flex',
              orientation === 'vertical'
                ? 'flex-row items-stretch'
                : 'flex-col items-center flex-1',
            )}
          >
            {/* Step circle + connector */}
            <div
              className={cn(
                'flex items-center',
                orientation === 'vertical'
                  ? 'flex-col'
                  : 'flex-row w-full',
              )}
            >
              {/* Connector before (not on first step) */}
              {index > 0 && (
                <div
                  className={cn(
                    orientation === 'vertical'
                      ? 'w-0.5 h-6'
                      : 'h-0.5 flex-1',
                    isCompleted || isCurrent
                      ? 'bg-primary'
                      : 'border-dashed',
                    isFuture && orientation === 'vertical' && 'border-l-2 border-dashed border-muted-foreground/30',
                    isFuture && orientation === 'horizontal' && 'border-t-2 border-dashed border-muted-foreground/30',
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step circle */}
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  'size-8',
                  isCompleted && 'bg-emerald-600 text-white dark:bg-emerald-500',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/20',
                  isFuture && 'border-2 border-muted-foreground/30 text-muted-foreground',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Connector after (not on last step) */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    orientation === 'vertical'
                      ? 'w-0.5 h-6'
                      : 'h-0.5 flex-1',
                    isCompleted
                      ? 'bg-primary'
                      : 'border-dashed',
                    !isCompleted && orientation === 'vertical' && 'border-l-2 border-dashed border-muted-foreground/30',
                    !isCompleted && orientation === 'horizontal' && 'border-t-2 border-dashed border-muted-foreground/30',
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Step label + description */}
            <div
              className={cn(
                orientation === 'vertical'
                  ? 'ml-3 py-3 flex flex-col justify-center min-h-[3.75rem]'
                  : 'mt-2 text-center px-1',
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium leading-tight',
                  isCurrent && 'text-primary',
                  isCompleted && 'text-foreground',
                  isFuture && 'text-muted-foreground',
                )}
              >
                {t(step.labelKey)}
              </span>
              {step.descriptionKey && orientation === 'vertical' && (
                <span className="text-xs text-muted-foreground mt-0.5">
                  {t(step.descriptionKey)}
                </span>
              )}
              {step.isOptional && (
                <span className="text-xs text-muted-foreground">
                  {t('optional')}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
