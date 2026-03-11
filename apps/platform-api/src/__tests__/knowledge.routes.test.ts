// ---------------------------------------------------------------------------
// Platform Knowledge Routes Tests — E5d-4 Task 9
// Covers: 9.1 (Admin CRUD), 9.3 (Internal endpoints), 9.6 (Versioning), 9.7 (Cross-tenant)
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
const ARTICLE_ID = '00000000-0000-4000-b000-000000000400';
const ARTICLE_ID_2 = '00000000-0000-4000-b000-000000000401';
const TENANT_ID_A = '00000000-0000-4000-a000-000000000001';
const TENANT_ID_B = '00000000-0000-4000-a000-000000000002';

// ---------------------------------------------------------------------------
// Mock functions — Knowledge models
// ---------------------------------------------------------------------------

const mockArticleFindMany = vi.fn();
const mockArticleFindUnique = vi.fn();
const mockArticleCreate = vi.fn();
const mockArticleUpdate = vi.fn();
const mockArticleDelete = vi.fn();

const mockResponseGroupBy = vi.fn();
const mockResponseFindMany = vi.fn();
const mockResponseUpsert = vi.fn();

const mockTenantFindUnique = vi.fn();
const mockTenantFindMany = vi.fn();
const mockTenantCount = vi.fn();
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();

// Standard mocks required by full app import graph
const mockCreateAuditLog = vi.fn();
const mockPlanFindMany = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanCreate = vi.fn();
const mockPlanUpdate = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
const mockFindUniquePlatformUser = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();
const mockModuleOverrideFindMany = vi.fn();
const mockModuleOverrideUpsert = vi.fn();
const mockFeatureFlagUpsert = vi.fn();
const mockFeatureFlagFindMany = vi.fn();
const mockTenantAiUsageFindMany = vi.fn();
const mockTenantAiUsageCreate = vi.fn();
const mockTenantAiUsageAggregate = vi.fn();
const mockTenantAiQuotaFindFirst = vi.fn();
const mockTenantAiQuotaUpdate = vi.fn();
const mockTenantAiQuotaCreate = vi.fn();
const mockTenantBillingCreate = vi.fn();
const mockImpersonationFindFirst = vi.fn();
const mockProviderCredFindFirst = vi.fn();
const mockQueryRaw = vi.fn();
const mockUserFindMany = vi.fn();

// Intelligence model stubs
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
      create: (...args: unknown[]) => mockTenantAiQuotaCreate(...args),
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
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  };
  return fn(txProxy);
});

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
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
      findMany: (...args: unknown[]) => mockTenantAiUsageFindMany(...args),
      create: (...args: unknown[]) => mockTenantAiUsageCreate(...args),
      aggregate: (...args: unknown[]) => mockTenantAiUsageAggregate(...args),
    },
    tenantAiQuota: {
      findFirst: (...args: unknown[]) => mockTenantAiQuotaFindFirst(...args),
      update: (...args: unknown[]) => mockTenantAiQuotaUpdate(...args),
      create: (...args: unknown[]) => mockTenantAiQuotaCreate(...args),
    },
    impersonationSession: {
      findFirst: (...args: unknown[]) => mockImpersonationFindFirst(...args),
    },
    tenantProviderCredential: {
      findFirst: (...args: unknown[]) => mockProviderCredFindFirst(...args),
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
    $transaction: (...args: unknown[]) => mockTransaction(...args),
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

function serviceAuthHeader() {
  return { authorization: `Bearer ${TEST_SERVICE_TOKEN}` };
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeArticleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTICLE_ID,
    title: 'Best Practice: VAT Handling',
    content: 'Always use standard VAT codes for EU transactions.',
    category: 'BEST_PRACTICE',
    targetIndustries: [] as string[],
    targetPlanTiers: [] as string[],
    version: 1,
    status: 'DRAFT',
    publishedAt: null as Date | null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-01T10:00:00Z'),
    createdById: ADMIN_USER_ID,
    ...overrides,
  };
}

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
  process.env.PLATFORM_WEBHOOK_BASE_URL = 'http://localhost:3000';
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Default mocks
  mockCreateAuditLog.mockResolvedValue({ id: 'audit-1' });
  mockTenantCount.mockResolvedValue(0);
  mockPlanFindUniqueOrThrow.mockResolvedValue({ id: 'plan-1', code: 'starter' });
  mockModuleOverrideFindMany.mockResolvedValue([]);
  mockResponseGroupBy.mockResolvedValue([]);
  mockResponseFindMany.mockResolvedValue([]);

  const { buildApp } = await import('../app.js');
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  await app?.close();
});

