// ---------------------------------------------------------------------------
// Admin AI Usage Routes Tests — E13b.4 Task 1.3
// Covers: aggregation queries (daily, by-feature, cross-tenant summary),
// CSV export, and RBAC enforcement
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const TEST_SERVICE_TOKEN = 'test-internal-service-token-for-erp';
const ADMIN_USER_ID = '00000000-0000-4000-b000-000000000020';
const VIEWER_USER_ID = '00000000-0000-4000-b000-000000000021';
const TENANT_ID_A = '00000000-0000-4000-a000-000000000001';

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------

const mockTenantFindUnique = vi.fn();
const mockTenantFindMany = vi.fn();
const mockTenantCount = vi.fn();
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();

const mockAiUsageAggregate = vi.fn();
const mockAiUsageGroupBy = vi.fn();
const mockAiUsageCreate = vi.fn();
const mockAiUsageFindMany = vi.fn();

const mockAiQuotaFindFirst = vi.fn();
const mockAiQuotaUpdate = vi.fn();
const mockAiQuotaCreate = vi.fn();

const mockQueryRawUnsafe = vi.fn();
const mockQueryRaw = vi.fn();

// Standard mocks for app import graph
const mockCreateAuditLog = vi.fn();
const mockFindUniquePlatformUser = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();
const mockPlanFindMany = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanCreate = vi.fn();
const mockPlanUpdate = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
const mockModuleOverrideFindMany = vi.fn();
const mockModuleOverrideUpsert = vi.fn();
const mockFeatureFlagUpsert = vi.fn();
const mockFeatureFlagFindMany = vi.fn();
const mockTenantBillingCreate = vi.fn();
const mockImpersonationFindFirst = vi.fn();
const mockProviderCredFindFirst = vi.fn();
const mockUserFindMany = vi.fn();

// Intelligence stubs
const mockPatternFindMany = vi.fn().mockResolvedValue([]);
const mockPatternCount = vi.fn().mockResolvedValue(0);
const mockCorrectionFindMany = vi.fn().mockResolvedValue([]);
const mockCorrectionAggregate = vi.fn().mockResolvedValue({ _sum: { occurrenceCount: 0 } });
const mockEffectivenessFindMany = vi.fn().mockResolvedValue([]);
const mockEffectivenessFindFirst = vi.fn().mockResolvedValue(null);
const mockInsightFindMany = vi.fn().mockResolvedValue([]);
const mockInsightFindUnique = vi.fn();
const mockInsightUpdate = vi.fn();
const mockInsightCount = vi.fn().mockResolvedValue(0);

// Knowledge stubs
const mockArticleFindMany = vi.fn().mockResolvedValue([]);
const mockArticleFindUnique = vi.fn();
const mockArticleCreate = vi.fn();
const mockArticleUpdate = vi.fn();
const mockArticleDelete = vi.fn();
const mockResponseGroupBy = vi.fn().mockResolvedValue([]);
const mockResponseFindMany = vi.fn().mockResolvedValue([]);
const mockResponseUpsert = vi.fn();

// Alert mocks
const mockAlertFindMany = vi.fn().mockResolvedValue([]);
const mockAlertFindUnique = vi.fn();
const mockAlertFindFirst = vi.fn().mockResolvedValue(null);
const mockAlertCreate = vi.fn();
const mockAlertUpdate = vi.fn();

// Vendor provider credential mocks (Task 3)
const mockVendorProvFindMany = vi.fn().mockResolvedValue([]);
const mockVendorProvFindUnique = vi.fn();
const mockVendorProvUpdate = vi.fn();

// Extended tenant provider credential mocks (Task 3 — BYOK)
const mockProviderCredFindMany = vi.fn().mockResolvedValue([]);
const mockProviderCredUpsert = vi.fn();
const mockProviderCredDelete = vi.fn();
const mockProviderCredUpdate = vi.fn();

