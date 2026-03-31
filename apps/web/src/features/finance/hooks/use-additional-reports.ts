/**
 * React Query hooks for additional finance reports.
 *
 * - useTransactionJournal: transaction journal report
 * - useBudgetVarianceReport: budget variance report
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';

import { getTransactionJournal, getBudgetVariance } from '../api/additional-reports-api';
import type {
  TransactionJournalEntry,
  TransactionJournalParams,
  BudgetVarianceRow,
  BudgetVarianceParams,
  ReportDataResponse,
} from '../types';

export function useTransactionJournal(params: TransactionJournalParams | null) {
  const query = useQuery<ReportDataResponse<TransactionJournalEntry>>({
    queryKey: queryKeys.finance.transactionJournal(params as unknown as Record<string, unknown>),
    queryFn: () => getTransactionJournal(params!),
    enabled: !!params,
  });

  return {
    data: query.data ?? null,
    rows: query.data?.rows ?? [],
    totals: query.data?.totals ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

export function useBudgetVarianceReport(params: BudgetVarianceParams | null) {
  const query = useQuery<ReportDataResponse<BudgetVarianceRow>>({
    queryKey: queryKeys.finance.budgetVariance(params as unknown as Record<string, unknown>),
    queryFn: () => getBudgetVariance(params!),
    enabled: !!params,
  });

  return {
    data: query.data ?? null,
    rows: query.data?.rows ?? [],
    totals: query.data?.totals ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
