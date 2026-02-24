import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AccessGroupFieldOverride } from '../api/types';
import type { Resource } from '@/features/admin/resources/api/use-resources';

// --- Polyfill scrollIntoView for jsdom (used by cmdk) ---
Element.prototype.scrollIntoView = vi.fn();

// --- Hoisted values (available before vi.mock factories) ---
const { MockApiError, MockSelectCtx } = vi.hoisted(() => {
  const React = require('react');

  class _MockApiError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.statusCode = statusCode;
    }
  }

  return {
    MockApiError: _MockApiError,
    MockSelectCtx: React.createContext({}),
  };
});

// --- Mock sonner toast ---
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock @nexa/api-client ---
vi.mock('@nexa/api-client', () => ({
  ApiError: MockApiError,
}));

// --- Mock useResources ---
const mockUseResources = vi.fn();
vi.mock('@/features/admin/resources/api/use-resources', () => ({
  useResources: (...args: unknown[]) => mockUseResources(...args),
}));

// --- Mock useSetFieldOverrides ---
const mockSetFieldOverridesMutateAsync = vi.fn();
const mockSetFieldOverridesMutation = {
  mutateAsync: mockSetFieldOverridesMutateAsync,
  isPending: false,
};
vi.mock('../api/use-access-group-mutations', () => ({
  useSetFieldOverrides: () => mockSetFieldOverridesMutation,
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      resources: () => ['system', 'resources'],
      accessGroup: (id: string) => ['system', 'access-groups', id],
    },
  },
}));

// --- Mock shadcn Select (avoids Radix portal issues in jsdom) ---
vi.mock('@/components/ui/select', () => {
  const React = require('react');
  return {
    Select: (props: {
      children: unknown;
      value?: string;
      onValueChange?: (v: string) => void;
    }) =>
      React.createElement(
        MockSelectCtx.Provider,
        { value: { onValueChange: props.onValueChange, value: props.value } },
        props.children,
      ),
    SelectTrigger: ({ children }: { children: unknown }) =>
      React.createElement('div', null, children),
    SelectContent: ({ children }: { children: unknown }) =>
      React.createElement('div', null, children),
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
      return React.createElement('span', null, ctx.value ?? '');
    },
  };
});

// --- Test data ---

const testResources: Resource[] = [
  {
    id: '1',
    code: 'finance.journals.list',
    name: 'Journal Entries',
    module: 'Finance',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: null,
    description: null,
    isActive: true,
  },
  {
    id: '2',
    code: 'finance.balanceSheet',
    name: 'Balance Sheet',
    module: 'Finance',
    type: 'REPORT',
    parentCode: null,
    sortOrder: 2,
    icon: null,
    description: null,
    isActive: true,
  },
  {
    id: '3',
    code: 'sales.orders.list',
    name: 'Sales Orders',
    module: 'Sales',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: null,
    description: null,
    isActive: true,
  },
];

const testFieldOverrides: AccessGroupFieldOverride[] = [
  {
    resourceCode: 'finance.journals.list',
    resourceName: 'Journal Entries',
    fieldPath: 'costPrice',
    visibility: 'HIDDEN',
  },
  {
    resourceCode: 'finance.journals.list',
    resourceName: 'Journal Entries',
    fieldPath: 'purchasePrice',
    visibility: 'READ_ONLY',
  },
  {
    resourceCode: 'sales.orders.list',
    resourceName: 'Sales Orders',
    fieldPath: 'discount',
    visibility: 'VISIBLE',
  },
];

// --- Helpers ---

function setupMocks(overrides: Record<string, unknown> = {}) {
  mockUseResources.mockReturnValue({
    data: { data: testResources },
    isLoading: false,
    ...overrides,
  });
}

// Dynamic import after mocks
async function renderPanel(
  fieldOverrides: AccessGroupFieldOverride[] = [],
  accessGroupId = 'ag-1',
  readOnly = false,
) {
  const { FieldOverridePanel } = await import('./field-override-panel');
  return render(
    <FieldOverridePanel
      accessGroupId={accessGroupId}
      fieldOverrides={fieldOverrides}
      readOnly={readOnly}
    />,
  );
}

