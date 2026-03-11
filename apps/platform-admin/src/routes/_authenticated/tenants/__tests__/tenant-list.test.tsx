// ---------------------------------------------------------------------------
// Component Tests — Tenant List Page (T1 Entity List)
// Story: E13b.2 Task 7.3
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockUser: { id: string; email: string; displayName: string; role: string } | null = {
  id: 'admin-1',
  email: 'admin@nexa.io',
  displayName: 'Admin User',
  role: 'PLATFORM_ADMIN',
};

const mockNavigate = vi.fn();

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: mockUser }),
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    ...opts,
    useSearch: () => ({}),
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/use-tenants', () => ({
  useTenantList: vi.fn(),
}));

import { Route } from '../index';
import { useTenantList } from '@/hooks/use-tenants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TenantsPage = (Route as unknown as { component: React.ComponentType }).component;

function setUser(role: string) {
  mockUser = {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@nexa.io`,
    displayName: `${role} User`,
    role,
  };
}

const mockTenants = [
  {
    id: 'tenant-1',
    code: 'acme',
    displayName: 'Acme Corp',
    legalName: 'Acme Corporation Ltd',
    status: 'ACTIVE',
    billingStatus: 'CURRENT',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: new Date().toISOString(),
    createdAt: '2025-01-01T00:00:00Z',
    plan: { id: 'plan-1', code: 'pro', displayName: 'Pro Plan' },
    moduleOverrideCount: 2,
  },
  {
    id: 'tenant-2',
    code: 'globex',
    displayName: 'Globex Inc',
    legalName: null,
    status: 'SUSPENDED',
    billingStatus: 'OVERDUE',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: '2025-02-01T00:00:00Z',
    plan: { id: 'plan-2', code: 'core', displayName: 'Core Plan' },
    moduleOverrideCount: 0,
  },
];

function mockListHook(overrides: Record<string, unknown> = {}) {
  vi.mocked(useTenantList).mockReturnValue({
    data: { data: mockTenants, meta: { total: 2 } },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useTenantList>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    mockListHook();
  });

  it('renders table with correct column headers', () => {
    render(<TenantsPage />);

    expect(screen.getByTestId('col-displayName')).toHaveTextContent('Name');
    expect(screen.getByTestId('col-code')).toHaveTextContent('Code');
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('renders tenant rows with correct data', () => {
    render(<TenantsPage />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
    expect(screen.getByText('globex')).toBeInTheDocument();
    expect(screen.getByText('Core Plan')).toBeInTheDocument();
  });

  it('renders status badges with correct colours per status', () => {
    render(<TenantsPage />);

    // Query within table rows to avoid matching filter dropdown options
    const row1 = screen.getByTestId('tenant-row-tenant-1');
    const activeBadge = within(row1).getByText('Active');
    expect(activeBadge).toHaveClass('text-green-600');

    const row2 = screen.getByTestId('tenant-row-tenant-2');
    const suspendedBadge = within(row2).getByText('Suspended');
    expect(suspendedBadge).toHaveClass('text-red-600');
  });

  it('renders billing status badges with correct colours', () => {
    render(<TenantsPage />);

    const row1 = screen.getByTestId('tenant-row-tenant-1');
    const currentBadge = within(row1).getByText('Current');
    expect(currentBadge).toHaveClass('text-green-600');

    const row2 = screen.getByTestId('tenant-row-tenant-2');
    const overdueBadge = within(row2).getByText('Overdue');
    expect(overdueBadge).toHaveClass('text-red-500');
  });

  it('navigates to tenant detail when row is clicked', async () => {
    const user = userEvent.setup();
    render(<TenantsPage />);

    await user.click(screen.getByTestId('tenant-row-tenant-1'));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/tenants/$tenantId',
      params: { tenantId: 'tenant-1' },
    });
  });

  it('renders filter controls', () => {
    render(<TenantsPage />);

    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('plan-filter')).toBeInTheDocument();
    expect(screen.getByTestId('billing-filter')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  describe('RBAC', () => {
    it('shows "+ New Tenant" button for PLATFORM_ADMIN', () => {
      setUser('PLATFORM_ADMIN');
      render(<TenantsPage />);

      expect(screen.getByTestId('new-tenant-btn')).toBeInTheDocument();
    });

    it('hides "+ New Tenant" button for PLATFORM_VIEWER', () => {
      setUser('PLATFORM_VIEWER');
      render(<TenantsPage />);

      expect(screen.queryByTestId('new-tenant-btn')).not.toBeInTheDocument();
    });

    it('hides "+ New Tenant" button for PLATFORM_SUPPORT', () => {
      setUser('PLATFORM_SUPPORT');
      render(<TenantsPage />);

      expect(screen.queryByTestId('new-tenant-btn')).not.toBeInTheDocument();
    });
  });

  describe('loading / error / empty states', () => {
    it('shows loading state', () => {
      mockListHook({ isLoading: true, data: undefined });
      render(<TenantsPage />);

      expect(screen.getByText('Loading tenants...')).toBeInTheDocument();
    });

    it('shows error state', () => {
      mockListHook({ isError: true, error: new Error('Network error'), data: undefined });
      render(<TenantsPage />);

      expect(screen.getByText(/Failed to load tenants/)).toBeInTheDocument();
    });

    it('shows empty state when no tenants found', () => {
      mockListHook({ data: { data: [], meta: { total: 0 } } });
      render(<TenantsPage />);

      expect(screen.getByText('No tenants found.')).toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('shows pagination info when tenants exist', () => {
      render(<TenantsPage />);

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
      expect(screen.getByText(/Showing 1–2 of 2 tenants/)).toBeInTheDocument();
    });

    it('hides pagination when no tenants', () => {
      mockListHook({ data: { data: [], meta: { total: 0 } } });
      render(<TenantsPage />);

      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });
  });
});
