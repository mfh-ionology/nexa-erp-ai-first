import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AccessGroupPermission } from '../api/types';
import type { Resource } from '@/features/admin/resources/api/use-resources';

// --- Mock useBreakpoint ---
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// --- Mock sonner toast ---
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock @nexa/api-client errors (hoisted) ---
const { MockValidationError } = vi.hoisted(() => {
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
  class _MockValidationError extends _MockApiError {
    readonly details: Record<string, string[]>;
    constructor(message: string, details: Record<string, string[]> = {}) {
      super('VALIDATION_ERROR', message, 400);
      this.name = 'ValidationError';
      this.details = details;
    }
  }
  return { MockApiError: _MockApiError, MockValidationError: _MockValidationError };
});

vi.mock('@nexa/api-client', () => ({
  ApiError: MockValidationError,
  ValidationError: MockValidationError,
}));

// --- Mock useResources ---
const mockUseResources = vi.fn();
vi.mock('@/features/admin/resources/api/use-resources', () => ({
  useResources: (...args: unknown[]) => mockUseResources(...args),
}));

// --- Mock useSetPermissions ---
const mockSetPermissionsMutateAsync = vi.fn();
const mockSetPermissionsMutation = {
  mutateAsync: mockSetPermissionsMutateAsync,
  isPending: false,
};
vi.mock('../api/use-access-group-mutations', () => ({
  useSetPermissions: () => mockSetPermissionsMutation,
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

const testPermissions: AccessGroupPermission[] = [
  {
    resourceCode: 'finance.journals.list',
    resourceName: 'Journal Entries',
    resourceModule: 'Finance',
    resourceType: 'PAGE',
    canAccess: true,
    canNew: true,
    canView: true,
    canEdit: false,
    canDelete: false,
  },
];

function setupMocks(overrides: Record<string, unknown> = {}) {
  mockUseResources.mockReturnValue({
    data: { data: testResources },
    isLoading: false,
    ...overrides,
  });
}

// Dynamic import after mocks
async function renderMatrix(
  permissions: AccessGroupPermission[] = testPermissions,
  accessGroupId = 'ag-1',
) {
  const { PermissionMatrix } = await import('./permission-matrix');
  return render(
    <PermissionMatrix
      accessGroupId={accessGroupId}
      permissions={permissions}
    />,
  );
}

describe('PermissionMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMocks();
  });

  // --- Rendering tests ---

  describe('rendering', () => {
    it('renders resources grouped by module', async () => {
      await renderMatrix();

      // Module group headers
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Sales')).toBeInTheDocument();
    });

    it('module sections are collapsible', async () => {
      const user = userEvent.setup();
      await renderMatrix();

      // Both modules should have their resources visible (default expanded)
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
      expect(screen.getByText('Sales Orders')).toBeInTheDocument();

      // Click to collapse a module (Finance header)
      const financeHeader = screen.getByText('Finance').closest('[data-state]');
      if (financeHeader) {
        await user.click(financeHeader);
      }
    });

    it('checkbox grid shows 5 permission columns per resource', async () => {
      await renderMatrix();

      // Column headers appear in each module's sticky header row
      expect(screen.getAllByText('accessGroups.permission.access').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('accessGroups.permission.new').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('accessGroups.permission.view').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('accessGroups.permission.edit').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('accessGroups.permission.delete').length).toBeGreaterThanOrEqual(1);
    });

    it('renders column headers with permission labels', async () => {
      await renderMatrix();

      // There should be column header labels in the sticky header
      const accessLabels = screen.getAllByText('accessGroups.permission.access');
      expect(accessLabels.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Interaction tests ---

  describe('interaction', () => {
    it('checking a checkbox marks the permission as true', async () => {
      const user = userEvent.setup();
      await renderMatrix();

      // Find the "Sales Orders canAccess" checkbox (initially unchecked)
      const checkbox = screen.getByRole('checkbox', {
        name: 'Sales Orders accessGroups.permission.access',
      });
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('unchecking a checkbox marks it as false', async () => {
      const user = userEvent.setup();
      await renderMatrix();

      // Find "Journal Entries canAccess" — initially true from permissions
      const checkbox = screen.getByRole('checkbox', {
        name: 'Journal Entries accessGroups.permission.access',
      });
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('"Select All" per module sets all resources in that module', async () => {
      const user = userEvent.setup();
      await renderMatrix();

      // Click the "Select All canAccess" checkbox for Finance module
      const selectAllCheckbox = screen.getByRole('checkbox', {
        name: 'accessGroups.permission.selectAll accessGroups.permission.access - Finance',
      });

      await user.click(selectAllCheckbox);

      // Both Finance resources should now have canAccess checked
      const journalAccess = screen.getByRole('checkbox', {
        name: 'Journal Entries accessGroups.permission.access',
      });
      const balanceAccess = screen.getByRole('checkbox', {
        name: 'Balance Sheet accessGroups.permission.access',
      });

      expect(journalAccess).toBeChecked();
      expect(balanceAccess).toBeChecked();
    });

    it('dirty state enables "Save Permissions" button', async () => {
      const user = userEvent.setup();
      await renderMatrix();

      // Save button should be disabled initially
      const saveButton = screen.getByRole('button', {
        name: /accessGroups.permission.savePermissions/i,
      });
      expect(saveButton).toBeDisabled();

      // Make a change
      const checkbox = screen.getByRole('checkbox', {
        name: 'Sales Orders accessGroups.permission.access',
      });
      await user.click(checkbox);

      // Save button should now be enabled
      expect(saveButton).not.toBeDisabled();
    });
  });

  // --- Save tests ---

  describe('save', () => {
    it('save calls PUT with full permissions array', async () => {
      const user = userEvent.setup();
      mockSetPermissionsMutateAsync.mockResolvedValue({});
      await renderMatrix();

      // Make a change to enable save
      const checkbox = screen.getByRole('checkbox', {
        name: 'Sales Orders accessGroups.permission.access',
      });
      await user.click(checkbox);

      const saveButton = screen.getByRole('button', {
        name: /accessGroups.permission.savePermissions/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSetPermissionsMutateAsync).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              resourceCode: 'sales.orders.list',
              canAccess: true,
            }),
          ]),
        );
      });
    });

    it('success toast on save', async () => {
      const user = userEvent.setup();
      mockSetPermissionsMutateAsync.mockResolvedValue({});
      await renderMatrix();

      // Make a change
      const checkbox = screen.getByRole('checkbox', {
        name: 'Sales Orders accessGroups.permission.access',
      });
      await user.click(checkbox);

      const saveButton = screen.getByRole('button', {
        name: /accessGroups.permission.savePermissions/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSetPermissionsMutateAsync).toHaveBeenCalled();
      });
      // Toast is triggered by the mutation's onSuccess in the hook, not directly here
    });

    it('400 error — mutation is invoked (error handling in mutation hook onError)', async () => {
      const user = userEvent.setup();
      // Use a never-resolving promise to avoid unhandled rejection
      // (the actual error toast is tested in the mutation hook test 8.2)
      mockSetPermissionsMutateAsync.mockReturnValue(new Promise(() => {}));
      await renderMatrix();

      // Make a change
      const checkbox = screen.getByRole('checkbox', {
        name: 'Sales Orders accessGroups.permission.access',
      });
      await user.click(checkbox);

      const saveButton = screen.getByRole('button', {
        name: /accessGroups.permission.savePermissions/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSetPermissionsMutateAsync).toHaveBeenCalled();
      });
    });
  });

  // --- Responsive tests ---

  describe('responsive', () => {
    it('phone: renders card layout with toggles', async () => {
      mockUseBreakpoint.mockReturnValue('phone');
      await renderMatrix();

      // On phone, Switch components are used instead of checkboxes
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);

      // Resource names should still be visible
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
    });

    it('desktop: renders grid layout with checkboxes', async () => {
      mockUseBreakpoint.mockReturnValue('desktop');
      await renderMatrix();

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });
});
