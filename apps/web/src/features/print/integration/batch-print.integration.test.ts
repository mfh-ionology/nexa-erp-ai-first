/**
 * Integration tests for the batch print flow.
 *
 * Tests the full pipeline: select records → fetch preferences → resolve preference →
 * sequential download/print → progress tracking → completion/error handling → cancel.
 *
 * Uses real `useBatchPrint` hook with real `usePrintPreferences` and `lookupResolvedPreference`.
 * Only leaf I/O (fetch, DOM, toast) is mocked.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// ─── Mocks (leaf I/O only) ──────────────────────────────────────────────────

// Mock pdf-actions (browser I/O layer)
const mockGenerateAndDownloadPdf = vi.fn();
const mockGenerateAndPrintPdf = vi.fn();
vi.mock('../utils/pdf-actions', () => ({
  generateAndDownloadPdf: (...args: unknown[]) => mockGenerateAndDownloadPdf(...args),
  generateAndPrintPdf: (...args: unknown[]) => mockGenerateAndPrintPdf(...args),
}));

// Real resolve-print-action is used — NOT mocked
// Real use-print-preferences is used — NOT mocked (integration point)

// Mock API client at transport level — usePrintPreferences calls apiGet internally
const mockPreferencesData = [
  { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD', source: 'USER' },
  { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT', source: 'COMPANY_DEFAULT' },
  { documentType: 'CREDIT_NOTE', action: 'NONE', source: 'FALLBACK' },
  { documentType: 'DELIVERY_NOTE', action: 'AUTO_DOWNLOAD', source: 'COMPANY_DEFAULT' },
];

const mockApiGet = vi.fn(async (url: string) => {
  if (url === '/system/print-preferences') {
    return { data: mockPreferencesData };
  }
  throw new Error(`Unmocked GET: ${url}`);
});

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...(args as [string])),
  apiPost: vi.fn(),
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

// Mock auth store — must handle selectors for usePrintPreferences' `enabled: isAuthenticated`
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        accessToken: 'test-token',
        activeCompanyId: 'company-1',
        isAuthenticated: true,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        accessToken: 'test-token',
        activeCompanyId: 'company-1',
        isAuthenticated: true,
      }),
    },
  ),
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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/** Wait for the preferences query to have resolved via apiGet and React Query to deliver data */
async function waitForPreferencesLoaded() {
  await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/system/print-preferences'));
  // Flush React Query state update so hook receives the resolved data
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// ─── Integration Tests ──────────────────────────────────────────────────────

describe('Batch Print Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndDownloadPdf.mockResolvedValue(undefined);
    mockGenerateAndPrintPdf.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full batch flow: select → resolve → sequential download', () => {
    it('downloads each document sequentially for AUTO_DOWNLOAD preference', async () => {
      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // Initial state
      expect(result.current.batchStatus.state).toBe('idle');

      // Select 3 invoices and trigger batch print
      await act(async () => {
        result.current.executeBatchPrint('SALES_INVOICE', ['inv-1', 'inv-2', 'inv-3']);
        await new Promise((r) => setTimeout(r, 50));
      });

      // Should have called individual downloads sequentially
      expect(mockGenerateAndDownloadPdf).toHaveBeenCalledTimes(3);
      expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-1');
      expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-2');
      expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-3');

      await waitFor(() => expect(result.current.batchStatus.state).toBe('complete'));
      expect(result.current.batchStatus.total).toBe(3);
      expect(result.current.batchStatus.completed).toBe(3);
    });
  });

  describe('Sequential BROWSER_PRINT: generate → print dialogs one at a time', () => {
    it('processes records sequentially and shows correct progress counts', async () => {
      const callOrder: string[] = [];
      mockGenerateAndPrintPdf.mockImplementation(async (_docType: string, recordId: string) => {
        callOrder.push(recordId);
      });

      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        result.current.executeBatchPrint('PURCHASE_ORDER', ['po-1', 'po-2', 'po-3']);
        await new Promise((r) => setTimeout(r, 50));
      });

      // All 3 should be processed sequentially (not in parallel)
      expect(mockGenerateAndPrintPdf).toHaveBeenCalledTimes(3);
      expect(callOrder).toEqual(['po-1', 'po-2', 'po-3']);

      // Final state: complete
      await waitFor(() => expect(result.current.batchStatus.state).toBe('complete'));
      expect(result.current.batchStatus.completed).toBe(3);
      expect(result.current.batchStatus.failed).toBe(0);
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  describe('Progress indicator shows correct counts', () => {
    it('tracks completed and failed counts during sequential print', async () => {
      // First succeeds, second fails, third succeeds
      mockGenerateAndPrintPdf
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Template rendering error'))
        .mockResolvedValueOnce(undefined);

      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        result.current.executeBatchPrint('PURCHASE_ORDER', ['po-a', 'po-b', 'po-c']);
        await new Promise((r) => setTimeout(r, 50));
      });

      await waitFor(() => expect(result.current.batchStatus.state).toBe('complete'));
      expect(result.current.batchStatus.total).toBe(3);
      expect(result.current.batchStatus.completed).toBe(2);
      expect(result.current.batchStatus.failed).toBe(1);
      expect(result.current.batchStatus.errors).toContain('Template rendering error');
    });

    it('tracks counts during sequential download', async () => {
      // First and third succeed, second fails
      mockGenerateAndDownloadPdf
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValueOnce(undefined);

      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        result.current.executeBatchPrint('DELIVERY_NOTE', ['dn-1', 'dn-2', 'dn-3']);
        await new Promise((r) => setTimeout(r, 50));
      });

      await waitFor(() => expect(result.current.batchStatus.state).toBe('complete'));
      expect(result.current.batchStatus.completed).toBe(2);
      expect(result.current.batchStatus.failed).toBe(1);
      // Both success and error toasts shown for partial failure
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('Error handling for partial batch failures', () => {
    it('sets error state when ALL records in sequential print fail', async () => {
      mockGenerateAndPrintPdf.mockRejectedValue(new Error('Service unavailable'));

      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        result.current.executeBatchPrint('PURCHASE_ORDER', ['po-x', 'po-y']);
        await new Promise((r) => setTimeout(r, 50));
      });

      await waitFor(() => expect(result.current.batchStatus.state).toBe('error'));
      expect(result.current.batchStatus.failed).toBe(2);
      expect(result.current.batchStatus.completed).toBe(0);
      expect(mockToastError).toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('sets error state when ALL records in sequential download fail', async () => {
      mockGenerateAndDownloadPdf.mockRejectedValue(new Error('Timeout'));

      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        result.current.executeBatchPrint('SALES_INVOICE', ['inv-f1', 'inv-f2']);
        await new Promise((r) => setTimeout(r, 50));
      });

      await waitFor(() => expect(result.current.batchStatus.state).toBe('error'));
      expect(result.current.batchStatus.failed).toBe(2);
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('Cancel mid-batch', () => {
    it('stops sequential print processing and resets state', async () => {
      let printCount = 0;
      // First print resolves slowly, allowing us to cancel before subsequent ones
      mockGenerateAndPrintPdf.mockImplementation(async () => {
        printCount++;
        if (printCount === 1) {
          // First one completes
          return;
        }
        // Second one takes long enough to be cancelled
        await new Promise((r) => setTimeout(r, 500));
      });

      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // Start batch print with 3 records
      act(() => {
        void (async () => {
          result.current.executeBatchPrint('PURCHASE_ORDER', ['po-c1', 'po-c2', 'po-c3']);
        })();
      });

      // Wait for printing to start
      await waitFor(() => expect(result.current.batchStatus.state !== 'idle').toBe(true));

      // Cancel mid-batch
      act(() => {
        result.current.cancel();
      });

      // State should reset to idle
      expect(result.current.batchStatus.state).toBe('idle');
      expect(result.current.batchStatus.total).toBe(0);
      expect(mockToastInfo).toHaveBeenCalledWith('actions.batchCancel');
    });
  });

  describe('NONE preference skips batch entirely', () => {
    it('does not generate when preference is NONE', async () => {
      const { useBatchPrint } = await import('../hooks/use-batch-print');
      const { result } = renderHook(() => useBatchPrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      act(() => {
        result.current.executeBatchPrint('CREDIT_NOTE', ['cn-1', 'cn-2']);
      });

      expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
      expect(mockGenerateAndPrintPdf).not.toHaveBeenCalled();
      expect(result.current.batchStatus.state).toBe('idle');
    });
  });
});
