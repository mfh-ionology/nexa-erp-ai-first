/**
 * TanStack Query hooks for Financial Reports (FE6).
 *
 * Each report is a query triggered by explicit parameters.
 * Uses `enabled: false` + refetch pattern so the user clicks "Run Report".
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import { getTrialBalance, getProfitAndLoss, getBalanceSheet } from '../api/reports-api';
import type { ReportParams } from '../types';

/**
 * Trial Balance report query.
 * Call `refetch()` to run the report with the given params.
 */
export function useTrialBalance(params: ReportParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.trialBalance(params as unknown as Record<string, unknown>),
    queryFn: () => getTrialBalance(params!),
    enabled: isAuthenticated && params !== null,
  });
}

/**
 * Profit and Loss report query.
 * Call `refetch()` to run the report with the given params.
 */
export function useProfitAndLoss(params: ReportParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.profitAndLoss(params as unknown as Record<string, unknown>),
    queryFn: () => getProfitAndLoss(params!),
    enabled: isAuthenticated && params !== null,
  });
}

/**
 * Balance Sheet report query.
 * Call `refetch()` to run the report with the given params.
 */
export function useBalanceSheet(params: ReportParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.balanceSheet(params as unknown as Record<string, unknown>),
    queryFn: () => getBalanceSheet(params!),
    enabled: isAuthenticated && params !== null,
  });
}
