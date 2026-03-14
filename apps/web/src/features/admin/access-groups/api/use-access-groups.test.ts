import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { AccessGroup, AccessGroupDetail } from './types';
import { useAccessGroups, useAccessGroup } from './use-access-groups';

// --- Mock API client ---
const mockApiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (entries.length === 0) return '';
    const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return `?${qs}`;
  },
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      accessGroups: (params?: Record<string, unknown>) =>
        params ? ['system', 'access-groups', params] : ['system', 'access-groups'],
      accessGroupsInfinite: (params?: Record<string, unknown>) =>
        params
          ? ['system', 'access-groups', 'infinite', params]
          : ['system', 'access-groups', 'infinite'],
      accessGroup: (id: string) => ['system', 'access-groups', id],
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
const testAccessGroups: AccessGroup[] = [
  {
    id: 'ag-1',
    code: 'FULL_ACCESS',
    name: 'Full Access',
    description: 'Full access to all modules',
    isSystem: true,
    isActive: true,
    userCount: 3,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'ag-2',
    code: 'SALES_MGR',
    name: 'Sales Manager',
    description: 'Sales module access',
    isSystem: false,
    isActive: true,
    userCount: 5,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'ag-3',
    code: 'FINANCE_VIEWER',
    name: 'Finance Viewer',
    description: null,
    isSystem: false,
    isActive: true,
    userCount: 2,
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-03T00:00:00Z',
  },
];

const testAccessGroupDetail: AccessGroupDetail = {
  ...testAccessGroups[0]!,
  companyId: 'company-1',
  permissions: [
    {
      resourceCode: 'finance.journals.list',
      resourceName: 'Journal Entries',
      resourceModule: 'finance',
      resourceType: 'PAGE',
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
    },
  ],
  fieldOverrides: [],
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

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

describe('useAccessGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns typed AccessGroup[] data', async () => {
    mockApiGet.mockResolvedValue({
      data: testAccessGroups,
      meta: { hasMore: false },
    });

    const { result } = renderHook(() => useAccessGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toEqual(testAccessGroups);
  });

  it('query key includes params: ["access-groups", { search: "sales" }]', async () => {
    mockApiGet.mockResolvedValue({
      data: [testAccessGroups[1]],
      meta: { hasMore: false },
    });

    renderHook(() => useAccessGroups({ search: 'sales' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=sales'));
  });

  it('infinite query supports cursor-based pagination', async () => {
    // First page
    mockApiGet.mockResolvedValueOnce({
      data: testAccessGroups.slice(0, 2),
      meta: { cursor: 'cursor-abc', hasMore: true },
    });

    const { result } = renderHook(() => useAccessGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.hasNextPage).toBe(true);

    // Second page
    mockApiGet.mockResolvedValueOnce({
      data: [testAccessGroups[2]],
      meta: { hasMore: false },
    });

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.data).toHaveLength(3));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('empty params returns all active access groups', async () => {
    mockApiGet.mockResolvedValue({
      data: testAccessGroups,
      meta: { hasMore: false },
    });

    renderHook(() => useAccessGroups({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith('/system/access-groups');
  });

  it('search param filters by code/name', async () => {
    mockApiGet.mockResolvedValue({
      data: [testAccessGroups[1]],
      meta: { hasMore: false },
    });

    renderHook(() => useAccessGroups({ search: 'sales' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=sales'));
  });

  it('passes cursor on subsequent pages', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: testAccessGroups.slice(0, 2),
      meta: { cursor: 'cursor-xyz', hasMore: true },
    });

    const { result } = renderHook(() => useAccessGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    mockApiGet.mockResolvedValueOnce({
      data: [testAccessGroups[2]],
      meta: { hasMore: false },
    });

    result.current.fetchNextPage();

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(mockApiGet).toHaveBeenLastCalledWith(expect.stringContaining('cursor=cursor-xyz'));
  });
});

describe('useAccessGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AccessGroupDetail with permissions and field overrides', async () => {
    mockApiGet.mockResolvedValue({
      data: testAccessGroupDetail,
    });

    const { result } = renderHook(() => useAccessGroup('ag-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(testAccessGroupDetail);
    expect(result.current.data?.permissions).toHaveLength(1);
    expect(result.current.data?.fieldOverrides).toHaveLength(0);
  });

  it('query key is ["access-groups", id]', async () => {
    mockApiGet.mockResolvedValue({
      data: testAccessGroupDetail,
    });

    renderHook(() => useAccessGroup('ag-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith('/system/access-groups/ag-1');
  });

  it('disabled when id is undefined', async () => {
    const { result } = renderHook(() => useAccessGroup(undefined), {
      wrapper: createWrapper(),
    });

    // Should not fire a query
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
