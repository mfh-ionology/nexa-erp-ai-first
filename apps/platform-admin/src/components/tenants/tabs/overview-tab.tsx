// ---------------------------------------------------------------------------
// Overview Tab — Read-only tenant information display
// Story: E13b.2 Task 3.4
// ---------------------------------------------------------------------------

import { formatDistanceToNow, format } from 'date-fns';

import { StatusBadge } from '@/components/ui/status-badge';
import type { TenantDetail } from '@/types/tenant';

interface OverviewTabProps {
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

export function OverviewTab({ tenant }: OverviewTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="overview-tab">
      {/* Identity */}
      <div className="rounded-lg border border-border bg-background p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Identity
        </h3>
        <dl className="space-y-3">
          <Field label="Display Name">{tenant.displayName}</Field>
          <Field label="Code">
            <span className="font-mono text-xs">{tenant.code}</span>
          </Field>
          <Field label="Legal Name">{tenant.legalName ?? '—'}</Field>
        </dl>
      </div>

      {/* Status & Plan */}
      <div className="rounded-lg border border-border bg-background p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Status &amp; Plan
        </h3>
        <dl className="space-y-3">
          <Field label="Status">
            <StatusBadge status={tenant.status} />
          </Field>
          <Field label="Plan">
            <span>{tenant.plan?.displayName ?? tenant.plan?.code ?? '—'}</span>
            {(tenant.plan?.maxUsers != null ||
              tenant.plan?.maxCompanies != null ||
              tenant.plan?.monthlyAiTokenAllowance != null) && (
              <span className="mt-1 block text-xs text-muted-foreground">
                {tenant.plan?.maxUsers != null && `${tenant.plan.maxUsers} users`}
                {tenant.plan?.maxUsers != null && tenant.plan?.maxCompanies != null && ' · '}
                {tenant.plan?.maxCompanies != null && `${tenant.plan.maxCompanies} companies`}
                {(tenant.plan?.maxUsers != null || tenant.plan?.maxCompanies != null) &&
                  tenant.plan?.monthlyAiTokenAllowance != null &&
                  ' · '}
                {tenant.plan?.monthlyAiTokenAllowance != null &&
                  `${tenant.plan.monthlyAiTokenAllowance.toLocaleString()} AI tokens/mo`}
              </span>
            )}
          </Field>
          <Field label="Billing Status">
            <StatusBadge billingStatus={tenant.billingStatus} />
          </Field>
        </dl>
      </div>

      {/* Infrastructure */}
      <div className="rounded-lg border border-border bg-background p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Infrastructure
        </h3>
        <dl className="space-y-3">
          <Field label="Region">{tenant.region}</Field>
          <Field label="Sandbox Mode">
            <span
              className={
                tenant.sandboxEnabled ? 'text-amber-500 font-medium' : 'text-muted-foreground'
              }
            >
              {tenant.sandboxEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </Field>
        </dl>
      </div>

      {/* Timestamps */}
      <div className="rounded-lg border border-border bg-background p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Timestamps
        </h3>
        <dl className="space-y-3">
          <Field label="Created">{format(new Date(tenant.createdAt), 'dd MMM yyyy, HH:mm')}</Field>
          <Field label="Last Activity">
            {tenant.lastActivityAt
              ? formatDistanceToNow(new Date(tenant.lastActivityAt), { addSuffix: true })
              : '—'}
          </Field>
        </dl>
      </div>
    </div>
  );
}
