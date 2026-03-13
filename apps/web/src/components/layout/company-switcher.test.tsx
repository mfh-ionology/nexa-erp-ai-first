import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth-store';

import type { Company } from '@/lib/system-api';

// --- Mocks ---

const mockRouterState = {
  location: { pathname: '/finance/journals' },
};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: (opts?: { select?: (s: typeof mockRouterState) => unknown }) => {
    if (opts?.select) return opts.select(mockRouterState);
    return mockRouterState;
  },
}));

const mockCompanies: Company[] = [
  { id: 'c1', name: 'Nexa Ltd', slug: 'nexa-ltd', baseCurrencyCode: 'GBP', isDefault: true },
  { id: 'c2', name: 'Acme Corp', slug: 'acme-corp', baseCurrencyCode: 'USD', isDefault: false },
];

const mockPermissions = {
  userId: 'user-1',
  companyId: 'c1',
  role: 'ADMIN',
  isSuperAdmin: false,
  accessGroups: [],
  modules: {},
  fieldOverrides: {},
  enabledModules: ['finance'],
};

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockFetchCompanies = vi.fn<() => Promise<Company[]>>();
const mockFetchMyPermissions = vi.fn();

vi.mock('@/lib/system-api', () => ({
  fetchCompanies: (...args: unknown[]) => mockFetchCompanies(...(args as [])),
  fetchMyPermissions: (...args: unknown[]) => mockFetchMyPermissions(...(args as [])),
}));

import { CompanySwitcher } from './company-switcher';

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

describe('CompanySwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@nexa.io', firstName: 'Test', lastName: 'User' },
      activeCompanyId: 'c1',
      permissions: mockPermissions,
      isAuthenticated: true,
      accessToken: 'token',
      refreshToken: null,
      isLoading: false,
      rememberMe: false,
    });
    mockFetchCompanies.mockResolvedValue(mockCompanies);
    mockFetchMyPermissions.mockResolvedValue(mockPermissions);
  });

  it('renders current company name when expanded', async () => {
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });
  });

  it('renders skeleton while loading', () => {
    mockFetchCompanies.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    // Should show a loading skeleton (Skeleton component renders a div with animation)
    expect(screen.queryByText('Nexa Ltd')).not.toBeInTheDocument();
  });

  it('shows initials for company', async () => {
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('NL')).toBeInTheDocument(); // Nexa Ltd → NL
    });
  });

  it('opens dropdown on click with multiple companies', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });

    // Click the trigger to open dropdown
    const trigger = screen.getByRole('button', { name: 'navigation:companySwitcher' });
    await user.click(trigger);

    // Both companies should be in the dropdown
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('shows checkmark for active company', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: 'navigation:companySwitcher' });
    await user.click(trigger);

    // Active company should have a checkmark (aria-label on the Check icon)
    await waitFor(() => {
      expect(screen.getByLabelText('navigation:currentCompany')).toBeInTheDocument();
    });
  });

  it('switching company updates auth store', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: 'navigation:companySwitcher' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    // Click "Acme Corp" to switch
    await user.click(screen.getByText('Acme Corp'));

    await waitFor(() => {
      expect(useAuthStore.getState().activeCompanyId).toBe('c2');
    });
  });

  it('shows success toast on switch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: 'navigation:companySwitcher' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Acme Corp'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('navigation:companySwitched'),
      );
    });
  });

  it('does not render dropdown for single company', async () => {
    mockFetchCompanies.mockResolvedValue([mockCompanies[0]!]);
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });

    // No dropdown trigger should exist
    expect(
      screen.queryByRole('button', { name: 'navigation:companySwitcher' }),
    ).not.toBeInTheDocument();
  });

  it('re-fetches permissions on company switch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: 'navigation:companySwitcher' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Acme Corp'));

    await waitFor(() => {
      expect(mockFetchMyPermissions).toHaveBeenCalled();
    });
  });

  it('shows error toast when permission re-fetch fails on switch', async () => {
    mockFetchMyPermissions.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    renderWithProviders(<CompanySwitcher isCollapsed={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nexa Ltd')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: 'navigation:companySwitcher' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Acme Corp'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('navigation:companySwitchPermissionError'),
      );
    });
  });
});
