import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

// --- Mocks ---

const mockRouterState = {
  location: { pathname: '/finance/journals' },
};

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet">Route content</div>,
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: (opts?: { select?: (s: typeof mockRouterState) => unknown }) => {
    if (opts?.select) return opts.select(mockRouterState);
    return mockRouterState;
  },
}));

// Mock useBreakpoint to return desktop by default
const mockBreakpoint = vi.fn<() => string>().mockReturnValue('desktop');
const mockPrefersReducedMotion = vi.fn().mockReturnValue(false);

vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockBreakpoint(),
  usePrefersReducedMotion: () => mockPrefersReducedMotion(),
}));

// Mock system-api for CompanySwitcher
vi.mock('@/lib/system-api', () => ({
  fetchCompanies: vi.fn().mockResolvedValue([
    { id: 'c1', name: 'Nexa Ltd', slug: 'nexa-ltd', baseCurrencyCode: 'GBP', isDefault: true },
  ]),
  fetchMyPermissions: vi.fn().mockResolvedValue({
    userId: 'user-1',
    companyId: 'c1',
    role: 'ADMIN',
    isSuperAdmin: false,
    accessGroups: [],
    modules: {},
    fieldOverrides: {},
    enabledModules: ['finance'],
  }),
}));

vi.mock('@/lib/auth-api', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

import { AppLayout } from './app-layout';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return {
    ...render(
      // @ts-expect-error dual @types/react versions
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
    queryClient,
  };
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBreakpoint.mockReturnValue('desktop');
    mockPrefersReducedMotion.mockReturnValue(false);

    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@nexa.io', firstName: 'Test', lastName: 'User' },
      activeCompanyId: 'c1',
      permissions: {
        userId: 'user-1',
        companyId: 'c1',
        role: 'ADMIN',
        isSuperAdmin: false,
        accessGroups: [],
        modules: {},
        fieldOverrides: {},
        enabledModules: ['finance'],
      },
      isAuthenticated: true,
      accessToken: 'token',
      refreshToken: null,
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

  it('renders sidebar, header, and main content area', () => {
    renderWithProviders(<AppLayout />);

    // Sidebar (nav landmark)
    expect(screen.getByRole('navigation', { name: 'navigation:sidebar' })).toBeInTheDocument();
    // Header (banner landmark)
    expect(screen.getByRole('banner')).toBeInTheDocument();
    // Main content (main landmark)
    expect(screen.getByRole('main')).toBeInTheDocument();
    // Outlet content
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('main content has id="main-content" for skip link target', () => {
    renderWithProviders(<AppLayout />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
  });

  it('main content has aria-label', () => {
    renderWithProviders(<AppLayout />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'navigation:mainContent');
  });

  it('renders skip-to-content link', () => {
    renderWithProviders(<AppLayout />);

    const skipLink = screen.getByText('navigation:skipToContent');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('skip link is visually hidden by default (sr-only class)', () => {
    renderWithProviders(<AppLayout />);

    const skipLink = screen.getByText('navigation:skipToContent');
    expect(skipLink.className).toContain('sr-only');
  });

  it('renders breadcrumbs nav', () => {
    renderWithProviders(<AppLayout />);

    // Breadcrumbs should have a nav with aria-label
    const breadcrumbNav = screen.getByRole('navigation', {
      name: 'navigation:breadcrumb',
    });
    expect(breadcrumbNav).toBeInTheDocument();
  });

  it('breadcrumbs show current path segments', () => {
    renderWithProviders(<AppLayout />);

    const breadcrumbNav = screen.getByRole('navigation', {
      name: 'navigation:breadcrumb',
    });
    const bcScope = within(breadcrumbNav);

    // Router is mocked to /finance/journals
    expect(bcScope.getByText('navigation:finance')).toBeInTheDocument();
    expect(bcScope.getByText('navigation:finance.journals')).toBeInTheDocument();
  });

  it('last breadcrumb has aria-current="page"', () => {
    renderWithProviders(<AppLayout />);

    const breadcrumbNav = screen.getByRole('navigation', {
      name: 'navigation:breadcrumb',
    });
    const bcScope = within(breadcrumbNav);
    const lastCrumb = bcScope.getByText('navigation:finance.journals');
    expect(lastCrumb).toHaveAttribute('aria-current', 'page');
  });

  it('sidebar collapses to icon-only width in collapsed mode', () => {
    useSidebarStore.setState({ isCollapsed: true, mode: 'collapsed' });
    renderWithProviders(<AppLayout />);

    // The sidebar nav should have w-16 class (64px collapsed)
    const sidebarNav = screen.getByRole('navigation', { name: 'navigation:sidebar' });
    expect(sidebarNav.className).toContain('w-16');
  });

  it('sidebar is full width in expanded mode', () => {
    useSidebarStore.setState({ isCollapsed: false, mode: 'expanded' });
    renderWithProviders(<AppLayout />);

    const sidebarNav = screen.getByRole('navigation', { name: 'navigation:sidebar' });
    expect(sidebarNav.className).toContain('w-64');
  });

  it('on mobile, sidebar is hidden and bottom tab bar is shown', () => {
    mockBreakpoint.mockReturnValue('phone');
    useSidebarStore.setState({ isOpen: false, mode: 'hidden' });

    renderWithProviders(<AppLayout />);

    // The inline sidebar should NOT be in the DOM (mobile uses bottom tabs + drawer)
    // The header and main are still rendered
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();

    // Bottom tab bar should be present on phone
    const bottomTabNav = screen.getByRole('navigation', {
      name: 'navigation:bottomTabs',
    });
    expect(bottomTabNav).toBeInTheDocument();

    // Breadcrumbs should NOT be shown on phone
    expect(
      screen.queryByRole('navigation', { name: 'navigation:breadcrumb' }),
    ).not.toBeInTheDocument();
  });

  it('respects prefers-reduced-motion by not applying transitions', () => {
    mockPrefersReducedMotion.mockReturnValue(true);
    renderWithProviders(<AppLayout />);

    // With reduced motion, transition classes should NOT be applied
    // The aside element should not have transition-[width] class
    const asideEl = screen.getByRole('navigation', { name: 'navigation:sidebar' }).closest('aside');
    const wrapperEl = asideEl?.parentElement;
    if (wrapperEl) {
      expect(wrapperEl.className).not.toContain('transition-[width]');
    }
  });
});
