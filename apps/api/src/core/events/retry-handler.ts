// ---------------------------------------------------------------------------
// RetryableHandlerExecutor — Retry-aware handler execution with exponential backoff
// E3-3 Task 3
// ---------------------------------------------------------------------------

import type { BusinessEvents, EventHandler } from './event-bus.types.js';
import {
  type HandlerExecutionResult,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from './retry.types.js';

/**
 * Delays execution by the specified number of milliseconds.
 * Uses setTimeout wrapped in a Promise so that vi.useFakeTimers()
 * can advance the delay in tests.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class RetryableHandlerExecutor {
  private readonly config: RetryConfig;
  private logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void } | null =
    null;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  setLogger(
    logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void } | null,
  ): void {
    this.logger = logger;
  }

  /**
   * Execute an event handler with exponential backoff retry.
   *
   * On failure, waits backoffBaseMs * 2^(attempt-1) ms before retrying:
   *   attempt 1 fail → wait 1s → attempt 2
   *   attempt 2 fail → wait 2s → attempt 3
   *   attempt 3 fail → wait 4s → give up
   *
   * Returns a result indicating success/failure, the final error (if any),
   * and the number of retry attempts made.
   */
  async executeWithRetry<K extends keyof BusinessEvents>(
    eventName: string,
    handler: EventHandler<K>,
    data: BusinessEvents[K],
  ): Promise<HandlerExecutionResult> {
    let lastError: Error | undefined;

    // First attempt (attempt 0) + up to maxRetries retry attempts
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          await result;
        }
        return { success: true, retryCount: attempt };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.config.maxRetries) {
          const baseMs = this.config.backoffBaseMs * Math.pow(2, attempt);
          // Apply jitter to prevent thundering herd on coordinated failures
          const jitter = this.config.jitterFraction;
          const backoffMs = jitter > 0
            ? Math.round(baseMs * (1 - jitter + Math.random() * 2 * jitter))
            : baseMs;
          const log = this.logger ?? console;
          log.info(
            `[EventBus] Retrying handler for "${eventName}" (attempt ${String(attempt + 1)}/${String(this.config.maxRetries)})`,
          );
          await delay(backoffMs);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      retryCount: this.config.maxRetries,
    };
  }
}
