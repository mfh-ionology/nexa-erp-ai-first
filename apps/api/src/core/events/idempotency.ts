/**
 * Idempotency Guard — prevents duplicate event processing.
 *
 * Usage pattern for event handlers:
 * ```ts
 * import { createIdempotencyGuard } from '@/core/events/idempotency';
 *
 * // Create in a Fastify plugin, destroy in onClose hook
 * const guard = createIdempotencyGuard();
 * fastify.addHook('onClose', () => guard.destroy());
 *
 * function handleInvoicePosted(data: BusinessEvents['invoice.posted']) {
 *   const correlationId = data.correlationId ?? data.sourceId;
 *   if (!correlationId) return; // no dedup key available
 *
 *   if (guard.isDuplicate(correlationId)) {
 *     log.warn(`Duplicate event skipped: ${correlationId}`);
 *     return;
 *   }
 *   guard.markProcessed(correlationId);
 *
 *   // ... perform side effects ...
 * }
 * ```
 *
 * NOTE: correlationId is NOT automatically included in all event payloads yet.
 * It is available on `request.correlationId` and optional on AuditLog entries.
 * Future stories should thread it through AsyncLocalStorage into event payloads.
 */

const DEFAULT_TTL_MS = 300_000; // 5 minutes
const EVICTION_INTERVAL_MS = 60_000; // run eviction every 60 seconds

export class IdempotencyGuard {
  private readonly seen = new Map<string, number>();
  private readonly ttlMs: number;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: { ttlMs?: number } = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.startEviction();
  }

  /** Returns true if correlationId was already processed within the TTL window. */
  isDuplicate(correlationId: string): boolean {
    const timestamp = this.seen.get(correlationId);
    if (timestamp === undefined) return false;

    if (Date.now() - timestamp > this.ttlMs) {
      this.seen.delete(correlationId);
      return false;
    }
    return true;
  }

  /** Records a correlationId as processed with the current timestamp. */
  markProcessed(correlationId: string): void {
    this.seen.set(correlationId, Date.now());
  }

  /** Clears all tracked entries. Useful for test cleanup. */
  clear(): void {
    this.seen.clear();
  }

  /** Stops the periodic eviction timer. Call on shutdown. */
  destroy(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    this.seen.clear();
  }

  private startEviction(): void {
    this.evictionTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.seen) {
        if (now - timestamp > this.ttlMs) {
          this.seen.delete(key);
        }
      }
    }, EVICTION_INTERVAL_MS);

    // Don't keep the process alive just for eviction
    this.evictionTimer.unref();
  }
}

/**
 * Create an IdempotencyGuard instance.
 * Callers are responsible for calling destroy() on shutdown to clean up timers.
 * Use within a Fastify plugin lifecycle (onClose hook) for proper cleanup.
 */
export function createIdempotencyGuard(
  opts?: { ttlMs?: number },
): IdempotencyGuard {
  return new IdempotencyGuard(opts);
}

/**
 * Default singleton IdempotencyGuard instance for use by event handlers.
 *
 * The timer uses unref() so it won't keep the process alive.
 * For Fastify plugin contexts where lifecycle management is needed,
 * prefer createIdempotencyGuard() with explicit destroy() in onClose.
 */
export const idempotencyGuard = new IdempotencyGuard();
