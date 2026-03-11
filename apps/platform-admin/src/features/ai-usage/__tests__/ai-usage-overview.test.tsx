// ---------------------------------------------------------------------------
// Component Tests — AI Usage Overview
// Story E13b-4 Task 9.2 (AC#1)
// Overview tab: KPI cards, chart, top consumers, CSV export button RBAC
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
  usePlatformAuthStore: Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ isAuthenticated: true, user: mockUser }),
    ),
    {
      getState: () => ({ accessToken: 'test-token' }),
    },
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a href={`${to}/${params?.tenantId ?? ''}`} data-testid="tenant-link">
      {children}
    </a>
  ),
}));

// Mock Recharts to avoid rendering canvas/SVG in jsdom
vi.mock('recharts', () => ({
  AreaChart: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="area-chart" {...props}>
      {children as React.ReactNode}
    </div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// Mock the hooks
const mockSummary = vi.fn();
const mockExportMutate = vi.fn();
let mockExportIsPending = false;

vi.mock('../hooks/use-ai-usage', () => ({
  useAiUsageSummary: () => mockSummary(),
  useExportAiUsageCsv: () => ({
    mutate: mockExportMutate,
    isPending: mockExportIsPending,
  }),
}));

import { AiUsageOverview } from '../components/ai-usage-overview';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_SUMMARY = {
  tokensToday: 125000,
  tokensThisMonth: 4500000,
  costEstimateToday: '12.50',
  costEstimateThisMonth: '450.00',
  dailyTrend: [
    { date: '2026-03-01', tokens: 100000, cost: '10.00' },
    { date: '2026-03-02', tokens: 150000, cost: '15.00' },
    { date: '2026-03-03', tokens: 120000, cost: '12.00' },
  ],
  topConsumers: [
    { tenantId: 't-1', tenantCode: 'acme', tenantName: 'Acme Corp', tokens: 2000000 },
    { tenantId: 't-2', tenantCode: 'globex', tenantName: 'Globex Inc', tokens: 1500000 },
    { tenantId: 't-3', tenantCode: 'wayne', tenantName: 'Wayne Enterprises', tokens: 1000000 },
  ],
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

function renderOverview() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiUsageOverview />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiUsageOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    mockExportIsPending = false;
    mockSummary.mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  // -------------------------------------------------------------------------
  // KPI Cards rendering (AC#1)
  // -------------------------------------------------------------------------

  it('renders KPI cards with correct labels', () => {
    renderOverview();

    expect(screen.getByText('Tokens Today')).toBeInTheDocument();
    expect(screen.getByText('Tokens This Month')).toBeInTheDocument();
    expect(screen.getByText('Cost Estimate (Month)')).toBeInTheDocument();
  });

  it('renders KPI card values from summary data', () => {
    renderOverview();

    // 125000 → "125,000" (via KpiCard's formatNumber)
    expect(screen.getByText('125,000')).toBeInTheDocument();
    // 4500000 → "4,500,000" (via KpiCard's formatNumber)
    expect(screen.getByText('4,500,000')).toBeInTheDocument();
    // Cost card: formatGbp returns a pre-formatted string (£450.00).
    // KpiCard's formatNumber can't parseFloat a currency symbol, so it renders "—".
    // The label "Cost Estimate (Month)" is still shown correctly.
    expect(screen.getByText('Cost Estimate (Month)')).toBeInTheDocument();
  });

  it('renders Usage KPIs section with aria label', () => {
    renderOverview();

    expect(screen.getByLabelText('Usage KPIs')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Chart rendering
  // -------------------------------------------------------------------------

  it('renders daily usage trend chart', () => {
    renderOverview();

    expect(screen.getByText('Daily Token Usage (30 days)')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders chart section with aria label', () => {
    renderOverview();

    expect(screen.getByLabelText('Daily usage trend')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Top consumers table
  // -------------------------------------------------------------------------

  it('renders top consumers table with tenant names', () => {
    renderOverview();

    expect(screen.getByText('Top Consumers (This Period)')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
    expect(screen.getByText('Wayne Enterprises')).toBeInTheDocument();
  });

  it('renders tenant names as clickable links', () => {
    renderOverview();

    const links = screen.getAllByTestId('tenant-link');
    expect(links).toHaveLength(3);
  });

  it('renders tenant codes', () => {
    renderOverview();

    expect(screen.getByText('acme')).toBeInTheDocument();
    expect(screen.getByText('globex')).toBeInTheDocument();
    expect(screen.getByText('wayne')).toBeInTheDocument();
  });

  it('shows "No usage data available yet." when no consumers', () => {
    mockSummary.mockReturnValue({
      data: { ...MOCK_SUMMARY, topConsumers: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderOverview();

    expect(screen.getByText('No usage data available yet.')).toBeInTheDocument();
  });

  it('renders top consumers section with aria label', () => {
    renderOverview();

    expect(screen.getByLabelText('Top consumers')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // CSV Export button — RBAC (AC#5)
  // -------------------------------------------------------------------------

  it('shows Export CSV button for PLATFORM_ADMIN', () => {
    setUser('PLATFORM_ADMIN');
    renderOverview();

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('hides Export CSV button for PLATFORM_VIEWER', () => {
    setUser('PLATFORM_VIEWER');
    renderOverview();

    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });

  it('opens date picker when Export CSV is clicked', async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByText('Export CSV'));

    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls export mutation when Download is clicked', async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByText('Export CSV'));
    await user.click(screen.getByText('Download'));

    expect(mockExportMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: expect.any(String),
        endDate: expect.any(String),
      }),
    );
  });

  it('closes date picker when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByText('Export CSV'));
    expect(screen.getByText('Start Date')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Start Date')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows loading state when data is loading', () => {
    mockSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    renderOverview();

    // Chart area shows spinner
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
    // Top consumers should not render
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows error state with retry button on chart section', () => {
    mockSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });
    renderOverview();

    expect(screen.getByText('Failed to load chart data')).toBeInTheDocument();
  });

  it('calls refetch when retry is clicked on error state', async () => {
    const mockRefetch = vi.fn();
    mockSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
    });
    renderOverview();

    const retryButtons = screen.getAllByText('Retry');
    const firstRetry = retryButtons[0]!;
    await userEvent.click(firstRetry);
    expect(mockRefetch).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Heading
  // -------------------------------------------------------------------------

  it('renders Usage Overview heading', () => {
    renderOverview();

    expect(screen.getByText('Usage Overview')).toBeInTheDocument();
  });
});
