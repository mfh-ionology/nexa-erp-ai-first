import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../../circuit-breaker/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryWindowMs: 30_000,
    });
  });

  // ─── Initial State ────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('starts with zero failures', () => {
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  // ─── CLOSED State ─────────────────────────────────────────────────────

  describe('CLOSED state', () => {
    it('executes the function normally on success', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await breaker.execute(fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledOnce();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('passes through errors while staying CLOSED if under threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(1);
    });

    it('stays CLOSED after failures below threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(2);
    });

    it('resets failure count on success', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('ok');

      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();
      expect(breaker.getFailureCount()).toBe(2);

      await breaker.execute(successFn);
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  // ─── CLOSED → OPEN transition ─────────────────────────────────────────

  describe('CLOSED → OPEN transition', () => {
    it('opens after reaching failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow(); // 3rd failure = threshold

      expect(breaker.getState()).toBe('OPEN');
    });

    it('uses fallback when circuit opens on threshold failure', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const fallback = vi.fn().mockReturnValue('fallback-result');

      // First two failures: no fallback used (thrown)
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      // Third failure: threshold reached → OPEN → fallback used
      const result = await breaker.execute(fn, fallback);
      expect(result).toBe('fallback-result');
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  // ─── OPEN state ────────────────────────────────────────────────────────

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Drive the circuit to OPEN
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(fn); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe('OPEN');
    });

    it('serves fallback without calling the function', async () => {
      const fn = vi.fn().mockResolvedValue('should-not-call');
      const fallback = vi.fn().mockReturnValue('cached');

      const result = await breaker.execute(fn, fallback);

      expect(result).toBe('cached');
      expect(fn).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalledOnce();
    });

    it('throws if no fallback is provided', async () => {
      const fn = vi.fn().mockResolvedValue('value');

      await expect(breaker.execute(fn)).rejects.toThrow(
        'Circuit breaker is OPEN and no fallback provided',
      );
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // ─── OPEN → HALF_OPEN transition ──────────────────────────────────────

  describe('OPEN → HALF_OPEN transition', () => {
    it('transitions to HALF_OPEN after recovery window', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(fn); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe('OPEN');

      // Fast-forward past recovery window
      vi.useFakeTimers();
      vi.advanceTimersByTime(30_001);

      const successFn = vi.fn().mockResolvedValue('recovered');
      const result = await breaker.execute(successFn);

      expect(result).toBe('recovered');
      expect(breaker.getState()).toBe('CLOSED'); // HALF_OPEN → success → CLOSED

      vi.useRealTimers();
    });

    it('stays OPEN before recovery window elapses', async () => {
      breaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryWindowMs: 30_000,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(fn); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe('OPEN');

      // Don't advance time — still within recovery window
      const fallback = vi.fn().mockReturnValue('stale');
      const result = await breaker.execute(vi.fn(), fallback);

      expect(result).toBe('stale');
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  // ─── HALF_OPEN state ──────────────────────────────────────────────────

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Drive to OPEN
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(fn); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe('OPEN');

      // Fast-forward to trigger HALF_OPEN on next call
      vi.useFakeTimers();
      vi.advanceTimersByTime(30_001);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('transitions HALF_OPEN → CLOSED on success', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      await breaker.execute(fn);

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(0);
    });

    it('transitions HALF_OPEN → OPEN on failure', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('still failing'));

      await expect(breaker.execute(fn)).rejects.toThrow('still failing');
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  // ─── Full recovery cycle ──────────────────────────────────────────────

  describe('full recovery cycle: CLOSED → OPEN → HALF_OPEN → CLOSED', () => {
    it('completes the full cycle', async () => {
      vi.useFakeTimers();

      // 1. CLOSED → OPEN (3 failures)
      const fail = vi.fn().mockRejectedValue(new Error('down'));
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(fail); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe('OPEN');

      // 2. OPEN: fallback served
      const fallback = vi.fn().mockReturnValue('cached');
      const result = await breaker.execute(fail, fallback);
      expect(result).toBe('cached');
      expect(breaker.getState()).toBe('OPEN');

      // 3. Wait for recovery window → HALF_OPEN
      vi.advanceTimersByTime(30_001);

      // 4. HALF_OPEN → success → CLOSED
      const success = vi.fn().mockResolvedValue('back-online');
      const recovered = await breaker.execute(success);
      expect(recovered).toBe('back-online');
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(0);

      // 5. Normal operation resumes
      const normal = vi.fn().mockResolvedValue('normal');
      const normalResult = await breaker.execute(normal);
      expect(normalResult).toBe('normal');
      expect(breaker.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });
  });

  // ─── Reset ────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('resets to initial CLOSED state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(fn); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe('OPEN');

      breaker.reset();

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  // ─── Logger ───────────────────────────────────────────────────────────

  describe('logging', () => {
    it('logs state transitions', async () => {
      const logInfo = vi.fn();
      const logger = { info: logInfo } as unknown as import('pino').Logger;
      breaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryWindowMs: 30_000,
        logger,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(fn); } catch { /* expected */ }
      }

      // Should have logged CLOSED → OPEN
      expect(logInfo).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'CLOSED', to: 'OPEN' }),
        expect.stringContaining('CLOSED → OPEN'),
      );
    });
  });

  // ─── Custom thresholds ────────────────────────────────────────────────

  describe('custom configuration', () => {
    it('respects custom failure threshold', async () => {
      breaker = new CircuitBreaker({ failureThreshold: 5 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 4; i++) {
        try { await breaker.execute(fn); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe('CLOSED'); // 4 < 5

      try { await breaker.execute(fn); } catch { /* expected */ }
      expect(breaker.getState()).toBe('OPEN'); // 5 = 5
    });

    it('respects custom recovery window', async () => {
      vi.useFakeTimers();
      breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryWindowMs: 5_000,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      try { await breaker.execute(fn); } catch { /* expected */ }
      expect(breaker.getState()).toBe('OPEN');

      // 5s recovery window
      vi.advanceTimersByTime(5_001);

      const success = vi.fn().mockResolvedValue('ok');
      await breaker.execute(success);
      expect(breaker.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });
  });
});
