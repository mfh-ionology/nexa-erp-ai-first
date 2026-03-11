// ---------------------------------------------------------------------------
// React Query Hooks — Tenant Management API
// Source: API Contracts §21.1, tenants.routes.ts
// Story: E13b.2 Task 1.2
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost, apiPut, buildQueryString } from '@/lib/api-client';
import type {
  FeatureFlagsUpdateBody,
  ModulesUpdateBody,
  SuspendTenantBody,
  TenantDetail,
  TenantFeatureFlag,
  TenantListItem,
  TenantListParams,
  TenantModuleOverride,
} from '@/types/tenant';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const tenantKeys = {
  all: ['tenants'] as const,
  list: (params?: TenantListParams) => ['tenants', 'list', params] as const,
  detail: (id: string) => ['tenants', 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTenantList(params: TenantListParams = {}) {
  return useQuery({
    queryKey: tenantKeys.list(params),
    queryFn: async () => {
      const qs = buildQueryString(
        params as Record<string, string | number | boolean | null | undefined>,
      );
      return apiGet<TenantListItem[]>(`/admin/tenants${qs}`);
    },
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: tenantKeys.detail(id),
    queryFn: () => apiGet<TenantDetail>(`/admin/tenants/${id}`),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSuspendTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost<void>(`/admin/tenants/${id}/suspend`, { reason } satisfies SuspendTenantBody),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: tenantKeys.detail(id) });
    },
  });
}

export function useReactivateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/admin/tenants/${id}/reactivate`),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: tenantKeys.detail(id) });
    },
  });
}

export function useArchiveTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/admin/tenants/${id}/archive`),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: tenantKeys.detail(id) });
    },
  });
}

export function useUpdateModules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, modules }: { id: string } & ModulesUpdateBody) =>
      apiPut<TenantModuleOverride[]>(`/admin/tenants/${id}/modules`, { modules }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: tenantKeys.detail(id) });
    },
  });
}

export function useUpdateFeatureFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, flags }: { id: string } & FeatureFlagsUpdateBody) =>
      apiPut<TenantFeatureFlag[]>(`/admin/tenants/${id}/feature-flags`, { flags }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: tenantKeys.detail(id) });
    },
  });
}
