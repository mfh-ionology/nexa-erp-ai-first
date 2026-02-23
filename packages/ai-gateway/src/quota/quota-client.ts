import type { Logger } from 'pino';
import type { QuotaCheckResult } from '../types/index.js';
import { CircuitBreaker } from '../circuit-breaker/circuit-breaker.js';

export interface QuotaClientConfig {
  /** Platform API base URL (e.g. http://localhost:3001/api/v1). */
  platformApiUrl: string;
  /** Service token for Platform API authentication. */
  serviceToken: string;
  /** Logger instance. */
  logger?: Logger;
  /** Cache TTL in ms. Default: 60_000 (60s). */
  cacheTtlMs?: number;
  /** Circuit breaker config overrides. */
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryWindowMs?: number;
  };
}

interface CachedQuotaResult {
  result: QuotaCheckResult;
  cachedAt: number;
}

/**
 * QuotaClient — calls Platform API `/platform/tenants/:id/ai/check`
 * to perform pre-flight quota checks before AI calls.
 *
 * Implements a circuit breaker (BR-PLT-020): when the Platform API is
 * unreachable, serves from cached quota data with `degraded: true`.
 */
/** ISSUE #10: Default timeout for fetch calls (ms). */
const DEFAULT_FETCH_TIMEOUT_MS = 5_000;

export class QuotaClient {
  private readonly platformApiUrl: string;
  private readonly serviceToken: string;
  private readonly logger?: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  // ISSUE #13 FIX: Store cacheTtlMs so it can be enforced
  private readonly cacheTtlMs: number;

  /** Per-tenant cached quota results. */
  private readonly cache = new Map<string, CachedQuotaResult>();

  constructor(config: QuotaClientConfig) {
    this.platformApiUrl = config.platformApiUrl.replace(/\/$/, '');
    this.serviceToken = config.serviceToken;
    this.logger = config.logger;
    this.cacheTtlMs = config.cacheTtlMs ?? 60_000;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.circuitBreaker?.failureThreshold ?? 3,
      recoveryWindowMs: config.circuitBreaker?.recoveryWindowMs ?? 30_000,
      logger: config.logger,
    });
  }

  /**
   * Pre-flight quota check against the Platform API.
   *
   * On success, caches the result for circuit breaker fallback.
   * On failure (circuit open), serves stale cache with `degraded: true`.
   */
  async check(
    tenantId: string,
    estimatedTokens: number,
    featureKey: string,
  ): Promise<QuotaCheckResult> {
    return this.circuitBreaker.execute(
      // Primary: HTTP call to Platform API
      async () => {
        try {
          const result = await this.fetchQuotaCheck(tenantId, estimatedTokens, featureKey);
          // Cache on success (keyed by tenantId for fallback lookup)
          this.cache.set(tenantId, { result, cachedAt: Date.now() });
          return result;
        } catch (err) {
          // 4xx client errors should NOT trip the circuit breaker —
          // they indicate a problem with this specific request, not
          // Platform API infrastructure. Re-throw as a non-circuit error.
          // ISSUE #28 FIX: Use a proper error subclass with __skipCircuitBreaker
          // instead of monkey-patching — the property survives error wrapping
          if (err instanceof QuotaCheckError && err.isClientError) {
            const skipError = new CircuitBreakerSkipError(err.message, err.statusCode);
            throw skipError;
          }
          throw err;
        }
      },
      // Fallback: serve stale cache when circuit is OPEN
      () => this.serveCachedResult(tenantId),
    );
  }

  /** HTTP call to Platform API quota check endpoint. */
  private async fetchQuotaCheck(
    tenantId: string,
    estimatedTokens: number,
    featureKey: string,
  ): Promise<QuotaCheckResult> {
    const url = `${this.platformApiUrl}/platform/tenants/${tenantId}/ai/check`;

    this.logger?.debug(
      { tenantId, estimatedTokens, featureKey, url },
      'QuotaClient: checking quota',
    );

    // ISSUE #10 FIX: Add timeout via AbortSignal to prevent indefinite hangs
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.serviceToken}`,
      },
      body: JSON.stringify({ estimatedTokens, featureKey }),
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new QuotaCheckError(
        `Platform API returned ${response.status}: ${body}`,
        response.status,
      );
      // Only 5xx and network errors should trip the circuit breaker.
      // 4xx errors are client errors (bad tenant ID, auth issues) that
      // should NOT open the circuit and block all tenants.
      if (response.status < 500) {
        error.isClientError = true;
      }
      throw error;
    }

    const json = (await response.json()) as { data?: QuotaCheckResult } & QuotaCheckResult;

    // The Platform API wraps responses in { data: ... } envelope
    const data: QuotaCheckResult = json.data ?? json;

    this.logger?.debug(
      { tenantId, allowed: data.allowed, quotaPct: data.quotaPct },
      'QuotaClient: quota check result',
    );

    return {
      allowed: data.allowed,
      remainingTokens: data.remainingTokens,
      quotaPct: data.quotaPct,
      warning: data.warning,
      degraded: false,
    };
  }

  /** Return cached quota result with degraded flag when circuit is open. */
  private serveCachedResult(tenantId: string): QuotaCheckResult {
    const cached = this.cache.get(tenantId);

    // ISSUE #13 FIX: Check cache TTL — only serve if within TTL
    if (cached && (Date.now() - cached.cachedAt) <= this.cacheTtlMs) {
      this.logger?.warn(
        { tenantId, cachedAt: new Date(cached.cachedAt).toISOString() },
        'QuotaClient: serving stale cached quota (Platform API unreachable)',
      );
      return { ...cached.result, degraded: true };
    }

    if (cached) {
      // Cache expired — remove it
      this.cache.delete(tenantId);
      this.logger?.warn(
        { tenantId, cachedAt: new Date(cached.cachedAt).toISOString() },
        'QuotaClient: cached quota expired, discarding',
      );
    }

    // No valid cache available — allow the call through (fail-open)
    // ISSUE #20 FIX: Report quotaPct as -1 to indicate "unknown" rather than false 0
    this.logger?.warn(
      { tenantId },
      'QuotaClient: no cached quota available, allowing call (fail-open)',
    );
    return {
      allowed: true,
      remainingTokens: 0,
      quotaPct: -1, // -1 indicates "unknown" — callers should not treat this as "0% used"
      warning: 'Quota check unavailable — operating in degraded mode',
      degraded: true,
    };
  }

  /** Get the circuit breaker (for monitoring/testing). */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }
}

/** Error from Platform API quota check HTTP call. */
export class QuotaCheckError extends Error {
  readonly statusCode: number;
  /** True if this is a 4xx client error that should NOT trip the circuit breaker. */
  isClientError = false;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'QuotaCheckError';
    this.statusCode = statusCode;
  }
}

/**
 * ISSUE #28 FIX: Error subclass with __skipCircuitBreaker as a class property,
 * surviving any error wrapping (unlike monkey-patched plain Error objects).
 */
export class CircuitBreakerSkipError extends Error {
  readonly __skipCircuitBreaker = true;
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'CircuitBreakerSkipError';
    this.statusCode = statusCode;
  }
}
