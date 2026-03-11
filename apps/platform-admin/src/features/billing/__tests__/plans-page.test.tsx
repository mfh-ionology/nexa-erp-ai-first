// ---------------------------------------------------------------------------
// Component Tests — Plans Page (plan cards, CRUD, RBAC)
// Story: E13b.3 Task 5.3
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
    selector({ user: mockUser }),
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockCreatePlan = { mutate: vi.fn(), isPending: false };
const mockUpdatePlan = { mutate: vi.fn(), isPending: false };

vi.mock('@/hooks/use-billing', () => ({
  usePlans: vi.fn(),
  useCreatePlan: () => mockCreatePlan,
  useUpdatePlan: () => mockUpdatePlan,
  billingKeys: {
    plans: (params?: { active?: boolean }) =>
      params ? ['billing', 'plans', params] : ['billing', 'plans'],
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  buildQueryString: vi.fn(() => ''),
  PlatformApiError: class PlatformApiError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

import { Route } from '@/routes/_authenticated/plans';
import { usePlans } from '@/hooks/use-billing';
import type { Plan } from '@/types/tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PlansPage = (Route as unknown as { component: React.ComponentType }).component;

function setUser(role: string) {
  mockUser = {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@nexa.io`,
    displayName: `${role} User`,
    role,
  };
}

const mockPlans: Plan[] = [
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
  {
    id: 'p-3',
    code: 'legacy',
    displayName: 'Legacy',
    maxUsers: 5,
    maxCompanies: 1,
    monthlyAiTokenAllowance: '50000',
    aiHardLimit: false,
    enabledModules: ['system'],
    apiRateLimit: 200,
    isActive: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
  },
];

function mockPlansHook(overrides: Record<string, unknown> = {}) {
  vi.mocked(usePlans).mockReturnValue({
    data: { data: mockPlans },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof usePlans>);
}

function renderPlansPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlansPage />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    mockPlansHook();
  });

  it('renders plan cards with correct data', () => {
    renderPlansPage();

    // Core plan card
    const coreCard = screen.getByTestId('plan-card-core');
    expect(within(coreCard).getByText('Core')).toBeInTheDocument();
    expect(within(coreCard).getByText('core')).toBeInTheDocument();
    expect(within(coreCard).getByText('10')).toBeInTheDocument(); // maxUsers
    expect(within(coreCard).getByText('1')).toBeInTheDocument(); // maxCompanies
    expect(within(coreCard).getByText('100,000')).toBeInTheDocument(); // token allowance

    // Pro plan card
    const proCard = screen.getByTestId('plan-card-pro');
    expect(within(proCard).getByText('Professional')).toBeInTheDocument();
    expect(within(proCard).getByText('50')).toBeInTheDocument(); // maxUsers
  });

  it('shows Active / Inactive badges', () => {
    renderPlansPage();

    const coreCard = screen.getByTestId('plan-card-core');
    expect(within(coreCard).getByText('Active')).toBeInTheDocument();

    const legacyCard = screen.getByTestId('plan-card-legacy');
    expect(within(legacyCard).getByText('Inactive')).toBeInTheDocument();
  });

  it('shows inactive plans with reduced opacity', () => {
    renderPlansPage();

    const legacyCard = screen.getByTestId('plan-card-legacy');
    expect(legacyCard).toHaveClass('opacity-60');
  });

  it('sorts plans: active first, then by displayName', () => {
    renderPlansPage();

    const grid = screen.getByTestId('plans-grid');
    const cards = within(grid).getAllByText(/^(Core|Professional|Legacy)$/);
    // Active plans first (Core, Professional sorted alpha), then inactive (Legacy)
    expect(cards[0]).toHaveTextContent('Core');
    expect(cards[1]).toHaveTextContent('Professional');
    expect(cards[2]).toHaveTextContent('Legacy');
  });

  it('shows module badges on plan cards', () => {
    renderPlansPage();

    const coreCard = screen.getByTestId('plan-card-core');
    expect(within(coreCard).getByText('System')).toBeInTheDocument();
    expect(within(coreCard).getByText('Finance')).toBeInTheDocument();
  });

  describe('RBAC', () => {
    it('"+ New Plan" visible for PLATFORM_ADMIN', () => {
      setUser('PLATFORM_ADMIN');
      renderPlansPage();
      expect(screen.getByTestId('create-plan-button')).toBeInTheDocument();
    });

    it('"+ New Plan" hidden for PLATFORM_VIEWER', () => {
      setUser('PLATFORM_VIEWER');
      renderPlansPage();
      expect(screen.queryByTestId('create-plan-button')).not.toBeInTheDocument();
    });

    it('edit icons visible for PLATFORM_ADMIN', () => {
      setUser('PLATFORM_ADMIN');
      renderPlansPage();
      expect(screen.getByTestId('edit-plan-core')).toBeInTheDocument();
      expect(screen.getByTestId('edit-plan-pro')).toBeInTheDocument();
    });

    it('edit icons hidden for PLATFORM_VIEWER', () => {
      setUser('PLATFORM_VIEWER');
      renderPlansPage();
      expect(screen.queryByTestId('edit-plan-core')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-plan-pro')).not.toBeInTheDocument();
    });
  });

  describe('Create Plan form', () => {
    it('opens dialog when "+ New Plan" is clicked', async () => {
      const user = userEvent.setup();
      renderPlansPage();

      await user.click(screen.getByTestId('create-plan-button'));
      expect(screen.getByRole('heading', { name: 'Create Plan' })).toBeInTheDocument();
      expect(screen.getByTestId('plan-code-input')).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      const user = userEvent.setup();
      renderPlansPage();

      await user.click(screen.getByTestId('create-plan-button'));

      // Try to submit empty form
      await user.click(screen.getByTestId('plan-form-submit'));

      // Should show validation errors
      expect(screen.getByText('Code is required')).toBeInTheDocument();
      expect(screen.getByText('Display name is required')).toBeInTheDocument();
      // maxUsers + maxCompanies both show "Must be at least 1"
      expect(screen.getAllByText('Must be at least 1')).toHaveLength(2);
      expect(screen.getByText('At least one module is required')).toBeInTheDocument();
    });
  });

  describe('Edit Plan form', () => {
    it('pre-populates existing values when editing', async () => {
      const user = userEvent.setup();
      renderPlansPage();

      await user.click(screen.getByTestId('edit-plan-core'));

      // Should show edit title
      expect(screen.getByText('Edit Plan')).toBeInTheDocument();

      // Code field should NOT be present (immutable in edit mode)
      expect(screen.queryByTestId('plan-code-input')).not.toBeInTheDocument();

      // Fields should be pre-populated
      const nameInput = screen.getByTestId('plan-display-name-input') as HTMLInputElement;
      expect(nameInput.value).toBe('Core');

      const maxUsersInput = screen.getByTestId('plan-max-users-input') as HTMLInputElement;
      expect(maxUsersInput.value).toBe('10');

      // isActive toggle should be visible in edit mode
      expect(screen.getByTestId('plan-is-active-input')).toBeInTheDocument();
    });
  });

  describe('Loading / Error states', () => {
    it('shows loading state', () => {
      mockPlansHook({ isLoading: true, data: undefined });
      renderPlansPage();
      expect(screen.getByTestId('plans-loading')).toBeInTheDocument();
    });

    it('shows error state', () => {
      mockPlansHook({ isError: true, error: new Error('Network error'), data: undefined });
      renderPlansPage();
      expect(screen.getByTestId('plans-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load plans')).toBeInTheDocument();
    });
  });
});
