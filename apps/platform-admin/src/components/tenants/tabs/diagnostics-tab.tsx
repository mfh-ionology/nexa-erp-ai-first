// ---------------------------------------------------------------------------
// Diagnostics Tab — Health checks and infrastructure info
// Story: E13b.2 Task 6.4
// ---------------------------------------------------------------------------

import { Stethoscope, CheckCircle2, AlertTriangle } from 'lucide-react';

import type { TenantDetail } from '@/types/tenant';

interface DiagnosticsTabProps {
  tenant: TenantDetail;
}

function DiagnosticRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'unknown';
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
      <div>
        {status === 'ok' && <CheckCircle2 className="size-5 text-green-600" />}
        {status === 'warning' && <AlertTriangle className="size-5 text-amber-500" />}
        {status === 'unknown' && <span className="text-xs text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export function DiagnosticsTab({ tenant }: DiagnosticsTabProps) {
  // Derive basic diagnostic info from the tenant record
  const isActive = tenant.status === 'ACTIVE';
  const isHealthy = isActive && tenant.billingStatus === 'CURRENT';

  return (
    <div data-testid="diagnostics-tab">
      {/* Available diagnostics from tenant record */}
      <div className="space-y-3">
        <DiagnosticRow
          label="Tenant Status"
          value={tenant.status}
          status={isActive ? 'ok' : 'warning'}
        />
        <DiagnosticRow
          label="Billing Status"
          value={tenant.billingStatus}
          status={tenant.billingStatus === 'CURRENT' ? 'ok' : 'warning'}
        />
        <DiagnosticRow label="Region" value={tenant.region} status="ok" />
        <DiagnosticRow
          label="Sandbox Mode"
          value={tenant.sandboxEnabled ? 'Enabled' : 'Disabled'}
          status={tenant.sandboxEnabled ? 'warning' : 'ok'}
        />
        <DiagnosticRow
          label="Overall Health"
          value={isHealthy ? 'Healthy' : 'Needs attention'}
          status={isHealthy ? 'ok' : 'warning'}
        />
      </div>

      {/* Placeholder for advanced diagnostics */}
      <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
        <Stethoscope className="mb-3 size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Advanced diagnostics (authentication status, webhook health, database connection) will be
          available once the diagnostics API is implemented.
        </p>
      </div>
    </div>
  );
}
