/* eslint-disable i18next/no-literal-string */

/**
 * Component tests for <PrintPreferenceTable>.
 *
 * Covers Task 9.2:
 * - Renders all 14 document types with human-readable labels
 * - Select dropdowns show correct options (Auto-Download, Browser Print, None)
 * - Visual distinction between user-set and default preferences
 * - Loading skeleton
 * - onChange callback fires correctly
 * - Source labels hidden when hideSourceLabels prop is true
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DocumentType, PrintAction, PreferenceSource } from '../api/use-print-preferences';
import type { PreferenceRow } from './print-preference-table';

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

// ── Constants ───────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_ORDER: DocumentType[] = [
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
];

const PRINT_ACTIONS: PrintAction[] = ['AUTO_DOWNLOAD', 'BROWSER_PRINT', 'NONE'];

// ── Test data ───────────────────────────────────────────────────────────────

function buildPreferences(
  overrides?: Partial<Record<DocumentType, { action: PrintAction; source: PreferenceSource }>>,
): PreferenceRow[] {
  return DOCUMENT_TYPE_ORDER.map((dt) => ({
    documentType: dt,
    action: overrides?.[dt]?.action ?? 'NONE',
    source: overrides?.[dt]?.source ?? 'FALLBACK',
  }));
}

function buildLocalState(prefs: PreferenceRow[]): Record<string, PrintAction> {
  const state: Record<string, PrintAction> = {};
  for (const p of prefs) {
    state[p.documentType] = p.action;
  }
  return state;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function renderTable(
  overrides?: Partial<{
    preferences: PreferenceRow[];
    localState: Record<string, PrintAction>;
    onChange: (documentType: DocumentType, action: PrintAction) => void;
    isLoading: boolean;
    hideSourceLabels: boolean;
  }>,
) {
  const { PrintPreferenceTable } = await import('./print-preference-table');
  const prefs = overrides?.preferences ?? buildPreferences();
  return render(
    <PrintPreferenceTable
      preferences={prefs}
      localState={overrides?.localState ?? buildLocalState(prefs)}
      onChange={overrides?.onChange ?? vi.fn()}
      isLoading={overrides?.isLoading ?? false}
      hideSourceLabels={overrides?.hideSourceLabels ?? false}
    />,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PrintPreferenceTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Renders all 14 document types with human-readable labels ---

  it('renders all 14 document type labels', async () => {
    await renderTable();

    for (const dt of DOCUMENT_TYPE_ORDER) {
      expect(screen.getByText(`documentTypes.${dt}`)).toBeInTheDocument();
    }
  });

  it('renders 14 select dropdowns (one per document type)', async () => {
    await renderTable();

    const triggers = screen.getAllByTestId('select-trigger');
    expect(triggers).toHaveLength(14);
  });

  // --- Select dropdowns show correct options ---

  it('renders 3 options per document type (42 total)', async () => {
    await renderTable();

    const options = screen.getAllByRole('option');
    // 14 document types × 3 actions = 42 options
    expect(options).toHaveLength(42);
  });

  it('shows all three action labels in each dropdown', async () => {
    await renderTable();

    for (const action of PRINT_ACTIONS) {
      const actionOptions = screen.getAllByRole('option', {
        name: `preferences.actions.${action}`,
      });
      // One per document type
      expect(actionOptions).toHaveLength(14);
    }
  });

  // --- Visual distinction between user-set and default preferences ---

  it('shows "(company default)" label for COMPANY_DEFAULT source rows', async () => {
    const prefs = buildPreferences({
      SALES_INVOICE: { action: 'AUTO_DOWNLOAD', source: 'COMPANY_DEFAULT' },
      CREDIT_NOTE: { action: 'BROWSER_PRINT', source: 'COMPANY_DEFAULT' },
    });
    await renderTable({ preferences: prefs, localState: buildLocalState(prefs) });

    const companyLabels = screen.getAllByText('preferences.source.companyDefault');
    expect(companyLabels).toHaveLength(2);
  });

  it('shows "(system default)" label for FALLBACK source rows', async () => {
    const prefs = buildPreferences({
      SALES_INVOICE: { action: 'NONE', source: 'FALLBACK' },
    });
    await renderTable({ preferences: prefs, localState: buildLocalState(prefs) });

    const fallbackLabels = screen.getAllByText('preferences.source.fallback');
    expect(fallbackLabels.length).toBeGreaterThan(0);
  });

  it('does NOT show source label for USER source rows', async () => {
    // All rows are USER source
    const prefs = DOCUMENT_TYPE_ORDER.map((dt) => ({
      documentType: dt,
      action: 'AUTO_DOWNLOAD' as PrintAction,
      source: 'USER' as PreferenceSource,
    }));
    await renderTable({ preferences: prefs, localState: buildLocalState(prefs) });

    expect(screen.queryByText('preferences.source.companyDefault')).not.toBeInTheDocument();
    expect(screen.queryByText('preferences.source.fallback')).not.toBeInTheDocument();
  });

  it('applies dimmed styling for inherited (non-USER) preferences', async () => {
    const prefs = buildPreferences({
      SALES_INVOICE: { action: 'NONE', source: 'COMPANY_DEFAULT' },
      CREDIT_NOTE: { action: 'AUTO_DOWNLOAD', source: 'USER' },
    });
    await renderTable({ preferences: prefs, localState: buildLocalState(prefs) });

    const triggers = screen.getAllByTestId('select-trigger');
    // First row (SALES_INVOICE, COMPANY_DEFAULT) should have muted class
    expect(triggers[0]!.className).toContain('text-muted-foreground');
    // Second row (CREDIT_NOTE, USER) should have foreground class
    expect(triggers[1]!.className).toContain('text-foreground');
  });

  // --- hideSourceLabels prop ---

  it('hides source labels when hideSourceLabels is true', async () => {
    const prefs = buildPreferences({
      SALES_INVOICE: { action: 'NONE', source: 'COMPANY_DEFAULT' },
      CREDIT_NOTE: { action: 'NONE', source: 'FALLBACK' },
    });
    await renderTable({
      preferences: prefs,
      localState: buildLocalState(prefs),
      hideSourceLabels: true,
    });

    expect(screen.queryByText('preferences.source.companyDefault')).not.toBeInTheDocument();
    expect(screen.queryByText('preferences.source.fallback')).not.toBeInTheDocument();
  });

  // --- onChange callback ---

  it('calls onChange with correct documentType and action when option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await renderTable({ onChange });

    // Click AUTO_DOWNLOAD option for the first row (SALES_INVOICE)
    const autoDownloadOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.AUTO_DOWNLOAD/i,
    });
    await user.click(autoDownloadOptions[0]!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('SALES_INVOICE', 'AUTO_DOWNLOAD');
  });

  it('calls onChange for each option clicked across different rows', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await renderTable({ onChange });

    // Click BROWSER_PRINT for CREDIT_NOTE (2nd row, index 1)
    const browserPrintOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.BROWSER_PRINT/i,
    });
    await user.click(browserPrintOptions[1]!);

    // Click AUTO_DOWNLOAD for PURCHASE_ORDER (9th row, index 8)
    const autoDownloadOptions = screen.getAllByRole('option', {
      name: /preferences\.actions\.AUTO_DOWNLOAD/i,
    });
    await user.click(autoDownloadOptions[8]!);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'CREDIT_NOTE', 'BROWSER_PRINT');
    expect(onChange).toHaveBeenNthCalledWith(2, 'PURCHASE_ORDER', 'AUTO_DOWNLOAD');
  });

  // --- Loading skeleton ---

  it('renders loading skeleton when isLoading is true', async () => {
    await renderTable({ isLoading: true, preferences: [] });

    // Should render skeletons
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);

    // Should not render any document type labels
    expect(screen.queryByText('documentTypes.SALES_INVOICE')).not.toBeInTheDocument();
  });

  // --- Column headers ---

  it('renders column headers', async () => {
    await renderTable();

    expect(screen.getByText('preferences.columns.documentType')).toBeInTheDocument();
    expect(screen.getByText('preferences.columns.myPreference')).toBeInTheDocument();
  });

  // --- Select value reflects current state ---

  it('select values display current action from localState', async () => {
    const prefs = buildPreferences({
      SALES_INVOICE: { action: 'AUTO_DOWNLOAD', source: 'USER' },
      CREDIT_NOTE: { action: 'BROWSER_PRINT', source: 'USER' },
    });
    await renderTable({ preferences: prefs, localState: buildLocalState(prefs) });

    const selectValues = screen.getAllByTestId('select-value');
    expect(selectValues[0]!.textContent).toBe('AUTO_DOWNLOAD');
    expect(selectValues[1]!.textContent).toBe('BROWSER_PRINT');
  });
});
