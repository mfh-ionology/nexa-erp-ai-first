/**
 * Integration tests for the post-save print flow.
 *
 * Tests the full pipeline: preference fetch → preference resolution → PDF generation → browser action → toast.
 * Unlike unit tests, the real `usePrintPreferences` hook and `lookupResolvedPreference` resolver
 * are NOT mocked — only the API client and leaf I/O (fetch, DOM, toast) are mocked.
 * This verifies the full hook → query → resolver chain end-to-end.
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
  { documentType: 'SALES_QUOTE', action: 'BROWSER_PRINT', source: 'USER' },
];

const mockApiGet = vi.fn(async (url: string) => {
  if (url === '/system/print-preferences') {
    return { data: mockPreferencesData };
  }
  throw new Error(`Unmocked GET: ${url}`);
});

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...(args as [string])),
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

// Mock auth store — must properly handle selectors for usePrintPreferences' `enabled: isAuthenticated`
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

describe('Post-Save Print Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndDownloadPdf.mockResolvedValue(undefined);
    mockGenerateAndPrintPdf.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full flow: save → resolve preference → generate PDF → action', () => {
    it('resolves AUTO_DOWNLOAD preference and triggers blob download', async () => {
      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      // Wait for preferences to be fetched through the real usePrintPreferences hook
      await waitForPreferencesLoaded();

      // Simulate post-save trigger for SALES_INVOICE (preference: AUTO_DOWNLOAD)
      await act(async () => {
        await result.current.triggerPrintAction('SALES_INVOICE', 'inv-001');
      });

      // Should have called download (not print)
      expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-001');
      expect(mockGenerateAndPrintPdf).not.toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('actions.downloadSuccess');
    });

    it('resolves BROWSER_PRINT preference and triggers print dialog', async () => {
      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // Simulate post-save trigger for PURCHASE_ORDER (preference: BROWSER_PRINT)
      await act(async () => {
        await result.current.triggerPrintAction('PURCHASE_ORDER', 'po-042');
      });

      expect(mockGenerateAndPrintPdf).toHaveBeenCalledWith('PURCHASE_ORDER', 'po-042');
      expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('actions.printTriggered');
    });

    it('resolves NONE preference and skips PDF generation entirely', async () => {
      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // Simulate post-save trigger for CREDIT_NOTE (preference: NONE)
      await act(async () => {
        await result.current.triggerPrintAction('CREDIT_NOTE', 'cn-007');
      });

      expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
      expect(mockGenerateAndPrintPdf).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('resolves company-default AUTO_DOWNLOAD when no user preference set', async () => {
      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // DELIVERY_NOTE has source: COMPANY_DEFAULT, action: AUTO_DOWNLOAD
      await act(async () => {
        await result.current.triggerPrintAction('DELIVERY_NOTE', 'dn-100');
      });

      expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('DELIVERY_NOTE', 'dn-100');
      expect(mockToastSuccess).toHaveBeenCalledWith('actions.downloadSuccess');
    });

    it('falls back to NONE for document type not in preferences', async () => {
      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // PAYSLIP is not in the mock preferences — should resolve to NONE
      await act(async () => {
        await result.current.triggerPrintAction('PAYSLIP', 'pay-001');
      });

      expect(mockGenerateAndDownloadPdf).not.toHaveBeenCalled();
      expect(mockGenerateAndPrintPdf).not.toHaveBeenCalled();
    });
  });

  describe('Loading state visibility during PDF generation', () => {
    it('isPrinting is true while PDF is being generated', async () => {
      let resolveGeneration!: () => void;
      mockGenerateAndDownloadPdf.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveGeneration = resolve;
          }),
      );

      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      expect(result.current.isPrinting).toBe(false);

      let actionPromise: Promise<void>;
      act(() => {
        actionPromise = result.current.triggerPrintAction('SALES_INVOICE', 'inv-loading');
      });

      // Loading indicator should be visible
      await waitFor(() => expect(result.current.isPrinting).toBe(true));

      // Complete the generation
      await act(async () => {
        resolveGeneration();
        await actionPromise!;
      });

      // Loading indicator should be hidden
      expect(result.current.isPrinting).toBe(false);
    });

    it('isPrinting remains false for NONE preference (no generation)', async () => {
      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        await result.current.triggerPrintAction('CREDIT_NOTE', 'cn-loading');
      });

      expect(result.current.isPrinting).toBe(false);
    });

    it('isPrinting resets to false after generation error', async () => {
      mockGenerateAndPrintPdf.mockRejectedValue(new Error('Puppeteer timeout'));

      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        await result.current.triggerPrintAction('PURCHASE_ORDER', 'po-err');
      });

      expect(result.current.isPrinting).toBe(false);
    });
  });

  describe('Error handling (non-blocking)', () => {
    it('shows error toast on HTTP 500 without blocking save flow', async () => {
      mockGenerateAndDownloadPdf.mockRejectedValue(new Error('PDF generation failed (HTTP 500)'));

      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // Should NOT throw — save flow must not be blocked
      await act(async () => {
        await result.current.triggerPrintAction('SALES_INVOICE', 'inv-500');
      });

      expect(mockToastError).toHaveBeenCalledWith('actions.generateError');
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(result.current.isPrinting).toBe(false);
    });

    it('shows error toast on network failure without throwing', async () => {
      mockGenerateAndPrintPdf.mockRejectedValue(new Error('Failed to fetch'));

      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        await result.current.triggerPrintAction('SALES_QUOTE', 'sq-net');
      });

      expect(mockToastError).toHaveBeenCalledWith('actions.generateError');
      expect(result.current.isPrinting).toBe(false);
    });

    it('shows error toast on HTTP 404 (template not found)', async () => {
      mockGenerateAndDownloadPdf.mockRejectedValue(new Error('Document template not found'));

      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      await act(async () => {
        await result.current.triggerPrintAction('DELIVERY_NOTE', 'dn-404');
      });

      expect(mockToastError).toHaveBeenCalledWith('actions.generateError');
    });
  });

  describe('Sequential save triggers', () => {
    it('handles multiple sequential print triggers correctly', async () => {
      const { usePostSavePrint } = await import('../hooks/use-post-save-print');
      const { result } = renderHook(() => usePostSavePrint(), {
        wrapper: createWrapper(),
      });

      await waitForPreferencesLoaded();

      // First save — AUTO_DOWNLOAD
      await act(async () => {
        await result.current.triggerPrintAction('SALES_INVOICE', 'inv-a');
      });
      expect(mockGenerateAndDownloadPdf).toHaveBeenCalledWith('SALES_INVOICE', 'inv-a');
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);

      // Second save — BROWSER_PRINT
      await act(async () => {
        await result.current.triggerPrintAction('PURCHASE_ORDER', 'po-b');
      });
      expect(mockGenerateAndPrintPdf).toHaveBeenCalledWith('PURCHASE_ORDER', 'po-b');
      expect(mockToastSuccess).toHaveBeenCalledTimes(2);

      // Third save — NONE (no additional toast)
      await act(async () => {
        await result.current.triggerPrintAction('CREDIT_NOTE', 'cn-c');
      });
      expect(mockToastSuccess).toHaveBeenCalledTimes(2);
    });
  });
});
