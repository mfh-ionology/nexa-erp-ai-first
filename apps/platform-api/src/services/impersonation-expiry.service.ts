// ---------------------------------------------------------------------------
// Impersonation Expiry Service — Background job to auto-terminate expired sessions
// Source: AC #3, BR-PLT-013, Event Catalog §19
// Story: E13b.5 Task 2
// ---------------------------------------------------------------------------

import { getPlatformPrisma } from '../client.js';

const CHECK_INTERVAL_MS = 60_000; // 60 seconds

let _intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Find all impersonation sessions that have expired (expiresAt < NOW)
 * but have not been ended (endedAt IS NULL), and close them.
 *
 * Emits `platform.impersonation_ended` for each expired session.
 * Called on a 60-second interval from app startup.
 */
export async function checkExpiredSessions(): Promise<number> {
  const prisma = getPlatformPrisma();
  const now = new Date();

  const expiredSessions = await prisma.impersonationSession.findMany({
    where: {
      endedAt: null,
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      platformUserId: true,
      tenantId: true,
      startedAt: true,
      actionsLog: true,
    },
  });

  if (expiredSessions.length === 0) {
    return 0;
  }

  // Close each expired session individually and create audit log entries
  for (const session of expiredSessions) {
    // Guard against concurrent expiry runs: only close if still open (TOCTOU fix)
    const updated = await prisma.impersonationSession.updateMany({
      where: { id: session.id, endedAt: null },
      data: { endedAt: now },
    });

    // Another process already closed this session — skip audit write
    if (updated.count === 0) continue;

    // E13b.5 Fix: Write audit log entry for expired sessions (BR-PLT-017).
    // Route-level audit only fires for HTTP requests; background expiry has no
    // HTTP context, so we write directly to PlatformAuditLog.
    const durationSeconds = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);
    const actionsCount = Array.isArray(session.actionsLog) ? session.actionsLog.length : 0;

    try {
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: session.platformUserId,
          action: 'platform.impersonation_ended',
          targetType: 'impersonation_session',
          targetId: session.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          details: {
            reason: 'expired',
            tenantId: session.tenantId,
            durationSeconds,
            actionsCount,
          } as any,
          ipAddress: 'system',
        },
      });
    } catch (err) {
      // Audit failures must not break the expiry job (BR-PLT-017),
      // but they must be logged so persistent failures are visible.
      console.error(
        '[ImpersonationExpiry] Failed to write audit log for expired session:',
        session.id,
        err,
      );
    }
  }

  return expiredSessions.length;
}

/**
 * Start the background expiry check interval.
 * Should be called from app `onReady` hook.
 */
export function startExpiryCheck(): void {
  if (_intervalHandle) return; // already running
  _intervalHandle = setInterval(() => {
    void checkExpiredSessions();
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the background expiry check interval.
 * Should be called from app `onClose` hook.
 */
export function stopExpiryCheck(): void {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
