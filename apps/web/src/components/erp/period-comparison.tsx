import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

export interface PeriodComparisonProps {
  /** Current period value (numeric string) */
  current: string;
  /** Previous period value (numeric string) */
  previous: string;
  /** Format type — used to determine display suffix */
  format: 'currency' | 'number' | 'percent';
}

/**
 * Displays a metric with period-over-period comparison.
 *
 * Shows the current value, a directional arrow (up/down/neutral),
 * percentage change, and colour coding (green positive, red negative).
 */
export function PeriodComparison({
  current,
  previous,
  format,
}: PeriodComparisonProps) {
  const { t } = useI18n();

  const currentNum = Number(current);
  const previousNum = Number(previous);

  const isValidCurrent = !Number.isNaN(currentNum) && Number.isFinite(currentNum);
  const isValidPrevious = !Number.isNaN(previousNum) && Number.isFinite(previousNum);

  // Calculate percentage change
  let percentChange = 0;
  let direction: 'up' | 'down' | 'neutral' = 'neutral';

  if (isValidCurrent && isValidPrevious && previousNum !== 0) {
    percentChange = ((currentNum - previousNum) / Math.abs(previousNum)) * 100;
    if (percentChange > 0) {
      direction = 'up';
    } else if (percentChange < 0) {
      direction = 'down';
    }
  }

  const absChange = Math.abs(percentChange);
  const changeText = `${absChange.toFixed(1)}%`;

  // Format suffix for ARIA description
  const formatSuffix = format === 'percent' ? '%' : '';

  const ariaLabel = t('periodComparison.ariaLabel', {
    current: `${current}${formatSuffix}`,
    previous: `${previous}${formatSuffix}`,
    direction: direction === 'up' ? t('periodComparison.up') : direction === 'down' ? t('periodComparison.down') : t('periodComparison.neutral'),
    change: changeText,
  });

  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium',
        direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
        direction === 'down' && 'text-red-600 dark:text-red-400',
        direction === 'neutral' && 'text-muted-foreground',
      )}
      aria-label={ariaLabel}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{direction === 'down' ? '-' : ''}{changeText}</span>
    </span>
  );
}
