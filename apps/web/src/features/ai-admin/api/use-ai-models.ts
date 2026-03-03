/**
 * TanStack Query hooks for AI Model admin CRUD operations.
 *
 * - useAiModels: Infinite query for paginated model list
 * - useAiModel: Single model detail query
 * - useCreateAiModel: Create mutation
 * - useUpdateAiModel: Update mutation
 * - useDeleteAiModel: Delete mutation
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  AiModelListItem,
  AiModelListParams,
  AiModelListResponse,
  AiModelDetail,
  CreateAiModelRequest,
  UpdateAiModelRequest,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for the AI model list page.
 * Supports cursor-based pagination, search, and filtering.
 */
export function useAiModels(params: Omit<AiModelListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.modelsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: AiModelListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/admin/models${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AiModelListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as AiModelListResponse;
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
 * Single AI model detail query.
 * Enabled only when `id` is truthy.
 */
export function useAiModel(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.model(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<AiModelDetail>(`/ai/admin/models/${id}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new AI model.
 * On success: invalidates the models list queries.
 */
export function useCreateAiModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAiModelRequest) => {
      const result = await apiPost<AiModelDetail>('/ai/admin/models', data);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.models(),
      });
    },
  });
}

/**
 * Update an existing AI model.
 * On success: invalidates both list and detail queries, shows success toast.
 */
export function useUpdateAiModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAiModelRequest }) => {
      const result = await apiPatch<AiModelDetail>(`/ai/admin/models/${id}`, data);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success('Model updated successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.model(variables.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.models(),
      });
    },
  });
}

/**
 * Delete an AI model.
 * On success: invalidates list queries, shows success toast.
 */
export function useDeleteAiModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/ai/admin/models/${id}`);
    },
    onSuccess: (_data, id) => {
      toast.success('Model deleted successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.models(),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.aiAdmin.model(id),
      });
    },
  });
}
