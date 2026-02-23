// ---------------------------------------------------------------------------
// EventBus — Async, typed, in-process event bus for cross-module communication
// Replaces the synchronous TypedEventEmitter placeholder from event-emitter.ts
// ---------------------------------------------------------------------------

import type { BusinessEvents, EventHandler } from './event-bus.types.js';
import type { DeadLetterService } from './dead-letter.service.js';
import type { RetryableHandlerExecutor } from './retry-handler.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic handler storage
type AnyHandler = (...args: any[]) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<AnyHandler>>();
  private logger: { error: (...args: unknown[]) => void } | null = null;
  private pending = new Set<Promise<void>>();
  private retryExecutor: RetryableHandlerExecutor | null = null;
  private deadLetterService: DeadLetterService | null = null;

  /**
   * Optionally attach a logger (e.g. Fastify logger) for structured error output.
   * Falls back to console.error if no logger is set.
   */
  setLogger(logger: { error: (...args: unknown[]) => void } | null): void {
    this.logger = logger;
  }

  /**
   * Set a retry executor for handler failures.
   * When set, failed handlers are retried with exponential backoff.
   */
  setRetryExecutor(executor: RetryableHandlerExecutor): void {
    this.retryExecutor = executor;
  }

  /**
   * Set a dead-letter service for persisting events that exhaust all retries.
   * When set, events that fail all retry attempts are added to the DLQ.
   */
  setDeadLetterService(service: DeadLetterService): void {
    this.deadLetterService = service;
  }

  /**
   * Register a handler for a typed event.
   * Uses Set for handler storage — registering the same function reference
   * twice for the same event is idempotent (AC #5: deduplication).
   */
  on<K extends keyof BusinessEvents>(event: K, handler: EventHandler<K>): void {
    const key = event as string;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)?.add(handler);
  }

  /**
   * Register a handler that fires at most once, then auto-unregisters.
   * Provides API parity with Node's EventEmitter.once().
   * Uses a `fired` flag to guard against multiple invocations when
   * emit() is called rapidly before microtasks drain.
   *
   * If the handler throws (sync or async), the `fired` flag is reset so the
   * RetryableHandlerExecutor can re-invoke the wrapper on retry attempts.
   */
  once<K extends keyof BusinessEvents>(event: K, handler: EventHandler<K>): void {
    let fired = false;
    const wrapper: EventHandler<K> = (data) => {
      if (fired) return;
      fired = true;
      this.off(event, wrapper);
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          return result.catch((err: unknown) => {
            fired = false;
            throw err;
          }) as void | Promise<void>;
        }
        return result;
      } catch (err) {
        fired = false;
        throw err;
      }
    };
    this.on(event, wrapper);
  }

  /**
   * Unregister a handler for a typed event.
   */
  off<K extends keyof BusinessEvents>(event: K, handler: EventHandler<K>): void {
    const key = event as string;
    const set = this.handlers.get(key);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(key);
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events if no event is specified.
   * Primarily used for test cleanup.
   */
  removeAllListeners(event?: keyof BusinessEvents): void {
    if (event !== undefined) {
      this.handlers.delete(event as string);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Emit a typed event asynchronously (AC #4).
   *
   * Each handler is scheduled via queueMicrotask so the emitting call stack
   * completes first. Handlers execute independently — errors in one handler
   * do NOT affect others or the emitter (AC #3).
   *
   * Returns void immediately; does NOT await handler completion.
   */
  emit<K extends keyof BusinessEvents>(event: K, data: BusinessEvents[K]): void {
    const handlers = this.handlers.get(event as string);
    if (!handlers || handlers.size === 0) return;

    // Capture the timestamp now, before any retry delays
    const emittedAt = new Date().toISOString();

    for (const handler of handlers) {
      const p = new Promise<void>((resolve) => {
        queueMicrotask(() => {
          void (async () => {
            try {
              if (this.retryExecutor) {
                // Retry-aware execution path
                const result = await this.retryExecutor.executeWithRetry(
                  event as string,
                  handler as EventHandler<K>,
                  data,
                );

                if (!result.success) {
                  const log = this.logger ?? console;
                  log.error(
                    `[EventBus] Handler failed for event "${event as string}" after ${String(result.retryCount)} retries:`,
                    result.error,
                  );

                  // Persist to dead-letter queue if available
                  if (this.deadLetterService) {
                    await this.deadLetterService.add({
                      eventName: event as string,
                      payload: data,
                      error: result.error?.message ?? 'Unknown error',
                      stack: result.error?.stack,
                      retryCount: result.retryCount,
                      originalTimestamp: emittedAt,
                    });
                  }
                }
              } else {
                // Original behavior: single attempt, catch + log
                const result = (handler as (data: BusinessEvents[K]) => void | Promise<void>)(data);
                if (result instanceof Promise) {
                  await result;
                }
              }
            } catch (err) {
              const log = this.logger ?? console;
              log.error(
                `[EventBus] Handler error for event "${event as string}":`,
                err,
              );
            } finally {
              resolve();
            }
          })();
        });
      });
      this.pending.add(p);
      void p.then(() => { this.pending.delete(p); });
    }
  }

  /**
   * Wait for all pending handler executions to complete, including
   * handlers emitted during execution of other handlers (cascading events).
   * Used for graceful shutdown — ensures audit/side-effect handlers finish
   * before the process exits.
   *
   * @param timeoutMs Maximum time to wait before resolving (default 30s).
   *                  Prevents indefinite blocking during graceful shutdown.
   */
  async drain(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.pending.size > 0) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        const log = this.logger ?? console;
        log.error(
          `[EventBus] drain() timed out after ${String(timeoutMs)}ms with ${String(this.pending.size)} pending handlers`,
        );
        break;
      }
      await Promise.race([
        Promise.allSettled([...this.pending]),
        new Promise<void>((resolve) => setTimeout(resolve, remaining)),
      ]);
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();
