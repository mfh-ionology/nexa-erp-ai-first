import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';

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

import { UserMenu } from './user-menu';

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

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-1', email: 'jane@nexa.io', firstName: 'Jane', lastName: 'Smith' },
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
  });

  it('renders trigger button with aria-label', () => {
    renderWithProviders(<UserMenu />);

    const trigger = screen.getByRole('button', { name: 'navigation:userMenu' });
    expect(trigger).toBeInTheDocument();
  });

  it('shows user initials in avatar', () => {
    renderWithProviders(<UserMenu />);

    // JS = Jane Smith
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('shows "U" fallback when user is null', () => {
    useAuthStore.setState({ user: null });
    renderWithProviders(<UserMenu />);

    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('opens dropdown showing user name on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows role and email in dropdown header', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));

    expect(screen.getByText(/ADMIN/)).toBeInTheDocument();
    expect(screen.getByText(/jane@nexa\.io/)).toBeInTheDocument();
  });

  it('shows My Profile menu item', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));

    expect(screen.getByText('navigation:myProfile')).toBeInTheDocument();
  });

  it('shows Preferences menu item', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));

    expect(screen.getByText('navigation:preferences')).toBeInTheDocument();
  });

  it('shows Sign Out menu item', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));

    expect(screen.getByText('common:signOut')).toBeInTheDocument();
  });

  it('Sign Out clears auth state and navigates to /login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));
    await user.click(screen.getByText('common:signOut'));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
  });

  it('My Profile navigates to /system/profile', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));
    await user.click(screen.getByText('navigation:myProfile'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/system/profile' });
    });
  });

  it('Preferences navigates to /system/preferences', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'navigation:userMenu' }));
    await user.click(screen.getByText('navigation:preferences'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/system/preferences' });
    });
  });
});
