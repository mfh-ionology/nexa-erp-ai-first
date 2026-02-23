import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuotaClient, QuotaCheckError } from '../../quota/quota-client.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Helper to create a successful fetch Response. */
function okResponse(data: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(JSON.stringify({ data })),
  } as unknown as Response;
}

/** Helper to create a failed fetch Response. */
function errorResponse(status: number, body = ''): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: body }),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('QuotaClient', () => {
  const baseConfig = {
    platformApiUrl: 'http://localhost:3001/api/v1',
    serviceToken: 'test-service-token',
    cacheTtlMs: 60_000,
    circuitBreaker: {
      failureThreshold: 3,
      recoveryWindowMs: 30_000,
    },
  };

  let client: QuotaClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new QuotaClient(baseConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Successful quota check ───────────────────────────────────────────

  describe('successful check', () => {
    it('returns quota check result on success', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          allowed: true,
          remainingTokens: 5000,
          quotaPct: 45.5,
        }),
      );

      const result = await client.check('tenant-001', 500, 'chat');

      expect(result).toEqual({
        allowed: true,
        remainingTokens: 5000,
        quotaPct: 45.5,
        warning: undefined,
        degraded: false,
      });
    });

    it('includes warning when present in response', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          allowed: true,
          remainingTokens: 1000,
          quotaPct: 85,
          warning: 'Approaching AI quota limit (85%)',
        }),
      );

      const result = await client.check('tenant-002', 200, 'summary');

      expect(result.warning).toBe('Approaching AI quota limit (85%)');
      expect(result.allowed).toBe(true);
    });

    it('returns allowed: false when hard limit reached', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          allowed: false,
          remainingTokens: 0,
          quotaPct: 102,
        }),
      );

      const result = await client.check('tenant-003', 500, 'chat');

      expect(result.allowed).toBe(false);
      expect(result.remainingTokens).toBe(0);
      expect(result.quotaPct).toBe(102);
    });

    it('sends correct HTTP request', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 5000, quotaPct: 10 }),
      );

      await client.check('tenant-004', 750, 'analysis');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-004/ai/check',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-service-token',
          },
          body: JSON.stringify({ estimatedTokens: 750, featureKey: 'analysis' }),
        },
      );
    });

    it('strips trailing slash from platform URL', async () => {
      const clientWithSlash = new QuotaClient({
        ...baseConfig,
        platformApiUrl: 'http://localhost:3001/api/v1/',
      });

      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 5000, quotaPct: 10 }),
      );

      await clientWithSlash.check('tenant-005', 100, 'chat');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-005/ai/check',
        expect.any(Object),
      );
    });
  });

  // ─── HTTP errors ──────────────────────────────────────────────────────

  describe('HTTP errors', () => {
    it('throws QuotaCheckError on 404', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Tenant not found'));

      await expect(client.check('bad-tenant', 100, 'chat')).rejects.toThrow(QuotaCheckError);
    });

    it('includes status code and body in QuotaCheckError message', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Tenant not found'));

      await expect(client.check('bad-tenant', 100, 'chat')).rejects.toThrow(/404/);
    });

    it('throws QuotaCheckError on 500', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal server error'));

      await expect(client.check('tenant-006', 100, 'chat')).rejects.toThrow(QuotaCheckError);
    });

    it('throws QuotaCheckError on 401', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));

      await expect(client.check('tenant-007', 100, 'chat')).rejects.toThrow(QuotaCheckError);
    });

    it('includes status code in error', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(503, 'Service unavailable'));

      try {
        await client.check('tenant-008', 100, 'chat');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(QuotaCheckError);
        expect((err as QuotaCheckError).statusCode).toBe(503);
      }
    });
  });

  // ─── Caching ──────────────────────────────────────────────────────────

  describe('caching', () => {
    it('populates cache on successful calls (used as fallback when circuit opens)', async () => {
      // First call succeeds → cache populated
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 5000, quotaPct: 30 }),
      );
      await client.check('tenant-cache', 100, 'chat');

      // In CLOSED state, cache is not served — fresh call is made
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 4800, quotaPct: 32 }),
      );
      const result = await client.check('tenant-cache', 100, 'chat');

      expect(result.quotaPct).toBe(32);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // ISSUE #29 FIX: Test that expired cache entries are not served
    it('does not serve expired cache entries when circuit is OPEN', async () => {
      vi.useFakeTimers();

      // Create client with short cache TTL
      const shortTtlClient = new QuotaClient({
        ...baseConfig,
        cacheTtlMs: 5_000, // 5 seconds
      });

      // Seed cache with a successful call
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 5000, quotaPct: 30 }),
      );
      await shortTtlClient.check('tenant-expiry', 100, 'chat');

      // Drive circuit to OPEN with 3 failures
      mockFetch.mockRejectedValue(new Error('Network error'));
      for (let i = 0; i < 3; i++) {
        try { await shortTtlClient.check('tenant-expiry', 100, 'chat'); } catch { /* expected */ }
      }

      // Advance time past cache TTL
      vi.advanceTimersByTime(6_000);

      // Cache is expired → fail-open with degraded result (not stale cache)
      const result = await shortTtlClient.check('tenant-expiry', 100, 'chat');
      expect(result.allowed).toBe(true);
      expect(result.degraded).toBe(true);
      // quotaPct should be -1 (unknown) since cache expired, not 30 (stale)
      expect(result.quotaPct).toBe(-1);
    });
  });

  // ─── Circuit breaker integration ─────────────────────────────────────

  describe('circuit breaker integration', () => {
    it('serves stale cache when circuit is OPEN', async () => {
      // First call succeeds → result cached
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 5000, quotaPct: 40 }),
      );
      await client.check('tenant-cb', 100, 'chat');

      // 3 failures → circuit opens
      mockFetch.mockRejectedValue(new Error('Network error'));
      for (let i = 0; i < 3; i++) {
        try { await client.check('tenant-cb', 100, 'chat'); } catch { /* expected */ }
      }

      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Next call should serve cached result with degraded: true
      const result = await client.check('tenant-cb', 100, 'chat');
      expect(result).toEqual({
        allowed: true,
        remainingTokens: 5000,
        quotaPct: 40,
        warning: undefined,
        degraded: true,
      });
    });

    it('fails-open when circuit is OPEN and no cache exists', async () => {
      // No prior successful call → no cache
      mockFetch.mockRejectedValue(new Error('Network error'));
      for (let i = 0; i < 3; i++) {
        try { await client.check('no-cache-tenant', 100, 'chat'); } catch { /* expected */ }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Should fail-open with degraded result
      const result = await client.check('no-cache-tenant', 100, 'chat');
      expect(result.allowed).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.warning).toContain('degraded mode');
    });

    it('recovers after circuit breaker half-open → success', async () => {
      vi.useFakeTimers();

      // Seed cache
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 5000, quotaPct: 20 }),
      );
      await client.check('tenant-recover', 100, 'chat');

      // Drive to OPEN
      mockFetch.mockRejectedValue(new Error('Network error'));
      for (let i = 0; i < 3; i++) {
        try { await client.check('tenant-recover', 100, 'chat'); } catch { /* expected */ }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Wait for recovery window
      vi.advanceTimersByTime(30_001);

      // Next call succeeds → HALF_OPEN → CLOSED
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: true, remainingTokens: 4500, quotaPct: 25 }),
      );
      const result = await client.check('tenant-recover', 100, 'chat');

      expect(result.quotaPct).toBe(25);
      expect(result.degraded).toBe(false);
      expect(client.getCircuitBreaker().getState()).toBe('CLOSED');
    });
  });

  // ─── Response parsing ─────────────────────────────────────────────────

  describe('response parsing', () => {
    it('handles response without data envelope', async () => {
      // Some APIs may return the result directly
      const directResponse = {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            allowed: true,
            remainingTokens: 3000,
            quotaPct: 60,
          }),
        text: () => Promise.resolve(''),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(directResponse);
      const result = await client.check('tenant-direct', 100, 'chat');

      expect(result.allowed).toBe(true);
      expect(result.quotaPct).toBe(60);
    });

    it('handles response with data envelope', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({ allowed: false, remainingTokens: 0, quotaPct: 105 }),
      );
      const result = await client.check('tenant-envelope', 100, 'chat');

      expect(result.allowed).toBe(false);
      expect(result.quotaPct).toBe(105);
    });
  });

  // ─── Network errors ───────────────────────────────────────────────────

  describe('network errors', () => {
    it('throws on fetch rejection (before circuit opens)', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(client.check('tenant-net', 100, 'chat')).rejects.toThrow('Failed to fetch');
    });
  });
});
