// ---------------------------------------------------------------------------
// ImpersonationBanner — Component tests
// Story: E13b.5 Task 6.5
// ---------------------------------------------------------------------------

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { ImpersonationSession } from '@/hooks/use-impersonation-session';

import { ImpersonationBanner } from './impersonation-banner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSession(overrides: Partial<ImpersonationSession> = {}): ImpersonationSession {
  return {
    isImpersonating: true,
    adminEmail: 'admin@nexa-platform.io',
    tenantName: 'Acme Ltd (ACME)',
    sessionId: 'session-123',
    reason: 'Support ticket #42',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    endSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Save original location for restoration
const originalLocation = window.location;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  // Restore window.location if it was mocked
  if (window.location !== originalLocation) {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImpersonationBanner', () => {
  it('renders admin email, tenant name, and countdown', () => {
    const session = createSession();
    render(<ImpersonationBanner session={session} />);

    expect(screen.getByTestId('impersonation-banner')).toBeInTheDocument();
    expect(screen.getByTestId('impersonation-info')).toHaveTextContent('Acme Ltd (ACME)');
    expect(screen.getByTestId('impersonation-admin')).toHaveTextContent('admin@nexa-platform.io');
    expect(screen.getByTestId('impersonation-countdown')).toBeInTheDocument();
  });

  it('banner is not dismissable (no close button, BR-PLT-014)', () => {
    const session = createSession();
    render(<ImpersonationBanner session={session} />);

    // No close/dismiss button exists
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();

    // Only the "End Session" button exists
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('End Session');
  });

  it('"End Session" button calls endSession and is disabled during execution', async () => {
    const endSession = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
    const session = createSession({ endSession });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ImpersonationBanner session={session} />);

    const button = screen.getByTestId('impersonation-end-session');
    expect(button).toHaveTextContent('End Session');

    await user.click(button);

    expect(endSession).toHaveBeenCalledOnce();
    expect(button).toHaveTextContent('Ending...');
    expect(button).toBeDisabled();
  });

  it('countdown updates every second', () => {
    // Set expiry to exactly 5 minutes from now
    const session = createSession({
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    render(<ImpersonationBanner session={session} />);

    const countdownEl = screen.getByTestId('impersonation-countdown');
    // Should show approximately 05:00 (or 04:59 depending on timing)
    expect(countdownEl.textContent).toMatch(/0[45]:\d{2}/);

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Countdown should have decremented
    expect(countdownEl.textContent).toMatch(/0[45]:\d{2}/);
  });

  it('auto-redirects when countdown reaches 0', () => {
    // Mock window.location.href
    const locationMock = { ...window.location, href: '' };
    Object.defineProperty(window, 'location', {
      writable: true,
      value: locationMock,
    });

    // Set expiry to 2 seconds from now
    const session = createSession({
      expiresAt: new Date(Date.now() + 2000),
    });

    render(<ImpersonationBanner session={session} />);

    // Advance past expiry
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should redirect to platform admin
    expect(locationMock.href).toContain('localhost:5112');
  });

  it('renders with role="alert" for accessibility', () => {
    const session = createSession();
    render(<ImpersonationBanner session={session} />);

    const banner = screen.getByTestId('impersonation-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('renders spacer element to push content below banner', () => {
    const session = createSession();
    render(<ImpersonationBanner session={session} />);

    const spacer = screen.getByTestId('impersonation-spacer');
    expect(spacer).toBeInTheDocument();
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
  });
});
