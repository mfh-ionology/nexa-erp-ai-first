/* eslint-disable i18next/no-literal-string */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import type { PlatformKnowledgeArticle, CreateKnowledgeBody } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn(
    (selector: (s: { isAuthenticated: boolean; user: { id: string; role: string } }) => unknown) =>
      selector({ isAuthenticated: true, user: { id: 'admin-1', role: 'PLATFORM_ADMIN' } }),
  ),
}));

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
  },
}));

import {
  useCreateKnowledgeArticle,
  usePublishKnowledgeArticle,
  useDeleteKnowledgeArticle,
  usePlatformKnowledgeArticles,
} from '../use-platform-knowledge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockArticle: PlatformKnowledgeArticle = {
  id: 'article-1',
  title: 'Best Practice: AR Aging Reports',
  content: 'Always review aging reports weekly.',
  category: 'BEST_PRACTICE',
  targetIndustries: ['Construction'],
  targetPlanTiers: [],
  version: 1,
  status: 'DRAFT',
  publishedAt: null,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  createdById: 'admin-1',
  distributionStats: { totalEligibleTenants: 8, accepted: 0, rejected: 0, pending: 0 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePlatformKnowledgeArticles', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('fetches paginated knowledge articles', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: [mockArticle],
      meta: { hasMore: false },
    });

    const { result } = renderHook(() => usePlatformKnowledgeArticles({ status: 'DRAFT' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const allData = result.current.data?.pages.flatMap((p) => p.data) ?? [];
    expect(allData).toHaveLength(1);
    expect(allData[0]!.title).toBe('Best Practice: AR Aging Reports');
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('status=DRAFT'));
  });
});

describe('useCreateKnowledgeArticle + usePublishKnowledgeArticle (mutation chain)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('creates an article then publishes it in sequence', async () => {
    // Create returns draft article
    mockApiPost
      .mockResolvedValueOnce({ data: mockArticle })
      // Publish returns published article
      .mockResolvedValueOnce({
        data: {
          ...mockArticle,
          status: 'PUBLISHED',
          publishedAt: '2026-03-02T00:00:00Z',
          distributionStats: { totalEligibleTenants: 8, accepted: 3, rejected: 0, pending: 5 },
        },
      });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Create
    const { result: createResult } = renderHook(() => useCreateKnowledgeArticle(), {
      wrapper: createWrapper(queryClient),
    });

    const body: CreateKnowledgeBody = {
      title: 'Best Practice: AR Aging Reports',
      content: 'Always review aging reports weekly.',
      category: 'BEST_PRACTICE',
      targetIndustries: ['Construction'],
    };

    act(() => {
      createResult.current.mutate(body);
    });

    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(mockApiPost).toHaveBeenCalledWith('/admin/intelligence/knowledge', body);
    expect(createResult.current.data?.id).toBe('article-1');

    // Publish
    const { result: publishResult } = renderHook(() => usePublishKnowledgeArticle(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      publishResult.current.mutate('article-1');
    });

    await waitFor(() => expect(publishResult.current.isSuccess).toBe(true));
    expect(mockApiPost).toHaveBeenCalledWith('/admin/intelligence/knowledge/article-1/publish');
    expect(publishResult.current.data?.status).toBe('PUBLISHED');

    // Both should invalidate knowledge list
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['knowledge', 'list']),
      }),
    );
  });

  it('handles create failure', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Validation error'));

    const { result } = renderHook(() => useCreateKnowledgeArticle(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        title: '',
        content: '',
        category: 'BEST_PRACTICE',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Validation error');
  });
});

describe('useDeleteKnowledgeArticle', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('deletes an article and invalidates knowledge list', async () => {
    mockApiDelete.mockResolvedValueOnce({});

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteKnowledgeArticle(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate('article-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiDelete).toHaveBeenCalledWith('/admin/intelligence/knowledge/article-1');

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['knowledge', 'list']),
      }),
    );
  });

  it('handles 500 server error', async () => {
    mockApiDelete.mockRejectedValueOnce(new Error('Internal Server Error'));

    const { result } = renderHook(() => useDeleteKnowledgeArticle(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate('article-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Internal Server Error');
  });
});
