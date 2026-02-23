import type { Logger } from 'pino';
import type { EntitlementCache } from './cache/cache.interface.js';
import { createEntitlementCache } from './cache/cache-factory.js';
import { CircuitBreaker } from './circuit-breaker/circuit-breaker.js';
import type { PlatformClient } from './platform-client.interface.js';
import type {
  AiQuotaCheck,
  AiUsageRecord,
  EntitlementResult,
  ModuleAccess,
  PlatformClientConfig,
  TenantEntitlements,
  TenantStatusResponse,
  UserQuota,
} from './types/index.js';

const DEFAULT_CACHE_TTL_MS = 300_000; // 5 minutes
const DEFAULT_FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]; // Exponential backoff: 1s, 2s, 4s
const MAX_STALE_CACHE_ENTRIES = 1_000;

/** Error from Platform API HTTP calls. */
class PlatformApiError extends Error {
  readonly statusCode: number;
  /** True for 4xx client errors — signals circuit breaker to skip failure tracking. */
  readonly __skipCircuitBreaker: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'PlatformApiError';
    this.statusCode = statusCode;
    // Only 4xx errors are client errors that should skip circuit breaker tracking.
    // 5xx and other non-OK statuses are infrastructure failures.
    this.__skipCircuitBreaker = statusCode >= 400 && statusCode < 500;
  }
}

/**
 * PlatformClientService — runtime bridge between the ERP tenant application
 * and the Platform control plane.
 *
 * Provides cached entitlement lookups, live quota/status checks, and
 * AI usage recording with circuit breaker resilience.
 */
export class PlatformClientService implements PlatformClient {
  private readonly platformApiUrl: string;
  private readonly serviceToken: string;
  private readonly cacheTtlMs: number;
  private readonly cache: EntitlementCache;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger?: Logger;

  /** Stale cache for circuit breaker fallback (kept separate from TTL-managed cache). */
  private readonly staleCache = new Map<string, TenantEntitlements>();

  /** Tracks tenantIds with pending async cache invalidation to prevent stale reads. */
  private readonly pendingInvalidations = new Set<string>();

  /** Tracks in-flight invalidation promises so destroy() can await them. */
  private readonly pendingInvalidationPromises: Promise<void>[] = [];

