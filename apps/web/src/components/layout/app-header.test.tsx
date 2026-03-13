import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useCopilotStore } from '@/stores/copilot-store';
import { useMegaMenuStore } from '@/stores/mega-menu-store';

// --- Mocks ---

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React component
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
  useNavigate: () => mockNavigate,
  useRouterState: (opts?: { select?: (s: { location: { pathname: string } }) => unknown }) => {
    const state = { location: { pathname: '/' } };
    if (opts?.select) return opts.select(state);
    return state;
  },
}));

vi.mock('@/lib/auth-api', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/views/components/favourites-dropdown', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React component
  FavouritesDropdown: () => <button data-testid="favourites-dropdown">Favourites</button>,
}));

// Mock favourite pages hook (used by AppHeader for pin star)
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

import { AppHeader } from './app-header';

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

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    useCopilotStore.setState({
      isDrawerOpen: false,
      activeConversationId: null,
      isStreaming: false,
    });
    useMegaMenuStore.setState({
      isOpen: false,
      expandedModule: null,
      filterQuery: '',
    });
  });

  it('renders header with banner role', () => {
    renderWithProviders(<AppHeader />);

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('renders search component', () => {
    renderWithProviders(<AppHeader />);

    // The UnifiedSearch renders as a combobox element
    const searchCombobox = screen.getByRole('combobox', { name: 'search.ariaLabel' });
    expect(searchCombobox).toBeInTheDocument();
  });

  it('renders notifications bell', () => {
    renderWithProviders(<AppHeader />);

    const notifBtn = screen.getByRole('button', {
      name: 'notifications:ariaLabel',
    });
    expect(notifBtn).toBeInTheDocument();
  });

  it('renders hamburger menu button always visible (new navigation)', () => {
    renderWithProviders(<AppHeader />);

    const hamburger = screen.getByRole('button', {
      name: 'navigation:toggleMenu',
    });
    expect(hamburger).toBeInTheDocument();
    // With new navigation, the hamburger should NOT have lg:hidden or md:hidden class
    // It is always visible
    expect(hamburger.className).not.toContain('lg:hidden');
  });

  it('hamburger toggles mega-menu store (new navigation)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    const hamburger = screen.getByRole('button', {
      name: 'navigation:toggleMenu',
    });
    expect(useMegaMenuStore.getState().isOpen).toBe(false);
    await user.click(hamburger);

    // With new navigation, clicking hamburger opens the mega-menu
    expect(useMegaMenuStore.getState().isOpen).toBe(true);
  });

  it('renders user menu trigger with avatar', () => {
    renderWithProviders(<AppHeader />);

    const userMenuTrigger = screen.getByRole('button', {
      name: 'navigation:userMenu',
    });
    expect(userMenuTrigger).toBeInTheDocument();
  });

  it('user menu opens on click showing user name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    const userMenuTrigger = screen.getByRole('button', {
      name: 'navigation:userMenu',
    });
    await user.click(userMenuTrigger);

    // User menu should show the full name
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('user menu shows My Profile and Preferences items', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    const userMenuTrigger = screen.getByRole('button', {
      name: 'navigation:userMenu',
    });
    await user.click(userMenuTrigger);

    expect(screen.getByText('navigation:myProfile')).toBeInTheDocument();
    expect(screen.getByText('navigation:preferences')).toBeInTheDocument();
  });

  it('user menu shows Sign Out option', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    const userMenuTrigger = screen.getByRole('button', {
      name: 'navigation:userMenu',
    });
    await user.click(userMenuTrigger);

    expect(screen.getByText('common:signOut')).toBeInTheDocument();
  });

  it('Sign Out clears auth store and navigates to login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    const userMenuTrigger = screen.getByRole('button', {
      name: 'navigation:userMenu',
    });
    await user.click(userMenuTrigger);

    const signOutItem = screen.getByText('common:signOut');
    await user.click(signOutItem);

    // Auth store should be cleared
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();

    // Should navigate to login
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
  });

  it('renders user initials in avatar', () => {
    renderWithProviders(<AppHeader />);

    // TU = Test User
    expect(screen.getByText('TU')).toBeInTheDocument();
  });
});
