// ---------------------------------------------------------------------------
// Unit Tests — React Query Hooks for Billing & Plans API
// Story: E13b.3 Task 5.1
// ---------------------------------------------------------------------------

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  billingKeys,
  useTenantBilling,
  usePlans,
  useUpdateEnforcement,
  useCreatePlan,
  useUpdatePlan,
  useAssignPlan,
} from '@/hooks/use-billing';
import { tenantKeys } from '@/hooks/use-tenants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests — billingKeys
// ---------------------------------------------------------------------------

describe('billingKeys', () => {
  it('generates correct query keys', () => {
    expect(billingKeys.all).toEqual(['billing']);
    expect(billingKeys.overview).toEqual(['billing', 'overview']);
    expect(billingKeys.tenantBilling('t-1')).toEqual(['billing', 'tenant', 't-1']);
    expect(billingKeys.plans()).toEqual(['billing', 'plans']);
    expect(billingKeys.plans({ active: true })).toEqual(['billing', 'plans', { active: true }]);
    expect(billingKeys.planDetail('p-1')).toEqual(['billing', 'plans', 'p-1']);
  });
});

// ---------------------------------------------------------------------------
// Tests — useTenantBilling
// ---------------------------------------------------------------------------

describe('useTenantBilling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches billing detail from GET /admin/tenants/:id/billing', async () => {
    const mockResponse = {
      data: {
        tenantId: 't-1',
        billingStatus: 'CURRENT',
        stripeCustomerId: 'cus_abc',
        lastPaymentAt: '2026-01-15T00:00:00Z',
        subscriptionStatus: 'active',
        currentPeriodEnd: '2026-02-15T00:00:00Z',
        gracePeriodDays: 14,
        dunningLevel: 0,
        enforcementAction: 'NONE',
      },
    };
    vi.mocked(apiGet).mockResolvedValueOnce(mockResponse);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTenantBilling('t-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiGet).toHaveBeenCalledWith('/admin/tenants/t-1/billing');
    expect(result.current.data).toEqual(mockResponse);
  });

  it('does not fetch when id is empty', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTenantBilling(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — usePlans
// ---------------------------------------------------------------------------

describe('usePlans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches plan list from GET /admin/plans', async () => {
    const mockResponse = {
      data: [
        {
          id: 'p-1',
          code: 'core',
          displayName: 'Core',
          maxUsers: 10,
          maxCompanies: 1,
          monthlyAiTokenAllowance: '100000',
          aiHardLimit: true,
          enabledModules: ['system', 'finance'],
          apiRateLimit: 500,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    vi.mocked(apiGet).mockResolvedValueOnce(mockResponse);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePlans(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiGet).toHaveBeenCalledWith('/admin/plans');
    expect(result.current.data).toEqual(mockResponse);
  });

  it('passes active filter param correctly', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({ data: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePlans({ active: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = vi.mocked(apiGet).mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/admin/plans?');
    expect(calledUrl).toContain('active=true');
  });
});

// ---------------------------------------------------------------------------
// Tests — useUpdateEnforcement
// ---------------------------------------------------------------------------

describe('useUpdateEnforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PATCH /admin/tenants/:id/billing/enforcement and invalidates caches', async () => {
    const mockResponse = {
      data: {
        tenantId: 't-1',
        previousAction: 'NONE',
        newAction: 'WARNING',
        effectiveAt: '2026-03-11T00:00:00Z',
        reason: 'Late payment',
      },
    };
    vi.mocked(apiPatch).mockResolvedValueOnce(mockResponse);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateEnforcement(), { wrapper });

    await act(async () => {
      result.current.mutate({
        id: 't-1',
        enforcementAction: 'WARNING',
        reason: 'Late payment',
        gracePeriodDays: 14,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPatch).toHaveBeenCalledWith('/admin/tenants/t-1/billing/enforcement', {
      enforcementAction: 'WARNING',
      reason: 'Late payment',
      gracePeriodDays: 14,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.detail('t-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.tenantBilling('t-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.overview });
  });

  it('shows error toast on failure', async () => {
    vi.mocked(apiPatch).mockRejectedValueOnce(new Error('Invalid transition'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateEnforcement(), { wrapper });

    await act(async () => {
      result.current.mutate({
        id: 't-1',
        enforcementAction: 'READ_ONLY',
        reason: 'Test',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Invalid transition');
  });
});

// ---------------------------------------------------------------------------
// Tests — useCreatePlan
// ---------------------------------------------------------------------------

describe('useCreatePlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /admin/plans and invalidates plans cache', async () => {
    const mockResponse = {
      data: {
        id: 'p-new',
        code: 'pro',
        displayName: 'Professional',
        maxUsers: 50,
        maxCompanies: 5,
        monthlyAiTokenAllowance: '500000',
        aiHardLimit: true,
        enabledModules: ['system', 'finance', 'sales'],
        apiRateLimit: 1000,
        isActive: true,
        createdAt: '2026-03-11T00:00:00Z',
        updatedAt: '2026-03-11T00:00:00Z',
      },
    };
    vi.mocked(apiPost).mockResolvedValueOnce(mockResponse);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreatePlan(), { wrapper });

    await act(async () => {
      result.current.mutate({
        code: 'pro',
        displayName: 'Professional',
        maxUsers: 50,
        maxCompanies: 5,
        monthlyAiTokenAllowance: 500000,
        enabledModules: ['system', 'finance', 'sales'],
        apiRateLimit: 1000,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPost).toHaveBeenCalledWith('/admin/plans', {
      code: 'pro',
      displayName: 'Professional',
      maxUsers: 50,
      maxCompanies: 5,
      monthlyAiTokenAllowance: 500000,
      enabledModules: ['system', 'finance', 'sales'],
      apiRateLimit: 1000,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.plans() });
  });

  it('sets error state on failure (error handling delegated to call-site)', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(new Error('Duplicate code'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePlan(), { wrapper });

    await act(async () => {
      result.current.mutate({
        code: 'core',
        displayName: 'Core',
        maxUsers: 10,
        maxCompanies: 1,
        monthlyAiTokenAllowance: 100000,
        enabledModules: ['system'],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // No hook-level toast — error handling is done at the call site (PlanFormDialog)
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — useUpdatePlan
// ---------------------------------------------------------------------------

describe('useUpdatePlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PATCH /admin/plans/:id and invalidates plans + planDetail caches', async () => {
    const mockResponse = {
      data: {
        id: 'p-1',
        code: 'core',
        displayName: 'Core Updated',
        maxUsers: 15,
        maxCompanies: 2,
        monthlyAiTokenAllowance: '150000',
        isActive: true,
      },
    };
    vi.mocked(apiPatch).mockResolvedValueOnce(mockResponse);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdatePlan(), { wrapper });

    await act(async () => {
      result.current.mutate({
        id: 'p-1',
        displayName: 'Core Updated',
        maxUsers: 15,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPatch).toHaveBeenCalledWith('/admin/plans/p-1', {
      displayName: 'Core Updated',
      maxUsers: 15,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.plans() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.planDetail('p-1') });
  });

  it('sets error state on failure (error handling delegated to call-site)', async () => {
    vi.mocked(apiPatch).mockRejectedValueOnce(new Error('Plan not found'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdatePlan(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'p-999', displayName: 'Nope' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // No hook-level toast — error handling is done at the call site (PlanFormDialog)
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — useAssignPlan
// ---------------------------------------------------------------------------

describe('useAssignPlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /admin/tenants/:id/assign-plan and invalidates caches', async () => {
    const mockResponse = {
      data: {
        tenantId: 't-1',
        oldPlanCode: 'core',
        newPlanCode: 'pro',
        oldPlanLimits: {
          maxUsers: 10,
          maxCompanies: 1,
          monthlyAiTokenAllowance: '100000',
          apiRateLimit: 500,
        },
        newPlanLimits: {
          maxUsers: 50,
          maxCompanies: 5,
          monthlyAiTokenAllowance: '500000',
          apiRateLimit: 1000,
        },
        changedAt: '2026-03-11T00:00:00Z',
      },
    };
    vi.mocked(apiPost).mockResolvedValueOnce(mockResponse);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignPlan(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 't-1', planId: 'p-2', reason: 'Upgrade' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPost).toHaveBeenCalledWith('/admin/tenants/t-1/assign-plan', {
      planId: 'p-2',
      reason: 'Upgrade',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.detail('t-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.tenantBilling('t-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.overview });
  });

  it('shows error toast on failure', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(new Error('Cannot assign inactive plan'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssignPlan(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 't-1', planId: 'p-inactive' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Cannot assign inactive plan');
  });
});
