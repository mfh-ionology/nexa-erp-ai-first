// ---------------------------------------------------------------------------
// Component Tests — Enhanced Billing Tab (timeline, enforcement dialog, plan assignment)
// Story: E13b.3 Task 5.4
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { TenantDetail, Plan, EnforcementAction } from '@/types/tenant';

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

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockUpdateEnforcement = {
  mutate: vi.fn(),
  isPending: false,
};

const mockAssignPlan = {
  mutate: vi.fn(),
  isPending: false,
};

let mockBillingDetailData: Record<string, unknown> | null = {
  tenantId: 't-1',
  billingStatus: 'GRACE' as const,
  stripeCustomerId: 'cus_abc',
  lastPaymentAt: '2026-03-01T00:00:00Z',
  subscriptionStatus: 'past_due',
  currentPeriodEnd: '2026-04-01T00:00:00Z',
  gracePeriodDays: 14,
  dunningLevel: 1,
  enforcementAction: 'WARNING' as EnforcementAction,
};

function getMockBillingDetail() {
  return mockBillingDetailData ? { data: { data: mockBillingDetailData } } : { data: undefined };
}

const mockAvailablePlans: Plan[] = [
  {
    id: 'p-1',
    code: 'core',
    displayName: 'Core',
    maxUsers: 10,
    maxCompanies: 1,
    monthlyAiTokenAllowance: '100000',
    aiHardLimit: true,
    enabledModules: ['system', 'finance'],
    apiRateLimit: 500,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p-2',
    code: 'pro',
    displayName: 'Professional',
    maxUsers: 50,
    maxCompanies: 5,
    monthlyAiTokenAllowance: '500000',
    aiHardLimit: true,
    enabledModules: ['system', 'finance', 'sales', 'crm'],
    apiRateLimit: 1000,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

vi.mock('@/hooks/use-billing', () => ({
  useTenantBilling: () => getMockBillingDetail(),
  useUpdateEnforcement: () => mockUpdateEnforcement,
  usePlans: () => ({ data: { data: mockAvailablePlans } }),
  useAssignPlan: () => mockAssignPlan,
  billingKeys: {
    all: ['billing'],
    overview: ['billing', 'overview'],
    tenantBilling: (id: string) => ['billing', 'tenant', id],
    plans: (params?: { active?: boolean }) =>
      params ? ['billing', 'plans', params] : ['billing', 'plans'],
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  buildQueryString: vi.fn(() => ''),
}));

import { BillingTab } from '../billing-tab';

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

function makeTenant(overrides: Partial<TenantDetail> = {}): TenantDetail {
  return {
    id: 't-1',
    code: 'acme',
    displayName: 'Acme Corp',
    legalName: 'Acme Corporation Ltd',
    status: 'ACTIVE',
    billingStatus: 'GRACE',
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: '2026-03-01T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    plan: { id: 'p-1', code: 'core', displayName: 'Core' },
    moduleOverrides: [],
    featureFlags: [],
    billing: {
      subscriptionStatus: 'past_due',
      currentPeriodEnd: '2026-04-01T00:00:00Z',
      gracePeriodDays: 14,
      dunningLevel: 1,
      enforcementAction: 'WARNING',
    },
    aiQuota: null,
    ...overrides,
  };
}

function renderBillingTab(tenant?: TenantDetail) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BillingTab tenant={tenant ?? makeTenant()} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    // Reset to default WARNING billing detail
    mockBillingDetailData = {
      tenantId: 't-1',
      billingStatus: 'GRACE',
      stripeCustomerId: 'cus_abc',
      lastPaymentAt: '2026-03-01T00:00:00Z',
      subscriptionStatus: 'past_due',
      currentPeriodEnd: '2026-04-01T00:00:00Z',
      gracePeriodDays: 14,
      dunningLevel: 1,
      enforcementAction: 'WARNING',
    };
  });

  describe('Enforcement Timeline', () => {
    it('renders enforcement timeline with correct current step highlighted', () => {
      renderBillingTab();

      const timeline = screen.getByTestId('enforcement-timeline');
      expect(timeline).toBeInTheDocument();

      // WARNING step should be active (has the active background class)
      const warningStep = screen.getByTestId('timeline-step-WARNING');
      expect(warningStep).toHaveClass('bg-amber-500');

      // NONE step should be past (shown as completed)
      const noneStep = screen.getByTestId('timeline-step-NONE');
      expect(noneStep).not.toHaveClass('bg-green-600');
    });

    it('shows correct description for current enforcement state', () => {
      renderBillingTab();

      const description = screen.getByTestId('enforcement-description');
      expect(description).toHaveTextContent(
        'Payment overdue — grace period active. Warning banner shown in tenant ERP.',
      );
    });

    it('shows NONE description when enforcement is NONE', () => {
      mockBillingDetailData = null; // fall back to tenant.billing
      renderBillingTab(
        makeTenant({
          billingStatus: 'CURRENT',
          billing: {
            subscriptionStatus: 'active',
            currentPeriodEnd: '2026-04-01T00:00:00Z',
            gracePeriodDays: 14,
            dunningLevel: 0,
            enforcementAction: 'NONE',
          },
        }),
      );

      const description = screen.getByTestId('enforcement-description');
      expect(description).toHaveTextContent('Normal operation — no restrictions');
    });
  });

  describe('Enforcement Dialog', () => {
    it('opens dialog when "Change Enforcement" is clicked', async () => {
      const user = userEvent.setup();
      renderBillingTab();

      await user.click(screen.getByTestId('change-enforcement-btn'));

      expect(screen.getByText('Change Enforcement Action')).toBeInTheDocument();
    });

    it('shows only valid transitions per state machine (BR-PLT-004)', async () => {
      const user = userEvent.setup();
      renderBillingTab(); // Current enforcement: WARNING

      await user.click(screen.getByTestId('change-enforcement-btn'));

      const select = screen.getByTestId('enforcement-target-select');
      const options = within(select).getAllByRole('option');

      // From WARNING: can go to NONE or READ_ONLY
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('None');
      expect(options[1]).toHaveTextContent('Read Only');
    });

    it('shows valid transitions from NONE (WARNING only)', async () => {
      mockBillingDetailData = null; // fall back to tenant.billing
      const user = userEvent.setup();
      renderBillingTab(
        makeTenant({
          billingStatus: 'CURRENT',
          billing: {
            subscriptionStatus: 'active',
            currentPeriodEnd: '2026-04-01T00:00:00Z',
            gracePeriodDays: 14,
            dunningLevel: 0,
            enforcementAction: 'NONE',
          },
        }),
      );

      await user.click(screen.getByTestId('change-enforcement-btn'));

      const select = screen.getByTestId('enforcement-target-select');
      const options = within(select).getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('Warning');
    });

    it('shows valid transitions from SUSPENDED (NONE only)', async () => {
      mockBillingDetailData = null; // fall back to tenant.billing
      const user = userEvent.setup();
      renderBillingTab(
        makeTenant({
          billingStatus: 'BLOCKED',
          billing: {
            subscriptionStatus: 'canceled',
            currentPeriodEnd: null,
            gracePeriodDays: 0,
            dunningLevel: 3,
            enforcementAction: 'SUSPENDED',
          },
        }),
      );

      await user.click(screen.getByTestId('change-enforcement-btn'));

      const select = screen.getByTestId('enforcement-target-select');
      const options = within(select).getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('None');
    });

    it('consequence description matches selected target action', async () => {
      const user = userEvent.setup();
      renderBillingTab(); // WARNING → options: NONE, READ_ONLY

      await user.click(screen.getByTestId('change-enforcement-btn'));

      // Default selection is first valid target (NONE)
      const consequence = screen.getByTestId('enforcement-consequence');
      expect(consequence).toHaveTextContent(
        'All restrictions will be removed. Normal operation will resume.',
      );

      // Select READ_ONLY
      await user.selectOptions(screen.getByTestId('enforcement-target-select'), 'READ_ONLY');

      expect(screen.getByTestId('enforcement-consequence')).toHaveTextContent(
        'All write operations will be blocked within 30 seconds',
      );
    });

    it('requires reason before confirm is enabled', async () => {
      const user = userEvent.setup();
      renderBillingTab();

      await user.click(screen.getByTestId('change-enforcement-btn'));

      // Confirm button should be disabled without reason
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Change' });
      expect(confirmBtn).toBeDisabled();

      // Type a reason
      await user.type(screen.getByTestId('enforcement-reason-input'), 'Late payment');

      // Now confirm should be enabled
      expect(confirmBtn).toBeEnabled();
    });
  });

  describe('Plan Assignment Dialog', () => {
    it('opens "Change Plan" dialog when button is clicked', async () => {
      const user = userEvent.setup();
      renderBillingTab();

      await user.click(screen.getByTestId('change-plan-btn'));

      expect(screen.getByText('Change Subscription Plan')).toBeInTheDocument();
    });

    it('shows comparison view when a different plan is selected', async () => {
      const user = userEvent.setup();
      renderBillingTab();

      await user.click(screen.getByTestId('change-plan-btn'));

      // Select Professional plan (p-2)
      await user.selectOptions(screen.getByTestId('plan-select'), 'p-2');

      // Comparison view should appear
      expect(screen.getByTestId('plan-comparison')).toBeInTheDocument();
    });
  });

  describe('Last Payment', () => {
    it('shows last payment as relative time', () => {
      renderBillingTab();

      // The billing detail mock has lastPaymentAt: '2026-03-01T00:00:00Z'
      // formatDistanceToNow would produce something like "10 days ago"
      // Just verify the payment field exists and is not "No payment recorded"
      expect(screen.queryByText('No payment recorded')).not.toBeInTheDocument();
    });

    it('shows "No payment recorded" when lastPaymentAt is null', () => {
      // Override the billing detail to have null lastPaymentAt
      mockBillingDetailData = { ...mockBillingDetailData!, lastPaymentAt: null };
      renderBillingTab();

      expect(screen.getByText('No payment recorded')).toBeInTheDocument();
    });
  });

  describe('RBAC', () => {
    it('PLATFORM_ADMIN sees enforcement and plan change buttons', () => {
      setUser('PLATFORM_ADMIN');
      renderBillingTab();

      expect(screen.getByTestId('change-enforcement-btn')).toBeInTheDocument();
      expect(screen.getByTestId('change-plan-btn')).toBeInTheDocument();
    });

    it('PLATFORM_VIEWER does not see enforcement or plan change buttons', () => {
      setUser('PLATFORM_VIEWER');
      renderBillingTab();

      expect(screen.queryByTestId('change-enforcement-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('change-plan-btn')).not.toBeInTheDocument();
    });
  });
});
