/**
 * TanStack Query hooks for Training Example CRUD operations.
 *
 * - useTrainingExamples: Infinite query for paginated training example list
 * - useCreateTrainingExample: Create mutation
 * - useUpdateTrainingExample: Update mutation with optimistic update
 * - useDeleteTrainingExample: Delete mutation with optimistic removal
 */

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  TrainingExample,
  TrainingExampleListParams,
  TrainingExampleListResponse,
  CreateTrainingExampleRequest,
  UpdateTrainingExampleRequest,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for the training examples list.
 * Supports cursor-based pagination and filtering by category, skillKey, isActive.
 */
export function useTrainingExamples(params: Omit<TrainingExampleListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.trainingExamplesInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: TrainingExampleListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/training-examples${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<TrainingExample[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as TrainingExampleListResponse;
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
 * Create a new training example.
 * On success: invalidates list queries, shows success toast.
 */
export function useCreateTrainingExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTrainingExampleRequest) => {
      const result = await apiPost<TrainingExample>('/ai/training-examples', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success('Training example created');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.trainingExamples(),
      });
    },
  });
}

/**
 * Update an existing training example.
 * Uses optimistic update for the example in the infinite list cache.
 * On success: invalidates list queries.
 */
export function useUpdateTrainingExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTrainingExampleRequest }) => {
      const result = await apiPatch<TrainingExample>(`/ai/training-examples/${id}`, data);
      return result.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.aiAdmin.trainingExamplesInfinite() });

      const previousData = queryClient.getQueriesData<InfiniteData<TrainingExampleListResponse>>({
        queryKey: queryKeys.aiAdmin.trainingExamplesInfinite(),
      });

      queryClient.setQueriesData<InfiniteData<TrainingExampleListResponse>>(
        { queryKey: queryKeys.aiAdmin.trainingExamplesInfinite() },
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
        queryKey: queryKeys.aiAdmin.trainingExamples(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.trainingExample(variables.id),
      });
    },
  });
}

/**
 * Delete (soft-delete) a training example.
 * Optimistically removes from the list cache.
 * On success: invalidates list queries.
 */
export function useDeleteTrainingExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/ai/training-examples/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.aiAdmin.trainingExamplesInfinite() });

      const previousData = queryClient.getQueriesData<InfiniteData<TrainingExampleListResponse>>({
        queryKey: queryKeys.aiAdmin.trainingExamplesInfinite(),
      });

      queryClient.setQueriesData<InfiniteData<TrainingExampleListResponse>>(
        { queryKey: queryKeys.aiAdmin.trainingExamplesInfinite() },
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
        queryKey: queryKeys.aiAdmin.trainingExamples(),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.aiAdmin.trainingExample(id),
      });
    },
  });
}
