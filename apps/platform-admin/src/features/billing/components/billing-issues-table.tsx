// ---------------------------------------------------------------------------
// Billing Issues Table — Tenants with non-current billing status
// Story: E13b.3 Task 2.4
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useUpdateEnforcement } from '@/hooks/use-billing';
import { canPerformAction } from '@/lib/platform-rbac';
import { usePlatformAuthStore } from '@/stores/auth-store';
import type { BillingStatus, EnforcementAction, TenantListItem } from '@/types/tenant';
import { EnforcementDialog } from './enforcement-dialog';

interface BillingIssuesTableProps {
  tenants: TenantListItem[];
}

// ---------------------------------------------------------------------------
// Mappings — derive enforcement / dunning from billing status (1:1 mapping).
// NOTE: This is an approximation. The list endpoint does not return
// enforcementAction directly; we derive it from billingStatus. If an admin
// manually overrides enforcement without the billing status updating
// simultaneously, counts may be slightly inaccurate. For precise data, use
// the per-tenant billing detail endpoint.
// ---------------------------------------------------------------------------

const BILLING_TO_ENFORCEMENT: Record<BillingStatus, EnforcementAction> = {
  CURRENT: 'NONE',
  GRACE: 'WARNING',
  OVERDUE: 'READ_ONLY',
  BLOCKED: 'SUSPENDED',
};

const BILLING_TO_DUNNING: Record<BillingStatus, number> = {
  CURRENT: 0,
  GRACE: 1,
  OVERDUE: 2,
  BLOCKED: 3,
};

const ENFORCEMENT_LABELS: Record<EnforcementAction, string> = {
  NONE: 'None',
  WARNING: 'Warning',
  READ_ONLY: 'Read Only',
  SUSPENDED: 'Suspended',
};

export function BillingIssuesTable({ tenants }: BillingIssuesTableProps) {
  const navigate = useNavigate();
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canModifyEnforcement =
    !!userRole && canPerformAction(userRole, 'modify_billing_enforcement');

  const updateEnforcement = useUpdateEnforcement();

  // Enforcement dialog state
  const [dialogTenantId, setDialogTenantId] = useState<string | null>(null);

  // Filter & sort: non-current tenants, sorted by dunning level DESC
  const issues = tenants
    .filter((t) => t.billingStatus !== 'CURRENT')
    .sort((a, b) => BILLING_TO_DUNNING[b.billingStatus] - BILLING_TO_DUNNING[a.billingStatus]);

  const dialogTenant = dialogTenantId ? issues.find((t) => t.id === dialogTenantId) : null;
  const dialogCurrentAction = dialogTenant
    ? BILLING_TO_ENFORCEMENT[dialogTenant.billingStatus]
    : 'NONE';

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-8 text-center text-sm text-muted-foreground">
        All tenants are in good standing — no billing issues.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background shadow-xs">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Billing Issues
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Billing Status</th>
              <th className="px-4 py-3">Dunning Level</th>
              <th className="px-4 py-3">Enforcement</th>
              <th className="px-4 py-3">Last Payment</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((tenant) => {
              const enforcement = BILLING_TO_ENFORCEMENT[tenant.billingStatus];
              const dunningLevel = BILLING_TO_DUNNING[tenant.billingStatus];

              return (
                <tr key={tenant.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <button
                          className="font-medium text-primary hover:underline"
                          onClick={() =>
                            void navigate({
                              to: '/tenants/$tenantId',
                              params: { tenantId: tenant.id },
                            })
                          }
                          data-testid={`tenant-link-${tenant.id}`}
                        >
                          {tenant.displayName}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {tenant.plan?.displayName ?? tenant.plan?.code ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge billingStatus={tenant.billingStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        dunningLevel >= 2
                          ? 'font-medium text-red-600'
                          : dunningLevel === 1
                            ? 'font-medium text-amber-500'
                            : ''
                      }
                    >
                      Level {dunningLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        enforcement === 'NONE'
                          ? 'text-green-600'
                          : enforcement === 'WARNING'
                            ? 'text-amber-500'
                            : 'font-medium text-red-600'
                      }
                    >
                      {ENFORCEMENT_LABELS[enforcement]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canModifyEnforcement && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialogTenantId(tenant.id)}
                          data-testid={`change-enforcement-${tenant.id}`}
                        >
                          Change Enforcement
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void navigate({
                            to: '/tenants/$tenantId',
                            params: { tenantId: tenant.id },
                          })
                        }
                        data-testid={`view-details-${tenant.id}`}
                      >
                        View Details
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Enforcement Dialog — reused from billing tab */}
      <EnforcementDialog
        open={!!dialogTenantId}
        onOpenChange={(open) => {
          if (!open) setDialogTenantId(null);
        }}
        currentAction={dialogCurrentAction}
        loading={updateEnforcement.isPending}
        onConfirm={(params) => {
          if (!dialogTenantId) return;
          updateEnforcement.mutate(
            {
              id: dialogTenantId,
              enforcementAction: params.enforcementAction,
              reason: params.reason,
              gracePeriodDays: params.gracePeriodDays,
            },
            {
              onSuccess: (result) => {
                const data = result.data;
                toast.success(`Enforcement changed: ${data.previousAction} → ${data.newAction}`);
                setDialogTenantId(null);
              },
            },
          );
        }}
      />
    </div>
  );
}
