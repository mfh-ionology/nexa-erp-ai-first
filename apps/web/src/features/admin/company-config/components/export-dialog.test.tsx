import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';

import type { ExportDefaultsResponse } from '../api/types';

// --- Mock sonner toast ---
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock api-client ---
const mockApiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

// --- Mock query-keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      all: ['system'],
      exportDefaults: () => ['system', 'export-defaults'],
    },
  },
}));

// --- Test data ---

const mockExportData: ExportDefaultsResponse = {
  version: '1.0',
  description: 'Company defaults export',
  exportedAt: '2025-06-01T00:00:00Z',
  exportedFrom: 'Test Company',
  resources: [
    { code: 'RES1', name: 'Resource 1', module: 'system', type: 'PAGE', sortOrder: 1 },
  ],
  accessGroups: [
    { code: 'AG1', name: 'Full Access', description: null, isSystem: true, permissions: [], fieldOverrides: [] },
    { code: 'AG2', name: 'Sales', description: 'Sales team', isSystem: false, permissions: [], fieldOverrides: [] },
  ],
  vatCodes: [
    { code: 'STD', name: 'Standard', rate: 20, type: 'OUTPUT', isDefault: true },
  ],
  paymentTerms: [
    { code: 'NET30', name: 'Net 30', dueDays: 30, isDefault: true },
  ],
  numberSeries: [
    { entityType: 'INVOICE', prefix: 'INV-', padding: 6 },
  ],
  currencies: [
    { code: 'GBP', name: 'Pound Sterling', symbol: '£', minorUnit: 2 },
    { code: 'USD', name: 'US Dollar', symbol: '$', minorUnit: 2 },
  ],
};

// --- Helpers ---

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      // @ts-expect-error dual @types/react versions
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

async function renderDialog(open = true) {
  const onOpenChange = vi.fn();
  const { ExportDialog } = await import('./export-dialog');
  const result = render(
    <ExportDialog open={open} onOpenChange={onOpenChange} companySlug="test-company" />,
    { wrapper: createWrapper() },
  );
  return { ...result, onOpenChange };
}

// --- Tests ---

