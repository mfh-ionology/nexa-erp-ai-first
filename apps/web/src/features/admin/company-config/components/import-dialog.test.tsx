import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

import { ApiError } from '@nexa/api-client';

import type {
  ExportDefaultsResponse,
  ImportDefaultsResponse,
} from '../api/types';

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
const mockApiPost = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ activeCompanyId: 'company-123' }),
}));

// --- Mock query-keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      all: ['system'],
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

const mockDryRunResponse: ImportDefaultsResponse = {
  status: 'DRY_RUN',
  summary: {
    resourcesCreated: 5,
    resourcesUpdated: 0,
    accessGroupsCreated: 2,
    accessGroupsUpdated: 1,
    permissionsSet: 10,
    fieldOverridesSet: 3,
    vatCodesCreated: 3,
    vatCodesUpdated: 0,
    paymentTermsCreated: 2,
    paymentTermsUpdated: 0,
    numberSeriesCreated: 4,
    numberSeriesUpdated: 0,
    currenciesCreated: 2,
    currenciesUpdated: 0,
  },
  warnings: [],
};

const mockAppliedResponse: ImportDefaultsResponse = {
  status: 'APPLIED',
  summary: mockDryRunResponse.summary,
  warnings: [],
};

const mockDryRunWithWarnings: ImportDefaultsResponse = {
  ...mockDryRunResponse,
  warnings: [
    'Access group "AG-LEGACY" was skipped (unknown format)',
    'Resource "OLD-RES" not found',
  ],
};

// --- Helpers ---

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
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
  const { ImportDialog } = await import('./import-dialog');
  const result = render(
    <ImportDialog open={open} onOpenChange={onOpenChange} />,
    { wrapper: createWrapper() },
  );
  return { ...result, onOpenChange };
}

function createValidJsonFile() {
  return new File([JSON.stringify(mockExportData)], 'config.json', {
    type: 'application/json',
  });
}

function createInvalidJsonFile() {
  return new File(['this is not valid json {{{'], 'bad.json', {
    type: 'application/json',
  });
}

function uploadFile(file: File) {
  // Dialog renders in a portal, so query the full document
  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });
}

function enterValidJson() {
  const textarea = screen.getByPlaceholderText(
    'companyConfig.import.pasteJsonPlaceholder',
  );
  fireEvent.change(textarea, {
    target: { value: JSON.stringify(mockExportData) },
  });
}

// --- Tests ---