// Transaction mock
const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
  const txProxy = {
    tenant: {
      findUnique: (...args: unknown[]) => mockTenantFindUnique(...args),
      create: (...args: unknown[]) => mockTenantCreate(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
    },
    tenantBilling: {
      create: (...args: unknown[]) => mockTenantBillingCreate(...args),
    },
    tenantAiQuota: {
      create: (...args: unknown[]) => mockAiQuotaCreate(...args),
      update: (...args: unknown[]) => mockAiQuotaUpdate(...args),
    },
    plan: {
      findUniqueOrThrow: (...args: unknown[]) => mockPlanFindUniqueOrThrow(...args),
    },
    tenantModuleOverride: {
      findMany: (...args: unknown[]) => mockModuleOverrideFindMany(...args),
      upsert: (...args: unknown[]) => mockModuleOverrideUpsert(...args),
    },
    tenantFeatureFlag: {
      upsert: (...args: unknown[]) => mockFeatureFlagUpsert(...args),
    },
    tenantAiUsage: {
      create: (...args: unknown[]) => mockAiUsageCreate(...args),
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  };
  return fn(txProxy);
});

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    tenant: {
      findUnique: (...args: unknown[]) => mockTenantFindUnique(...args),
      findMany: (...args: unknown[]) => mockTenantFindMany(...args),
      count: (...args: unknown[]) => mockTenantCount(...args),
      create: (...args: unknown[]) => mockTenantCreate(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
    },
    plan: {
      findMany: (...args: unknown[]) => mockPlanFindMany(...args),
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockPlanFindUniqueOrThrow(...args),
      create: (...args: unknown[]) => mockPlanCreate(...args),
      update: (...args: unknown[]) => mockPlanUpdate(...args),
    },
    platformUser: {
      findUnique: (...args: unknown[]) => mockFindUniquePlatformUser(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    platformAuditLog: {
      create: (...args: unknown[]) => mockCreateAuditLog(...args),
    },
    platformRefreshToken: {
      create: (...args: unknown[]) => mockCreateRefreshToken(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyRefreshToken(...args),
      findFirst: (...args: unknown[]) => mockFindFirstRefreshToken(...args),
    },
    tenantModuleOverride: {
      findMany: (...args: unknown[]) => mockModuleOverrideFindMany(...args),
      upsert: (...args: unknown[]) => mockModuleOverrideUpsert(...args),
    },
    tenantFeatureFlag: {
      upsert: (...args: unknown[]) => mockFeatureFlagUpsert(...args),
      findMany: (...args: unknown[]) => mockFeatureFlagFindMany(...args),
    },
    tenantAiUsage: {
      aggregate: (...args: unknown[]) => mockAiUsageAggregate(...args),
      groupBy: (...args: unknown[]) => mockAiUsageGroupBy(...args),
      create: (...args: unknown[]) => mockAiUsageCreate(...args),
      findMany: (...args: unknown[]) => mockAiUsageFindMany(...args),
    },
    tenantAiQuota: {
      findFirst: (...args: unknown[]) => mockAiQuotaFindFirst(...args),
      update: (...args: unknown[]) => mockAiQuotaUpdate(...args),
      create: (...args: unknown[]) => mockAiQuotaCreate(...args),
    },
    impersonationSession: {
      findFirst: (...args: unknown[]) => mockImpersonationFindFirst(...args),
    },
    tenantProviderCredential: {
      findFirst: (...args: unknown[]) => mockProviderCredFindFirst(...args),
      findMany: (...args: unknown[]) => mockProviderCredFindMany(...args),
      upsert: (...args: unknown[]) => mockProviderCredUpsert(...args),
      delete: (...args: unknown[]) => mockProviderCredDelete(...args),
      update: (...args: unknown[]) => mockProviderCredUpdate(...args),
    },
    vendorProviderCredential: {
      findMany: (...args: unknown[]) => mockVendorProvFindMany(...args),
      findUnique: (...args: unknown[]) => mockVendorProvFindUnique(...args),
      update: (...args: unknown[]) => mockVendorProvUpdate(...args),
    },
    tenantBilling: {
      create: (...args: unknown[]) => mockTenantBillingCreate(...args),
    },
    tenantAiPattern: {
      findMany: (...args: unknown[]) => mockPatternFindMany(...args),
      count: (...args: unknown[]) => mockPatternCount(...args),
    },
    tenantAiCorrection: {
      findMany: (...args: unknown[]) => mockCorrectionFindMany(...args),
      aggregate: (...args: unknown[]) => mockCorrectionAggregate(...args),
    },
    aiSkillEffectiveness: {
      findMany: (...args: unknown[]) => mockEffectivenessFindMany(...args),
      findFirst: (...args: unknown[]) => mockEffectivenessFindFirst(...args),
    },
    platformAiInsight: {
      findMany: (...args: unknown[]) => mockInsightFindMany(...args),
      findUnique: (...args: unknown[]) => mockInsightFindUnique(...args),
      update: (...args: unknown[]) => mockInsightUpdate(...args),
      count: (...args: unknown[]) => mockInsightCount(...args),
    },
    platformKnowledgeArticle: {
      findMany: (...args: unknown[]) => mockArticleFindMany(...args),
      findUnique: (...args: unknown[]) => mockArticleFindUnique(...args),
      create: (...args: unknown[]) => mockArticleCreate(...args),
      update: (...args: unknown[]) => mockArticleUpdate(...args),
      delete: (...args: unknown[]) => mockArticleDelete(...args),
    },
    platformKnowledgeResponse: {
      groupBy: (...args: unknown[]) => mockResponseGroupBy(...args),
      findMany: (...args: unknown[]) => mockResponseFindMany(...args),
      upsert: (...args: unknown[]) => mockResponseUpsert(...args),
    },
    platformAiAlert: {
      findMany: (...args: unknown[]) => mockAlertFindMany(...args),
      findUnique: (...args: unknown[]) => mockAlertFindUnique(...args),
      findFirst: (...args: unknown[]) => mockAlertFindFirst(...args),
      create: (...args: unknown[]) => mockAlertCreate(...args),
      update: (...args: unknown[]) => mockAlertUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  }),
}));

// ---------------------------------------------------------------------------
// External dependency mocks
// ---------------------------------------------------------------------------

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockhash'),
    verify: vi.fn().mockResolvedValue(false),
    argon2id: 2,
  },
  hash: vi.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockhash'),
  verify: vi.fn().mockResolvedValue(false),
  argon2id: 2,
}));

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

