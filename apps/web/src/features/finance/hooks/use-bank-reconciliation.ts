/**
 * TanStack Query hooks for Bank Reconciliation (FE8).
 *
 * Simplified: one query for reconciliation list, one for detail.
 * No auto-create — page controls the flow.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import {
  listReconciliations,
  getReconciliationDetail,
  createReconciliation,
  matchTransaction,
  unmatchTransaction,
} from '../api/bank-reconciliation-api';

/**
 * List all reconciliation sessions for a bank account.
 */
export function useReconciliationList(bankAccountId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.bankReconciliation(bankAccountId ?? ''),
    queryFn: () => listReconciliations(bankAccountId!),
    enabled: isAuthenticated && !!bankAccountId,
  });
}

/**
 * Get detail for a specific reconciliation session (matched + unmatched).
 */
export function useReconciliationDetail(
  bankAccountId: string | undefined,
  reconciliationId: string | undefined,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: [...queryKeys.finance.bankReconciliation(bankAccountId ?? ''), reconciliationId],
    queryFn: () => getReconciliationDetail(bankAccountId!, reconciliationId!),
    enabled: isAuthenticated && !!bankAccountId && !!reconciliationId,
  });
}

/**
 * Create a new reconciliation session.
 */
export function useCreateReconciliation(bankAccountId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (input: { statementDate: string; statementBalance: number }) =>
      createReconciliation(bankAccountId, input),
    onSuccess: () => {
      toast.success('Reconciliation session created');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconciliation(bankAccountId),
      });
    },
    onError: () => {
      toast.error(t('reconciliation.toast.matchFailed'));
    },
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconciliation(bankAccountId),
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
    },
    onError: () => {
      toast.error(t('reconciliation.toast.matchFailed'));
    },
  });
}

// Legacy exports for backward compat
export const useReconciliationSummary = useReconciliationList;
export const useBankTransactions = useReconciliationList;
export const useUnmatchedJournalLines = useReconciliationList;
