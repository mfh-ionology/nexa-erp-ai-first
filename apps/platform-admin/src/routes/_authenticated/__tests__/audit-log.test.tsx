// ---------------------------------------------------------------------------
// Component Tests — Audit Log Page
// Story: E13b.6 Task 3.4
// Table columns, filters, pagination, export, loading/empty states
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted state
// ---------------------------------------------------------------------------

const { capturedRef, mockUser } = vi.hoisted(() => ({
  capturedRef: { current: null as React.ComponentType | null },
  mockUser: {
    current: {
      id: 'admin-1',
      email: 'admin@nexa.io',
      displayName: 'Admin User',
      role: 'PLATFORM_ADMIN',
    } as { id: string; email: string; displayName: string; role: string } | null,
  },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ isAuthenticated: true, user: mockUser.current }),
    ),
    {
      getState: () => ({ accessToken: 'test-token', isAuthenticated: true }),
    },
  ),
}));

const mockSearchParams = { current: {} as Record<string, unknown> };

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => {
    capturedRef.current = opts.component;
    const route = {
      ...opts,
      useSearch: () => mockSearchParams.current,
    };
    return route;
  },
  useNavigate: () => vi.fn(),
}));

// Mock audit log hooks
const mockUseAuditLog = vi.fn();
const mockExportAuditLogCsv = vi.fn();

vi.mock('@/hooks/use-audit-log', () => ({
  useAuditLog: (...args: unknown[]) => mockUseAuditLog(...args),
  useAuditLogDetail: vi.fn().mockReturnValue({ data: null, isLoading: false }),
  exportAuditLogCsv: (...args: unknown[]) => mockExportAuditLogCsv(...args),
}));

// Mock detail panel component
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

// Mock api-client for the platform users fetch
const mockApiGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  buildQueryString: vi.fn().mockReturnValue(''),
  BASE_URL: '/api/v1',
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
    if (action.startsWith('auth.')) return 'bg-green-100 text-green-700';
    if (action.startsWith('user.')) return 'bg-purple-100 text-purple-700';
    if (action.startsWith('platform.')) return 'bg-amber-100 text-amber-700';
    if (action.startsWith('billing.')) return 'bg-orange-100 text-orange-700';
    if (action.startsWith('ai.')) return 'bg-cyan-100 text-cyan-700';
    if (action.startsWith('knowledge.')) return 'bg-teal-100 text-teal-700';
    return 'bg-slate-100 text-slate-700';
  },
}));

vi.mock('@/components/audit/copy-uuid-button', () => ({
  CopyUuidButton: ({ value }: { value: string }) => (
    <button title={value}>{value.slice(0, 8)}…</button>
  ),
}));

// Import module — triggers createFileRoute mock which captures the component
import '../audit-log';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_ENTRIES = [
  {
    id: 'entry-1',
    platformUser: { id: 'admin-1', email: 'admin@nexa.io', displayName: 'Admin User' },
    action: 'tenant.create',
    targetType: 'tenant',
    targetId: '550e8400-e29b-41d4-a716-446655440001',
    ipAddress: '192.168.1.1',
    timestamp: '2026-03-11T14:30:00.000Z',
  },
  {
    id: 'entry-2',
    platformUser: { id: 'admin-2', email: 'viewer@nexa.io', displayName: 'Viewer User' },
    action: 'auth.login',
    targetType: null,
    targetId: null,
    ipAddress: '10.0.0.5',
    timestamp: '2026-03-11T13:00:00.000Z',
  },
  {
    id: 'entry-3',
    platformUser: { id: 'admin-1', email: 'admin@nexa.io', displayName: 'Admin User' },
    action: 'platform.impersonation_started',
    targetType: 'impersonation_session',
    targetId: '660e8400-e29b-41d4-a716-446655440002',
    ipAddress: '192.168.1.1',
    timestamp: '2026-03-11T12:00:00.000Z',
  },
];

