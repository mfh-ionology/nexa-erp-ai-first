import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock pdf-actions
const mockGenerateAndDownloadPdf = vi.fn();
const mockGenerateAndPrintPdf = vi.fn();
vi.mock('../utils/pdf-actions', () => ({
  generateAndDownloadPdf: (...args: unknown[]) => mockGenerateAndDownloadPdf(...args),
  generateAndPrintPdf: (...args: unknown[]) => mockGenerateAndPrintPdf(...args),
}));

// Mock resolve-print-action
const mockLookupResolvedPreference = vi.fn();
vi.mock('../utils/resolve-print-action', () => ({
  lookupResolvedPreference: (...args: unknown[]) => mockLookupResolvedPreference(...args),
}));

// Mock print preferences
const mockPreferences = [
  { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD', source: 'USER' },
  { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT', source: 'COMPANY_DEFAULT' },
  { documentType: 'CREDIT_NOTE', action: 'NONE', source: 'FALLBACK' },
];
vi.mock('../api/use-print-preferences', () => ({
  usePrintPreferences: () => ({ data: mockPreferences, isLoading: false }),
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

// Mock i18n
vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

// Mock auth store
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(() => true, {
    getState: () => ({ accessToken: 'test-token', activeCompanyId: 'company-1' }),
  }),
}));

// Mock query keys
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    printPreferences: {
      all: ['print-preferences'],
      user: () => ['print-preferences', 'user'],
      companyDefaults: () => ['print-preferences', 'company-defaults'],
    },
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useBatchPrint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndDownloadPdf.mockResolvedValue(undefined);
    mockGenerateAndPrintPdf.mockResolvedValue(undefined);
  });

  it('starts in idle state', async () => {
    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    expect(result.current.batchStatus.state).toBe('idle');
    expect(result.current.batchStatus.total).toBe(0);
    expect(result.current.batchStatus.completed).toBe(0);
  });

  it('downloads each document sequentially for AUTO_DOWNLOAD preference', async () => {
    mockLookupResolvedPreference.mockReturnValue('AUTO_DOWNLOAD');

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.executeBatchPrint('SALES_INVOICE', ['inv-1', 'inv-2']);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGenerateAndDownloadPdf).toHaveBeenCalledTimes(2);
    expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-1');
    expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-2');

    await waitFor(() => expect(result.current.batchStatus.state).toBe('complete'));
    expect(result.current.batchStatus.total).toBe(2);
    expect(result.current.batchStatus.completed).toBe(2);
  });

  it('generates PDFs sequentially for BROWSER_PRINT preference', async () => {
    mockLookupResolvedPreference.mockReturnValue('BROWSER_PRINT');

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.executeBatchPrint('PURCHASE_ORDER', ['po-1', 'po-2', 'po-3']);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGenerateAndPrintPdf).toHaveBeenCalledTimes(3);
    expect(mockGenerateAndPrintPdf).toHaveBeenCalledWith('PURCHASE_ORDER', 'po-1');
    expect(mockGenerateAndPrintPdf).toHaveBeenCalledWith('PURCHASE_ORDER', 'po-2');
    expect(mockGenerateAndPrintPdf).toHaveBeenCalledWith('PURCHASE_ORDER', 'po-3');
  });

  it('does nothing for NONE preference', async () => {
    mockLookupResolvedPreference.mockReturnValue('NONE');

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.executeBatchPrint('CREDIT_NOTE', ['cn-1']);
    });

    expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
    expect(mockGenerateAndPrintPdf).not.toHaveBeenCalled();
    expect(result.current.batchStatus.state).toBe('idle');
  });

  it('does nothing for empty recordIds', async () => {
    mockLookupResolvedPreference.mockReturnValue('AUTO_DOWNLOAD');

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.executeBatchPrint('SALES_INVOICE', []);
    });

    expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
    expect(result.current.batchStatus.state).toBe('idle');
  });

  it('cancel resets state and shows toast', async () => {
    mockLookupResolvedPreference.mockReturnValue('BROWSER_PRINT');

    // Use a slow print to keep the hook in 'printing' state
    let resolveSlowPrint!: () => void;
    mockGenerateAndPrintPdf.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSlowPrint = resolve;
        }),
    );

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    // Start batch print
    act(() => {
      void (async () => {
        result.current.executeBatchPrint('PURCHASE_ORDER', ['po-1', 'po-2']);
      })();
    });

    // Wait for printing to start
    await waitFor(() => expect(result.current.batchStatus.state).toBe('printing'));

    // Cancel mid-batch
    act(() => {
      result.current.cancel();
    });

    expect(result.current.batchStatus.state).toBe('idle');
    expect(result.current.batchStatus.total).toBe(0);
    expect(mockToastInfo).toHaveBeenCalledWith('actions.batchCancel');

    // Resolve the pending print to avoid unhandled promises
    resolveSlowPrint?.();
  });

  it('shows success toast on sequential print completion', async () => {
    mockLookupResolvedPreference.mockReturnValue('BROWSER_PRINT');

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.executeBatchPrint('PURCHASE_ORDER', ['po-1']);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockToastSuccess).toHaveBeenCalled();
    await waitFor(() => expect(result.current.batchStatus.state).toBe('complete'));
  });

  it('handles partial failures in sequential print', async () => {
    mockLookupResolvedPreference.mockReturnValue('BROWSER_PRINT');
    mockGenerateAndPrintPdf
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('PDF gen failed'))
      .mockResolvedValueOnce(undefined);

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.executeBatchPrint('PURCHASE_ORDER', ['po-1', 'po-2', 'po-3']);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => expect(result.current.batchStatus.state).toBe('complete'));
    expect(result.current.batchStatus.completed).toBe(2);
    expect(result.current.batchStatus.failed).toBe(1);
    expect(result.current.batchStatus.errors).toContain('PDF gen failed');
    // Should show both success and error toasts
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });

  it('sets error state when all sequential prints fail', async () => {
    mockLookupResolvedPreference.mockReturnValue('BROWSER_PRINT');
    mockGenerateAndPrintPdf.mockRejectedValue(new Error('Network error'));

    const { useBatchPrint } = await import('./use-batch-print');
    const { result } = renderHook(() => useBatchPrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.executeBatchPrint('PURCHASE_ORDER', ['po-1', 'po-2']);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => expect(result.current.batchStatus.state).toBe('error'));
    expect(result.current.batchStatus.failed).toBe(2);
    expect(result.current.batchStatus.completed).toBe(0);
    expect(mockToastError).toHaveBeenCalled();
  });
});
