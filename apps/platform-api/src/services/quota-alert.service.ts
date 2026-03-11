// ---------------------------------------------------------------------------
// QuotaAlertService — Creates PlatformAiAlert records on threshold crossing
// Source: E13b-4 Task 2.5, BR-PLT-010
// ---------------------------------------------------------------------------

import type { PlatformPrismaClient } from '../client.js';

interface Logger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

/**
 * Create a QUOTA_WARNING or QUOTA_EXCEEDED alert if one doesn't already exist
 * for this tenant in the current billing period.
 *
 * Called fire-and-forget from the AI record route after threshold crossings.
 * Errors are logged but never thrown — alert creation must not block
 * the critical path of recording AI usage.
 */
export async function createQuotaAlertIfNeeded(
  prisma: PlatformPrismaClient,
  logger: Logger,
  params: {
    tenantId: string;
    type: 'QUOTA_WARNING' | 'QUOTA_EXCEEDED';
    usagePct: number;
    threshold: number;
    periodStart: Date;
  },
): Promise<void> {
  try {
    // Use a serializable transaction to prevent TOCTOU race condition where
    // two concurrent threshold crossings could both create duplicate alerts
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.platformAiAlert.findFirst({
          where: {
            tenantId: params.tenantId,
            type: params.type,
            acknowledged: false,
            createdAt: { gte: params.periodStart },
          },
        });

        if (existing) return; // Already have an active alert for this period

        const message =
          params.type === 'QUOTA_WARNING'
            ? `AI usage at ${Math.round(params.usagePct)}% — approaching soft limit (${params.threshold}%)`
            : `AI usage at ${Math.round(params.usagePct)}% — exceeded hard limit (${params.threshold}%)`;

        await tx.platformAiAlert.create({
          data: {
            type: params.type,
            tenantId: params.tenantId,
            message,
            usagePct: params.usagePct,
            threshold: params.threshold,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    logger.info(
      { tenantId: params.tenantId, type: params.type, usagePct: params.usagePct },
      `quota-alert: created ${params.type} alert`,
    );
  } catch (err) {
    // Never throw — alert creation is non-critical
    logger.error(
      { tenantId: params.tenantId, type: params.type, err },
      'quota-alert: failed to create alert record',
    );
  }
}