describe('ImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 8.1: Dialog rendering ---

  describe('rendering', () => {
    it('renders dialog with correct title when open', async () => {
      await renderDialog();

      expect(
        screen.getByText('companyConfig.import.title'),
      ).toBeInTheDocument();
    });

    it('renders dialog with correct description', async () => {
      await renderDialog();

      expect(
        screen.getByText('companyConfig.import.description'),
      ).toBeInTheDocument();
    });

    it('renders file drop zone', async () => {
      await renderDialog();

      expect(
        screen.getByLabelText('companyConfig.import.dropZoneLabel'),
      ).toBeInTheDocument();
    });

    it('renders JSON textarea', async () => {
      await renderDialog();

      expect(
        screen.getByPlaceholderText(
          'companyConfig.import.pasteJsonPlaceholder',
        ),
      ).toBeInTheDocument();
    });

    it('renders dry run checkbox checked by default', async () => {
      await renderDialog();

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      expect(
        screen.getByText('companyConfig.import.dryRunLabel'),
      ).toBeInTheDocument();
    });

    it('renders Import button visible but disabled', async () => {
      await renderDialog();

      const importBtn = screen.getByRole('button', {
        name: /companyConfig\.import\.importButton/,
      });
      expect(importBtn).toBeInTheDocument();
      expect(importBtn).toBeDisabled();
    });
  });

  // --- 8.2: File upload ---

  describe('file upload', () => {
    it('shows file name after uploading valid JSON file', async () => {
      await renderDialog();
      uploadFile(createValidJsonFile());

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.fileName'),
        ).toBeInTheDocument();
      });
    });

    it('enables Import button after valid file upload', async () => {
      await renderDialog();
      uploadFile(createValidJsonFile());

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /companyConfig\.import\.importButton/,
          }),
        ).not.toBeDisabled();
      });
    });

    it('shows inline error for invalid JSON file', async () => {
      await renderDialog();
      uploadFile(createInvalidJsonFile());

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.invalidFile'),
        ).toBeInTheDocument();
      });
    });

    it('keeps Import button disabled with invalid file', async () => {
      await renderDialog();
      uploadFile(createInvalidJsonFile());

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.invalidFile'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      ).toBeDisabled();
    });
  });

  // --- 8.3: JSON textarea ---

  describe('JSON textarea', () => {
    it('enables Import button with valid JSON', async () => {
      await renderDialog();
      enterValidJson();

      expect(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      ).not.toBeDisabled();
    });

    it('shows error on blur with invalid JSON', async () => {
      await renderDialog();

      const textarea = screen.getByPlaceholderText(
        'companyConfig.import.pasteJsonPlaceholder',
      );
      fireEvent.change(textarea, { target: { value: 'not valid json' } });
      fireEvent.blur(textarea);

      expect(
        screen.getByText('companyConfig.import.invalidJson'),
      ).toBeInTheDocument();
    });

    it('clears file selection when typing in textarea', async () => {
      await renderDialog();

      // Upload a valid file first
      uploadFile(createValidJsonFile());
      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.fileName'),
        ).toBeInTheDocument();
      });

      // Type in textarea — should clear file
      const textarea = screen.getByPlaceholderText(
        'companyConfig.import.pasteJsonPlaceholder',
      );
      fireEvent.change(textarea, { target: { value: '{"test": true}' } });

      expect(
        screen.queryByText('companyConfig.import.fileName'),
      ).not.toBeInTheDocument();
    });

    it('clears textarea when selecting a file', async () => {
      await renderDialog();

      // Type valid JSON first
      const textarea = screen.getByPlaceholderText(
        'companyConfig.import.pasteJsonPlaceholder',
      );
      fireEvent.change(textarea, {
        target: { value: JSON.stringify(mockExportData) },
      });
      expect(textarea).toHaveValue(JSON.stringify(mockExportData));

      // Upload a file — should clear textarea
      uploadFile(createValidJsonFile());

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });

  // --- 8.4: Dry run ---

  describe('dry run', () => {
    it('calls API with dryRun: true when dry run checkbox is checked', async () => {
      mockApiPost.mockResolvedValue({ data: mockDryRunResponse });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          '/system/company-profile/import-defaults',
          { data: mockExportData, dryRun: true },
        );
      });
    });

    it('shows dry run preview title in results panel', async () => {
      mockApiPost.mockResolvedValue({ data: mockDryRunResponse });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.results.dryRunTitle'),
        ).toBeInTheDocument();
      });
    });

    it('shows summary table with entity counts', async () => {
      mockApiPost.mockResolvedValue({ data: mockDryRunResponse });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.results.resources'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText('companyConfig.import.results.accessGroups'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('companyConfig.import.results.permissions'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('companyConfig.import.results.fieldOverrides'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('companyConfig.import.results.vatCodes'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('companyConfig.import.results.paymentTerms'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('companyConfig.import.results.numberSeries'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('companyConfig.import.results.currencies'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('companyConfig.import.results.total'),
      ).toBeInTheDocument();
    });

    it('shows Apply button after dry run', async () => {
      mockApiPost.mockResolvedValue({ data: mockDryRunResponse });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /companyConfig\.import\.applyButton/,
          }),
        ).toBeInTheDocument();
      });
    });

    it('shows warnings when response has warnings', async () => {
      mockApiPost.mockResolvedValue({ data: mockDryRunWithWarnings });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.results.warnings'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          'Access group "AG-LEGACY" was skipped (unknown format)',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Resource "OLD-RES" not found'),
      ).toBeInTheDocument();
    });
  });

  // --- 8.5: Apply after dry run ---

  describe('apply after dry run', () => {
    async function performDryRun() {
      mockApiPost.mockResolvedValueOnce({ data: mockDryRunResponse });
      const user = userEvent.setup();

      const result = await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /companyConfig\.import\.applyButton/,
          }),
        ).toBeInTheDocument();
      });

      return { ...result, user };
    }

    it('calls API with dryRun: false when Apply is clicked', async () => {
      const { user } = await performDryRun();
      mockApiPost.mockResolvedValueOnce({ data: mockAppliedResponse });

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.applyButton/,
        }),
      );

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenLastCalledWith(
          '/system/company-profile/import-defaults',
          { data: mockExportData, dryRun: false },
        );
      });
    });

    it('shows Import Results title after apply', async () => {
      const { user } = await performDryRun();
      mockApiPost.mockResolvedValueOnce({ data: mockAppliedResponse });

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.applyButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.results.title'),
        ).toBeInTheDocument();
      });
    });

    it('shows success toast after apply', async () => {
      const { user } = await performDryRun();
      mockApiPost.mockResolvedValueOnce({ data: mockAppliedResponse });

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.applyButton/,
        }),
      );

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'companyConfig.toast.importSuccess',
        );
      });
    });

    it('shows Done button after apply', async () => {
      const { user } = await performDryRun();
      mockApiPost.mockResolvedValueOnce({ data: mockAppliedResponse });

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.applyButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /companyConfig\.import\.doneButton/,
          }),
        ).toBeInTheDocument();
      });
    });
  });

  // --- 8.6: Direct import (dry run unchecked) ---

  describe('direct import (dry run unchecked)', () => {
    it('calls API with dryRun: false when dry run is unchecked', async () => {
      mockApiPost.mockResolvedValue({ data: mockAppliedResponse });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      // Uncheck dry run
      await user.click(screen.getByRole('checkbox'));

      // Click Import
      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          '/system/company-profile/import-defaults',
          { data: mockExportData, dryRun: false },
        );
      });
    });

    it('shows success toast for direct import', async () => {
      mockApiPost.mockResolvedValue({ data: mockAppliedResponse });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(screen.getByRole('checkbox'));
      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'companyConfig.toast.importSuccess',
        );
      });
    });

    it('shows applied results for direct import', async () => {
      mockApiPost.mockResolvedValue({ data: mockAppliedResponse });
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(screen.getByRole('checkbox'));
      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.results.title'),
        ).toBeInTheDocument();
      });
    });
  });

  // --- 8.7: Error handling ---

  describe('error handling', () => {
    it('shows validation error message in dialog', async () => {
      mockApiPost.mockRejectedValue(
        new ApiError('VALIDATION_ERROR', 'The data field is required', 400),
      );
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('The data field is required'),
        ).toBeInTheDocument();
      });
    });

    it('shows unsupported version error message', async () => {
      mockApiPost.mockRejectedValue(
        new ApiError('UNSUPPORTED_VERSION', 'Version not supported', 400),
      );
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('companyConfig.import.unsupportedVersion'),
        ).toBeInTheDocument();
      });
    });

    it('keeps dialog open on error', async () => {
      mockApiPost.mockRejectedValue(
        new ApiError('VALIDATION_ERROR', 'Invalid config', 400),
      );
      const user = userEvent.setup();

      const { onOpenChange } = await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(screen.getByText('Invalid config')).toBeInTheDocument();
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('preserves form state for retry after error', async () => {
      mockApiPost.mockRejectedValue(
        new ApiError('VALIDATION_ERROR', 'Invalid config', 400),
      );
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(screen.getByText('Invalid config')).toBeInTheDocument();
      });

      // Form should still be visible (input phase preserved)
      expect(
        screen.getByPlaceholderText(
          'companyConfig.import.pasteJsonPlaceholder',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });

  // --- 8.8: Loading state ---

  describe('loading state', () => {
    it('disables Import button during API call', async () => {
      mockApiPost.mockReturnValue(new Promise(() => {})); // Never resolves
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /companyConfig\.import\.importButton/,
          }),
        ).toBeDisabled();
      });
    });

    it('disables textarea during API call', async () => {
      mockApiPost.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(
            'companyConfig.import.pasteJsonPlaceholder',
          ),
        ).toBeDisabled();
      });
    });

    it('disables file input during API call', async () => {
      mockApiPost.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();

      await renderDialog();
      enterValidJson();

      await user.click(
        screen.getByRole('button', {
          name: /companyConfig\.import\.importButton/,
        }),
      );

      await waitFor(() => {
        const fileInput = document.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;
        expect(fileInput).toBeDisabled();
      });
    });
  });

  // --- 8.9: Cancel ---

  describe('cancel', () => {
    it('calls onOpenChange(false) when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const { onOpenChange } = await renderDialog();

      const cancelBtn = screen.getByRole('button', { name: /common:cancel/ });
      await user.click(cancelBtn);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // --- 8.10: Accessibility ---

  describe('accessibility', () => {
    it('dialog has role="dialog"', async () => {
      await renderDialog();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('dialog has aria-labelledby pointing to the title', async () => {
      await renderDialog();

      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();

      const titleElement = document.getElementById(labelledBy!);
      expect(titleElement).toBeTruthy();
      expect(titleElement).toHaveTextContent('companyConfig.import.title');
    });

    it('file drop zone has aria-label', async () => {
      await renderDialog();

      expect(
        screen.getByLabelText('companyConfig.import.dropZoneLabel'),
      ).toBeInTheDocument();
    });

    it('dry run checkbox has linked label', async () => {
      await renderDialog();

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'dry-run-checkbox');

      const label = screen.getByText('companyConfig.import.dryRunLabel');
      expect(label.tagName).toBe('LABEL');
      expect(label).toHaveAttribute('for', 'dry-run-checkbox');
    });
  });
});