vi.mock('../../src/services/webhook.service.js', () => ({
  WebhookServiceImpl: vi.fn().mockImplementation(() => ({
    pushWebhook: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('pg', () => ({
  default: { Client: vi.fn() },
  Client: vi.fn(),
}));

vi.mock('../../src/services/cross-tenant-aggregation.service.js', () => ({
  CrossTenantAggregationService: vi.fn().mockImplementation(() => ({
    aggregateForDate: vi.fn().mockResolvedValue({
      processedTenants: 0,
      skippedTenants: 0,
      patternsCreated: 0,
      correctionsCreated: 0,
    }),
  })),
}));

vi.mock('../../src/services/insights-generation.service.js', () => ({
  InsightsGenerationService: vi.fn().mockImplementation(() => ({
    generateInsights: vi.fn().mockResolvedValue({ insightsGenerated: 0, byType: {} }),
  })),
}));

vi.mock('../../src/services/tenant-db-connector.js', () => ({
  TenantDbConnector: vi.fn().mockImplementation(() => ({
    isConfigured: vi.fn().mockReturnValue(true),
    connectToTenantDb: vi.fn().mockResolvedValue(null),
  })),
}));

const mockDetectSpikes = vi.fn().mockResolvedValue({
  tenantsChecked: 0,
  spikesDetected: 0,
  alertsCreated: 0,
});

vi.mock('../../src/services/spike-detection.service.js', () => ({
  SpikeDetectionService: vi.fn().mockImplementation(() => ({
    detectSpikes: (...args: unknown[]) => mockDetectSpikes(...args),
  })),
}));

vi.mock('../../src/services/quota-alert.service.js', () => ({
  createQuotaAlertIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

const mockEncryptApiKey = vi.fn().mockReturnValue('encrypted-key-base64');
const mockGetEncryptionKey = vi.fn().mockReturnValue('a'.repeat(64));

vi.mock('../../src/core/utils/encryption.js', () => ({
  encryptApiKey: (...args: unknown[]) => mockEncryptApiKey(...args),
  getEncryptionKey: () => mockGetEncryptionKey(),
}));

// ---------------------------------------------------------------------------
// JWT Helper
// ---------------------------------------------------------------------------

async function generateTestJwt(userId: string, role: string): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET);
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('nexa-platform')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

async function adminAuthHeader() {
  const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
  return { authorization: `Bearer ${token}` };
}

async function viewerAuthHeader() {
  const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
  return { authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

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

// ===========================================================================
// Tests
// ===========================================================================

describe('Admin AI Usage Routes (E13b.4 Task 1)', () => {
  // =========================================================================
  // GET /admin/ai/usage/summary
  // =========================================================================
  describe('GET /admin/ai/usage/summary', () => {
    it('returns cross-tenant usage summary for PLATFORM_ADMIN', async () => {
      // Mock: today aggregate
      mockAiUsageAggregate
        .mockResolvedValueOnce({ _sum: { totalTokens: 50000, costEstimate: 1.5 } }) // today
        .mockResolvedValueOnce({ _sum: { totalTokens: 500000, costEstimate: 15.0 } }); // month

      // Mock: daily trend via raw SQL
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { day: '2026-03-10', tokens: BigInt(20000), cost: '0.600000' },
        { day: '2026-03-11', tokens: BigInt(30000), cost: '0.900000' },
      ]);

      // Mock: top consumers groupBy
      mockAiUsageGroupBy.mockResolvedValueOnce([
        { tenantId: TENANT_ID_A, _sum: { totalTokens: 200000 } },
      ]);

      // Mock: tenant lookup for top consumers
      mockTenantFindMany.mockResolvedValueOnce([
        { id: TENANT_ID_A, code: 'acme-corp', displayName: 'Acme Corp' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/summary',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          tokensToday: number;
          tokensThisMonth: number;
          costEstimateToday: string;
          costEstimateThisMonth: string;
          dailyTrend: Array<{ date: string; tokens: number; cost: string }>;
          topConsumers: Array<{
            tenantId: string;
            tenantCode: string;
            tenantName: string;
            tokens: number;
          }>;
        }>
      >();

      expect(body.success).toBe(true);
      expect(body.data.tokensToday).toBe(50000);
      expect(body.data.tokensThisMonth).toBe(500000);
      expect(body.data.costEstimateToday).toBe('1.500000');
      expect(body.data.costEstimateThisMonth).toBe('15.000000');
      expect(body.data.topConsumers).toHaveLength(1);
      expect(body.data.topConsumers[0].tenantCode).toBe('acme-corp');
      expect(body.data.topConsumers[0].tokens).toBe(200000);
      // Daily trend should include 30 days of entries
      expect(body.data.dailyTrend.length).toBe(30);
    });

    it('returns 200 for PLATFORM_VIEWER', async () => {
      mockAiUsageAggregate
        .mockResolvedValueOnce({ _sum: { totalTokens: 0, costEstimate: 0 } })
        .mockResolvedValueOnce({ _sum: { totalTokens: 0, costEstimate: 0 } });
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      mockAiUsageGroupBy.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/summary',
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/summary',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // GET /admin/tenants/:id/ai/usage
  // =========================================================================
  describe('GET /admin/tenants/:id/ai/usage', () => {
    it('returns per-tenant usage with provider and BYOK breakdown', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID_A,
        code: 'acme-corp',
        displayName: 'Acme Corp',
      });

      // today + month aggregates
      mockAiUsageAggregate
        .mockResolvedValueOnce({ _sum: { totalTokens: 10000, costEstimate: 0.3 } }) // today
        .mockResolvedValueOnce({ _sum: { totalTokens: 120000, costEstimate: 3.6 } }); // month

      // daily trend
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { day: '2026-03-11', tokens: BigInt(10000), cost: '0.300000' },
      ]);

      // provider breakdown
      mockAiUsageGroupBy
        .mockResolvedValueOnce([
          { provider: 'anthropic', _sum: { totalTokens: 80000 } },
          { provider: 'openai', _sum: { totalTokens: 40000 } },
        ])
        // BYOK split
        .mockResolvedValueOnce([
          { isByok: false, _sum: { totalTokens: 100000 } },
          { isByok: true, _sum: { totalTokens: 20000 } },
        ]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID_A}/ai/usage`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          tokensToday: number;
          tokensThisMonth: number;
          costEstimate: string;
          byProvider: Array<{ provider: string; tokens: number; pct: number }>;
          byokSplit: { byokTokens: number; vendorTokens: number; byokPct: number };
        }>
      >();

      expect(body.data.tokensToday).toBe(10000);
      expect(body.data.tokensThisMonth).toBe(120000);
      expect(body.data.costEstimate).toBe('3.600000');

      // Provider breakdown percentages
      expect(body.data.byProvider).toHaveLength(2);
      const anthropic = body.data.byProvider.find((p) => p.provider === 'anthropic');
      expect(anthropic?.tokens).toBe(80000);
      expect(anthropic?.pct).toBeCloseTo(66.67, 1);

      // BYOK split
      expect(body.data.byokSplit.byokTokens).toBe(20000);
      expect(body.data.byokSplit.vendorTokens).toBe(100000);
      expect(body.data.byokSplit.byokPct).toBeCloseTo(16.67, 1);
    });

    it('returns 404 for non-existent tenant', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const fakeId = '00000000-0000-4000-a000-000000000099';
      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${fakeId}/ai/usage`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });
  });

  // =========================================================================
  // GET /admin/tenants/:id/ai/usage/by-feature
  // =========================================================================
  describe('GET /admin/tenants/:id/ai/usage/by-feature', () => {
    it('returns feature breakdown with percentages', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID_A,
        code: 'acme-corp',
        displayName: 'Acme Corp',
      });

      mockAiUsageGroupBy.mockResolvedValueOnce([
        { featureKey: 'chat', _sum: { totalTokens: 60000 }, _count: 150 },
        { featureKey: 'document_processing', _sum: { totalTokens: 30000 }, _count: 50 },
        { featureKey: 'forecasting', _sum: { totalTokens: 10000 }, _count: 20 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID_A}/ai/usage/by-feature`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          features: Array<{ featureKey: string; tokens: number; pct: number; calls: number }>;
        }>
      >();

      expect(body.data.features).toHaveLength(3);

      const chat = body.data.features.find((f) => f.featureKey === 'chat');
      expect(chat?.tokens).toBe(60000);
      expect(chat?.pct).toBe(60);
      expect(chat?.calls).toBe(150);

      const docProc = body.data.features.find((f) => f.featureKey === 'document_processing');
      expect(docProc?.tokens).toBe(30000);
      expect(docProc?.pct).toBe(30);
    });

    it('returns 404 for non-existent tenant', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const fakeId = '00000000-0000-4000-a000-000000000099';
      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${fakeId}/ai/usage/by-feature`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
    });

    it('handles empty feature list', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID_A,
        code: 'acme-corp',
        displayName: 'Acme Corp',
      });

      mockAiUsageGroupBy.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID_A}/ai/usage/by-feature`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ features: unknown[] }>>();
      expect(body.data.features).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET /admin/ai/usage/export
  // =========================================================================
  describe('GET /admin/ai/usage/export', () => {
    it('returns CSV with correct headers and data for PLATFORM_ADMIN', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          day: '2026-03-10',
          tenant_code: 'acme-corp',
          tenant_name: 'Acme Corp',
          feature_key: 'chat',
          total_tokens: BigInt(50000),
          cost_estimate: '1.500000',
          is_byok: false,
        },
        {
          day: '2026-03-10',
          tenant_code: 'beta-ltd',
          tenant_name: 'Beta, Ltd',
          feature_key: 'forecasting',
          total_tokens: BigInt(20000),
          cost_estimate: '0.600000',
          is_byok: true,
        },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/export?startDate=2026-03-01&endDate=2026-03-10',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv');
      expect(res.headers['content-disposition']).toContain('ai-usage-2026-03-01-to-2026-03-10.csv');

      const lines = res.body.split('\n');
      expect(lines[0]).toBe(
        'date,tenantCode,tenantName,featureKey,totalTokens,costEstimate,isByok',
      );
      expect(lines[1]).toBe('2026-03-10,acme-corp,Acme Corp,chat,50000,1.500000,false');
      // Tenant name with comma should be quoted
      expect(lines[2]).toBe('2026-03-10,beta-ltd,"Beta, Ltd",forecasting,20000,0.600000,true');
    });

    it('returns 403 for PLATFORM_VIEWER (export is admin-only)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/export?startDate=2026-03-01&endDate=2026-03-10',
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 400 for invalid date params', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/export?startDate=not-a-date&endDate=2026-03-10',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns empty CSV body when no data in range', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/export?startDate=2026-01-01&endDate=2026-01-31',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const lines = res.body.split('\n');
      expect(lines).toHaveLength(1); // header only
      expect(lines[0]).toContain('date,tenantCode');
    });
  });

  // =========================================================================
  // RBAC enforcement
  // =========================================================================
  describe('RBAC enforcement', () => {
    it('GET /admin/ai/usage/summary accessible by PLATFORM_VIEWER', async () => {
      mockAiUsageAggregate
        .mockResolvedValueOnce({ _sum: { totalTokens: 0, costEstimate: 0 } })
        .mockResolvedValueOnce({ _sum: { totalTokens: 0, costEstimate: 0 } });
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      mockAiUsageGroupBy.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/summary',
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('GET /admin/tenants/:id/ai/usage accessible by PLATFORM_VIEWER', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID_A });
      mockAiUsageAggregate
        .mockResolvedValueOnce({ _sum: { totalTokens: 0, costEstimate: 0 } })
        .mockResolvedValueOnce({ _sum: { totalTokens: 0, costEstimate: 0 } });
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      mockAiUsageGroupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID_A}/ai/usage`,
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('GET /admin/tenants/:id/ai/usage/by-feature accessible by PLATFORM_VIEWER', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID_A });
      mockAiUsageGroupBy.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID_A}/ai/usage/by-feature`,
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('GET /admin/ai/usage/export blocked for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/export?startDate=2026-03-01&endDate=2026-03-10',
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // Aggregation logic edge cases
  // =========================================================================
  describe('Aggregation edge cases', () => {
    it('handles null sums from aggregate when no data exists', async () => {
      mockAiUsageAggregate
        .mockResolvedValueOnce({ _sum: { totalTokens: null, costEstimate: null } })
        .mockResolvedValueOnce({ _sum: { totalTokens: null, costEstimate: null } });
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      mockAiUsageGroupBy.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/summary',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          tokensToday: number;
          tokensThisMonth: number;
          costEstimateToday: string;
          costEstimateThisMonth: string;
        }>
      >();

      expect(body.data.tokensToday).toBe(0);
      expect(body.data.tokensThisMonth).toBe(0);
      expect(body.data.costEstimateToday).toBe('0.000000');
      expect(body.data.costEstimateThisMonth).toBe('0.000000');
    });

    it('fills missing days in daily trend with zeros', async () => {
      mockAiUsageAggregate
        .mockResolvedValueOnce({ _sum: { totalTokens: 100, costEstimate: 0.003 } })
        .mockResolvedValueOnce({ _sum: { totalTokens: 100, costEstimate: 0.003 } });

      // Only one day has data out of 30
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);

      mockQueryRawUnsafe.mockResolvedValueOnce([
        { day: todayStr, tokens: BigInt(100), cost: '0.003000' },
      ]);
      mockAiUsageGroupBy.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/usage/summary',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          dailyTrend: Array<{ date: string; tokens: number; cost: string }>;
        }>
      >();

      // Should have 30 entries
      expect(body.data.dailyTrend.length).toBe(30);

      // Most should be zero
      const nonZero = body.data.dailyTrend.filter((d) => d.tokens > 0);
      expect(nonZero.length).toBe(1);
      expect(nonZero[0].date).toBe(todayStr);
    });

    it('computes correct feature percentages', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID_A });
      mockAiUsageGroupBy.mockResolvedValueOnce([
        { featureKey: 'chat', _sum: { totalTokens: 75000 }, _count: 100 },
        { featureKey: 'forecasting', _sum: { totalTokens: 25000 }, _count: 30 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID_A}/ai/usage/by-feature`,
        headers: await adminAuthHeader(),
      });

      const body = res.json<
        SuccessResponse<{
          features: Array<{ featureKey: string; tokens: number; pct: number }>;
        }>
      >();

      const chat = body.data.features.find((f) => f.featureKey === 'chat')!;
      expect(chat.pct).toBe(75); // 75000 / 100000 * 100

      const forecast = body.data.features.find((f) => f.featureKey === 'forecasting')!;
      expect(forecast.pct).toBe(25);
    });
  });
});

