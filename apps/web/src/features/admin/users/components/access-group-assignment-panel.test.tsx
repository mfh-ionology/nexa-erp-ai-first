import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { UserAccessGroupAssignment } from '../api/types';

// --- Polyfill scrollIntoView for jsdom (used by cmdk in combobox) ---
Element.prototype.scrollIntoView = vi.fn();

// --- Mock sonner toast ---
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock useUserAccessGroups query ---
const mockUseUserAccessGroups = vi.fn();
// --- Mock useAssignAccessGroups mutation ---
const mockMutate = vi.fn();
const mockAssignMutation = {
  mutate: mockMutate,
  isPending: false,
};

vi.mock('../api/use-user-access-groups', () => ({
  useUserAccessGroups: (...args: unknown[]) => mockUseUserAccessGroups(...args),
  useAssignAccessGroups: () => mockAssignMutation,
}));

// --- Mock AccessGroupCombobox (to isolate panel tests) ---
// Instead of rendering the real combobox (which has cmdk complexity),
// provide a simple mock that calls onAdd when clicked.
vi.mock('./access-group-combobox', () => ({
  AccessGroupCombobox: (props: {
    assignedGroupIds: string[];
    onAdd: (group: UserAccessGroupAssignment) => void;
  }) => {
    const React = require('react');
    return React.createElement(
      'button',
      {
        'data-testid': 'mock-combobox',
        onClick: () =>
          props.onAdd({
            id: 'ag-new',
            code: 'NEW_GROUP',
            name: 'New Group',
            description: null,
            isSystem: false,
            assignedBy: '',
            assignedAt: new Date().toISOString(),
          }),
      },
      'Add Group',
    );
  },
}));

// --- Test data ---
const testAssignments: UserAccessGroupAssignment[] = [
  {
    id: 'ag-1',
    code: 'FULL_ACCESS',
    name: 'Full Access',
    description: 'Full system access',
    isSystem: true,
    assignedBy: 'Admin User',
    assignedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'ag-2',
    code: 'SALES_MGR',
    name: 'Sales Manager',
    description: 'Sales module access',
    isSystem: false,
    assignedBy: 'Admin User',
    assignedAt: '2025-01-02T00:00:00Z',
  },
];

function setupMockQuery(groups: UserAccessGroupAssignment[] | null, overrides: Record<string, unknown> = {}) {
  mockUseUserAccessGroups.mockReturnValue({
    data: groups,
    isLoading: false,
    isError: groups === null,
    ...overrides,
  });
}

// Dynamic import after mocks
async function renderPanel(userId = 'user-1') {
  const { AccessGroupAssignmentPanel } = await import('./access-group-assignment-panel');
  return render(<AccessGroupAssignmentPanel userId={userId} />);
}

