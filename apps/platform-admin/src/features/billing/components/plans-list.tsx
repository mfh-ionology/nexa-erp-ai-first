// ---------------------------------------------------------------------------
// Plans List — Card grid displaying subscription plans
// Story: E13b.3 Task 3.2
// ---------------------------------------------------------------------------

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { canPerformAction } from '@/lib/platform-rbac';
import { cn } from '@/lib/utils';
import { usePlatformAuthStore } from '@/stores/auth-store';
import type { Plan } from '@/types/tenant';

import { PlanFormDialog } from './plan-form-dialog';

interface PlansListProps {
  plans: Plan[];
}

/** Known module keys for display labels */
const MODULE_LABELS: Record<string, string> = {
  system: 'System',
  finance: 'Finance',
  ar: 'AR',
  ap: 'AP',
  sales: 'Sales',
  purchasing: 'Purchasing',
  inventory: 'Inventory',
  crm: 'CRM',
  hr_payroll: 'HR/Payroll',
  manufacturing: 'Manufacturing',
  reporting: 'Reporting',
};

function formatTokenAllowance(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('en-GB');
}

export function PlansList({ plans }: PlansListProps) {
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canEdit = !!userRole && canPerformAction(userRole, 'update_plan');

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Sort: active first, then by displayName
  const sorted = [...plans].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-8 text-center text-sm text-muted-foreground">
        No plans configured yet. Create your first plan to get started.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="plans-grid">
        {sorted.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'rounded-lg border border-border bg-background p-5 shadow-xs transition-shadow hover:shadow-md',
              !plan.isActive && 'opacity-60',
            )}
            data-testid={`plan-card-${plan.code}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">{plan.displayName}</h3>
                <code className="text-xs text-muted-foreground">{plan.code}</code>
              </div>
              <div className="flex items-center gap-2">
                {plan.isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Inactive
                  </span>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditingPlan(plan)}
                    aria-label={`Edit plan ${plan.displayName}`}
                    data-testid={`edit-plan-${plan.code}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  </Button>
                )}
              </div>
            </div>

            {/* Limits */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Max Users</span>
                <div className="font-medium tabular-nums">{plan.maxUsers ?? '—'}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Max Companies</span>
                <div className="font-medium tabular-nums">{plan.maxCompanies ?? '—'}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">AI Token Allowance</span>
                <div className="font-medium tabular-nums">
                  {formatTokenAllowance(plan.monthlyAiTokenAllowance)}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">API Rate Limit</span>
                <div className="font-medium tabular-nums">{plan.apiRateLimit ?? 1000}/min</div>
              </div>
            </div>

            {/* Enabled Modules */}
            {plan.enabledModules && plan.enabledModules.length > 0 && (
              <div className="mt-4">
                <span className="text-xs text-muted-foreground">Enabled Modules</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {plan.enabledModules.map((mod) => (
                    <span
                      key={mod}
                      className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
                    >
                      {MODULE_LABELS[mod] ?? mod}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Plan Dialog */}
      {editingPlan && (
        <PlanFormDialog open={true} onClose={() => setEditingPlan(null)} plan={editingPlan} />
      )}
    </>
  );
}
