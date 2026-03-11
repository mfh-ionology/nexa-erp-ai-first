// ---------------------------------------------------------------------------
// Component Tests — Modules & Flags Tab
// Story: E13b.2 Task 7.5
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

const mockModulesMutate = vi.fn();
const mockFlagsMutate = vi.fn();

vi.mock('@/hooks/use-tenants', () => ({
  useUpdateModules: () => ({ mutate: mockModulesMutate, isPending: false }),
  useUpdateFeatureFlags: () => ({ mutate: mockFlagsMutate, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ModulesFlagsTab } from '../modules-flags-tab';
import type { TenantDetail } from '@/types/tenant';

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

const baseTenant: TenantDetail = {
  id: 'tenant-1',
  code: 'acme',
  displayName: 'Acme Corp',
  legalName: null,
  status: 'ACTIVE',
  billingStatus: 'CURRENT',
  region: 'uk-south',
  sandboxEnabled: false,
  lastActivityAt: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-06-01T00:00:00Z',
  plan: { id: 'plan-1', code: 'pro', displayName: 'Pro Plan' },
  moduleOverrides: [],
  featureFlags: [],
  billing: null,
  aiQuota: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModulesFlagsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
  });

  it('renders module overrides section with all 11 known modules', () => {
    render(<ModulesFlagsTab tenant={baseTenant} />);

    expect(screen.getByTestId('module-overrides-list')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Purchasing')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('HR / Payroll')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.getByText('Reporting')).toBeInTheDocument();
  });

  it('renders toggle switches for each module', () => {
    render(<ModulesFlagsTab tenant={baseTenant} />);

    expect(screen.getByTestId('module-toggle-system')).toBeInTheDocument();
    expect(screen.getByTestId('module-toggle-finance')).toBeInTheDocument();
    expect(screen.getByTestId('module-toggle-crm')).toBeInTheDocument();
  });

  it('shows "Inherited" badge for modules without overrides', () => {
    render(<ModulesFlagsTab tenant={baseTenant} />);

    const inheritedBadges = screen.getAllByText('Inherited');
    expect(inheritedBadges).toHaveLength(11);
  });

  it('shows "Override" badge for modules with overrides', () => {
    const tenantWithOverride: TenantDetail = {
      ...baseTenant,
      moduleOverrides: [
        {
          id: 'ov-1',
          moduleKey: 'crm',
          enabled: false,
          reason: 'Not needed',
          changedBy: 'admin',
          changedAt: '2025-06-01T00:00:00Z',
        },
      ],
    };
    render(<ModulesFlagsTab tenant={tenantWithOverride} />);

    expect(screen.getByText('Override')).toBeInTheDocument();
    // Other modules still show Inherited
    const inheritedBadges = screen.getAllByText('Inherited');
    expect(inheritedBadges).toHaveLength(10);
  });

  it('shows reason input when disabling a module', async () => {
    const user = userEvent.setup();
    render(<ModulesFlagsTab tenant={baseTenant} />);

    // Click the CRM toggle (currently enabled → disabling triggers reason input)
    await user.click(screen.getByTestId('module-toggle-crm'));

    expect(screen.getByTestId('module-reason-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Customer requested/)).toBeInTheDocument();
  });

  it('calls useUpdateModules when confirming module disable with reason', async () => {
    const user = userEvent.setup();
    render(<ModulesFlagsTab tenant={baseTenant} />);

    // Toggle CRM off
    await user.click(screen.getByTestId('module-toggle-crm'));

    // Type reason and confirm
    await user.type(screen.getByPlaceholderText(/Customer requested/), 'Customer does not use CRM');
    await user.click(screen.getByText('Confirm'));

    expect(mockModulesMutate).toHaveBeenCalledWith(
      {
        id: 'tenant-1',
        modules: [{ moduleKey: 'crm', enabled: false, reason: 'Customer does not use CRM' }],
      },
      expect.anything(),
    );
  });

  describe('feature flags', () => {
    it('shows empty state when no flags exist', () => {
      render(<ModulesFlagsTab tenant={baseTenant} />);

      expect(screen.getByTestId('feature-flags-empty')).toBeInTheDocument();
      expect(screen.getByText(/No feature flags configured/)).toBeInTheDocument();
    });

    it('renders feature flags when they exist', () => {
      const tenantWithFlags: TenantDetail = {
        ...baseTenant,
        featureFlags: [
          {
            id: 'ff-1',
            featureKey: 'beta_reports',
            enabled: true,
            changedBy: 'admin',
            changedAt: '2025-06-01T00:00:00Z',
          },
        ],
      };
      render(<ModulesFlagsTab tenant={tenantWithFlags} />);

      expect(screen.getByText('beta_reports')).toBeInTheDocument();
      expect(screen.getByTestId('flag-toggle-beta_reports')).toBeInTheDocument();
    });

    it('calls useUpdateFeatureFlags when toggling a flag', async () => {
      const user = userEvent.setup();
      const tenantWithFlags: TenantDetail = {
        ...baseTenant,
        featureFlags: [
          {
            id: 'ff-1',
            featureKey: 'beta_reports',
            enabled: true,
            changedBy: 'admin',
            changedAt: '2025-06-01T00:00:00Z',
          },
        ],
      };
      render(<ModulesFlagsTab tenant={tenantWithFlags} />);

      await user.click(screen.getByTestId('flag-toggle-beta_reports'));

      expect(mockFlagsMutate).toHaveBeenCalledWith(
        {
          id: 'tenant-1',
          flags: [{ featureKey: 'beta_reports', enabled: false }],
        },
        expect.anything(),
      );
    });
  });

  describe('RBAC — PLATFORM_VIEWER', () => {
    it('disables module toggle switches', () => {
      setUser('PLATFORM_VIEWER');
      render(<ModulesFlagsTab tenant={baseTenant} />);

      const toggle = screen.getByTestId('module-toggle-system');
      expect(toggle).toBeDisabled();
    });

    it('disables feature flag toggles', () => {
      setUser('PLATFORM_VIEWER');
      const tenantWithFlags: TenantDetail = {
        ...baseTenant,
        featureFlags: [
          {
            id: 'ff-1',
            featureKey: 'beta_reports',
            enabled: true,
            changedBy: 'admin',
            changedAt: '2025-06-01T00:00:00Z',
          },
        ],
      };
      render(<ModulesFlagsTab tenant={tenantWithFlags} />);

      const toggle = screen.getByTestId('flag-toggle-beta_reports');
      expect(toggle).toBeDisabled();
    });
  });
});
