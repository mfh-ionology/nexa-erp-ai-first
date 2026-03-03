/**
 * TanStack Query hooks for AI Skill admin CRUD operations.
 *
 * - useAiSkills: Infinite query for paginated skill flat list
 * - useAiSkillsGrouped: Query for grouped skills (accordion view)
 * - useAiSkill: Single skill detail query
 * - useCreateAiSkill: Create mutation
 * - useUpdateAiSkill: Update mutation (also used by inline isActive toggle)
 * - useDeactivateAiSkill: Deactivate (soft-delete) mutation
 * - useTestTrigger: Trigger testing mutation (L0→L1→L2 simulation)
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, apiPatch, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  AiSkillListItem,
  AiSkillListParams,
  AiSkillListResponse,
  AiSkillDetail,
  SkillsGroupedResponse,
  CreateAiSkillRequest,
  UpdateAiSkillRequest,
  TestTriggerResult,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for the AI skill flat list page.
 * Supports cursor-based pagination, search, and filtering.
 */
export function useAiSkills(params: Omit<AiSkillListParams, 'cursor' | 'grouped'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.skillsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: AiSkillListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/admin/skills${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AiSkillListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as AiSkillListResponse;
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
 * Query for grouped skills (accordion view by moduleKey).
 * Uses `grouped=true` query param to get server-side grouping.
 */
export function useAiSkillsGrouped(params: Omit<AiSkillListParams, 'cursor' | 'grouped'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.skillsGrouped(params as Record<string, unknown>),
    queryFn: async () => {
      const fullParams = { ...params, grouped: true };
      const path = `/ai/admin/skills${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<SkillsGroupedResponse>(path);
      return result.data;
    },
    enabled: isAuthenticated,
  });
}

/**
 * Single AI skill detail query.
 * Enabled only when `id` is truthy.
 */
export function useAiSkill(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.skill(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<AiSkillDetail>(`/ai/admin/skills/${id}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new AI skill.
 * On success: invalidates the skills list queries.
 */
export function useCreateAiSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAiSkillRequest) => {
      const result = await apiPost<AiSkillDetail>('/ai/admin/skills', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success('Skill created successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.skills(),
      });
    },
  });
}

/**
 * Update an existing AI skill.
 * Also used by the inline isActive toggle (AC-6).
 * On success: invalidates both list and detail queries, shows success toast.
 */
export function useUpdateAiSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAiSkillRequest }) => {
      const result = await apiPatch<AiSkillDetail>(`/ai/admin/skills/${id}`, data);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.skill(variables.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.skills(),
      });
    },
  });
}

/**
 * Deactivate (soft-delete) an AI skill via PATCH /skills/:id/deactivate.
 * On success: invalidates list queries, removes detail cache, shows success toast.
 */
export function useDeactivateAiSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiPatch(`/ai/admin/skills/${id}/deactivate`, {});
    },
    onSuccess: (_data, id) => {
      toast.success('Skill deactivated successfully');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.skills(),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.aiAdmin.skill(id),
      });
    },
  });
}

/**
 * Test trigger simulation — sends a phrase and receives L0→L1→L2 match results.
 * Endpoint: POST /ai/admin/skills/test-trigger
 */
export function useTestTrigger() {
  return useMutation({
    mutationFn: async (phrase: string) => {
      const result = await apiPost<TestTriggerResult>('/ai/admin/skills/test-trigger', { phrase });
      return result.data;
    },
  });
}
