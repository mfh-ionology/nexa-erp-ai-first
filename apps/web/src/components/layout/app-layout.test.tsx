import { render, screen } from '@testing-library/react';
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
  fetchCompanies: vi
    .fn()
    .mockResolvedValue([
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

// Mock page context hook (used by AppLayout for copilot route sync)
vi.mock('@/hooks/use-page-context', () => ({
  usePageContext: vi.fn(),
}));

// Mock CopilotDrawer and CopilotMinimisedPill (not under test)
vi.mock('@/components/copilot/CopilotDrawer', () => ({
  CopilotDrawer: () => <div data-testid="copilot-drawer" />,
}));
vi.mock('@/components/copilot/CopilotMinimisedPill', () => ({
  CopilotMinimisedPill: () => <div data-testid="copilot-pill" />,
}));

// Mock NotificationProvider (wraps children transparently)
vi.mock('@/features/notifications/notification-provider', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock new navigation components
vi.mock('./mega-menu', () => ({
  MegaMenu: () => <div data-testid="mega-menu" />,
}));
vi.mock('./favourites-toolbar', () => ({
  FavouritesToolbar: () => <div data-testid="favourites-toolbar" />,
}));
vi.mock('./module-context-bar', () => ({
  ModuleContextBar: () => <div data-testid="module-context-bar" />,
}));

// Mock legacy BottomTabBar
vi.mock('./bottom-tab-bar', () => ({
  BottomTabBar: () => (
    <nav aria-label="navigation:bottomTabs" data-testid="bottom-tab-bar">
      Bottom Tabs
    </nav>
  ),
}));

// Mock FavouritesDropdown (used by AppHeader)
vi.mock('@/features/views/components/favourites-dropdown', () => ({
  FavouritesDropdown: () => <button data-testid="favourites-dropdown">Favourites</button>,
}));

// Mock favourite pages hook (used by AppHeader)
vi.mock('@/hooks/use-favourite-pages', () => ({
  useFavouritePages: () => ({
    pages: [],
    isLoading: false,
    isPinned: () => false,
    togglePin: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
    unpinByPath: vi.fn(),
    reorder: vi.fn(),
  }),
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

    // Feature flag defaults to 'true' (new navigation)
    // import.meta.env.VITE_USE_NEW_NAVIGATION is undefined by default,
    // and `undefined !== 'false'` evaluates to true.

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

  // ── New navigation layout tests (feature flag defaults to true) ──

  it('renders header, main content area, and new navigation components', () => {
    renderWithProviders(<AppLayout />);

    // Header (banner landmark)
    expect(screen.getByRole('banner')).toBeInTheDocument();
    // Main content (main landmark)
    expect(screen.getByRole('main')).toBeInTheDocument();
    // Outlet content
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('renders MegaMenu component', () => {
    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('mega-menu')).toBeInTheDocument();
  });

  it('renders FavouritesToolbar component', () => {
    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('favourites-toolbar')).toBeInTheDocument();
  });

  it('renders ModuleContextBar component', () => {
    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('module-context-bar')).toBeInTheDocument();
  });

  it('does NOT render sidebar in new navigation mode', () => {
    renderWithProviders(<AppLayout />);

    // The sidebar navigation landmark should not be present
    expect(
      screen.queryByRole('navigation', { name: 'navigation:sidebar' }),
    ).not.toBeInTheDocument();
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

  it('on mobile, bottom tab bar is shown', () => {
    mockBreakpoint.mockReturnValue('phone');

    renderWithProviders(<AppLayout />);

    // Header and main are still rendered
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();

    // Bottom tab bar should be present on phone
    const bottomTabNav = screen.getByRole('navigation', {
      name: 'navigation:bottomTabs',
    });
    expect(bottomTabNav).toBeInTheDocument();
  });
});
