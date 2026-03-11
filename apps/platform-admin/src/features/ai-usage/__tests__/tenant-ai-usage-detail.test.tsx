// ---------------------------------------------------------------------------
// Component Tests — Tenant AI Usage Detail
// Story E13b-4 Task 6.5 (AC#2)
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ isAuthenticated: true, user: mockUser }),
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

// Recharts doesn't render in jsdom — mock ResponsiveContainer to render children
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
}));

// Mock hooks
const mockTenantUsage = vi.fn();
const mockFeatureUsage = vi.fn();
const mockTenantQuota = vi.fn();
const mockUpdateQuotaMutate = vi.fn();

vi.mock('../hooks/use-ai-usage', () => ({
  useTenantAiUsage: (tenantId: string) => mockTenantUsage(tenantId),
  useTenantAiUsageByFeature: (tenantId: string) => mockFeatureUsage(tenantId),
  useTenantAiQuota: (tenantId: string) => mockTenantQuota(tenantId),
  useUpdateTenantQuota: () => ({
    mutate: mockUpdateQuotaMutate,
    isPending: false,
  }),
}));

// Mock BYOK hooks (Task 7)
vi.mock('../hooks/use-tenant-byok', () => ({
  useTenantByokKeys: () => ({ data: [], isLoading: false, error: null }),
  useAddByokKey: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  }),
  useRemoveByokKey: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleByokKey: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock provider hooks (Task 7)
vi.mock('../hooks/use-ai-providers', () => ({
  useAiProviders: () => ({
    data: [
      {
        providerId: 'anthropic',
        displayName: 'Anthropic',
        isActive: true,
        hasApiKey: true,
        lastUsedAt: null,
      },
      {
        providerId: 'openai',
        displayName: 'OpenAI',
        isActive: true,
        hasApiKey: true,
        lastUsedAt: null,
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

import { TenantAiUsageDetail } from '../components/tenant-ai-usage-detail';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_USAGE = {
  tokensToday: 15_000,
  tokensThisMonth: 450_000,
  costEstimate: '12.50',
  dailyTrend: [
    { date: '2026-03-01', tokens: 10_000, cost: '0.30' },
    { date: '2026-03-02', tokens: 15_000, cost: '0.45' },
  ],
  byProvider: [
    { provider: 'anthropic', tokens: 300_000, pct: 66.7 },
    { provider: 'openai', tokens: 150_000, pct: 33.3 },
  ],
  byokSplit: {
    byokTokens: 0,
    vendorTokens: 450_000,
    byokPct: 0,
  },
};

const MOCK_USAGE_ENTERPRISE = {
  ...MOCK_USAGE,
  byokSplit: {
    byokTokens: 200_000,
    vendorTokens: 250_000,
    byokPct: 44.4,
  },
};

const MOCK_FEATURES = {
  features: [
    { featureKey: 'chat', tokens: 200_000, pct: 44.4, calls: 500 },
    { featureKey: 'document_processing', tokens: 150_000, pct: 33.3, calls: 200 },
    { featureKey: 'forecasting', tokens: 100_000, pct: 22.2, calls: 50 },
  ],
};

const MOCK_QUOTA = {
  periodStart: '2026-03-01T00:00:00.000Z',
  periodEnd: '2026-03-31T23:59:59.999Z',
  tokensUsed: 450_000,
  tokenAllowance: 2_000_000,
  softLimitPct: 80,
  hardLimitPct: 100,
};

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

function renderDetail(props?: { planCode?: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TenantAiUsageDetail tenantId="tenant-1" planCode={props?.planCode} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantAiUsageDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    mockTenantUsage.mockReturnValue({
      data: MOCK_USAGE,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockFeatureUsage.mockReturnValue({
      data: MOCK_FEATURES,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockTenantQuota.mockReturnValue({
      data: MOCK_QUOTA,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  // -------------------------------------------------------------------------
  // KPI cards
  // -------------------------------------------------------------------------

  it('renders KPI cards with usage data', () => {
    renderDetail();

    expect(screen.getByText('Tokens Today')).toBeInTheDocument();
    expect(screen.getByText('Tokens This Month')).toBeInTheDocument();
    expect(screen.getByText('Cost Estimate')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Quota progress bar
  // -------------------------------------------------------------------------

  it('renders quota progress bar', () => {
    renderDetail();

    expect(screen.getByTestId('quota-progress-bar')).toBeInTheDocument();
    expect(screen.getByText('Quota Status')).toBeInTheDocument();
  });

  it('renders quota progress bar with correct percentage', () => {
    renderDetail();

    // 450K / 2M = 22.5%
    expect(screen.getByTestId('quota-label')).toHaveTextContent('450.0K / 2.0M tokens (22.5%)');
  });

  // -------------------------------------------------------------------------
  // Charts
  // -------------------------------------------------------------------------

  it('renders daily trend chart section', () => {
    renderDetail();

    expect(screen.getByText('Daily Token Usage (30 days)')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders feature breakdown chart section', () => {
    renderDetail();

    expect(screen.getByText('Usage by Feature')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders provider breakdown chart section', () => {
    renderDetail();

    expect(screen.getByText('Usage by Provider')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // BYOK section visibility
  // -------------------------------------------------------------------------

  it('hides BYOK section for non-Enterprise tenants', () => {
    renderDetail({ planCode: 'starter' });

    expect(screen.queryByTestId('byok-split-section')).not.toBeInTheDocument();
  });

  it('hides BYOK section for Enterprise tenants with no BYOK usage', () => {
    // Default mock has byokTokens = 0, vendorTokens = 450K
    renderDetail({ planCode: 'enterprise' });

    expect(screen.queryByTestId('byok-split-section')).not.toBeInTheDocument();
  });

  it('shows BYOK section for Enterprise tenants with BYOK usage', () => {
    mockTenantUsage.mockReturnValue({
      data: MOCK_USAGE_ENTERPRISE,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderDetail({ planCode: 'enterprise' });

    expect(screen.getByTestId('byok-split-section')).toBeInTheDocument();
    expect(screen.getByText('BYOK vs Vendor Key Usage')).toBeInTheDocument();
    expect(screen.getByText(/44\.4% of total tokens/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // BYOK management section visibility (Task 7.3)
  // -------------------------------------------------------------------------

  it('shows BYOK management section for Enterprise tenants', () => {
    renderDetail({ planCode: 'enterprise' });

    expect(screen.getByTestId('byok-management-section')).toBeInTheDocument();
    expect(screen.getByText('BYOK API Keys')).toBeInTheDocument();
  });

  it('hides BYOK management section for non-Enterprise tenants', () => {
    renderDetail({ planCode: 'starter' });

    expect(screen.queryByTestId('byok-management-section')).not.toBeInTheDocument();
  });

  it('shows Add BYOK Key button for PLATFORM_ADMIN on Enterprise tenant', () => {
    setUser('PLATFORM_ADMIN');
    renderDetail({ planCode: 'enterprise' });

    expect(screen.getByTestId('add-byok-key-btn')).toBeInTheDocument();
  });

  it('hides Add BYOK Key button for PLATFORM_VIEWER on Enterprise tenant', () => {
    setUser('PLATFORM_VIEWER');
    renderDetail({ planCode: 'enterprise' });

    expect(screen.queryByTestId('add-byok-key-btn')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Quota editor — RBAC
  // -------------------------------------------------------------------------

  it('shows Edit Quota button for PLATFORM_ADMIN', () => {
    setUser('PLATFORM_ADMIN');
    renderDetail();

    expect(screen.getByTestId('edit-quota-btn')).toBeInTheDocument();
  });

  it('hides Edit Quota button for PLATFORM_VIEWER', () => {
    setUser('PLATFORM_VIEWER');
    renderDetail();

    expect(screen.queryByTestId('edit-quota-btn')).not.toBeInTheDocument();
  });

  it('shows quota editor when Edit Quota is clicked', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByTestId('edit-quota-btn'));

    expect(screen.getByTestId('quota-settings-editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Token Allowance')).toBeInTheDocument();
    expect(screen.getByLabelText('Soft Limit (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Hard Limit (%)')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading states
  // -------------------------------------------------------------------------

  it('shows loading state when data is loading', () => {
    mockTenantUsage.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    mockFeatureUsage.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    mockTenantQuota.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderDetail();

    // Should not crash; quota section hidden when loading
    expect(screen.queryByTestId('quota-progress-bar')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error states
  // -------------------------------------------------------------------------

  it('shows error state with retry for usage chart', () => {
    mockTenantUsage.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });

    renderDetail();

    expect(screen.getByText('Failed to load chart data')).toBeInTheDocument();
  });
});
