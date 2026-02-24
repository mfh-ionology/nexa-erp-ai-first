import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useCopilotStore } from '@/stores/copilot-store';

// --- Mocks ---

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
  useRouterState: () => ({
    location: { pathname: '/' },
  }),
}));

vi.mock('@/lib/auth-api', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
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
  });

  it('renders header with banner role', () => {
    renderWithProviders(<AppHeader />);

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('renders search placeholder input', () => {
    renderWithProviders(<AppHeader />);

    // Desktop search input (always visible on md+)
    const searchInputs = screen.getAllByRole('textbox');
    expect(searchInputs.length).toBeGreaterThanOrEqual(1);
    expect(searchInputs[0]).toHaveAttribute('aria-label', 'common:searchPlaceholder');
  });

  it('renders chat button (disabled placeholder)', () => {
    renderWithProviders(<AppHeader />);

    const chatBtn = screen.getByRole('button', {
      name: 'navigation:chatButton',
    });
    expect(chatBtn).toBeInTheDocument();
    expect(chatBtn).toBeDisabled();
  });

  it('renders notifications bell', () => {
    renderWithProviders(<AppHeader />);

    const notifBtn = screen.getByRole('button', {
      name: 'navigation:notifications',
    });
    expect(notifBtn).toBeInTheDocument();
  });

  it('renders hamburger menu button for mobile', () => {
    renderWithProviders(<AppHeader />);

    const hamburger = screen.getByRole('button', {
      name: 'navigation:toggleMenu',
    });
    expect(hamburger).toBeInTheDocument();
    // It has md:hidden class (visible only on phone <768px)
    expect(hamburger.className).toContain('md:hidden');
  });

  it('hamburger toggles sidebar store', async () => {
    // Hamburger is a mobile-only button — set mobile (hidden) mode
    useSidebarStore.setState({ mode: 'hidden', isOpen: false });
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    const hamburger = screen.getByRole('button', {
      name: 'navigation:toggleMenu',
    });
    expect(useSidebarStore.getState().isOpen).toBe(false);
    await user.click(hamburger);

    expect(useSidebarStore.getState().isOpen).toBe(true);
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

  it('shows mobile search icon button', () => {
    renderWithProviders(<AppHeader />);

    // There's a search icon button for mobile (md:hidden)
    const searchButtons = screen.getAllByRole('button', {
      name: 'common:searchPlaceholder',
    });
    // At least one search button for mobile
    expect(searchButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('mobile search expands on icon click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    // Find the mobile search button (the one with md:hidden)
    const searchButtons = screen.getAllByRole('button', {
      name: 'common:searchPlaceholder',
    });
    const mobileSearchBtn = searchButtons.find(
      (btn) => btn.className.includes('md:hidden'),
    );

    if (mobileSearchBtn) {
      await user.click(mobileSearchBtn);

      // A close button should appear
      expect(
        screen.getByRole('button', { name: 'common:close' }),
      ).toBeInTheDocument();
    }
  });
});
