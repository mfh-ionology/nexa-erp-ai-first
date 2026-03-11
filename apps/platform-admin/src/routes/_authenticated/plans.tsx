// ---------------------------------------------------------------------------
// Plans Page — Manage subscription plans and feature entitlements
// Story: E13b.3 Task 3.1, 3.5
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { PlanFormDialog } from '@/features/billing/components/plan-form-dialog';
import { PlansList } from '@/features/billing/components/plans-list';
import { usePlans } from '@/hooks/use-billing';
import { canPerformAction } from '@/lib/platform-rbac';
import { usePlatformAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/_authenticated/plans')({
  component: PlansPage,
});

function PlansPage() {
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canCreate = !!userRole && canPerformAction(userRole, 'create_plan');

  const { data: result, isLoading, isError, error } = usePlans();
  const plans = result?.data ?? [];

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="animate-fade-in-up p-8">
      {/* Breadcrumb */}
      <div className="mb-1 text-sm text-muted-foreground">Platform Admin &gt; Plans</div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage subscription plans and feature entitlements
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} data-testid="create-plan-button">
            + New Plan
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading && (
        <div data-testid="plans-loading">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-lg border border-border bg-muted/30"
              />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
          data-testid="plans-error"
        >
          <p className="text-sm font-medium text-destructive">Failed to load plans</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      )}

      {!isLoading && !isError && <PlansList plans={plans} />}

      {/* Create Plan Dialog */}
      {showCreateDialog && (
        <PlanFormDialog open={true} onClose={() => setShowCreateDialog(false)} />
      )}
    </div>
  );
}
