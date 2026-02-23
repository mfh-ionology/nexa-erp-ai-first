import type { Logger } from 'pino';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. Default: 3 */
  failureThreshold?: number;
  /** Time in ms after which the circuit transitions from OPEN → HALF_OPEN. Default: 30_000 */
  recoveryWindowMs?: number;
  /** Logger instance for state transitions. */
  logger?: Logger;
}

/**
 * Circuit breaker for Platform API calls (entitlements, quota, status).
 *
 * State transitions:
 *   CLOSED → OPEN:      after `failureThreshold` consecutive failures
 *   OPEN → HALF_OPEN:   after `recoveryWindowMs` has elapsed
 *   HALF_OPEN → CLOSED: on first success
 *   HALF_OPEN → OPEN:   on failure
 *
 * When OPEN, the circuit breaker prevents calls and returns a degraded/fallback result.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private halfOpenProbeInFlight = false;

  private readonly failureThreshold: number;
  private readonly recoveryWindowMs: number;
  private readonly logger?: Logger;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 3;
    this.recoveryWindowMs = config.recoveryWindowMs ?? 30_000;
    this.logger = config.logger;
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @param fn The function to execute (e.g., HTTP call to Platform API)
   * @param fallbackFn Optional fallback to call when the circuit is OPEN
   * @returns The result of `fn` or `fallbackFn`
   */
  async execute<T>(fn: () => Promise<T>, fallbackFn?: () => T): Promise<T> {
    // Check if OPEN circuit should transition to HALF_OPEN
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.recoveryWindowMs && !this.halfOpenProbeInFlight) {
        // Set halfOpenProbeInFlight BEFORE transitioning to prevent
        // concurrent callers from both entering the HALF_OPEN probe path
        this.halfOpenProbeInFlight = true;
        this.transitionTo('HALF_OPEN');
      } else {
        // Still OPEN (or probe already in flight) — use fallback
        if (fallbackFn) {
          return fallbackFn();
        }
        throw new Error('Circuit breaker is OPEN and no fallback provided');
      }
    }

    // Guard concurrent probes in HALF_OPEN state
    const isProbe = this.state === 'HALF_OPEN';
    if (isProbe && !this.halfOpenProbeInFlight) {
      this.halfOpenProbeInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      // Skip circuit breaker failure tracking for errors explicitly
      // marked as non-infrastructure (e.g., 4xx client errors)
      const skip = (err as { __skipCircuitBreaker?: boolean }).__skipCircuitBreaker;
      if (!skip) {
        this.onFailure();
      }
      // If circuit just opened and fallback available, use it
      if (this.state === 'OPEN' && fallbackFn) {
        this.logger?.warn(
          { error: (err as Error).message },
          'Circuit breaker: HALF_OPEN probe failed, returning to OPEN with fallback',
        );
        return fallbackFn();
      }
      throw err;
    } finally {
      if (isProbe) {
        this.halfOpenProbeInFlight = false;
      }
    }
  }

  /** Record a successful call. Resets failure count and closes the circuit. */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('CLOSED');
    }
    this.consecutiveFailures = 0;
  }

  /** Record a failed call. Increments failure count and may open the circuit. */
  private onFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    } else if (this.consecutiveFailures >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /** Transition to a new state, logging the change. */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'CLOSED') {
      this.consecutiveFailures = 0;
    }

    this.logger?.info(
      { from: oldState, to: newState, consecutiveFailures: this.consecutiveFailures },
      `Circuit breaker: ${oldState} → ${newState}`,
    );
  }

  /** Get the current circuit state (for monitoring/testing). */
  getState(): CircuitState {
    return this.state;
  }

  /** Get consecutive failure count (for monitoring/testing). */
  getFailureCount(): number {
    return this.consecutiveFailures;
  }

  /** Reset the circuit breaker to initial CLOSED state. */
  reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}
