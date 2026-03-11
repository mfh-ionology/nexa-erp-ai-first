// ---------------------------------------------------------------------------
// AI Usage React Query Hooks — Platform Admin
// Story E13b-4 Task 4.3
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPatch, apiPost, BASE_URL, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { usePlatformAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types (mirrored from backend ai.schema.ts)
// ---------------------------------------------------------------------------

export interface DailyTrendItem {
  date: string;
  tokens: number;
  cost: string;
}

export interface TopConsumer {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  tokens: number;
}

export interface AiUsageSummary {
  tokensToday: number;
  tokensThisMonth: number;
  costEstimateToday: string;
  costEstimateThisMonth: string;
  dailyTrend: DailyTrendItem[];
  topConsumers: TopConsumer[];
}

export interface ProviderBreakdown {
  provider: string;
  tokens: number;
  pct: number;
}

export interface ByokSplit {
  byokTokens: number;
  vendorTokens: number;
  byokPct: number;
}

export interface TenantAiUsage {
  tokensToday: number;
  tokensThisMonth: number;
  costEstimate: string;
  dailyTrend: DailyTrendItem[];
  byProvider: ProviderBreakdown[];
  byokSplit: ByokSplit;
}

export interface FeatureUsage {
  featureKey: string;
  tokens: number;
  pct: number;
  calls: number;
}

export interface AiUsageByFeature {
  features: FeatureUsage[];
}

export interface AiAlert {
  id: string;
  type: 'QUOTA_WARNING' | 'QUOTA_EXCEEDED' | 'USAGE_SPIKE';
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  message: string;
  usagePct: number;
  threshold: number | null;
  dailyTokens: number | null;
  rollingAvgTokens: number | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface AiAlertsFilters {
  type?: 'QUOTA_WARNING' | 'QUOTA_EXCEEDED' | 'USAGE_SPIKE';
  acknowledged?: boolean;
}

export interface AcknowledgeAlertResult {
  id: string;
  acknowledged: boolean;
  acknowledgedBy: string;
  acknowledgedAt: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** GET /admin/ai/usage/summary — cross-tenant aggregate (stale time: 2 min) */
export function useAiUsageSummary() {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiUsage.summary(),
    queryFn: async () => {
      const result = await apiGet<AiUsageSummary>('/admin/ai/usage/summary');
      return result.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated,
  });
}

/** GET /admin/tenants/:id/ai/usage — per-tenant usage dashboard */
export function useTenantAiUsage(tenantId: string) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiUsage.tenantUsage(tenantId),
    queryFn: async () => {
      const result = await apiGet<TenantAiUsage>(`/admin/tenants/${tenantId}/ai/usage`);
      return result.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated && !!tenantId,
  });
}

/** GET /admin/tenants/:id/ai/usage/by-feature — feature breakdown */
export function useTenantAiUsageByFeature(tenantId: string) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiUsage.tenantUsageByFeature(tenantId),
    queryFn: async () => {
      const result = await apiGet<AiUsageByFeature>(
        `/admin/tenants/${tenantId}/ai/usage/by-feature`,
      );
      return result.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated && !!tenantId,
  });
}

/** GET /admin/ai/alerts — alert listing with optional filters */
export function useAiAlerts(filters?: AiAlertsFilters) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiUsage.alerts(filters as Record<string, unknown> | undefined),
    queryFn: async () => {
      const params: Record<string, string | number | boolean | null | undefined> = {};
      if (filters?.type) params.type = filters.type;
      if (filters?.acknowledged !== undefined) params.acknowledged = filters.acknowledged;
      const path = `/admin/ai/alerts${buildQueryString(params)}`;
      const result = await apiGet<AiAlert[]>(path);
      return result.data;
    },
    staleTime: 30 * 1000,
    enabled: isAuthenticated,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST /admin/ai/alerts/:id/acknowledge — acknowledge an alert */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ai-usage', 'acknowledgeAlert'],
    mutationFn: async (alertId: string) => {
      const result = await apiPost<AcknowledgeAlertResult>(
        `/admin/ai/alerts/${alertId}/acknowledge`,
      );
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.alerts() });
    },
  });
}

// ---------------------------------------------------------------------------
// Tenant Quota
// ---------------------------------------------------------------------------

export interface TenantQuotaData {
  periodStart: string;
  periodEnd: string;
  tokensUsed: number;
  tokenAllowance: number;
  softLimitPct: number;
  hardLimitPct: number;
}

/** GET /admin/tenants/:id/ai/quota — tenant quota settings */
export function useTenantAiQuota(tenantId: string) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiUsage.tenantQuota(tenantId),
    queryFn: async () => {
      const result = await apiGet<TenantQuotaData>(`/admin/tenants/${tenantId}/ai/quota`);
      return result.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated && !!tenantId,
  });
}

export interface UpdateQuotaInput {
  tokenAllowance?: number;
  softLimitPct?: number;
  hardLimitPct?: number;
}

/** PATCH /admin/tenants/:id/ai/quota — update quota settings */
export function useUpdateTenantQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ai-usage', 'updateQuota'],
    mutationFn: async ({ tenantId, ...body }: UpdateQuotaInput & { tenantId: string }) => {
      const result = await apiPatch<TenantQuotaData>(`/admin/tenants/${tenantId}/ai/quota`, body);
      return result.data;
    },
    onSuccess: (_data, { tenantId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.tenantUsage(tenantId) });
    },
  });
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/** Triggers a browser download for GET /admin/ai/usage/export?startDate=...&endDate=... */
export function useExportAiUsageCsv() {
  return useMutation({
    mutationKey: ['ai-usage', 'exportCsv'],
    mutationFn: async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
      // Get token at execution time, not hook creation time, to avoid stale tokens
      const { accessToken } = usePlatformAuthStore.getState();
      const qs = buildQueryString({ startDate, endDate });
      const res = await fetch(`${BASE_URL}/admin/ai/usage/export${qs}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!res.ok) {
        // Attempt to parse structured error from Platform API
        let message = `Export failed: ${res.status}`;
        try {
          const json = (await res.json()) as { error?: { message?: string } };
          if (json.error?.message) message = json.error.message;
        } catch {
          // Response body not JSON — use generic message
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-usage-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revocation so the browser has time to read the blob URL
      setTimeout(() => URL.revokeObjectURL(url), 200);
    },
  });
}
