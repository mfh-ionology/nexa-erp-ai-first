import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { AccessGroup } from '../../access-groups/api/types';
import type { UserAccessGroupAssignment } from '../api/types';

// --- Polyfill scrollIntoView for jsdom (used by cmdk) ---
Element.prototype.scrollIntoView = vi.fn();

// --- Mock useBreakpoint ---
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// --- Mock API client ---
const mockApiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      accessGroups: (params?: Record<string, unknown>) =>
        params
          ? ['system', 'access-groups', params]
          : ['system', 'access-groups'],
    },
  },
}));

// --- Mock auth store (authenticated by default) ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Test data ---
const testGroups: AccessGroup[] = [
  {
    id: 'ag-1',
    code: 'FULL_ACCESS',
    name: 'Full Access',
    description: 'Full system access',
    isSystem: true,
    isActive: true,
    userCount: 3,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'ag-2',
    code: 'SALES_MGR',
    name: 'Sales Manager',
    description: 'Sales module access',
    isSystem: false,
    isActive: true,
    userCount: 5,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'ag-3',
    code: 'FINANCE_VIEWER',
    name: 'Finance Viewer',
    description: null,
    isSystem: false,
    isActive: true,
    userCount: 2,
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-03T00:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// Dynamic import after mocks
async function renderCombobox(props: {
  assignedGroupIds?: string[];
  onAdd?: (group: UserAccessGroupAssignment) => void;
} = {}) {
  const { AccessGroupCombobox } = await import('./access-group-combobox');
  const defaultOnAdd = vi.fn();
  return {
    result: render(
      <AccessGroupCombobox
        assignedGroupIds={props.assignedGroupIds ?? []}
        onAdd={props.onAdd ?? defaultOnAdd}
      />,
      { wrapper: createWrapper() },
    ),
    onAdd: props.onAdd ?? defaultOnAdd,
  };
}

describe('AccessGroupCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    mockApiGet.mockResolvedValue({ data: testGroups });
  });

  // --- Rendering tests ---

  describe('rendering', () => {
    it('renders add group button', async () => {
      await renderCombobox();

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      expect(trigger).toBeInTheDocument();
    });

    it('renders combobox ARIA attributes', async () => {
      await renderCombobox();

      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
    });
  });

  // --- Opening the popover ---

  describe('popover interaction', () => {
    it('clicking the trigger opens the popover with group list', async () => {
      const user = userEvent.setup();
      await renderCombobox();

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      await user.click(trigger);

      // All groups should be visible
      expect(screen.getByText('Full Access')).toBeInTheDocument();
      expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      expect(screen.getByText('Finance Viewer')).toBeInTheDocument();
    });

    it('filters out already-assigned groups', async () => {
      const user = userEvent.setup();
      await renderCombobox({ assignedGroupIds: ['ag-1'] });

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      await user.click(trigger);

      // ag-1 (Full Access) should NOT be shown
      expect(screen.queryByText('Full Access')).not.toBeInTheDocument();
      // Others should still be visible
      expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      expect(screen.getByText('Finance Viewer')).toBeInTheDocument();
    });

    it('filters groups via type-ahead search', async () => {
      const user = userEvent.setup();
      await renderCombobox();

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      await user.click(trigger);

      // Type in the search input
      const searchInput = screen.getByPlaceholderText('users.accessGroups.searchPlaceholder');
      await user.type(searchInput, 'sales');

      // Only Sales Manager should be visible
      expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      expect(screen.queryByText('Full Access')).not.toBeInTheDocument();
      expect(screen.queryByText('Finance Viewer')).not.toBeInTheDocument();
    });

    it('shows empty state when search matches nothing', async () => {
      const user = userEvent.setup();
      await renderCombobox();

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      await user.click(trigger);

      const searchInput = screen.getByPlaceholderText('users.accessGroups.searchPlaceholder');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('users.accessGroups.noGroupsAvailable')).toBeInTheDocument();
    });
  });

  // --- Selection ---

  describe('selection', () => {
    it('selecting a group calls onAdd with UserAccessGroupAssignment shape', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      await renderCombobox({ onAdd });

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      await user.click(trigger);

      // Click on Sales Manager
      const item = screen.getByText('Sales Manager');
      await user.click(item);

      expect(onAdd).toHaveBeenCalledTimes(1);
      const addedGroup = onAdd.mock.calls[0]![0] as UserAccessGroupAssignment;
      expect(addedGroup.id).toBe('ag-2');
      expect(addedGroup.code).toBe('SALES_MGR');
      expect(addedGroup.name).toBe('Sales Manager');
      expect(addedGroup.isSystem).toBe(false);
    });

    it('selecting a group shows description when available', async () => {
      const user = userEvent.setup();
      await renderCombobox();

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      await user.click(trigger);

      // Sales Manager has a description
      expect(screen.getByText('Sales module access')).toBeInTheDocument();
    });
  });

  // --- Responsive ---

  describe('responsive', () => {
    it('phone breakpoint: renders Sheet instead of Popover', async () => {
      mockUseBreakpoint.mockReturnValue('phone');
      const user = userEvent.setup();
      await renderCombobox();

      const trigger = screen.getByRole('button', { name: 'users.accessGroups.addGroup' });
      await user.click(trigger);

      // Sheet dialog should be present with the title inside
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText('users.accessGroups.addGroup')).toBeInTheDocument();
    });

    it('desktop: uses Popover', async () => {
      mockUseBreakpoint.mockReturnValue('desktop');
      await renderCombobox();

      // The combobox role wraps the popover trigger on desktop
      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeInTheDocument();
    });
  });
});
