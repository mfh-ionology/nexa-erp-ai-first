// ---------------------------------------------------------------------------
// Support Console Page — T1 Entity List pattern
// Search tenants by name, code, email, or ID; manage impersonation sessions.
// Source: API Contracts §21.8, FR217, FR218, AC#5
// Story: E13b.5 Task 5.1, 5.3
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Search, UserRoundCog, Wrench, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ImpersonationDialog } from '@/components/tenants/impersonation-dialog';
import {
  useSupportSearch,
  useImpersonationSessions,
  useEndImpersonationSession,
  type SupportSearchType,
} from '@/hooks/use-support-search';
import { canPerformAction } from '@/lib/platform-rbac';
import { usePlatformAuthStore } from '@/stores/auth-store';
import type { BillingStatus, TenantStatus } from '@/types/tenant';

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_authenticated/support')({
  component: SupportConsolePage,
});

// ---------------------------------------------------------------------------
// Search type options
// ---------------------------------------------------------------------------

const SEARCH_TYPE_OPTIONS: { value: '' | SupportSearchType; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'domain', label: 'Domain' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'id', label: 'ID' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SupportConsolePage() {
  const navigate = useNavigate();
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canImpersonate = userRole ? canPerformAction(userRole, 'impersonate') : false;

  // --- Search state ---
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState<'' | SupportSearchType>('');

  const {
    results,
    total,
    isLoading: isSearching,
    error: searchError,
  } = useSupportSearch(searchInput, searchType || undefined);

  // --- Impersonation dialog state ---
  const [impersonateTarget, setImpersonateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // --- Impersonation sessions ---
  const { data: sessionsResult, isLoading: isLoadingSessions } = useImpersonationSessions();
  const sessions = sessionsResult?.data?.items ?? [];
  const endSessionMutation = useEndImpersonationSession();

  function handleEndSession(sessionId: string) {
    endSessionMutation.mutate(sessionId, {
      onSuccess: () => toast.success('Impersonation session ended'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to end session'),
    });
  }

  function getSessionStatus(session: { endedAt: string | null; expiresAt: string }) {
    if (session.endedAt) return 'ended' as const;
    if (new Date(session.expiresAt) < new Date()) return 'expired' as const;
    return 'active' as const;
  }

  const hasSearchQuery = searchInput.trim().length >= 2;

  return (
    <div className="animate-fade-in-up p-8">
      {/* --- Header --- */}
      <div className="mb-1 text-sm text-muted-foreground">Platform Admin &gt; Support Console</div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Support Console</h1>

      {/* --- Search Bar --- */}
      <div className="mb-6 flex flex-wrap items-end gap-3" data-testid="support-search-bar">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tenants by name, code, email, or ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            data-testid="support-search-input"
          />
        </div>

        {/* Type filter */}
        <div>
          <label htmlFor="search-type-filter" className="sr-only">
            Search type filter
          </label>
          <select
            id="search-type-filter"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as '' | SupportSearchType)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
            data-testid="support-type-filter"
          >
            {SEARCH_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- Search Results --- */}
      <div className="overflow-hidden rounded-lg border border-border bg-background shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Last Activity</th>
              <th className="px-4 py-3">Match</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {isSearching && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={`skeleton-${i}`}
                    className="border-b border-border last:border-0"
                    data-testid="skeleton-row"
                  >
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}

            {/* Empty state */}
            {!isSearching && !searchError && !hasSearchQuery && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-16 text-center text-muted-foreground"
                  data-testid="support-empty-state"
                >
                  <Search className="mx-auto mb-3 size-8 opacity-40" />
                  <p>Search for tenants by name, code, email, or ID</p>
                </td>
              </tr>
            )}

            {/* No results */}
            {!isSearching && !searchError && hasSearchQuery && results.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-muted-foreground"
                  data-testid="support-no-results"
                >
                  No tenants found matching &ldquo;{searchInput.trim()}&rdquo;
                </td>
              </tr>
            )}

            {/* Error */}
            {searchError && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-destructive">
                  Failed to search
                  {searchError instanceof Error ? `: ${searchError.message}` : ''}
                </td>
              </tr>
            )}

            {/* Results */}
            {!isSearching &&
              results.map((result) => (
                <tr
                  key={result.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                  data-testid={`support-result-${result.id}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{result.displayName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {result.code}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={result.status as TenantStatus} />
                  </td>
                  <td className="px-4 py-3">{result.planCode}</td>
                  <td className="px-4 py-3">
                    <StatusBadge billingStatus={result.billingStatus as BillingStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {result.lastActivityAt
                      ? formatDistanceToNow(new Date(result.lastActivityAt), {
                          addSuffix: true,
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{result.matchField}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void navigate({
                            to: '/tenants/$tenantId',
                            params: { tenantId: result.id },
                          })
                        }
                        data-testid={`view-tenant-${result.id}`}
                      >
                        <Eye className="size-4" />
                        View
                      </Button>
                      {canImpersonate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-600 hover:text-amber-700"
                          disabled={result.status !== 'ACTIVE'}
                          title={
                            result.status !== 'ACTIVE'
                              ? 'Can only impersonate active tenants'
                              : 'Impersonate this tenant'
                          }
                          onClick={() =>
                            setImpersonateTarget({
                              id: result.id,
                              name: result.displayName,
                            })
                          }
                          data-testid={`impersonate-tenant-${result.id}`}
                        >
                          <UserRoundCog className="size-4" />
                          Impersonate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        title="Coming soon"
                        data-testid={`runbook-tenant-${result.id}`}
                      >
                        <Wrench className="size-4" />
                        Runbook
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Result count */}
        {!isSearching && hasSearchQuery && results.length > 0 && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {total} result{total === 1 ? '' : 's'} found
          </div>
        )}
      </div>

      {/* --- Impersonation Sessions History (Task 5.3) --- */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Recent Impersonation Sessions</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-xs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Ended / Expired</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingSessions && (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr
                      key={`session-skeleton-${i}`}
                      className="border-b border-border last:border-0"
                    >
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}

              {!isLoadingSessions && sessions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                    data-testid="sessions-empty"
                  >
                    No impersonation sessions in the last 30 days
                  </td>
                </tr>
              )}

              {!isLoadingSessions &&
                sessions.map((session) => {
                  const status = getSessionStatus(session);
                  return (
                    <tr
                      key={session.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                      data-testid={`session-row-${session.id}`}
                    >
                      <td className="px-4 py-3 font-medium">{session.platformUser.displayName}</td>
                      <td className="px-4 py-3">
                        {session.tenant.displayName}{' '}
                        <span className="font-mono text-xs text-muted-foreground">
                          ({session.tenant.code})
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                        {session.reason}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDistanceToNow(new Date(session.startedAt), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.endedAt
                          ? formatDistanceToNow(new Date(session.endedAt), {
                              addSuffix: true,
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <SessionStatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {status === 'active' && canImpersonate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleEndSession(session.id)}
                            disabled={endSessionMutation.isPending}
                            data-testid={`end-session-${session.id}`}
                          >
                            <XCircle className="size-4" />
                            End Session
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Impersonation Dialog --- */}
      {impersonateTarget && (
        <ImpersonationDialog
          open={!!impersonateTarget}
          onOpenChange={(open) => !open && setImpersonateTarget(null)}
          tenantId={impersonateTarget.id}
          tenantName={impersonateTarget.name}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Status Badge
// ---------------------------------------------------------------------------

function SessionStatusBadge({ status }: { status: 'active' | 'ended' | 'expired' }) {
  const styles = {
    active: {
      dot: 'bg-green-500 animate-pulse',
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Active',
    },
    ended: {
      dot: 'bg-slate-400',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      label: 'Ended',
    },
    expired: {
      dot: 'bg-amber-500',
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Expired',
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.bg} ${styles.text}`}
      data-testid={`session-status-${status}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      {styles.label}
    </span>
  );
}
