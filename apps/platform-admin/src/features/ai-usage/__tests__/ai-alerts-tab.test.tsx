// ---------------------------------------------------------------------------
// Component Tests — AI Alerts Tab
// Story E13b-4 Task 5.4 (AC#3, AC#4)
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';
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

// Mock the hooks
const mockAlerts = vi.fn();
const mockAcknowledgeMutate = vi.fn();
let mockAcknowledgeIsPending = false;
let mockAcknowledgeVariables: string | undefined;

vi.mock('../hooks/use-ai-usage', () => ({
  useAiAlerts: (filters?: Record<string, unknown>) => mockAlerts(filters),
  useAcknowledgeAlert: () => ({
    mutate: mockAcknowledgeMutate,
    isPending: mockAcknowledgeIsPending,
    variables: mockAcknowledgeVariables,
  }),
}));

import { AiAlertsTab } from '../components/ai-alerts-tab';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_ALERTS = [
  {
    id: 'alert-1',
    type: 'QUOTA_WARNING' as const,
    tenantId: 't-1',
    tenantCode: 'acme',
    tenantName: 'Acme Corp',
    message: 'Acme Corp has used 82% of their token allowance',
    usagePct: 82.3,
    threshold: 80,
    dailyTokens: null,
    rollingAvgTokens: null,
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: 'alert-2',
    type: 'QUOTA_EXCEEDED' as const,
    tenantId: 't-2',
    tenantCode: 'globex',
    tenantName: 'Globex Inc',
    message: 'Globex Inc has exceeded their token allowance (105%)',
    usagePct: 105.0,
    threshold: 100,
    dailyTokens: null,
    rollingAvgTokens: null,
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
  {
    id: 'alert-3',
    type: 'USAGE_SPIKE' as const,
    tenantId: 't-3',
    tenantCode: 'wayne',
    tenantName: 'Wayne Enterprises',
    message: 'Wayne Enterprises daily usage is 4.2x their 7-day average',
    usagePct: 420.0,
    threshold: 300,
    dailyTokens: 500000,
    rollingAvgTokens: 119000,
    acknowledged: true,
    acknowledgedBy: 'admin-1',
    acknowledgedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
  },
];

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

function renderAlertsTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiAlertsTab />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiAlertsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    mockAcknowledgeIsPending = false;
    mockAcknowledgeVariables = undefined;
    mockAlerts.mockReturnValue({
      data: MOCK_ALERTS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders alert list with correct number of items', () => {
    renderAlertsTab();

    const list = screen.getByRole('list', { name: /ai usage alerts/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('renders alert tenant names as clickable links', () => {
    renderAlertsTab();

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
    expect(screen.getByText('Wayne Enterprises')).toBeInTheDocument();

    const links = screen.getAllByTestId('tenant-link');
    expect(links).toHaveLength(3);
  });

  it('renders alert messages', () => {
    renderAlertsTab();

    expect(screen.getByText('Acme Corp has used 82% of their token allowance')).toBeInTheDocument();
    expect(
      screen.getByText('Globex Inc has exceeded their token allowance (105%)'),
    ).toBeInTheDocument();
  });

  it('shows usage percentage for each alert', () => {
    renderAlertsTab();

    expect(screen.getByText('Usage: 82.3%')).toBeInTheDocument();
    expect(screen.getByText('Usage: 105.0%')).toBeInTheDocument();
    expect(screen.getByText('Usage: 420.0%')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Alert type styling (5.2)
  // -------------------------------------------------------------------------

  it('renders correct badge labels for each alert type', () => {
    renderAlertsTab();

    const list = screen.getByRole('list', { name: /ai usage alerts/i });
    expect(within(list).getByText('Quota Warning')).toBeInTheDocument();
    expect(within(list).getByText('Quota Exceeded')).toBeInTheDocument();
    expect(within(list).getByText('Usage Spike')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Empty state (5.3)
  // -------------------------------------------------------------------------

  it('shows empty state when no alerts exist', () => {
    mockAlerts.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderAlertsTab();

    expect(screen.getByText('No active alerts')).toBeInTheDocument();
    expect(screen.getByText('All tenants are within their usage limits.')).toBeInTheDocument();
  });

  it('shows empty state when data is null', () => {
    mockAlerts.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderAlertsTab();

    expect(screen.getByText('No active alerts')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading & Error states
  // -------------------------------------------------------------------------

  it('shows loading spinner when loading', () => {
    mockAlerts.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    renderAlertsTab();

    // Should not render any alerts or empty state
    expect(screen.queryByText('No active alerts')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows error state with retry button', async () => {
    const mockRefetch = vi.fn();
    mockAlerts.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
    });
    renderAlertsTab();

    expect(screen.getByText('Failed to load alerts')).toBeInTheDocument();

    const retryButton = screen.getByText('Retry');
    await userEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  it('renders filter dropdowns', () => {
    renderAlertsTab();

    expect(screen.getByLabelText('Filter by alert type')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
  });

  it('calls useAiAlerts with type filter when changed', async () => {
    const user = userEvent.setup();
    renderAlertsTab();

    const typeSelect = screen.getByLabelText('Filter by alert type');
    await user.selectOptions(typeSelect, 'QUOTA_WARNING');

    // The hook should have been called with the new filter
    expect(mockAlerts).toHaveBeenCalledWith(expect.objectContaining({ type: 'QUOTA_WARNING' }));
  });

  it('defaults to showing active (unacknowledged) alerts', () => {
    renderAlertsTab();

    // Default filter: acknowledged = false
    expect(mockAlerts).toHaveBeenCalledWith(expect.objectContaining({ acknowledged: false }));
  });

  it('calls useAiAlerts with acknowledged filter when changed', async () => {
    const user = userEvent.setup();
    renderAlertsTab();

    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'true');

    expect(mockAlerts).toHaveBeenCalledWith(expect.objectContaining({ acknowledged: true }));
  });

  // -------------------------------------------------------------------------
  // Acknowledge button — RBAC
  // -------------------------------------------------------------------------

  it('shows Acknowledge button for PLATFORM_ADMIN on unacknowledged alerts', () => {
    setUser('PLATFORM_ADMIN');
    renderAlertsTab();

    // 2 unacknowledged alerts (alert-1, alert-2), alert-3 is acknowledged
    const ackButtons = screen.getAllByRole('button', { name: /acknowledge/i });
    expect(ackButtons).toHaveLength(2);
  });

  it('hides Acknowledge button for PLATFORM_VIEWER', () => {
    setUser('PLATFORM_VIEWER');
    renderAlertsTab();

    expect(screen.queryByRole('button', { name: /acknowledge/i })).not.toBeInTheDocument();
  });

  it('calls acknowledge mutation when button is clicked', async () => {
    const user = userEvent.setup();
    renderAlertsTab();

    const ackButtons = screen.getAllByRole('button', { name: /acknowledge/i });
    await user.click(ackButtons[0]!);

    expect(mockAcknowledgeMutate).toHaveBeenCalledWith('alert-1');
  });

  it('shows acknowledged status on acknowledged alerts', () => {
    renderAlertsTab();

    const list = screen.getByRole('list', { name: /ai usage alerts/i });
    expect(within(list).getByText('Acknowledged')).toBeInTheDocument();
  });

  it('does not show Acknowledge button on already-acknowledged alerts', () => {
    // Only alert-3 is acknowledged — should have no button for it
    renderAlertsTab();

    // There should be exactly 2 acknowledge buttons (for alert-1 and alert-2)
    const ackButtons = screen.getAllByRole('button', { name: /acknowledge/i });
    expect(ackButtons).toHaveLength(2);
  });
});
