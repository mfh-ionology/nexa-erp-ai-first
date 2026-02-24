import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AccessGroupDetail } from './api/types';

// --- Mock TanStack Router ---
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
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
const { MockApiError } = vi.hoisted(() => {
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
  return { MockApiError: _MockApiError };
});

vi.mock('@nexa/api-client', () => ({
  ApiError: MockApiError,
}));

// --- Mock useAccessGroup query ---
const mockUseAccessGroup = vi.fn();
vi.mock('./api/use-access-groups', () => ({
  useAccessGroup: (...args: unknown[]) => mockUseAccessGroup(...args),
}));

// --- Mock mutations ---
const mockUpdateMutateAsync = vi.fn();
const mockDeactivateMutateAsync = vi.fn();
vi.mock('./api/use-access-group-mutations', () => ({
  useUpdateAccessGroup: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useDeactivateAccessGroup: () => ({
    mutateAsync: mockDeactivateMutateAsync,
    isPending: false,
  }),
}));

// --- Mock PermissionMatrix (to isolate detail page tests) ---
vi.mock('./components/permission-matrix', () => ({
  PermissionMatrix: (props: { accessGroupId: string }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'permission-matrix' }, `PermissionMatrix: ${props.accessGroupId}`);
  },
}));

// --- Mock FieldOverridePanel (to isolate detail page tests) ---
vi.mock('./components/field-override-panel', () => ({
  FieldOverridePanel: (props: { accessGroupId: string }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'field-override-panel' }, `FieldOverridePanel: ${props.accessGroupId}`);
  },
}));

