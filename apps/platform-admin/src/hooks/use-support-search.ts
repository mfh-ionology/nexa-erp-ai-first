// ---------------------------------------------------------------------------
// React Query Hook — Support Console Search
// Debounced search for tenants by name, code, email, or ID.
// Source: API Contracts §21.8, FR217, AC#5
// Story: E13b.5 Task 5.2
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupportSearchType = 'domain' | 'name' | 'email' | 'id';

export interface SupportSearchResult {
  id: string;
  code: string;
  displayName: string;
  status: string;
  planCode: string;
  billingStatus: string;
  lastActivityAt: string | null;
  matchField: string;
  matchValue: string;
}

export interface ImpersonationSession {
  id: string;
  platformUser: { id: string; email: string; displayName: string };
  tenant: { id: string; code: string; displayName: string };
  reason: string;
  startedAt: string;
  endedAt: string | null;
  expiresAt: string;
  actionsCount: number;
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Support Search Hook
// ---------------------------------------------------------------------------

export function useSupportSearch(query: string, type?: SupportSearchType) {
  const debouncedQuery = useDebouncedValue(query, 300);
  const enabled = debouncedQuery.trim().length >= 2;

  const result = useQuery({
    queryKey: queryKeys.support.search(debouncedQuery, type),
    queryFn: async () => {
      const params: Record<string, string> = { q: debouncedQuery.trim() };
      if (type) params.type = type;
      const qs = buildQueryString(params);
      return apiGet<{ items: SupportSearchResult[]; total: number }>(`/admin/support/search${qs}`);
    },
    enabled,
  });

  return {
    results: result.data?.data?.items ?? [],
    total: result.data?.data?.total ?? 0,
    isLoading: result.isLoading && enabled,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Impersonation Sessions Hook
// ---------------------------------------------------------------------------

export function useImpersonationSessions() {
  // Fetch last 30 days of sessions
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return useQuery({
    queryKey: queryKeys.support.sessions({ from }),
    queryFn: () =>
      apiGet<{ items: ImpersonationSession[]; total: number; hasMore: boolean }>(
        `/admin/impersonation-sessions${buildQueryString({ from, limit: 50 })}`,
      ),
  });
}

// ---------------------------------------------------------------------------
// End Impersonation Session Mutation
// ---------------------------------------------------------------------------

export function useEndImpersonationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiPost<{ sessionId: string; endedAt: string; duration: number }>(
        `/admin/impersonation-sessions/${sessionId}/end`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.support.sessions() });
    },
  });
}
