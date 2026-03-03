/**
 * TanStack Query hooks for AI Automation Run operations.
 *
 * - useAllAutomationRuns: Infinite query for all runs across automations
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
 * Infinite query for all automation runs across all automations.
 * Used by the Automation Runs list page (AC-1).
 * Supports cursor-based pagination, status, date range, and automationId filtering.
 */
export function useAllAutomationRuns(
  params: Omit<AiAutomationRunListParams, 'cursor'> | undefined,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const resolvedParams = params ?? {};

  return useInfiniteQuery({
    queryKey: queryKeys.aiAdmin.automationRunsAll(resolvedParams as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: AiAutomationRunListParams = {
        ...resolvedParams,
        limit: resolvedParams.limit ?? 50,
      };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/ai/automations/runs${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AiAutomationRunListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false, total: 0 },
      } as AiAutomationRunListResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled: isAuthenticated && params !== undefined,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

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
      // Invalidate the specific run detail (original run)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automationRun(data.originalRunId),
      });
      // Invalidate runs list for this automation
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automationRuns(data.automationId),
      });
      // Invalidate cross-automation run list
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automationRunsAll(),
      });
      // Invalidate automation list to refresh lastRun status
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automations(),
      });
      // Invalidate automation health (run counts may have changed)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.automationHealth(),
      });
    },
  });
}
