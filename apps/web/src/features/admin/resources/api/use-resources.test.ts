import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { Resource } from './use-resources';
import { useResources, useResourcesInfinite } from './use-resources';

// --- Mock API client ---
const mockApiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      resources: (params?: Record<string, unknown>) =>
        params ? ['system', 'resources', params] : ['system', 'resources'],
      resourcesInfinite: (params?: Record<string, unknown>) =>
        params
          ? ['system', 'resources', 'infinite', params]
          : ['system', 'resources', 'infinite'],
    },
  },
}));

// --- Mock auth store (authenticated by default) ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Test data ---
const testResources: Resource[] = [
  {
    id: '1',
    code: 'finance.journals.list',
    name: 'Journal Entries',
    module: 'finance',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: 'BookOpen',
    description: 'View and manage journal entries',
    isActive: true,
  },
  {
    id: '2',
    code: 'sales.orders.list',
    name: 'Sales Orders',
    module: 'sales',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: 'ShoppingCart',
    description: 'View and manage sales orders',
    isActive: true,
  },
  {
    id: '3',
    code: 'finance.balanceSheet',
    name: 'Balance Sheet',
    module: 'finance',
    type: 'REPORT',
    parentCode: null,
    sortOrder: 10,
    icon: 'BarChart',
    description: 'Balance sheet report',
    isActive: true,
  },
];

// --- Helper: create wrapper with QueryClient ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns typed Resource[] data', async () => {
    mockApiGet.mockResolvedValue({
      data: testResources,
      meta: { hasMore: false },
    });

    const { result } = renderHook(() => useResources(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toEqual(testResources);
    expect(result.current.data?.meta).toEqual({ hasMore: false });
  });

  it('passes empty params — fetches all resources', async () => {
    mockApiGet.mockResolvedValue({
      data: testResources,
      meta: { hasMore: false },
    });

    renderHook(() => useResources({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith('/system/resources');
  });

  it('passes module filter as query param', async () => {
    mockApiGet.mockResolvedValue({
      data: [testResources[0]],
      meta: { hasMore: false },
    });

    renderHook(() => useResources({ module: 'finance' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('module=finance'),
    );
  });

  it('passes type filter as query param', async () => {
    mockApiGet.mockResolvedValue({
      data: [testResources[2]],
      meta: { hasMore: false },
    });

    renderHook(() => useResources({ type: 'REPORT' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('type=REPORT'),
    );
  });

  it('passes search as query param', async () => {
    mockApiGet.mockResolvedValue({
      data: testResources,
      meta: { hasMore: false },
    });

    renderHook(() => useResources({ search: 'journal' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('search=journal'),
    );
  });
});

describe('useResourcesInfinite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches first page and flattens data', async () => {
    mockApiGet.mockResolvedValue({
      data: testResources.slice(0, 2),
      meta: { cursor: '2', hasMore: true },
    });

    const { result } = renderHook(() => useResourcesInfinite(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toEqual(testResources.slice(0, 2));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('supports pagination — fetchNextPage loads more', async () => {
    // First page
    mockApiGet.mockResolvedValueOnce({
      data: testResources.slice(0, 2),
      meta: { cursor: '2', hasMore: true },
    });

    const { result } = renderHook(() => useResourcesInfinite(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);

    // Second page
    mockApiGet.mockResolvedValueOnce({
      data: [testResources[2]],
      meta: { hasMore: false },
    });

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.data).toHaveLength(3));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('passes cursor on subsequent pages', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: testResources.slice(0, 2),
      meta: { cursor: 'cursor-abc', hasMore: true },
    });

    const { result } = renderHook(() => useResourcesInfinite(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    mockApiGet.mockResolvedValueOnce({
      data: [testResources[2]],
      meta: { hasMore: false },
    });

    result.current.fetchNextPage();

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(mockApiGet).toHaveBeenLastCalledWith(
      expect.stringContaining('cursor=cursor-abc'),
    );
  });

  it('passes module filter as query param', async () => {
    mockApiGet.mockResolvedValue({
      data: [testResources[0]],
      meta: { hasMore: false },
    });

    renderHook(() => useResourcesInfinite({ module: 'finance' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('module=finance'),
    );
  });

  it('passes type filter as query param', async () => {
    mockApiGet.mockResolvedValue({
      data: [testResources[2]],
      meta: { hasMore: false },
    });

    renderHook(() => useResourcesInfinite({ type: 'REPORT' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('type=REPORT'),
    );
  });

  it('passes search as query param', async () => {
    mockApiGet.mockResolvedValue({
      data: testResources,
      meta: { hasMore: false },
    });

    renderHook(() => useResourcesInfinite({ search: 'journal' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('search=journal'),
    );
  });
});
