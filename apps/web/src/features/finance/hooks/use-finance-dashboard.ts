/**
 * React Query hook for the Finance Dashboard.
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';

import { getFinanceDashboard } from '../api/dashboard-api';
import type { FinanceDashboardData } from '../types';

export function useFinanceDashboard() {
  const query = useQuery<FinanceDashboardData>({
    queryKey: queryKeys.finance.dashboard(),
    queryFn: getFinanceDashboard,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  return {
    dashboard: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