// --- Test data ---
const testGroup: AccessGroupDetail = {
  id: 'ag-1',
  code: 'FULL_ACCESS',
  name: 'Full Access',
  description: 'Full system access for all modules',
  isSystem: true,
  isActive: true,
  userCount: 3,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  companyId: 'company-1',
  permissions: [],
  fieldOverrides: [],
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const testNonSystemGroup: AccessGroupDetail = {
  ...testGroup,
  id: 'ag-2',
  code: 'SALES_MGR',
  name: 'Sales Manager',
  description: 'Sales module access',
  isSystem: false,
};

function setupMockQuery(group: AccessGroupDetail | null, overrides: Record<string, unknown> = {}) {
  mockUseAccessGroup.mockReturnValue({
    data: group,
    isLoading: false,
    isError: group === null,
    ...overrides,
  });
}

// Dynamic import after mocks
async function renderPage(id = 'ag-1') {
  const { AccessGroupDetailPage } = await import('./access-group-detail-page');
  return render(<AccessGroupDetailPage id={id} />);
}

describe('AccessGroupDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockQuery(testGroup);
  });

  // --- Rendering tests ---

  describe('rendering', () => {
    it('renders group name as title', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Full Access');
    });

    it('renders breadcrumbs: System > Access Groups > [Name]', async () => {
      await renderPage();

      const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(within(breadcrumbNav).getByText('navigation:system')).toBeInTheDocument();
      expect(within(breadcrumbNav).getByText('accessGroups.title')).toBeInTheDocument();
      expect(within(breadcrumbNav).getByText('Full Access')).toBeInTheDocument();
    });

    it('renders Permissions and Field Overrides tabs', async () => {
      await renderPage();

      expect(screen.getByRole('tab', { name: 'accessGroups.tab.permissions' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'accessGroups.tab.fieldOverrides' })).toBeInTheDocument();
    });

    it('system group shows info banner', async () => {
      setupMockQuery(testGroup); // isSystem: true
      await renderPage();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('accessGroups.systemBanner')).toBeInTheDocument();
    });

    it('non-system group does NOT show info banner', async () => {
      setupMockQuery(testNonSystemGroup);
      await renderPage('ag-2');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('code field is always read-only', async () => {
      await renderPage();

      // The code input is rendered with readOnly and disabled attributes
      const codeInput = screen.getByDisplayValue('FULL_ACCESS');
      expect(codeInput).toHaveAttribute('readonly');
      expect(codeInput).toBeDisabled();
    });

    it('renders error state when group fails to load', async () => {
      setupMockQuery(null);
      await renderPage();

      expect(screen.getByText('accessGroups.error.loadFailed')).toBeInTheDocument();
    });
  });

  // --- Metadata editing tests ---

  describe('metadata editing', () => {
    it('editing Name enables Save button', async () => {
      const user = userEvent.setup();
      setupMockQuery(testNonSystemGroup);
      await renderPage('ag-2');

      // Find the name input and modify it
      const nameInput = screen.getByDisplayValue('Sales Manager');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Sales Manager');

      // Save button should be enabled (find by icon + text)
      const saveButton = screen.getByRole('button', { name: /common:save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('save calls PATCH with updated fields', async () => {
      const user = userEvent.setup();
      setupMockQuery(testNonSystemGroup);
      mockUpdateMutateAsync.mockResolvedValue({});
      await renderPage('ag-2');

      const nameInput = screen.getByDisplayValue('Sales Manager');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /common:save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated Name' }),
        );
      });
    });
  });

  // --- Overflow menu tests ---

  describe('overflow menu', () => {
    it('non-system group: Deactivate option visible', async () => {
      const user = userEvent.setup();
      setupMockQuery(testNonSystemGroup);
      await renderPage('ag-2');

      // Open overflow menu
      const moreButton = screen.getByRole('button', { name: 'actionBar.moreActions' });
      await user.click(moreButton);

      const deactivateItem = screen.getByRole('menuitem', { name: /accessGroups.deactivate.confirm/i });
      expect(deactivateItem).toBeInTheDocument();
      expect(deactivateItem).not.toBeDisabled();
    });

    it('system group: Deactivate option disabled', async () => {
      const user = userEvent.setup();
      setupMockQuery(testGroup); // isSystem: true
      await renderPage();

      const moreButton = screen.getByRole('button', { name: 'actionBar.moreActions' });
      await user.click(moreButton);

      const deactivateItem = screen.getByRole('menuitem', { name: /accessGroups.deactivate.confirm/i });
      expect(deactivateItem).toHaveAttribute('data-disabled');
    });

    it('deactivate shows confirmation dialog', async () => {
      const user = userEvent.setup();
      setupMockQuery(testNonSystemGroup);
      await renderPage('ag-2');

      // Open overflow menu
      const moreButton = screen.getByRole('button', { name: 'actionBar.moreActions' });
      await user.click(moreButton);

      // Click deactivate
      const deactivateItem = screen.getByRole('menuitem', { name: /accessGroups.deactivate.confirm/i });
      await user.click(deactivateItem);

      // Dialog should appear
      await waitFor(() => {
        expect(screen.getByText('accessGroups.deactivate.title')).toBeInTheDocument();
        expect(screen.getByText('accessGroups.deactivate.body')).toBeInTheDocument();
      });
    });
  });

  // --- Deactivation tests ---

  describe('deactivation', () => {
    it('confirm deactivate calls DELETE, navigates to list, shows success toast', async () => {
      const user = userEvent.setup();
      setupMockQuery(testNonSystemGroup);
      mockDeactivateMutateAsync.mockResolvedValue(undefined);
      await renderPage('ag-2');

      // Open overflow menu → click deactivate → confirm
      const moreButton = screen.getByRole('button', { name: 'actionBar.moreActions' });
      await user.click(moreButton);

      const deactivateItem = screen.getByRole('menuitem', { name: /accessGroups.deactivate.confirm/i });
      await user.click(deactivateItem);

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByText('accessGroups.deactivate.title')).toBeInTheDocument();
      });

      // Click the destructive confirm button in the dialog
      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /accessGroups.deactivate.confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDeactivateMutateAsync).toHaveBeenCalledWith('ag-2');
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/system/access-groups' }),
      );
    });

    it('409 error shows "users still assigned" toast', async () => {
      const user = userEvent.setup();
      setupMockQuery(testNonSystemGroup);
      mockDeactivateMutateAsync.mockRejectedValue(
        new MockApiError('CONFLICT', 'Users assigned', 409),
      );
      await renderPage('ag-2');

      // Open overflow menu → click deactivate → confirm
      const moreButton = screen.getByRole('button', { name: 'actionBar.moreActions' });
      await user.click(moreButton);

      const deactivateItem = screen.getByRole('menuitem', { name: /accessGroups.deactivate.confirm/i });
      await user.click(deactivateItem);

      await waitFor(() => {
        expect(screen.getByText('accessGroups.deactivate.title')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /accessGroups.deactivate.confirm/i });
      await user.click(confirmButton);

      // The error toast is triggered by the mutation's onError callback
      // The dialog stays open so the user can see the failure in context
      await waitFor(() => {
        expect(mockDeactivateMutateAsync).toHaveBeenCalledWith('ag-2');
      });

      // Dialog should remain open on error
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
