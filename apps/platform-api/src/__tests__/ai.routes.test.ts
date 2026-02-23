import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const TEST_SERVICE_TOKEN = 'test-internal-service-token-for-erp';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_PLAN_ID = '00000000-0000-4000-a000-000000000010';
const TEST_QUOTA_ID = '00000000-0000-4000-a000-000000000020';

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

const mockFindUniqueTenant = vi.fn();
const mockCreateAiUsage = vi.fn();
const mockUpdateAiQuota = vi.fn();
const mockFindManyAiUsage = vi.fn();
// ISSUE #7 FIX: Add missing groupBy and aggregate mocks required by /usage route
const mockGroupByAiUsage = vi.fn();
const mockAggregateAiUsage = vi.fn();

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    tenant: {
      findUnique: (...args: unknown[]) => mockFindUniqueTenant(...args),
    },
    tenantAiUsage: {
      create: (...args: unknown[]) => mockCreateAiUsage(...args),
      findMany: (...args: unknown[]) => mockFindManyAiUsage(...args),
      groupBy: (...args: unknown[]) => mockGroupByAiUsage(...args),
      aggregate: (...args: unknown[]) => mockAggregateAiUsage(...args),
    },
    tenantAiQuota: {
      update: (...args: unknown[]) => mockUpdateAiQuota(...args),
    },
    // ISSUE #7 FIX: Add $transaction mock for /record route (ISSUE #9 wrapped it in $transaction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: async (fn: (tx: any) => Promise<any>) => fn({
      tenantAiUsage: {
        create: (...args: unknown[]) => mockCreateAiUsage(...args),
      },
      tenantAiQuota: {
        update: (...args: unknown[]) => mockUpdateAiQuota(...args),
      },
    }),
    // Auth routes use these — provide stubs to avoid errors during app build
    platformUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    platformAuditLog: {
      create: vi.fn(),
    },
    platformRefreshToken: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock argon2 (required by auth routes loaded during buildApp)
// ---------------------------------------------------------------------------

vi.mock('argon2', () => ({
  default: {
    verify: vi.fn().mockResolvedValue(false),
    hash: vi.fn().mockResolvedValue('$argon2id$dummy'),
    argon2id: 2,
  },
  verify: vi.fn().mockResolvedValue(false),
  hash: vi.fn().mockResolvedValue('$argon2id$dummy'),
  argon2id: 2,
}));

// ---------------------------------------------------------------------------
// Mock otpauth (required by auth routes loaded during buildApp)
// ---------------------------------------------------------------------------

