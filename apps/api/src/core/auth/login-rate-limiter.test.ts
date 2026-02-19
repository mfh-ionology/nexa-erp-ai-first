import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { recordFailedAttempt, isLocked, resetAttempts, _clearAll } from './login-rate-limiter.js';

beforeEach(() => {
  _clearAll();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Lockout after 5 failures
// ---------------------------------------------------------------------------

describe('login rate limiter', () => {
  const email = 'user@example.com';

  it('does not lock after fewer than 5 failures', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(email);
    }
    expect(isLocked(email)).toBe(false);
  });

  it('locks after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(email);
    }
    expect(isLocked(email)).toBe(true);
  });

  it('remains locked on 6th attempt', () => {
    for (let i = 0; i < 6; i++) {
      recordFailedAttempt(email);
    }
    expect(isLocked(email)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Successful login resets counter
  // ---------------------------------------------------------------------------

  it('resets counter on successful login', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(email);
    }
    resetAttempts(email);
    expect(isLocked(email)).toBe(false);

    // One more failure should NOT lock (counter was reset)
    recordFailedAttempt(email);
    expect(isLocked(email)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Window expires after 15 minutes
  // ---------------------------------------------------------------------------

  it('unlocks after 15-minute window expires', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(email);
    }
    expect(isLocked(email)).toBe(true);

    // Advance time by 15 minutes
    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(isLocked(email)).toBe(false);
  });

  it('starts a new window after the old one expires', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(email);
    }

    // Advance past the window
    vi.advanceTimersByTime(15 * 60 * 1000);

    // New attempt starts a fresh window
    recordFailedAttempt(email);
    expect(isLocked(email)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Case-insensitive email handling
  // ---------------------------------------------------------------------------

  it('treats emails case-insensitively', () => {
    for (let i = 0; i < 3; i++) {
      recordFailedAttempt('User@Example.COM');
    }
    for (let i = 0; i < 2; i++) {
      recordFailedAttempt('user@example.com');
    }
    expect(isLocked('USER@EXAMPLE.COM')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Independent tracking per email
  // ---------------------------------------------------------------------------

  it('tracks different emails independently', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt('a@example.com');
    }
    expect(isLocked('a@example.com')).toBe(true);
    expect(isLocked('b@example.com')).toBe(false);
  });
});
