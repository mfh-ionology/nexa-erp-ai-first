import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiPut = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiPut: (...args: unknown[]) => mockApiPut(...args),
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

describe('useUpdatePrintPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PUT with preferences and shows success toast', async () => {
    const updatedPreferences = [
      { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD', source: 'USER' },
    ];
    mockApiPut.mockResolvedValue({ data: updatedPreferences });

    const { useUpdatePrintPreferences } = await import('./use-update-print-preferences');
    const { result } = renderHook(() => useUpdatePrintPreferences(), {
      wrapper: createWrapper(),
    });

    const input = {
      preferences: [{ documentType: 'SALES_INVOICE' as const, action: 'AUTO_DOWNLOAD' as const }],
    };

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPut).toHaveBeenCalledWith('/system/print-preferences', input);
    expect(mockToastSuccess).toHaveBeenCalledWith('preferences.saveSuccess');
  });

  it('shows error toast on failure', async () => {
    mockApiPut.mockRejectedValue(new Error('Server error'));

    const { useUpdatePrintPreferences } = await import('./use-update-print-preferences');
    const { result } = renderHook(() => useUpdatePrintPreferences(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        preferences: [{ documentType: 'SALES_INVOICE', action: 'BROWSER_PRINT' }],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith('preferences.saveError');
  });

  it('returns updated preferences on success', async () => {
    const updatedPreferences = [
      { documentType: 'SALES_INVOICE', action: 'BROWSER_PRINT', source: 'USER' },
      { documentType: 'CREDIT_NOTE', action: 'AUTO_DOWNLOAD', source: 'USER' },
    ];
    mockApiPut.mockResolvedValue({ data: updatedPreferences });

    const { useUpdatePrintPreferences } = await import('./use-update-print-preferences');
    const { result } = renderHook(() => useUpdatePrintPreferences(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        preferences: [
          { documentType: 'SALES_INVOICE', action: 'BROWSER_PRINT' },
          { documentType: 'CREDIT_NOTE', action: 'AUTO_DOWNLOAD' },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(updatedPreferences);
  });
});
