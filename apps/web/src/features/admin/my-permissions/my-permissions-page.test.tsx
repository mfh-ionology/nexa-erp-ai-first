import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ResolvedPermissions, User } from '@/stores/auth-store';
import { useAuthStore } from '@/stores/auth-store';

import { MyPermissionsPage } from './my-permissions-page';

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: [
      { id: 'company-1', name: 'Acme Corp', slug: 'acme', baseCurrencyCode: 'GBP', isDefault: true },
    ],
    isLoading: false,
    isError: false,
  }),
}));

// Mock query-keys and system-api (they're imported by the component)
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    system: {
      companies: () => ['system', 'companies'],
    },
  },
}));

vi.mock('@/lib/system-api', () => ({
  fetchCompanies: vi.fn(),
}));

// --- Fixtures ---

const mockUser: User = {
  id: 'user-1',
  email: 'test@nexa.io',
  firstName: 'Test',
  lastName: 'User',
};

const basePermissions: ResolvedPermissions = {
  userId: 'user-1',
  companyId: 'company-1',
  role: 'ADMIN',
  isSuperAdmin: false,
  accessGroups: [
    { id: 'ag-1', code: 'SALES_TEAM', name: 'Sales Team' },
    { id: 'ag-2', code: 'FINANCE', name: 'Finance Department' },
  ],
  modules: {
    'system.users.list': {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: false,
      canDelete: false,
    },
    'sales.orders.list': {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
    },
  },
  fieldOverrides: {
    'sales.orders.detail': {
      costPrice: 'HIDDEN',
      discountPercent: 'READ_ONLY',
    },
  },
  enabledModules: ['system', 'sales'],
};

const superAdminPermissions: ResolvedPermissions = {
  ...basePermissions,
  role: 'SUPER_ADMIN',
  isSuperAdmin: true,
};

const emptyPermissions: ResolvedPermissions = {
  userId: 'user-1',
  companyId: 'company-1',
  role: 'USER',
  isSuperAdmin: false,
  accessGroups: [],
  modules: {},
  fieldOverrides: {},
  enabledModules: [],
};

function setState(user: User | null, permissions: ResolvedPermissions | null) {
  useAuthStore.setState({
    user,
    permissions,
    activeCompanyId: permissions?.companyId ?? null,
  });
}

// --- Tests ---

describe('MyPermissionsPage', () => {
  beforeEach(() => {
    setState(null, null);
  });

  it('renders nothing when user or permissions are null', () => {
    setState(null, null);
    const { container } = render(<MyPermissionsPage />);

    expect(container.innerHTML).toBe('');
  });

  it('renders user info section with name, email, and role', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@nexa.io')).toBeInTheDocument();
    // i18n is mocked to return keys, so role badge shows the translation key
    expect(screen.getByText('users.role.ADMIN')).toBeInTheDocument();
  });

  it('renders page title and description', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('myPermissions.title')).toBeInTheDocument();
    expect(screen.getByText('myPermissions.description')).toBeInTheDocument();
  });

  it('renders company name from cached query', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders access groups as badges', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('SALES_TEAM')).toBeInTheDocument();
    expect(screen.getByText('Sales Team')).toBeInTheDocument();
    expect(screen.getByText('FINANCE')).toBeInTheDocument();
    expect(screen.getByText('Finance Department')).toBeInTheDocument();
  });

  it('renders enabled modules', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    // i18n mock returns keys; 'navigation:system' and 'navigation:sales' appear
    // both in Enabled Modules badges and Permission Matrix collapsible triggers
    const systemBadges = screen.getAllByText('navigation:system');
    expect(systemBadges.length).toBeGreaterThanOrEqual(1);

    const salesBadges = screen.getAllByText('navigation:sales');
    expect(salesBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows SUPER_ADMIN banner when isSuperAdmin=true', () => {
    setState(mockUser, superAdminPermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('myPermissions.superAdminBanner')).toBeInTheDocument();
  });

  it('does not show SUPER_ADMIN banner for non-super-admin', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    expect(screen.queryByText('myPermissions.superAdminBanner')).not.toBeInTheDocument();
  });

  it('shows "no access groups" empty state', () => {
    setState(mockUser, emptyPermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('myPermissions.noAccessGroups')).toBeInTheDocument();
  });

  it('shows "no field overrides" empty state', () => {
    setState(mockUser, emptyPermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('myPermissions.noFieldOverrides')).toBeInTheDocument();
  });

  it('groups permissions by module in collapsible sections', async () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    // Permission matrix card should show module group triggers
    // Modules are grouped from resource codes: system.users.list → 'system', sales.orders.list → 'sales'
    const triggers = screen.getAllByRole('button');
    const moduleGroupTriggers = triggers.filter(
      (btn) =>
        btn.textContent?.includes('navigation:sales') ||
        btn.textContent?.includes('navigation:system'),
    );

    // Should have collapsible triggers for 'sales' and 'system' modules
    expect(moduleGroupTriggers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders field overrides grouped by resource', async () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    // The field overrides section should have a collapsible for 'sales.orders.detail'
    const triggers = screen.getAllByRole('button');
    const fieldOverrideTrigger = triggers.find((btn) =>
      btn.textContent?.includes('sales.orders.detail'),
    );
    expect(fieldOverrideTrigger).toBeDefined();
  });

  it('displays resource codes in permission matrix when expanded', async () => {
    const user = userEvent.setup();
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    // Find and click a module group trigger to expand it
    const triggers = screen.getAllByRole('button');
    const systemTrigger = triggers.find((btn) =>
      btn.textContent?.includes('navigation:system'),
    );
    expect(systemTrigger).toBeDefined();

    await user.click(systemTrigger!);

    // After expanding, the resource code should be visible in the table
    expect(screen.getByText('system.users.list')).toBeInTheDocument();
  });

  it('has proper section headings', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    expect(screen.getByText('myPermissions.userInfo')).toBeInTheDocument();
    expect(screen.getByText('myPermissions.accessGroups')).toBeInTheDocument();
    expect(screen.getByText('myPermissions.enabledModules')).toBeInTheDocument();
    expect(screen.getByText('myPermissions.permissionMatrix')).toBeInTheDocument();
    expect(screen.getByText('myPermissions.fieldOverrides')).toBeInTheDocument();
  });

  it('has aria-labelledby on the page section', () => {
    setState(mockUser, basePermissions);
    render(<MyPermissionsPage />);

    const section = document.querySelector('section[aria-labelledby="my-permissions-title"]');
    expect(section).toBeInTheDocument();
  });
});
