import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreakpoint } from '@/hooks/use-breakpoint';

import { useI18n } from '@nexa/i18n';

import { PageHeader } from './page-header';
import { StepIndicator } from './step-indicator';
import type { WizardPageProps } from './types';

/**
 * T6: Wizard Page template.
 *
 * Provides a multi-step wizard flow with step indicator,
 * step content area, and Back/Next/Complete navigation.
 *
 * Used for Company Setup, Payroll Run, Month-End Close,
 * and similar guided multi-step processes.
 *
 * Responsive behaviour:
 *  - Desktop (>=1024px): Vertical step nav on the left + content on the right
 *  - Tablet (768-1023px): Horizontal step indicator at top + content below
 *  - Phone (<768px): Compact progress bar at top + full-width content
 */
export function WizardPage({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  children,
  // WizardPage-specific props
  steps,
  activeStep,
  onNext,
  onBack,
  onComplete,
  isCurrentStepValid = true,
  actionBarSlot,
}: WizardPageProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  const currentStep = steps[activeStep];
  const isFirstStep = activeStep === 0;

  // Guard: steps must not be empty
  if (!currentStep) return null;
  const isLastStep = activeStep === steps.length - 1;
  const progressPercent = steps.length > 1
    ? Math.round((activeStep / (steps.length - 1)) * 100)
    : 100;

  // --- Navigation buttons ---
  const navigationButtons = (
    <div className="flex items-center justify-between gap-3">
      <div>
        {!isFirstStep && (
          <Button variant="ghost" onClick={onBack}>
            {t('previousStep')}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actionBarSlot}
        {isLastStep ? (
          <Button
            onClick={onComplete}
            disabled={!isCurrentStepValid}
          >
            {t('complete')}
          </Button>
        ) : (
          <Button
            onClick={onNext}
            disabled={!isCurrentStepValid}
          >
            {t('nextStep')}
          </Button>
        )}
      </div>
    </div>
  );

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <main className="flex flex-col gap-4" aria-label={title} aria-busy="true">
        <PageHeader
          title={title}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        <div className="flex gap-6">
          {breakpoint === 'desktop' && (
            <div className="flex w-60 shrink-0 flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-1 flex-col gap-4">
            {breakpoint !== 'desktop' && (
              <Skeleton className="h-2 w-full rounded-full" />
            )}
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </main>
    );
  }

  // --- Phone layout: compact progress bar + full-width content ---
  if (breakpoint === 'phone') {
    return (
      <main className="flex flex-col gap-4" aria-label={title}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
        />

        {/* Compact progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t('step', {
                current: activeStep + 1,
                total: steps.length,
              })}
            </span>
            <span className="font-medium text-foreground">
              {t(currentStep.labelKey)}
            </span>
          </div>
          <Progress
            value={progressPercent}
            aria-label={t('step', {
              current: activeStep + 1,
              total: steps.length,
            })}
          />
        </div>

        {/* Step content - full width */}
        <div className="flex-1" role="region" aria-label={t(currentStep.labelKey)}>
          {currentStep.content}
        </div>

        {/* Navigation */}
        {navigationButtons}

        {children}
      </main>
    );
  }

  // --- Tablet layout: horizontal step indicator top + content ---
  if (breakpoint === 'tablet') {
    return (
      <main className="flex flex-col gap-4" aria-label={title}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
        />

        {/* Overall progress bar */}
        <Progress
          value={progressPercent}
          className="h-1"
          aria-label={t('step', {
            current: activeStep + 1,
            total: steps.length,
          })}
        />

        {/* Horizontal step indicator */}
        <StepIndicator
          steps={steps}
          activeStep={activeStep}
          orientation="horizontal"
        />

        {/* Step content */}
        <div
          className="flex-1 rounded-lg border bg-card p-6"
          role="region"
          aria-label={t(currentStep.labelKey)}
        >
          {currentStep.content}
        </div>

        {/* Navigation */}
        {navigationButtons}

        {children}
      </main>
    );
  }

  // --- Desktop layout: vertical step nav left + content right ---
  return (
    <main className="flex flex-col gap-4" aria-label={title}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
      />

      {/* Overall progress bar */}
      <Progress
        value={progressPercent}
        className="h-1"
        aria-label={t('step', {
          current: activeStep + 1,
          total: steps.length,
        })}
      />

      <div className="flex gap-6">
        {/* Vertical step indicator (left side) */}
        <div className="w-60 shrink-0">
          <StepIndicator
            steps={steps}
            activeStep={activeStep}
            orientation="vertical"
          />
        </div>

        {/* Step content (right side) */}
        <div className="flex flex-1 flex-col gap-4">
          <div
            className="flex-1 rounded-lg border bg-card p-6"
            role="region"
            aria-label={t(currentStep.labelKey)}
          >
            {currentStep.content}
          </div>

          {/* Navigation */}
          {navigationButtons}
        </div>
      </div>

      {children}
    </main>
  );
}
