/**
 * TanStack Query hooks for Journal Entry queries and mutations.
 *
 * - useJournals: infinite query for the list page (cursor-based pagination)
 * - useJournal: single detail query with lines
 * - useCreateJournal: create a draft journal entry
 * - useUpdateJournal: update a draft journal entry
 * - usePostJournal: post a draft entry
 * - useReverseJournal: reverse a posted entry
 * - useAccountSearch: search accounts for the account picker
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import {
  listJournals,
  getJournal,
  createJournal,
  updateJournal,
  postJournal,
  reverseJournal,
  searchAccounts,
} from '../api/journals-api';
import type {
  ListJournalsParams,
  CreateJournalInput,
  UpdateJournalInput,
} from '../api/journals-types';

// ---------------------------------------------------------------------------
// useJournals — infinite query for list page
// ---------------------------------------------------------------------------

export function useJournals(params: Omit<ListJournalsParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.finance.journalsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: ListJournalsParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const result = await listJournals(fullParams);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? (lastPage.meta.cursor as string | undefined) : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

// ---------------------------------------------------------------------------
// useJournal — single detail query
// ---------------------------------------------------------------------------

export function useJournal(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.journal(id ?? ''),
    queryFn: () => getJournal(id!),
    enabled: isAuthenticated && !!id,
  });
}

// ---------------------------------------------------------------------------
// useCreateJournal — POST /finance/journals
// ---------------------------------------------------------------------------

export function useCreateJournal() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: CreateJournalInput) => createJournal(data),
    onSuccess: () => {
      toast.success(t('journals.toast.created'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journals(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateJournal — PATCH /finance/journals/:id
// ---------------------------------------------------------------------------

export function useUpdateJournal(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: UpdateJournalInput) => updateJournal(id, data),
    onSuccess: () => {
      toast.success(t('journals.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journal(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journals(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(t('journals.error.immutable'));
      } else if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// usePostJournal — POST /finance/journals/:id/post
// ---------------------------------------------------------------------------

export function usePostJournal(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: () => postJournal(id),
    onSuccess: () => {
      toast.success(t('journals.toast.posted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journal(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journals(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(error.message);
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useReverseJournal — POST /finance/journals/:id/reverse
// ---------------------------------------------------------------------------

export function useReverseJournal(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: () => reverseJournal(id),
    onSuccess: () => {
      toast.success(t('journals.toast.reversed'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journal(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journals(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(error.message);
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useAccountSearch — search accounts for account picker
// ---------------------------------------------------------------------------

export function useAccountSearch(search: string, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.accounts.search({ search }),
    queryFn: () => searchAccounts(search),
    enabled: isAuthenticated && enabled && search.length >= 1,
    staleTime: 30_000,
  });
}
