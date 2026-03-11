import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

// --- Mock auth store ---
let mockIsAuthenticated = true;
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    printPreferences: {
      all: ['print-preferences'],
      user: () => ['print-preferences', 'user'],
      companyDefaults: () => ['print-preferences', 'company-defaults'],
    },
  },
}));

// --- Test data ---
const testPreferences = [
  { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD', source: 'USER' },
  { documentType: 'CREDIT_NOTE', action: 'NONE', source: 'COMPANY_DEFAULT' },
  { documentType: 'PURCHASE_ORDER', action: 'NONE', source: 'FALLBACK' },
];

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

describe('usePrintPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it('fetches and returns preference items', async () => {
    mockApiGet.mockResolvedValue({ data: testPreferences });

    const { usePrintPreferences } = await import('./use-print-preferences');
    const { result } = renderHook(() => usePrintPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(testPreferences);
    expect(result.current.data).toHaveLength(3);
    expect(mockApiGet).toHaveBeenCalledWith('/system/print-preferences');
  });

  it('does not fetch when not authenticated', async () => {
    mockIsAuthenticated = false;

    const { usePrintPreferences } = await import('./use-print-preferences');
    renderHook(() => usePrintPreferences(), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const { usePrintPreferences } = await import('./use-print-preferences');
    const { result } = renderHook(() => usePrintPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('returns items with correct source annotations', async () => {
    mockApiGet.mockResolvedValue({ data: testPreferences });

    const { usePrintPreferences } = await import('./use-print-preferences');
    const { result } = renderHook(() => usePrintPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const userPref = result.current.data!.find((i) => i.documentType === 'SALES_INVOICE');
    const companyDefault = result.current.data!.find((i) => i.documentType === 'CREDIT_NOTE');
    const fallback = result.current.data!.find((i) => i.documentType === 'PURCHASE_ORDER');

    expect(userPref!.source).toBe('USER');
    expect(companyDefault!.source).toBe('COMPANY_DEFAULT');
    expect(fallback!.source).toBe('FALLBACK');
  });
});