  constructor(config: PlatformClientConfig) {
    this.platformApiUrl = config.platformApiUrl.replace(/\/$/, '');
    this.serviceToken = config.serviceToken;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.logger = config.logger;

    this.cache = createEntitlementCache(config.redisUrl, config.logger);

    // Single shared circuit breaker for all Platform API endpoints (entitlements,
    // quota, status, AI). Trade-off: a localized failure on one endpoint degrades
    // all Platform API integration. Acceptable because all endpoints share the same
    // infrastructure and a partial Platform API outage is uncommon. If endpoint-level
    // isolation is needed in the future, split into separate CircuitBreaker instances.
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.circuitBreaker?.failureThreshold ?? 3,
      recoveryWindowMs: config.circuitBreaker?.recoveryWindowMs ?? 30_000,
      logger: config.logger,
    });
  }

  // ─── Entitlements (cached, 5-min TTL, webhook-invalidated) ──────────

  async getEntitlements(tenantId: string): Promise<EntitlementResult> {
    // 1. Check cache first (skip if invalidation is pending)
    if (!this.pendingInvalidations.has(tenantId)) {
      try {
        const cached = await this.cache.get(tenantId);
        if (cached) {
          return { entitlements: cached, degraded: false };
        }
      } catch (err) {
        // Redis/cache failure should not crash entitlement checks — fall through to live fetch
        this.logger?.warn(
          { tenantId, error: (err as Error).message },
          'PlatformClient: cache read failed, falling through to live fetch',
        );
      }
    }

    // 2. Cache miss → fetch through circuit breaker
    return this.circuitBreaker.execute(
      async () => {
        const entitlements = await this.fetchEntitlements(tenantId);
        // Cache result and keep stale copy for fallback
        await this.cache.set(tenantId, entitlements, this.cacheTtlMs);
        // Evict oldest stale entry if at capacity (prevents unbounded memory growth)
        if (this.staleCache.size >= MAX_STALE_CACHE_ENTRIES && !this.staleCache.has(tenantId)) {
          const oldestKey = this.staleCache.keys().next().value as string;
          this.staleCache.delete(oldestKey);
        }
        this.staleCache.set(tenantId, entitlements);
        return { entitlements, degraded: false } satisfies EntitlementResult;
      },
      // Fallback when circuit is OPEN → serve stale cache
      () => this.serveStaleEntitlements(tenantId),
    );
  }

  async checkModuleAccess(tenantId: string, moduleKey: string): Promise<ModuleAccess> {
    const { entitlements, degraded } = await this.getEntitlements(tenantId);

    // Fail-open: if degraded and module list is empty, allow access (BR-PLT-020)
    if (degraded && entitlements.enabledModules.length === 0) {
      return { allowed: true };
    }

    if (entitlements.enabledModules.includes(moduleKey)) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Module not included in your plan' };
  }

  // ─── Live calls (NOT cached) ───────────────────────────────────────

  async checkUserQuota(tenantId: string): Promise<UserQuota> {
    return this.circuitBreaker.execute(
      async () => this.fetchJson<UserQuota>(
        'GET',
        `/platform/tenants/${tenantId}/users/quota`,
      ),
      // Fail-open default
      () => ({ currentCount: -1, maxUsers: -1, canAddUser: true }),
    );
  }

  async getTenantStatus(tenantId: string): Promise<TenantStatusResponse> {
    return this.circuitBreaker.execute(
      async () => this.fetchJson<TenantStatusResponse>(
        'GET',
        `/platform/tenants/${tenantId}/status`,
      ),
      // Fail-open default (BR-PLT-020: ERP degrades gracefully if Platform unreachable)
      () => ({
        status: 'ACTIVE' as const,
        billingStatus: 'CURRENT' as const,
        enforcementAction: 'NONE' as const,
        maintenanceMode: false,
      }),
    );
  }

  // ─── AI Gateway (always live, no cache) ─────────────────────────────

  async checkAiQuota(
    tenantId: string,
    estimatedTokens: number,
    featureKey: string,
  ): Promise<AiQuotaCheck> {
    return this.circuitBreaker.execute<AiQuotaCheck>(
      async () => {
        const result = await this.fetchJson<AiQuotaCheck>(
          'POST',
          `/platform/tenants/${tenantId}/ai/check`,
          { estimatedTokens, featureKey },
        );
        return { ...result, degraded: false };
      },
      // Fail-open (BR-PLT-020)
      () => ({
        allowed: true,
        remainingTokens: 0,
        quotaPct: -1,
        warning: 'AI quota check unavailable — operating in degraded mode',
        degraded: true,
      }),
    );
  }

  async recordAiUsage(record: AiUsageRecord): Promise<void> {
    // Fire-and-forget: NEVER throws
    this.recordAiUsageWithRetry(record).catch(() => {
      // Swallowed — already logged in retry handler
    });
  }

  // ─── Cache management ──────────────────────────────────────────────

  invalidateCache(tenantId: string): void {
    this.logger?.info({ tenantId }, 'PlatformClient: invalidating entitlement cache');
    // Mark as pending so getEntitlements skips stale primary cache during async gap
    this.pendingInvalidations.add(tenantId);
    // Preserve stale cache as circuit breaker fallback. If the Platform API is
    // unreachable when getEntitlements re-fetches, the stale data is better than
    // fail-open defaults (which could e.g. return status=ACTIVE for a suspended tenant).
    // The stale cache is replaced with fresh data on the next successful fetch.
    const invalidationPromise = this.cache.delete(tenantId).then(() => {
      this.pendingInvalidations.delete(tenantId);
    }).catch((err) => {
      this.pendingInvalidations.delete(tenantId);
      this.logger?.error(
        { tenantId, error: (err as Error).message },
        'PlatformClient: failed to invalidate cache',
      );
    });
    this.pendingInvalidationPromises.push(invalidationPromise);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  async destroy(): Promise<void> {
    this.logger?.info('PlatformClient: destroying client and closing connections');
    // Await any in-flight cache invalidations before closing connections
    await Promise.allSettled(this.pendingInvalidationPromises);
    this.pendingInvalidationPromises.length = 0;
    try {
      await this.cache.destroy();
    } catch (err) {
      this.logger?.error(
        { error: (err as Error).message },
        'PlatformClient: error during cache destroy',
      );
    }
    this.staleCache.clear();
    this.pendingInvalidations.clear();
  }

  // ─── Internal helpers ──────────────────────────────────────────────

  private async fetchEntitlements(tenantId: string): Promise<TenantEntitlements> {
    return this.fetchJson<TenantEntitlements>(
      'GET',
      `/platform/tenants/${tenantId}/entitlements`,
    );
  }

  /**
   * Generic HTTP fetch helper that handles:
   * - Authorization header with service token
   * - AbortSignal timeout (5s)
   * - Platform API response envelope unwrapping ({ data: ... })
   * - 4xx vs 5xx error classification
   */
  private async fetchJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.platformApiUrl}${path}`;

    this.logger?.debug({ method, url }, 'PlatformClient: HTTP request');

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.serviceToken}`,
      },
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new PlatformApiError(
        `Platform API returned ${response.status}: ${text}`,
        response.status,
      );
    }

    // Handle 204 No Content (common for fire-and-forget endpoints like recordAiUsage)
    if (response.status === 204) {
      this.logger?.debug({ method, url }, 'PlatformClient: HTTP response 204 No Content');
      return undefined as T;
    }

    // Read body as text first to safely handle empty responses
    const text = await response.text();
    if (!text) {
      this.logger?.debug({ method, url }, 'PlatformClient: HTTP response OK (empty body)');
      return undefined as T;
    }

    const json = JSON.parse(text) as { data?: T } & T;
    // Unwrap Platform API envelope: { data: ... }
    const data: T = json.data ?? json;

    this.logger?.debug({ method, url }, 'PlatformClient: HTTP response OK');

    return data;
  }

  /** Serve stale cached entitlements with degraded flag when circuit is OPEN. */
  private serveStaleEntitlements(tenantId: string): EntitlementResult {
    const stale = this.staleCache.get(tenantId);

    if (stale) {
      this.logger?.warn(
        { tenantId },
        'PlatformClient: serving stale cached entitlements (Platform API unreachable)',
      );
      return { entitlements: stale, degraded: true };
    }

    // No cache at all → fail-open defaults (BR-PLT-020)
    this.logger?.warn(
      { tenantId },
      'PlatformClient: no cached entitlements, returning fail-open defaults',
    );
    return {
      entitlements: {
        status: 'ACTIVE',
        planCode: 'unknown',
        billingStatus: 'CURRENT',
        enforcementAction: 'NONE',
        maxUsers: 999,
        maxCompanies: 999,
        enabledModules: [],
        featureFlags: {},
      },
      degraded: true,
    };
  }

  /** Record AI usage with in-memory retry queue (3 retries, exponential backoff). */
  private async recordAiUsageWithRetry(record: AiUsageRecord): Promise<void> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      // Skip doomed retries when circuit breaker knows Platform API is down
      if (attempt > 0 && this.circuitBreaker.getState() === 'OPEN') {
        this.logger?.warn(
          { tenantId: record.tenantId, attempt },
          'PlatformClient: AI usage recording skipped — circuit breaker is OPEN',
        );
        return;
      }
      try {
        await this.fetchJson<void>(
          'POST',
          `/platform/tenants/${record.tenantId}/ai/record`,
          record,
        );
        return; // Success
      } catch (err) {
        if (attempt < RETRY_DELAYS_MS.length) {
          this.logger?.warn(
            { tenantId: record.tenantId, attempt: attempt + 1, error: (err as Error).message },
            'PlatformClient: AI usage recording failed, retrying',
          );
          await this.delay(RETRY_DELAYS_MS[attempt]!);
        } else {
          this.logger?.warn(
            { tenantId: record.tenantId, error: (err as Error).message },
            'PlatformClient: AI usage recording failed after all retries — discarding',
          );
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Exposed for testing. */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }
}
