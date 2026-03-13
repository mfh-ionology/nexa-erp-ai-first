import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import {
  useCreateAccessGroup,
  useUpdateAccessGroup,
  useSetPermissions,
  useSetFieldOverrides,
  useDeactivateAccessGroup,
} from './use-access-group-mutations';

// --- Mock API client ---
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      accessGroups: () => ['system', 'access-groups'],
      accessGroup: (id: string) => ['system', 'access-groups', id],
    },
  },
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

// --- Mock @nexa/api-client errors ---
// Need actual classes for instanceof checks; use vi.hoisted so they're
// available inside the vi.mock factory (which is hoisted to top of file).
const { MockApiError, MockValidationError } = vi.hoisted(() => {
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

  class _MockValidationError extends _MockApiError {
    readonly details: Record<string, string[]>;
    constructor(message: string, details: Record<string, string[]> = {}) {
      super('VALIDATION_ERROR', message, 400);
      this.name = 'ValidationError';
      this.details = details;
    }
  }

  return { MockApiError: _MockApiError, MockValidationError: _MockValidationError };
});

vi.mock('@nexa/api-client', () => ({
  ApiError: MockApiError,
  ValidationError: MockValidationError,
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

describe('useCreateAccessGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /system/access-groups and invalidates list on success', async () => {
    const createdGroup = { id: 'ag-new', code: 'NEW_GROUP', name: 'New Group' };
    mockApiPost.mockResolvedValue({ data: createdGroup });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateAccessGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ code: 'NEW_GROUP', name: 'New Group' });
    });

    expect(mockApiPost).toHaveBeenCalledWith('/system/access-groups', {
      code: 'NEW_GROUP',
      name: 'New Group',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'access-groups'],
    });
  });

  it('maps 409 error — caller handles field-level error on code', async () => {
    const error409 = new MockApiError('CONFLICT', 'Duplicate code', 409);
    mockApiPost.mockRejectedValue(error409);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAccessGroup(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ code: 'DUPE', name: 'Dupe' });
      } catch {
        // Expected — mutateAsync re-throws for the caller to handle
      }
    });

    // The mutation itself does not handle 409 — it re-throws for the caller
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateAccessGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PATCH /system/access-groups/:id and invalidates list + detail on success', async () => {
    const updated = { id: 'ag-1', name: 'Updated Name' };
    mockApiPatch.mockResolvedValue({ data: updated });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateAccessGroup('ag-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Updated Name' });
    });

    expect(mockApiPatch).toHaveBeenCalledWith('/system/access-groups/ag-1', {
      name: 'Updated Name',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'access-groups', 'ag-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'access-groups'],
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('accessGroups.toast.updated');
  });
});

describe('useSetPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT with full permissions array and invalidates detail on success', async () => {
    mockApiPut.mockResolvedValue({ data: {} });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetPermissions('ag-1'), { wrapper });

    const permPayload = [
      {
        resourceCode: 'finance.journals.list',
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: false,
        canDelete: false,
      },
    ];

    await act(async () => {
      await result.current.mutateAsync(permPayload);
    });

    expect(mockApiPut).toHaveBeenCalledWith('/system/access-groups/ag-1/permissions', permPayload);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'access-groups', 'ag-1'],
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('accessGroups.toast.permissionsSaved');
  });

  it('maps 400 (invalid resource codes) to toast error', async () => {
    const error400 = new MockValidationError('Invalid resources', {
      resourceCodes: ['bad.resource.code'],
    });
    mockApiPut.mockRejectedValue(error400);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetPermissions('ag-1'), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync([]);
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('accessGroups.error.invalidResources');
    });
  });
});

describe('useSetFieldOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT /system/access-groups/:id/field-overrides with correct body and invalidates detail on success', async () => {
    const responseData = {
      accessGroupId: 'ag-1',
      overrideCount: 2,
      fieldOverrides: [
        { resourceCode: 'finance.journals', fieldPath: 'costPrice', visibility: 'HIDDEN' },
        { resourceCode: 'finance.journals', fieldPath: 'purchasePrice', visibility: 'READ_ONLY' },
      ],
    };
    mockApiPut.mockResolvedValue({ data: responseData });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetFieldOverrides('ag-1'), { wrapper });

    const payload = {
      fieldOverrides: [
        { resourceCode: 'finance.journals', fieldPath: 'costPrice', visibility: 'HIDDEN' as const },
        {
          resourceCode: 'finance.journals',
          fieldPath: 'purchasePrice',
          visibility: 'READ_ONLY' as const,
        },
      ],
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockApiPut).toHaveBeenCalledWith('/system/access-groups/ag-1/field-overrides', payload);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'access-groups', 'ag-1'],
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('accessGroups.toast.fieldOverridesSaved');
  });

  it('maps 400 (invalid resource codes) to toast error', async () => {
    const error400 = new MockValidationError('Invalid resources', {
      resourceCodes: ['bad.resource.code'],
    });
    mockApiPut.mockRejectedValue(error400);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetFieldOverrides('ag-1'), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ fieldOverrides: [] });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('accessGroups.error.invalidResources');
    });
  });

  it('maps 404 error to field overrides save failed toast', async () => {
    const error404 = new MockApiError('NOT_FOUND', 'Access group not found', 404);
    mockApiPut.mockRejectedValue(error404);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetFieldOverrides('ag-missing'), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ fieldOverrides: [] });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('accessGroups.error.fieldOverridesSaveFailed');
    });
  });

  it('maps unexpected error to fallback error toast', async () => {
    const unexpectedError = new Error('Network failure');
    mockApiPut.mockRejectedValue(unexpectedError);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetFieldOverrides('ag-1'), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ fieldOverrides: [] });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('errors:unexpected');
    });
  });
});

describe('useDeactivateAccessGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls DELETE /system/access-groups/:id and invalidates list on success', async () => {
    mockApiDelete.mockResolvedValue({ data: undefined });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeactivateAccessGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ag-2');
    });

    expect(mockApiDelete).toHaveBeenCalledWith('/system/access-groups/ag-2');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['system', 'access-groups'],
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('accessGroups.toast.deactivated');
  });

  it('maps 409 (active users assigned) to toast error', async () => {
    const error409 = new MockApiError('CONFLICT', 'Users assigned', 409);
    mockApiDelete.mockRejectedValue(error409);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeactivateAccessGroup(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync('ag-2');
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('accessGroups.error.hasActiveUsers');
    });
  });
});
