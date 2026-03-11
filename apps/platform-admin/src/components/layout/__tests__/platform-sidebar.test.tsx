import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

let mockUser: { id: string; email: string; displayName: string; role: string } | null = {
  id: 'admin-1',
  email: 'admin@nexa.io',
  displayName: 'Admin User',
  role: 'PLATFORM_ADMIN',
};

const mockLogout = vi.fn();

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: mockUser,
      logout: mockLogout,
      isAuthenticated: !!mockUser,
    }),
  ),
}));

let mockPathname = '/';
const mockNavigate = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiPost: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: vi.fn(
    ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
      select({ location: { pathname: mockPathname } }),
  ),
  useNavigate: vi.fn(() => mockNavigate),
  Link: vi.fn(({ children, to, className, title, ...rest }: Record<string, unknown>) => (
    <a
      href={to as string}
      className={className as string}
      title={title as string | undefined}
      {...rest}
    >
      {children as React.ReactNode}
    </a>
  )),
}));

import { PlatformSidebar, NAV_ITEMS } from '../platform-sidebar';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlatformSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    setUser('PLATFORM_ADMIN');
  });

  describe('Navigation items', () => {
    it('renders all 10 navigation items for PLATFORM_ADMIN user', () => {
      render(<PlatformSidebar />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('AI Intelligence')).toBeInTheDocument();
      expect(screen.getByText('Tenants')).toBeInTheDocument();
      expect(screen.getByText('Plans')).toBeInTheDocument();
      expect(screen.getByText('AI Usage')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('Support Console')).toBeInTheDocument();
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('has exactly 10 items in NAV_ITEMS', () => {
      expect(NAV_ITEMS).toHaveLength(10);
    });

    it('NAV_ITEMS has correct paths', () => {
      const paths = NAV_ITEMS.map((item) => item.path);
      expect(paths).toEqual([
        '/',
        '/intelligence',
        '/tenants',
        '/plans',
        '/ai-usage',
        '/billing',
        '/support',
        '/monitoring',
        '/audit-log',
        '/settings',
      ]);
    });
  });

  describe('RBAC filtering', () => {
    it('shows all 10 items for PLATFORM_VIEWER when none are admin-only', () => {
      setUser('PLATFORM_VIEWER');
      render(<PlatformSidebar />);

      // All items visible since none have requiresAdmin
      const navLinks = screen.getAllByRole('link');
      expect(navLinks).toHaveLength(10);
    });

    it('hides admin-only items for PLATFORM_VIEWER user', async () => {
      // Dynamically mock the module to inject a requiresAdmin item
      const sidebarModule = await import('../platform-sidebar');
      const origItems = [...sidebarModule.NAV_ITEMS];
      // Temporarily replace last item with requiresAdmin flag
      const adminOnlyItem = { ...origItems[9]!, requiresAdmin: true };
      sidebarModule.NAV_ITEMS.splice(9, 1, adminOnlyItem);

      try {
        setUser('PLATFORM_VIEWER');
        render(<PlatformSidebar />);

        // Settings should be hidden
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();

        // Other 9 items should still be visible
        const navLinks = screen.getAllByRole('link');
        expect(navLinks).toHaveLength(9);
      } finally {
        // Always restore regardless of assertion outcome
        sidebarModule.NAV_ITEMS.splice(0, sidebarModule.NAV_ITEMS.length, ...origItems);
      }
    });

    it('shows admin-only items for PLATFORM_ADMIN user', async () => {
      const sidebarModule = await import('../platform-sidebar');
      const origItems = [...sidebarModule.NAV_ITEMS];
      const adminOnlyItem = { ...origItems[9]!, requiresAdmin: true };
      sidebarModule.NAV_ITEMS.splice(9, 1, adminOnlyItem);

      try {
        setUser('PLATFORM_ADMIN');
        render(<PlatformSidebar />);

        // Settings should still be visible for admin
        expect(screen.getByText('Settings')).toBeInTheDocument();
        const navLinks = screen.getAllByRole('link');
        expect(navLinks).toHaveLength(10);
      } finally {
        sidebarModule.NAV_ITEMS.splice(0, sidebarModule.NAV_ITEMS.length, ...origItems);
      }
    });
  });

  describe('Active item styling', () => {
    it('active item has purple background with white text (bg-primary text-white)', () => {
      mockPathname = '/tenants';
      render(<PlatformSidebar />);

      const tenantsLink = screen.getByText('Tenants').closest('a');
      expect(tenantsLink).toHaveClass('bg-primary', 'text-white');
    });

    it('non-active items do not have active classes', () => {
      mockPathname = '/tenants';
      render(<PlatformSidebar />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).not.toHaveClass('bg-primary');
    });

    it('Dashboard is active only for exact "/" path', () => {
      mockPathname = '/';
      render(<PlatformSidebar />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveClass('bg-primary', 'text-white');
    });

    it('nested path activates parent nav item', () => {
      mockPathname = '/tenants/123';
      render(<PlatformSidebar />);

      const tenantsLink = screen.getByText('Tenants').closest('a');
      expect(tenantsLink).toHaveClass('bg-primary', 'text-white');
    });
  });

  describe('Collapsed mode', () => {
    it('shows icons only when collapsed (nav item text hidden)', async () => {
      const user = userEvent.setup();
      render(<PlatformSidebar />);

      // Initially expanded — text is visible
      expect(screen.getByText('Dashboard')).toBeInTheDocument();

      // Click collapse button
      const collapseBtn = screen.getByLabelText('Collapse sidebar');
      await user.click(collapseBtn);

      // Text elements should be hidden (not rendered)
      // In collapsed mode, the span with text is conditionally not rendered
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

      // Icons should still be present — links exist with title attributes
      const navLinks = screen.getAllByRole('link');
      expect(navLinks).toHaveLength(10);

      // Each link should have a title for tooltip in collapsed mode
      expect(navLinks[0]).toHaveAttribute('title', 'Dashboard');
      expect(navLinks[1]).toHaveAttribute('title', 'AI Intelligence');
    });

    it('expand button shows text again', async () => {
      const user = userEvent.setup();
      render(<PlatformSidebar />);

      // Collapse
      await user.click(screen.getByLabelText('Collapse sidebar'));
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

      // Expand
      await user.click(screen.getByLabelText('Expand sidebar'));
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  describe('Branding', () => {
    it('"PLATFORM ADMIN" branding visible in expanded mode', () => {
      render(<PlatformSidebar />);
      expect(screen.getByText('PLATFORM ADMIN')).toBeInTheDocument();
    });

    it('"PLATFORM ADMIN" branding hidden in collapsed mode', async () => {
      const user = userEvent.setup();
      render(<PlatformSidebar />);

      await user.click(screen.getByLabelText('Collapse sidebar'));
      expect(screen.queryByText('PLATFORM ADMIN')).not.toBeInTheDocument();
    });

    it('displays "N" logo mark', () => {
      render(<PlatformSidebar />);
      expect(screen.getByText('N')).toBeInTheDocument();
    });
  });

  describe('User info and logout', () => {
    it('shows user display name and role', () => {
      render(<PlatformSidebar />);
      expect(screen.getByText('PLATFORM_ADMIN User')).toBeInTheDocument();
      expect(screen.getByText('PLATFORM_ADMIN')).toBeInTheDocument();
    });

    it('calls logout and navigates to /login when Sign Out is clicked', async () => {
      const user = userEvent.setup();
      render(<PlatformSidebar />);

      await user.click(screen.getByLabelText('Sign out'));
      expect(mockLogout).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });
  });
});
