/**
 * TanStack Query hooks for Bank Accounts (FE7).
 *
 * - useBankAccounts: infinite query for the list page
 * - useBankAccount: single detail query
 * - useCreateBankAccount: create mutation
 * - useUpdateBankAccount: update mutation
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import {
  listBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
} from '../api/bank-accounts-api';
import type {
  BankAccountListParams,
  BankAccountListResponse,
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from '../types';

/**
 * Infinite query for the bank accounts list page.
 */
export function useBankAccounts(params: Omit<BankAccountListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.finance.bankAccountsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: BankAccountListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      return listBankAccounts(fullParams);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: BankAccountListResponse) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

/**
 * Single bank account detail query.
 */
export function useBankAccount(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.bankAccount(id ?? ''),
    queryFn: () => getBankAccount(id!),
    enabled: isAuthenticated && !!id,
  });
}

/**
 * Create a new bank account.
 */
export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (input: CreateBankAccountInput) => createBankAccount(input),
    onSuccess: () => {
      toast.success(t('bankAccounts.toast.created'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankAccounts(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Update an existing bank account.
 */
export function useUpdateBankAccount(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (input: UpdateBankAccountInput) => updateBankAccount(id, input),
    onSuccess: () => {
      toast.success(t('bankAccounts.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankAccount(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankAccounts(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}
