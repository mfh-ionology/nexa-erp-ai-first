/* eslint-disable i18next/no-literal-string */

/**
 * Integration tests for <PrintPreferencesPage>.
 *
 * Covers Task 9.1 + 9.3 + 9.4:
 * - Renders preference table with all 14 document types
 * - Select dropdowns update local state correctly
 * - Save button calls mutation with changed preferences only
 * - Reset button shows confirmation and resets on confirm
 * - Default indicators shown for types without user preferences
 * - Admin section visible only for ADMIN role users
 * - Admin company-defaults flow
 * - E2E: change preference → save → verify mutation payload
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrintPreferenceItem } from '../api/use-print-preferences';
import type { CompanyDefaultItem } from '../api/use-print-company-defaults';

// ── Hoisted values ──────────────────────────────────────────────────────────

const { MockSelectCtx } = vi.hoisted(() => {
  const React = require('react');
  return { MockSelectCtx: React.createContext({}) };
});

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle', reset: vi.fn(), proceed: vi.fn() }),
  Link: ({ children }: Record<string, unknown>) => children,
}));

vi.mock('@/components/templates/page-header', () => ({
  PageHeader: ({ title, actionBarSlot }: { title: string; actionBarSlot?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {actionBarSlot && <div data-testid="action-bar">{actionBarSlot}</div>}
    </div>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

// Mock shadcn Select (Radix portal issues in jsdom)
vi.mock('@/components/ui/select', () => {
  const React = require('react');
  return {
    Select: (props: { children: unknown; value?: string; onValueChange?: (v: string) => void }) =>
      React.createElement(
        MockSelectCtx.Provider,
        { value: { onValueChange: props.onValueChange, value: props.value } },
        props.children,
      ),
    SelectTrigger: ({
      children,
      className,
    }: {
      children: unknown;
      className?: string;
      size?: string;
    }) => React.createElement('div', { 'data-testid': 'select-trigger', className }, children),
    SelectContent: ({ children }: { children: unknown }) =>
      React.createElement('div', { 'data-testid': 'select-content' }, children),
    SelectItem: (props: { children: unknown; value: string }) => {
      const ctx = React.useContext(MockSelectCtx);
      return React.createElement(
        'button',
        {
          role: 'option',
          'data-value': props.value,
          onClick: () => ctx.onValueChange?.(props.value),
        },
        props.children,
      );
    },
    SelectValue: () => {
      const ctx = React.useContext(MockSelectCtx);
      return React.createElement('span', { 'data-testid': 'select-value' }, ctx.value ?? '');
    },
  };
});

// Mock auth store
let mockPermissions: { role: string; isSuperAdmin?: boolean } | null = { role: 'STAFF' };
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ permissions: mockPermissions, isAuthenticated: true }),
}));

// Mock print preference hooks
const mockUpdateMutate = vi.fn();
const mockResetMutate = vi.fn();
const mockRefetch = vi.fn();
const mockUpdateDefaultsMutate = vi.fn();

let mockPreferencesData: PrintPreferenceItem[] | undefined;
let mockIsLoading = false;
let mockIsError = false;
let mockCompanyDefaultsData: CompanyDefaultItem[] | undefined;
let mockIsLoadingDefaults = false;

vi.mock('../api/use-print-preferences', async () => {
  const actual = await vi.importActual('../api/use-print-preferences');
  return {
    ...actual,
    usePrintPreferences: () => ({
      data: mockPreferencesData,
      isLoading: mockIsLoading,
      isError: mockIsError,
      refetch: mockRefetch,
    }),
  };
});

vi.mock('../api/use-update-print-preferences', () => ({
  useUpdatePrintPreferences: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
}));

vi.mock('../api/use-reset-print-preferences', () => ({
  useResetPrintPreferences: () => ({
    mutate: mockResetMutate,
    isPending: false,
  }),
}));

vi.mock('../api/use-print-company-defaults', async () => {
  const actual = await vi.importActual('../api/use-print-company-defaults');
  return {
    ...actual,
    usePrintCompanyDefaults: () => ({
      data: mockCompanyDefaultsData,
      isLoading: mockIsLoadingDefaults,
    }),
    useUpdatePrintCompanyDefaults: () => ({
      mutate: mockUpdateDefaultsMutate,
      isPending: false,
    }),
  };
});

// ── Test data ───────────────────────────────────────────────────────────────

const ALL_DOCUMENT_TYPES = [
  'SALES_INVOICE',
  'CREDIT_NOTE',
  'CASH_RECEIPT',
  'PROFORMA_INVOICE',
  'CUSTOMER_STATEMENT',
  'SALES_ORDER',
  'SALES_QUOTE',
  'DELIVERY_NOTE',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT_NOTE',
  'SUPPLIER_REMITTANCE',
  'PAYSLIP',
  'P45',
  'P60',
] as const;

function buildPreferences(): PrintPreferenceItem[] {
  return ALL_DOCUMENT_TYPES.map((dt, i) => ({
    documentType: dt,
    action: 'NONE' as const,
    source: (i === 0
      ? 'USER'
      : i < 4
        ? 'COMPANY_DEFAULT'
        : 'FALLBACK') as PrintPreferenceItem['source'],
  }));
}

function buildCompanyDefaults(): CompanyDefaultItem[] {
  return ALL_DOCUMENT_TYPES.map((dt) => ({
    documentType: dt,
    action: 'NONE' as const,
  }));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function renderPage() {
  const { PrintPreferencesPage } = await import('./print-preferences-page');
  return render(<PrintPreferencesPage />);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PrintPreferencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferencesData = buildPreferences();
    mockCompanyDefaultsData = buildCompanyDefaults();
    mockIsLoading = false;
    mockIsError = false;
    mockIsLoadingDefaults = false;
    mockPermissions = { role: 'STAFF' };
  });

  // --- 9.1: Renders preference table with all 14 document types ---

  it('renders page title and description', async () => {
    await renderPage();

    expect(screen.getByText('preferences.title')).toBeInTheDocument();
    expect(screen.getByText('preferences.description')).toBeInTheDocument();
  });

  it('renders all 14 document types', async () => {
    await renderPage();

    for (const dt of ALL_DOCUMENT_TYPES) {
      expect(screen.getByText(`documentTypes.${dt}`)).toBeInTheDocument();
    }
  });

  it('renders 14 select dropdowns (one per document type)', async () => {
    await renderPage();

    const triggers = screen.getAllByTestId('select-trigger');
    // STAFF user sees only user preferences table (14 selects)
    expect(triggers).toHaveLength(14);
  });

  // --- 9.1: Select dropdowns update local state correctly ---

  it('enables save button after changing a select value', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Save button should be disabled initially
    const actionBar = screen.getByTestId('action-bar');
    const saveButton = within(actionBar).getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    expect(saveButton).toBeDisabled();

    // Click an option to change SALES_INVOICE to AUTO_DOWNLOAD
    const options = screen.getAllByRole('option', { name: /preferences\.actions\.AUTO_DOWNLOAD/i });
    await user.click(options[0]!);

    // Save button should now be enabled
    expect(saveButton).toBeEnabled();
  });

  // --- 9.1: Save button calls mutation with changed preferences only ---

  it('save button sends only dirty preferences', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Change SALES_INVOICE from NONE to AUTO_DOWNLOAD
    const autoDownloadOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.AUTO_DOWNLOAD/i,
    });
    await user.click(autoDownloadOptions[0]!);

    // Click save
    const actionBar = screen.getByTestId('action-bar');
    const saveButton = within(actionBar).getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    await user.click(saveButton);

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    const payload = mockUpdateMutate.mock.calls[0]![0];

    // Should only include the changed preference (SALES_INVOICE)
    expect(payload.preferences).toHaveLength(1);
    expect(payload.preferences[0]).toEqual({
      documentType: 'SALES_INVOICE',
      action: 'AUTO_DOWNLOAD',
    });
  });

  // --- 9.1: Reset button shows confirmation and resets on confirm ---

  it('reset button shows confirmation dialog and resets on confirm', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Click the reset button to open dialog
    const resetTrigger = screen.getByRole('button', {
      name: /preferences\.resetButton/i,
    });
    await user.click(resetTrigger);

    // Confirmation dialog should appear
    expect(screen.getByText('preferences.resetConfirm')).toBeInTheDocument();

    // Click the confirm action inside the dialog
    const confirmButtons = screen.getAllByRole('button', {
      name: /preferences\.resetButton/i,
    });
    const confirmButton = confirmButtons.find(
      (btn) => btn.closest('[role="alertdialog"]') !== null,
    );
    expect(confirmButton).toBeDefined();
    await user.click(confirmButton!);

    expect(mockResetMutate).toHaveBeenCalledTimes(1);
  });

  // --- 9.1: Default indicators shown for types without user preferences ---

  it('shows default indicators for types using company defaults', async () => {
    await renderPage();

    // Types with source 'COMPANY_DEFAULT' should show the company default label
    const companyLabels = screen.getAllByText('preferences.source.companyDefault');
    expect(companyLabels.length).toBeGreaterThan(0);
  });

  it('shows fallback indicators for types with no preferences', async () => {
    await renderPage();

    // Types with source 'FALLBACK' should show the fallback label
    const fallbackLabels = screen.getAllByText('preferences.source.fallback');
    expect(fallbackLabels.length).toBeGreaterThan(0);
  });

  // --- 9.1: Admin section visible only for ADMIN role users ---

  it('does NOT render admin company defaults section for STAFF user', async () => {
    mockPermissions = { role: 'STAFF' };
    await renderPage();

    expect(screen.queryByText('preferences.companyDefaults.title')).not.toBeInTheDocument();
  });

  it('renders admin company defaults section for ADMIN user', async () => {
    mockPermissions = { role: 'ADMIN' };
    await renderPage();

    expect(screen.getByText('preferences.companyDefaults.title')).toBeInTheDocument();
    expect(screen.getByText('preferences.companyDefaults.description')).toBeInTheDocument();
  });

  it('renders admin company defaults section for SUPER_ADMIN user', async () => {
    mockPermissions = { role: 'SUPER_ADMIN' };
    await renderPage();

    expect(screen.getByText('preferences.companyDefaults.title')).toBeInTheDocument();
  });

  it('renders admin section for user with isSuperAdmin flag', async () => {
    mockPermissions = { role: 'STAFF', isSuperAdmin: true };
    await renderPage();

    expect(screen.getByText('preferences.companyDefaults.title')).toBeInTheDocument();
  });

  // --- 9.1: Error state ---

  it('renders error state with retry button', async () => {
    mockIsError = true;
    await renderPage();

    expect(screen.getByText('preferences.loadError')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(retryButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // --- 9.1: Save button disabled when no changes ---

  it('save button is disabled when no changes exist', async () => {
    await renderPage();

    const actionBar = screen.getByTestId('action-bar');
    const saveButton = within(actionBar).getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    expect(saveButton).toBeDisabled();
  });

  // --- 9.1: Unsaved changes indicator ---

  it('shows unsaved changes warning when state is dirty', async () => {
    const user = userEvent.setup();
    await renderPage();

    // No warning initially
    expect(screen.queryByText('preferences.unsavedChanges')).not.toBeInTheDocument();

    // Change a preference to create dirty state
    const options = screen.getAllByRole('option', { name: /preferences\.actions\.AUTO_DOWNLOAD/i });
    await user.click(options[0]!);

    // Warning should appear
    expect(screen.getByText('preferences.unsavedChanges')).toBeInTheDocument();
  });

  // --- 9.3: Admin company-defaults flow ---

  it('admin sees 28 select dropdowns (14 user + 14 company defaults)', async () => {
    mockPermissions = { role: 'ADMIN' };
    await renderPage();

    const triggers = screen.getAllByTestId('select-trigger');
    expect(triggers).toHaveLength(28);
  });

  it('admin can save company default changes', async () => {
    mockPermissions = { role: 'ADMIN' };
    const user = userEvent.setup();
    await renderPage();

    // The company defaults table has its own set of options
    // Options 14-27 are for company defaults section
    const allAutoDownloadOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.AUTO_DOWNLOAD/i,
    });
    // Click an option in the company defaults section (second table, index 14+)
    await user.click(allAutoDownloadOptions[14]!);

    // Click the company defaults save button
    const companyDefaultsSaveButton = screen.getByRole('button', {
      name: /preferences\.companyDefaults\.saveButton/i,
    });
    await user.click(companyDefaultsSaveButton);

    expect(mockUpdateDefaultsMutate).toHaveBeenCalledTimes(1);
  });

  it('non-admin cannot access company defaults section', async () => {
    mockPermissions = { role: 'MANAGER' };
    await renderPage();

    expect(screen.queryByText('preferences.companyDefaults.title')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /preferences\.companyDefaults\.saveButton/i }),
    ).not.toBeInTheDocument();
  });

  // --- 9.4: E2E verification ---

  it('e2e: change SALES_INVOICE to AUTO_DOWNLOAD → save → verify payload', async () => {
    // Start with all NONE preferences
    mockPreferencesData = buildPreferences();
    const user = userEvent.setup();
    await renderPage();

    // Change SALES_INVOICE to AUTO_DOWNLOAD (first option in first row)
    const autoDownloadOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.AUTO_DOWNLOAD/i,
    });
    await user.click(autoDownloadOptions[0]!);

    // Click save
    const actionBar = screen.getByTestId('action-bar');
    const saveButton = within(actionBar).getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    await user.click(saveButton);

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    const [payload, callbacks] = mockUpdateMutate.mock.calls[0]!;

    // Verify payload
    expect(payload.preferences).toEqual([
      { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD' },
    ]);

    // Simulate successful save callback
    if (callbacks?.onSuccess) {
      callbacks.onSuccess();
    }
  });

  it('e2e: multiple preference changes across document types', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Change SALES_INVOICE (row 0) to AUTO_DOWNLOAD
    const autoDownloadOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.AUTO_DOWNLOAD/i,
    });
    await user.click(autoDownloadOptions[0]!);

    // Change CREDIT_NOTE (row 1) to BROWSER_PRINT
    const browserPrintOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.BROWSER_PRINT/i,
    });
    await user.click(browserPrintOptions[1]!);

    // Click save
    const actionBar = screen.getByTestId('action-bar');
    const saveButton = within(actionBar).getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    await user.click(saveButton);

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    const payload = mockUpdateMutate.mock.calls[0]![0];

    // Should include both changed preferences
    expect(payload.preferences).toHaveLength(2);

    const salesInvoice = payload.preferences.find(
      (p: Record<string, unknown>) => p.documentType === 'SALES_INVOICE',
    );
    const creditNote = payload.preferences.find(
      (p: Record<string, unknown>) => p.documentType === 'CREDIT_NOTE',
    );

    expect(salesInvoice).toEqual({
      documentType: 'SALES_INVOICE',
      action: 'AUTO_DOWNLOAD',
    });
    expect(creditNote).toEqual({
      documentType: 'CREDIT_NOTE',
      action: 'BROWSER_PRINT',
    });
  });

  it('does not send mutation when save clicked with no changes', async () => {
    await renderPage();

    const actionBar = screen.getByTestId('action-bar');
    const saveButton = within(actionBar).getByRole('button', {
      name: /preferences\.saveButton/i,
    });

    // Button should be disabled — can't click
    expect(saveButton).toBeDisabled();
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });
});
