import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { UserAccessGroupAssignment } from './types';
import { useUserAccessGroups, useAssignAccessGroups } from './use-user-access-groups';

// --- Mock API client ---
const mockApiGet = vi.fn();
const mockApiPut = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      userAccessGroups: (userId: string) => ['system', 'users', userId, 'access-groups'],
      user: (id: string) => ['system', 'users', id],
      usersInfinite: () => ['system', 'users', 'infinite'],
    },
  },
}));

// --- Mock auth store (authenticated by default) ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Mock sonner toast ---
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock @nexa/api-client errors (hoisted) ---
const { MockApiError } = vi.hoisted(() => {
  class _MockApiError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { MockApiError: _MockApiError };
});

vi.mock('@nexa/api-client', () => ({
  ApiError: MockApiError,
  ApiClient: class MockApiClient {
    constructor(_config: unknown) {}
    request = vi.fn();
    get = vi.fn();
    post = vi.fn();
    patch = vi.fn();
    put = vi.fn();
    delete = vi.fn();
  },
}));

// --- Test data ---
const testAssignments: UserAccessGroupAssignment[] = [
  {
    id: 'ag-1',
    code: 'FULL_ACCESS',
    name: 'Full Access',
    description: 'Full system access',
    isSystem: true,
    assignedBy: 'Admin User',
    assignedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'ag-2',
    code: 'SALES_MGR',
    name: 'Sales Manager',
    description: 'Sales module access',
    isSystem: false,
    assignedBy: 'Admin User',
    assignedAt: '2025-01-02T00:00:00Z',
  },
];

// --- Helper: create wrapper with QueryClient ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    },
    queryClient,
  };
}

describe('useUserAccessGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns assigned access groups for a user', async () => {
    mockApiGet.mockResolvedValue({
      data: testAssignments,
    });

    const { result } = renderHook(() => useUserAccessGroups('user-1'), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(testAssignments);
  });

  it('calls GET /system/users/:id/access-groups', async () => {
    mockApiGet.mockResolvedValue({
      data: testAssignments,
    });

    renderHook(() => useUserAccessGroups('user-1'), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(mockApiGet).toHaveBeenCalledWith('/system/users/user-1/access-groups');
  });

  it('disabled when userId is undefined', async () => {
    const { result } = renderHook(() => useUserAccessGroups(undefined), {
      wrapper: createWrapper().wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('useAssignAccessGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT /system/users/:id/access-groups with accessGroupIds array', async () => {
    const response = {
      userId: 'user-1',
      companyId: 'company-1',
      accessGroups: [
        {
          id: 'ag-1',
          code: 'FULL_ACCESS',
          name: 'Full Access',
          assignedBy: 'Admin',
          assignedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };
    mockApiPut.mockResolvedValue({ data: response });

    const { wrapper, queryClient } = createWrapper();
    vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignAccessGroups('user-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ accessGroupIds: ['ag-1'] });
    });

    expect(mockApiPut).toHaveBeenCalledWith('/system/users/user-1/access-groups', {
      accessGroupIds: ['ag-1'],
    });
  });

  it('shows success toast on successful save', async () => {
    mockApiPut.mockResolvedValue({ data: {} });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignAccessGroups('user-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ accessGroupIds: ['ag-1', 'ag-2'] });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('users.accessGroups.saveSuccess');
  });

  it('invalidates userAccessGroups, user, and usersInfinite queries on success', async () => {
    mockApiPut.mockResolvedValue({ data: {} });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignAccessGroups('user-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ accessGroupIds: ['ag-1'] });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'users', 'user-1', 'access-groups'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'users', 'user-1'],
      exact: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'users', 'infinite'],
    });
  });

  it('422 error shows "at least one access group required" toast', async () => {
    const error422 = new MockApiError(
      'BUSINESS_RULE_VIOLATION',
      'At least one access group is required',
      422,
    );
    mockApiPut.mockRejectedValue(error422);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignAccessGroups('user-1'), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ accessGroupIds: [] });
      } catch {
        // Expected — mutateAsync re-throws
      }
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('users.accessGroups.minOneRequired');
    });
  });

  it('other errors show generic error toast', async () => {
    const error500 = new Error('Server error');
    mockApiPut.mockRejectedValue(error500);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignAccessGroups('user-1'), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ accessGroupIds: ['ag-1'] });
      } catch {
        // Expected — mutateAsync re-throws
      }
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('errors:unexpected');
    });
  });
});
