/**
 * TanStack Query hooks for Bank Reconciliation Rules.
 *
 * - useReconRules: list query
 * - useCreateReconRule: create mutation
 * - useUpdateReconRule: update mutation
 * - useDeleteReconRule: delete mutation
 * - useApplyRules: apply rules to get suggestions for a bank account
 * - useCreateJournalFromRule: create journal from a rule match
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import {
  listReconRules,
  createReconRule,
  updateReconRule,
  deleteReconRule,
  applyRules,
  createJournalFromRule,
} from '../api/bank-recon-rules-api';
import type {
  CreateRuleInput,
  UpdateRuleInput,
  CreateJournalFromRuleInput,
} from '../api/bank-recon-rules-api';

/**
 * List reconciliation rules.
 */
export function useReconRules() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.bankReconRules(),
    queryFn: () => listReconRules(),
    enabled: isAuthenticated,
    select: (result) => result.data,
  });
}

/**
 * Create a new reconciliation rule.
 */
export function useCreateReconRule() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (input: CreateRuleInput) => createReconRule(input),
    onSuccess: () => {
      toast.success(t('bankReconRules.toast.created'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconRules(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Update an existing reconciliation rule.
 */
export function useUpdateReconRule(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (input: UpdateRuleInput) => updateReconRule(id, input),
    onSuccess: () => {
      toast.success(t('bankReconRules.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconRules(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Delete a reconciliation rule.
 */
export function useDeleteReconRule() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (id: string) => deleteReconRule(id),
    onSuccess: () => {
      toast.success(t('bankReconRules.toast.deleted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconRules(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Apply rules to get suggestions for a bank account.
 */
export function useApplyRules(bankAccountId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: [...queryKeys.finance.bankReconciliation(bankAccountId ?? ''), 'rule-suggestions'],
    queryFn: () => applyRules(bankAccountId!),
    enabled: isAuthenticated && !!bankAccountId,
  });
}

/**
 * Create journal from a rule match.
 */
export function useCreateJournalFromRule(bankAccountId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (input: CreateJournalFromRuleInput) => createJournalFromRule(bankAccountId, input),
    onSuccess: () => {
      toast.success(t('bankReconRules.suggestion.createJournal'));
      // Invalidate reconciliation data and rule suggestions
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconciliation(bankAccountId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconRules(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}