// ===========================================================================
// Admin AI Alerts Routes (E13b.4 Task 2)
// ===========================================================================

describe('Admin AI Alerts Routes (E13b.4 Task 2)', () => {
  const ALERT_ID = '00000000-0000-4000-b000-000000000001';
  const TENANT_ID = TENANT_ID_A;

  const sampleAlert = {
    id: ALERT_ID,
    type: 'QUOTA_WARNING' as const,
    tenantId: TENANT_ID,
    message: 'AI usage at 82% — approaching soft limit (80%)',
    usagePct: 82,
    threshold: 80,
    dailyTokens: null,
    rollingAvgTokens: null,
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: new Date('2026-03-11T10:00:00.000Z'),
    tenant: { code: 'acme-corp', displayName: 'Acme Corp' },
  };

  // =========================================================================
  // GET /admin/ai/alerts
  // =========================================================================
  describe('GET /admin/ai/alerts', () => {
    it('returns list of alerts for PLATFORM_ADMIN', async () => {
      mockAlertFindMany.mockResolvedValueOnce([sampleAlert]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/alerts',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect((body.data[0] as Record<string, unknown>).id).toBe(ALERT_ID);
      expect((body.data[0] as Record<string, unknown>).type).toBe('QUOTA_WARNING');
      expect((body.data[0] as Record<string, unknown>).tenantCode).toBe('acme-corp');
      expect((body.data[0] as Record<string, unknown>).tenantName).toBe('Acme Corp');
      expect((body.data[0] as Record<string, unknown>).usagePct).toBe(82);
      expect((body.data[0] as Record<string, unknown>).acknowledged).toBe(false);
    });

    it('returns 200 for PLATFORM_VIEWER', async () => {
      mockAlertFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/alerts',
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/alerts',
      });

      expect(res.statusCode).toBe(401);
    });

    it('passes type filter to query', async () => {
      mockAlertFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/ai/alerts?type=USAGE_SPIKE',
        headers: await adminAuthHeader(),
      });

      expect(mockAlertFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'USAGE_SPIKE' }),
        }),
      );
    });

    it('passes acknowledged filter to query', async () => {
      mockAlertFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/ai/alerts?acknowledged=false',
        headers: await adminAuthHeader(),
      });

      expect(mockAlertFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ acknowledged: false }),
        }),
      );
    });

    it('returns empty list when no alerts exist', async () => {
      mockAlertFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/alerts',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.data).toHaveLength(0);
    });

    it('converts BigInt fields to numbers', async () => {
      const spikeAlert = {
        ...sampleAlert,
        id: '00000000-0000-4000-b000-000000000002',
        type: 'USAGE_SPIKE' as const,
        dailyTokens: BigInt(150000),
        rollingAvgTokens: BigInt(40000),
      };
      mockAlertFindMany.mockResolvedValueOnce([spikeAlert]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/alerts',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body =
        res.json<SuccessResponse<Array<{ dailyTokens: number; rollingAvgTokens: number }>>>();
      expect(body.data[0].dailyTokens).toBe(150000);
      expect(body.data[0].rollingAvgTokens).toBe(40000);
    });
  });

  // =========================================================================
  // POST /admin/ai/alerts/:id/acknowledge
  // =========================================================================
  describe('POST /admin/ai/alerts/:id/acknowledge', () => {
    it('acknowledges an alert for PLATFORM_ADMIN', async () => {
      const now = new Date('2026-03-11T12:00:00.000Z');
      mockAlertFindUnique.mockResolvedValueOnce(sampleAlert);
      mockAlertUpdate.mockResolvedValueOnce({
        ...sampleAlert,
        acknowledged: true,
        acknowledgedBy: ADMIN_USER_ID,
        acknowledgedAt: now,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/admin/ai/alerts/${ALERT_ID}/acknowledge`,
        headers: { ...(await adminAuthHeader()), 'content-type': 'application/json' },
        payload: {},
      });

      if (res.statusCode !== 200) {
        console.error('DEBUG ack test - status:', res.statusCode, 'body:', res.body);
      }
      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          id: string;
          acknowledged: boolean;
          acknowledgedBy: string;
          acknowledgedAt: string;
        }>
      >();
      expect(body.data.id).toBe(ALERT_ID);
      expect(body.data.acknowledged).toBe(true);
      expect(body.data.acknowledgedBy).toBe(ADMIN_USER_ID);
      expect(body.data.acknowledgedAt).toBe('2026-03-11T12:00:00.000Z');
    });

    it('returns 404 for non-existent alert', async () => {
      mockAlertFindUnique.mockResolvedValueOnce(null);

      const fakeId = '00000000-0000-4000-b000-000000000099';
      const res = await app.inject({
        method: 'POST',
        url: `/admin/ai/alerts/${fakeId}/acknowledge`,
        headers: { ...(await adminAuthHeader()), 'content-type': 'application/json' },
        payload: {},
      });

      if (res.statusCode !== 404) {
        console.error('DEBUG 404 test - status:', res.statusCode, 'body:', res.body);
      }
      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('ALERT_NOT_FOUND');
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/ai/alerts/${ALERT_ID}/acknowledge`,
        headers: { ...(await viewerAuthHeader()), 'content-type': 'application/json' },
        payload: {},
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/ai/alerts/${ALERT_ID}/acknowledge`,
        headers: { 'content-type': 'application/json' },
        payload: {},
      });

      expect(res.statusCode).toBe(401);
    });

    it('calls update with correct data', async () => {
      mockAlertFindUnique.mockResolvedValueOnce(sampleAlert);
      mockAlertUpdate.mockResolvedValueOnce({
        ...sampleAlert,
        acknowledged: true,
        acknowledgedBy: ADMIN_USER_ID,
        acknowledgedAt: new Date(),
      });

      await app.inject({
        method: 'POST',
        url: `/admin/ai/alerts/${ALERT_ID}/acknowledge`,
        headers: { ...(await adminAuthHeader()), 'content-type': 'application/json' },
        payload: {},
      });

      expect(mockAlertUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ALERT_ID },
          data: expect.objectContaining({
            acknowledged: true,
            acknowledgedBy: ADMIN_USER_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // POST /admin/ai/spike-detection
  // =========================================================================
  describe('POST /admin/ai/spike-detection', () => {
    it('triggers spike detection for PLATFORM_ADMIN', async () => {
      mockDetectSpikes.mockResolvedValueOnce({
        tenantsChecked: 5,
        spikesDetected: 1,
        alertsCreated: 1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/admin/ai/spike-detection',
        headers: await adminAuthHeader(),
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          tenantsChecked: number;
          spikesDetected: number;
          alertsCreated: number;
        }>
      >();
      expect(body.data.tenantsChecked).toBe(5);
      expect(body.data.spikesDetected).toBe(1);
      expect(body.data.alertsCreated).toBe(1);
    });

    it('accepts optional date parameter', async () => {
      mockDetectSpikes.mockResolvedValueOnce({
        tenantsChecked: 0,
        spikesDetected: 0,
        alertsCreated: 0,
      });

      await app.inject({
        method: 'POST',
        url: '/admin/ai/spike-detection',
        headers: await adminAuthHeader(),
        payload: { date: '2026-03-10' },
      });

      expect(mockDetectSpikes).toHaveBeenCalledWith(expect.any(Date));
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/ai/spike-detection',
        headers: await viewerAuthHeader(),
        payload: {},
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/ai/spike-detection',
        payload: {},
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

// ===========================================================================
// Admin AI Provider & BYOK Routes (E13b.4 Task 3)
// ===========================================================================

describe('Admin AI Provider Routes (E13b.4 Task 3)', () => {
  const sampleProvider = {
    id: '00000000-0000-4000-c000-000000000001',
    providerId: 'anthropic',
    displayName: 'Anthropic',
    encryptedKey: 'encrypted-value',
    isActive: true,
    lastUsedAt: new Date('2026-03-10T14:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-10T14:00:00.000Z'),
  };

  // =========================================================================
  // GET /admin/ai/providers
  // =========================================================================
  describe('GET /admin/ai/providers', () => {
    it('returns list of vendor providers for PLATFORM_ADMIN', async () => {
      mockVendorProvFindMany.mockResolvedValueOnce([
        sampleProvider,
        { ...sampleProvider, providerId: 'openai', displayName: 'OpenAI', lastUsedAt: null },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/providers',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<
          Array<{
            providerId: string;
            displayName: string;
            isActive: boolean;
            hasApiKey: boolean;
            lastUsedAt: string | null;
          }>
        >
      >();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].providerId).toBe('anthropic');
      expect(body.data[0].hasApiKey).toBe(true);
      expect(body.data[0].lastUsedAt).toBe('2026-03-10T14:00:00.000Z');
      expect(body.data[1].lastUsedAt).toBeNull();
    });

    it('returns 200 for PLATFORM_VIEWER', async () => {
      mockVendorProvFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/providers',
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/providers',
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns hasApiKey false for empty encryptedKey', async () => {
      mockVendorProvFindMany.mockResolvedValueOnce([{ ...sampleProvider, encryptedKey: '' }]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/ai/providers',
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Array<{ hasApiKey: boolean }>>>();
      expect(body.data[0].hasApiKey).toBe(false);
    });
  });

  // =========================================================================
  // PUT /admin/ai/providers/:providerId/key
  // =========================================================================
  describe('PUT /admin/ai/providers/:providerId/key', () => {
    it('updates provider key for PLATFORM_ADMIN', async () => {
      mockVendorProvFindUnique.mockResolvedValueOnce(sampleProvider);
      mockVendorProvUpdate.mockResolvedValueOnce({
        ...sampleProvider,
        encryptedKey: 'new-encrypted-value',
        updatedAt: new Date('2026-03-11T12:00:00.000Z'),
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/admin/ai/providers/anthropic/key',
        headers: await adminAuthHeader(),
        payload: { apiKey: 'sk-ant-new-key-12345' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          success: true;
          providerId: string;
          updatedAt: string;
        }>
      >();
      expect(body.data.success).toBe(true);
      expect(body.data.providerId).toBe('anthropic');
      expect(mockEncryptApiKey).toHaveBeenCalledWith('sk-ant-new-key-12345', 'a'.repeat(64));
    });

    it('returns 404 for non-existent provider', async () => {
      mockVendorProvFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PUT',
        url: '/admin/ai/providers/nonexistent/key',
        headers: await adminAuthHeader(),
        payload: { apiKey: 'sk-test-key' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/admin/ai/providers/anthropic/key',
        headers: await viewerAuthHeader(),
        payload: { apiKey: 'sk-test-key' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 400 for empty apiKey', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/admin/ai/providers/anthropic/key',
        headers: await adminAuthHeader(),
        payload: { apiKey: '' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // PATCH /admin/ai/providers/:providerId
  // =========================================================================
  describe('PATCH /admin/ai/providers/:providerId', () => {
    it('toggles provider active status for PLATFORM_ADMIN', async () => {
      mockVendorProvFindUnique.mockResolvedValueOnce(sampleProvider);
      mockVendorProvUpdate.mockResolvedValueOnce({
        ...sampleProvider,
        isActive: false,
        updatedAt: new Date('2026-03-11T12:00:00.000Z'),
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/admin/ai/providers/anthropic',
        headers: await adminAuthHeader(),
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          providerId: string;
          isActive: boolean;
          updatedAt: string;
        }>
      >();
      expect(body.data.providerId).toBe('anthropic');
      expect(body.data.isActive).toBe(false);
    });

    it('returns 404 for non-existent provider', async () => {
      mockVendorProvFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: '/admin/ai/providers/nonexistent',
        headers: await adminAuthHeader(),
        payload: { isActive: true },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/admin/ai/providers/anthropic',
        headers: await viewerAuthHeader(),
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});

// ===========================================================================
// Admin AI BYOK Routes (E13b.4 Task 3)
// ===========================================================================

describe('Admin AI BYOK Routes (E13b.4 Task 3)', () => {
  const TENANT_ID = TENANT_ID_A;
  const ENTERPRISE_TENANT = {
    id: TENANT_ID,
    code: 'acme-corp',
    displayName: 'Acme Corp',
    plan: { code: 'enterprise' },
  };
  const STARTER_TENANT = {
    id: TENANT_ID,
    code: 'starter-co',
    displayName: 'Starter Co',
    plan: { code: 'starter' },
  };

  const sampleByokCred = {
    id: '00000000-0000-4000-d000-000000000001',
    tenantId: TENANT_ID,
    providerId: 'anthropic',
    encryptedKey: 'encrypted-byok-key',
    isActive: true,
    createdAt: new Date('2026-02-15T00:00:00.000Z'),
    updatedAt: new Date('2026-03-10T14:00:00.000Z'),
  };

  // =========================================================================
  // GET /admin/tenants/:id/ai/byok
  // =========================================================================
  describe('GET /admin/tenants/:id/ai/byok', () => {
    it('returns BYOK keys for tenant', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID });
      mockProviderCredFindMany.mockResolvedValueOnce([sampleByokCred]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/byok`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<
          Array<{
            providerId: string;
            isActive: boolean;
            createdAt: string;
            lastUsedAt: string | null;
          }>
        >
      >();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].providerId).toBe('anthropic');
      expect(body.data[0].isActive).toBe(true);
      // Key should never be exposed
      expect(JSON.stringify(body.data)).not.toContain('encrypted-byok-key');
    });

    it('returns 404 for non-existent tenant', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const fakeId = '00000000-0000-4000-a000-000000000099';
      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${fakeId}/ai/byok`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 200 for PLATFORM_VIEWER', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID });
      mockProviderCredFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/byok`,
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns empty list when no BYOK keys configured', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID });
      mockProviderCredFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/byok`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.data).toHaveLength(0);
    });
  });

  // =========================================================================
  // PUT /admin/tenants/:id/ai/byok/:providerId
  // =========================================================================
  describe('PUT /admin/tenants/:id/ai/byok/:providerId', () => {
    it('adds BYOK key for Enterprise tenant', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(ENTERPRISE_TENANT);
      mockProviderCredUpsert.mockResolvedValueOnce(sampleByokCred);

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await adminAuthHeader(),
        payload: { apiKey: 'sk-ant-byok-key-12345' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          tenantId: string;
          providerId: string;
          isActive: boolean;
          createdAt: string;
        }>
      >();
      expect(body.data.tenantId).toBe(TENANT_ID);
      expect(body.data.providerId).toBe('anthropic');
      expect(mockEncryptApiKey).toHaveBeenCalledWith('sk-ant-byok-key-12345', 'a'.repeat(64));
    });

    it('rejects BYOK for non-Enterprise tenant (FR224)', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(STARTER_TENANT);

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await adminAuthHeader(),
        payload: { apiKey: 'sk-test-key' },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('BYOK_ENTERPRISE_ONLY');
    });

    it('returns 404 for non-existent tenant', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const fakeId = '00000000-0000-4000-a000-000000000099';
      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${fakeId}/ai/byok/anthropic`,
        headers: await adminAuthHeader(),
        payload: { apiKey: 'sk-test-key' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await viewerAuthHeader(),
        payload: { apiKey: 'sk-test-key' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('calls upsert with encrypted key', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(ENTERPRISE_TENANT);
      mockProviderCredUpsert.mockResolvedValueOnce(sampleByokCred);

      await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await adminAuthHeader(),
        payload: { apiKey: 'sk-ant-byok-key-12345' },
      });

      expect(mockProviderCredUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_providerId: { tenantId: TENANT_ID, providerId: 'anthropic' } },
          update: { encryptedKey: 'encrypted-key-base64' },
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            providerId: 'anthropic',
            encryptedKey: 'encrypted-key-base64',
            isActive: true,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // DELETE /admin/tenants/:id/ai/byok/:providerId
  // =========================================================================
  describe('DELETE /admin/tenants/:id/ai/byok/:providerId', () => {
    it('deletes BYOK key for PLATFORM_ADMIN', async () => {
      mockProviderCredFindFirst.mockResolvedValueOnce(sampleByokCred);
      mockProviderCredDelete.mockResolvedValueOnce(sampleByokCred);

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          tenantId: string;
          providerId: string;
          deleted: true;
        }>
      >();
      expect(body.data.deleted).toBe(true);
      expect(body.data.tenantId).toBe(TENANT_ID);
      expect(body.data.providerId).toBe('anthropic');
    });

    it('returns 404 for non-existent BYOK key', async () => {
      mockProviderCredFindFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/nonexistent`,
        headers: await adminAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('BYOK_KEY_NOT_FOUND');
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await viewerAuthHeader(),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // PATCH /admin/tenants/:id/ai/byok/:providerId
  // =========================================================================
  describe('PATCH /admin/tenants/:id/ai/byok/:providerId', () => {
    it('toggles BYOK key active status', async () => {
      mockProviderCredFindFirst.mockResolvedValueOnce(sampleByokCred);
      mockProviderCredUpdate.mockResolvedValueOnce({
        ...sampleByokCred,
        isActive: false,
        updatedAt: new Date('2026-03-11T12:00:00.000Z'),
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await adminAuthHeader(),
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<
        SuccessResponse<{
          tenantId: string;
          providerId: string;
          isActive: boolean;
          updatedAt: string;
        }>
      >();
      expect(body.data.isActive).toBe(false);
      expect(body.data.tenantId).toBe(TENANT_ID);
    });

    it('returns 404 for non-existent BYOK key', async () => {
      mockProviderCredFindFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/nonexistent`,
        headers: await adminAuthHeader(),
        payload: { isActive: true },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/byok/anthropic`,
        headers: await viewerAuthHeader(),
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
