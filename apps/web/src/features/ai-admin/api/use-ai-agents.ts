/**
 * TanStack Query hooks for AI Agent admin CRUD operations.
 *
 * - useAiAgents: Infinite query for paginated agent list
 * - useAiAgent: Single agent detail query
 * - useCreateAiAgent: Create mutation
 * - useUpdateAiAgent: Update mutation
 * - useDeleteAiAgent: Delete mutation
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  AiAgentListItem,
  AiAgentListParams,
  AiAgentListResponse,
  AiAgentDetail,
  CreateAiAgentRequest,
  UpdateAiAgentRequest,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for the AI agent list page.
 * Supports cursor-based pagination, search, and filtering.
 */
export function useAiAgents(params: Omit<AiAgentListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.agentsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: AiAgentListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/admin/agents${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AiAgentListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as AiAgentListResponse;
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
 * Single AI agent detail query.
 * Enabled only when `id` is truthy.
 */
export function useAiAgent(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.agent(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<AiAgentDetail>(`/ai/admin/agents/${id}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new AI agent.
 * On success: invalidates the agents list queries.
 */
export function useCreateAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAiAgentRequest) => {
      const result = await apiPost<AiAgentDetail>('/ai/admin/agents', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success('Agent created successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.agents(),
      });
    },
  });
}

/**
 * Update an existing AI agent.
 * On success: invalidates both list and detail queries, shows success toast.
 */
export function useUpdateAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAiAgentRequest }) => {
      const result = await apiPatch<AiAgentDetail>(`/ai/admin/agents/${id}`, data);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.agent(variables.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.agents(),
      });
    },
  });
}

/**
 * Delete an AI agent.
 * On success: invalidates list queries, removes detail cache, shows success toast.
 */
export function useDeleteAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/ai/admin/agents/${id}`);
    },
    onSuccess: (_data, id) => {
      toast.success('Agent deleted successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.agents(),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.aiAdmin.agent(id),
      });
    },
  });
}
