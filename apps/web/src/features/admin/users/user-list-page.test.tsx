import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { UserListItem } from './api/types';

// --- Mock useBreakpoint ---
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// --- Mock TanStack Router ---
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Mock useUsers ---
const mockFetchNextPage = vi.fn();
const mockUseUsers = vi.fn();

vi.mock('./api/use-users', () => ({
  useUsers: (...args: unknown[]) => mockUseUsers(...args),
}));

// --- Test data ---
const testUsers: UserListItem[] = [
  {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'ADMIN',
    accessGroupCount: 2,
    isActive: true,
    lastLoginAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'user-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    role: 'STAFF',
    accessGroupCount: 1,
    isActive: false,
    lastLoginAt: null,
  },
];

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseUsers.mockReturnValue({
    data: { data: testUsers },
    fetchNextPage: mockFetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isSuccess: true,
    ...overrides,
  });
}

// Dynamic import after mocks are set up
async function renderPage() {
  const { UserListPage } = await import('./user-list-page');
  return render(<UserListPage />);
}

describe('UserListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Rendering tests ---

  describe('rendering', () => {
    it('renders page title "Users" via t("users.title")', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('users.title');
    });

    it('renders breadcrumbs: System > Users', async () => {
      await renderPage();

      const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(breadcrumbNav).toBeInTheDocument();
      expect(screen.getByText('navigation:system')).toBeInTheDocument();
    });

    it('renders data table with 6 columns (name, email, role, accessGroups, status, lastLogin)', async () => {
      await renderPage();

      expect(screen.getByText('users.column.name')).toBeInTheDocument();
      expect(screen.getByText('users.column.email')).toBeInTheDocument();
      expect(screen.getByText('users.column.role')).toBeInTheDocument();
      expect(screen.getByText('users.column.accessGroups')).toBeInTheDocument();
      expect(screen.getByText('users.column.status')).toBeInTheDocument();
      expect(screen.getByText('users.column.lastLogin')).toBeInTheDocument();
    });

    it('does not render a [+ New] button (canCreate=false)', async () => {
      await renderPage();

      expect(screen.queryByText('new')).not.toBeInTheDocument();
    });

    it('renders user data in the table', async () => {
      await renderPage();

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('renders role badges via translation keys', async () => {
      await renderPage();

      expect(screen.getByText('users.role.ADMIN')).toBeInTheDocument();
      expect(screen.getByText('users.role.STAFF')).toBeInTheDocument();
    });

    it('renders status badges for active and inactive users', async () => {
      await renderPage();

      expect(screen.getByText('users.status.active')).toBeInTheDocument();
      expect(screen.getByText('users.status.inactive')).toBeInTheDocument();
    });

    it('renders "Never" for null lastLoginAt', async () => {
      await renderPage();

      expect(screen.getByText('users.lastLogin.never')).toBeInTheDocument();
    });

    it('renders loading state', async () => {
      setupMockQuery({ isLoading: true, data: undefined, isSuccess: false });
      await renderPage();

      // Loading state should be visible (no data rows)
      expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
    });

    it('renders empty state when no users', async () => {
      setupMockQuery({ data: { data: [] } });
      await renderPage();

      expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
    });
  });

  // --- Search tests ---

  describe('search', () => {
    it('search input renders', async () => {
      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      expect(searchInput).toBeInTheDocument();
    });

    it('typing triggers debounced search (300ms)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      await user.type(searchInput, 'john');

      // Advance past debounce (300ms) wrapped in act for state update
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // The hook should have been called with search param
      const lastCall = mockUseUsers.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ search: 'john' }));

      vi.useRealTimers();
    });
  });

  // --- Pagination tests ---

  describe('pagination', () => {
    it('"Load More" visible when hasMore is true', async () => {
      setupMockQuery({ hasNextPage: true });
      await renderPage();

      expect(screen.getByText('loadMore')).toBeInTheDocument();
    });

    it('clicking "Load More" calls fetchNextPage', async () => {
      const user = userEvent.setup();
      setupMockQuery({ hasNextPage: true });
      await renderPage();

      await user.click(screen.getByText('loadMore'));

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('"Load More" hidden when hasMore is false', async () => {
      setupMockQuery({ hasNextPage: false });
      await renderPage();

      expect(screen.queryByText('loadMore')).not.toBeInTheDocument();
    });
  });

  // --- Row click tests ---

  describe('row click', () => {
    it('clicking a row navigates to /system/users/:id', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Click on a table row content
      const row = screen.getByText('john@example.com').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/system/users/user-1' }),
      );
    });
  });

  // --- Responsive tests ---

  describe('responsive', () => {
    it('phone breakpoint: renders mobile cards', async () => {
      mockUseBreakpoint.mockReturnValue('phone');
      await renderPage();

      const cards = screen.getAllByRole('article');
      expect(cards.length).toBe(testUsers.length);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('desktop: renders data table', async () => {
      mockUseBreakpoint.mockReturnValue('desktop');
      await renderPage();

      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });
});
