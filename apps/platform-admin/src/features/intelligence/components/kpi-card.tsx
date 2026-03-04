import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp, Minus, AlertCircle, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendDirection = 'up' | 'down' | 'stable';

export interface KpiCardProps {
  label: string;
  value: string | number | null;
  trend?: TrendDirection;
  trendValue?: string;
  icon?: LucideIcon;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** Format value as percentage (appends %) */
  isPercentage?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TREND_CONFIG: Record<
  TrendDirection,
  { icon: LucideIcon; colorClass: string; label: string }
> = {
  up: { icon: TrendingUp, colorClass: 'text-[#10b981]', label: 'Improving' },
  down: { icon: TrendingDown, colorClass: 'text-[#ef4444]', label: 'Declining' },
  stable: { icon: Minus, colorClass: 'text-[#f59e0b]', label: 'Stable' },
};

function formatNumber(value: string | number | null, isPercentage?: boolean): string {
  if (value === null || value === undefined) return '—';

  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';

  if (isPercentage) {
    return `${num.toFixed(1)}%`;
  }

  return num.toLocaleString('en-GB');
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mb-2 h-9 w-20 animate-pulse rounded bg-muted" />
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function KpiCardError({
  label,
  onRetry,
  className,
}: {
  label: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm">Failed to load</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KpiCard({
  label,
  value,
  trend,
  trendValue,
  icon: Icon,
  isLoading,
  error,
  onRetry,
  isPercentage,
  className,
}: KpiCardProps) {
  if (isLoading) return <KpiCardSkeleton className={className} />;
  if (error) return <KpiCardError label={label} onRetry={onRetry} className={className} />;

  const trendConfig = trend ? TREND_CONFIG[trend] : null;
  const TrendIcon = trendConfig?.icon;

  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
        'transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]',
        className,
      )}
    >
      {/* Label row */}
      <div className="mb-1 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>

      {/* Value */}
      <p className="mono-amount text-[32px] font-bold leading-tight text-foreground">
        {formatNumber(value, isPercentage)}
      </p>

      {/* Trend / health indicator */}
      {trendConfig && TrendIcon && (
        <div className={cn('mt-2 flex items-center gap-1', trendConfig.colorClass)}>
          <TrendIcon className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-medium">{trendConfig.label}</span>
          {trendValue && <span className="text-xs font-medium">({trendValue})</span>}
        </div>
      )}
    </div>
  );
}
