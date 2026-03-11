import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiDelete = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
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

describe('useResetPrintPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls DELETE /system/print-preferences/reset', async () => {
    const resetPreferences = [
      { documentType: 'SALES_INVOICE', action: 'NONE', source: 'FALLBACK' },
    ];
    mockApiDelete.mockResolvedValue({ data: resetPreferences });

    const { useResetPrintPreferences } = await import('./use-reset-print-preferences');
    const { result } = renderHook(() => useResetPrintPreferences(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiDelete).toHaveBeenCalledWith('/system/print-preferences/reset');
  });

  it('shows success toast on reset', async () => {
    mockApiDelete.mockResolvedValue({ data: [] });

    const { useResetPrintPreferences } = await import('./use-reset-print-preferences');
    const { result } = renderHook(() => useResetPrintPreferences(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockToastSuccess).toHaveBeenCalledWith('preferences.resetSuccess');
  });

  it('shows error toast on failure', async () => {
    mockApiDelete.mockRejectedValue(new Error('Server error'));

    const { useResetPrintPreferences } = await import('./use-reset-print-preferences');
    const { result } = renderHook(() => useResetPrintPreferences(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith('preferences.resetError');
  });
});
