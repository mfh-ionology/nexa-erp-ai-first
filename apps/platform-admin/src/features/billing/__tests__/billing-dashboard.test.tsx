// ---------------------------------------------------------------------------
// Component Tests — Billing Dashboard (KPI cards, enforcement dist, issues table)
// Story: E13b.3 Task 5.2
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock the billing hooks at the module level
const mockUpdateEnforcement = {
  mutate: vi.fn(),
  isPending: false,
};

vi.mock('@/hooks/use-billing', () => ({
  useUpdateEnforcement: () => mockUpdateEnforcement,
  billingKeys: {
    all: ['billing'],
    overview: ['billing', 'overview'],
  },
}));

// Mock apiGet for the dashboard data fetch
vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  buildQueryString: vi.fn(() => ''),
}));

import { apiGet } from '@/lib/api-client';
import { BillingDashboard } from '../components/billing-dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    id: 't-1',
    code: 'acme',
    displayName: 'Acme Corp',
    legalName: 'Acme Corporation Ltd',
    status: 'ACTIVE',
    billingStatus: 'CURRENT',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: '2026-03-01T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    plan: { id: 'p-1', code: 'pro', displayName: 'Pro Plan' },
    moduleOverrideCount: 0,
  },
  {
    id: 't-2',
    code: 'globex',
    displayName: 'Globex Inc',
    legalName: null,
    status: 'ACTIVE',
    billingStatus: 'GRACE',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: '2025-02-01T00:00:00Z',
    plan: { id: 'p-2', code: 'core', displayName: 'Core Plan' },
    moduleOverrideCount: 0,
  },
  {
    id: 't-3',
    code: 'wayne',
    displayName: 'Wayne Enterprises',
    legalName: null,
    status: 'ACTIVE',
    billingStatus: 'OVERDUE',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: '2025-03-01T00:00:00Z',
    plan: { id: 'p-1', code: 'pro', displayName: 'Pro Plan' },
    moduleOverrideCount: 0,
  },
  {
    id: 't-4',
    code: 'stark',
    displayName: 'Stark Industries',
    legalName: null,
    status: 'ACTIVE',
    billingStatus: 'BLOCKED',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: '2025-04-01T00:00:00Z',
    plan: { id: 'p-2', code: 'core', displayName: 'Core Plan' },
    moduleOverrideCount: 0,
  },
  {
    id: 't-5',
    code: 'archived',
    displayName: 'Old Corp',
    legalName: null,
    status: 'ARCHIVED',
    billingStatus: 'CURRENT',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    plan: { id: 'p-1', code: 'pro', displayName: 'Pro Plan' },
    moduleOverrideCount: 0,
  },
];

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BillingDashboard />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    // Default: resolve with mock tenants
    vi.mocked(apiGet).mockResolvedValue({ data: mockTenants });
  });

  it('renders KPI cards with correct counts from tenant data', async () => {
    renderDashboard();

    // Wait for data to load
    await screen.findByTestId('billing-dashboard');

    // 4 active tenants (t-5 is ARCHIVED)
    const totalCard = screen.getByTestId('kpi-totalActive');
    expect(within(totalCard).getByText('4')).toBeInTheDocument();

    // 1 CURRENT
    const currentCard = screen.getByTestId('kpi-current');
    expect(within(currentCard).getByText('1')).toBeInTheDocument();

    // 1 GRACE
    const graceCard = screen.getByTestId('kpi-grace');
    expect(within(graceCard).getByText('1')).toBeInTheDocument();

    // 1 OVERDUE
    const overdueCard = screen.getByTestId('kpi-overdue');
    expect(within(overdueCard).getByText('1')).toBeInTheDocument();

    // 1 BLOCKED
    const blockedCard = screen.getByTestId('kpi-blocked');
    expect(within(blockedCard).getByText('1')).toBeInTheDocument();
  });

  it('displays percentage of total on status cards', async () => {
    renderDashboard();
    await screen.findByTestId('billing-dashboard');

    // Each status has 1 of 4 active = 25%
    const currentCard = screen.getByTestId('kpi-current');
    expect(within(currentCard).getByText('25% of total')).toBeInTheDocument();
  });

  it('displays enforcement action distribution', async () => {
    renderDashboard();
    await screen.findByTestId('billing-dashboard');

    // Enforcement is derived 1:1 from billing status
    expect(screen.getByTestId('enforcement-none')).toBeInTheDocument();
    expect(screen.getByTestId('enforcement-warning')).toBeInTheDocument();
    expect(screen.getByTestId('enforcement-readOnly')).toBeInTheDocument();
    expect(screen.getByTestId('enforcement-suspended')).toBeInTheDocument();
  });

  it('shows billing issues table with non-current tenants', async () => {
    renderDashboard();
    await screen.findByTestId('billing-dashboard');

    // 3 tenants should be in issues table (GRACE, OVERDUE, BLOCKED)
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
    expect(screen.getByText('Wayne Enterprises')).toBeInTheDocument();
    expect(screen.getByText('Stark Industries')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    // Never resolve the API call
    vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(screen.getByTestId('billing-dashboard-loading')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error('Server error'));
    renderDashboard();

    await screen.findByTestId('billing-dashboard-error');
    expect(screen.getByText('Failed to load billing data')).toBeInTheDocument();
  });

  describe('RBAC', () => {
    it('PLATFORM_ADMIN sees "Change Enforcement" buttons on issues table', async () => {
      setUser('PLATFORM_ADMIN');
      renderDashboard();
      await screen.findByTestId('billing-dashboard');

      // Should have change enforcement buttons for non-current tenants
      expect(screen.getByTestId('change-enforcement-t-2')).toBeInTheDocument();
      expect(screen.getByTestId('change-enforcement-t-3')).toBeInTheDocument();
      expect(screen.getByTestId('change-enforcement-t-4')).toBeInTheDocument();
    });

    it('PLATFORM_VIEWER hides "Change Enforcement" action buttons', async () => {
      setUser('PLATFORM_VIEWER');
      renderDashboard();
      await screen.findByTestId('billing-dashboard');

      expect(screen.queryByTestId('change-enforcement-t-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('change-enforcement-t-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('change-enforcement-t-4')).not.toBeInTheDocument();
    });
  });

  it('shows "All tenants are in good standing" when no billing issues', async () => {
    const allCurrentTenants = [
      {
        id: 't-1',
        code: 'acme',
        displayName: 'Acme Corp',
        legalName: null,
        status: 'ACTIVE',
        billingStatus: 'CURRENT',
        region: 'uk-south',
        sandboxEnabled: false,
        lastActivityAt: null,
        createdAt: '2025-01-01T00:00:00Z',
        plan: { id: 'p-1', code: 'pro', displayName: 'Pro Plan' },
        moduleOverrideCount: 0,
      },
    ];
    vi.mocked(apiGet).mockResolvedValue({ data: allCurrentTenants });
    renderDashboard();

    await screen.findByTestId('billing-dashboard');
    expect(screen.getByText(/All tenants are in good standing/)).toBeInTheDocument();
  });
});
