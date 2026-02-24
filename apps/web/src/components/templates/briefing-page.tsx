import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BriefingCard } from '@/components/erp/briefing-card';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { PageHeader } from './page-header';
import type { BriefingPageProps, SummaryMetric } from './types';

/**
 * T4: Briefing Page template.
 *
 * Provides the AI briefing dashboard with a greeting section,
 * summary metrics row, and a responsive card grid for KPI,
 * action, and alert cards.
 *
 * This template powers "The Briefing" — the AI home screen.
 */
export function BriefingPage({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  children,
  // BriefingPage-specific props
  cards,
  greetingKey,
  userName,
  summaryMetrics = [],
}: BriefingPageProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <main className="flex flex-col gap-6" aria-label={title} aria-busy="true">
        <PageHeader
          title={title}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        {/* Greeting skeleton */}
        <Skeleton className="h-8 w-64" />
        {/* Metrics skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6" aria-label={title}>
      {/* Page header with breadcrumbs */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        isLoading={isLoading}
      />

      {/* Greeting section */}
      {greetingKey && (
        <p
          className={cn(
            'font-semibold tracking-tight text-foreground',
            breakpoint === 'phone' ? 'text-xl' : 'text-2xl',
          )}
        >
          {t(greetingKey, { name: userName ?? '' })}
        </p>
      )}

      {/* Summary metrics row */}
      {summaryMetrics.length > 0 && (
        <section aria-label={t('briefing.summaryMetrics')}>
          <div
            className={cn(
              'grid gap-4',
              breakpoint === 'phone'
                ? 'grid-cols-1'
                : breakpoint === 'tablet'
                  ? 'grid-cols-2'
                  : undefined,
            )}
            style={
              breakpoint === 'desktop'
                ? { gridTemplateColumns: `repeat(${Math.min(summaryMetrics.length, 4)}, minmax(0, 1fr))` }
                : undefined
            }
          >
            {summaryMetrics.map((metric) => (
              <SummaryMetricCard key={metric.labelKey} metric={metric} />
            ))}
          </div>
        </section>
      )}

      {/* Card grid — responsive: 1 col phone, 2 cols tablet, 3 cols desktop */}
      {cards.length > 0 && (
        <section aria-label={t('briefing.cards')}>
          <div
            className={cn(
              'grid gap-4',
              breakpoint === 'phone'
                ? 'grid-cols-1'
                : breakpoint === 'tablet'
                  ? 'grid-cols-2'
                  : 'grid-cols-3',
            )}
          >
            {cards.map((card) => (
              <BriefingCard key={card.id} config={card} />
            ))}
          </div>
        </section>
      )}

      {/* Children slot for additional content */}
      {children}
    </main>
  );
}

// --- Internal sub-component ---

function SummaryMetricCard({ metric }: { metric: SummaryMetric }) {
  const { t } = useI18n();

  const TrendIcon =
    metric.trend === 'up'
      ? TrendingUp
      : metric.trend === 'down'
        ? TrendingDown
        : Minus;

  const trendColor =
    metric.trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : metric.trend === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';

  // Calculate percentage change for display
  let changeText: string | undefined;
  if (metric.previousValue) {
    const current = Number(metric.value);
    const previous = Number(metric.previousValue);
    if (!Number.isNaN(current) && !Number.isNaN(previous) && previous !== 0) {
      const change = ((current - previous) / Math.abs(previous)) * 100;
      changeText = `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
    }
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t(metric.labelKey)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">
            {metric.value}
          </span>
          {metric.trend && (
            <span className={cn('inline-flex items-center gap-1 text-sm font-medium', trendColor)}>
              <TrendIcon className="size-3.5" aria-hidden="true" />
              {changeText && <span>{changeText}</span>}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
