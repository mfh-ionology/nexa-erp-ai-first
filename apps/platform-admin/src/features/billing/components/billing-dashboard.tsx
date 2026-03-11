// ---------------------------------------------------------------------------
// Billing Dashboard — T8 Report layout: KPI cards + charts + data table
// Story: E13b.3 Task 2.1, 2.5
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { billingKeys } from '@/hooks/use-billing';
import type { BillingOverview, TenantListItem } from '@/types/tenant';

import { BillingKpiCards } from './billing-kpi-cards';
import { EnforcementDistribution } from './enforcement-distribution';
import { BillingIssuesTable } from './billing-issues-table';

// ---------------------------------------------------------------------------
// Data fetching — fetch all tenants (paginated), compute billing aggregates
// Backend caps limit at 100, so we page through all results.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;

function useBillingDashboardData() {
  return useQuery({
    queryKey: billingKeys.overview,
    queryFn: async () => {
      const allTenants: TenantListItem[] = [];
      let offset = 0;

      while (true) {
        const result = await apiGet<TenantListItem[]>(
          `/admin/tenants?limit=${PAGE_SIZE}&offset=${offset}`,
        );
        allTenants.push(...result.data);
        if (result.data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      return allTenants;
    },
    staleTime: 30_000,
  });
}

function computeOverview(tenants: TenantListItem[]): BillingOverview {
  const active = tenants.filter((t) => t.status === 'ACTIVE');

  const statusBreakdown = { current: 0, grace: 0, overdue: 0, blocked: 0 };
  for (const t of active) {
    switch (t.billingStatus) {
      case 'CURRENT':
        statusBreakdown.current++;
        break;
      case 'GRACE':
        statusBreakdown.grace++;
        break;
      case 'OVERDUE':
        statusBreakdown.overdue++;
        break;
      case 'BLOCKED':
        statusBreakdown.blocked++;
        break;
    }
  }

  // Enforcement is derived 1:1 from billing status (see state machine reference)
  const enforcementBreakdown = {
    none: statusBreakdown.current,
    warning: statusBreakdown.grace,
    readOnly: statusBreakdown.overdue,
    suspended: statusBreakdown.blocked,
  };

  return {
    totalActive: active.length,
    statusBreakdown,
    enforcementBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingDashboard() {
  const { data: tenants = [], isLoading, isError, error } = useBillingDashboardData();

  const overview = useMemo(() => computeOverview(tenants), [tenants]);

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="billing-dashboard-loading">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
        <div className="mt-6 h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
        <div className="mt-6 h-64 animate-pulse rounded-lg border border-border bg-muted/30" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
        data-testid="billing-dashboard-error"
      >
        <p className="text-sm font-medium text-destructive">Failed to load billing data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="billing-dashboard">
      {/* KPI Cards Row */}
      <BillingKpiCards overview={overview} />

      {/* Enforcement Distribution */}
      <EnforcementDistribution overview={overview} />

      {/* Billing Issues Table */}
      <BillingIssuesTable tenants={tenants} />
    </div>
  );
}
