import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlatformClientService } from '../platform-client.service.js';
import type {
  AiQuotaCheck,
  AiUsageRecord,
  PlatformClientConfig,
  SuggestedKnowledgeArticle,
  TenantEntitlements,
  TenantStatusResponse,
  UserQuota,
} from '../types/index.js';

// ─── Test Fixtures ──────────────────────────────────────────────────────

const TEST_TENANT_ID = 'tenant-001';

const MOCK_ENTITLEMENTS: TenantEntitlements = {
  status: 'ACTIVE',
  planCode: 'pro',
  billingStatus: 'CURRENT',
  enforcementAction: 'NONE',
  maxUsers: 50,
  maxCompanies: 5,
  enabledModules: ['finance', 'ar', 'ap', 'sales'],
  featureFlags: { ai_forecasting: true, advanced_reporting: false },
};

const MOCK_AI_QUOTA: AiQuotaCheck = {
  allowed: true,
  remainingTokens: 50_000,
  quotaPct: 42,
  warning: undefined,
};

const MOCK_USER_QUOTA: UserQuota = {
  currentCount: 12,
  maxUsers: 50,
  canAddUser: true,
};

const MOCK_TENANT_STATUS: TenantStatusResponse = {
  status: 'ACTIVE',
  billingStatus: 'CURRENT',
  enforcementAction: 'NONE',
  maintenanceMode: false,
};

const MOCK_SUGGESTED_ARTICLE: SuggestedKnowledgeArticle = {
  id: 'article-001',
  title: 'Best Practice: Invoice Automation',
  content: 'Detailed guidance on automating invoice processing...',
  category: 'BEST_PRACTICE',
  version: 1,
  publishedAt: '2026-03-10T12:00:00.000Z',
  previousResponse: null,
};

const MOCK_USAGE_RECORD: AiUsageRecord = {
  tenantId: TEST_TENANT_ID,
  userId: 'user-001',
  featureKey: 'chat-assist',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250514',
  promptTokens: 100,
  completionTokens: 200,
  totalTokens: 300,
  costEstimate: 0.003,
  requestId: 'req-001',
  isByok: false,
  fallbackUsed: false,
};

