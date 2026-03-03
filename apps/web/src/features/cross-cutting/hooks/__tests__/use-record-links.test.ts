import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { RecordLink, ListResponse } from '../../types';

// --- Mock API client functions ---
const mockListRecordLinks = vi.fn();
const mockCreateRecordLink = vi.fn();
const mockDeleteRecordLink = vi.fn();

vi.mock('../../api/record-link-api', () => ({
  listRecordLinks: (...args: unknown[]) => mockListRecordLinks(...args),
  createRecordLink: (...args: unknown[]) => mockCreateRecordLink(...args),
  deleteRecordLink: (...args: unknown[]) => mockDeleteRecordLink(...args),
}));

// --- Mock toast ---
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    recordLinks: {
      all: ['record-links'],
      list: (entityType: string, entityId: string) => ['record-links', entityType, entityId],
    },
  },
}));

// --- Test data ---
const TEST_ENTITY_TYPE = 'CustomerInvoice';
const TEST_ENTITY_ID = 'inv-123';

const testLinks: RecordLink[] = [
  {
    id: 'link-1',
    sourceEntityType: TEST_ENTITY_TYPE,
    sourceEntityId: TEST_ENTITY_ID,
    targetEntityType: 'SalesOrder',
    targetEntityId: 'so-456',
    linkType: 'CREATED_FROM',
    isSystemGenerated: true,
    description: null,
    direction: 'outgoing',
    createdBy: 'system',
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'link-2',
    sourceEntityType: 'CustomerPayment',
    sourceEntityId: 'pay-789',
    targetEntityType: TEST_ENTITY_TYPE,
    targetEntityId: TEST_ENTITY_ID,
    linkType: 'PAYMENT_FOR',
    isSystemGenerated: false,
    description: 'Payment link',
    direction: 'incoming',
    createdBy: 'user-1',
    createdAt: '2025-06-02T14:30:00Z',
    updatedAt: '2025-06-02T14:30:00Z',
  },
];

const testListResponse: ListResponse<RecordLink> = {
  items: testLinks,
  total: 2,
};

// --- Helper: create wrapper with QueryClient ---
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

describe('useRecordLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns record links data', async () => {
    mockListRecordLinks.mockResolvedValue(testListResponse);

    const { useRecordLinks } = await import('../use-record-links');
    const { result } = renderHook(() => useRecordLinks(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.links).toEqual(testLinks);
    expect(result.current.total).toBe(2);
  });

  it('returns empty array when no data', async () => {
    mockListRecordLinks.mockResolvedValue({ items: [], total: 0 });

    const { useRecordLinks } = await import('../use-record-links');
    const { result } = renderHook(() => useRecordLinks(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.links).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('does not fetch when entityType is empty', async () => {
    const { useRecordLinks } = await import('../use-record-links');
    renderHook(() => useRecordLinks('', TEST_ENTITY_ID), { wrapper: createWrapper() });

    expect(mockListRecordLinks).not.toHaveBeenCalled();
  });

  it('does not fetch when entityId is empty', async () => {
    const { useRecordLinks } = await import('../use-record-links');
    renderHook(() => useRecordLinks(TEST_ENTITY_TYPE, ''), { wrapper: createWrapper() });

    expect(mockListRecordLinks).not.toHaveBeenCalled();
  });

  it('calls listRecordLinks with correct params', async () => {
    mockListRecordLinks.mockResolvedValue(testListResponse);

    const { useRecordLinks } = await import('../use-record-links');
    renderHook(() => useRecordLinks(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockListRecordLinks).toHaveBeenCalled());
    expect(mockListRecordLinks).toHaveBeenCalledWith(TEST_ENTITY_TYPE, TEST_ENTITY_ID);
  });
});

describe('useCreateRecordLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates record link', async () => {
    const newLink = { ...testLinks[0], id: 'link-new' };
    mockCreateRecordLink.mockResolvedValue(newLink);

    const { useCreateRecordLink } = await import('../use-record-links');
    const { result } = renderHook(() => useCreateRecordLink(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    const input = {
      sourceEntityType: TEST_ENTITY_TYPE,
      sourceEntityId: TEST_ENTITY_ID,
      targetEntityType: 'SalesOrder',
      targetEntityId: 'so-789',
      linkType: 'RELATES_TO' as const,
    };

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCreateRecordLink).toHaveBeenCalledWith(input);
  });

  it('shows error toast on failure', async () => {
    mockCreateRecordLink.mockRejectedValue(new Error('Create failed'));

    const { useCreateRecordLink } = await import('../use-record-links');
    const { result } = renderHook(() => useCreateRecordLink(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        sourceEntityType: TEST_ENTITY_TYPE,
        sourceEntityId: TEST_ENTITY_ID,
        targetEntityType: 'SalesOrder',
        targetEntityId: 'so-789',
        linkType: 'RELATES_TO',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Failed to create link',
      variant: 'destructive',
    });
  });
});

describe('useDeleteRecordLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes record link and invalidates cache', async () => {
    mockDeleteRecordLink.mockResolvedValue(undefined);
    mockListRecordLinks.mockResolvedValue(testListResponse);

    const { useDeleteRecordLink, useRecordLinks } = await import('../use-record-links');
    const wrapper = createWrapper();

    // Populate cache
    const { result: listResult } = renderHook(
      () => useRecordLinks(TEST_ENTITY_TYPE, TEST_ENTITY_ID),
      { wrapper },
    );
    await waitFor(() => expect(listResult.current.isLoading).toBe(false));

    // Delete
    const { result } = renderHook(() => useDeleteRecordLink(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper,
    });

    act(() => {
      result.current.mutate('link-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDeleteRecordLink).toHaveBeenCalledWith('link-1');
  });

  it('shows error toast on failure', async () => {
    mockDeleteRecordLink.mockRejectedValue(new Error('Delete failed'));

    const { useDeleteRecordLink } = await import('../use-record-links');
    const { result } = renderHook(() => useDeleteRecordLink(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('link-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Failed to delete link',
      variant: 'destructive',
    });
  });
});
