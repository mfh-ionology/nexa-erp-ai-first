// ---------------------------------------------------------------------------
// Unit Tests — React Query Hooks for Tenant Management API
// Story: E13b.2 Task 7.2
// ---------------------------------------------------------------------------

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  },
}));

import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import {
  useTenantList,
  useTenant,
  useSuspendTenant,
  useReactivateTenant,
  useArchiveTenant,
  useUpdateModules,
  useUpdateFeatureFlags,
  tenantKeys,
} from '@/hooks/use-tenants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapper = ({ children }: { children: any }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

const mockTenantListResponse = {
  data: [{ id: 'tenant-1', code: 'acme', displayName: 'Acme Corp', status: 'ACTIVE' }],
  meta: { total: 1 },
};

const mockTenantDetailResponse = {
  data: {
    id: 'tenant-1',
    code: 'acme',
    displayName: 'Acme Corp',
    status: 'ACTIVE',
    moduleOverrides: [],
    featureFlags: [],
    billing: null,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tenantKeys', () => {
  it('generates correct query keys', () => {
    expect(tenantKeys.all).toEqual(['tenants']);
    expect(tenantKeys.list()).toEqual(['tenants', 'list', undefined]);
    expect(tenantKeys.list({ status: 'ACTIVE' })).toEqual([
      'tenants',
      'list',
      { status: 'ACTIVE' },
    ]);
    expect(tenantKeys.detail('tenant-1')).toEqual(['tenants', 'detail', 'tenant-1']);
  });
});

describe('useTenantList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches tenant list from GET /admin/tenants', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce(mockTenantListResponse);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTenantList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiGet).toHaveBeenCalledWith('/admin/tenants');
    expect(result.current.data).toEqual(mockTenantListResponse);
  });

  it('passes query params correctly', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce(mockTenantListResponse);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTenantList({ status: 'ACTIVE', limit: 25, offset: 0 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = vi.mocked(apiGet).mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/admin/tenants?');
    expect(calledUrl).toContain('status=ACTIVE');
    expect(calledUrl).toContain('limit=25');
  });
});

describe('useTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches single tenant from GET /admin/tenants/:id', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce(mockTenantDetailResponse);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTenant('tenant-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiGet).toHaveBeenCalledWith('/admin/tenants/tenant-1');
    expect(result.current.data).toEqual(mockTenantDetailResponse);
  });

  it('does not fetch when id is empty', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTenant(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('useSuspendTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /admin/tenants/:id/suspend with reason and invalidates cache', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ data: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSuspendTenant(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'tenant-1', reason: 'Policy violation' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPost).toHaveBeenCalledWith('/admin/tenants/tenant-1/suspend', {
      reason: 'Policy violation',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.detail('tenant-1') });
  });
});

describe('useReactivateTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /admin/tenants/:id/reactivate and invalidates cache', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ data: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReactivateTenant(), { wrapper });

    await act(async () => {
      result.current.mutate('tenant-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPost).toHaveBeenCalledWith('/admin/tenants/tenant-1/reactivate');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.detail('tenant-1') });
  });
});

describe('useArchiveTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /admin/tenants/:id/archive and invalidates cache', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ data: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useArchiveTenant(), { wrapper });

    await act(async () => {
      result.current.mutate('tenant-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPost).toHaveBeenCalledWith('/admin/tenants/tenant-1/archive');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.detail('tenant-1') });
  });
});

describe('useUpdateModules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PUT /admin/tenants/:id/modules with correct payload and invalidates cache', async () => {
    vi.mocked(apiPut).mockResolvedValueOnce({ data: [] });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateModules(), { wrapper });

    await act(async () => {
      result.current.mutate({
        id: 'tenant-1',
        modules: [{ moduleKey: 'crm', enabled: false, reason: 'Not needed' }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPut).toHaveBeenCalledWith('/admin/tenants/tenant-1/modules', {
      modules: [{ moduleKey: 'crm', enabled: false, reason: 'Not needed' }],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.detail('tenant-1') });
  });
});

describe('useUpdateFeatureFlags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PUT /admin/tenants/:id/feature-flags with correct payload and invalidates cache', async () => {
    vi.mocked(apiPut).mockResolvedValueOnce({ data: [] });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateFeatureFlags(), { wrapper });

    await act(async () => {
      result.current.mutate({
        id: 'tenant-1',
        flags: [{ featureKey: 'beta_reports', enabled: true }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiPut).toHaveBeenCalledWith('/admin/tenants/tenant-1/feature-flags', {
      flags: [{ featureKey: 'beta_reports', enabled: true }],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.detail('tenant-1') });
  });
});
