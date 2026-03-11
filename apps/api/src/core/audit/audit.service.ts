// ---------------------------------------------------------------------------
// AuditService — Subscribes to business events and writes immutable audit logs
// Source: Architecture §2.6, Business Rules IMP-003, NFR22
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { EventBus } from '../events/event-bus.js';
import type { BusinessEvents } from '../events/event-bus.types.js';
import { getImpersonationContext } from '../auth/impersonation-context.js';
import type { AuditEntry } from './audit.types.js';
import { AUDIT_EVENT_MAPPINGS } from './audit.mappings.js';

export class AuditService {
  private logger: {
    error: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
  } | null = null;

  /**
   * Optionally attach a logger (e.g. Fastify logger) for structured error output.
   * Falls back to console.error if no logger is set.
   */
  setLogger(
    logger: { error: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void } | null,
  ): void {
    this.logger = logger;
  }

  /**
   * Insert a single immutable AuditLog record.
   *
   * Per NFR22: audit insert failures are logged but never re-thrown —
   * audit failures must not break business operations.
   *
   * Errors are classified:
   * - Transient DB errors (connection, timeout): logged as warnings
   * - Schema/programming errors (invalid field, constraint violation): logged as errors
   */
  async log(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
    try {
      // E13b.5 (BR-PLT-015): If running within an impersonation session,
      // merge impersonatedBy metadata into afterData for dual audit logging.
      const impersonation = getImpersonationContext();
      const afterData = impersonation
        ? { ...(entry.afterData ?? {}), _impersonatedBy: impersonation }
        : entry.afterData;

      await prisma.auditLog.create({
        data: {
          companyId: entry.companyId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Prisma InputJsonValue requires concrete JSON types; our Record<string, unknown> is always JSON-safe
          beforeData: (entry.beforeData as any) ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          afterData: (afterData as any) ?? undefined,
          userId: entry.userId,
          isAiAction: entry.isAiAction,
          aiConfidence: entry.aiConfidence ?? undefined,
          correlationId: entry.correlationId ?? undefined,
        },
      });
    } catch (err) {
      const log = this.logger ?? console;

      // Classify: Prisma client-known errors with connection/timeout codes are transient;
      // everything else (invalid field, constraint violation, type mismatch) is a programming error.
      const isTransient =
        err instanceof Error &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string' &&
        ['P1001', 'P1002', 'P1008', 'P1017'].includes((err as { code: string }).code);

      if (isTransient) {
        // Transient DB errors — warn level, expected to self-resolve
        const warn = log.warn ?? log.error;
        warn('[AuditService] Transient DB error writing audit log (will not retry):', err);
      } else {
        // Schema/programming errors — error level, requires investigation
        log.error('[AuditService] Failed to write audit log — possible schema or mapping error:', {
          entityType: entry.entityType,
          action: entry.action,
          error: err,
        });
      }
    }
  }

  /**
   * Subscribe to all mapped business events on the given EventBus.
   *
   * For each event in AUDIT_EVENT_MAPPINGS, registers a handler that:
   * 1. Extracts audit fields from the event payload via the mapping function
   * 2. Defaults `isAiAction` to false if not explicitly set
   * 3. Calls `log()` to persist the audit record
   *
   * The `prisma` client is captured in the closure so handlers can write
   * audit records without needing access to the request context.
   */
  registerEventSubscriptions(eventBus: EventBus, prisma: PrismaClient): void {
    for (const [eventName, mappingFn] of Object.entries(AUDIT_EVENT_MAPPINGS)) {
      eventBus.on(eventName as keyof BusinessEvents, (payload: unknown) => {
        const mapped = mappingFn(payload);

        const entry: AuditEntry = {
          ...mapped,
          isAiAction: mapped.isAiAction ?? false,
        };

        // Return the promise so EventBus.drain() can await audit writes during shutdown.
        // Error swallowing inside log() already prevents propagation per NFR22.
        return this.log(prisma, entry);
      });
    }
  }
}

// Singleton instance
export const auditService = new AuditService();
