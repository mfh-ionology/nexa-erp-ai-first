// ---------------------------------------------------------------------------
// Component Tests — Tenant Detail Page (T2 Record Detail)
// Story: E13b.2 Task 7.4
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
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

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: mockUser }),
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    ...opts,
    useParams: () => ({ tenantId: 'tenant-1' }),
  }),
  Link: ({
    children,
    to,
    ...props
  }: Record<string, unknown> & { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mockSuspendMutate = vi.fn();
const mockReactivateMutate = vi.fn();
const mockArchiveMutate = vi.fn();

vi.mock('@/hooks/use-tenants', () => ({
  useTenant: vi.fn(),
  useSuspendTenant: () => ({ mutate: mockSuspendMutate, isPending: false }),
  useReactivateTenant: () => ({ mutate: mockReactivateMutate, isPending: false }),
  useArchiveTenant: () => ({ mutate: mockArchiveMutate, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/tenants/impersonation-dialog', () => ({
  ImpersonationDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="impersonation-dialog">Impersonation Dialog</div> : null,
}));

import { Route } from '../$tenantId';
import { useTenant } from '@/hooks/use-tenants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TenantDetailPage = (Route as unknown as { component: React.ComponentType }).component;

function setUser(role: string) {
  mockUser = {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@nexa.io`,
    displayName: `${role} User`,
    role,
  };
}

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    code: 'acme',
    displayName: 'Acme Corp',
    legalName: 'Acme Corporation Ltd',
    status: 'ACTIVE',
    billingStatus: 'CURRENT',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: '2025-06-01T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    plan: { id: 'plan-1', code: 'pro', displayName: 'Pro Plan' },
    moduleOverrides: [],
    featureFlags: [],
    billing: null,
    aiQuota: null,
    ...overrides,
  };
}

function mockTenantHook(overrides: Record<string, unknown> = {}) {
  const { tenant: tenantOverrides, ...hookOverrides } = overrides;
  vi.mocked(useTenant).mockReturnValue({
    data: { data: makeTenant(tenantOverrides as Record<string, unknown>), meta: undefined },
    isLoading: false,
    isError: false,
    error: null,
    ...hookOverrides,
  } as unknown as ReturnType<typeof useTenant>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    mockTenantHook();
  });

  it('renders all 7 tabs', () => {
    render(<TenantDetailPage />);

    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-modules')).toBeInTheDocument();
    expect(screen.getByTestId('tab-users')).toBeInTheDocument();
    expect(screen.getByTestId('tab-ai-usage')).toBeInTheDocument();
    expect(screen.getByTestId('tab-billing')).toBeInTheDocument();
    expect(screen.getByTestId('tab-diagnostics')).toBeInTheDocument();
    expect(screen.getByTestId('tab-audit')).toBeInTheDocument();
  });

  it('displays tenant name and status badge', () => {
    render(<TenantDetailPage />);

    expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument();
    // StatusBadge shows in header — multiple "Active" matches are OK, check at least one exists
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThan(0);
    expect(activeBadges[0]).toHaveClass('text-green-600');
  });

  it('shows overview tab content by default', () => {
    render(<TenantDetailPage />);

    // Overview tab shows tenant code, region, etc.
    expect(screen.getByText('acme')).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mockTenantHook({ isLoading: true, data: undefined });
    render(<TenantDetailPage />);

    expect(screen.getByTestId('tenant-detail-loading')).toBeInTheDocument();
  });

  it('shows error state when tenant not found', () => {
    mockTenantHook({ isError: true, data: undefined, error: new Error('Not found') });
    render(<TenantDetailPage />);

    expect(screen.getByTestId('tenant-detail-error')).toBeInTheDocument();
    expect(screen.getByText('Tenant not found')).toBeInTheDocument();
  });

  describe('action bar — status-driven buttons (BR-PLT-001)', () => {
    it('shows Suspend button for ACTIVE tenant', () => {
      mockTenantHook({ tenant: { status: 'ACTIVE' } });
      render(<TenantDetailPage />);

      expect(screen.getByTestId('suspend-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('reactivate-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-btn')).not.toBeInTheDocument();
    });

    it('shows Reactivate and Archive buttons for SUSPENDED tenant', () => {
      mockTenantHook({ tenant: { status: 'SUSPENDED' } });
      render(<TenantDetailPage />);

      expect(screen.getByTestId('reactivate-btn')).toBeInTheDocument();
      expect(screen.getByTestId('archive-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('suspend-btn')).not.toBeInTheDocument();
    });

    it('shows no action buttons for ARCHIVED tenant (terminal state)', () => {
      mockTenantHook({ tenant: { status: 'ARCHIVED' } });
      render(<TenantDetailPage />);

      expect(screen.queryByTestId('suspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reactivate-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-btn')).not.toBeInTheDocument();
    });

    it('shows no action buttons for PROVISIONING tenant', () => {
      mockTenantHook({ tenant: { status: 'PROVISIONING' } });
      render(<TenantDetailPage />);

      expect(screen.queryByTestId('suspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reactivate-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-btn')).not.toBeInTheDocument();
    });

    it('shows no action buttons for READ_ONLY tenant', () => {
      mockTenantHook({ tenant: { status: 'READ_ONLY' } });
      render(<TenantDetailPage />);

      expect(screen.queryByTestId('suspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reactivate-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-btn')).not.toBeInTheDocument();
    });
  });

  describe('RBAC — PLATFORM_VIEWER', () => {
    it('hides all action buttons for PLATFORM_VIEWER', () => {
      setUser('PLATFORM_VIEWER');
      mockTenantHook({ tenant: { status: 'ACTIVE' } });
      render(<TenantDetailPage />);

      expect(screen.queryByTestId('tenant-action-bar')).not.toBeInTheDocument();
    });

    it('still shows tabs for PLATFORM_VIEWER (read-only view)', () => {
      setUser('PLATFORM_VIEWER');
      render(<TenantDetailPage />);

      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
      expect(screen.getByTestId('tab-modules')).toBeInTheDocument();
    });
  });

  describe('suspend dialog (BR-PLT-001)', () => {
    it('opens suspend dialog on Suspend button click', async () => {
      const user = userEvent.setup();
      mockTenantHook({ tenant: { status: 'ACTIVE' } });
      render(<TenantDetailPage />);

      await user.click(screen.getByTestId('suspend-btn'));

      // Dialog shows 30-second propagation warning (BR-PLT-002)
      expect(screen.getByText(/immediately block all ERP login/)).toBeInTheDocument();
    });

    it('requires reason input before confirming suspend', async () => {
      const user = userEvent.setup();
      mockTenantHook({ tenant: { status: 'ACTIVE' } });
      render(<TenantDetailPage />);

      await user.click(screen.getByTestId('suspend-btn'));

      // Confirm button should be disabled without reason
      const confirmBtn = screen.getByRole('button', { name: 'Suspend Tenant' });
      expect(confirmBtn).toBeDisabled();
    });
  });

  describe('archive only for SUSPENDED (BR-PLT-001)', () => {
    it('archive button NOT available for ACTIVE tenants', () => {
      mockTenantHook({ tenant: { status: 'ACTIVE' } });
      render(<TenantDetailPage />);

      expect(screen.queryByTestId('archive-btn')).not.toBeInTheDocument();
    });

    it('archive button available for SUSPENDED tenants', () => {
      mockTenantHook({ tenant: { status: 'SUSPENDED' } });
      render(<TenantDetailPage />);

      expect(screen.getByTestId('archive-btn')).toBeInTheDocument();
    });

    it('archive dialog warns about irreversibility (BR-PLT-003)', async () => {
      const user = userEvent.setup();
      mockTenantHook({ tenant: { status: 'SUSPENDED' } });
      render(<TenantDetailPage />);

      await user.click(screen.getByTestId('archive-btn'));

      expect(screen.getByText(/IRREVERSIBLE from the UI/)).toBeInTheDocument();
    });

    it('archive dialog requires reason before confirming (BR-PLT-003)', async () => {
      const user = userEvent.setup();
      mockTenantHook({ tenant: { status: 'SUSPENDED' } });
      render(<TenantDetailPage />);

      await user.click(screen.getByTestId('archive-btn'));

      const confirmBtn = screen.getByRole('button', { name: 'Archive Tenant' });
      expect(confirmBtn).toBeDisabled();
    });
  });

  describe('reactivate dialog', () => {
    it('opens reactivate dialog and calls mutation on confirm', async () => {
      const user = userEvent.setup();
      mockTenantHook({ tenant: { status: 'SUSPENDED' } });
      render(<TenantDetailPage />);

      await user.click(screen.getByTestId('reactivate-btn'));

      expect(screen.getByText(/restore full ERP access/)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: 'Reactivate' });
      await user.click(confirmBtn);

      expect(mockReactivateMutate).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  describe('suspend dialog mutation', () => {
    it('calls suspend mutation with reason after filling reason and confirming', async () => {
      const user = userEvent.setup();
      mockTenantHook({ tenant: { status: 'ACTIVE' } });
      render(<TenantDetailPage />);

      await user.click(screen.getByTestId('suspend-btn'));

      // Type a reason to enable the confirm button
      const reasonInput = screen.getByPlaceholderText('Enter reason...');
      await user.type(reasonInput, 'Policy violation');

      const confirmBtn = screen.getByRole('button', { name: 'Suspend Tenant' });
      expect(confirmBtn).not.toBeDisabled();
      await user.click(confirmBtn);

      expect(mockSuspendMutate).toHaveBeenCalledWith(
        { id: 'tenant-1', reason: 'Policy violation' },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });
});
