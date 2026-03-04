/**
 * TanStack Query hooks for Platform Suggested Knowledge operations.
 *
 * - useSuggestedKnowledge: Infinite query for suggested articles from the platform
 * - useAcceptSuggestion: Mutation to accept a platform suggestion
 * - useRejectSuggestion: Mutation to reject a platform suggestion
 * - useAcceptEditedSuggestion: Mutation to accept with admin edits
 */

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  SuggestedKnowledgeArticle,
  SuggestedKnowledgeListParams,
  SuggestedKnowledgeListResponse,
  KnowledgeArticle,
  AcceptEditedSuggestionRequest,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for platform-suggested knowledge articles.
 * Returns empty result gracefully when platform is not configured (200 + empty array).
 */
export function useSuggestedKnowledge(params: Omit<SuggestedKnowledgeListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: SuggestedKnowledgeListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/knowledge-articles/suggested${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<SuggestedKnowledgeArticle[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as SuggestedKnowledgeListResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.cursor : undefined),
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Accept a platform-suggested knowledge article.
 * Creates a tenant copy with source=PLATFORM_SUGGESTED, confidence=0.9.
 * Optimistically removes the card from the suggested list.
 */
export function useAcceptSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platformArticleId: string) => {
      const result = await apiPost<KnowledgeArticle>(
        `/ai/knowledge-articles/suggested/${platformArticleId}/accept`,
        {},
      );
      return result.data;
    },
    onMutate: async (platformArticleId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
      });

      const previousData = queryClient.getQueriesData<InfiniteData<SuggestedKnowledgeListResponse>>(
        {
          queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
        },
      );

      queryClient.setQueriesData<InfiniteData<SuggestedKnowledgeListResponse>>(
        { queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.filter((item) => item.id !== platformArticleId),
            })),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Knowledge article accepted and added to your knowledge base');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticles(),
      });
    },
  });
}

/**
 * Reject a platform-suggested knowledge article.
 * Optimistically removes the card from the suggested list.
 */
export function useRejectSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platformArticleId: string) => {
      await apiPost(`/ai/knowledge-articles/suggested/${platformArticleId}/reject`, {});
    },
    onMutate: async (platformArticleId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
      });

      const previousData = queryClient.getQueriesData<InfiniteData<SuggestedKnowledgeListResponse>>(
        {
          queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
        },
      );

      queryClient.setQueriesData<InfiniteData<SuggestedKnowledgeListResponse>>(
        { queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.filter((item) => item.id !== platformArticleId),
            })),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Suggestion rejected');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
      });
    },
  });
}

/**
 * Accept a platform suggestion with admin edits.
 * Opens dialog with pre-filled content, admin can modify before accepting.
 */
export function useAcceptEditedSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      platformArticleId,
      data,
    }: {
      platformArticleId: string;
      data: AcceptEditedSuggestionRequest;
    }) => {
      const result = await apiPost<KnowledgeArticle>(
        `/ai/knowledge-articles/suggested/${platformArticleId}/accept-edited`,
        data,
      );
      return result.data;
    },
    onMutate: async ({ platformArticleId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
      });

      const previousData = queryClient.getQueriesData<InfiniteData<SuggestedKnowledgeListResponse>>(
        {
          queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
        },
      );

      queryClient.setQueriesData<InfiniteData<SuggestedKnowledgeListResponse>>(
        { queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.filter((item) => item.id !== platformArticleId),
            })),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Knowledge article accepted with your edits');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesSuggested(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticles(),
      });
    },
  });
}