describe('AccessGroupAssignmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssignMutation.mutate = mockMutate;
    mockAssignMutation.isPending = false;
    setupMockQuery(testAssignments);
  });

  // --- Rendering tests ---

  describe('rendering', () => {
    it('renders panel title', async () => {
      await renderPanel();

      expect(screen.getByText('users.accessGroups.title')).toBeInTheDocument();
    });

    it('renders assigned group tags', async () => {
      await renderPanel();

      expect(screen.getByText('Full Access')).toBeInTheDocument();
      expect(screen.getByText('Sales Manager')).toBeInTheDocument();
    });

    it('renders system badge on system groups', async () => {
      await renderPanel();

      expect(screen.getByText('accessGroups.systemBadge')).toBeInTheDocument();
    });

    it('renders remove buttons with aria-labels', async () => {
      await renderPanel();

      const removeButtons = screen.getAllByRole('button', { name: 'users.accessGroups.removeLabel' });
      expect(removeButtons).toHaveLength(2); // One per assigned group
    });

    it('renders group tags as a list', async () => {
      await renderPanel();

      const list = screen.getByRole('list', { name: 'users.accessGroups.title' });
      expect(list).toBeInTheDocument();
    });
  });

  // --- Empty state ---

  describe('empty state', () => {
    it('shows empty state when no groups are assigned', async () => {
      setupMockQuery([]);
      await renderPanel();

      expect(screen.getByText('users.accessGroups.emptyState')).toBeInTheDocument();
    });

    it('shows combobox in empty state for adding first group', async () => {
      setupMockQuery([]);
      await renderPanel();

      // The mock combobox should be rendered (at least one instance for empty state)
      const comboboxes = screen.getAllByTestId('mock-combobox');
      expect(comboboxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Dirty tracking ---

  describe('dirty tracking', () => {
    it('save button is disabled when no changes have been made', async () => {
      await renderPanel();

      const saveButton = screen.getByRole('button', { name: /users.accessGroups.save/i });
      expect(saveButton).toBeDisabled();
    });

    it('removing a group enables the save button', async () => {
      const user = userEvent.setup();
      await renderPanel();

      // Remove Sales Manager (non-system group)
      const removeButtons = screen.getAllByRole('button', { name: 'users.accessGroups.removeLabel' });
      await user.click(removeButtons[removeButtons.length - 1]!);

      const saveButton = screen.getByRole('button', { name: /users.accessGroups.save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('adding a group enables the save button', async () => {
      const user = userEvent.setup();
      await renderPanel();

      // Click mock combobox to add a group
      const addButton = screen.getAllByTestId('mock-combobox')[0]!;
      await user.click(addButton);

      const saveButton = screen.getByRole('button', { name: /users.accessGroups.save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('save button is disabled when all groups are removed (0 groups)', async () => {
      const user = userEvent.setup();
      setupMockQuery([testAssignments[0]!]); // Only one group
      await renderPanel();

      // Remove the only group
      const removeButton = screen.getByRole('button', { name: 'users.accessGroups.removeLabel' });
      await user.click(removeButton);

      // Even though dirty, save should be disabled because 0 groups
      const saveButton = screen.getByRole('button', { name: /users.accessGroups.save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  // --- Remove interaction ---

  describe('remove group', () => {
    it('clicking remove button removes the group from display', async () => {
      const user = userEvent.setup();
      await renderPanel();

      expect(screen.getByText('Sales Manager')).toBeInTheDocument();

      // Remove Sales Manager
      const removeButtons = screen.getAllByRole('button', { name: 'users.accessGroups.removeLabel' });
      await user.click(removeButtons[removeButtons.length - 1]!);

      expect(screen.queryByText('Sales Manager')).not.toBeInTheDocument();
      expect(screen.getByText('Full Access')).toBeInTheDocument();
    });
  });

  // --- Save ---

  describe('save', () => {
    it('clicking save calls mutation with full accessGroupIds array', async () => {
      const user = userEvent.setup();
      await renderPanel();

      // Add a new group to make dirty
      const addButton = screen.getAllByTestId('mock-combobox')[0]!;
      await user.click(addButton);

      const saveButton = screen.getByRole('button', { name: /users.accessGroups.save/i });
      await user.click(saveButton);

      expect(mockMutate).toHaveBeenCalledWith({
        accessGroupIds: ['ag-1', 'ag-2', 'ag-new'],
      });
    });

    it('save after removing a group sends remaining group IDs', async () => {
      const user = userEvent.setup();
      await renderPanel();

      // Remove Sales Manager
      const removeButtons = screen.getAllByRole('button', { name: 'users.accessGroups.removeLabel' });
      await user.click(removeButtons[removeButtons.length - 1]!);

      const saveButton = screen.getByRole('button', { name: /users.accessGroups.save/i });
      await user.click(saveButton);

      expect(mockMutate).toHaveBeenCalledWith({
        accessGroupIds: ['ag-1'],
      });
    });
  });

  // --- Loading state ---

  describe('loading state', () => {
    it('renders loading skeletons when data is loading', async () => {
      setupMockQuery(null, { isLoading: true, isError: false });
      await renderPanel();

      // Should show loading title but no group tags
      expect(screen.getByText('users.accessGroups.title')).toBeInTheDocument();
      expect(screen.queryByText('Full Access')).not.toBeInTheDocument();
    });
  });

  // --- Error state ---

  describe('error state', () => {
    it('renders error message when query fails', async () => {
      setupMockQuery(null);
      await renderPanel();

      expect(screen.getByText('users.error.loadFailed')).toBeInTheDocument();
    });
  });
});
