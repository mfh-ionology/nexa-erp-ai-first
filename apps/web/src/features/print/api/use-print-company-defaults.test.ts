import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiGet = vi.fn();
const mockApiPut = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

// --- Mock auth store ---
let mockIsAuthenticated = true;
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

// --- Mock toast ---
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock i18n ---
vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
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
const testDefaults = [
  { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD' },
  { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT' },
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

describe('usePrintCompanyDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it('fetches and returns company default items', async () => {
    mockApiGet.mockResolvedValue({ data: testDefaults });

    const { usePrintCompanyDefaults } = await import('./use-print-company-defaults');
    const { result } = renderHook(() => usePrintCompanyDefaults(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(testDefaults);
    expect(result.current.data).toHaveLength(2);
    expect(mockApiGet).toHaveBeenCalledWith('/system/print-preferences/company-defaults');
  });

  it('does not fetch when not authenticated', async () => {
    mockIsAuthenticated = false;

    const { usePrintCompanyDefaults } = await import('./use-print-company-defaults');
    renderHook(() => usePrintCompanyDefaults(), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Forbidden'));

    const { usePrintCompanyDefaults } = await import('./use-print-company-defaults');
    const { result } = renderHook(() => usePrintCompanyDefaults(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useUpdatePrintCompanyDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PUT with defaults and shows success toast', async () => {
    const updatedDefaults = [{ documentType: 'SALES_INVOICE', action: 'BROWSER_PRINT' }];
    mockApiPut.mockResolvedValue({ data: updatedDefaults });

    const { useUpdatePrintCompanyDefaults } = await import('./use-print-company-defaults');
    const { result } = renderHook(() => useUpdatePrintCompanyDefaults(), {
      wrapper: createWrapper(),
    });

    const input = {
      defaults: [{ documentType: 'SALES_INVOICE' as const, action: 'BROWSER_PRINT' as const }],
    };

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPut).toHaveBeenCalledWith('/system/print-preferences/company-defaults', input);
    expect(mockToastSuccess).toHaveBeenCalledWith('preferences.companyDefaults.saveSuccess');
  });

  it('shows error toast on failure', async () => {
    mockApiPut.mockRejectedValue(new Error('Server error'));

    const { useUpdatePrintCompanyDefaults } = await import('./use-print-company-defaults');
    const { result } = renderHook(() => useUpdatePrintCompanyDefaults(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        defaults: [{ documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD' }],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith('preferences.companyDefaults.saveError');
  });
});