const MOCK_USERS = [
  { id: 'admin-1', email: 'admin@nexa.io', displayName: 'Admin User' },
  { id: 'admin-2', email: 'viewer@nexa.io', displayName: 'Viewer User' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage() {
  if (!capturedRef.current) {
    throw new Error('Component not captured — ensure audit-log.tsx is imported');
  }
  const qc = createQueryClient();
  const Component = capturedRef.current;
  return render(
    <QueryClientProvider client={qc}>
      <Component />
    </QueryClientProvider>,
  );
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = {
      id: 'admin-1',
      email: 'admin@nexa.io',
      displayName: 'Admin User',
      role: 'PLATFORM_ADMIN',
    };
    mockSearchParams.current = {};

    mockUseAuditLog.mockReturnValue(defaultAuditLogReturn());

    // Mock platform users endpoint for filter dropdown
    mockApiGet.mockResolvedValue({ data: MOCK_USERS, meta: {} });
  });

  // -------------------------------------------------------------------------
  // Page rendering & headers
  // -------------------------------------------------------------------------

  it('renders page title and description', () => {
    renderPage();

    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(
      screen.getByText('Immutable platform audit trail — all admin actions are recorded'),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // URL search params initialize filters (Issue #1 fix)
  // -------------------------------------------------------------------------

  it('initializes filters from URL search params', () => {
    mockSearchParams.current = { targetType: 'tenant', targetId: 'abc-123' };
    renderPage();

    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'tenant',
        targetId: 'abc-123',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Table columns (AC#1)
  // -------------------------------------------------------------------------

  it('renders table with correct column headers', () => {
    renderPage();

    const table = screen.getByRole('table', { name: /audit log entries/i });
    const thead = within(table).getAllByRole('columnheader');
    const headerTexts = thead.map((th) => th.textContent);

    expect(headerTexts).toContain('Timestamp');
    expect(headerTexts).toContain('Admin User');
    expect(headerTexts).toContain('Action');
    expect(headerTexts).toContain('Target Type');
    expect(headerTexts).toContain('Target ID');
    expect(headerTexts).toContain('IP Address');
  });

  it('renders audit log entries with correct data', () => {
    renderPage();

    // Entry 1 — "Admin User" appears in header, filter label, and data rows
    expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
    // Action badges in the table body (also in the dropdown options)
    expect(screen.getAllByText('tenant.create').length).toBeGreaterThanOrEqual(1);
    // IP 192.168.1.1 shared by entries 1 and 3
    expect(screen.getAllByText('192.168.1.1').length).toBe(2);

    // Entry 2
    expect(screen.getByText('Viewer User')).toBeInTheDocument();
    expect(screen.getAllByText('auth.login').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
  });

  it('renders formatted timestamps', () => {
    renderPage();

    // 2026-03-11T14:30:00.000Z → "11/03/2026 14:30:00"
    expect(screen.getByText('11/03/2026 14:30:00')).toBeInTheDocument();
  });

  it('renders target type or dash for null', () => {
    renderPage();

    // Entry 1 has targetType "tenant", entry 2 has null
    expect(screen.getByText('tenant')).toBeInTheDocument();
    // Dash for null targetType/targetId
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders truncated target IDs with copy button', () => {
    renderPage();

    // UUID starts with "550e8400" → truncated to "550e8400…"
    expect(screen.getByText('550e8400…')).toBeInTheDocument();
  });

  it('renders action as badge-styled element', () => {
    renderPage();

    // "tenant.create" appears both in the action filter dropdown and the table badge
    const allMatches = screen.getAllByText('tenant.create');
    // Find the one that is a badge (span with rounded-full class)
    const badge = allMatches.find(
      (el) => el.tagName === 'SPAN' && el.className.includes('rounded-full'),
    );
    expect(badge).toBeDefined();
    expect(badge!.className).toContain('bg-blue-100');
  });

  // -------------------------------------------------------------------------
  // Filter dropdowns render with expected options (AC#2, AC#3)
  // -------------------------------------------------------------------------

  it('renders action filter dropdown with known actions', () => {
    renderPage();

    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    const options = within(select).getAllByRole('option');

    // "All actions" + 19 known actions
    expect(options.length).toBe(20);
    expect(options[0]!.textContent).toBe('All actions');
    expect(options[1]!.textContent).toBe('auth.login');
  });

  it('renders target type filter dropdown', () => {
    renderPage();

    const select = screen.getByLabelText('Target Type') as HTMLSelectElement;
    const options = within(select).getAllByRole('option');

    expect(options.length).toBe(5);
    expect(options[0]!.textContent).toBe('All targets');
  });

  it('renders date range inputs', () => {
    renderPage();

    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Filter interaction triggers new query (AC#2, AC#3)
  // -------------------------------------------------------------------------

  it('changing action filter triggers new query with filter param', async () => {
    const user = userEvent.setup();
    renderPage();

    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    await user.selectOptions(select, 'tenant.suspend');

    // useAuditLog should be called with filters containing action
    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant.suspend' }),
    );
  });

  it('changing target type filter triggers new query', async () => {
    const user = userEvent.setup();
    renderPage();

    const select = screen.getByLabelText('Target Type') as HTMLSelectElement;
    await user.selectOptions(select, 'tenant');

    expect(mockUseAuditLog).toHaveBeenCalledWith(expect.objectContaining({ targetType: 'tenant' }));
  });

  it('changing date range triggers new query with from/to params', async () => {
    const user = userEvent.setup();
    renderPage();

    const fromInput = screen.getByLabelText('From') as HTMLInputElement;
    await user.type(fromInput, '2026-03-01');

    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-03-01T00:00:00.000Z' }),
    );
  });

  // -------------------------------------------------------------------------
  // Clear filters
  // -------------------------------------------------------------------------

  it('"Clear filters" resets all filters and refetches', async () => {
    const user = userEvent.setup();
    renderPage();

    // Set a filter first
    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    await user.selectOptions(select, 'auth.login');

    // Clear filters button should appear
    const clearBtn = screen.getByLabelText('Clear filters');
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);

    // Should be called with empty filters
    expect(mockUseAuditLog).toHaveBeenCalledWith({});
  });

  // -------------------------------------------------------------------------
  // Pagination — "Load more"
  // -------------------------------------------------------------------------

  it('"Load more" button appears when hasNextPage is true', () => {
    mockUseAuditLog.mockReturnValue(defaultAuditLogReturn({ hasNextPage: true }));
    renderPage();

    expect(screen.getByText('Load more')).toBeInTheDocument();
  });

  it('"Load more" fetches next page on click', async () => {
    const mockFetchNext = vi.fn();
    mockUseAuditLog.mockReturnValue(
      defaultAuditLogReturn({ hasNextPage: true, fetchNextPage: mockFetchNext }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Load more'));

    expect(mockFetchNext).toHaveBeenCalled();
  });

  it('"Load more" is hidden when hasNextPage is false', () => {
    mockUseAuditLog.mockReturnValue(defaultAuditLogReturn({ hasNextPage: false }));
    renderPage();

    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Export CSV
  // -------------------------------------------------------------------------

  it('"Export CSV" button is rendered', () => {
    renderPage();

    expect(screen.getByLabelText('Export CSV')).toBeInTheDocument();
  });

  it('"Export CSV" button triggers download', async () => {
    mockExportAuditLogCsv.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText('Export CSV'));

    expect(mockExportAuditLogCsv).toHaveBeenCalledWith({});
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('loading state shows skeleton rows', () => {
    mockUseAuditLog.mockReturnValue(
      defaultAuditLogReturn({
        data: { pages: [] },
        isLoading: true,
      }),
    );
    renderPage();

    // Skeleton rows use animate-pulse class
    const table = screen.getByRole('table', { name: /audit log entries/i });
    const rows = within(table).getAllByRole('row');
    // 1 header row + 8 skeleton rows
    expect(rows.length).toBe(9);
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('empty state renders "No audit log entries found" with icon', () => {
    mockUseAuditLog.mockReturnValue(
      defaultAuditLogReturn({
        data: { pages: [{ data: [], meta: { cursor: null, hasMore: false } }] },
      }),
    );
    renderPage();

    expect(screen.getByText('No audit log entries found')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Row click sets selected entry
  // -------------------------------------------------------------------------

  it('clicking a row highlights it', async () => {
    const user = userEvent.setup();
    renderPage();

    // Find table rows with role="button" (the <tr> elements, not <button> elements)
    const table = screen.getByRole('table', { name: /audit log entries/i });
    const rows = within(table).getAllByRole('button');
    const firstRow = rows[0]!;
    await user.click(firstRow);

    // The row should have the selected background class
    expect(firstRow.className).toContain('bg-muted/50');
  });

  // -------------------------------------------------------------------------
  // Detail panel wiring (Task 4.2)
  // -------------------------------------------------------------------------

  it('detail panel is initially closed', () => {
    renderPage();

    expect(screen.queryByTestId('audit-detail-panel')).not.toBeInTheDocument();
  });

  it('clicking a row opens the detail panel', async () => {
    const user = userEvent.setup();
    renderPage();

    const table = screen.getByRole('table', { name: /audit log entries/i });
    const rows = within(table).getAllByRole('button');
    await user.click(rows[0]!);

    expect(screen.getByTestId('audit-detail-panel')).toBeInTheDocument();
  });

  it('closing the detail panel clears selection', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open panel by clicking a row
    const table = screen.getByRole('table', { name: /audit log entries/i });
    const rows = within(table).getAllByRole('button');
    await user.click(rows[0]!);

    expect(screen.getByTestId('audit-detail-panel')).toBeInTheDocument();

    // Close panel
    await user.click(screen.getByTestId('audit-detail-close'));

    expect(screen.queryByTestId('audit-detail-panel')).not.toBeInTheDocument();
  });
});
