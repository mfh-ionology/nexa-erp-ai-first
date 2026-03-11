// ---------------------------------------------------------------------------
// Billing KPI Cards — Colour-coded payment status summary cards
// Story: E13b.3 Task 2.2
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';
import type { BillingOverview } from '@/types/tenant';

interface BillingKpiCardsProps {
  overview: BillingOverview;
}

const KPI_CARDS = [
  {
    key: 'totalActive',
    label: 'Active Tenants',
    getCount: (o: BillingOverview) => o.totalActive,
    borderColor: 'border-l-slate-400',
    textColor: 'text-slate-700',
  },
  {
    key: 'current',
    label: 'Current',
    getCount: (o: BillingOverview) => o.statusBreakdown.current,
    borderColor: 'border-l-green-500',
    textColor: 'text-green-600',
  },
  {
    key: 'grace',
    label: 'Grace Period',
    getCount: (o: BillingOverview) => o.statusBreakdown.grace,
    borderColor: 'border-l-amber-500',
    textColor: 'text-amber-500',
  },
  {
    key: 'overdue',
    label: 'Overdue',
    getCount: (o: BillingOverview) => o.statusBreakdown.overdue,
    borderColor: 'border-l-red-500',
    textColor: 'text-red-500',
  },
  {
    key: 'blocked',
    label: 'Blocked',
    getCount: (o: BillingOverview) => o.statusBreakdown.blocked,
    borderColor: 'border-l-red-700',
    textColor: 'text-red-700',
  },
] as const;

export function BillingKpiCards({ overview }: BillingKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {KPI_CARDS.map(({ key, label, getCount, borderColor, textColor }) => {
        const count = getCount(overview);
        const pct =
          key !== 'totalActive' && overview.totalActive > 0
            ? Math.round((count / overview.totalActive) * 100)
            : null;

        return (
          <div
            key={key}
            className={cn(
              'rounded-lg border border-border border-l-4 bg-background p-4 shadow-xs',
              borderColor,
            )}
            data-testid={`kpi-${key}`}
          >
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            <div className={cn('mt-1 text-2xl font-semibold tabular-nums', textColor)}>{count}</div>
            {pct !== null && (
              <div className="mt-0.5 text-xs text-muted-foreground">{pct}% of total</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
