import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from './event-bus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush queueMicrotask-scheduled handlers */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  // =========================================================================
  // 6.2 — Typed emission and subscription (AC #1, #2)
  // =========================================================================

  it('delivers correctly typed payload to subscriber', async () => {
    const handler = vi.fn();
    bus.on('user.login', handler);

    const payload = {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
      ipAddress: '127.0.0.1',
    };
    bus.emit('user.login', payload);

    await flushMicrotasks();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  // =========================================================================
  // 6.3 — Multiple subscribers (AC #1)
  // =========================================================================

  it('invokes all registered handlers for an event', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.on('settings.updated', handler1);
    bus.on('settings.updated', handler2);
    bus.on('settings.updated', handler3);

    const payload = {
      key: 'timezone',
      oldValue: 'UTC',
      newValue: 'Europe/London',
      updatedBy: 'admin',
    };
    bus.emit('settings.updated', payload);

    await flushMicrotasks();

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(handler3).toHaveBeenCalledOnce();
    expect(handler1).toHaveBeenCalledWith(payload);
    expect(handler2).toHaveBeenCalledWith(payload);
    expect(handler3).toHaveBeenCalledWith(payload);
  });

  // =========================================================================
  // 6.4 — Error isolation — sync throw (AC #3)
  // =========================================================================

  it('catches sync handler errors without affecting other handlers or the emitter', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const failingHandler = vi.fn(() => {
      throw new Error('sync explosion');
    });
    const survivingHandler = vi.fn();

    bus.on('user.mfa.setup', failingHandler);
    bus.on('user.mfa.setup', survivingHandler);

    // emit must NOT throw
    expect(() => {
      bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });
    }).not.toThrow();

    await flushMicrotasks();

    expect(failingHandler).toHaveBeenCalledOnce();
    expect(survivingHandler).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Handler error for event "user.mfa.setup"'),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  // =========================================================================
  // 6.5 — Async error isolation — rejected Promise (AC #3)
  // =========================================================================

  it('catches async handler errors without affecting other handlers', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const asyncFailingHandler = vi.fn(async () => {
      throw new Error('async explosion');
    });
    const survivingHandler = vi.fn();

    bus.on('user.mfa.enabled', asyncFailingHandler);
    bus.on('user.mfa.enabled', survivingHandler);

    bus.emit('user.mfa.enabled', { userId: 'u2', companyId: 'c1' });

    await flushMicrotasks();

    expect(asyncFailingHandler).toHaveBeenCalledOnce();
    expect(survivingHandler).toHaveBeenCalledOnce();

    // The error should have been caught and logged
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EventBus] Handler error for event "user.mfa.enabled"'),
        expect.any(Error),
      );
    });

    consoleSpy.mockRestore();
  });

  // =========================================================================
  // 6.6 — Async execution — emit returns before handlers complete (AC #4)
  // =========================================================================

  it('executes handlers asynchronously — emit returns before handlers run', async () => {
    const executionOrder: string[] = [];

    bus.on('user.login', () => {
      executionOrder.push('handler');
    });

    bus.emit('user.login', {
      userId: 'u1',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // Synchronously after emit — handler should NOT have run yet
    executionOrder.push('after-emit');

    expect(executionOrder).toEqual(['after-emit']);

    await flushMicrotasks();

    expect(executionOrder).toEqual(['after-emit', 'handler']);
  });

  // =========================================================================
  // 6.7 — Handler deduplication (AC #5)
  // =========================================================================

  it('invokes the same handler reference only once even if registered twice', async () => {
    const handler = vi.fn();

    bus.on('user.mfa.setup', handler);
    bus.on('user.mfa.setup', handler); // duplicate registration

    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });

    await flushMicrotasks();

    expect(handler).toHaveBeenCalledOnce();
  });

  // =========================================================================
  // 6.8 — Different handler references are NOT deduped (AC #5)
  // =========================================================================

  it('invokes different handler references separately (no false dedup)', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('user.mfa.setup', handler1);
    bus.on('user.mfa.setup', handler2);

    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });

    await flushMicrotasks();

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  // =========================================================================
  // 6.9 — off() removes a handler
  // =========================================================================

  it('removes a handler with off() so it is no longer invoked', async () => {
    const handler = vi.fn();

    bus.on('settings.updated', handler);
    bus.off('settings.updated', handler);

    bus.emit('settings.updated', {
      key: 'locale',
      oldValue: 'en',
      newValue: 'fr',
      updatedBy: 'admin',
    });

    await flushMicrotasks();

    expect(handler).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 6.10 — removeAllListeners() for a specific event
  // =========================================================================

  it('removes all handlers for a specific event', async () => {
    const loginHandler = vi.fn();
    const mfaHandler = vi.fn();

    bus.on('user.login', loginHandler);
    bus.on('user.mfa.setup', mfaHandler);

    bus.removeAllListeners('user.login');

    bus.emit('user.login', { userId: 'u1', companyId: 'c1', loginMethod: 'password' });
    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });

    await flushMicrotasks();

    expect(loginHandler).not.toHaveBeenCalled();
    expect(mfaHandler).toHaveBeenCalledOnce(); // unrelated event unaffected
  });

  // =========================================================================
  // 6.11 — removeAllListeners() with no argument clears all events
  // =========================================================================

  it('removes all handlers for all events when called with no argument', async () => {
    const loginHandler = vi.fn();
    const mfaHandler = vi.fn();
    const settingsHandler = vi.fn();

    bus.on('user.login', loginHandler);
    bus.on('user.mfa.setup', mfaHandler);
    bus.on('settings.updated', settingsHandler);

    bus.removeAllListeners();

    bus.emit('user.login', { userId: 'u1', companyId: 'c1', loginMethod: 'password' });
    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });
    bus.emit('settings.updated', {
      key: 'k',
      oldValue: 'a',
      newValue: 'b',
      updatedBy: 'x',
    });

    await flushMicrotasks();

    expect(loginHandler).not.toHaveBeenCalled();
    expect(mfaHandler).not.toHaveBeenCalled();
    expect(settingsHandler).not.toHaveBeenCalled();
  });

  // =========================================================================
  // once() — handler fires at most once then auto-unregisters
  // =========================================================================

  it('once() handler fires exactly once then auto-unregisters', async () => {
    const handler = vi.fn();
    bus.once('user.mfa.setup', handler);

    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });
    await flushMicrotasks();

    bus.emit('user.mfa.setup', { userId: 'u2', companyId: 'c1' });
    await flushMicrotasks();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ userId: 'u1', companyId: 'c1' });
  });

  it('once() handler fires exactly once even with rapid synchronous emit() calls', async () => {
    const handler = vi.fn();
    bus.once('user.mfa.setup', handler);

    // Two rapid emit() calls before any microtask drains
    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });
    bus.emit('user.mfa.setup', { userId: 'u2', companyId: 'c1' });

    await flushMicrotasks();

    // Handler must fire exactly once despite two emissions
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ userId: 'u1', companyId: 'c1' });
  });

  it('once() works alongside persistent on() handlers', async () => {
    const onceHandler = vi.fn();
    const persistentHandler = vi.fn();

    bus.once('user.mfa.setup', onceHandler);
    bus.on('user.mfa.setup', persistentHandler);

    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });
    await flushMicrotasks();

    bus.emit('user.mfa.setup', { userId: 'u2', companyId: 'c1' });
    await flushMicrotasks();

    expect(onceHandler).toHaveBeenCalledOnce();
    expect(persistentHandler).toHaveBeenCalledTimes(2);
  });

  // =========================================================================
  // 6.12 — Emitting with no subscribers does not throw
  // =========================================================================

  it('does not throw when emitting an event with no subscribers', () => {
    expect(() => {
      bus.emit('user.login', { userId: 'u1', companyId: 'c1', loginMethod: 'password' });
    }).not.toThrow();
  });

  // =========================================================================
  // 6.13 — TypeScript type safety (compile-time verification)
  // =========================================================================
  // This test documents compile-time type safety. The following lines would
  // produce TypeScript errors if uncommented:
  //
  //   bus.emit('user.login', { wrong: 'payload' });
  //     → TS Error: Object literal may only specify known properties
  //
  //   bus.emit('nonexistent.event', {});
  //     → TS Error: Argument of type '"nonexistent.event"' is not assignable
  //
  //   bus.on('user.login', (data: { wrong: string }) => {});
  //     → TS Error: Type '(data: { wrong: string }) => void' is not assignable
  //
  // Since these are compile-time checks, we verify the positive case at runtime:

  it('enforces typed payloads (runtime positive check)', async () => {
    const handler = vi.fn();
    bus.on('accessGroup.created', handler);

    const payload = {
      groupId: 'g1',
      companyId: 'c1',
      code: 'ADMIN',
      name: 'Administrators',
      createdBy: 'user-1',
    };
    bus.emit('accessGroup.created', payload);

    await flushMicrotasks();

    expect(handler).toHaveBeenCalledWith(payload);
  });

  // =========================================================================
  // setLogger — structured error logging
  // =========================================================================

  it('uses a custom logger when set', async () => {
    const customLogger = { error: vi.fn() };
    bus.setLogger(customLogger);

    bus.on('user.mfa.setup', () => {
      throw new Error('test error');
    });

    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });

    await flushMicrotasks();

    expect(customLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Handler error for event "user.mfa.setup"'),
      expect.any(Error),
    );
  });

  // =========================================================================
  // drain() — wait for all pending handlers
  // =========================================================================

  it('drain() resolves after all pending handlers complete', async () => {
    const executionOrder: string[] = [];

    bus.on('user.login', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      executionOrder.push('handler-done');
    });

    bus.emit('user.login', { userId: 'u1', companyId: 'c1', loginMethod: 'password' });

    // drain() should wait for the async handler to finish
    await bus.drain();

    executionOrder.push('after-drain');
    expect(executionOrder).toEqual(['handler-done', 'after-drain']);
  });

  it('drain() resolves immediately when no handlers are pending', async () => {
    await expect(bus.drain()).resolves.toBeUndefined();
  });

  it('drain() resolves even when handlers throw errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    bus.on('user.mfa.setup', () => {
      throw new Error('drain test error');
    });

    bus.emit('user.mfa.setup', { userId: 'u1', companyId: 'c1' });
    await expect(bus.drain()).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});
