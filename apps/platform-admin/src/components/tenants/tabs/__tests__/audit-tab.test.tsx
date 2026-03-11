// ---------------------------------------------------------------------------
// Component Tests — Audit Tab (tenant detail, pre-filtered audit log)
// Story: E13b.6 Task 5.2
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { TenantDetail } from '@/types/tenant';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockUseAuditLog = vi.fn();
const mockUseAuditLogDetail = vi.fn();

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ isAuthenticated: true, user: { id: 'admin-1', role: 'PLATFORM_ADMIN' } }),
  ),
}));

vi.mock('@/hooks/use-audit-log', () => ({
  useAuditLog: (...args: unknown[]) => mockUseAuditLog(...args),
  useAuditLogDetail: (...args: unknown[]) => mockUseAuditLogDetail(...args),
  exportAuditLogCsv: vi.fn(),
}));

// Mock detail panel
const mockDetailPanelProps = { current: null as Record<string, unknown> | null };

vi.mock('@/components/audit/audit-log-detail-panel', () => ({
  AuditLogDetailPanel: (props: Record<string, unknown>) => {
    mockDetailPanelProps.current = props;
    return props.isOpen ? (
      <div data-testid="audit-detail-panel">
        <button onClick={props.onClose as () => void} data-testid="audit-detail-close">
          Close
        </button>
      </div>
    ) : null;
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  buildQueryString: vi.fn(() => ''),
  BASE_URL: '/api/v1',
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, ...props }: Record<string, unknown>) => (
    <a
      href={`${to}${search ? `?${new URLSearchParams(search as Record<string, string>).toString()}` : ''}`}
      {...props}
    >
      {children as React.ReactNode}
    </a>
  ),
}));

