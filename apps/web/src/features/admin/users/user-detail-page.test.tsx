import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { UserDetail } from './api/types';

// --- Mock TanStack Router ---
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// --- Mock useUser query ---
const mockUseUser = vi.fn();
vi.mock('./api/use-user-detail', () => ({
  useUser: (...args: unknown[]) => mockUseUser(...args),
}));

// --- Mock AccessGroupAssignmentPanel (to isolate detail page tests) ---
vi.mock('./components/access-group-assignment-panel', () => ({
  AccessGroupAssignmentPanel: (props: { userId: string }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'access-group-panel' }, `AccessGroupAssignmentPanel: ${props.userId}`);
  },
}));

// --- Test data ---
const testUser: UserDetail = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  role: 'ADMIN',
  isActive: true,
  lastLoginAt: '2025-06-01T10:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-06-01T10:00:00Z',
};

const testInactiveUser: UserDetail = {
  ...testUser,
  id: 'user-2',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  role: 'VIEWER',
  isActive: false,
  lastLoginAt: null,
};

function setupMockQuery(user: UserDetail | null, overrides: Record<string, unknown> = {}) {
  mockUseUser.mockReturnValue({
    data: user,
    isLoading: false,
    isError: user === null,
    ...overrides,
  });
}

// Dynamic import after mocks
async function renderPage(id = 'user-1') {
  const { UserDetailPage } = await import('./user-detail-page');
  return render(<UserDetailPage id={id} />);
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockQuery(testUser);
  });

  // --- Rendering tests ---

  describe('rendering', () => {
    it('renders user full name as page title', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('John Doe');
    });

    it('renders breadcrumbs: System > Users > [Name]', async () => {
      await renderPage();

      const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(within(breadcrumbNav).getByText('navigation:system')).toBeInTheDocument();
      expect(within(breadcrumbNav).getByText('users.title')).toBeInTheDocument();
      expect(within(breadcrumbNav).getByText('John Doe')).toBeInTheDocument();
    });

    it('renders profile card with email', async () => {
      await renderPage();

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('renders role badge with translation key', async () => {
      await renderPage();

      expect(screen.getByText('users.role.ADMIN')).toBeInTheDocument();
    });

    it('renders active status badge', async () => {
      await renderPage();

      // At least one "active" status badge (header + profile section)
      const activeBadges = screen.getAllByText('users.status.active');
      expect(activeBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders last login date for users who have logged in', async () => {
      await renderPage();

      // formatDate returns the string representation
      expect(screen.getByText('2025-06-01T10:00:00Z')).toBeInTheDocument();
    });

    it('renders profile section title', async () => {
      await renderPage();

      expect(screen.getByText('users.detail.profileTitle')).toBeInTheDocument();
    });

    it('renders field labels via translation keys', async () => {
      await renderPage();

      expect(screen.getByText('users.field.email')).toBeInTheDocument();
      expect(screen.getByText('users.field.role')).toBeInTheDocument();
      expect(screen.getByText('users.field.status')).toBeInTheDocument();
      expect(screen.getByText('users.field.lastLogin')).toBeInTheDocument();
    });
  });

  // --- Inactive user rendering ---

  describe('inactive user', () => {
    it('renders inactive status badge', async () => {
      setupMockQuery(testInactiveUser);
      await renderPage('user-2');

      const inactiveBadges = screen.getAllByText('users.status.inactive');
      expect(inactiveBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders "Never" for null lastLoginAt', async () => {
      setupMockQuery(testInactiveUser);
      await renderPage('user-2');

      expect(screen.getByText('users.lastLogin.never')).toBeInTheDocument();
    });

    it('renders VIEWER role badge', async () => {
      setupMockQuery(testInactiveUser);
      await renderPage('user-2');

      expect(screen.getByText('users.role.VIEWER')).toBeInTheDocument();
    });
  });

  // --- Access Group Panel ---

  describe('access group panel', () => {
    it('renders AccessGroupAssignmentPanel with correct userId', async () => {
      await renderPage('user-1');

      const panel = screen.getByTestId('access-group-panel');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveTextContent('AccessGroupAssignmentPanel: user-1');
    });
  });

  // --- Loading state ---

  describe('loading state', () => {
    it('renders loading skeletons when data is loading', async () => {
      setupMockQuery(null, { isLoading: true, isError: false });
      await renderPage();

      // Should not render user data
      expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
      // Should render page header with default title
      expect(screen.getByText('users.detail.title')).toBeInTheDocument();
    });
  });

  // --- Error state ---

  describe('error state', () => {
    it('renders error message when user fails to load', async () => {
      setupMockQuery(null);
      await renderPage();

      expect(screen.getByText('users.error.loadFailed')).toBeInTheDocument();
    });

    it('does not render access group panel on error', async () => {
      setupMockQuery(null);
      await renderPage();

      expect(screen.queryByTestId('access-group-panel')).not.toBeInTheDocument();
    });
  });
});
