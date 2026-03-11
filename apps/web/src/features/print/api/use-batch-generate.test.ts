import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(() => true, {
    getState: () => ({ accessToken: 'test-token', activeCompanyId: 'company-1' }),
  }),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    printPreferences: {
      all: ['print-preferences'],
      user: () => ['print-preferences', 'user'],
      companyDefaults: () => ['print-preferences', 'company-defaults'],
      batchStatus: (id: string) => ['print-preferences', 'batch-status', id],
    },
  },
}));

// --- Helper ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useBatchGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /system/documents/batch-generate with correct payload', async () => {
    mockApiPost.mockResolvedValue({ data: { batchJobId: 'batch-123' } });

    const { useBatchGenerate } = await import('./use-batch-generate');
    const { result } = renderHook(() => useBatchGenerate(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        documentType: 'SALES_INVOICE',
        recordIds: ['inv-1', 'inv-2', 'inv-3'],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPost).toHaveBeenCalledWith('/system/documents/batch-generate', {
      documentType: 'SALES_INVOICE',
      recordIds: ['inv-1', 'inv-2', 'inv-3'],
    });
    expect(result.current.data).toEqual({ batchJobId: 'batch-123' });
  });

  it('handles mutation error', async () => {
    mockApiPost.mockRejectedValue(new Error('Service unavailable'));

    const { useBatchGenerate } = await import('./use-batch-generate');
    const { result } = renderHook(() => useBatchGenerate(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        documentType: 'PURCHASE_ORDER',
        recordIds: ['po-1'],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useBatchGenerateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches batch status for given batchJobId', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        batchJobId: 'batch-123',
        status: 'active',
        total: 5,
        completed: 2,
        failed: 0,
        errors: [],
      },
    });

    const { useBatchGenerateStatus } = await import('./use-batch-generate');
    const { result } = renderHook(() => useBatchGenerateStatus('batch-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiGet).toHaveBeenCalledWith('/system/documents/batch-generate/batch-123/status');
    expect(result.current.data).toEqual({
      batchJobId: 'batch-123',
      status: 'active',
      total: 5,
      completed: 2,
      failed: 0,
      errors: [],
    });
  });

  it('does not fetch when batchJobId is null', async () => {
    const { useBatchGenerateStatus } = await import('./use-batch-generate');
    const { result } = renderHook(() => useBatchGenerateStatus(null), {
      wrapper: createWrapper(),
    });

    // Wait a tick to ensure no query fires
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('stops polling when status is completed', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        batchJobId: 'batch-456',
        status: 'completed',
        total: 3,
        completed: 3,
        failed: 0,
        errors: [],
      },
    });

    const { useBatchGenerateStatus } = await import('./use-batch-generate');
    const { result } = renderHook(() => useBatchGenerateStatus('batch-456'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.status).toBe('completed');
    // The refetchInterval should return false for completed status
    // (query won't continue polling)
  });

  it('stops polling when status is failed', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        batchJobId: 'batch-789',
        status: 'failed',
        total: 2,
        completed: 0,
        failed: 2,
        errors: ['Template not found', 'Record not found'],
      },
    });

    const { useBatchGenerateStatus } = await import('./use-batch-generate');
    const { result } = renderHook(() => useBatchGenerateStatus('batch-789'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.status).toBe('failed');
    expect(result.current.data?.errors).toEqual(['Template not found', 'Record not found']);
  });

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const { useBatchGenerateStatus } = await import('./use-batch-generate');
    const { result } = renderHook(() => useBatchGenerateStatus('batch-err'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