vi.mock('otpauth', () => {
  class MockSecret {
    base32 = 'JBSWY3DPEHPK3PXP';
    static fromBase32() {
      return new MockSecret();
    }
  }
  class MockTOTP {
    validate() {
      return null;
    }
    toString() {
      return 'otpauth://totp/test';
    }
  }
  return { Secret: MockSecret, TOTP: MockTOTP };
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(() => {
  process.env.PLATFORM_JWT_SECRET = TEST_JWT_SECRET;
  process.env.PLATFORM_SERVICE_TOKEN = TEST_SERVICE_TOKEN;
});

beforeEach(async () => {
  vi.clearAllMocks();

  const { buildApp } = await import('../app.js');
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  await app?.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serviceAuthHeader() {
  return { authorization: `Bearer ${TEST_SERVICE_TOKEN}` };
}

function makeTenantWithQuota(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_TENANT_ID,
    code: 'dev-tenant',
    displayName: 'Dev Tenant',
    status: 'ACTIVE',
    planId: TEST_PLAN_ID,
    billingStatus: 'CURRENT',
    plan: {
      id: TEST_PLAN_ID,
      code: 'pro',
      displayName: 'Pro Plan',
      maxUsers: 25,
      maxCompanies: 5,
      monthlyAiTokenAllowance: BigInt(1_000_000),
      aiHardLimit: true,
      enabledModules: ['finance'],
      apiRateLimit: 1000,
      isActive: true,
    },
    aiQuota: {
      id: TEST_QUOTA_ID,
      tenantId: TEST_TENANT_ID,
      periodStart: new Date('2026-02-01'),
      periodEnd: new Date('2026-02-28'),
      tokensUsed: BigInt(200_000),
      tokenAllowance: BigInt(1_000_000),
      softLimitPct: 80,
      hardLimitPct: 100,
      burstAllowance: null,
    },
    ...overrides,
  };
}

interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Platform AI Routes (Task 2)', () => {
  // =========================================================================
  // Service Token Auth (applies to all AI routes)
  // =========================================================================
  describe('Service token authentication', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        payload: { estimatedTokens: 100, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when service token is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: { authorization: 'Bearer wrong-token' },
        payload: { estimatedTokens: 100, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // POST /platform/tenants/:tenantId/ai/check
  // =========================================================================
  describe('POST /platform/tenants/:tenantId/ai/check', () => {
    it('returns allowed=true when under limit', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithQuota());

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: 1000, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        allowed: boolean;
        remainingTokens: number;
        quotaPct: number;
        warning?: string;
      }>>();
      expect(body.success).toBe(true);
      expect(body.data.allowed).toBe(true);
      expect(body.data.remainingTokens).toBe(800_000);
      expect(body.data.quotaPct).toBe(20);
      expect(body.data.warning).toBeUndefined();
    });

    it('returns allowed=false when hard limit reached and aiHardLimit=true', async () => {
      // Token usage is at 950,000 out of 1,000,000 — requesting 60,000 more pushes past 100%
      const tenant = makeTenantWithQuota({
        aiQuota: {
          id: TEST_QUOTA_ID,
          tenantId: TEST_TENANT_ID,
          periodStart: new Date('2026-02-01'),
          periodEnd: new Date('2026-02-28'),
          tokensUsed: BigInt(950_000),
          tokenAllowance: BigInt(1_000_000),
          softLimitPct: 80,
          hardLimitPct: 100,
          burstAllowance: null,
        },
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: 60_000, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        allowed: boolean;
        remainingTokens: number;
        quotaPct: number;
      }>>();
      expect(body.data.allowed).toBe(false);
      expect(body.data.remainingTokens).toBe(50_000);
    });

    it('returns allowed=true with overage when aiHardLimit=false', async () => {
      const tenant = makeTenantWithQuota({
        plan: {
          id: TEST_PLAN_ID,
          code: 'enterprise',
          displayName: 'Enterprise Plan',
          maxUsers: 100,
          maxCompanies: 20,
          monthlyAiTokenAllowance: BigInt(1_000_000),
          aiHardLimit: false,
          enabledModules: ['finance'],
          apiRateLimit: 5000,
          isActive: true,
        },
        aiQuota: {
          id: TEST_QUOTA_ID,
          tenantId: TEST_TENANT_ID,
          periodStart: new Date('2026-02-01'),
          periodEnd: new Date('2026-02-28'),
          tokensUsed: BigInt(950_000),
          tokenAllowance: BigInt(1_000_000),
          softLimitPct: 80,
          hardLimitPct: 100,
          burstAllowance: null,
        },
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: 60_000, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        allowed: boolean;
        warning?: string;
      }>>();
      // aiHardLimit=false → allowed even when over limit
      expect(body.data.allowed).toBe(true);
    });

    it('includes warning when above soft limit', async () => {
      const tenant = makeTenantWithQuota({
        aiQuota: {
          id: TEST_QUOTA_ID,
          tenantId: TEST_TENANT_ID,
          periodStart: new Date('2026-02-01'),
          periodEnd: new Date('2026-02-28'),
          tokensUsed: BigInt(850_000),
          tokenAllowance: BigInt(1_000_000),
          softLimitPct: 80,
          hardLimitPct: 100,
          burstAllowance: null,
        },
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: 1000, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        allowed: boolean;
        warning?: string;
      }>>();
      expect(body.data.allowed).toBe(true);
      expect(body.data.warning).toContain('Approaching AI quota limit');
      expect(body.data.warning).toContain('85%');
    });

    it('returns 404 for non-existent tenant', async () => {
      mockFindUniqueTenant.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: 100, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns allowed=true when no quota record exists', async () => {
      const tenant = makeTenantWithQuota({ aiQuota: null });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: 100, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ allowed: boolean }>>();
      expect(body.data.allowed).toBe(true);
    });

    it('returns 400 for invalid request body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/check`,
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: -5, featureKey: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid tenantId format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/platform/tenants/not-a-uuid/ai/check',
        headers: serviceAuthHeader(),
        payload: { estimatedTokens: 100, featureKey: 'chat' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // POST /platform/tenants/:tenantId/ai/record
  // =========================================================================
  describe('POST /platform/tenants/:tenantId/ai/record', () => {
    // ISSUE #30 FIX: Use valid UUID for userId (schema now validates UUID format)
    const validRecordPayload = {
      userId: '00000000-0000-4000-a000-000000000099',
      featureKey: 'chat',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700,
      costEstimate: 0.0042,
      requestId: 'req-abc-123',
      isByok: false,
      latencyMs: 1200,
      fallbackUsed: false,
    };

    it('creates TenantAiUsage and increments tokensUsed', async () => {
      const tenant = makeTenantWithQuota();
      mockFindUniqueTenant.mockResolvedValue(tenant);
      mockCreateAiUsage.mockResolvedValue({ id: 'usage-1' });
      mockUpdateAiQuota.mockResolvedValue({
        ...tenant.aiQuota,
        tokensUsed: BigInt(200_700),
      });

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/record`,
        headers: serviceAuthHeader(),
        payload: validRecordPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ recorded: true; quotaPct: number }>>();
      expect(body.data.recorded).toBe(true);
      expect(body.data.quotaPct).toBeGreaterThan(0);

      // Verify usage record was created
      expect(mockCreateAiUsage).toHaveBeenCalledOnce();
      const createCall = mockCreateAiUsage.mock.calls[0][0];
      expect(createCall.data.tenantId).toBe(TEST_TENANT_ID);
      expect(createCall.data.provider).toBe('anthropic');
      expect(createCall.data.requestId).toBe('req-abc-123');

      // Verify quota was incremented
      expect(mockUpdateAiQuota).toHaveBeenCalledOnce();
      const updateCall = mockUpdateAiQuota.mock.calls[0][0];
      expect(updateCall.data.tokensUsed.increment).toBe(700);
    });

    it('does NOT increment quota when isByok=true', async () => {
      const tenant = makeTenantWithQuota();
      mockFindUniqueTenant.mockResolvedValue(tenant);
      mockCreateAiUsage.mockResolvedValue({ id: 'usage-1' });

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/record`,
        headers: serviceAuthHeader(),
        payload: { ...validRecordPayload, isByok: true },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ recorded: true; quotaPct: number }>>();
      expect(body.data.recorded).toBe(true);

      // Usage record still created (for audit)
      expect(mockCreateAiUsage).toHaveBeenCalledOnce();

      // Quota NOT incremented
      expect(mockUpdateAiQuota).not.toHaveBeenCalled();
    });

    it('returns 404 for non-existent tenant', async () => {
      mockFindUniqueTenant.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/record`,
        headers: serviceAuthHeader(),
        payload: validRecordPayload,
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 400 for invalid request body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/record`,
        headers: serviceAuthHeader(),
        payload: { totalTokens: -1 },
      });

      expect(res.statusCode).toBe(400);
    });

    it('records fallback information when provided', async () => {
      const tenant = makeTenantWithQuota();
      mockFindUniqueTenant.mockResolvedValue(tenant);
      mockCreateAiUsage.mockResolvedValue({ id: 'usage-1' });
      mockUpdateAiQuota.mockResolvedValue({
        ...tenant.aiQuota,
        tokensUsed: BigInt(200_700),
      });

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/record`,
        headers: serviceAuthHeader(),
        payload: {
          ...validRecordPayload,
          fallbackUsed: true,
          fallbackFrom: 'claude-opus-4-6',
        },
      });

      expect(res.statusCode).toBe(200);
      const createCall = mockCreateAiUsage.mock.calls[0][0];
      expect(createCall.data.fallbackUsed).toBe(true);
      expect(createCall.data.fallbackFrom).toBe('claude-opus-4-6');
    });
  });

  // =========================================================================
  // GET /platform/tenants/:tenantId/ai/usage
  // =========================================================================
  describe('GET /platform/tenants/:tenantId/ai/usage', () => {
    // ISSUE #7 FIX: Use groupBy and aggregate mocks instead of findMany
    // (route uses Prisma groupBy/aggregate, not findMany)
    it('returns correct period aggregations', async () => {
      const tenant = makeTenantWithQuota();
      mockFindUniqueTenant.mockResolvedValue(tenant);

      // groupBy is called twice: first by featureKey, then by provider
      mockGroupByAiUsage
        .mockResolvedValueOnce([
          { featureKey: 'chat', _sum: { totalTokens: 800, costEstimate: 0.005 }, _count: 2 },
          { featureKey: 'summarise', _sum: { totalTokens: 200, costEstimate: 0.001 }, _count: 1 },
        ])
        .mockResolvedValueOnce([
          { provider: 'anthropic', _sum: { totalTokens: 800, costEstimate: 0.005 }, _count: 2 },
          { provider: 'openai', _sum: { totalTokens: 200, costEstimate: 0.001 }, _count: 1 },
        ]);

      // aggregate is called once for totals
      mockAggregateAiUsage.mockResolvedValueOnce({
        _sum: { costEstimate: 0.006 },
        _count: 3,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/usage`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        period: { start: string; end: string };
        summary: {
          tokensUsed: number;
          tokenAllowance: number;
          quotaPct: number;
          totalRequests: number;
          totalCost: number;
        };
        byFeature: Array<{ featureKey: string; totalTokens: number; requestCount: number }>;
        byProvider: Array<{ provider: string; totalTokens: number; requestCount: number }>;
        warnings: string[];
      }>>();

      expect(body.data.period.start).toContain('2026-02-01');
      expect(body.data.period.end).toContain('2026-02-28');
      expect(body.data.summary.tokensUsed).toBe(200_000);
      expect(body.data.summary.tokenAllowance).toBe(1_000_000);
      expect(body.data.summary.totalRequests).toBe(3);

      // Per-feature
      const chatFeature = body.data.byFeature.find(f => f.featureKey === 'chat');
      expect(chatFeature).toBeDefined();
      expect(chatFeature!.totalTokens).toBe(800);
      expect(chatFeature!.requestCount).toBe(2);

      const summariseFeature = body.data.byFeature.find(f => f.featureKey === 'summarise');
      expect(summariseFeature).toBeDefined();
      expect(summariseFeature!.totalTokens).toBe(200);
      expect(summariseFeature!.requestCount).toBe(1);

      // Per-provider
      const anthropic = body.data.byProvider.find(p => p.provider === 'anthropic');
      expect(anthropic).toBeDefined();
      expect(anthropic!.totalTokens).toBe(800);
      expect(anthropic!.requestCount).toBe(2);

      const openai = body.data.byProvider.find(p => p.provider === 'openai');
      expect(openai).toBeDefined();
      expect(openai!.totalTokens).toBe(200);
    });

    it('returns 404 for non-existent tenant', async () => {
      mockFindUniqueTenant.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/usage`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns empty data when no quota record exists', async () => {
      const tenant = makeTenantWithQuota({ aiQuota: null });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/usage`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        summary: { tokensUsed: number; totalRequests: number };
        byFeature: unknown[];
        byProvider: unknown[];
      }>>();
      expect(body.data.summary.tokensUsed).toBe(0);
      expect(body.data.summary.totalRequests).toBe(0);
      expect(body.data.byFeature).toEqual([]);
      expect(body.data.byProvider).toEqual([]);
    });

    it('includes warnings when above soft limit', async () => {
      const tenant = makeTenantWithQuota({
        aiQuota: {
          id: TEST_QUOTA_ID,
          tenantId: TEST_TENANT_ID,
          periodStart: new Date('2026-02-01'),
          periodEnd: new Date('2026-02-28'),
          tokensUsed: BigInt(850_000),
          tokenAllowance: BigInt(1_000_000),
          softLimitPct: 80,
          hardLimitPct: 100,
          burstAllowance: null,
        },
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);
      // ISSUE #7 FIX: Mock groupBy and aggregate (route uses these, not findMany)
      mockGroupByAiUsage.mockResolvedValue([]);
      mockAggregateAiUsage.mockResolvedValueOnce({ _sum: { costEstimate: 0 }, _count: 0 });

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/usage`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ warnings: string[] }>>();
      expect(body.data.warnings.length).toBeGreaterThan(0);
      expect(body.data.warnings[0]).toContain('Approaching AI quota limit');
    });

    it('includes exceeded warning when above hard limit', async () => {
      const tenant = makeTenantWithQuota({
        aiQuota: {
          id: TEST_QUOTA_ID,
          tenantId: TEST_TENANT_ID,
          periodStart: new Date('2026-02-01'),
          periodEnd: new Date('2026-02-28'),
          tokensUsed: BigInt(1_050_000),
          tokenAllowance: BigInt(1_000_000),
          softLimitPct: 80,
          hardLimitPct: 100,
          burstAllowance: null,
        },
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);
      // ISSUE #7 FIX: Mock groupBy and aggregate
      mockGroupByAiUsage.mockResolvedValue([]);
      mockAggregateAiUsage.mockResolvedValueOnce({ _sum: { costEstimate: 0 }, _count: 0 });

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/ai/usage`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ warnings: string[] }>>();
      expect(body.data.warnings.length).toBeGreaterThan(0);
      expect(body.data.warnings[0]).toContain('exceeded');
    });
  });
});