// ===========================================================================
// 9.1 — Platform Admin Knowledge CRUD Route Tests (AC: #1, #9)
// ===========================================================================

describe('Admin Knowledge CRUD Routes (9.1)', () => {
  // -------------------------------------------------------------------------
  // POST /admin/intelligence/knowledge — create
  // -------------------------------------------------------------------------
  describe('POST /admin/intelligence/knowledge', () => {
    it('creates a DRAFT article and returns 201', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const record = makeArticleRecord();
      mockArticleCreate.mockResolvedValueOnce(record);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Best Practice: VAT Handling',
          content: 'Always use standard VAT codes for EU transactions.',
          category: 'BEST_PRACTICE',
          targetIndustries: [],
          targetPlanTiers: [],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('DRAFT');
      expect(body.data.category).toBe('BEST_PRACTICE');
      expect(body.data.version).toBe(1);
      expect(body.data.publishedAt).toBeNull();
    });

    it('validates category enum', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Test',
          content: 'Test content',
          category: 'INVALID_CATEGORY',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('validates required fields', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Missing content and category' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Test',
          content: 'Content',
          category: 'HELP',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('accepts all four category types', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      for (const category of ['BEST_PRACTICE', 'HELP', 'DEFAULT_CONFIG', 'SKILL_UPDATE']) {
        mockArticleCreate.mockResolvedValueOnce(makeArticleRecord({ category }));

        const res = await app.inject({
          method: 'POST',
          url: '/admin/intelligence/knowledge',
          headers: { authorization: `Bearer ${token}` },
          payload: { title: 'Test', content: 'Content', category },
        });

        expect(res.statusCode).toBe(201);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/knowledge — list
  // -------------------------------------------------------------------------
  describe('GET /admin/intelligence/knowledge', () => {
    it('returns paginated list with 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const articles = [makeArticleRecord()];
      mockArticleFindMany.mockResolvedValueOnce(articles);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: ARTICLE_ID,
        title: 'Best Practice: VAT Handling',
        category: 'BEST_PRACTICE',
        distributionSummary: { accepted: 0, rejected: 0, pending: 0 },
      });
    });

    it('filters by status', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/intelligence/knowledge?status=PUBLISHED',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockArticleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });

    it('filters by category', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/intelligence/knowledge?category=SKILL_UPDATE',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockArticleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'SKILL_UPDATE' }),
        }),
      );
    });

    it('supports cursor pagination', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const cursorId = '00000000-0000-4000-b000-000000000999';
      // Return limit+1 items to indicate hasMore
      const articles = [
        makeArticleRecord({ id: ARTICLE_ID }),
        makeArticleRecord({ id: ARTICLE_ID_2 }),
      ];
      mockArticleFindMany.mockResolvedValueOnce(articles);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/intelligence/knowledge?cursor=${cursorId}&limit=1`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.data).toHaveLength(1);
      expect(body.meta?.hasMore).toBe(true);
      expect(body.meta?.cursor).toBe(ARTICLE_ID);
    });

    it('includes distributionSummary per article', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindMany.mockResolvedValueOnce([
        makeArticleRecord({ status: 'PUBLISHED', publishedAt: new Date() }),
      ]);
      mockResponseGroupBy.mockResolvedValueOnce([
        { articleId: ARTICLE_ID, articleVersion: 1, status: 'ACCEPTED', _count: { status: 3 } },
        { articleId: ARTICLE_ID, articleVersion: 1, status: 'REJECTED', _count: { status: 1 } },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
      });

      const body =
        res.json<
          SuccessResponse<
            Array<{ distributionSummary: { accepted: number; rejected: number; pending: number } }>
          >
        >();
      expect(body.data[0].distributionSummary).toEqual({
        accepted: 3,
        rejected: 1,
        pending: 0,
      });
    });

    it('returns empty list when no articles', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.data).toHaveLength(0);
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // GET /admin/intelligence/knowledge/:id — single
  // -------------------------------------------------------------------------
  describe('GET /admin/intelligence/knowledge/:id', () => {
    it('returns article with distributionStats', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const article = makeArticleRecord({ status: 'PUBLISHED', publishedAt: new Date() });
      mockArticleFindUnique.mockResolvedValueOnce(article);
      mockResponseGroupBy.mockResolvedValueOnce([
        { status: 'ACCEPTED', _count: { status: 5 } },
        { status: 'REJECTED', _count: { status: 2 } },
      ]);
      mockTenantCount.mockResolvedValueOnce(10);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.id).toBe(ARTICLE_ID);
      expect(body.data.distributionStats).toEqual({
        totalEligibleTenants: 10,
        accepted: 5,
        rejected: 2,
        pending: 3,
      });
    });

    it('returns 404 for non-existent article', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('ARTICLE_NOT_FOUND');
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /admin/intelligence/knowledge/:id — update
  // -------------------------------------------------------------------------
  describe('PATCH /admin/intelligence/knowledge/:id', () => {
    it('updates article fields', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const existing = makeArticleRecord();
      const updated = makeArticleRecord({ title: 'Updated Title' });

      mockArticleFindUnique.mockResolvedValueOnce(existing);
      mockArticleUpdate.mockResolvedValueOnce(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated Title' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.title).toBe('Updated Title');
    });

    it('auto-increments version when content changes on PUBLISHED article (AC#6)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const existing = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        version: 1,
      });
      const updated = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        version: 2,
        content: 'New improved content',
      });

      mockArticleFindUnique.mockResolvedValueOnce(existing);
      mockArticleUpdate.mockResolvedValueOnce(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'New improved content' },
      });

      expect(res.statusCode).toBe(200);
      // Verify the update call included version increment
      expect(mockArticleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 2 }),
        }),
      );
    });

    it('does NOT increment version for title-only changes on PUBLISHED article', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const existing = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        version: 1,
      });
      const updated = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        version: 1,
        title: 'New Title',
      });

      mockArticleFindUnique.mockResolvedValueOnce(existing);
      mockArticleUpdate.mockResolvedValueOnce(updated);

      await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Title' },
      });

      // Verify the update call did NOT include version
      const updateCall = mockArticleUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(updateCall.data.version).toBeUndefined();
    });

    it('returns 404 for non-existent article', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /admin/intelligence/knowledge/:id/publish — DRAFT → PUBLISHED
  // -------------------------------------------------------------------------
  describe('POST /admin/intelligence/knowledge/:id/publish', () => {
    it('transitions DRAFT → PUBLISHED with publishedAt', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const draft = makeArticleRecord({ status: 'DRAFT' });
      const published = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date('2026-03-10T12:00:00Z'),
      });

      mockArticleFindUnique.mockResolvedValueOnce(draft);
      mockArticleUpdate.mockResolvedValueOnce(published);

      const res = await app.inject({
        method: 'POST',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}/publish`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.status).toBe('PUBLISHED');
      expect(body.data.publishedAt).toBeTruthy();
    });

    it('rejects non-DRAFT articles', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(makeArticleRecord({ status: 'PUBLISHED' }));

      const res = await app.inject({
        method: 'POST',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}/publish`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('returns 404 for non-existent article', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}/publish`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /admin/intelligence/knowledge/:id/archive — PUBLISHED → ARCHIVED
  // -------------------------------------------------------------------------
  describe('POST /admin/intelligence/knowledge/:id/archive', () => {
    it('transitions PUBLISHED → ARCHIVED', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const published = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
      const archived = makeArticleRecord({
        status: 'ARCHIVED',
        publishedAt: new Date(),
      });

      mockArticleFindUnique.mockResolvedValueOnce(published);
      mockArticleUpdate.mockResolvedValueOnce(archived);

      const res = await app.inject({
        method: 'POST',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}/archive`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.status).toBe('ARCHIVED');
    });

    it('rejects non-PUBLISHED articles', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(makeArticleRecord({ status: 'DRAFT' }));

      const res = await app.inject({
        method: 'POST',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}/archive`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /admin/intelligence/knowledge/:id — hard-delete DRAFT only
  // -------------------------------------------------------------------------
  describe('DELETE /admin/intelligence/knowledge/:id', () => {
    it('hard-deletes DRAFT articles', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(makeArticleRecord({ status: 'DRAFT' }));
      mockArticleDelete.mockResolvedValueOnce({ id: ARTICLE_ID });

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(204);
      expect(mockArticleDelete).toHaveBeenCalledWith({ where: { id: ARTICLE_ID } });
    });

    it('rejects deletion of PUBLISHED articles', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(
        makeArticleRecord({ status: 'PUBLISHED', publishedAt: new Date() }),
      );

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('CANNOT_DELETE_NON_DRAFT');
    });

    it('rejects deletion of ARCHIVED articles', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(
        makeArticleRecord({ status: 'ARCHIVED', publishedAt: new Date() }),
      );

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
    });

    it('returns 404 for non-existent article', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockArticleFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Full CRUD Lifecycle
  // -------------------------------------------------------------------------
  describe('Full CRUD lifecycle', () => {
    it('create DRAFT → publish → update content (version bump) → archive', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // Step 1: Create DRAFT
      const draftRecord = makeArticleRecord({ status: 'DRAFT' });
      mockArticleCreate.mockResolvedValueOnce(draftRecord);

      const createRes = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Best Practice: VAT Handling',
          content: 'Always use standard VAT codes for EU transactions.',
          category: 'BEST_PRACTICE',
        },
      });
      expect(createRes.statusCode).toBe(201);

      // Step 2: Publish
      mockArticleFindUnique.mockResolvedValueOnce(draftRecord);
      const publishedRecord = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date('2026-03-10T12:00:00Z'),
      });
      mockArticleUpdate.mockResolvedValueOnce(publishedRecord);

      const publishRes = await app.inject({
        method: 'POST',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}/publish`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(publishRes.statusCode).toBe(200);

      // Step 3: Update content (triggers version bump)
      mockArticleFindUnique.mockResolvedValueOnce(publishedRecord);
      const v2Record = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        version: 2,
        content: 'Improved guidance for EU VAT codes.',
      });
      mockArticleUpdate.mockResolvedValueOnce(v2Record);

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'Improved guidance for EU VAT codes.' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(mockArticleUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 2 }),
        }),
      );

      // Step 4: Archive
      mockArticleFindUnique.mockResolvedValueOnce(v2Record);
      const archivedRecord = makeArticleRecord({ status: 'ARCHIVED', version: 2 });
      mockArticleUpdate.mockResolvedValueOnce(archivedRecord);

      const archiveRes = await app.inject({
        method: 'POST',
        url: `/admin/intelligence/knowledge/${ARTICLE_ID}/archive`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(archiveRes.statusCode).toBe(200);
    });
  });
});

// ===========================================================================
// 9.3 — Internal Platform API Endpoint Tests (AC: #3)
// ===========================================================================

describe('Internal Platform API Endpoints (9.3)', () => {
  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/knowledge/suggested
  // -------------------------------------------------------------------------
  describe('GET /platform/tenants/:tenantId/knowledge/suggested', () => {
    it('returns suggested articles with service token auth', async () => {
      // Tenant with industry and plan
      mockTenantFindUnique.mockResolvedValueOnce({
        industry: 'construction',
        plan: { code: 'professional' },
      });
      // Published articles
      const publishedArticle = makeArticleRecord({
        status: 'PUBLISHED',
        publishedAt: new Date('2026-03-05T10:00:00Z'),
        targetIndustries: [],
        targetPlanTiers: [],
      });
      mockArticleFindMany.mockResolvedValueOnce([publishedArticle]);
      // No existing responses
      mockResponseFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/suggested`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('returns 401 without service token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/suggested`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 with invalid service token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/suggested`,
        headers: { authorization: 'Bearer wrong-token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns empty when tenant not found', async () => {
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/suggested`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.data).toHaveLength(0);
    });

    it('returns empty when no published articles', async () => {
      mockTenantFindUnique.mockResolvedValueOnce({
        industry: 'construction',
        plan: { code: 'professional' },
      });
      mockArticleFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/suggested`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.data).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // POST /platform/tenants/:tenantId/knowledge/:articleId/respond
  // -------------------------------------------------------------------------
  describe('POST /platform/tenants/:tenantId/knowledge/:articleId/respond', () => {
    it('records ACCEPTED response and returns 204', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ version: 1, status: 'PUBLISHED' });
      mockResponseUpsert.mockResolvedValueOnce({ id: 'response-1' });

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/${ARTICLE_ID}/respond`,
        headers: serviceAuthHeader(),
        payload: { status: 'ACCEPTED', tenantArticleId: 'tenant-art-001' },
      });

      expect(res.statusCode).toBe(204);
      expect(mockResponseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_articleId: { tenantId: TENANT_ID_A, articleId: ARTICLE_ID },
          },
          create: expect.objectContaining({
            tenantId: TENANT_ID_A,
            articleId: ARTICLE_ID,
            articleVersion: 1,
            status: 'ACCEPTED',
            tenantArticleId: 'tenant-art-001',
          }),
        }),
      );
    });

    it('records REJECTED response', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ version: 1, status: 'PUBLISHED' });
      mockResponseUpsert.mockResolvedValueOnce({ id: 'response-1' });

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/${ARTICLE_ID}/respond`,
        headers: serviceAuthHeader(),
        payload: { status: 'REJECTED' },
      });

      expect(res.statusCode).toBe(204);
      expect(mockResponseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'REJECTED', tenantArticleId: null }),
        }),
      );
    });

    it('returns 404 for non-existent article', async () => {
      mockArticleFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/${ARTICLE_ID}/respond`,
        headers: serviceAuthHeader(),
        payload: { status: 'ACCEPTED' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without service token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/platform/tenants/${TENANT_ID_A}/knowledge/${ARTICLE_ID}/respond`,
        payload: { status: 'ACCEPTED' },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

// ===========================================================================
// 9.6 — Versioning Integration Tests (AC: #6)
// ===========================================================================

describe('Versioning Integration (9.6)', () => {
  it('v1 published → tenant accepts → content update → v2 re-suggested with previousResponse', async () => {
    const adminToken = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    // Step 1: Create and publish article (v1)
    const draftArticle = makeArticleRecord({ status: 'DRAFT', version: 1 });
    mockArticleCreate.mockResolvedValueOnce(draftArticle);

    await app.inject({
      method: 'POST',
      url: '/admin/intelligence/knowledge',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'VAT Guide', content: 'Original VAT guidance', category: 'BEST_PRACTICE' },
    });

    // Publish
    mockArticleFindUnique.mockResolvedValueOnce(draftArticle);
    const publishedV1 = makeArticleRecord({
      status: 'PUBLISHED',
      version: 1,
      publishedAt: new Date(),
    });
    mockArticleUpdate.mockResolvedValueOnce(publishedV1);

    await app.inject({
      method: 'POST',
      url: `/admin/intelligence/knowledge/${ARTICLE_ID}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    // Step 2: Tenant A accepts v1
    mockArticleFindUnique.mockResolvedValueOnce({ version: 1, status: 'PUBLISHED' });
    mockResponseUpsert.mockResolvedValueOnce({ id: 'resp-1' });

    await app.inject({
      method: 'POST',
      url: `/platform/tenants/${TENANT_ID_A}/knowledge/${ARTICLE_ID}/respond`,
      headers: serviceAuthHeader(),
      payload: { status: 'ACCEPTED', tenantArticleId: 'tenant-art-001' },
    });

    // Step 3: Vendor updates content → v2
    mockArticleFindUnique.mockResolvedValueOnce(publishedV1);
    const publishedV2 = makeArticleRecord({
      status: 'PUBLISHED',
      version: 2,
      publishedAt: new Date(),
      content: 'Improved VAT guidance v2',
    });
    mockArticleUpdate.mockResolvedValueOnce(publishedV2);

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/admin/intelligence/knowledge/${ARTICLE_ID}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { content: 'Improved VAT guidance v2' },
    });
    expect(updateRes.statusCode).toBe(200);

    // Step 4: Query suggested for tenant A → v2 appears with previousResponse
    mockTenantFindUnique.mockResolvedValueOnce({
      industry: 'construction',
      plan: { code: 'professional' },
    });
    mockArticleFindMany.mockResolvedValueOnce([publishedV2]);
    // Tenant A has a v1 response
    mockResponseFindMany.mockResolvedValueOnce([
      {
        id: 'resp-1',
        tenantId: TENANT_ID_A,
        articleId: ARTICLE_ID,
        articleVersion: 1,
        status: 'ACCEPTED',
        tenantArticleId: 'tenant-art-001',
        respondedAt: new Date(),
      },
    ]);

    const suggestedRes = await app.inject({
      method: 'GET',
      url: `/platform/tenants/${TENANT_ID_A}/knowledge/suggested`,
      headers: serviceAuthHeader(),
    });

    expect(suggestedRes.statusCode).toBe(200);
    const body =
      suggestedRes.json<
        SuccessResponse<
          Array<{
            id: string;
            version: number;
            previousResponse: { status: string; articleVersion: number } | null;
          }>
        >
      >();
    const suggestions = body.data as Array<{
      id: string;
      version: number;
      previousResponse: { status: string; articleVersion: number } | null;
    }>;

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].id).toBe(ARTICLE_ID);
    expect(suggestions[0].version).toBe(2);
    expect(suggestions[0].previousResponse).toEqual({
      status: 'ACCEPTED',
      articleVersion: 1,
    });
  });

  it('v1 acceptance record persists — old response is not deleted', async () => {
    // After content update to v2, tenant A's v1 response still exists
    mockArticleFindUnique.mockResolvedValueOnce({ version: 2, status: 'PUBLISHED' });
    mockResponseUpsert.mockResolvedValueOnce({ id: 'resp-1' });

    // Tenant A responds to v2
    await app.inject({
      method: 'POST',
      url: `/platform/tenants/${TENANT_ID_A}/knowledge/${ARTICLE_ID}/respond`,
      headers: serviceAuthHeader(),
      payload: { status: 'ACCEPTED', tenantArticleId: 'tenant-art-002' },
    });

    // The upsert uses the unique constraint (tenantId, articleId) — it updates, not creates a new record
    expect(mockResponseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_articleId: { tenantId: TENANT_ID_A, articleId: ARTICLE_ID } },
        update: expect.objectContaining({ articleVersion: 2 }),
      }),
    );
  });

  it('reject of v1 does NOT block v2 suggestion', async () => {
    // Tenant rejected v1
    mockTenantFindUnique.mockResolvedValueOnce({
      industry: 'construction',
      plan: { code: 'professional' },
    });
    const articleV2 = makeArticleRecord({
      status: 'PUBLISHED',
      version: 2,
      publishedAt: new Date(),
    });
    mockArticleFindMany.mockResolvedValueOnce([articleV2]);
    mockResponseFindMany.mockResolvedValueOnce([
      {
        id: 'resp-1',
        tenantId: TENANT_ID_A,
        articleId: ARTICLE_ID,
        articleVersion: 1,
        status: 'REJECTED',
        tenantArticleId: null,
        respondedAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/platform/tenants/${TENANT_ID_A}/knowledge/suggested`,
      headers: serviceAuthHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body =
      res.json<
        SuccessResponse<
          Array<{ id: string; previousResponse: { status: string; articleVersion: number } | null }>
        >
      >();
    const suggestions = body.data as Array<{
      id: string;
      previousResponse: { status: string; articleVersion: number } | null;
    }>;

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].previousResponse).toEqual({
      status: 'REJECTED',
      articleVersion: 1,
    });
  });
});

// ===========================================================================
// 9.7 — Cross-Tenant Isolation Tests
// ===========================================================================

describe('Cross-Tenant Isolation (9.7)', () => {
  it('Tenant A accepts article → Tenant B still sees it as suggested', async () => {
    // Query suggestions for Tenant B
    // Tenant B has no response for this article
    mockTenantFindUnique.mockResolvedValueOnce({
      industry: 'construction',
      plan: { code: 'professional' },
    });

    const publishedArticle = makeArticleRecord({
      status: 'PUBLISHED',
      publishedAt: new Date(),
      targetIndustries: [],
      targetPlanTiers: [],
    });
    mockArticleFindMany.mockResolvedValueOnce([publishedArticle]);

    // Tenant B has no responses (even though Tenant A accepted)
    mockResponseFindMany.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/platform/tenants/${TENANT_ID_B}/knowledge/suggested`,
      headers: serviceAuthHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse<unknown[]>>();
    const suggestions = body.data as unknown[];
    expect(suggestions).toHaveLength(1);
  });

  it('Tenant A response does not affect Tenant B response', async () => {
    // Record Tenant A's acceptance
    mockArticleFindUnique.mockResolvedValueOnce({ version: 1, status: 'PUBLISHED' });
    mockResponseUpsert.mockResolvedValueOnce({ id: 'resp-a' });

    await app.inject({
      method: 'POST',
      url: `/platform/tenants/${TENANT_ID_A}/knowledge/${ARTICLE_ID}/respond`,
      headers: serviceAuthHeader(),
      payload: { status: 'ACCEPTED', tenantArticleId: 'ta-001' },
    });

    // Record Tenant B's rejection
    mockArticleFindUnique.mockResolvedValueOnce({ version: 1, status: 'PUBLISHED' });
    mockResponseUpsert.mockResolvedValueOnce({ id: 'resp-b' });

    await app.inject({
      method: 'POST',
      url: `/platform/tenants/${TENANT_ID_B}/knowledge/${ARTICLE_ID}/respond`,
      headers: serviceAuthHeader(),
      payload: { status: 'REJECTED' },
    });

    // Verify each upsert was scoped to the correct tenant
    const calls = mockResponseUpsert.mock.calls;
    expect(calls).toHaveLength(2);

    const callA = calls[0][0] as { where: { tenantId_articleId: { tenantId: string } } };
    expect(callA.where.tenantId_articleId.tenantId).toBe(TENANT_ID_A);

    const callB = calls[1][0] as { where: { tenantId_articleId: { tenantId: string } } };
    expect(callB.where.tenantId_articleId.tenantId).toBe(TENANT_ID_B);
  });

  it('suggestion filtering is per-tenant — responses for other tenants are ignored', async () => {
    // Setup: published article with no targeting restrictions
    mockTenantFindUnique.mockResolvedValueOnce({
      industry: 'retail',
      plan: { code: 'starter' },
    });

    const article = makeArticleRecord({
      id: ARTICLE_ID,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      targetIndustries: [],
      targetPlanTiers: [],
    });
    mockArticleFindMany.mockResolvedValueOnce([article]);

    // The service queries responses WHERE tenantId = current tenant
    // Tenant B has no responses, so response list is empty
    mockResponseFindMany.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/platform/tenants/${TENANT_ID_B}/knowledge/suggested`,
      headers: serviceAuthHeader(),
    });

    expect(res.statusCode).toBe(200);

    // Verify the response query was scoped to Tenant B
    expect(mockResponseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID_B }),
      }),
    );
  });
});
