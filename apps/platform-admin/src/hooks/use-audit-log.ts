// ---------------------------------------------------------------------------
// React Query Hooks — Platform Audit Log
// Source: API Contracts §21.7, FR214, BR-PLT-016
// Story: E13b.6 Task 3.2
// ---------------------------------------------------------------------------

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiGet, BASE_URL, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { usePlatformAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types (mirrored from backend audit-log.schema.ts)
// ---------------------------------------------------------------------------

export interface AuditLogListItem {
  id: string;
  platformUser: { id: string; email: string; displayName: string };
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string;
  timestamp: string;
}

export interface AuditLogDetail extends AuditLogListItem {
  details: unknown;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  targetType?: string;
  targetId?: string;
  platformUserId?: string;
  from?: string;
  to?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Infinite query for GET /admin/audit-log with cursor-based pagination. */
export function useAuditLog(filters: AuditLogFilters = {}) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.auditLog.listInfinite(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params: Record<string, string | number | boolean | null | undefined> = {
        ...filters,
        limit: 50,
      };
      if (pageParam) params.cursor = pageParam;
      const qs = buildQueryString(params);
      const result = await apiGet<AuditLogListItem[]>(`/admin/audit-log${qs}`);
      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    staleTime: 30 * 1000,
    enabled: isAuthenticated,
  });
}

/** GET /admin/audit-log/:id — full detail for a single entry. */
export function useAuditLogDetail(id: string | null) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.auditLog.detail(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<AuditLogDetail>(`/admin/audit-log/${id}`);
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && !!id,
  });
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/** Triggers a browser download for GET /admin/audit-log/export with current filters. */
export async function exportAuditLogCsv(filters: AuditLogFilters): Promise<void> {
  const { accessToken } = usePlatformAuthStore.getState();
  const qs = buildQueryString(
    filters as Record<string, string | number | boolean | null | undefined>,
  );
  const res = await fetch(`${BASE_URL}/admin/audit-log/export${qs}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let message = `Export failed: ${res.status}`;
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      if (json.error?.message) message = json.error.message;
    } catch {
      // Response body not JSON
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0];
  a.download = `platform-audit-log-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
