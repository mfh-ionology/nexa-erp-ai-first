import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdempotencyGuard } from './idempotency.js';

// ---------------------------------------------------------------------------
// Tests — IdempotencyGuard
// E3-3 Task 15
// ---------------------------------------------------------------------------

describe('IdempotencyGuard', () => {
  let guard: IdempotencyGuard;

  beforeEach(() => {
    vi.useFakeTimers();
    guard = new IdempotencyGuard({ ttlMs: 5_000 }); // 5s TTL for fast tests
  });

  afterEach(() => {
    guard.destroy();
    vi.useRealTimers();
  });

  // =========================================================================
  // 15.2 — isDuplicate / markProcessed basic behaviour (AC #5)
  // =========================================================================

  it('returns false for unseen correlationId, true after markProcessed', () => {
    const id = 'corr-001';

    expect(guard.isDuplicate(id)).toBe(false);

    guard.markProcessed(id);

    expect(guard.isDuplicate(id)).toBe(true);
  });

  // =========================================================================
  // 15.3 — TTL expiry (AC #5)
  // =========================================================================

  it('returns false again after TTL expires', () => {
    const id = 'corr-002';

    guard.markProcessed(id);
    expect(guard.isDuplicate(id)).toBe(true);

    // Advance time past the 5s TTL
    vi.advanceTimersByTime(5_001);

    expect(guard.isDuplicate(id)).toBe(false);
  });

  it('returns true just before TTL expires', () => {
    const id = 'corr-003';

    guard.markProcessed(id);

    // Advance time to just under the TTL
    vi.advanceTimersByTime(4_999);

    expect(guard.isDuplicate(id)).toBe(true);
  });

  // =========================================================================
  // 15.4 — Independent tracking of different correlationIds (AC #5)
  // =========================================================================

  it('tracks different correlationIds independently', () => {
    const id1 = 'corr-aaa';
    const id2 = 'corr-bbb';
    const id3 = 'corr-ccc';

    guard.markProcessed(id1);
    guard.markProcessed(id2);

    expect(guard.isDuplicate(id1)).toBe(true);
    expect(guard.isDuplicate(id2)).toBe(true);
    expect(guard.isDuplicate(id3)).toBe(false);
  });

  it('expires each correlationId independently based on its own timestamp', () => {
    const id1 = 'corr-first';
    const id2 = 'corr-second';

    guard.markProcessed(id1);

    // Advance 3s, then mark second
    vi.advanceTimersByTime(3_000);
    guard.markProcessed(id2);

    // Advance another 2.1s — id1 should expire (5.1s total), id2 still valid (2.1s)
    vi.advanceTimersByTime(2_100);

    expect(guard.isDuplicate(id1)).toBe(false);
    expect(guard.isDuplicate(id2)).toBe(true);
  });

  // =========================================================================
  // 15.5 — clear() resets all tracking (AC #5)
  // =========================================================================

  it('clear() removes all tracked entries', () => {
    guard.markProcessed('corr-x');
    guard.markProcessed('corr-y');
    guard.markProcessed('corr-z');

    expect(guard.isDuplicate('corr-x')).toBe(true);
    expect(guard.isDuplicate('corr-y')).toBe(true);

    guard.clear();

    expect(guard.isDuplicate('corr-x')).toBe(false);
    expect(guard.isDuplicate('corr-y')).toBe(false);
    expect(guard.isDuplicate('corr-z')).toBe(false);
  });
});
