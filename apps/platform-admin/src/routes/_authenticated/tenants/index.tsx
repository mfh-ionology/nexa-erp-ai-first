// ---------------------------------------------------------------------------
// Tenant List Page — T1 Entity List
// Story: E13b.2 Task 2
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTenantList } from '@/hooks/use-tenants';
import { canPerformAction } from '@/lib/platform-rbac';
import { usePlatformAuthStore } from '@/stores/auth-store';
import type { BillingStatus, TenantListParams, TenantStatus } from '@/types/tenant';

const PAGE_SIZE = 25;

const TENANT_STATUS_OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: 'PROVISIONING', label: 'Provisioning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'READ_ONLY', label: 'Read Only' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const BILLING_STATUS_OPTIONS: { value: BillingStatus; label: string }[] = [
  { value: 'CURRENT', label: 'Current' },
  { value: 'GRACE', label: 'Grace' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'BLOCKED', label: 'Blocked' },
];

const PLAN_OPTIONS = [
  { value: 'core', label: 'Core' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'custom', label: 'Custom' },
];

interface TenantsSearch {
  billingStatus?: BillingStatus;
}

export const Route = createFileRoute('/_authenticated/tenants/')({
  component: TenantsPage,
  validateSearch: (search: Record<string, unknown>): TenantsSearch => ({
    ...(typeof search.billingStatus === 'string' &&
      ['CURRENT', 'GRACE', 'OVERDUE', 'BLOCKED'].includes(search.billingStatus) && {
        billingStatus: search.billingStatus as BillingStatus,
      }),
  }),
});

function TenantsPage() {
  const navigate = useNavigate();
  const { billingStatus: searchBillingStatus } = Route.useSearch();
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canCreate = userRole ? canPerformAction(userRole, 'create_tenant') : false;

  // --- Filter state ---
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('');
  const [planFilter, setPlanFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState<BillingStatus | ''>(searchBillingStatus ?? '');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);

  // --- Sort state ---
  const [sortField, setSortField] = useState<'displayName' | 'code' | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // --- Query params (server-supported filters) ---
  // Note: planId requires UUID but we only have plan codes client-side,
  // so plan filter is applied client-side alongside billing status.
  const params: TenantListParams = {
    limit: PAGE_SIZE,
    offset,
    ...(statusFilter && { status: statusFilter }),
    ...(searchQuery && { search: searchQuery }),
  };

  const { data: result, isLoading, isError, error } = useTenantList(params);
  const tenants = result?.data ?? [];
  const total = result?.meta?.total ?? 0;

  // --- Client-side filters (plan code + billing status not supported server-side) ---
  let filtered = tenants;
  if (planFilter) {
    filtered = filtered.filter((t) => t.plan?.code === planFilter);
  }
  if (billingFilter) {
    filtered = filtered.filter((t) => t.billingStatus === billingFilter);
  }

  // --- Client-side sorting ---
  const sorted = sortField
    ? [...filtered].sort((a, b) => {
        const aVal = a[sortField].toLowerCase();
        const bVal = b[sortField].toLowerCase();
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'en') : bVal.localeCompare(aVal, 'en');
      })
    : filtered;

  const hasActiveFilters = statusFilter || planFilter || billingFilter || searchQuery;
  const hasClientSideFilters = !!(billingFilter || planFilter);
  // When client-side filters are active, pagination counts are unreliable —
  // always use server total for pagination controls, show filtered count separately
  const displayTotal = total;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(displayTotal / PAGE_SIZE);

  function handleSort(field: 'displayName' | 'code') {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleSearch() {
    setSearchQuery(searchInput.trim());
    setOffset(0);
  }

  function clearFilters() {
    setStatusFilter('');
    setPlanFilter('');
    setBillingFilter('');
    setSearchInput('');
    setSearchQuery('');
    setOffset(0);
  }

  function handleRowClick(tenantId: string) {
    void navigate({ to: '/tenants/$tenantId', params: { tenantId } });
  }

  function sortIndicator(field: string) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  return (
    <div className="animate-fade-in-up p-8">
      {/* --- Header --- */}
      <div className="mb-1 text-sm text-muted-foreground">Platform Admin &gt; Tenants</div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        {canCreate && (
          <Button size="sm" data-testid="new-tenant-btn">
            <Plus className="size-4" />
            New Tenant
          </Button>
        )}
      </div>

      {/* --- Filters --- */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="tenant-search" className="sr-only">
            Search tenants
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="tenant-search"
              type="text"
              placeholder="Search name, code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
              data-testid="search-input"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch} data-testid="search-btn">
            Search
          </Button>
        </div>

        {/* Status filter */}
        <div>
          <label htmlFor="status-filter" className="sr-only">
            Status filter
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as TenantStatus | '');
              setOffset(0);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
            data-testid="status-filter"
          >
            <option value="">All Statuses</option>
            {TENANT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Plan filter */}
        <div>
          <label htmlFor="plan-filter" className="sr-only">
            Plan filter
          </label>
          <select
            id="plan-filter"
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setOffset(0);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
            data-testid="plan-filter"
          >
            <option value="">All Plans</option>
            {PLAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Billing status filter */}
        <div>
          <label htmlFor="billing-filter" className="sr-only">
            Billing status filter
          </label>
          <select
            id="billing-filter"
            value={billingFilter}
            onChange={(e) => {
              setBillingFilter(e.target.value as BillingStatus | '');
              setOffset(0);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
            data-testid="billing-filter"
          >
            <option value="">All Billing</option>
            {BILLING_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters-btn">
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {/* --- Table --- */}
      <div className="overflow-hidden rounded-lg border border-border bg-background shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th
                className="cursor-pointer px-4 py-3 hover:text-foreground"
                onClick={() => handleSort('displayName')}
                data-testid="col-displayName"
              >
                Name{sortIndicator('displayName')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 hover:text-foreground"
                onClick={() => handleSort('code')}
                data-testid="col-code"
              >
                Code{sortIndicator('code')}
              </th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3 text-right">Users</th>
              <th className="px-4 py-3">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Loading tenants...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-destructive">
                  Failed to load tenants{error instanceof Error ? `: ${error.message}` : ''}
                </td>
              </tr>
            )}
            {!isLoading && !isError && sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  {hasActiveFilters ? 'No tenants match the current filters.' : 'No tenants found.'}
                </td>
              </tr>
            )}
            {sorted.map((tenant) => (
              <tr
                key={tenant.id}
                onClick={() => handleRowClick(tenant.id)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                data-testid={`tenant-row-${tenant.id}`}
              >
                <td className="px-4 py-3 font-medium text-foreground">{tenant.displayName}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tenant.code}</td>
                <td className="px-4 py-3">
                  {tenant.plan?.displayName ?? tenant.plan?.code ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={tenant.status} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge billingStatus={tenant.billingStatus} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{tenant.userCount ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {tenant.lastActivityAt
                    ? formatDistanceToNow(new Date(tenant.lastActivityAt), { addSuffix: true })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Pagination --- */}
      {displayTotal > 0 && (
        <div
          className="mt-4 flex items-center justify-between text-sm text-muted-foreground"
          data-testid="pagination"
        >
          <span>
            {hasClientSideFilters
              ? `Showing ${sorted.length} filtered result${sorted.length === 1 ? '' : 's'} on this page (${displayTotal} total)`
              : `Showing ${Math.min(offset + 1, displayTotal)}\u2013${Math.min(offset + PAGE_SIZE, displayTotal)} of ${displayTotal} tenants`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              data-testid="prev-page-btn"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= displayTotal}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              data-testid="next-page-btn"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
