// ---------------------------------------------------------------------------
// PlatformAuditService — Append-only audit log for platform admin actions
// Source: BR-PLT-016 (immutable), BR-PLT-017 (every state-changing action logged), NFR49
// ---------------------------------------------------------------------------

import { getPlatformPrisma } from '../../client.js';

/**
 * Parameters for creating a PlatformAuditLog entry.
 */
export interface PlatformAuditLogParams {
  platformUserId: string;
  action: string; // e.g. "auth.login", "tenant.suspend"
  targetType?: string; // e.g. "tenant", "plan", "platform_user"
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
}

/**
 * Append-only audit service for Platform admin actions.
 *
 * Design constraints:
 * - Append-only: no update or delete methods (BR-PLT-016, NFR49)
 * - Errors caught and logged, never thrown — audit failures must not break operations (BR-PLT-017)
 */
export class PlatformAuditService {
  private logger: { error: (...args: unknown[]) => void } | null = null;

  /**
   * Attach a logger (e.g. Fastify logger) for structured error output.
   * Falls back to console.error if no logger is set.
   */
  setLogger(
    logger: { error: (...args: unknown[]) => void } | null,
  ): void {
    this.logger = logger;
  }

  /**
   * Insert a single immutable PlatformAuditLog record.
   *
   * Audit insert failures are logged but never re-thrown —
   * audit failures must not break platform operations.
   */
  async log(params: PlatformAuditLogParams): Promise<void> {
    try {
      const prisma = getPlatformPrisma();
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: params.platformUserId,
          action: params.action,
          targetType: params.targetType ?? null,
          targetId: params.targetId ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Prisma InputJsonValue requires concrete JSON types
          details: (params.details as any) ?? undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (err) {
      const log = this.logger ?? console;

      // Classify: Prisma client-known errors with connection/timeout codes are transient
      const isTransient =
        err instanceof Error &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string' &&
        ['P1001', 'P1002', 'P1008', 'P1017'].includes(
          (err as { code: string }).code,
        );

      if (isTransient) {
        log.error(
          '[PlatformAuditService] Transient DB error writing audit log (will not retry):',
          err,
        );
      } else {
        log.error(
          '[PlatformAuditService] Failed to write audit log — possible schema or mapping error:',
          { action: params.action, targetType: params.targetType, error: err },
        );
      }
    }
  }
}

// Singleton instance
export const platformAuditService = new PlatformAuditService();
