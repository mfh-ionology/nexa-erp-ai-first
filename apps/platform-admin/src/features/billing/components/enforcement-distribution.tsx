// ---------------------------------------------------------------------------
// Enforcement Distribution — Horizontal bar chart of enforcement actions
// Story: E13b.3 Task 2.3
// ---------------------------------------------------------------------------

import { useNavigate } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import type { BillingOverview } from '@/types/tenant';

interface EnforcementDistributionProps {
  overview: BillingOverview;
}

const ENFORCEMENT_ITEMS = [
  {
    key: 'none' as const,
    label: 'None',
    barColor: 'bg-green-500',
    textColor: 'text-green-600',
    billingStatus: 'CURRENT',
  },
  {
    key: 'warning' as const,
    label: 'Warning',
    barColor: 'bg-amber-500',
    textColor: 'text-amber-500',
    billingStatus: 'GRACE',
  },
  {
    key: 'readOnly' as const,
    label: 'Read Only',
    barColor: 'bg-red-500',
    textColor: 'text-red-500',
    billingStatus: 'OVERDUE',
  },
  {
    key: 'suspended' as const,
    label: 'Suspended',
    barColor: 'bg-red-700',
    textColor: 'text-red-700',
    billingStatus: 'BLOCKED',
  },
] as const;

export function EnforcementDistribution({ overview }: EnforcementDistributionProps) {
  const navigate = useNavigate();

  const maxCount = Math.max(
    ...ENFORCEMENT_ITEMS.map(({ key }) => overview.enforcementBreakdown[key]),
    1,
  );

  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Enforcement Action Distribution
      </h3>
      <div className="space-y-3">
        {ENFORCEMENT_ITEMS.map(({ key, label, barColor, textColor, billingStatus }) => {
          const count = overview.enforcementBreakdown[key];
          const widthPct = Math.max((count / maxCount) * 100, count > 0 ? 4 : 0);

          return (
            <button
              key={key}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted/50"
              onClick={() =>
                void navigate({
                  to: '/tenants',
                  search: { billingStatus },
                })
              }
              title={`View tenants with enforcement: ${label}`}
              data-testid={`enforcement-${key}`}
            >
              <span className={cn('w-24 shrink-0 text-sm font-medium', textColor)}>{label}</span>
              <div className="h-5 flex-1 rounded-full bg-muted/30">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-8 text-right text-sm font-semibold tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
