// ---------------------------------------------------------------------------
// Quota Progress Bar — Reusable horizontal bar with soft/hard limit markers
// Story E13b-4 Task 6.3 (AC#2)
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuotaProgressBarProps {
  tokensUsed: number;
  tokenAllowance: number;
  softLimitPct?: number;
  hardLimitPct?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-GB');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuotaProgressBar({
  tokensUsed,
  tokenAllowance,
  softLimitPct = 80,
  hardLimitPct = 100,
  className,
}: QuotaProgressBarProps) {
  const quotaPct = tokenAllowance > 0 ? Math.round((tokensUsed / tokenAllowance) * 10000) / 100 : 0;

  // Determine bar colour based on thresholds
  let barColour = 'bg-emerald-500';
  if (quotaPct >= hardLimitPct) {
    barColour = 'bg-red-600';
  } else if (quotaPct >= softLimitPct) {
    barColour = 'bg-amber-500';
  }

  return (
    <div className={cn('space-y-2', className)} data-testid="quota-progress-bar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Token Quota</p>
        <p className="text-sm font-medium text-foreground" data-testid="quota-label">
          {formatTokens(tokensUsed)} / {formatTokens(tokenAllowance)} tokens ({quotaPct.toFixed(1)}
          %)
        </p>
      </div>

      {/* Bar container */}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
        {/* Used bar */}
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColour)}
          style={{ width: `${Math.min(quotaPct, 100)}%` }}
          role="progressbar"
          aria-valuenow={Math.min(quotaPct, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Token usage: ${quotaPct.toFixed(1)}%`}
        />

        {/* Soft limit marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-500/70"
          style={{ left: `${Math.min(softLimitPct, 100)}%` }}
          title={`Soft limit: ${softLimitPct}%`}
          data-testid="soft-limit-marker"
        />

        {/* Hard limit marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-600/70"
          style={{ left: `${Math.min(hardLimitPct, 100)}%` }}
          title={`Hard limit: ${hardLimitPct}%`}
          data-testid="hard-limit-marker"
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-emerald-500" />
          Normal (&lt; {softLimitPct}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-amber-500" />
          Soft limit ({softLimitPct}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-red-600" />
          Hard limit ({hardLimitPct}%)
        </span>
      </div>
    </div>
  );
}
