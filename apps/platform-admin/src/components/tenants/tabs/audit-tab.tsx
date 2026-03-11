// ---------------------------------------------------------------------------
// Audit Tab — Recent platform actions for this tenant (compact audit log)
// Story: E13b.6 Task 5.1
// Reuses audit log hooks/detail panel from Tasks 3–4, pre-filtered by tenant
// ---------------------------------------------------------------------------

import { useState, useCallback, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { FileText, Loader2, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatAuditTimestamp, actionBadgeClass } from '@/lib/audit-log-utils';
import { Button } from '@/components/ui/button';
import {
  useAuditLog,
  useAuditLogDetail,
  type AuditLogFilters,
  type AuditLogListItem,
} from '@/hooks/use-audit-log';
import { AuditLogDetailPanel } from '@/components/audit/audit-log-detail-panel';
import { CopyUuidButton } from '@/components/audit/copy-uuid-button';
import type { TenantDetail } from '@/types/tenant';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuditTabProps {
  tenant: TenantDetail;
}

// ---------------------------------------------------------------------------
// Constants — tenant-related actions only
// ---------------------------------------------------------------------------

const TENANT_ACTIONS = [
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
] as const;

// ---------------------------------------------------------------------------
// Helpers (shared utilities imported from @/lib/audit-log-utils)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Compact Filter Bar (action + date range only)
// ---------------------------------------------------------------------------

interface CompactFilterBarProps {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
  /** Fixed filters that cannot be changed (e.g. targetType, targetId) */
  fixedFilters: Partial<AuditLogFilters>;
}

function CompactFilterBar({ filters, onFiltersChange, fixedFilters }: CompactFilterBarProps) {
  const hasUserFilters = !!(filters.action || filters.from || filters.to);

  const updateFilter = useCallback(
    (key: keyof AuditLogFilters, value: string) => {
      onFiltersChange({ ...filters, ...fixedFilters, [key]: value || undefined });
    },
    [filters, onFiltersChange, fixedFilters],
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({ ...fixedFilters });
  }, [onFiltersChange, fixedFilters]);

  return (
    <div
      className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3"
      role="search"
      aria-label="Tenant audit log filters"
    >
      {/* Action filter — tenant-related actions only */}
      <div className="flex flex-col gap-1">
        <label htmlFor="tenant-audit-action" className="text-xs font-medium text-muted-foreground">
          Action
        </label>
        <select
          id="tenant-audit-action"
          value={filters.action ?? ''}
          onChange={(e) => updateFilter('action', e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          <option value="">All actions</option>
          {TENANT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label htmlFor="tenant-audit-from" className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input
          id="tenant-audit-from"
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
        <label htmlFor="tenant-audit-to" className="text-xs font-medium text-muted-foreground">
          To
        </label>
        <input
          id="tenant-audit-to"
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
      {hasUserFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} aria-label="Clear filters">
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
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Table Row
// ---------------------------------------------------------------------------

interface AuditRowProps {
  entry: AuditLogListItem;
  isSelected: boolean;
  onClick: () => void;
}

function AuditRow({ entry, isSelected, onClick }: AuditRowProps) {
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
      <td className="px-4 py-3 text-sm">{entry.platformUser.displayName}</td>
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AuditTab({ tenant }: AuditTabProps) {
  // Fixed filters: always scoped to this tenant
  const fixedFilters: Partial<AuditLogFilters> = useMemo(
    () => ({ targetType: 'tenant', targetId: tenant.id }),
    [tenant.id],
  );

  const [filters, setFilters] = useState<AuditLogFilters>({
    ...fixedFilters,
  } as AuditLogFilters);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Merge user-chosen filters with fixed tenant scope
  const mergedFilters = useMemo(() => ({ ...filters, ...fixedFilters }), [filters, fixedFilters]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useAuditLog(mergedFilters);

  const { data: selectedDetail, isLoading: isDetailLoading } = useAuditLogDetail(selectedEntryId);

  const allEntries = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

  const handleFiltersChange = useCallback(
    (newFilters: AuditLogFilters) => {
      setFilters({ ...newFilters, ...fixedFilters });
    },
    [fixedFilters],
  );

  return (
    <div data-testid="audit-tab">
      {/* Compact Filter Bar */}
      <div className="mb-3">
        <CompactFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          fixedFilters={fixedFilters as Partial<AuditLogFilters>}
        />
      </div>

      {/* Data Table */}
      <div className="rounded-md border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Tenant audit log entries">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Admin User</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Target ID</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-destructive">
                    <p className="text-sm">Failed to load audit log entries</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                  </td>
                </tr>
              ) : allEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No audit log entries found for this tenant
                    </p>
                  </td>
                </tr>
              ) : (
                allEntries.map((entry) => (
                  <AuditRow
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
          <div className="flex justify-center border-t border-border p-3">
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

      {/* View Full Audit Log link */}
      <div className="mt-3 flex justify-end">
        <Link
          to="/audit-log"
          search={{ targetType: 'tenant', targetId: tenant.id }}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          data-testid="view-full-audit-log"
        >
          View full audit log
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Detail Panel (reused from Task 4) */}
      <AuditLogDetailPanel
        detail={selectedDetail}
        isLoading={isDetailLoading}
        isOpen={selectedEntryId !== null}
        onClose={() => setSelectedEntryId(null)}
      />
    </div>
  );
}
