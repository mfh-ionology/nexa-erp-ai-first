// ---------------------------------------------------------------------------
// Billing Tab — Subscription status, enforcement controls, plan assignment
// Refactored to use billing hooks, enforcement timeline, dialog-based controls
// Story: E13b.3 Task 4
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { usePlatformAuthStore } from '@/stores/auth-store';
import { canPerformAction } from '@/lib/platform-rbac';
import type { TenantDetail } from '@/types/tenant';
import {
  useTenantBilling,
  useUpdateEnforcement,
  usePlans,
  useAssignPlan,
} from '@/hooks/use-billing';
import { EnforcementTimeline } from '@/features/billing/components/enforcement-timeline';
import { EnforcementDialog } from '@/features/billing/components/enforcement-dialog';
import { AssignPlanDialog } from '@/features/billing/components/assign-plan-dialog';

interface BillingTabProps {
  tenant: TenantDetail;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function BillingTab({ tenant }: BillingTabProps) {
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canModifyEnforcement =
    !!userRole && canPerformAction(userRole, 'modify_billing_enforcement');
  const canAssignPlan = !!userRole && canPerformAction(userRole, 'assign_plan');

  // Use billing detail hook for full data (includes lastPaymentAt, stripeCustomerId)
  const { data: billingDetailResult } = useTenantBilling(tenant.id);
  const billingDetail = billingDetailResult?.data;

  // Fall back to embedded billing data from tenant detail
  const billing = billingDetail ?? tenant.billing;

  // Hooks for mutations
  const updateEnforcement = useUpdateEnforcement();
  const assignPlan = useAssignPlan();

  // Fetch available plans for assignment dialog (skip for viewers who can't assign)
  const { data: plansResult } = usePlans({ active: true }, { enabled: canAssignPlan });
  const availablePlans = plansResult?.data ?? [];

  // Dialog state
  const [enforcementDialogOpen, setEnforcementDialogOpen] = useState(false);
  const [assignPlanDialogOpen, setAssignPlanDialogOpen] = useState(false);

  // No billing data — show what's available from the tenant record
  if (!billing) {
    return (
      <div data-testid="billing-tab">
        <div className="rounded-lg border border-border bg-background p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Billing Overview
          </h3>
          <dl className="space-y-3">
            <Field label="Billing Status">
              <StatusBadge billingStatus={tenant.billingStatus} />
            </Field>
            <Field label="Plan">{tenant.plan?.displayName ?? '—'}</Field>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Detailed billing information will be available once the billing record is provisioned
            for this tenant.
          </p>
        </div>
      </div>
    );
  }

  // Determine lastPaymentAt — only available from billingDetail (full response)
  const lastPaymentAt = billingDetail?.lastPaymentAt ?? null;

  return (
    <div data-testid="billing-tab">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Info */}
        <div className="rounded-lg border border-border bg-background p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Subscription
          </h3>
          <dl className="space-y-3">
            <Field label="Billing Status">
              <StatusBadge billingStatus={tenant.billingStatus} />
            </Field>
            <Field label="Plan">{tenant.plan?.displayName ?? '—'}</Field>
            <Field label="Subscription Status">{billing.subscriptionStatus ?? '—'}</Field>
            <Field label="Current Period End">
              {billing.currentPeriodEnd
                ? format(new Date(billing.currentPeriodEnd), 'dd MMM yyyy')
                : '—'}
            </Field>
            <Field label="Last Payment">
              {lastPaymentAt ? (
                <span title={format(new Date(lastPaymentAt), 'dd MMM yyyy HH:mm')}>
                  {formatDistanceToNow(new Date(lastPaymentAt), {
                    addSuffix: true,
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">No payment recorded</span>
              )}
            </Field>
          </dl>

          {/* Assign Plan button — PLATFORM_ADMIN only */}
          {canAssignPlan && tenant.plan && (
            <div className="mt-4 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignPlanDialogOpen(true)}
                data-testid="change-plan-btn"
              >
                Change Plan
              </Button>
            </div>
          )}
        </div>

        {/* Enforcement & Dunning */}
        <div className="rounded-lg border border-border bg-background p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Enforcement &amp; Dunning
          </h3>
          <dl className="space-y-3">
            <Field label="Dunning Level">
              <span className={billing.dunningLevel > 0 ? 'text-amber-500 font-medium' : ''}>
                Level {billing.dunningLevel}
              </span>
            </Field>
            <Field label="Grace Period">{billing.gracePeriodDays} days</Field>
          </dl>

          {/* Enforcement escalation timeline */}
          <div className="mt-4">
            <EnforcementTimeline currentAction={billing.enforcementAction} />
          </div>

          {/* Enforcement control — PLATFORM_ADMIN only */}
          {canModifyEnforcement && (
            <div className="mt-4 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEnforcementDialogOpen(true)}
                data-testid="change-enforcement-btn"
              >
                Change Enforcement
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Enforcement Dialog */}
      <EnforcementDialog
        open={enforcementDialogOpen}
        onOpenChange={setEnforcementDialogOpen}
        currentAction={billing.enforcementAction}
        loading={updateEnforcement.isPending}
        onConfirm={(params) => {
          updateEnforcement.mutate(
            {
              id: tenant.id,
              enforcementAction: params.enforcementAction,
              reason: params.reason,
              gracePeriodDays: params.gracePeriodDays,
            },
            {
              onSuccess: (result) => {
                const data = result.data;
                toast.success(
                  `Enforcement changed from ${data.previousAction} to ${data.newAction}`,
                );
                setEnforcementDialogOpen(false);
              },
            },
          );
        }}
      />

      {/* Assign Plan Dialog */}
      {tenant.plan && (
        <AssignPlanDialog
          open={assignPlanDialogOpen}
          onOpenChange={setAssignPlanDialogOpen}
          currentPlan={tenant.plan}
          availablePlans={availablePlans}
          loading={assignPlan.isPending}
          onConfirm={(params) => {
            assignPlan.mutate(
              { id: tenant.id, ...params },
              {
                onSuccess: (result) => {
                  const data = result.data;
                  toast.success(`Plan changed from ${data.oldPlanCode} to ${data.newPlanCode}`);
                  setAssignPlanDialogOpen(false);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}