/** Open the resource combobox and click a resource by name. */
async function openAndSelectResource(
  user: ReturnType<typeof userEvent.setup>,
  resourceName: string,
) {
  const combobox = screen.getByRole('combobox');
  await user.click(combobox);
  const option = screen.getByRole('option', {
    name: new RegExp(resourceName),
  });
  await user.click(option);
}

// --- Tests ---

describe('FieldOverridePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFieldOverridesMutation.isPending = false;
    setupMocks();
  });

  // --- 6.1: Empty state rendering ---

  describe('empty state rendering', () => {
    it('shows empty state message when no resource is selected', async () => {
      await renderPanel();

      expect(
        screen.getByText('accessGroups.fieldOverrides.emptyState'),
      ).toBeInTheDocument();
    });

    it('renders the resource selector combobox', async () => {
      await renderPanel();

      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeInTheDocument();
    });

    it('does not render table when no resource is selected', async () => {
      await renderPanel();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  // --- 6.2: Resource selector ---

  describe('resource selector', () => {
    it('opens dropdown listing resources grouped by module', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await user.click(screen.getByRole('combobox'));

      // Module group headers
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Sales')).toBeInTheDocument();

      // Resource names
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
      expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
    });

    it('search input filters resources by name', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await user.click(screen.getByRole('combobox'));
      const searchInput = screen.getByPlaceholderText(
        'accessGroups.fieldOverrides.searchResources',
      );
      await user.type(searchInput, 'Journal');

      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
      expect(screen.queryByText('Sales Orders')).not.toBeInTheDocument();
    });

    it('search input filters resources by code', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await user.click(screen.getByRole('combobox'));
      const searchInput = screen.getByPlaceholderText(
        'accessGroups.fieldOverrides.searchResources',
      );
      await user.type(searchInput, 'sales.orders');

      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
      expect(screen.queryByText('Journal Entries')).not.toBeInTheDocument();
    });

    it('selecting a resource shows its name and code in the trigger', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await openAndSelectResource(user, 'Journal Entries');

      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
      expect(screen.getByText('finance.journals.list')).toBeInTheDocument();
    });

    it('resource code is displayed in each dropdown item', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await user.click(screen.getByRole('combobox'));

      expect(screen.getByText('finance.journals.list')).toBeInTheDocument();
      expect(screen.getByText('finance.balanceSheet')).toBeInTheDocument();
      expect(screen.getByText('sales.orders.list')).toBeInTheDocument();
    });
  });

  // --- 6.3: Override table rendering ---

  describe('override table rendering', () => {
    it('shows override rows for the selected resource', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // 2 overrides for Journal Entries
      expect(screen.getByDisplayValue('costPrice')).toBeInTheDocument();
      expect(screen.getByDisplayValue('purchasePrice')).toBeInTheDocument();
    });

    it('each row has field path input, visibility, and remove button', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // Field path inputs
      expect(screen.getByDisplayValue('costPrice')).toBeInTheDocument();
      expect(screen.getByDisplayValue('purchasePrice')).toBeInTheDocument();

      // Remove buttons (one per row)
      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      expect(removeButtons).toHaveLength(2);

      // Visibility option buttons rendered by mock Select (3 per row = 6 total)
      const visibilityOptions = screen.getAllByRole('option');
      expect(visibilityOptions).toHaveLength(6);
    });

    it('selecting a resource with no overrides shows empty state with add button', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Balance Sheet');

      expect(
        screen.getByText('accessGroups.fieldOverrides.noOverrides'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      ).toBeInTheDocument();
    });
  });

  // --- 6.4: Add override ---

  describe('add override', () => {
    it('clicking "Add Field Override" adds a new row with empty field path and VISIBLE default', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Balance Sheet');

      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      // New row should have an empty input with placeholder
      const emptyInput = screen.getByPlaceholderText(
        'accessGroups.fieldOverrides.fieldPathPlaceholder',
      );
      expect(emptyInput).toBeInTheDocument();
      expect(emptyInput).toHaveValue('');

      // Default visibility is VISIBLE (shown by mock SelectValue)
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]!; // skip header
      expect(within(dataRow).getByText('VISIBLE')).toBeInTheDocument();
    });

    it('new row field path input is auto-focused', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Balance Sheet');

      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      await waitFor(() => {
        const emptyInput = screen.getByPlaceholderText(
          'accessGroups.fieldOverrides.fieldPathPlaceholder',
        );
        expect(emptyInput).toHaveFocus();
      });
    });

    it('multiple new rows can be added', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Balance Sheet');

      // First click replaces empty state card with table — must re-query button
      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );
      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      const inputs = screen.getAllByPlaceholderText(
        'accessGroups.fieldOverrides.fieldPathPlaceholder',
      );
      expect(inputs).toHaveLength(2);
    });
  });

  // --- 6.5: Field path validation ---

  describe('field path validation', () => {
    it('empty field path shows required validation error', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await openAndSelectResource(user, 'Balance Sheet');

      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      // New row has empty field path → required validation error
      expect(
        screen.getByText('accessGroups.fieldOverrides.fieldRequired'),
      ).toBeInTheDocument();
    });

    it('duplicate field path shows duplicate validation error', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await openAndSelectResource(user, 'Balance Sheet');

      // Add two rows — must re-query button after first click (DOM changes)
      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );
      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      // Type the same field path in both
      const inputs = screen.getAllByPlaceholderText(
        'accessGroups.fieldOverrides.fieldPathPlaceholder',
      );
      await user.type(inputs[0]!, 'costPrice');
      await user.type(inputs[1]!, 'costPrice');

      // Both rows get duplicate error
      const duplicateErrors = screen.getAllByText(
        'accessGroups.fieldOverrides.duplicateField',
      );
      expect(duplicateErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('validation errors prevent Save button from being enabled', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await openAndSelectResource(user, 'Balance Sheet');

      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      // Save disabled: empty field path is a validation error
      const saveButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.save/,
      });
      expect(saveButton).toBeDisabled();
    });
  });

  // --- 6.6: Visibility dropdown ---

  describe('visibility dropdown', () => {
    it('changing visibility from HIDDEN to VISIBLE updates local state', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // costPrice row has visibility HIDDEN
      const rows = screen.getAllByRole('row');
      const costPriceRow = rows[1]!; // first data row

      // Verify current value
      expect(within(costPriceRow).getByText('HIDDEN')).toBeInTheDocument();

      // Click the VISIBLE option in that row
      const visibleOption = within(costPriceRow).getByRole('option', {
        name: 'accessGroups.fieldOverrides.visibility.VISIBLE',
      });
      await user.click(visibleOption);

      // SelectValue should now show VISIBLE
      expect(within(costPriceRow).getByText('VISIBLE')).toBeInTheDocument();
    });

    it('all three visibility options are available per row', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      const rows = screen.getAllByRole('row');
      const costPriceRow = rows[1]!;

      expect(
        within(costPriceRow).getByRole('option', {
          name: 'accessGroups.fieldOverrides.visibility.VISIBLE',
        }),
      ).toBeInTheDocument();
      expect(
        within(costPriceRow).getByRole('option', {
          name: 'accessGroups.fieldOverrides.visibility.READ_ONLY',
        }),
      ).toBeInTheDocument();
      expect(
        within(costPriceRow).getByRole('option', {
          name: 'accessGroups.fieldOverrides.visibility.HIDDEN',
        }),
      ).toBeInTheDocument();
    });
  });

  // --- 6.7: Remove override ---

  describe('remove override', () => {
    it('clicking remove button removes the row from the table', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // Initially 2 rows
      expect(screen.getByDisplayValue('costPrice')).toBeInTheDocument();
      expect(screen.getByDisplayValue('purchasePrice')).toBeInTheDocument();

      // Remove first row
      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      await user.click(removeButtons[0]!);

      // costPrice gone, purchasePrice remains
      expect(screen.queryByDisplayValue('costPrice')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('purchasePrice')).toBeInTheDocument();
    });

    it('remove buttons have aria-label', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      expect(removeButtons).toHaveLength(2);
      removeButtons.forEach((btn) => {
        expect(btn).toHaveAttribute('aria-label');
      });
    });

    it('removing all overrides for a resource shows empty state', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      // Sales Orders has only 1 override
      await openAndSelectResource(user, 'Sales Orders');
      expect(screen.getByDisplayValue('discount')).toBeInTheDocument();

      // Remove it
      const removeButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      await user.click(removeButton);

      expect(
        screen.getByText('accessGroups.fieldOverrides.noOverrides'),
      ).toBeInTheDocument();
    });
  });

  // --- 6.8: Dirty state and save ---

  describe('dirty state and save', () => {
    it('Save button is disabled when no changes exist', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      const saveButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.save/,
      });
      expect(saveButton).toBeDisabled();
    });

    it('adding an override enables Save button after filling field path', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Balance Sheet');

      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      // Type a valid field path
      const input = screen.getByPlaceholderText(
        'accessGroups.fieldOverrides.fieldPathPlaceholder',
      );
      await user.type(input, 'newField');

      const saveButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.save/,
      });
      expect(saveButton).not.toBeDisabled();
    });

    it('removing an override enables Save button', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // Remove one override
      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      await user.click(removeButtons[0]!);

      const saveButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.save/,
      });
      expect(saveButton).not.toBeDisabled();
    });

    it('clicking Save calls mutation with ALL overrides across all resources', async () => {
      const user = userEvent.setup();
      mockSetFieldOverridesMutateAsync.mockResolvedValue({});
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // Remove costPrice override to trigger dirty state
      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      await user.click(removeButtons[0]!);

      // Click Save
      const saveButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.save/,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSetFieldOverridesMutateAsync).toHaveBeenCalledTimes(1);
      });

      // Verify payload includes ALL overrides (not just the selected resource)
      const call = mockSetFieldOverridesMutateAsync.mock.calls[0]![0] as {
        fieldOverrides: Array<{
          resourceCode: string;
          fieldPath: string;
          visibility: string;
        }>;
      };
      expect(call.fieldOverrides).toHaveLength(2); // costPrice removed: purchasePrice + discount remain
      expect(call.fieldOverrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            resourceCode: 'finance.journals.list',
            fieldPath: 'purchasePrice',
            visibility: 'READ_ONLY',
          }),
          expect.objectContaining({
            resourceCode: 'sales.orders.list',
            fieldPath: 'discount',
            visibility: 'VISIBLE',
          }),
        ]),
      );
    });

    it('Save button returns to disabled state after successful save', async () => {
      const user = userEvent.setup();
      mockSetFieldOverridesMutateAsync.mockResolvedValue({});
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // Make dirty
      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      await user.click(removeButtons[0]!);

      const saveButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.save/,
      });
      expect(saveButton).not.toBeDisabled();

      await user.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });
  });

  // --- 6.9: Error handling ---

  describe('error handling', () => {
    it('local state is preserved after mutation error (can retry)', async () => {
      const user = userEvent.setup();
      mockSetFieldOverridesMutateAsync.mockRejectedValue(
        new MockApiError('VALIDATION_ERROR', 'Invalid resources', 400),
      );
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      // Remove costPrice
      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      await user.click(removeButtons[0]!);

      // Click Save (will fail)
      const saveButton = screen.getByRole('button', {
        name: /accessGroups\.fieldOverrides\.save/,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSetFieldOverridesMutateAsync).toHaveBeenCalledTimes(1);
      });

      // State preserved: purchasePrice still visible
      expect(screen.getByDisplayValue('purchasePrice')).toBeInTheDocument();
      // Save button still enabled (dirty state preserved)
      expect(saveButton).not.toBeDisabled();
    });
  });

  // --- 6.10: Resource switching preserves changes ---

  describe('resource switching preserves changes', () => {
    it('changes for Resource A are preserved after switching to B and back', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      // Select Journal Entries — see 2 overrides
      await openAndSelectResource(user, 'Journal Entries');
      expect(screen.getByDisplayValue('costPrice')).toBeInTheDocument();
      expect(screen.getByDisplayValue('purchasePrice')).toBeInTheDocument();

      // Remove costPrice
      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      await user.click(removeButtons[0]!);
      expect(screen.queryByDisplayValue('costPrice')).not.toBeInTheDocument();

      // Switch to Sales Orders
      await openAndSelectResource(user, 'Sales Orders');
      expect(screen.getByDisplayValue('discount')).toBeInTheDocument();

      // Switch back to Journal Entries
      await openAndSelectResource(user, 'Journal Entries');

      // costPrice is still removed (change preserved)
      expect(screen.queryByDisplayValue('costPrice')).not.toBeInTheDocument();
      // purchasePrice is still present
      expect(screen.getByDisplayValue('purchasePrice')).toBeInTheDocument();
    });
  });

  // --- 6.11: Accessibility ---

  describe('accessibility', () => {
    it('resource selector has aria-expanded="false" when closed', async () => {
      await renderPanel();

      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
    });

    it('resource selector has aria-expanded="true" when opened', async () => {
      const user = userEvent.setup();
      await renderPanel();

      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      expect(combobox).toHaveAttribute('aria-expanded', 'true');
    });

    it('remove buttons have aria-label containing the field name', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides);

      await openAndSelectResource(user, 'Journal Entries');

      const removeButtons = screen.getAllByRole('button', {
        name: /accessGroups\.fieldOverrides\.removeOverride/,
      });
      expect(removeButtons).toHaveLength(2);
      removeButtons.forEach((btn) => {
        expect(btn).toHaveAttribute(
          'aria-label',
          expect.stringContaining('accessGroups.fieldOverrides.removeOverride'),
        );
      });
    });

    it('field path inputs have aria-invalid when validation fails', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await openAndSelectResource(user, 'Balance Sheet');

      await user.click(
        screen.getByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      );

      // Empty field path → validation error → aria-invalid="true"
      const input = screen.getByPlaceholderText(
        'accessGroups.fieldOverrides.fieldPathPlaceholder',
      );
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('keyboard navigation: Tab reaches the combobox', async () => {
      const user = userEvent.setup();
      await renderPanel();

      await user.tab();

      expect(screen.getByRole('combobox')).toHaveFocus();
    });
  });

  // --- 6.12: Read-only mode (system groups) ---

  describe('read-only mode (system groups)', () => {
    it('does not render Add Override button when readOnly and no overrides exist', async () => {
      const user = userEvent.setup();
      await renderPanel([], 'ag-system', true);

      await openAndSelectResource(user, 'Balance Sheet');

      expect(
        screen.queryByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      ).not.toBeInTheDocument();
    });

    it('does not render Remove buttons when readOnly', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides, 'ag-system', true);

      await openAndSelectResource(user, 'Journal Entries');

      expect(
        screen.queryAllByRole('button', {
          name: /accessGroups\.fieldOverrides\.removeOverride/,
        }),
      ).toHaveLength(0);
    });

    it('field path inputs are disabled when readOnly', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides, 'ag-system', true);

      await openAndSelectResource(user, 'Journal Entries');

      const costPriceInput = screen.getByDisplayValue('costPrice');
      expect(costPriceInput).toBeDisabled();
    });

    it('does not render Save button when readOnly', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides, 'ag-system', true);

      await openAndSelectResource(user, 'Journal Entries');

      expect(
        screen.queryByRole('button', {
          name: /accessGroups\.fieldOverrides\.save/,
        }),
      ).not.toBeInTheDocument();
    });

    it('does not render Add Override button below table when readOnly', async () => {
      const user = userEvent.setup();
      await renderPanel(testFieldOverrides, 'ag-system', true);

      await openAndSelectResource(user, 'Journal Entries');

      // Table renders (overrides are visible) but no Add button
      expect(screen.getByDisplayValue('costPrice')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {
          name: /accessGroups\.fieldOverrides\.addOverride/,
        }),
      ).not.toBeInTheDocument();
    });
  });
});
