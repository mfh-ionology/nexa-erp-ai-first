// ---------------------------------------------------------------------------
// Platform Knowledge Article React Query Hooks — Platform Admin
// Source: Story E5d-6 Task 2.3 (AC#9)
// ---------------------------------------------------------------------------

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiDelete, apiGet, apiPatch, apiPost, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { usePlatformAuthStore } from '@/stores/auth-store';

import type {
  CreateKnowledgeBody,
  KnowledgeFilters,
  PlatformKnowledgeArticle,
  UpdateKnowledgeBody,
} from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** GET /admin/intelligence/knowledge — cursor-paginated list with distribution summary */
export function usePlatformKnowledgeArticles(filters: Omit<KnowledgeFilters, 'cursor'> = {}) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.knowledge.listInfinite(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const params: KnowledgeFilters = { ...filters };
      if (pageParam) params.cursor = pageParam as string;
      const path = `/admin/intelligence/knowledge${buildQueryString(params as Record<string, string | number | boolean | null | undefined>)}`;
      const result = await apiGet<PlatformKnowledgeArticle[]>(path);
      return { data: result.data, meta: result.meta ?? { hasMore: false } };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    staleTime: 60 * 1000,
    enabled: isAuthenticated,
  });
}

/** GET /admin/intelligence/knowledge/:id — single article with distribution stats */
export function usePlatformKnowledgeArticle(id: string | undefined) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.knowledge.detail(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<PlatformKnowledgeArticle>(`/admin/intelligence/knowledge/${id}`);
      return result.data;
    },
    staleTime: 60 * 1000,
    enabled: isAuthenticated && !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST /admin/intelligence/knowledge — create a new article in DRAFT status */
export function useCreateKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateKnowledgeBody) => {
      const result = await apiPost<PlatformKnowledgeArticle>('/admin/intelligence/knowledge', body);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
    },
  });
}

/** PATCH /admin/intelligence/knowledge/:id — update article fields */
export function useUpdateKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateKnowledgeBody }) => {
      const result = await apiPatch<PlatformKnowledgeArticle>(
        `/admin/intelligence/knowledge/${id}`,
        body,
      );
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.knowledge.detail(data.id),
      });
    },
  });
}

/** POST /admin/intelligence/knowledge/:id/publish — transition DRAFT → PUBLISHED */
export function usePublishKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiPost<PlatformKnowledgeArticle>(
        `/admin/intelligence/knowledge/${id}/publish`,
      );
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.knowledge.detail(data.id),
      });
    },
  });
}

/** POST /admin/intelligence/knowledge/:id/archive — transition PUBLISHED → ARCHIVED */
export function useArchiveKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiPost<PlatformKnowledgeArticle>(
        `/admin/intelligence/knowledge/${id}/archive`,
      );
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.knowledge.detail(data.id),
      });
    },
  });
}

/** DELETE /admin/intelligence/knowledge/:id — hard-delete DRAFT articles only */
export function useDeleteKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete<void>(`/admin/intelligence/knowledge/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
    },
  });
}
