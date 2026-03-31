/**
 * React Query hooks for Budgets.
 *
 * - useBudgets: list budgets
 * - useBudget: single budget detail
 * - useCreateBudget: create mutation
 * - useUpdateBudget: update mutation
 * - useApproveBudget: approve mutation
 * - useCopyBudget: copy mutation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  listBudgets,
  getBudget,
  createBudget,
  updateBudget,
  approveBudget,
  copyBudget,
} from '../api/budgets-api';
import type {
  Budget,
  BudgetListResponse,
  BudgetListParams,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../types';

export function useBudgets(params: BudgetListParams = {}) {
  const query = useQuery<BudgetListResponse>({
    queryKey: queryKeys.finance.budgets(params as Record<string, unknown>),
    queryFn: () => listBudgets(params),
  });

  return {
    budgets: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useBudget(id: string | null | undefined) {
  const query = useQuery<Budget>({
    queryKey: queryKeys.finance.budget(id ?? ''),
    queryFn: () => getBudget(id!),
    enabled: !!id,
  });

  return {
    budget: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateBudget() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBudgetInput) => createBudget(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.budgets() });
      toast({ title: t('finance.budget.toast.created') });
    },
    onError: () => {
      toast({ title: t('finance.budget.toast.createFailed'), variant: 'destructive' });
    },
  });
}

export function useUpdateBudget() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) =>
      updateBudget(id, input),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.budget(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.budgets() });
      toast({ title: t('finance.budget.toast.updated') });
    },
    onError: () => {
      toast({ title: t('finance.budget.toast.updateFailed'), variant: 'destructive' });
    },
  });
}

export function useApproveBudget() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveBudget(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.budget(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.budgets() });
      toast({ title: t('finance.budget.toast.approved') });
    },
    onError: () => {
      toast({ title: t('finance.budget.toast.approveFailed'), variant: 'destructive' });
    },
  });
}

export function useCopyBudget() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => copyBudget(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.budgets() });
      toast({ title: t('finance.budget.toast.copied') });
    },
    onError: () => {
      toast({ title: t('finance.budget.toast.copyFailed'), variant: 'destructive' });
    },
  });
}
