// ---------------------------------------------------------------------------
// React Query Hooks — Billing & Plans API
// Source: API Contracts §21.4, plans.routes.ts, tenants.routes.ts
// Story: E13b.3 Task 1.2
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPatch, apiPost, buildQueryString } from '@/lib/api-client';
import type {
  AssignPlanResult,
  BillingDetail,
  CreatePlanInput,
  EnforcementAction,
  EnforcementTransitionResult,
  Plan,
  UpdatePlanInput,
} from '@/types/tenant';
import { tenantKeys } from './use-tenants';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const billingKeys = {
  all: ['billing'] as const,
  overview: ['billing', 'overview'] as const,
  tenantBilling: (id: string) => ['billing', 'tenant', id] as const,
  plans: (params?: { active?: boolean }) =>
    params ? (['billing', 'plans', params] as const) : (['billing', 'plans'] as const),
  planDetail: (id: string) => ['billing', 'plans', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTenantBilling(id: string) {
  return useQuery({
    queryKey: billingKeys.tenantBilling(id),
    queryFn: () => apiGet<BillingDetail>(`/admin/tenants/${id}/billing`),
    enabled: !!id,
  });
}

export function usePlans(params?: { active?: boolean }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingKeys.plans(params),
    queryFn: () => {
      const qs = params
        ? buildQueryString(params as Record<string, string | number | boolean | null | undefined>)
        : '';
      return apiGet<Plan[]>(`/admin/plans${qs}`);
    },
    ...(options?.enabled !== undefined && { enabled: options.enabled }),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useUpdateEnforcement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      enforcementAction,
      reason,
      gracePeriodDays,
    }: {
      id: string;
      enforcementAction: EnforcementAction;
      reason: string;
      gracePeriodDays?: number;
    }) =>
      apiPatch<EnforcementTransitionResult>(`/admin/tenants/${id}/billing/enforcement`, {
        enforcementAction,
        reason,
        gracePeriodDays,
      }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: tenantKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: billingKeys.tenantBilling(id) });
      void qc.invalidateQueries({ queryKey: billingKeys.overview });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update enforcement action');
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanInput) => apiPost<Plan>('/admin/plans', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billingKeys.plans() });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdatePlanInput & { id: string }) =>
      apiPatch<Plan>(`/admin/plans/${id}`, input),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: billingKeys.plans() });
      void qc.invalidateQueries({ queryKey: billingKeys.planDetail(id) });
    },
  });
}

export function useAssignPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, planId, reason }: { id: string; planId: string; reason?: string }) =>
      apiPost<AssignPlanResult>(`/admin/tenants/${id}/assign-plan`, { planId, reason }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: tenantKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: billingKeys.tenantBilling(id) });
      void qc.invalidateQueries({ queryKey: billingKeys.overview });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign plan');
    },
  });
}
