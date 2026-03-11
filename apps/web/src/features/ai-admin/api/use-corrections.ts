/**
 * TanStack Query hooks for Correction operations.
 *
 * - useCorrections: Infinite query for paginated correction log list
 * - useCorrectionStats: Query for aggregated correction statistics
 * - useCreateArticleFromCorrection: Mutation to create a knowledge article from a correction
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  CorrectionLog,
  CorrectionListParams,
  CorrectionListResponse,
  CorrectionStats,
  KnowledgeArticle,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for the corrections list.
 * Supports cursor-based pagination and filtering by correctionType, skillKey, wasAutoResolved, date range.
 */
export function useCorrections(params: Omit<CorrectionListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.correctionsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: CorrectionListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/corrections${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<{ items: CorrectionLog[]; stats: Record<string, unknown> }>(path);
      return {
        data: result.data.items,
        meta: result.meta ?? { hasMore: false },
      } as CorrectionListResponse;
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
 * Query for aggregated correction statistics.
 * Fetched separately from the list (parallel queries).
 */
export function useCorrectionStats() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.correctionStats(),
    queryFn: async () => {
      const result = await apiGet<CorrectionStats>('/ai/corrections/stats');
      return result.data;
    },
    enabled: isAuthenticated,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a knowledge article from an existing correction.
 * On success: invalidates both corrections and knowledge articles queries.
 */
export function useCreateArticleFromCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (correctionId: string) => {
      const result = await apiPost<KnowledgeArticle>(
        `/ai/corrections/${correctionId}/create-article`,
        {},
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success('Knowledge article created from correction');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.corrections(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.knowledgeArticles(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create article from correction');
    },
  });
}
