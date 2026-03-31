/**
 * TanStack Query hooks for Bank Reconciliation (FE8).
 *
 * - useReconciliationSummary: header summary (balances, counts)
 * - useBankTransactions: list bank transactions (unmatched)
 * - useUnmatchedJournalLines: list unmatched journal lines
 * - useMatchTransaction: match mutation
 * - useUnmatchTransaction: unmatch mutation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import {
  getReconciliationSummary,
  listBankTransactions,
  listUnmatchedJournalLines,
  matchTransaction,
  unmatchTransaction,
} from '../api/bank-reconciliation-api';

/**
 * Reconciliation summary for a bank account.
 */
export function useReconciliationSummary(bankAccountId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.bankReconciliation(bankAccountId ?? ''),
    queryFn: () => getReconciliationSummary(bankAccountId!),
    enabled: isAuthenticated && !!bankAccountId,
  });
}

/**
 * Bank transactions for a given account (for reconciliation).
 */
export function useBankTransactions(
  bankAccountId: string | undefined,
  params: { status?: string } = {},
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.bankTransactions(
      bankAccountId ?? '',
      params as Record<string, unknown>,
    ),
    queryFn: () => listBankTransactions(bankAccountId!, params),
    enabled: isAuthenticated && !!bankAccountId,
    select: (result) => result.data,
  });
}

/**
 * Unmatched journal lines for a given bank account.
 */
export function useUnmatchedJournalLines(bankAccountId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.unmatchedJournalLines(bankAccountId ?? ''),
    queryFn: () => listUnmatchedJournalLines(bankAccountId!),
    enabled: isAuthenticated && !!bankAccountId,
    select: (result) => result.data,
  });
}

/**
 * Match a bank transaction to a journal line.
 */
export function useMatchTransaction(bankAccountId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: ({
      bankTransactionId,
      journalLineId,
    }: {
      bankTransactionId: string;
      journalLineId: string;
    }) => matchTransaction(bankAccountId, bankTransactionId, journalLineId),
    onSuccess: () => {
      toast.success(t('reconciliation.toast.matched'));
      // Invalidate all reconciliation-related queries
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconciliation(bankAccountId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankTransactions(bankAccountId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.unmatchedJournalLines(bankAccountId),
      });
    },
    onError: () => {
      toast.error(t('reconciliation.toast.matchFailed'));
    },
  });
}

/**
 * Unmatch a bank transaction.
 */
export function useUnmatchTransaction(bankAccountId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (bankTransactionId: string) => unmatchTransaction(bankTransactionId),
    onSuccess: () => {
      toast.success(t('reconciliation.toast.unmatched'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconciliation(bankAccountId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankTransactions(bankAccountId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.unmatchedJournalLines(bankAccountId),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}
