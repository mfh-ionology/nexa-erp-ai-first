/**
 * TanStack Query hooks for Knowledge Article CRUD operations.
 *
 * - useKnowledgeArticles: Infinite query for paginated article list
 * - useKnowledgeArticle: Single article detail query
 * - useCreateKnowledgeArticle: Create mutation
 * - useUpdateKnowledgeArticle: Update mutation with optimistic update
 * - useDeleteKnowledgeArticle: Delete mutation with optimistic removal
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  KnowledgeArticle,
  KnowledgeArticleListParams,
  KnowledgeArticleListResponse,
  CreateKnowledgeArticleRequest,
  UpdateKnowledgeArticleRequest,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for the knowledge articles list.
 * Supports cursor-based pagination and filtering by category, source, isActive.
 */
export function useKnowledgeArticles(params: Omit<KnowledgeArticleListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.knowledgeArticlesInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: KnowledgeArticleListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/knowledge-articles${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<KnowledgeArticle[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as KnowledgeArticleListResponse;
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

/**
 * Single knowledge article detail query.
 * Enabled only when `id` is truthy.
 */
export function useKnowledgeArticle(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.knowledgeArticle(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<KnowledgeArticle>(`/ai/knowledge-articles/${id}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

/**
 * Non-paginated query for stats panel — fetches all active articles in one request.
 * Uses a large limit to avoid pagination issues with aggregate counts.
 */
export function useKnowledgeArticleStats() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.knowledgeArticles({ _stats: true }),
    queryFn: async () => {
      const path = `/ai/knowledge-articles${buildQueryString({ isActive: true, limit: 500 })}`;
      const result = await apiGet<KnowledgeArticle[]>(path);
      const meta = result.meta as Record<string, unknown> | undefined;
      return {
        data: result.data,
        total: typeof meta?.total === 'number' ? meta.total : undefined,
      };
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new knowledge article.
 * On success: invalidates list queries, shows success toast.
 */
export function useCreateKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateKnowledgeArticleRequest) => {
      const result = await apiPost<KnowledgeArticle>('/ai/knowledge-articles', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success('Knowledge article created and indexed');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticles(),
      });
    },
  });
}

/**
 * Update an existing knowledge article.
 * Uses optimistic update for the article in the infinite list cache.
 * On success: invalidates both list and detail queries.
 */
export function useUpdateKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateKnowledgeArticleRequest }) => {
      const result = await apiPatch<KnowledgeArticle>(`/ai/knowledge-articles/${id}`, data);
      return result.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.aiAdmin.knowledgeArticlesInfinite() });

      const previousData = queryClient.getQueriesData<InfiniteData<KnowledgeArticleListResponse>>({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesInfinite(),
      });

      queryClient.setQueriesData<InfiniteData<KnowledgeArticleListResponse>>(
        { queryKey: queryKeys.aiAdmin.knowledgeArticlesInfinite() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((item) => (item.id === id ? { ...item, ...data } : item)),
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
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticle(variables.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticles(),
      });
    },
  });
}

/**
 * Delete (soft-delete) a knowledge article.
 * Optimistically removes from the list cache.
 * On success: invalidates list queries, removes detail cache.
 */
export function useDeleteKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/ai/knowledge-articles/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.aiAdmin.knowledgeArticlesInfinite() });

      const previousData = queryClient.getQueriesData<InfiniteData<KnowledgeArticleListResponse>>({
        queryKey: queryKeys.aiAdmin.knowledgeArticlesInfinite(),
      });

      queryClient.setQueriesData<InfiniteData<KnowledgeArticleListResponse>>(
        { queryKey: queryKeys.aiAdmin.knowledgeArticlesInfinite() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.filter((item) => item.id !== id),
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
    onSettled: (_data, _err, id) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticles(),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticle(id),
      });
    },
  });
}
