/* eslint-disable i18next/no-literal-string */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import type {
  IntelligenceSummary,
  PlatformInsight,
  AggregationResult,
  InsightsGenerationResult,
} from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock auth store — always authenticated
vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn(
    (selector: (s: { isAuthenticated: boolean; user: { id: string; role: string } }) => unknown) =>
      selector({ isAuthenticated: true, user: { id: 'admin-1', role: 'PLATFORM_ADMIN' } }),
  ),
}));

// Mock API client
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
  },
}));

// Import hooks after mocks are set up
import {
  useIntelligenceSummary,
  useInsights,
  useUpdateInsightStatus,
  useTriggerAggregation,
  useTriggerInsightsGeneration,
} from '../use-intelligence';

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

const mockSummary: IntelligenceSummary = {
  totalContributingTenants: 12,
  totalPatterns: 850,
  totalCorrections: 234,
  totalKnowledgeArticles: 42,
  overallAiSuccessRate: 87.5,
  lastAggregatedAt: '2026-03-04T10:00:00.000Z',
  topSkillsByUsage: [
    { skillKey: 'ar.aging_report', totalQueries: 500, avgSuccessRate: '0.92', trend: 'IMPROVING' },
  ],
  topInsightsBySeverity: [],
};

const mockInsights: PlatformInsight[] = [
  {
    id: 'insight-1',
    insightType: 'FEATURE_GAP',
    title: 'Missing AR dunning letters',
    description: 'No skill for automated dunning letters',
    evidence: { module: 'AR', tenantCount: 8, frequency: 120 },
    severity: 'HIGH',
    status: 'NEW',
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'insight-2',
    insightType: 'FEATURE_GAP',
    title: 'No inventory forecasting',
    description: 'Demand forecasting not available',
    evidence: { module: 'Inventory', tenantCount: 3, frequency: 45 },
    severity: 'LOW',
    status: 'REVIEWED',
    reviewedById: 'admin-1',
    reviewedAt: '2026-03-02T00:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIntelligenceSummary', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('returns correct data shape from GET /admin/intelligence/summary', async () => {
    mockApiGet.mockResolvedValueOnce({ data: mockSummary });

    const { result } = renderHook(() => useIntelligenceSummary(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSummary);
    expect(result.current.data?.totalContributingTenants).toBe(12);
    expect(result.current.data?.overallAiSuccessRate).toBe(87.5);
    expect(mockApiGet).toHaveBeenCalledWith('/admin/intelligence/summary');
  });

  it('handles network failure gracefully', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useIntelligenceSummary(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useInsights', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('filters by insightType and returns paginated data', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: mockInsights,
      meta: { hasMore: false },
    });

    const { result } = renderHook(() => useInsights({ insightType: 'FEATURE_GAP' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const allData = result.current.data?.pages.flatMap((p) => p.data) ?? [];
    expect(allData).toHaveLength(2);
    expect(allData[0]!.insightType).toBe('FEATURE_GAP');
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('insightType=FEATURE_GAP'));
  });

  it('filters by severity', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: [mockInsights[0]],
      meta: { hasMore: false },
    });

    const { result } = renderHook(
      () => useInsights({ insightType: 'FEATURE_GAP', severity: 'HIGH' }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('severity=HIGH'));
  });

  it('handles 403 forbidden error', async () => {
    const error = new Error('Forbidden');
    (error as unknown as { statusCode: number }).statusCode = 403;
    mockApiGet.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useInsights({ insightType: 'FEATURE_GAP' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useUpdateInsightStatus', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('calls PATCH endpoint and invalidates correct query keys', async () => {
    const updatedInsight = { ...mockInsights[0], status: 'REVIEWED' };
    mockApiPatch.mockResolvedValueOnce({ data: updatedInsight });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateInsightStatus(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        id: 'insight-1',
        body: { status: 'REVIEWED', reviewedById: 'admin-1' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPatch).toHaveBeenCalledWith('/admin/intelligence/insights/insight-1', {
      status: 'REVIEWED',
      reviewedById: 'admin-1',
    });

    // Should invalidate both insights and summary queries
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['intelligence', 'insights']),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['intelligence', 'summary']),
      }),
    );
  });

  it('handles mutation error', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useUpdateInsightStatus(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        id: 'insight-1',
        body: { status: 'REVIEWED' },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Server error');
  });
});

describe('useTriggerAggregation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('calls POST /admin/intelligence/aggregate and invalidates all intelligence queries', async () => {
    const mockResult: AggregationResult = {
      processedTenants: 10,
      skippedTenants: 2,
      patternsCreated: 150,
      correctionsCreated: 45,
    };
    mockApiPost.mockResolvedValueOnce({ data: mockResult });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useTriggerAggregation(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPost).toHaveBeenCalledWith('/admin/intelligence/aggregate', {});
    expect(result.current.data).toEqual(mockResult);

    // Should invalidate all intelligence queries
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['intelligence'],
      }),
    );
  });
});

describe('useTriggerInsightsGeneration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('calls POST /admin/intelligence/generate-insights and invalidates insights + summary', async () => {
    const mockResult: InsightsGenerationResult = {
      insightsGenerated: 15,
      byType: { featureGap: 5, workflowOpportunity: 4, defaultCandidate: 3, skillImprovement: 3 },
    };
    mockApiPost.mockResolvedValueOnce({ data: mockResult });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useTriggerInsightsGeneration(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPost).toHaveBeenCalledWith('/admin/intelligence/generate-insights');
    expect(result.current.data).toEqual(mockResult);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['intelligence', 'insights']),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['intelligence', 'summary']),
      }),
    );
  });
});
