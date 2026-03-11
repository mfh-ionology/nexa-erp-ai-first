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

// Mock print preferences query
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
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// Mock i18n
vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock auth store (needed by usePrintPreferences dependency chain)
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

describe('usePostSavePrint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndDownloadPdf.mockResolvedValue(undefined);
    mockGenerateAndPrintPdf.mockResolvedValue(undefined);
  });

  it('calls generateAndDownloadPdf for AUTO_DOWNLOAD preference', async () => {
    mockLookupResolvedPreference.mockReturnValue('AUTO_DOWNLOAD');

    const { usePostSavePrint } = await import('./use-post-save-print');
    const { result } = renderHook(() => usePostSavePrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerPrintAction('SALES_INVOICE', 'inv-1');
    });

    expect(mockLookupResolvedPreference).toHaveBeenCalledWith('SALES_INVOICE', mockPreferences);
    expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-1');
    expect(mockGenerateAndPrintPdf).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('actions.downloadSuccess');
  });

  it('calls generateAndPrintPdf for BROWSER_PRINT preference', async () => {
    mockLookupResolvedPreference.mockReturnValue('BROWSER_PRINT');

    const { usePostSavePrint } = await import('./use-post-save-print');
    const { result } = renderHook(() => usePostSavePrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerPrintAction('PURCHASE_ORDER', 'po-1');
    });

    expect(mockGenerateAndPrintPdf).toHaveBeenCalledWith('PURCHASE_ORDER', 'po-1');
    expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('actions.printTriggered');
  });

  it('does nothing for NONE preference', async () => {
    mockLookupResolvedPreference.mockReturnValue('NONE');

    const { usePostSavePrint } = await import('./use-post-save-print');
    const { result } = renderHook(() => usePostSavePrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerPrintAction('CREDIT_NOTE', 'cn-1');
    });

    expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
    expect(mockGenerateAndPrintPdf).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('sets isPrinting to true during generation and false after', async () => {
    mockLookupResolvedPreference.mockReturnValue('AUTO_DOWNLOAD');

    // Make the PDF generation take time
    let resolveGeneration!: () => void;
    mockGenerateAndDownloadPdf.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveGeneration = resolve;
        }),
    );

    const { usePostSavePrint } = await import('./use-post-save-print');
    const { result } = renderHook(() => usePostSavePrint(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPrinting).toBe(false);

    let actionPromise: Promise<void>;
    act(() => {
      actionPromise = result.current.triggerPrintAction('SALES_INVOICE', 'inv-1');
    });

    // isPrinting should be true while generating
    await waitFor(() => expect(result.current.isPrinting).toBe(true));

    // Resolve the generation
    await act(async () => {
      resolveGeneration();
      await actionPromise!;
    });

    // isPrinting should be false after completion
    expect(result.current.isPrinting).toBe(false);
  });

  it('shows error toast on generation failure without throwing', async () => {
    mockLookupResolvedPreference.mockReturnValue('AUTO_DOWNLOAD');
    mockGenerateAndDownloadPdf.mockRejectedValue(new Error('PDF generation failed (HTTP 500)'));

    const { usePostSavePrint } = await import('./use-post-save-print');
    const { result } = renderHook(() => usePostSavePrint(), {
      wrapper: createWrapper(),
    });

    // Should not throw
    await act(async () => {
      await result.current.triggerPrintAction('SALES_INVOICE', 'inv-1');
    });

    expect(mockToastError).toHaveBeenCalledWith('actions.generateError');
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.isPrinting).toBe(false);
  });

  it('resets isPrinting to false even on error', async () => {
    mockLookupResolvedPreference.mockReturnValue('BROWSER_PRINT');
    mockGenerateAndPrintPdf.mockRejectedValue(new Error('Network failure'));

    const { usePostSavePrint } = await import('./use-post-save-print');
    const { result } = renderHook(() => usePostSavePrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerPrintAction('PURCHASE_ORDER', 'po-2');
    });

    expect(result.current.isPrinting).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith('actions.generateError');
  });

  it('does not set isPrinting for NONE preference', async () => {
    mockLookupResolvedPreference.mockReturnValue('NONE');

    const { usePostSavePrint } = await import('./use-post-save-print');
    const { result } = renderHook(() => usePostSavePrint(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerPrintAction('CREDIT_NOTE', 'cn-1');
    });

    // isPrinting should never have been set to true
    expect(result.current.isPrinting).toBe(false);
  });
});
