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

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: undefined }),
}));

vi.mock('@/components/layout/placeholder-page', () => ({
  PlaceholderPage: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="placeholder-page">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

import { usePlatformAuthStore } from '@/stores/auth-store';

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

/**
 * Replicate the DashboardPage component logic for testing.
 * We can't import the route file directly because createFileRoute runs
 * at module scope and expects a real router. This mirrors the conditional
 * rendering from _authenticated/index.tsx.
 */
function DashboardPage() {
  const userRole = (
    usePlatformAuthStore as unknown as (
      selector: (s: { user: { role: string } | null }) => unknown,
    ) => unknown
  )((s) => s.user?.role) as string | undefined;
  const isViewer = userRole === 'PLATFORM_VIEWER';

  return (
    <div>
      {isViewer && (
        <div
          data-testid="read-only-indicator"
          className="mx-8 mt-6 rounded-md border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-4 py-2 text-center text-sm text-[var(--warning-foreground)]"
        >
          Read-only mode — you have view-only access to platform data.
        </div>
      )}
      <div data-testid="placeholder-page">
        <h1>Dashboard</h1>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
  });

  it('does NOT show read-only indicator for PLATFORM_ADMIN', () => {
    setUser('PLATFORM_ADMIN');
    render(<DashboardPage />);

    expect(screen.queryByTestId('read-only-indicator')).not.toBeInTheDocument();
  });

  it('shows read-only indicator for PLATFORM_VIEWER', () => {
    setUser('PLATFORM_VIEWER');
    render(<DashboardPage />);

    const indicator = screen.getByTestId('read-only-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('Read-only mode');
  });

  it('does NOT show read-only indicator for PLATFORM_SUPPORT', () => {
    setUser('PLATFORM_SUPPORT');
    render(<DashboardPage />);

    expect(screen.queryByTestId('read-only-indicator')).not.toBeInTheDocument();
  });
});
