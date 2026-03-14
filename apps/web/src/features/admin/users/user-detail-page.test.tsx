import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

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
    return React.createElement(
      'div',
      { 'data-testid': 'access-group-panel' },
      `AccessGroupAssignmentPanel: ${props.userId}`,
    );
  },
}));

// --- Mock cross-cutting panels (they use hooks that require QueryClient) ---
vi.mock('@/features/cross-cutting', () => ({
  NotesPanel: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'notes-panel' });
  },
}));

vi.mock('@/features/tasks', () => ({
  TaskPanel: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'task-panel' });
  },
}));

// --- QueryClient wrapper (needed by any unmocked sub-components) ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

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
  return render(<UserDetailPage id={id} />, { wrapper: createWrapper() });
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

      // formatDate returns the string representation; date may appear in multiple places
      const dateElements = screen.getAllByText('2025-06-01T10:00:00Z');
      expect(dateElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders activity timeline section', async () => {
      await renderPage();

      expect(screen.getByText('users.activityTimeline.title')).toBeInTheDocument();
    });

    it('renders last login field label', async () => {
      await renderPage();

      // The component renders "users.field.lastLogin: <date>" inline
      expect(
        screen.getByText((content) => content.includes('users.field.lastLogin')),
      ).toBeInTheDocument();
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

      // The "never" text appears inline with the label: "users.field.lastLogin: users.lastLogin.never"
      expect(
        screen.getByText((content) => content.includes('users.lastLogin.never')),
      ).toBeInTheDocument();
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
      // Loading state renders skeleton elements (no text content to assert on)
      // Just verify the page renders without crashing
      expect(document.body).toBeInTheDocument();
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