vi.mock('@/lib/audit-log-utils', () => ({
  formatAuditTimestamp: (iso: string) => {
    try {
      const d = new Date(iso);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      const seconds = String(d.getUTCSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch {
      return iso;
    }
  },
  actionBadgeClass: (action: string) => {
    if (action.startsWith('tenant.')) return 'bg-blue-100 text-blue-700';
    if (action.startsWith('platform.')) return 'bg-amber-100 text-amber-700';
    if (action.startsWith('billing.')) return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-700';
  },
}));

vi.mock('@/components/audit/copy-uuid-button', () => ({
  CopyUuidButton: ({ value }: { value: string }) => (
    <button title={value}>{value.slice(0, 8)}…</button>
  ),
}));

import { AuditTab } from '../audit-tab';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_TENANT: TenantDetail = {
  id: 'tenant-abc-123',
  code: 'acme',
  displayName: 'Acme Corp',
  legalName: 'Acme Corporation Ltd',
  status: 'ACTIVE',
  billingStatus: 'CURRENT',
  region: 'uk-south',
  sandboxEnabled: false,
  lastActivityAt: '2026-03-01T00:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  plan: { id: 'p-1', code: 'core', displayName: 'Core' },
  moduleOverrides: [],
  featureFlags: [],
  billing: null,
  aiQuota: null,
};

const MOCK_ENTRIES = [
  {
    id: 'entry-1',
    platformUser: { id: 'admin-1', email: 'admin@nexa.io', displayName: 'Admin User' },
    action: 'tenant.suspend',
    targetType: 'tenant',
    targetId: 'tenant-abc-123',
    ipAddress: '192.168.1.1',
    timestamp: '2026-03-11T14:30:00.000Z',
  },
  {
    id: 'entry-2',
    platformUser: { id: 'admin-1', email: 'admin@nexa.io', displayName: 'Admin User' },
    action: 'tenant.reactivate',
    targetType: 'tenant',
    targetId: 'tenant-abc-123',
    ipAddress: '192.168.1.1',
    timestamp: '2026-03-11T13:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultAuditLogReturn(overrides?: Record<string, unknown>) {
  return {
    data: {
      pages: [{ data: MOCK_ENTRIES, meta: { cursor: null, hasMore: false } }],
    },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    error: null,
    ...overrides,
  };
}

function renderAuditTab(tenant: TenantDetail = MOCK_TENANT) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditTab tenant={tenant} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLog.mockReturnValue(defaultAuditLogReturn());
    mockUseAuditLogDetail.mockReturnValue({ data: null, isLoading: false });
  });

  // -------------------------------------------------------------------------
  // Pre-filtered for tenant (AC#1, AC#2)
  // -------------------------------------------------------------------------

  it('calls useAuditLog with targetType and targetId pre-set to the tenant', () => {
    renderAuditTab();

    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'tenant',
        targetId: 'tenant-abc-123',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Renders audit log table
  // -------------------------------------------------------------------------

  it('renders audit log table with correct columns', () => {
    renderAuditTab();

    const table = screen.getByRole('table', { name: /tenant audit log entries/i });
    const headers = within(table).getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts).toContain('Timestamp');
    expect(headerTexts).toContain('Admin User');
    expect(headerTexts).toContain('Action');
    expect(headerTexts).toContain('Target ID');
    expect(headerTexts).toContain('IP Address');
  });

  it('renders audit log entries', () => {
    renderAuditTab();

    expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
    // Action badges
    expect(screen.getAllByText('tenant.suspend').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('tenant.reactivate').length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Tenant-related actions only in filter dropdown
  // -------------------------------------------------------------------------

  it('shows only tenant-related actions in the action filter dropdown', () => {
    renderAuditTab();

    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    const options = within(select).getAllByRole('option');

    // "All actions" + 12 tenant-related actions
    expect(options.length).toBe(13);
    expect(options[0]!.textContent).toBe('All actions');

    // Verify these are tenant-related actions (not auth.login, user.create, etc.)
    const actionValues = options.slice(1).map((o) => o.getAttribute('value'));
    expect(actionValues).toContain('tenant.suspend');
    expect(actionValues).toContain('tenant.reactivate');
    expect(actionValues).toContain('billing.enforcement_changed');
    expect(actionValues).toContain('platform.impersonation_started');
    // Should NOT contain non-tenant actions
    expect(actionValues).not.toContain('auth.login');
    expect(actionValues).not.toContain('user.create');
  });

  // -------------------------------------------------------------------------
  // Filter interaction
  // -------------------------------------------------------------------------

  it('changing action filter triggers query with action + tenant filters', async () => {
    const user = userEvent.setup();
    renderAuditTab();

    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    await user.selectOptions(select, 'tenant.suspend');

    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.suspend',
        targetType: 'tenant',
        targetId: 'tenant-abc-123',
      }),
    );
  });

  it('"Clear filters" resets action/date but keeps tenant filters', async () => {
    const user = userEvent.setup();
    renderAuditTab();

    // Set a filter
    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    await user.selectOptions(select, 'tenant.suspend');

    // Clear filters
    const clearBtn = screen.getByLabelText('Clear filters');
    await user.click(clearBtn);

    // Should still have tenant filters
    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'tenant',
        targetId: 'tenant-abc-123',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // "View full audit log" link
  // -------------------------------------------------------------------------

  it('"View full audit log" link has correct URL with tenant filters', () => {
    renderAuditTab();

    const link = screen.getByTestId('view-full-audit-log');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/audit-log?targetType=tenant&targetId=tenant-abc-123');
    expect(link).toHaveTextContent('View full audit log');
  });

  // -------------------------------------------------------------------------
  // Row click opens detail panel
  // -------------------------------------------------------------------------

  it('clicking a row opens the detail panel', async () => {
    const user = userEvent.setup();
    renderAuditTab();

    // Detail panel should not be visible initially
    expect(screen.queryByTestId('audit-detail-panel')).not.toBeInTheDocument();

    // Click the first row
    const table = screen.getByRole('table', { name: /tenant audit log entries/i });
    const rows = within(table).getAllByRole('button');
    await user.click(rows[0]!);

    // Detail panel should appear
    expect(screen.getByTestId('audit-detail-panel')).toBeInTheDocument();

    // useAuditLogDetail should be called with the entry ID
    expect(mockUseAuditLogDetail).toHaveBeenCalledWith('entry-1');
  });

  it('closing the detail panel clears selection', async () => {
    const user = userEvent.setup();
    renderAuditTab();

    // Open panel
    const table = screen.getByRole('table', { name: /tenant audit log entries/i });
    const rows = within(table).getAllByRole('button');
    await user.click(rows[0]!);

    expect(screen.getByTestId('audit-detail-panel')).toBeInTheDocument();

    // Close panel
    await user.click(screen.getByTestId('audit-detail-close'));

    expect(screen.queryByTestId('audit-detail-panel')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading & empty states
  // -------------------------------------------------------------------------

  it('shows skeleton rows during loading', () => {
    mockUseAuditLog.mockReturnValue(
      defaultAuditLogReturn({ data: { pages: [] }, isLoading: true }),
    );
    renderAuditTab();

    const table = screen.getByRole('table', { name: /tenant audit log entries/i });
    const rows = within(table).getAllByRole('row');
    // 1 header row + 5 skeleton rows
    expect(rows.length).toBe(6);
  });

  it('shows empty state when no entries found', () => {
    mockUseAuditLog.mockReturnValue(
      defaultAuditLogReturn({
        data: { pages: [{ data: [], meta: { cursor: null, hasMore: false } }] },
      }),
    );
    renderAuditTab();

    expect(screen.getByText('No audit log entries found for this tenant')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  it('"Load more" button appears when hasNextPage is true', () => {
    mockUseAuditLog.mockReturnValue(defaultAuditLogReturn({ hasNextPage: true }));
    renderAuditTab();

    expect(screen.getByText('Load more')).toBeInTheDocument();
  });
});