describe('ExportDialog', () => {
  let savedCreateObjectURL: typeof URL.createObjectURL;
  let savedRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: mockExportData });
    savedCreateObjectURL = URL.createObjectURL;
    savedRevokeObjectURL = URL.revokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = savedCreateObjectURL;
    URL.revokeObjectURL = savedRevokeObjectURL;
    vi.restoreAllMocks();
  });

  // --- 7.1: Dialog rendering ---

  describe('rendering', () => {
    it('renders dialog with correct title when open', async () => {
      await renderDialog();

      await waitFor(() => {
        expect(screen.getByText('companyConfig.export.title')).toBeInTheDocument();
      });
    });

    it('renders dialog with correct description', async () => {
      await renderDialog();

      await waitFor(() => {
        expect(screen.getByText('companyConfig.export.description')).toBeInTheDocument();
      });
    });

    it('renders Download JSON button', async () => {
      await renderDialog();

      expect(
        screen.getByRole('button', { name: /companyConfig\.export\.downloadButton/ }),
      ).toBeInTheDocument();
    });

    it('renders Cancel button', async () => {
      await renderDialog();

      expect(
        screen.getByRole('button', { name: /common:cancel/ }),
      ).toBeInTheDocument();
    });
  });

  // --- 7.2: Export preview ---

  describe('export preview', () => {
    it('shows summary counts for each entity type when data is loaded', async () => {
      await renderDialog();

      // Wait for data to load and preview to render
      await waitFor(() => {
        expect(screen.getByText('companyConfig.export.preview.accessGroups')).toBeInTheDocument();
      });

      // AC2: access groups, permissions, field overrides, VAT codes, payment terms, number series, currencies
      expect(screen.getByText('companyConfig.export.preview.permissions')).toBeInTheDocument();
      expect(screen.getByText('companyConfig.export.preview.fieldOverrides')).toBeInTheDocument();
      expect(screen.getByText('companyConfig.export.preview.vatCodes')).toBeInTheDocument();
      expect(screen.getByText('companyConfig.export.preview.paymentTerms')).toBeInTheDocument();
      expect(screen.getByText('companyConfig.export.preview.numberSeries')).toBeInTheDocument();
      expect(screen.getByText('companyConfig.export.preview.currencies')).toBeInTheDocument();
    });

    it('shows loading state while data is being fetched', async () => {
      mockApiGet.mockReturnValue(new Promise(() => {})); // Never resolves
      await renderDialog();

      // Download button should be disabled during loading
      expect(
        screen.getByRole('button', { name: /companyConfig\.export\.downloadButton/ }),
      ).toBeDisabled();

      // Preview labels should NOT be visible yet (skeletons shown instead)
      expect(
        screen.queryByText('companyConfig.export.preview.accessGroups'),
      ).not.toBeInTheDocument();
    });
  });

  // --- 7.3: Download action ---

  describe('download action', () => {
    it('calls GET /system/company-profile/export-defaults on dialog open', async () => {
      await renderDialog();

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          '/system/company-profile/export-defaults',
        );
      });
    });

    it('triggers file download with Blob and anchor click', async () => {
      const user = userEvent.setup();
      const mockCreate = vi.fn(() => 'blob:test-url');
      const mockRevoke = vi.fn();
      URL.createObjectURL = mockCreate;
      URL.revokeObjectURL = mockRevoke;
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      const { onOpenChange } = await renderDialog();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('companyConfig.export.preview.accessGroups')).toBeInTheDocument();
      });

      // Click download
      const downloadBtn = screen.getByRole('button', {
        name: /companyConfig\.export\.downloadButton/,
      });
      await user.click(downloadBtn);

      // Verify Blob was created and passed to createObjectURL
      expect(mockCreate).toHaveBeenCalledWith(expect.any(Blob));

      // Verify anchor click triggered (file download)
      expect(clickSpy).toHaveBeenCalled();

      // Verify URL cleanup
      expect(mockRevoke).toHaveBeenCalledWith('blob:test-url');

      // Verify success toast
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'companyConfig.toast.exportSuccess',
      );

      // Verify dialog closes
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // --- 7.4: Loading state ---

  describe('loading state', () => {
    it('disables Download JSON button during API call', async () => {
      mockApiGet.mockReturnValue(new Promise(() => {})); // Never resolves
      await renderDialog();

      expect(
        screen.getByRole('button', { name: /companyConfig\.export\.downloadButton/ }),
      ).toBeDisabled();
    });

    it('keeps Cancel button active during API call', async () => {
      mockApiGet.mockReturnValue(new Promise(() => {})); // Never resolves
      await renderDialog();

      expect(
        screen.getByRole('button', { name: /common:cancel/ }),
      ).not.toBeDisabled();
    });
  });

  // --- 7.5: Error handling ---

  describe('error handling', () => {
    it('shows error message in preview when API query fails', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));
      await renderDialog();

      await waitFor(() => {
        expect(screen.getByText('companyConfig.error.exportFailed')).toBeInTheDocument();
      });
    });

    it('keeps dialog open when API query fails', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));
      const { onOpenChange } = await renderDialog();

      await waitFor(() => {
        expect(screen.getByText('companyConfig.error.exportFailed')).toBeInTheDocument();
      });

      // Dialog should still be open (onOpenChange not called with false)
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('shows error toast when download mechanism fails', async () => {
      const user = userEvent.setup();
      URL.createObjectURL = vi.fn(() => {
        throw new Error('Blob error');
      });

      await renderDialog();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('companyConfig.export.preview.accessGroups')).toBeInTheDocument();
      });

      const downloadBtn = screen.getByRole('button', {
        name: /companyConfig\.export\.downloadButton/,
      });
      await user.click(downloadBtn);

      expect(mockToastError).toHaveBeenCalledWith(
        'companyConfig.error.exportFailed',
      );
    });
  });

  // --- 7.6: Cancel ---

  describe('cancel', () => {
    it('calls onOpenChange(false) when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const { onOpenChange } = await renderDialog();

      const cancelBtn = screen.getByRole('button', { name: /common:cancel/ });
      await user.click(cancelBtn);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // --- 7.7: Accessibility ---

  describe('accessibility', () => {
    it('dialog has role="dialog"', async () => {
      await renderDialog();

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('dialog has aria-labelledby pointing to the title', async () => {
      await renderDialog();

      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();

      // Verify the referenced element exists and contains the title text
      const titleElement = document.getElementById(labelledBy!);
      expect(titleElement).toBeTruthy();
      expect(titleElement).toHaveTextContent('companyConfig.export.title');
    });
  });
});
