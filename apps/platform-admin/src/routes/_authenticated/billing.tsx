// ---------------------------------------------------------------------------
// Billing Page — Payment status and enforcement overview dashboard
// Story: E13b.3 Task 2.1
// ---------------------------------------------------------------------------

import { createFileRoute } from '@tanstack/react-router';

import { BillingDashboard } from '@/features/billing/components/billing-dashboard';

export const Route = createFileRoute('/_authenticated/billing')({
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="animate-fade-in-up p-8">
      {/* Breadcrumb */}
      <div className="mb-1 text-sm text-muted-foreground">Platform Admin &gt; Billing</div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payment status and enforcement overview across all tenants
        </p>
      </div>

      {/* Dashboard */}
      <BillingDashboard />
    </div>
  );
}
