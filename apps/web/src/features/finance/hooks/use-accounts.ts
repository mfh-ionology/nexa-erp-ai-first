/**
 * React Query hooks for the Chart of Accounts API.
 *
 * - useAccountsTree: hierarchical tree of all accounts
 * - useAccountsList: flat paginated list with filters
 * - useAccount: single account detail
 * - useCreateAccount: create mutation
 * - useUpdateAccount: update mutation
 * - useSearchAccounts: debounced search
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  listAccounts,
  listAccountsTree,
  getAccount,
  createAccount,
  updateAccount,
  searchAccounts,
} from '../api/accounts-api';
import type {
  AccountTreeNode,
  AccountDetail,
  CreateAccountInput,
  UpdateAccountInput,
  ListAccountsParams,
  SearchAccountsParams,
} from '../types';

// ---------------------------------------------------------------------------
// useAccountsTree — hierarchical tree (GET /finance/accounts?tree=true)
// ---------------------------------------------------------------------------

export function useAccountsTree(params: Omit<ListAccountsParams, 'tree'> = {}) {
  const query = useQuery<AccountTreeNode[]>({
    queryKey: queryKeys.finance.accounts.tree(params as Record<string, unknown>),
    queryFn: () => listAccountsTree(params),
  });

  return {
    tree: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ---------------------------------------------------------------------------
// useAccountsList — flat list with pagination (GET /finance/accounts)
// ---------------------------------------------------------------------------

export function useAccountsList(params: ListAccountsParams = {}) {
  const query = useQuery({
    queryKey: queryKeys.finance.accounts.list(params as Record<string, unknown>),
    queryFn: () => listAccounts(params),
  });

  return {
    accounts: query.data?.items ?? [],
    meta: query.data?.meta,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useAccount — single account detail (GET /finance/accounts/:id)
// ---------------------------------------------------------------------------

export function useAccount(id: string | null | undefined) {
  const query = useQuery<AccountDetail>({
    queryKey: queryKeys.finance.accounts.detail(id ?? ''),
    queryFn: () => getAccount(id!),
    enabled: !!id,
  });

  return {
    account: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useCreateAccount — create mutation
// ---------------------------------------------------------------------------

export function useCreateAccount() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts.all() });
      toast({ title: t('finance.accounts.toast.created', 'Account created') });
    },
    onError: () => {
      toast({
        title: t('finance.accounts.toast.createFailed', 'Failed to create account'),
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateAccount — update mutation
// ---------------------------------------------------------------------------

export function useUpdateAccount() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) =>
      updateAccount(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts.all() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.accounts.detail(variables.id),
      });
      toast({ title: t('finance.accounts.toast.updated', 'Account updated') });
    },
    onError: () => {
      toast({
        title: t('finance.accounts.toast.updateFailed', 'Failed to update account'),
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useSearchAccounts — search accounts
// ---------------------------------------------------------------------------

export function useSearchAccounts(params: SearchAccountsParams | null) {
  const query = useQuery({
    queryKey: queryKeys.finance.accounts.search(
      params ? (params as unknown as Record<string, unknown>) : undefined,
    ),
    queryFn: () => searchAccounts(params!),
    enabled: !!params && params.search.length > 0,
  });

  return {
    results: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
