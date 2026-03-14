import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

// Mock TanStack Router
const mockRouterState = { location: { pathname: '/finance/journals' } };

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: (opts?: { select?: (s: typeof mockRouterState) => unknown }) => {
    if (opts?.select) return opts.select(mockRouterState);
    return mockRouterState;
  },
}));

// Mock company switcher (tested separately)
vi.mock('./company-switcher', () => ({
  CompanySwitcher: ({ isCollapsed }: { isCollapsed: boolean }) => (
    <div data-testid="company-switcher" data-collapsed={isCollapsed} />
  ),
}));

import { AppSidebar } from './app-sidebar';

// --- Fixtures ---

const makePermissions = (enabledModules: string[], isSuperAdmin = false) => ({
  userId: 'user-1',
  companyId: 'company-1',
  role: 'ADMIN',
  isSuperAdmin,
  accessGroups: [],
  modules: {},
  fieldOverrides: {},
  enabledModules,
});

describe('AppSidebar', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeCompanyId: null,
      permissions: null,
      isAuthenticated: false,
      isLoading: false,
      rememberMe: false,
    });
    useSidebarStore.setState({
      isOpen: true,
      isCollapsed: false,
      mode: 'expanded',
      isHoverExpanded: false,
      activeModule: null,
      expandedGroups: [],
    });
  });

  it('renders navigation landmark with aria-label', () => {
    useAuthStore.setState({ permissions: makePermissions(['finance']) });
    render(<AppSidebar />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'navigation:sidebar');
  });

  it('renders module groups filtered by enabled modules', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance', 'sales']),
    });
    render(<AppSidebar />);

    // Finance and Sales groups should be visible
    expect(screen.getByText('navigation:finance')).toBeInTheDocument();
    expect(screen.getByText('navigation:sales')).toBeInTheDocument();

    // Other modules should NOT be visible
    expect(screen.queryByText('navigation:inventory')).not.toBeInTheDocument();
    expect(screen.queryByText('navigation:hr')).not.toBeInTheDocument();
  });

  it('does not render modules the user lacks permission for', () => {
    useAuthStore.setState({
      permissions: makePermissions(['system']),
    });
    render(<AppSidebar />);

    expect(screen.getByText('navigation:system')).toBeInTheDocument();
    expect(screen.queryByText('navigation:finance')).not.toBeInTheDocument();
    expect(screen.queryByText('navigation:sales')).not.toBeInTheDocument();
  });

  it('SUPER_ADMIN sees all modules regardless of enabledModules', () => {
    useAuthStore.setState({
      permissions: makePermissions([], true),
    });
    render(<AppSidebar />);

    // All 11 modules should be rendered
    expect(screen.getByText('navigation:system')).toBeInTheDocument();
    expect(screen.getByText('navigation:finance')).toBeInTheDocument();
    expect(screen.getByText('navigation:ar')).toBeInTheDocument();
    expect(screen.getByText('navigation:ap')).toBeInTheDocument();
    expect(screen.getByText('navigation:sales')).toBeInTheDocument();
    expect(screen.getByText('navigation:purchasing')).toBeInTheDocument();
    expect(screen.getByText('navigation:inventory')).toBeInTheDocument();
    expect(screen.getByText('navigation:crm')).toBeInTheDocument();
    expect(screen.getByText('navigation:hr')).toBeInTheDocument();
    expect(screen.getByText('navigation:manufacturing')).toBeInTheDocument();
    expect(screen.getByText('navigation:reporting')).toBeInTheDocument();
  });

  it('expanding a group shows sub-items', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });
    useSidebarStore.setState({ expandedGroups: [] });

    render(<AppSidebar />);

    // Before expanding, sub-items are hidden (max-h-0)
    const groupButton = screen.getByText('navigation:finance');
    await user.click(groupButton);

    // After clicking, the store's toggleGroup should be called
    expect(useSidebarStore.getState().expandedGroups).toContain('finance');
  });

  it('shows sub-items when group is expanded', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });
    useSidebarStore.setState({ expandedGroups: ['finance'] });

    render(<AppSidebar />);

    // Sub-items should be in the DOM
    expect(screen.getByText('navigation:finance.chartOfAccounts')).toBeInTheDocument();
    expect(screen.getByText('navigation:finance.journals')).toBeInTheDocument();
    expect(screen.getByText('navigation:finance.periods')).toBeInTheDocument();
  });

  it('active route item has aria-current="page"', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });
    useSidebarStore.setState({ expandedGroups: ['finance'] });

    render(<AppSidebar />);

    // The router state is mocked to /finance/journals
    const activeLink = screen.getByText('navigation:finance.journals').closest('a');
    expect(activeLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders collapse toggle in expanded mode', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });

    render(<AppSidebar />);

    const collapseBtn = screen.getByRole('button', {
      name: 'navigation:collapse',
    });
    expect(collapseBtn).toBeInTheDocument();
  });

  it('renders expand toggle in collapsed mode', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });
    useSidebarStore.setState({ isCollapsed: true });

    render(<AppSidebar />);

    const expandBtn = screen.getByRole('button', {
      name: 'navigation:expand',
    });
    expect(expandBtn).toBeInTheDocument();
  });

  it('hides collapse/expand toggle when forceExpanded', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });

    render(<AppSidebar forceExpanded />);

    expect(screen.queryByRole('button', { name: 'navigation:collapse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'navigation:expand' })).not.toBeInTheDocument();
  });

  it('clicking collapse toggle calls collapse action', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });
    useSidebarStore.setState({ isCollapsed: false });

    render(<AppSidebar />);

    const collapseBtn = screen.getByRole('button', {
      name: 'navigation:collapse',
    });
    await user.click(collapseBtn);

    expect(useSidebarStore.getState().isCollapsed).toBe(true);
  });

  it('renders company switcher', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });

    render(<AppSidebar />);

    expect(screen.getByTestId('company-switcher')).toBeInTheDocument();
  });

  it('passes isCollapsed to company switcher', () => {
    useAuthStore.setState({
      permissions: makePermissions(['finance']),
    });
    useSidebarStore.setState({ isCollapsed: true });

    render(<AppSidebar />);

    expect(screen.getByTestId('company-switcher')).toHaveAttribute('data-collapsed', 'true');
  });
});
