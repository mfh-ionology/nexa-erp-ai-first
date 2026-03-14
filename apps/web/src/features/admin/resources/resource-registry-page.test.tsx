import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Resource } from './api/use-resources';

// --- Mock useBreakpoint ---
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// --- Mock TanStack Router ---
vi.mock('@tanstack/react-router', () => ({
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// --- Mock Shadcn Select (Radix portals don't work in jsdom) ---
const { MockSelectCtx } = vi.hoisted(() => {
  const React = require('react');
  return {
    MockSelectCtx: React.createContext({
      onValueChange: undefined as ((v: string) => void) | undefined,
    }),
  };
});

vi.mock('@/components/ui/select', () => {
  const React = require('react');
  return {
    Select: (props: { children: unknown; value?: string; onValueChange?: (v: string) => void }) =>
      React.createElement(
        MockSelectCtx.Provider,
        { value: { onValueChange: props.onValueChange } },
        props.children,
      ),
    SelectTrigger: (props: { children: unknown; 'aria-label'?: string }) =>
      React.createElement(
        'button',
        { role: 'combobox', 'aria-label': props['aria-label'] },
        props.children,
      ),
    SelectContent: (props: { children: unknown }) =>
      React.createElement('div', null, props.children),
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
    SelectValue: (props: { placeholder?: string }) =>
      React.createElement('span', null, props.placeholder),
  };
});

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Mock useResourcesInfinite ---
const mockFetchNextPage = vi.fn();
const mockUseResourcesInfinite = vi.fn();

vi.mock('./api/use-resources', () => ({
  useResourcesInfinite: (...args: unknown[]) => mockUseResourcesInfinite(...args),
}));

// --- Test data ---
const testResources: Resource[] = [
  {
    id: '1',
    code: 'finance.journals.list',
    name: 'Journal Entries',
    module: 'finance',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: 'BookOpen',
    description: 'View journal entries',
    isActive: true,
  },
  {
    id: '2',
    code: 'sales.orders.list',
    name: 'Sales Orders',
    module: 'sales',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: 'ShoppingCart',
    description: 'View sales orders',
    isActive: true,
  },
  {
    id: '3',
    code: 'finance.balanceSheet',
    name: 'Balance Sheet',
    module: 'finance',
    type: 'REPORT',
    parentCode: null,
    sortOrder: 10,
    icon: 'BarChart',
    description: 'Balance sheet report',
    isActive: true,
  },
];

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseResourcesInfinite.mockReturnValue({
    data: { data: testResources },
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
  const { ResourceRegistryPage } = await import('./resource-registry-page');
  return render(<ResourceRegistryPage />);
}

describe('ResourceRegistryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Page rendering tests ---

  describe('rendering', () => {
    it('renders page title via t("resources.title")', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('resources.title');
    }, 15000);

    it('renders breadcrumbs: System > Resource Registry', async () => {
      await renderPage();

      // "navigation:system" appears in both breadcrumb and module filter option
      const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(within(breadcrumbNav).getByText('navigation:system')).toBeInTheDocument();

      // The second breadcrumb (current page) is the title
      const breadcrumbLinks = screen.getAllByText('resources.title');
      expect(breadcrumbLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('renders data table with 5 columns', async () => {
      await renderPage();

      // Column headers use i18n keys
      expect(screen.getByText('resources.column.code')).toBeInTheDocument();
      expect(screen.getByText('resources.column.name')).toBeInTheDocument();
      expect(screen.getByText('resources.column.module')).toBeInTheDocument();
      expect(screen.getByText('resources.column.type')).toBeInTheDocument();
      expect(screen.getByText('resources.column.sortOrder')).toBeInTheDocument();
    });

    it('renders resource data in the table', async () => {
      await renderPage();

      expect(screen.getByText('finance.journals.list')).toBeInTheDocument();
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
      expect(screen.getByText('sales.orders.list')).toBeInTheDocument();
      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
    });

    it('[+ New] button is NOT rendered (canCreate={false})', async () => {
      await renderPage();

      // The "new" button text should not be present
      expect(screen.queryByText('new')).not.toBeInTheDocument();
    });

    it('no row actions (edit/delete) in the table', async () => {
      await renderPage();

      // No edit or delete buttons
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('no batch action bar', async () => {
      await renderPage();

      // No checkbox column (no batch actions = no selection)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  // --- Search tests ---

  describe('search', () => {
    it('search input renders with placeholder', async () => {
      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      expect(searchInput).toBeInTheDocument();
    });

    it('typing in search updates the search state', async () => {
      const user = userEvent.setup();
      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      await user.type(searchInput, 'journal');

      expect(searchInput).toHaveValue('journal');
    });

    it('search value is passed to useResourcesInfinite hook (debounced)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      await user.type(searchInput, 'journal');

      // Advance past debounce (300ms) wrapped in act for state update
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // The hook should have been called with search param
      const lastCall = mockUseResourcesInfinite.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ search: 'journal' }));

      vi.useRealTimers();
    });
  });

  // --- Filter tests ---

  describe('filters', () => {
    it('module filter dropdown renders', async () => {
      await renderPage();

      const moduleFilter = screen.getByRole('combobox', {
        name: 'resources.filter.module',
      });
      expect(moduleFilter).toBeInTheDocument();
    });

    it('type filter dropdown renders', async () => {
      await renderPage();

      const typeFilter = screen.getByRole('combobox', {
        name: 'resources.filter.type',
      });
      expect(typeFilter).toBeInTheDocument();
    });

    it('selecting module "finance" filters the query params', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Target the option button (role="option") to avoid matching table cells
      const financeOption = screen.getByRole('option', { name: 'navigation:finance' });
      await user.click(financeOption);

      // The hook should have been called with module param
      const lastCall = mockUseResourcesInfinite.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ module: 'finance' }));
    });

    it('selecting type "PAGE" filters the query params', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Target the option button to avoid matching Badge elements in the table
      const pageOption = screen.getByRole('option', { name: 'resources.type.page' });
      await user.click(pageOption);

      // The hook should have been called with type param
      const lastCall = mockUseResourcesInfinite.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ type: 'PAGE' }));
    });

    it('both filters compose with AND logic (both passed to hook)', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Select module via option role
      const financeOption = screen.getByRole('option', { name: 'navigation:finance' });
      await user.click(financeOption);

      // Select type via option role
      const pageOption = screen.getByRole('option', { name: 'resources.type.page' });
      await user.click(pageOption);

      // The hook should have both params
      const lastCall = mockUseResourcesInfinite.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ module: 'finance', type: 'PAGE' }));
    });
  });

  // --- Pagination tests ---

  describe('pagination', () => {
    it('"Load More" button renders when hasMore is true', async () => {
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

    it('"Load More" is hidden when hasMore is false', async () => {
      setupMockQuery({ hasNextPage: false });
      await renderPage();

      expect(screen.queryByText('loadMore')).not.toBeInTheDocument();
    });
  });

  // --- Read-only enforcement tests ---

  describe('read-only enforcement', () => {
    it('row click does nothing (no navigation)', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Click on a table row
      const row = screen.getByText('finance.journals.list').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      // No navigation should occur (no link/routing)
      // Verify no navigation-related elements appeared
      expect(row!.closest('a')).toBeNull();
    });

    it('no create/edit/delete controls in the DOM', async () => {
      await renderPage();

      // No create button
      expect(screen.queryByText('new')).not.toBeInTheDocument();

      // No edit/delete buttons
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

      // No checkbox for batch selection
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  // --- Responsive tests ---

  describe('responsive', () => {
    it('phone breakpoint: renders mobile cards instead of table', async () => {
      mockUseBreakpoint.mockReturnValue('phone');
      await renderPage();

      // Cards are rendered (article role from EntityListPage card view)
      const cards = screen.getAllByRole('article');
      expect(cards.length).toBe(testResources.length);

      // No table element
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('desktop breakpoint: renders data table', async () => {
      mockUseBreakpoint.mockReturnValue('desktop');
      await renderPage();

      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  // --- Accessibility tests ---

  describe('accessibility', () => {
    it('page has aria-label on main element', async () => {
      await renderPage();

      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('aria-label', 'resources.title');
    });

    it('search input has accessible name', async () => {
      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      expect(searchInput).toBeInTheDocument();
    });

    it('filter dropdowns have accessible names', async () => {
      await renderPage();

      expect(screen.getByRole('combobox', { name: 'resources.filter.module' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'resources.filter.type' })).toBeInTheDocument();
    });

    it('column headers are translatable', async () => {
      await renderPage();

      // Column headers use i18n keys (mock returns key as value)
      expect(screen.getByText('resources.column.code')).toBeInTheDocument();
      expect(screen.getByText('resources.column.name')).toBeInTheDocument();
      expect(screen.getByText('resources.column.module')).toBeInTheDocument();
      expect(screen.getByText('resources.column.type')).toBeInTheDocument();
      expect(screen.getByText('resources.column.sortOrder')).toBeInTheDocument();
    });
  });
});
