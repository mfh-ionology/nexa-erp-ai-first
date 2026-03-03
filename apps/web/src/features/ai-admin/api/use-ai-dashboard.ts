/**
 * TanStack Query hook for the AI Configuration Dashboard summary.
 *
 * - useAiDashboard: Query for dashboard summary with 5-minute refetch interval
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type { DashboardSummary, DashboardParams } from './types';

/**
 * Dashboard summary query.
 * Fetches active model/agent/skill/automation counts and daily token usage.
 * Refetches every 5 minutes to keep data fresh.
 */
export function useAiDashboard(params: DashboardParams = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.dashboard(params as Record<string, unknown>),
    queryFn: async () => {
      const path = `/ai/admin/dashboard${buildQueryString(params as Record<string, unknown>)}`;
      const result = await apiGet<DashboardSummary>(path);
      return result.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}
