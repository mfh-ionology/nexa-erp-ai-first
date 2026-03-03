/**
 * TanStack Query hooks for AI Prompt admin CRUD operations.
 *
 * - useAiPrompts: Infinite query for paginated prompt list
 * - useAiPrompt: Single prompt detail query
 * - useCreateAiPrompt: Create mutation
 * - useUpdateAiPrompt: Update mutation (sends changeReason in body)
 * - useDeleteAiPrompt: Delete mutation
 * - useAiPromptVersions: Query for version list
 * - useAiPromptVersion: Query for single version detail
 * - useRestoreAiPromptVersion: Restore mutation
 * - useTestAiPrompt: Test render mutation
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  AiPromptListItem,
  AiPromptListParams,
  AiPromptListResponse,
  AiPromptDetail,
  CreateAiPromptRequest,
  UpdateAiPromptRequest,
  AiPromptVersionItem,
  AiPromptVersionDetail,
  TestRenderRequest,
  TestRenderResult,
} from './types';

// ─── Prompt Queries ─────────────────────────────────────────────────────────

/**
 * Infinite query for the AI prompt list page.
 * Supports cursor-based pagination, search, and category filtering.
 */
export function useAiPrompts(params: Omit<AiPromptListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.promptsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: AiPromptListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/admin/prompts${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AiPromptListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as AiPromptListResponse;
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
 * Single AI prompt detail query.
 * Enabled only when `id` is truthy.
 */
export function useAiPrompt(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.prompt(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<AiPromptDetail>(`/ai/admin/prompts/${id}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

// ─── Prompt Mutations ───────────────────────────────────────────────────────

/**
 * Create a new AI prompt.
 * On success: invalidates the prompts list queries.
 */
export function useCreateAiPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAiPromptRequest) => {
      const result = await apiPost<AiPromptDetail>('/ai/admin/prompts', data);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.prompts(),
      });
    },
  });
}

/**
 * Update an existing AI prompt (sends changeReason in body).
 * On success: invalidates list, detail, and version queries.
 */
export function useUpdateAiPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAiPromptRequest }) => {
      const result = await apiPatch<AiPromptDetail>(`/ai/admin/prompts/${id}`, data);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success('Prompt updated successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.prompt(variables.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.prompts(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.promptVersions(variables.id),
      });
    },
  });
}

/**
 * Delete an AI prompt.
 * On success: invalidates list queries, shows success toast.
 */
export function useDeleteAiPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/ai/admin/prompts/${id}`);
    },
    onSuccess: () => {
      toast.success('Prompt deleted successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.prompts(),
      });
    },
  });
}

// ─── Version Queries ────────────────────────────────────────────────────────

/**
 * List all versions for a prompt, ordered by version DESC.
 */
export function useAiPromptVersions(promptId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.promptVersions(promptId ?? ''),
    queryFn: async () => {
      const result = await apiGet<AiPromptVersionItem[]>(`/ai/admin/prompts/${promptId}/versions`);
      return result.data;
    },
    enabled: isAuthenticated && !!promptId,
  });
}

/**
 * Get a single version's full content for diff comparison.
 */
export function useAiPromptVersion(promptId: string | undefined, version: number | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.promptVersion(promptId ?? '', version ?? 0),
    queryFn: async () => {
      const result = await apiGet<AiPromptVersionDetail>(
        `/ai/admin/prompts/${promptId}/versions/${version}`,
      );
      return result.data;
    },
    enabled: isAuthenticated && !!promptId && version !== undefined && version > 0,
  });
}

// ─── Version Mutations ──────────────────────────────────────────────────────

/**
 * Restore a previous prompt version (creates a new version with the old content).
 * On success: invalidates prompt detail, versions, and list queries.
 */
export function useRestoreAiPromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ promptId, version }: { promptId: string; version: number }) => {
      const result = await apiPost<AiPromptVersionDetail>(
        `/ai/admin/prompts/${promptId}/versions/${version}/restore`,
      );
      return result.data;
    },
    onSuccess: (data) => {
      toast.success(`Version restored. Now active: v${data.version}`);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.prompt(data.promptId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.promptVersions(data.promptId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.prompts(),
      });
    },
  });
}

// ─── Test Render ────────────────────────────────────────────────────────────

/**
 * Test render a prompt with sample variables via PromptRenderer.
 */
export function useTestAiPrompt() {
  return useMutation({
    mutationFn: async ({ promptId, ...body }: TestRenderRequest & { promptId: string }) => {
      const result = await apiPost<TestRenderResult>(`/ai/admin/prompts/${promptId}/test`, body);
      return result.data;
    },
  });
}
