import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from './event-bus.js';
import { RetryableHandlerExecutor } from './retry-handler.js';
import type { DeadLetterService } from './dead-letter.service.js';

// ---------------------------------------------------------------------------
// Tests — EventBus retry integration
// E3-3 Task 12
// ---------------------------------------------------------------------------

describe('EventBus retry integration', () => {
  let bus: EventBus;
  let executor: RetryableHandlerExecutor;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new EventBus();
    executor = new RetryableHandlerExecutor({ jitterFraction: 0 });
  });

  afterEach(() => {
    bus.removeAllListeners();
    vi.useRealTimers();
  });

  // =========================================================================
  // 12.2 — With retryExecutor set, failed handler is retried up to maxRetries
  // =========================================================================

  it('retries a failed handler up to maxRetries when retryExecutor is set', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    bus.setRetryExecutor(executor);

    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce(undefined);

    bus.on('user.login', handler);
    bus.emit('user.login', {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // Flush microtask to start handler execution
    await vi.advanceTimersByTimeAsync(0);
    // attempt 0 fails → 1s backoff
    await vi.advanceTimersByTimeAsync(1000);
    // attempt 1 fails → 2s backoff
    await vi.advanceTimersByTimeAsync(2000);
    // attempt 2 should succeed
    await vi.advanceTimersByTimeAsync(0);

    await bus.drain();

    expect(handler).toHaveBeenCalledTimes(3);
    // Should NOT have logged a final error (handler succeeded on 3rd attempt)
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Handler failed for event'),
      expect.anything(),
    );

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // =========================================================================
  // 12.3 — With retryExecutor AND deadLetterService, exhausted retries add to DLQ
  // =========================================================================

  it('adds event to DLQ when handler fails all retries with both retryExecutor and deadLetterService', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const mockDLQ: DeadLetterService = {
      add: vi.fn().mockResolvedValue('job-123'),
      list: vi.fn(),
      getById: vi.fn(),
      markReprocessed: vi.fn(),
      close: vi.fn(),
      setLogger: vi.fn(),
    } as unknown as DeadLetterService;

    bus.setRetryExecutor(executor);
    bus.setDeadLetterService(mockDLQ);

    const error = new Error('permanent failure');
    const handler = vi.fn().mockRejectedValue(error);

    bus.on('user.login', handler);
    const payload = {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    };
    bus.emit('user.login', payload);

    // Flush microtask + advance through all retries
    await vi.advanceTimersByTimeAsync(0);
    // attempt 0 fails → 1s backoff
    await vi.advanceTimersByTimeAsync(1000);
    // attempt 1 fails → 2s backoff
    await vi.advanceTimersByTimeAsync(2000);
    // attempt 2 fails → 4s backoff
    await vi.advanceTimersByTimeAsync(4000);
    // attempt 3 fails (final) → DLQ add
    await vi.advanceTimersByTimeAsync(0);

    await bus.drain();

    expect(handler).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDLQ.add).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDLQ.add).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'user.login',
        payload,
        error: 'permanent failure',
        retryCount: 3,
      }),
    );

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // =========================================================================
  // 12.4 — With retryExecutor but no deadLetterService, failures are logged only
  // =========================================================================

  it('logs error but does not persist when retryExecutor is set without deadLetterService', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    bus.setRetryExecutor(executor);
    // No deadLetterService set

    const handler = vi.fn().mockRejectedValue(new Error('always fails'));

    bus.on('user.mfa.setup', handler);
    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });

    // Flush through all retries
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(0);

    await bus.drain();

    expect(handler).toHaveBeenCalledTimes(4);
    // Error should be logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Handler failed for event "user.mfa.setup" after 3 retries'),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // =========================================================================
  // 12.5 — Without retryExecutor or deadLetterService, original behavior preserved
  // =========================================================================

  it('preserves original behavior with single attempt when neither retryExecutor nor deadLetterService is set', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // No retryExecutor, no deadLetterService

    const handler = vi.fn(() => {
      throw new Error('single attempt failure');
    });

    bus.on('user.mfa.setup', handler);
    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });

    await vi.advanceTimersByTimeAsync(0);
    await bus.drain();

    // Only called once — no retry
    expect(handler).toHaveBeenCalledOnce();
    // Error is logged using original format
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Handler error for event "user.mfa.setup"'),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  // =========================================================================
  // 12.6 — Error in one handler does not affect other handlers (error isolation)
  // =========================================================================

  it('isolates errors between handlers — one failing handler does not affect others', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    bus.setRetryExecutor(executor);

    const failingHandler = vi.fn().mockRejectedValue(new Error('handler-1 fails'));
    const succeedingHandler = vi.fn().mockResolvedValue(undefined);

    bus.on('user.login', failingHandler);
    bus.on('user.login', succeedingHandler);

    bus.emit('user.login', {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // Advance through all retries of the failing handler
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(0);

    await bus.drain();

    // Succeeding handler ran exactly once (no retry needed)
    expect(succeedingHandler).toHaveBeenCalledOnce();
    // Failing handler tried 4 times (1 initial + 3 retries)
    expect(failingHandler).toHaveBeenCalledTimes(4);

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // =========================================================================
  // 12.7 — drain() waits for retry attempts to complete before resolving
  // =========================================================================

  it('drain() waits for retry attempts to complete before resolving', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    bus.setRetryExecutor(executor);

    const executionOrder: string[] = [];

    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockImplementationOnce(async () => {
        executionOrder.push('handler-succeeded');
      });

    bus.on('user.mfa.setup', handler);
    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });

    // Start advancing timers for retry
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    // drain() should resolve after retry succeeds
    await bus.drain();
    executionOrder.push('after-drain');

    expect(executionOrder).toEqual(['handler-succeeded', 'after-drain']);

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // =========================================================================
  // 12.8 — Retry mechanism works correctly with async handlers
  // =========================================================================

  it('retries async handlers correctly', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    bus.setRetryExecutor(executor);

    const handler = vi.fn()
      .mockImplementationOnce(async () => {
        throw new Error('async-fail-1');
      })
      .mockImplementationOnce(async () => {
        throw new Error('async-fail-2');
      })
      .mockImplementationOnce(async () => {
        // async success on 3rd attempt
        return;
      });

    bus.on('settings.updated', handler);
    bus.emit('settings.updated', {
      key: 'timezone',
      oldValue: 'UTC',
      newValue: 'Europe/London',
      updatedBy: 'admin',
    });

    // Flush microtask + advance through retries
    await vi.advanceTimersByTimeAsync(0);
    // attempt 0 fails → 1s backoff
    await vi.advanceTimersByTimeAsync(1000);
    // attempt 1 fails → 2s backoff
    await vi.advanceTimersByTimeAsync(2000);
    // attempt 2 succeeds
    await vi.advanceTimersByTimeAsync(0);

    await bus.drain();

    expect(handler).toHaveBeenCalledTimes(3);
    // Should NOT log final failure (handler eventually succeeded)
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Handler failed for event'),
      expect.anything(),
    );

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // =========================================================================
  // once() + retry interaction — handler registered via once() with retry
  // =========================================================================

  it('retries a once() handler that fails then succeeds on retry', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    bus.setRetryExecutor(executor);

    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('once-fail'))
      .mockResolvedValueOnce(undefined);

    bus.once('user.login', handler);
    bus.emit('user.login', {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // Flush microtask to start handler execution
    await vi.advanceTimersByTimeAsync(0);
    // attempt 0 fails → 1s backoff
    await vi.advanceTimersByTimeAsync(1000);
    // attempt 1 succeeds
    await vi.advanceTimersByTimeAsync(0);

    await bus.drain();

    // Handler was called twice: once (fail) + once (retry success)
    expect(handler).toHaveBeenCalledTimes(2);
    // No final error logged (handler eventually succeeded)
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Handler failed for event'),
      expect.anything(),
    );

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('once() handler that exhausts all retries adds to DLQ', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const mockDLQ: DeadLetterService = {
      add: vi.fn().mockResolvedValue('job-once'),
      list: vi.fn(),
      getById: vi.fn(),
      markReprocessed: vi.fn(),
      close: vi.fn(),
      setLogger: vi.fn(),
    } as unknown as DeadLetterService;

    bus.setRetryExecutor(executor);
    bus.setDeadLetterService(mockDLQ);

    const handler = vi.fn().mockRejectedValue(new Error('permanent once failure'));

    bus.once('user.login', handler);
    bus.emit('user.login', {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // Flush through all retries
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(0);

    await bus.drain();

    // Handler called 4 times: 1 initial + 3 retries
    expect(handler).toHaveBeenCalledTimes(4);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDLQ.add).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('once() handler does not fire on subsequent emit after retry succeeds', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    bus.setRetryExecutor(executor);

    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('once-fail'))
      .mockResolvedValueOnce(undefined);

    bus.once('user.login', handler);
    bus.emit('user.login', {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // Wait for retry to succeed
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);
    await bus.drain();

    // Second emit — once handler should NOT fire again
    bus.emit('user.login', {
      userId: 'u2',
      companyId: 'c1',
      loginMethod: 'password',
    });

    await vi.advanceTimersByTimeAsync(0);
    await bus.drain();

    // Still only 2 calls from the first emit's retry, not 3
    expect(handler).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
