/**
 * TanStack Query hooks for AI Automation Run operations.
 *
 * - useAutomationRuns: Infinite query for paginated run list per automation
 * - useAutomationRun: Single run detail query (with step runs)
 * - useRetryAutomationRun: Retry from failed step mutation
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  AiAutomationRunListItem,
  AiAutomationRunListParams,
  AiAutomationRunListResponse,
  AiAutomationRunDetail,
  RetryAutomationRunResponse,
} from './types';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Infinite query for runs of a specific automation.
 * Supports cursor-based pagination and status filtering.
 */
export function useAutomationRuns(
  automationId: string | undefined,
  params: Omit<AiAutomationRunListParams, 'cursor'> = {},
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.automationRuns(
      automationId ?? '',
      params as Record<string, unknown>,
    ),
    queryFn: async ({ pageParam }) => {
      const fullParams: AiAutomationRunListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/automations/${automationId}/runs${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AiAutomationRunListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false, total: 0 },
      } as AiAutomationRunListResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled: isAuthenticated && !!automationId,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

/**
 * Single automation run detail query (includes step runs).
 * Enabled only when `runId` is truthy.
 */
export function useAutomationRun(runId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.automationRun(runId ?? ''),
    queryFn: async () => {
      const result = await apiGet<AiAutomationRunDetail>(`/ai/automations/runs/${runId}`);
      return result.data;
    },
    enabled: isAuthenticated && !!runId,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Retry an automation run from its failed step.
 * Posts to POST /ai/automations/runs/:runId/retry.
 * On success: invalidates run queries, shows success toast.
 */
export function useRetryAutomationRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const result = await apiPost<RetryAutomationRunResponse>(
        `/ai/automations/runs/${runId}/retry`,
      );
      return result.data;
    },
    onSuccess: (data) => {
      toast.success('Automation retry started');
      // Invalidate the specific run detail
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automationRun(data.originalRunId),
      });
      // Invalidate runs list for this automation
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automationRuns(data.automationId),
      });
      // Invalidate automation list to refresh lastRun status
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automations(),
      });
    },
  });
}
