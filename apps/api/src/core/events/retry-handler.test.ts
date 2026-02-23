import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RetryableHandlerExecutor } from './retry-handler.js';

// ---------------------------------------------------------------------------
// Tests — RetryableHandlerExecutor
// E3-3 Task 11
// ---------------------------------------------------------------------------

describe('RetryableHandlerExecutor', () => {
  let executor: RetryableHandlerExecutor;

  beforeEach(() => {
    vi.useFakeTimers();
    executor = new RetryableHandlerExecutor({ jitterFraction: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // 11.2 — Handler succeeds on first attempt (AC #1)
  // =========================================================================

  it('returns success with retryCount 0 when handler succeeds on first attempt', async () => {
    const handler = vi.fn();

    const resultPromise = executor.executeWithRetry('user.login', handler, {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    const result = await resultPromise;

    expect(result).toEqual({ success: true, retryCount: 0 });
    expect(handler).toHaveBeenCalledOnce();
  });

  // =========================================================================
  // 11.3 — Handler fails once then succeeds (AC #1)
  // =========================================================================

  it('retries once with 1s backoff when handler fails then succeeds', async () => {
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined);

    const resultPromise = executor.executeWithRetry('user.login', handler, {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // First attempt fails → 1s backoff before retry
    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result).toEqual({ success: true, retryCount: 1 });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  // =========================================================================
  // 11.4 — Handler fails twice then succeeds (AC #1)
  // =========================================================================

  it('retries twice with 1s + 2s backoff when handler fails twice then succeeds', async () => {
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('transient-1'))
      .mockRejectedValueOnce(new Error('transient-2'))
      .mockResolvedValueOnce(undefined);

    const resultPromise = executor.executeWithRetry('user.login', handler, {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // First attempt fails → 1s backoff
    await vi.advanceTimersByTimeAsync(1000);
    // Second attempt fails → 2s backoff
    await vi.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;

    expect(result).toEqual({ success: true, retryCount: 2 });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  // =========================================================================
  // 11.5 — Handler fails all 3 retries (AC #1)
  // =========================================================================

  it('returns failure with retryCount 3 when handler fails all retries', async () => {
    const error = new Error('permanent failure');
    const handler = vi.fn().mockRejectedValue(error);

    const resultPromise = executor.executeWithRetry('user.login', handler, {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // attempt 0 fails → 1s backoff
    await vi.advanceTimersByTimeAsync(1000);
    // attempt 1 fails → 2s backoff
    await vi.advanceTimersByTimeAsync(2000);
    // attempt 2 fails → 4s backoff
    await vi.advanceTimersByTimeAsync(4000);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.retryCount).toBe(3);
    expect(result.error).toBe(error);
    expect(handler).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  // =========================================================================
  // 11.6 — Exponential backoff timing (AC #1)
  // =========================================================================

  it('uses correct exponential backoff timing: 1s, 2s, 4s', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('fail'));
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const resultPromise = executor.executeWithRetry('user.login', handler, {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // Collect the setTimeout calls for backoff delays
    // Filter out non-backoff setTimeout calls (delay 0 from flush etc.)
    const backoffDelays: number[] = [];

    // Advance through each backoff
    await vi.advanceTimersByTimeAsync(1000); // 1s backoff after attempt 0
    await vi.advanceTimersByTimeAsync(2000); // 2s backoff after attempt 1
    await vi.advanceTimersByTimeAsync(4000); // 4s backoff after attempt 2

    await resultPromise;

    // Extract backoff-related setTimeout calls (those with ms >= 1000)
    for (const call of setTimeoutSpy.mock.calls) {
      const ms = call[1];
      if (typeof ms === 'number' && ms >= 1000) {
        backoffDelays.push(ms);
      }
    }

    expect(backoffDelays).toEqual([1000, 2000, 4000]);

    setTimeoutSpy.mockRestore();
  });

  // =========================================================================
  // 11.7 — Custom RetryConfig is respected (AC #1)
  // =========================================================================

  it('respects custom RetryConfig (maxRetries=1, backoffBaseMs=500)', async () => {
    const customExecutor = new RetryableHandlerExecutor({
      maxRetries: 1,
      backoffBaseMs: 500,
      jitterFraction: 0,
    });

    const error = new Error('custom fail');
    const handler = vi.fn().mockRejectedValue(error);

    const resultPromise = customExecutor.executeWithRetry('user.login', handler, {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // attempt 0 fails → 500ms backoff (500 * 2^0)
    await vi.advanceTimersByTimeAsync(500);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.retryCount).toBe(1);
    expect(result.error).toBe(error);
    expect(handler).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });

  // =========================================================================
  // 11.8 — Each retry attempt is logged (AC #1)
  // =========================================================================

  it('logs each retry attempt with retry count', async () => {
    const mockLogger = { info: vi.fn(), error: vi.fn() };
    executor.setLogger(mockLogger);

    const handler = vi.fn().mockRejectedValue(new Error('logged fail'));

    const resultPromise = executor.executeWithRetry('invoice.posted', handler, {
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-001',
      customerId: 'c1',
      totalAmount: '100.00',
      journalEntryId: 'je-1',
      periodId: 'p1',
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    await resultPromise;

    // 3 retries = 3 log calls (attempt 1/3, 2/3, 3/3)
    expect(mockLogger.info).toHaveBeenCalledTimes(3);
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      '[EventBus] Retrying handler for "invoice.posted" (attempt 1/3)',
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      '[EventBus] Retrying handler for "invoice.posted" (attempt 2/3)',
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      3,
      '[EventBus] Retrying handler for "invoice.posted" (attempt 3/3)',
    );
  });
});
