import { render, screen } from '@testing-library/react';
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

import { RequirePlatformRole } from '../require-platform-role';

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

describe('RequirePlatformRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
  });

  it('renders children when user has an allowed role', () => {
    render(
      <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
        <span>Admin Content</span>
      </RequirePlatformRole>,
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('renders children when no roles are specified (any authenticated user)', () => {
    render(
      <RequirePlatformRole>
        <span>Any Content</span>
      </RequirePlatformRole>,
    );
    expect(screen.getByText('Any Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have the required role', () => {
    setUser('PLATFORM_VIEWER');
    render(
      <RequirePlatformRole roles={['PLATFORM_ADMIN']} fallback={<span>No Access</span>}>
        <span>Admin Content</span>
      </RequirePlatformRole>,
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('renders nothing when user does not have role and no fallback provided', () => {
    setUser('PLATFORM_VIEWER');
    const { container } = render(
      <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
        <span>Admin Content</span>
      </RequirePlatformRole>,
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  it('renders fallback when no user is logged in', () => {
    mockUser = null;
    render(
      <RequirePlatformRole roles={['PLATFORM_ADMIN']} fallback={<span>Login Required</span>}>
        <span>Admin Content</span>
      </RequirePlatformRole>,
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Required')).toBeInTheDocument();
  });

  describe('disabledFallback', () => {
    it('renders children in a disabled wrapper when disabledFallback is true and role does not match', () => {
      setUser('PLATFORM_VIEWER');
      render(
        <RequirePlatformRole roles={['PLATFORM_ADMIN']} disabledFallback>
          <button>Suspend Tenant</button>
        </RequirePlatformRole>,
      );

      // Button is still rendered but inside a disabled wrapper
      const button = screen.getByText('Suspend Tenant');
      expect(button).toBeInTheDocument();

      const wrapper = button.closest('[aria-disabled="true"]');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('pointer-events-none', 'opacity-50');
      expect(wrapper).toHaveAttribute('inert');
    });

    it('renders children normally when disabledFallback is true and role matches', () => {
      setUser('PLATFORM_ADMIN');
      render(
        <RequirePlatformRole roles={['PLATFORM_ADMIN']} disabledFallback>
          <button>Suspend Tenant</button>
        </RequirePlatformRole>,
      );

      const button = screen.getByText('Suspend Tenant');
      expect(button).toBeInTheDocument();

      // No disabled wrapper
      const wrapper = button.closest('[aria-disabled="true"]');
      expect(wrapper).toBeNull();
    });
  });
});
