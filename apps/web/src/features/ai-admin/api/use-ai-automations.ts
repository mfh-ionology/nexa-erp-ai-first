/**
 * TanStack Query hooks for AI Automation CRUD and execution operations.
 *
 * - useAiAutomations: Infinite query for paginated automation list
 * - useAiAutomation: Single automation detail query
 * - useCreateAiAutomation: Create mutation
 * - useUpdateAiAutomation: Update mutation
 * - useDeleteAiAutomation: Delete mutation
 * - useRunAutomation: Manual trigger ("Run Now") mutation
 * - useToggleAutomationActive: Optimistic toggle for inline isActive switch
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
  AiAutomationListItem,
  AiAutomationListParams,
  AiAutomationListResponse,
  AiAutomationDetail,
  CreateAutomationRequest,
  UpdateAutomationRequest,
  RunAutomationRequest,
  RunAutomationResponse,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for the AI automation list page.
 * Supports cursor-based pagination, search, and filtering.
 */
export function useAiAutomations(params: Omit<AiAutomationListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.automationsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: AiAutomationListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/automations${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AiAutomationListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false, total: 0 },
      } as AiAutomationListResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

/**
 * Single AI automation detail query.
 * Enabled only when `id` is truthy.
 */
export function useAiAutomation(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.automation(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<AiAutomationDetail>(`/ai/automations/${id}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new AI automation.
 * On success: invalidates the automations list queries, shows success toast.
 */
export function useCreateAiAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAutomationRequest) => {
      const result = await apiPost<AiAutomationDetail>('/ai/automations', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success('Automation created');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automations(),
      });
    },
  });
}

/**
 * Update an existing AI automation.
 * On success: invalidates both list and detail queries.
 */
export function useUpdateAiAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAutomationRequest }) => {
      const result = await apiPatch<AiAutomationDetail>(`/ai/automations/${id}`, data);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success('Automation updated');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automation(variables.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automations(),
      });
    },
  });
}

/**
 * Delete an AI automation.
 * On success: invalidates list queries, removes detail cache, shows success toast.
 */
export function useDeleteAiAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/ai/automations/${id}`);
    },
    onSuccess: (_data, id) => {
      toast.success('Automation deleted');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automations(),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.aiAdmin.automation(id),
      });
    },
  });
}

/**
 * Manual trigger ("Run Now") for an automation.
 * Posts to POST /ai/automations/:id/run.
 * On success: shows toast with "Automation started", invalidates list to refresh lastRun.
 * Returns the created run ID.
 */
export function useRunAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input?: RunAutomationRequest['input'] }) => {
      const result = await apiPost<RunAutomationResponse>(`/ai/automations/${id}/run`, {
        input,
      });
      return result.data;
    },
    onSuccess: () => {
      toast.success('Automation started');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automations(),
      });
    },
  });
}

/**
 * Optimistic toggle for the inline isActive switch on the automation list.
 * Wraps PATCH /ai/automations/:id with { isActive: !current }.
 * Rolls back the list cache on error.
 */
export function useToggleAutomationActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const result = await apiPatch<AiAutomationDetail>(`/ai/automations/${id}`, { isActive });
      return result.data;
    },
    onMutate: async ({ id, isActive }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.aiAdmin.automations() });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueriesData<InfiniteData<AiAutomationListResponse>>({
        queryKey: queryKeys.aiAdmin.automations(),
      });

      // Optimistically update all matching list caches
      queryClient.setQueriesData<InfiniteData<AiAutomationListResponse>>(
        { queryKey: queryKeys.aiAdmin.automations() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((item) => (item.id === id ? { ...item, isActive } : item)),
            })),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Roll back to the previous value on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automations(),
      });
    },
  });
}
