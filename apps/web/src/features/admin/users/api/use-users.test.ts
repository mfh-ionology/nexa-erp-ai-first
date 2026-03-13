import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { UserListItem } from './types';
import { useUsers } from './use-users';

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
      usersInfinite: (params?: Record<string, unknown>) =>
        params ? ['system', 'users', 'infinite', params] : ['system', 'users', 'infinite'],
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
const testUsers: UserListItem[] = [
  {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'ADMIN',
    accessGroupCount: 2,
    isActive: true,
    lastLoginAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'user-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    role: 'STAFF',
    accessGroupCount: 1,
    isActive: true,
    lastLoginAt: null,
  },
  {
    id: 'user-3',
    firstName: 'Bob',
    lastName: 'Wilson',
    email: 'bob@example.com',
    role: 'VIEWER',
    accessGroupCount: 1,
    isActive: false,
    lastLoginAt: '2025-05-15T08:30:00Z',
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

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns typed UserListItem[] data', async () => {
    mockApiGet.mockResolvedValue({
      data: testUsers,
      meta: { hasMore: false },
    });

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toEqual(testUsers);
  });

  it('query key includes params: ["users", "infinite", { search: "john" }]', async () => {
    mockApiGet.mockResolvedValue({
      data: [testUsers[0]],
      meta: { hasMore: false },
    });

    renderHook(() => useUsers({ search: 'john' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=john'));
  });

  it('infinite query supports cursor-based pagination', async () => {
    // First page
    mockApiGet.mockResolvedValueOnce({
      data: testUsers.slice(0, 2),
      meta: { cursor: 'cursor-abc', hasMore: true },
    });

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.hasNextPage).toBe(true);

    // Second page
    mockApiGet.mockResolvedValueOnce({
      data: [testUsers[2]],
      meta: { hasMore: false },
    });

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.data).toHaveLength(3));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('empty params returns all users', async () => {
    mockApiGet.mockResolvedValue({
      data: testUsers,
      meta: { hasMore: false },
    });

    renderHook(() => useUsers({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith('/system/users');
  });

  it('search param filters by name or email', async () => {
    mockApiGet.mockResolvedValue({
      data: [testUsers[0]],
      meta: { hasMore: false },
    });

    renderHook(() => useUsers({ search: 'john' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=john'));
  });

  it('passes cursor on subsequent pages', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: testUsers.slice(0, 2),
      meta: { cursor: 'cursor-xyz', hasMore: true },
    });

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    mockApiGet.mockResolvedValueOnce({
      data: [testUsers[2]],
      meta: { hasMore: false },
    });

    result.current.fetchNextPage();

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(mockApiGet).toHaveBeenLastCalledWith(expect.stringContaining('cursor=cursor-xyz'));
  });
});
