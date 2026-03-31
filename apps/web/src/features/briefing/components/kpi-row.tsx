import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { BriefingKpi } from '../api/use-briefing';

// ---------------------------------------------------------------------------
// Trend icon helper
// ---------------------------------------------------------------------------

function TrendIndicator({ trend }: { trend: BriefingKpi['trend'] }) {
  if (!trend) return null;

  const Icon =
    trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : ArrowRight;

  return (
    <span
      className={cn(
        'mt-1 inline-flex items-center gap-0.5 text-xs font-medium',
        trend.positive ? 'text-emerald-600' : 'text-red-600',
        trend.direction === 'flat' && 'text-muted-foreground',
      )}
      aria-label={`${trend.direction} ${trend.value}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {trend.value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface KpiRowProps {
  kpis: BriefingKpi[];
}

export function KpiRow({ kpis }: KpiRowProps) {
  if (kpis.length === 0) return null;

  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-4"
      role="region"
      aria-label="Key performance indicators"
    >
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className={cn(
            'rounded-xl bg-white p-4',
            'shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
            'transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.1)]',
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
          <p className="mt-1 font-mono text-xl font-bold text-foreground">{kpi.value}</p>
          <TrendIndicator trend={kpi.trend} />
        </div>
      ))}
    </div>
  );
}
