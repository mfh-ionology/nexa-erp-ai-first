// ---------------------------------------------------------------------------
// Intelligence React Query Hooks — Platform Admin
// Source: Story E5d-6 Task 2.2 (AC#2–#9, #11)
// ---------------------------------------------------------------------------

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPatch, apiPost, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { usePlatformAuthStore } from '@/stores/auth-store';

import type {
  AggregationResult,
  CorrectionsFilters,
  InsightsFilters,
  InsightsGenerationResult,
  IntelligenceSummary,
  PatternsFilters,
  PlatformInsight,
  SkillEffectiveness,
  SkillEffectivenessFilters,
  TenantCorrection,
  TenantPattern,
  UpdateInsightBody,
} from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** GET /admin/intelligence/summary — dashboard KPIs (stale time: 5 min) */
export function useIntelligenceSummary() {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.intelligence.summary(),
    queryFn: async () => {
      const result = await apiGet<IntelligenceSummary>('/admin/intelligence/summary');
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — daily snapshot, not real-time
    enabled: isAuthenticated,
  });
}

/** GET /admin/intelligence/patterns — cursor-paginated tenant patterns */
export function usePatterns(
  filters: Omit<PatternsFilters, 'cursor'> = {},
  options?: { enabled?: boolean },
) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.intelligence.patternsInfinite(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const params: PatternsFilters = { ...filters };
      if (pageParam) params.cursor = pageParam as string;
      const path = `/admin/intelligence/patterns${buildQueryString(params as Record<string, string | number | boolean | null | undefined>)}`;
      const result = await apiGet<TenantPattern[]>(path);
      return { data: result.data, meta: result.meta ?? { hasMore: false } };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    staleTime: 60 * 1000, // 1 minute
    enabled: isAuthenticated && options?.enabled !== false,
  });
}

/** GET /admin/intelligence/corrections — cursor-paginated correction patterns */
export function useCorrections(
  filters: Omit<CorrectionsFilters, 'cursor'> = {},
  options?: { enabled?: boolean },
) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.intelligence.correctionsInfinite(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const params: CorrectionsFilters = { ...filters };
      if (pageParam) params.cursor = pageParam as string;
      const path = `/admin/intelligence/corrections${buildQueryString(params as Record<string, string | number | boolean | null | undefined>)}`;
      const result = await apiGet<TenantCorrection[]>(path);
      return { data: result.data, meta: result.meta ?? { hasMore: false } };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    staleTime: 60 * 1000,
    enabled: isAuthenticated && options?.enabled !== false,
  });
}

/** GET /admin/intelligence/skill-effectiveness — cursor-paginated skill metrics */
export function useSkillEffectiveness(filters: Omit<SkillEffectivenessFilters, 'cursor'> = {}) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.intelligence.skillEffectivenessInfinite(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const params: SkillEffectivenessFilters = { ...filters };
      if (pageParam) params.cursor = pageParam as string;
      const path = `/admin/intelligence/skill-effectiveness${buildQueryString(params as Record<string, string | number | boolean | null | undefined>)}`;
      const result = await apiGet<SkillEffectiveness[]>(path);
      return { data: result.data, meta: result.meta ?? { hasMore: false } };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    staleTime: 60 * 1000,
    enabled: isAuthenticated,
  });
}

/** GET /admin/intelligence/insights — cursor-paginated insights with filters */
export function useInsights(filters: Omit<InsightsFilters, 'cursor'> = {}) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.intelligence.insightsInfinite(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const params: InsightsFilters = { ...filters };
      if (pageParam) params.cursor = pageParam as string;
      const path = `/admin/intelligence/insights${buildQueryString(params as Record<string, string | number | boolean | null | undefined>)}`;
      const result = await apiGet<PlatformInsight[]>(path);
      return { data: result.data, meta: result.meta ?? { hasMore: false } };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    staleTime: 60 * 1000,
    enabled: isAuthenticated,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * PATCH /admin/intelligence/insights/:id — update insight status.
 *
 * Uses a shared mutationKey so TanStack Query tracks pending state across
 * all component instances that call this hook. Components can check
 * `useIsMutating({ mutationKey })` if they need a global busy guard.
 */
export function useUpdateInsightStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['intelligence', 'updateInsightStatus'],
    mutationFn: async ({ id, body }: { id: string; body: UpdateInsightBody }) => {
      const result = await apiPatch<PlatformInsight>(`/admin/intelligence/insights/${id}`, body);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all insight queries and summary (KPIs may change)
      void queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.insights() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.summary() });
    },
  });
}

/** POST /admin/intelligence/aggregate — trigger cross-tenant aggregation */
export function useTriggerAggregation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date?: string) => {
      const result = await apiPost<AggregationResult>(
        '/admin/intelligence/aggregate',
        date ? { date } : {},
      );
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all intelligence queries — fresh data available
      void queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.all });
    },
  });
}

/** POST /admin/intelligence/generate-insights — trigger insight generation */
export function useTriggerInsightsGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await apiPost<InsightsGenerationResult>(
        '/admin/intelligence/generate-insights',
      );
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.insights() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.summary() });
    },
  });
}
