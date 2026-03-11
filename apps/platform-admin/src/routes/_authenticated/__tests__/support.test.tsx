// ---------------------------------------------------------------------------
// Component Tests — Support Console Page
// Story: E13b.5 Task 5.4
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted state (accessible inside vi.mock factories)
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
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: mockUser.current }),
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => {
    capturedRef.current = opts.component;
    return opts;
  },
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUseSupportSearch = vi.fn();
const mockUseImpersonationSessions = vi.fn();
const mockEndSessionMutate = vi.fn();

vi.mock('@/hooks/use-support-search', () => ({
  useSupportSearch: (...args: unknown[]) => mockUseSupportSearch(...args),
  useImpersonationSessions: () => mockUseImpersonationSessions(),
  useEndImpersonationSession: () => ({
    mutate: mockEndSessionMutate,
    isPending: false,
  }),
}));

vi.mock('@/components/tenants/impersonation-dialog', () => ({
  ImpersonationDialog: ({
    open,
    tenantName,
  }: {
    open: boolean;
    tenantName: string;
    tenantId: string;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <div data-testid="impersonation-dialog">Dialog for {tenantName}</div> : null),
}));

// Import module — triggers createFileRoute mock which captures the component
import '../support';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function setUser(role: string) {
  mockUser.current = {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@nexa.io`,
    displayName: `${role} User`,
    role,
  };
}

const SAMPLE_RESULTS = [
  {
    id: 'tenant-1',
    code: 'acme',
    displayName: 'Acme Corp',
    status: 'ACTIVE',
    planCode: 'pro',
    billingStatus: 'CURRENT',
    lastActivityAt: '2026-03-10T12:00:00Z',
    matchField: 'displayName',
    matchValue: 'Acme Corp',
  },
  {
    id: 'tenant-2',
    code: 'globex',
    displayName: 'Globex Inc',
    status: 'SUSPENDED',
    planCode: 'core',
    billingStatus: 'OVERDUE',
    lastActivityAt: null,
    matchField: 'code',
    matchValue: 'globex',
  },
];

const SAMPLE_SESSIONS = [
  {
    id: 'session-1',
    platformUser: { id: 'admin-1', email: 'admin@nexa.io', displayName: 'Admin User' },
    tenant: { id: 'tenant-1', code: 'acme', displayName: 'Acme Corp' },
    reason: 'Investigating billing issue',
    startedAt: '2026-03-11T10:00:00Z',
    endedAt: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    actionsCount: 5,
  },
  {
    id: 'session-2',
    platformUser: { id: 'admin-1', email: 'admin@nexa.io', displayName: 'Admin User' },
    tenant: { id: 'tenant-2', code: 'globex', displayName: 'Globex Inc' },
    reason: 'Customer data migration help',
    startedAt: '2026-03-10T14:00:00Z',
    endedAt: '2026-03-10T14:45:00Z',
    expiresAt: '2026-03-10T15:00:00Z',
    actionsCount: 12,
  },
];

function renderPage() {
  if (!capturedRef.current) {
    throw new Error('Component not captured — ensure support.tsx is imported');
  }
  const qc = createQueryClient();
  const Component = capturedRef.current;
  return render(
    <QueryClientProvider client={qc}>
      <Component />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupportConsolePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');

    mockUseSupportSearch.mockReturnValue({
      results: [],
      total: 0,
      isLoading: false,
      error: null,
    });
    mockUseImpersonationSessions.mockReturnValue({
      data: { data: { items: [], total: 0, hasMore: false } },
      isLoading: false,
    });
  });

  describe('Search UI', () => {
    it('renders search input and type filter', () => {
      renderPage();

      expect(screen.getByTestId('support-search-input')).toBeInTheDocument();
      expect(screen.getByTestId('support-type-filter')).toBeInTheDocument();
    });

    it('renders all search type filter options', () => {
      renderPage();

      const select = screen.getByTestId('support-type-filter') as HTMLSelectElement;
      const options = within(select).getAllByRole('option');

      expect(options).toHaveLength(5);
      expect(options.map((o) => o.textContent)).toEqual(['All', 'Domain', 'Name', 'Email', 'ID']);
    });

    it('shows empty state when no search query', () => {
      renderPage();

      expect(screen.getByTestId('support-empty-state')).toBeInTheDocument();
      expect(
        screen.getByText(/Search for tenants by name, code, email, or ID/),
      ).toBeInTheDocument();
    });

    it('passes search input to hook', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByTestId('support-search-input'), 'acme');

      expect(mockUseSupportSearch).toHaveBeenCalledWith('acme', undefined);
    });

    it('passes selected type filter to hook', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.selectOptions(screen.getByTestId('support-type-filter'), 'email');
      await user.type(screen.getByTestId('support-search-input'), 'test');

      expect(mockUseSupportSearch).toHaveBeenCalledWith('test', 'email');
    });
  });

  describe('Search Results', () => {
    it('displays results in table format', () => {
      mockUseSupportSearch.mockReturnValue({
        results: SAMPLE_RESULTS,
        total: 2,
        isLoading: false,
        error: null,
      });

      renderPage();

      expect(screen.getByTestId('support-result-tenant-1')).toBeInTheDocument();
      expect(screen.getByTestId('support-result-tenant-2')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Globex Inc')).toBeInTheDocument();
    });

    it('shows loading skeleton during search', () => {
      mockUseSupportSearch.mockReturnValue({
        results: [],
        total: 0,
        isLoading: true,
        error: null,
      });

      renderPage();

      const skeletonRows = screen.getAllByTestId('skeleton-row');
      expect(skeletonRows.length).toBeGreaterThan(0);
    });

    it('shows no-results message when search returns empty', async () => {
      mockUseSupportSearch.mockReturnValue({
        results: [],
        total: 0,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByTestId('support-search-input'), 'xyz');

      expect(screen.getByTestId('support-no-results')).toBeInTheDocument();
    });

    it('shows result count footer when search query is active', async () => {
      mockUseSupportSearch.mockReturnValue({
        results: SAMPLE_RESULTS,
        total: 2,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      renderPage();

      // Must type >= 2 chars for hasSearchQuery to be true
      await user.type(screen.getByTestId('support-search-input'), 'ac');

      expect(screen.getByText('2 results found')).toBeInTheDocument();
    });

    it('shows match field badge for each result', () => {
      mockUseSupportSearch.mockReturnValue({
        results: SAMPLE_RESULTS,
        total: 2,
        isLoading: false,
        error: null,
      });

      renderPage();

      expect(screen.getByText('displayName')).toBeInTheDocument();
      expect(screen.getByText('code')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    beforeEach(() => {
      mockUseSupportSearch.mockReturnValue({
        results: SAMPLE_RESULTS,
        total: 2,
        isLoading: false,
        error: null,
      });
    });

    it('shows View and Impersonate buttons for PLATFORM_ADMIN', () => {
      setUser('PLATFORM_ADMIN');
      renderPage();

      expect(screen.getByTestId('view-tenant-tenant-1')).toBeInTheDocument();
      expect(screen.getByTestId('impersonate-tenant-tenant-1')).toBeInTheDocument();
    });

    it('hides Impersonate button for PLATFORM_VIEWER', () => {
      setUser('PLATFORM_VIEWER');
      renderPage();

      expect(screen.getByTestId('view-tenant-tenant-1')).toBeInTheDocument();
      expect(screen.queryByTestId('impersonate-tenant-tenant-1')).not.toBeInTheDocument();
    });

    it('disables Impersonate button for non-ACTIVE tenants', () => {
      setUser('PLATFORM_ADMIN');
      renderPage();

      const btn = screen.getByTestId('impersonate-tenant-tenant-2');
      expect(btn).toBeDisabled();
    });

    it('enables Impersonate button for ACTIVE tenants', () => {
      setUser('PLATFORM_ADMIN');
      renderPage();

      const btn = screen.getByTestId('impersonate-tenant-tenant-1');
      expect(btn).not.toBeDisabled();
    });

    it('shows Runbook button as disabled (coming soon)', () => {
      renderPage();

      const btn = screen.getByTestId('runbook-tenant-tenant-1');
      expect(btn).toBeDisabled();
    });

    it('opens impersonation dialog on Impersonate click', async () => {
      setUser('PLATFORM_ADMIN');
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('impersonate-tenant-tenant-1'));

      expect(screen.getByTestId('impersonation-dialog')).toBeInTheDocument();
      expect(screen.getByText('Dialog for Acme Corp')).toBeInTheDocument();
    });
  });

  describe('Impersonation Sessions History', () => {
    it('renders recent sessions section heading', () => {
      renderPage();

      expect(screen.getByText('Recent Impersonation Sessions')).toBeInTheDocument();
    });

    it('shows empty message when no sessions', () => {
      renderPage();

      expect(screen.getByTestId('sessions-empty')).toBeInTheDocument();
      expect(screen.getByText('No impersonation sessions in the last 30 days')).toBeInTheDocument();
    });

    it('renders session rows with correct data', () => {
      mockUseImpersonationSessions.mockReturnValue({
        data: { data: { items: SAMPLE_SESSIONS, total: 2, hasMore: false } },
        isLoading: false,
      });

      renderPage();

      expect(screen.getByTestId('session-row-session-1')).toBeInTheDocument();
      expect(screen.getByTestId('session-row-session-2')).toBeInTheDocument();
    });

    it('shows active session with active status badge', () => {
      mockUseImpersonationSessions.mockReturnValue({
        data: { data: { items: SAMPLE_SESSIONS, total: 2, hasMore: false } },
        isLoading: false,
      });

      renderPage();

      expect(screen.getByTestId('session-status-active')).toBeInTheDocument();
      expect(screen.getByTestId('session-status-active')).toHaveTextContent('Active');
    });

    it('shows ended session with ended status badge', () => {
      mockUseImpersonationSessions.mockReturnValue({
        data: { data: { items: SAMPLE_SESSIONS, total: 2, hasMore: false } },
        isLoading: false,
      });

      renderPage();

      expect(screen.getByTestId('session-status-ended')).toBeInTheDocument();
    });

    it('shows End Session button for active sessions (PLATFORM_ADMIN)', () => {
      setUser('PLATFORM_ADMIN');
      mockUseImpersonationSessions.mockReturnValue({
        data: { data: { items: SAMPLE_SESSIONS, total: 2, hasMore: false } },
        isLoading: false,
      });

      renderPage();

      expect(screen.getByTestId('end-session-session-1')).toBeInTheDocument();
    });

    it('calls endSession mutation on End Session click', async () => {
      setUser('PLATFORM_ADMIN');
      mockUseImpersonationSessions.mockReturnValue({
        data: { data: { items: SAMPLE_SESSIONS, total: 2, hasMore: false } },
        isLoading: false,
      });

      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('end-session-session-1'));

      expect(mockEndSessionMutate).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });
});
