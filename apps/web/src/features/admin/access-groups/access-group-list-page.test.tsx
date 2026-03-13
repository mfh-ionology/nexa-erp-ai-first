import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AccessGroup } from './api/types';

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

// --- Mock useAccessGroups ---
const mockFetchNextPage = vi.fn();
const mockUseAccessGroups = vi.fn();

vi.mock('./api/use-access-groups', () => ({
  useAccessGroups: (...args: unknown[]) => mockUseAccessGroups(...args),
}));

// --- Test data ---
const testAccessGroups: AccessGroup[] = [
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
];

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseAccessGroups.mockReturnValue({
    data: { data: testAccessGroups },
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
  const { AccessGroupListPage } = await import('./access-group-list-page');
  return render(<AccessGroupListPage />);
}

describe('AccessGroupListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Rendering tests ---

  describe('rendering', () => {
    it('renders page title "Access Groups" via t("accessGroups.title")', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('accessGroups.title');
    }, 15000);

    it('renders breadcrumbs: System > Access Groups', async () => {
      await renderPage();

      const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(breadcrumbNav).toBeInTheDocument();
      // "navigation:system" in breadcrumbs
      expect(screen.getByText('navigation:system')).toBeInTheDocument();
    });

    it('renders data table with 5 columns (code, name, system, userCount, created)', async () => {
      await renderPage();

      expect(screen.getByText('accessGroups.column.code')).toBeInTheDocument();
      expect(screen.getByText('accessGroups.column.name')).toBeInTheDocument();
      expect(screen.getByText('accessGroups.column.system')).toBeInTheDocument();
      expect(screen.getByText('accessGroups.column.userCount')).toBeInTheDocument();
      expect(screen.getByText('accessGroups.column.created')).toBeInTheDocument();
    });

    it('[+ New] button renders and navigates to /system/access-groups/new', async () => {
      const user = userEvent.setup();
      await renderPage();

      const newButton = screen.getByText('new');
      expect(newButton).toBeInTheDocument();

      await user.click(newButton);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/system/access-groups/new' }),
      );
    });

    it('system badge renders on system groups', async () => {
      await renderPage();

      // The system group (FULL_ACCESS) should have a badge
      expect(screen.getByText('accessGroups.systemBadge')).toBeInTheDocument();
    });

    it('renders access group data in the table', async () => {
      await renderPage();

      expect(screen.getByText('FULL_ACCESS')).toBeInTheDocument();
      expect(screen.getByText('Full Access')).toBeInTheDocument();
      expect(screen.getByText('SALES_MGR')).toBeInTheDocument();
      expect(screen.getByText('Sales Manager')).toBeInTheDocument();
    });
  });

  // --- Search tests ---

  describe('search', () => {
    it('search input renders with placeholder', async () => {
      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      expect(searchInput).toBeInTheDocument();
    });

    it('typing triggers debounced search (300ms)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      await user.type(searchInput, 'sales');

      // Advance past debounce (300ms) wrapped in act for state update
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // The hook should have been called with search param
      const lastCall = mockUseAccessGroups.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ search: 'sales' }));

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
    it('clicking a row navigates to /system/access-groups/:id', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Click on a table row content
      const row = screen.getByText('FULL_ACCESS').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/system/access-groups/ag-1' }),
      );
    });
  });

  // --- Responsive tests ---

  describe('responsive', () => {
    it('phone breakpoint: renders mobile cards', async () => {
      mockUseBreakpoint.mockReturnValue('phone');
      await renderPage();

      const cards = screen.getAllByRole('article');
      expect(cards.length).toBe(testAccessGroups.length);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('desktop: renders data table', async () => {
      mockUseBreakpoint.mockReturnValue('desktop');
      await renderPage();

      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });
});
