import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type Redis from 'ioredis';

// ─── Context TTL ────────────────────────────────────────────────────────────

/** Redis context cache TTL in seconds (15 minutes) */
const CONTEXT_TTL_SECONDS = 15 * 60;

/** Maximum recent audit log entries to include in context */
const MAX_RECENT_ENTRIES = 10;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserContext {
  user: { id: string; name: string; role: string };
  tenant: { id: string; companyName: string; baseCurrency: string };
  recentEntities: { type: string; id: string; name: string; accessedAt: string }[];
  recentActions: { action: string; entity: string; timestamp: string }[];
  currentPeriod: { start: string; end: string; isLocked: boolean };
  preferences: { dateFormat?: string; locale?: string };
}

// ─── ContextEngine ──────────────────────────────────────────────────────────

export class ContextEngine {
  constructor(
    private redis: Redis,
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  /**
   * Get or build user context from Redis.
   * On cache hit, returns cached context.
   * On cache miss, builds context from DB queries and caches with 15-minute TTL.
   */
  async getUserContext(userId: string, companyId: string, tenantId: string): Promise<UserContext> {
    const redisKey = this.buildKey(tenantId, userId);

    // Try cache first
    const cached = await this.redis.get(redisKey);
    if (cached) {
      try {
        return JSON.parse(cached) as UserContext;
      } catch {
        this.logger.warn({ redisKey }, 'Failed to parse cached context, rebuilding');
      }
    }

    // Cache miss — build from DB
    const context = await this.buildContextFromDb(userId, companyId, tenantId);

    // Store in Redis with TTL
    await this.redis.set(redisKey, JSON.stringify(context), 'EX', CONTEXT_TTL_SECONDS);

    return context;
  }

  /**
   * Update context incrementally (called from event subscribers).
   * Merges the update with existing cached context, or builds fresh if no cache exists.
   */
  async updateContext(userId: string, tenantId: string, update: Partial<UserContext>): Promise<void> {
    const redisKey = this.buildKey(tenantId, userId);

    const cached = await this.redis.get(redisKey);
    if (!cached) {
      // No cached context to update — next getUserContext will build fresh
      this.logger.debug({ userId, tenantId }, 'No cached context to update');
      return;
    }

    let existing: UserContext;
    try {
      existing = JSON.parse(cached) as UserContext;
    } catch {
      this.logger.warn({ redisKey }, 'Failed to parse cached context for update');
      return;
    }

    // Merge update into existing context
    const merged: UserContext = {
      user: update.user ?? existing.user,
      tenant: update.tenant ?? existing.tenant,
      recentEntities: update.recentEntities ?? existing.recentEntities,
      recentActions: update.recentActions ?? existing.recentActions,
      currentPeriod: update.currentPeriod ?? existing.currentPeriod,
      preferences: update.preferences ?? existing.preferences,
    };

    // Re-store with fresh TTL
    await this.redis.set(redisKey, JSON.stringify(merged), 'EX', CONTEXT_TTL_SECONDS);
  }

  /**
   * Full refresh (called by background job).
   * Rebuilds context from DB and stores in Redis.
   */
  async refreshContext(userId: string, companyId: string, tenantId: string): Promise<void> {
    const context = await this.buildContextFromDb(userId, companyId, tenantId);
    const redisKey = this.buildKey(tenantId, userId);
    await this.redis.set(redisKey, JSON.stringify(context), 'EX', CONTEXT_TTL_SECONDS);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /** Build Redis key: {tenantId}:context:{userId} */
  private buildKey(tenantId: string, userId: string): string {
    return `${tenantId}:context:${userId}`;
  }

  /**
   * Build context from DB queries:
   * - User profile (name, role)
   * - Company settings (name, baseCurrency)
   * - Recent audit log entries (last 10 actions by this user)
   * - User preferences (dateFormat, locale)
   */
  private async buildContextFromDb(
    userId: string,
    companyId: string,
    tenantId: string,
  ): Promise<UserContext> {
    // Run independent queries in parallel
    const [user, company, recentAuditLogs, userRole] = await Promise.all([
      this.db.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, locale: true },
      }),
      this.db.companyProfile.findUnique({
        where: { id: companyId },
        select: { name: true, baseCurrencyCode: true, dateFormat: true },
      }),
      this.db.auditLog.findMany({
        where: { companyId, userId },
        orderBy: { timestamp: 'desc' },
        take: MAX_RECENT_ENTRIES,
        select: {
          entityType: true,
          entityId: true,
          action: true,
          timestamp: true,
        },
      }),
      this.db.userCompanyRole.findFirst({
        where: { userId, companyId },
        select: { role: true },
      }),
    ]);

    const userName = user
      ? `${user.firstName} ${user.lastName}`
      : 'Unknown';

    const role = userRole?.role ?? 'STAFF';

    // Deduplicate recent entities from audit log (unique by entityType + entityId, most recent first)
    const entityMap = new Map<string, { type: string; id: string; name: string; accessedAt: string }>();
    for (const log of recentAuditLogs ?? []) {
      const key = `${log.entityType}:${log.entityId}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, {
          type: log.entityType,
          id: log.entityId,
          name: log.entityId, // entity name not available in audit log; use ID as fallback
          accessedAt: (log.timestamp as Date).toISOString(),
        });
      }
    }

    // Build recent actions from audit log
    const recentActions = (recentAuditLogs ?? []).map((log: any) => ({
      action: log.action,
      entity: `${log.entityType}:${log.entityId}`,
      timestamp: (log.timestamp as Date).toISOString(),
    }));

    // Current fiscal period — derive from current date
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      user: {
        id: userId,
        name: userName,
        role,
      },
      tenant: {
        id: tenantId,
        companyName: company?.name ?? 'Unknown',
        baseCurrency: company?.baseCurrencyCode ?? 'GBP',
      },
      recentEntities: Array.from(entityMap.values()),
      recentActions,
      currentPeriod: {
        start: periodStart.toISOString().split('T')[0]!,
        end: periodEnd.toISOString().split('T')[0]!,
        isLocked: false, // No FiscalPeriod model yet — default to unlocked
      },
      preferences: {
        dateFormat: company?.dateFormat ?? 'DD/MM/YYYY',
        locale: user?.locale ?? 'en',
      },
    };
  }
}
