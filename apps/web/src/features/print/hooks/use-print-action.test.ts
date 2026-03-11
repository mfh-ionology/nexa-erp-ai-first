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
const fullPreferences = [
  { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD', source: 'USER' },
  { documentType: 'CREDIT_NOTE', action: 'BROWSER_PRINT', source: 'COMPANY_DEFAULT' },
  { documentType: 'PURCHASE_ORDER', action: 'NONE', source: 'FALLBACK' },
  { documentType: 'DELIVERY_NOTE', action: 'AUTO_DOWNLOAD', source: 'USER' },
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

describe('usePrintAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it('returns the resolved action for a document type with USER source', async () => {
    mockApiGet.mockResolvedValue({ data: fullPreferences });

    const { usePrintAction } = await import('./use-print-action');
    const { result } = renderHook(() => usePrintAction('SALES_INVOICE'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe('AUTO_DOWNLOAD');
  });

  it('returns the action for COMPANY_DEFAULT source preferences', async () => {
    mockApiGet.mockResolvedValue({ data: fullPreferences });

    const { usePrintAction } = await import('./use-print-action');
    const { result } = renderHook(() => usePrintAction('CREDIT_NOTE'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe('BROWSER_PRINT');
  });

  it('returns NONE for FALLBACK source preferences', async () => {
    mockApiGet.mockResolvedValue({ data: fullPreferences });

    const { usePrintAction } = await import('./use-print-action');
    const { result } = renderHook(() => usePrintAction('PURCHASE_ORDER'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe('NONE');
  });

  it('returns NONE for document types not in preferences', async () => {
    mockApiGet.mockResolvedValue({ data: fullPreferences });

    const { usePrintAction } = await import('./use-print-action');
    const { result } = renderHook(() => usePrintAction('PAYSLIP'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe('NONE');
  });

  it('returns NONE and isLoading=true while data is loading', async () => {
    // Never resolve the mock to keep the query in loading state
    mockApiGet.mockReturnValue(new Promise(() => {}));

    const { usePrintAction } = await import('./use-print-action');
    const { result } = renderHook(() => usePrintAction('SALES_INVOICE'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.action).toBe('NONE');
  });

  it('returns NONE when not authenticated (query disabled)', async () => {
    mockIsAuthenticated = false;

    const { usePrintAction } = await import('./use-print-action');
    const { result } = renderHook(() => usePrintAction('SALES_INVOICE'), {
      wrapper: createWrapper(),
    });

    expect(result.current.action).toBe('NONE');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