function createConfig(overrides?: Partial<PlatformClientConfig>): PlatformClientConfig {
  return {
    platformApiUrl: 'http://localhost:3001/api/v1',
    serviceToken: 'test-service-token',
    cacheTtlMs: 300_000,
    circuitBreaker: {
      failureThreshold: 3,
      recoveryWindowMs: 30_000,
    },
    ...overrides,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function mockFetchSuccess<T>(data: T, meta?: Record<string, unknown>) {
  const body = JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) });
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetchFailure(status: number, text = 'error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  } as unknown as Response);
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error('fetch failed'));
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('PlatformClientService', () => {
  let client: PlatformClientService;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchSuccess(MOCK_ENTITLEMENTS));
    client = new PlatformClientService(createConfig());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ─── Entitlement Caching ──────────────────────────────────────────

  describe('getEntitlements — caching', () => {
    it('fetches from Platform API on first call and caches', async () => {
      const result = await client.getEntitlements(TEST_TENANT_ID);

      expect(result.entitlements).toEqual(MOCK_ENTITLEMENTS);
      expect(result.degraded).toBe(false);
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/entitlements',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-service-token',
          }),
        }),
      );
    });

    it('returns cached entitlements on second call without HTTP call', async () => {
      // First call — fetches
      await client.getEntitlements(TEST_TENANT_ID);
      expect(fetch).toHaveBeenCalledOnce();

      // Second call — from cache
      const result = await client.getEntitlements(TEST_TENANT_ID);
      expect(result.entitlements).toEqual(MOCK_ENTITLEMENTS);
      expect(result.degraded).toBe(false);
      expect(fetch).toHaveBeenCalledOnce(); // Still only 1 call
    });

    it('fetches fresh data after cache expires', async () => {
      vi.useFakeTimers();

      // Use short TTL for testing
      client = new PlatformClientService(createConfig({ cacheTtlMs: 1_000 }));
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_ENTITLEMENTS));

      // First call
      await client.getEntitlements(TEST_TENANT_ID);
      expect(fetch).toHaveBeenCalledOnce();

      // Advance past TTL
      vi.advanceTimersByTime(1_001);

      // Second call — cache expired, fetches again
      await client.getEntitlements(TEST_TENANT_ID);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── checkModuleAccess ──────────────────────────────────────────────

  describe('checkModuleAccess', () => {
    it('returns allowed: true for enabled module', async () => {
      const result = await client.checkModuleAccess(TEST_TENANT_ID, 'finance');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns allowed: false for disabled module', async () => {
      const result = await client.checkModuleAccess(TEST_TENANT_ID, 'manufacturing');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Module not included in your plan');
    });

    it('uses cached entitlements — no additional HTTP call', async () => {
      // Pre-populate cache
      await client.getEntitlements(TEST_TENANT_ID);
      expect(fetch).toHaveBeenCalledOnce();

      // checkModuleAccess should NOT trigger another fetch
      await client.checkModuleAccess(TEST_TENANT_ID, 'finance');
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('fails open when degraded with empty module list (BR-PLT-020)', async () => {
      // Open the circuit by failing 3 times
      const networkError = mockFetchNetworkError();
      vi.stubGlobal('fetch', networkError);

      client = new PlatformClientService(createConfig());

      for (let i = 0; i < 3; i++) {
        try {
          await client.getEntitlements(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }

      // Now circuit is OPEN, no stale cache → fail-open defaults with empty modules
      const result = await client.checkModuleAccess(TEST_TENANT_ID, 'manufacturing');
      expect(result.allowed).toBe(true); // Fail-open
    });
  });

  // ─── Circuit Breaker Integration ────────────────────────────────────

  describe('getEntitlements — circuit breaker', () => {
    it('serves stale cache with degraded: true after 3 consecutive failures', async () => {
      vi.useFakeTimers();

      // Populate cache + stale cache with a successful call
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_ENTITLEMENTS));
      client = new PlatformClientService(createConfig());
      await client.getEntitlements(TEST_TENANT_ID);

      // Expire TTL cache (stale cache remains — it's a separate Map)
      vi.advanceTimersByTime(300_001);

      // Platform goes down
      vi.stubGlobal('fetch', mockFetchNetworkError());

      // Drive circuit to OPEN: first 2 calls throw (circuit still CLOSED),
      // 3rd failure opens circuit and returns stale fallback
      for (let i = 0; i < 3; i++) {
        try {
          const result = await client.getEntitlements(TEST_TENANT_ID);
          // Only the 3rd call returns fallback (circuit just opened)
          expect(result.degraded).toBe(true);
          expect(result.entitlements).toEqual(MOCK_ENTITLEMENTS);
        } catch {
          // Expected for calls 1 and 2 (circuit CLOSED, error re-thrown)
        }
      }

      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Subsequent calls while OPEN also serve stale cache
      const result = await client.getEntitlements(TEST_TENANT_ID);
      expect(result.degraded).toBe(true);
      expect(result.entitlements).toEqual(MOCK_ENTITLEMENTS);
    });

    it('returns fail-open defaults when no stale cache and circuit is OPEN', async () => {
      // Never populate cache — go straight to failures
      vi.stubGlobal('fetch', mockFetchNetworkError());
      client = new PlatformClientService(createConfig());

      for (let i = 0; i < 3; i++) {
        try {
          await client.getEntitlements(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }

      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Next call uses fallback — no stale cache → fail-open defaults
      const result = await client.getEntitlements(TEST_TENANT_ID);
      expect(result.degraded).toBe(true);
      expect(result.entitlements.status).toBe('ACTIVE');
      expect(result.entitlements.planCode).toBe('unknown');
      expect(result.entitlements.enabledModules).toEqual([]);
    });

    it('returns fresh data after circuit recovers', async () => {
      vi.useFakeTimers();

      // Populate stale cache
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_ENTITLEMENTS));
      client = new PlatformClientService(createConfig());
      await client.getEntitlements(TEST_TENANT_ID);

      // Force cache expiry
      vi.advanceTimersByTime(300_001);

      // Drive circuit to OPEN (first 2 calls throw, 3rd returns fallback)
      vi.stubGlobal('fetch', mockFetchNetworkError());
      for (let i = 0; i < 3; i++) {
        try {
          await client.getEntitlements(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Advance past recovery window
      vi.advanceTimersByTime(30_001);

      // Platform API comes back
      const updatedEntitlements: TenantEntitlements = {
        ...MOCK_ENTITLEMENTS,
        planCode: 'enterprise',
        maxUsers: 200,
      };
      vi.stubGlobal('fetch', mockFetchSuccess(updatedEntitlements));

      const result = await client.getEntitlements(TEST_TENANT_ID);
      expect(result.degraded).toBe(false);
      expect(result.entitlements.planCode).toBe('enterprise');
      expect(result.entitlements.maxUsers).toBe(200);
      expect(client.getCircuitBreaker().getState()).toBe('CLOSED');
    });
  });

  // ─── AI Quota ─────────────────────────────────────────────────────────

  describe('checkAiQuota', () => {
    it('always makes a live call (no cache)', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_AI_QUOTA));
      client = new PlatformClientService(createConfig());

      const result1 = await client.checkAiQuota(TEST_TENANT_ID, 500, 'chat');
      expect(result1.allowed).toBe(true);
      expect(result1.degraded).toBe(false);
      expect(fetch).toHaveBeenCalledOnce();

      // Second call — still live (NOT cached)
      const result2 = await client.checkAiQuota(TEST_TENANT_ID, 500, 'chat');
      expect(result2.allowed).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('sends correct POST body', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_AI_QUOTA));
      client = new PlatformClientService(createConfig());

      await client.checkAiQuota(TEST_TENANT_ID, 1000, 'summarize');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/ai/check',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ estimatedTokens: 1000, featureKey: 'summarize' }),
        }),
      );
    });

    it('returns degraded fail-open result when circuit is OPEN (BR-PLT-020)', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError());
      client = new PlatformClientService(createConfig());

      // Drive circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await client.checkAiQuota(TEST_TENANT_ID, 500, 'chat');
        } catch {
          /* expected */
        }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Next call → fallback
      const result = await client.checkAiQuota(TEST_TENANT_ID, 500, 'chat');
      expect(result.allowed).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.quotaPct).toBe(-1);
    });
  });

  // ─── recordAiUsage ──────────────────────────────────────────────────

  describe('recordAiUsage', () => {
    it('never throws even on network error', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError());
      vi.useFakeTimers();
      client = new PlatformClientService(createConfig());

      // Should NOT throw
      await expect(client.recordAiUsage(MOCK_USAGE_RECORD)).resolves.toBeUndefined();

      // Advance timers to flush retries (1s + 2s + 4s = 7s)
      await vi.advanceTimersByTimeAsync(8_000);
    });

    it('makes POST call on success', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess(undefined));
      client = new PlatformClientService(createConfig());

      await client.recordAiUsage(MOCK_USAGE_RECORD);

      // Allow fire-and-forget to complete
      await new Promise((r) => setTimeout(r, 0));

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/ai/record',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  // ─── Cache Invalidation ───────────────────────────────────────────────

  describe('invalidateCache', () => {
    it('clears cached entitlements so next call fetches fresh', async () => {
      // Populate cache
      await client.getEntitlements(TEST_TENANT_ID);
      expect(fetch).toHaveBeenCalledOnce();

      // Invalidate
      client.invalidateCache(TEST_TENANT_ID);

      // Wait for async cache.delete
      await new Promise((r) => setTimeout(r, 0));

      // Next call should fetch again
      await client.getEntitlements(TEST_TENANT_ID);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('only invalidates the specified tenant', async () => {
      const otherTenantId = 'tenant-002';

      // Populate cache for both tenants
      await client.getEntitlements(TEST_TENANT_ID);
      await client.getEntitlements(otherTenantId);
      expect(fetch).toHaveBeenCalledTimes(2);

      // Invalidate only tenant-001
      client.invalidateCache(TEST_TENANT_ID);
      await new Promise((r) => setTimeout(r, 0));

      // tenant-001 should re-fetch
      await client.getEntitlements(TEST_TENANT_ID);
      expect(fetch).toHaveBeenCalledTimes(3);

      // tenant-002 should still be cached
      await client.getEntitlements(otherTenantId);
      expect(fetch).toHaveBeenCalledTimes(3); // No additional call
    });
  });

  // ─── checkUserQuota ───────────────────────────────────────────────────

  describe('checkUserQuota', () => {
    it('returns quota data from live call', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_USER_QUOTA));
      client = new PlatformClientService(createConfig());

      const result = await client.checkUserQuota(TEST_TENANT_ID);

      expect(result.currentCount).toBe(12);
      expect(result.maxUsers).toBe(50);
      expect(result.canAddUser).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/users/quota',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns fail-open defaults when circuit is OPEN', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError());
      client = new PlatformClientService(createConfig());

      // Drive circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await client.checkUserQuota(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      const result = await client.checkUserQuota(TEST_TENANT_ID);
      expect(result.currentCount).toBe(-1);
      expect(result.maxUsers).toBe(-1);
      expect(result.canAddUser).toBe(true);
    });
  });

  // ─── getTenantStatus ──────────────────────────────────────────────────

  describe('getTenantStatus', () => {
    it('returns status from live call', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_TENANT_STATUS));
      client = new PlatformClientService(createConfig());

      const result = await client.getTenantStatus(TEST_TENANT_ID);

      expect(result.status).toBe('ACTIVE');
      expect(result.billingStatus).toBe('CURRENT');
      expect(result.enforcementAction).toBe('NONE');
      expect(result.maintenanceMode).toBe(false);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/status',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns fail-open defaults when circuit is OPEN (BR-PLT-020)', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError());
      client = new PlatformClientService(createConfig());

      // Drive circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await client.getTenantStatus(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // getTenantStatus now has a fail-open fallback
      const result = await client.getTenantStatus(TEST_TENANT_ID);
      expect(result.status).toBe('ACTIVE');
      expect(result.billingStatus).toBe('CURRENT');
      expect(result.enforcementAction).toBe('NONE');
      expect(result.maintenanceMode).toBe(false);
    });
  });

  // ─── Platform API envelope unwrapping ─────────────────────────────────

  describe('response envelope unwrapping', () => {
    it('unwraps { data: ... } envelope from Platform API', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ success: true, data: MOCK_ENTITLEMENTS })),
        }),
      );
      client = new PlatformClientService(createConfig());

      const result = await client.getEntitlements(TEST_TENANT_ID);
      expect(result.entitlements).toEqual(MOCK_ENTITLEMENTS);
    });

    it('handles response without envelope (flat data)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(MOCK_ENTITLEMENTS)),
        }),
      );
      client = new PlatformClientService(createConfig());

      const result = await client.getEntitlements(TEST_TENANT_ID);
      expect(result.entitlements).toEqual(MOCK_ENTITLEMENTS);
    });
  });

  // ─── HTTP error handling ──────────────────────────────────────────────

  describe('HTTP error handling', () => {
    it('4xx errors do not trip the circuit breaker', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(404, 'Not Found'));
      client = new PlatformClientService(createConfig());

      // 4xx errors are client errors — skip circuit breaker tracking
      for (let i = 0; i < 5; i++) {
        try {
          await client.getEntitlements(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }

      // Circuit should still be CLOSED — 4xx are not infrastructure failures
      expect(client.getCircuitBreaker().getState()).toBe('CLOSED');
    });

    it('5xx errors count towards circuit breaker threshold', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(500, 'Internal Server Error'));
      client = new PlatformClientService(createConfig());

      for (let i = 0; i < 3; i++) {
        try {
          await client.getEntitlements(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }

      expect(client.getCircuitBreaker().getState()).toBe('OPEN');
    });
  });

  // ─── Authorization header ─────────────────────────────────────────────

  describe('Authorization header', () => {
    it('includes Bearer token in all requests', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess(MOCK_ENTITLEMENTS));
      client = new PlatformClientService(createConfig({ serviceToken: 'my-secret-token' }));

      await client.getEntitlements(TEST_TENANT_ID);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-secret-token',
          }),
        }),
      );
    });
  });

  // ─── getSuggestedKnowledge ──────────────────────────────────────────

  describe('getSuggestedKnowledge', () => {
    it('makes correct GET call without query params', async () => {
      // Platform API now returns array as data + pagination in meta
      vi.stubGlobal(
        'fetch',
        mockFetchSuccess([MOCK_SUGGESTED_ARTICLE], { cursor: null, hasMore: false }),
      );
      client = new PlatformClientService(createConfig());

      const result = await client.getSuggestedKnowledge(TEST_TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(MOCK_SUGGESTED_ARTICLE);
      expect(result.nextCursor).toBeNull();
      expect(result.hasMore).toBe(false);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/knowledge/suggested',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('appends cursor and limit query params when provided', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchSuccess([MOCK_SUGGESTED_ARTICLE], { cursor: null, hasMore: false }),
      );
      client = new PlatformClientService(createConfig());

      await client.getSuggestedKnowledge(TEST_TENANT_ID, { cursor: 'abc123', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/knowledge/suggested?cursor=abc123&limit=10',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns empty results when circuit is OPEN (fail-open)', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError());
      client = new PlatformClientService(createConfig());

      // Drive circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await client.getSuggestedKnowledge(TEST_TENANT_ID);
        } catch {
          /* expected */
        }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      const result = await client.getSuggestedKnowledge(TEST_TENANT_ID);
      expect(result.data).toEqual([]);
      expect(result.nextCursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });

  // ─── respondToKnowledge ─────────────────────────────────────────────

  describe('respondToKnowledge', () => {
    it('makes correct POST call for ACCEPTED response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 204,
          text: () => Promise.resolve(''),
        }),
      );
      client = new PlatformClientService(createConfig());

      await client.respondToKnowledge(TEST_TENANT_ID, 'article-001', {
        status: 'ACCEPTED',
        tenantArticleId: 'tenant-art-001',
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/knowledge/article-001/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ status: 'ACCEPTED', tenantArticleId: 'tenant-art-001' }),
        }),
      );
    });

    it('makes correct POST call for REJECTED response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 204,
          text: () => Promise.resolve(''),
        }),
      );
      client = new PlatformClientService(createConfig());

      await client.respondToKnowledge(TEST_TENANT_ID, 'article-001', {
        status: 'REJECTED',
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-001/knowledge/article-001/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ status: 'REJECTED' }),
        }),
      );
    });

    it('throws when platform API returns error (no fail-open for writes)', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(500, 'Internal Server Error'));
      client = new PlatformClientService(createConfig());

      await expect(
        client.respondToKnowledge(TEST_TENANT_ID, 'article-001', { status: 'ACCEPTED' }),
      ).rejects.toThrow('Platform API returned 500');
    });

    it('throws when circuit is OPEN (no fail-open fallback for writes)', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError());
      client = new PlatformClientService(createConfig());

      // Drive circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await client.respondToKnowledge(TEST_TENANT_ID, 'article-001', { status: 'ACCEPTED' });
        } catch {
          /* expected */
        }
      }
      expect(client.getCircuitBreaker().getState()).toBe('OPEN');

      // Should throw — no fallback for writes
      await expect(
        client.respondToKnowledge(TEST_TENANT_ID, 'article-001', { status: 'ACCEPTED' }),
      ).rejects.toThrow();
    });
  });
});
