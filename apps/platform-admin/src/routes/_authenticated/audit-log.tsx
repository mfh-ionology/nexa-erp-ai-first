// ---------------------------------------------------------------------------
// Audit Log Page — T1 Entity List with filters, CSV export, infinite scroll
// Source: API Contracts §21.7, FR214, BR-PLT-016
// Story: E13b.6 Task 3.1
// ---------------------------------------------------------------------------

import { useState, useCallback, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, X, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatAuditTimestamp, actionBadgeClass } from '@/lib/audit-log-utils';
import { CopyUuidButton } from '@/components/audit/copy-uuid-button';
import { Button } from '@/components/ui/button';
import {
  useAuditLog,
  useAuditLogDetail,
  exportAuditLogCsv,
  type AuditLogFilters,
  type AuditLogListItem,
} from '@/hooks/use-audit-log';
import { AuditLogDetailPanel } from '@/components/audit/audit-log-detail-panel';

interface AuditLogSearchParams {
  action?: string;
  targetType?: string;
  targetId?: string;
  platformUserId?: string;
  from?: string;
  to?: string;
}

export const Route = createFileRoute('/_authenticated/audit-log')({
  component: AuditLogPage,
  validateSearch: (search: Record<string, unknown>): AuditLogSearchParams => {
    return {
      action: typeof search.action === 'string' ? search.action : undefined,
      targetType: typeof search.targetType === 'string' ? search.targetType : undefined,
      targetId: typeof search.targetId === 'string' ? search.targetId : undefined,
      platformUserId: typeof search.platformUserId === 'string' ? search.platformUserId : undefined,
      from: typeof search.from === 'string' ? search.from : undefined,
      to: typeof search.to === 'string' ? search.to : undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_ACTIONS = [
  'auth.login',
  'tenant.create',
  'tenant.update',
  'tenant.suspend',
  'tenant.reactivate',
  'tenant.archive',
  'tenant.modules_changed',
  'tenant.feature_flags_changed',
  'tenant.plan_changed',
  'tenant.quota_updated',
  'billing.enforcement_changed',
  'platform.impersonation_started',
  'platform.impersonation_ended',
  'user.create',
  'user.update',
  'ai.provider_created',
  'ai.provider_updated',
  'ai.alert_acknowledged',
  'knowledge.article_published',
] as const;

const TARGET_TYPES = [
  { value: '', label: 'All targets' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'plan', label: 'Plan' },
  { value: 'platform_user', label: 'Platform User' },
  { value: 'impersonation_session', label: 'Impersonation Session' },
] as const;

// ---------------------------------------------------------------------------
// Helpers (shared utilities imported from @/lib/audit-log-utils)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Platform users hook (for the admin user filter dropdown)
// ---------------------------------------------------------------------------

interface PlatformUserOption {
  id: string;
  email: string;
  displayName: string;
}

function usePlatformUsers() {
  return useQuery({
    queryKey: queryKeys.platformUsers.listForFilter(),
    queryFn: async () => {
      const result = await apiGet<PlatformUserOption[]>('/admin/users');
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
}

function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const { data: users } = usePlatformUsers();

  const hasFilters = !!(
    filters.action ||
    filters.targetType ||
    filters.platformUserId ||
    filters.from ||
    filters.to
  );

  const updateFilter = useCallback(
    (key: keyof AuditLogFilters, value: string) => {
      onFiltersChange({ ...filters, [key]: value || undefined });
    },
    [filters, onFiltersChange],
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  return (
    <div
      className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4"
      role="search"
      aria-label="Audit log filters"
    >
      {/* Action */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-action" className="text-xs font-medium text-muted-foreground">
          Action
        </label>
        <select
          id="filter-action"
          value={filters.action ?? ''}
          onChange={(e) => updateFilter('action', e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          <option value="">All actions</option>
          {KNOWN_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Target Type */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-target-type" className="text-xs font-medium text-muted-foreground">
          Target Type
        </label>
        <select
          id="filter-target-type"
          value={filters.targetType ?? ''}
          onChange={(e) => updateFilter('targetType', e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          {TARGET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Platform User */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-user" className="text-xs font-medium text-muted-foreground">
          Admin User
        </label>
        <select
          id="filter-user"
          value={filters.platformUserId ?? ''}
          onChange={(e) => updateFilter('platformUserId', e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          <option value="">All users</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.email})
            </option>
          ))}
        </select>
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-from" className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input
          id="filter-from"
          type="date"
          value={filters.from ? filters.from.split('T')[0] : ''}
          onChange={(e) => {
            const val = e.target.value;
            updateFilter('from', val ? `${val}T00:00:00.000Z` : '');
          }}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-to" className="text-xs font-medium text-muted-foreground">
          To
        </label>
        <input
          id="filter-to"
          type="date"
          value={filters.to ? filters.to.split('T')[0] : ''}
          onChange={(e) => {
            const val = e.target.value;
            updateFilter('to', val ? `${val}T23:59:59.999Z` : '');
          }}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        />
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} aria-label="Clear filters">
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="border-b border-border/50 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function AuditLogPage() {
  const searchParams = Route.useSearch();

  const [filters, setFilters] = useState<AuditLogFilters>(() => {
    const initial: AuditLogFilters = {};
    if (searchParams.action) initial.action = searchParams.action;
    if (searchParams.targetType) initial.targetType = searchParams.targetType;
    if (searchParams.targetId) initial.targetId = searchParams.targetId;
    if (searchParams.platformUserId) initial.platformUserId = searchParams.platformUserId;
    if (searchParams.from) initial.from = searchParams.from;
    if (searchParams.to) initial.to = searchParams.to;
    return initial;
  });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useAuditLog(filters);

  const { data: selectedDetail, isLoading: isDetailLoading } = useAuditLogDetail(selectedEntryId);

  const allEntries = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportAuditLogCsv(filters);
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Page Header */}
      <header className="mb-6 animate-fade-in-up">
        <p className="text-sm text-muted-foreground">Platform Admin &gt; Audit Log</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-foreground">Audit Log</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Immutable platform audit trail — all admin actions are recorded
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportCsv()}
            disabled={isExporting}
            aria-label="Export CSV"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="mb-4 animate-fade-in-up">
        <FilterBar filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Data Table */}
      <div className="rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)] animate-fade-in-up">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Audit log entries">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Admin User</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Target Type</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Target ID</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-destructive">
                    <p className="text-sm">Failed to load audit log entries</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                  </td>
                </tr>
              ) : allEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">No audit log entries found</p>
                  </td>
                </tr>
              ) : (
                allEntries.map((entry) => (
                  <AuditLogRow
                    key={entry.id}
                    entry={entry}
                    isSelected={entry.id === selectedEntryId}
                    onClick={() => setSelectedEntryId(entry.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasNextPage && (
          <div className="flex justify-center border-t border-border p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <AuditLogDetailPanel
        detail={selectedDetail}
        isLoading={isDetailLoading}
        isOpen={selectedEntryId !== null}
        onClose={() => setSelectedEntryId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Row
// ---------------------------------------------------------------------------

interface AuditLogRowProps {
  entry: AuditLogListItem;
  isSelected: boolean;
  onClick: () => void;
}

function AuditLogRow({ entry, isSelected, onClick }: AuditLogRowProps) {
  return (
    <tr
      className={cn(
        'cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30',
        isSelected && 'bg-muted/50',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
        {formatAuditTimestamp(entry.timestamp)}
      </td>
      <td className="px-4 py-3">{entry.platformUser.displayName}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            actionBadgeClass(entry.action),
          )}
        >
          {entry.action}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{entry.targetType ?? '—'}</td>
      <td className="px-4 py-3">
        {entry.targetId ? (
          <CopyUuidButton value={entry.targetId} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.ipAddress}</td>
    </tr>
  );
}
