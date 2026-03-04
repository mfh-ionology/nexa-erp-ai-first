// ---------------------------------------------------------------------------
// Intelligence Routes Tests — E5d-3 Task 8.5
// Source: Story E5d-3 AC#8
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const ADMIN_USER_ID = '00000000-0000-4000-b000-000000000020';
const VIEWER_USER_ID = '00000000-0000-4000-b000-000000000021';
const PATTERN_ID = '00000000-0000-4000-b000-000000000300';
const CORRECTION_ID = '00000000-0000-4000-b000-000000000301';
const EFFECTIVENESS_ID = '00000000-0000-4000-b000-000000000302';
const INSIGHT_ID = '00000000-0000-4000-b000-000000000303';
const TENANT_ID = '00000000-0000-4000-b000-000000000100';

// ---------------------------------------------------------------------------
// Mock fns — Intelligence models
// ---------------------------------------------------------------------------

const mockPatternFindMany = vi.fn();
const mockPatternCount = vi.fn();
const mockCorrectionFindMany = vi.fn();
const mockCorrectionAggregate = vi.fn();
const mockEffectivenessFindMany = vi.fn();
const mockEffectivenessFindFirst = vi.fn();
const mockInsightFindMany = vi.fn();
const mockInsightFindUnique = vi.fn();
const mockInsightUpdate = vi.fn();
const mockInsightCount = vi.fn();

// Standard mocks required by full app import graph
const mockCreateAuditLog = vi.fn();
const mockPlanFindMany = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanCreate = vi.fn();
const mockPlanUpdate = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
const mockTenantFindMany = vi.fn();
const mockTenantFindUnique = vi.fn();
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();
const mockTenantCount = vi.fn();
const mockTenantBillingCreate = vi.fn();
const mockTenantAiQuotaCreate = vi.fn();
const mockModuleOverrideFindMany = vi.fn();
const mockModuleOverrideUpsert = vi.fn();
const mockFeatureFlagUpsert = vi.fn();
const mockQueryRaw = vi.fn();
const mockFindUniquePlatformUser = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();

// Entitlement / AI mocks
const mockTenantAiUsageFindMany = vi.fn();
const mockTenantAiUsageCreate = vi.fn();
const mockTenantAiUsageAggregate = vi.fn();
const mockTenantAiQuotaFindFirst = vi.fn();
const mockTenantAiQuotaUpdate = vi.fn();
const mockImpersonationFindFirst = vi.fn();
const mockUserFindMany = vi.fn();
const mockProviderCredFindFirst = vi.fn();
const mockFeatureFlagFindMany = vi.fn();
const mockEntitlementFindMany = vi.fn();

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
// Mock getPlatformPrisma — must cover all models the full app needs
// ---------------------------------------------------------------------------

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    plan: {
      findMany: (...args: unknown[]) => mockPlanFindMany(...args),
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockPlanFindUniqueOrThrow(...args),
      create: (...args: unknown[]) => mockPlanCreate(...args),
      update: (...args: unknown[]) => mockPlanUpdate(...args),
    },
    tenant: {
      findMany: (...args: unknown[]) => mockTenantFindMany(...args),
      findUnique: (...args: unknown[]) => mockTenantFindUnique(...args),
      create: (...args: unknown[]) => mockTenantCreate(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
      count: (...args: unknown[]) => mockTenantCount(...args),
    },
    platformAuditLog: {
      create: (...args: unknown[]) => mockCreateAuditLog(...args),
    },
    platformUser: {
      findUnique: (...args: unknown[]) => mockFindUniquePlatformUser(...args),
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
    // Intelligence models (Task 8)
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
// Mock argon2 (required by auth import graph)
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

// ---------------------------------------------------------------------------
// Mock otpauth (required by platform-auth.service.ts import graph)
// ---------------------------------------------------------------------------

vi.mock('otpauth', () => {
  class MockSecret {
    base32 = 'JBSWY3DPEHPK3PXP';
    static fromBase32() {
      return new MockSecret();
    }
    constructor() {
      // no-op
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
// Mock webhook service
// ---------------------------------------------------------------------------

vi.mock('../../src/services/webhook.service.js', () => ({
  WebhookServiceImpl: vi.fn().mockImplementation(() => ({
    pushWebhook: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Mock pg (tenant-db-connector dependency)
// ---------------------------------------------------------------------------

vi.mock('pg', () => ({
  default: { Client: vi.fn() },
  Client: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock CrossTenantAggregationService & InsightsGenerationService
// ---------------------------------------------------------------------------

const mockAggregateForDate = vi.fn();

vi.mock('../../src/services/cross-tenant-aggregation.service.js', () => ({
  CrossTenantAggregationService: vi.fn().mockImplementation(() => ({
    aggregateForDate: (...args: unknown[]) => mockAggregateForDate(...args),
  })),
}));

const mockGenerateInsights = vi.fn();

vi.mock('../../src/services/insights-generation.service.js', () => ({
  InsightsGenerationService: vi.fn().mockImplementation(() => ({
    generateInsights: (...args: unknown[]) => mockGenerateInsights(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Mock TenantDbConnector
// ---------------------------------------------------------------------------

const mockIsConfigured = vi.fn();

vi.mock('../../src/services/tenant-db-connector.js', () => ({
  TenantDbConnector: vi.fn().mockImplementation(() => ({
    isConfigured: (...args: unknown[]) => mockIsConfigured(...args),
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

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makePatternRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: PATTERN_ID,
    tenantId: TENANT_ID,
    patternDate: new Date('2026-03-03'),
    industry: 'manufacturing',
    planTier: 'professional',
    queryCategories: { ar: 45, finance: 30 },
    skillUsage: { create_invoice: 12, apply_filter: 89 },
    viewPatterns: { hasOverdueView: true },
    automationUsage: { cron_runs: 5 },
    createdAt: new Date('2026-03-04T00:00:00Z'),
    ...overrides,
  };
}

function makeCorrectionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: CORRECTION_ID,
    patternDate: new Date('2026-03-03'),
    industry: null,
    correctionType: 'vat_code',
    skillKey: 'create_invoice',
    occurrenceCount: 15,
    tenantCount: 3,
    commonCorrection: 'Tenants frequently correct EU VAT suggestions',
    createdAt: new Date('2026-03-04T00:00:00Z'),
    ...overrides,
  };
}

function makeEffectivenessRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: EFFECTIVENESS_ID,
    skillKey: 'create_invoice',
    measureDate: new Date('2026-03-03'),
    tenantCount: 10,
    totalQueries: 500,
    avgSuccessRate: { toString: () => '85.50' },
    avgCorrectionRate: { toString: () => '10.20' },
    avgConfidence: { toString: () => '0.92' },
    trend: 'IMPROVING',
    createdAt: new Date('2026-03-04T00:00:00Z'),
    ...overrides,
  };
}

function makeInsightRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: INSIGHT_ID,
    insightType: 'FEATURE_GAP',
    title: 'Missing multi-currency support',
    description: 'Multiple tenants requesting multi-currency features',
    evidence: { tenantCount: 8, correctionCount: 45 },
    severity: 'HIGH',
    status: 'NEW',
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date('2026-03-04T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
    ...overrides,
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(() => {
  process.env.PLATFORM_JWT_SECRET = TEST_JWT_SECRET;
  process.env.PLATFORM_WEBHOOK_BASE_URL = 'http://localhost:3000';
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Default mocks
  mockCreateAuditLog.mockResolvedValue({ id: 'audit-1' });
  mockTenantCount.mockResolvedValue(0);
  mockPlanFindUniqueOrThrow.mockResolvedValue({
    id: '00000000-0000-4000-b000-000000000200',
    code: 'starter',
  });
  mockModuleOverrideFindMany.mockResolvedValue([]);
  mockIsConfigured.mockReturnValue(true);

  const { buildApp } = await import('../app.js');
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  await app?.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Intelligence Routes (E5d-3 Task 8)', () => {
  // =========================================================================
  // GET /admin/intelligence/patterns
  // =========================================================================
  describe('GET /admin/intelligence/patterns', () => {
    it('returns paginated patterns with 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const records = [makePatternRecord()];
      mockPatternFindMany.mockResolvedValueOnce(records);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/patterns',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: PATTERN_ID,
        tenantId: TENANT_ID,
        patternDate: '2026-03-03',
        industry: 'manufacturing',
      });
      expect(body.meta?.hasMore).toBe(false);
    });

    it('applies industry and date filters', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPatternFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/intelligence/patterns?industry=manufacturing&dateFrom=2026-03-01&dateTo=2026-03-03',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockPatternFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            industry: 'manufacturing',
            patternDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('supports cursor pagination', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const cursorId = '00000000-0000-4000-b000-000000000001';
      mockPatternFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: `/admin/intelligence/patterns?cursor=${cursorId}&limit=10`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockPatternFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { gt: cursorId },
          }),
          take: 11, // limit + 1 for hasMore detection
        }),
      );
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/patterns',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // GET /admin/intelligence/corrections
  // =========================================================================
  describe('GET /admin/intelligence/corrections', () => {
    it('returns paginated corrections with 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockCorrectionFindMany.mockResolvedValueOnce([makeCorrectionRecord()]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/corrections',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: CORRECTION_ID,
        correctionType: 'vat_code',
        skillKey: 'create_invoice',
        occurrenceCount: 15,
        tenantCount: 3,
      });
    });

    it('applies correctionType and skillKey filters', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockCorrectionFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/intelligence/corrections?correctionType=vat_code&skillKey=create_invoice',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockCorrectionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            correctionType: 'vat_code',
            skillKey: 'create_invoice',
          }),
        }),
      );
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/corrections',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // GET /admin/intelligence/skill-effectiveness
  // =========================================================================
  describe('GET /admin/intelligence/skill-effectiveness', () => {
    it('returns paginated skill effectiveness with 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockEffectivenessFindMany.mockResolvedValueOnce([makeEffectivenessRecord()]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/skill-effectiveness',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: EFFECTIVENESS_ID,
        skillKey: 'create_invoice',
        avgSuccessRate: '85.50',
        trend: 'IMPROVING',
      });
    });

    it('applies trend filter', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockEffectivenessFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/intelligence/skill-effectiveness?trend=DECLINING',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockEffectivenessFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            trend: 'DECLINING',
          }),
        }),
      );
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/skill-effectiveness',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // GET /admin/intelligence/insights
  // =========================================================================
  describe('GET /admin/intelligence/insights', () => {
    it('returns paginated insights with 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockInsightFindMany.mockResolvedValueOnce([makeInsightRecord()]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/insights',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: INSIGHT_ID,
        insightType: 'FEATURE_GAP',
        severity: 'HIGH',
        status: 'NEW',
      });
    });

    it('applies insightType, severity, and status filters', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockInsightFindMany.mockResolvedValueOnce([]);

      await app.inject({
        method: 'GET',
        url: '/admin/intelligence/insights?insightType=SKILL_IMPROVEMENT&severity=HIGH&status=NEW',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockInsightFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            insightType: 'SKILL_IMPROVEMENT',
            severity: 'HIGH',
            status: 'NEW',
          }),
        }),
      );
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/insights',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // PATCH /admin/intelligence/insights/:id
  // =========================================================================
  describe('PATCH /admin/intelligence/insights/:id', () => {
    it('updates insight status and returns 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const existingInsight = makeInsightRecord();
      mockInsightFindUnique.mockResolvedValueOnce(existingInsight);

      const updatedInsight = makeInsightRecord({
        status: 'REVIEWED',
        reviewedById: ADMIN_USER_ID,
        reviewedAt: new Date('2026-03-04T12:00:00Z'),
      });
      mockInsightUpdate.mockResolvedValueOnce(updatedInsight);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/insights/${INSIGHT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'REVIEWED' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('REVIEWED');
      expect(body.data.reviewedById).toBe(ADMIN_USER_ID);
    });

    it('transitions NEW → REVIEWED → ACTIONED', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // First: NEW → REVIEWED
      mockInsightFindUnique.mockResolvedValueOnce(makeInsightRecord());
      mockInsightUpdate.mockResolvedValueOnce(
        makeInsightRecord({ status: 'REVIEWED', reviewedById: ADMIN_USER_ID }),
      );

      const res1 = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/insights/${INSIGHT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'REVIEWED' },
      });
      expect(res1.statusCode).toBe(200);

      // Second: REVIEWED → ACTIONED
      mockInsightFindUnique.mockResolvedValueOnce(makeInsightRecord({ status: 'REVIEWED' }));
      mockInsightUpdate.mockResolvedValueOnce(
        makeInsightRecord({ status: 'ACTIONED', reviewedById: ADMIN_USER_ID }),
      );

      const res2 = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/insights/${INSIGHT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'ACTIONED' },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json<SuccessResponse<Record<string, unknown>>>();
      expect(body2.data.status).toBe('ACTIONED');
    });

    it('returns 404 for non-existent insight', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockInsightFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/insights/${INSIGHT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'REVIEWED' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INSIGHT_NOT_FOUND');
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/intelligence/insights/${INSIGHT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'REVIEWED' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // GET /admin/intelligence/summary
  // =========================================================================
  describe('GET /admin/intelligence/summary', () => {
    it('returns dashboard summary with 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // distinct tenants
      mockPatternFindMany.mockResolvedValueOnce([
        { tenantId: 'a' },
        { tenantId: 'b' },
        { tenantId: 'c' },
      ]);

      // total patterns count
      mockPatternCount.mockResolvedValueOnce(50);

      // total corrections aggregate
      mockCorrectionAggregate.mockResolvedValueOnce({
        _sum: { occurrenceCount: 120 },
      });

      // latest effectiveness date
      const measureDate = new Date('2026-03-03');
      mockEffectivenessFindFirst.mockResolvedValueOnce({ measureDate });

      // latest skills (for overall success rate)
      const skills = [
        makeEffectivenessRecord({ totalQueries: 300 }),
        makeEffectivenessRecord({
          id: 'eff-2',
          skillKey: 'apply_filter',
          totalQueries: 200,
          avgSuccessRate: { toString: () => '90.00' },
        }),
      ];
      mockEffectivenessFindMany.mockResolvedValueOnce(skills);

      // top 5 skills by usage
      mockEffectivenessFindMany.mockResolvedValueOnce(skills);

      // top insights
      mockInsightFindMany.mockResolvedValueOnce([makeInsightRecord()]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/summary',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.totalContributingTenants).toBe(3);
      expect(body.data.totalPatterns).toBe(50);
      expect(body.data.totalCorrections).toBe(120);
      expect(body.data.overallAiSuccessRate).toBeTypeOf('number');
      expect(body.data.topSkillsByUsage).toBeInstanceOf(Array);
      expect(body.data.topInsightsBySeverity).toBeInstanceOf(Array);
    });

    it('returns null overallAiSuccessRate when no effectiveness data', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockPatternFindMany.mockResolvedValueOnce([]);
      mockPatternCount.mockResolvedValueOnce(0);
      mockCorrectionAggregate.mockResolvedValueOnce({
        _sum: { occurrenceCount: null },
      });
      mockEffectivenessFindFirst.mockResolvedValueOnce(null);
      mockInsightFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/summary',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.overallAiSuccessRate).toBeNull();
      expect(body.data.topSkillsByUsage).toEqual([]);
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'GET',
        url: '/admin/intelligence/summary',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // POST /admin/intelligence/aggregate
  // =========================================================================
  describe('POST /admin/intelligence/aggregate', () => {
    it('triggers aggregation and returns result', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const result = {
        processedTenants: 5,
        skippedTenants: 1,
        patternsCreated: 5,
        correctionsCreated: 12,
      };
      mockAggregateForDate.mockResolvedValueOnce(result);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/aggregate',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject(result);
    });

    it('accepts optional date parameter', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockAggregateForDate.mockResolvedValueOnce({
        processedTenants: 0,
        skippedTenants: 0,
        patternsCreated: 0,
        correctionsCreated: 0,
      });

      await app.inject({
        method: 'POST',
        url: '/admin/intelligence/aggregate',
        headers: { authorization: `Bearer ${token}` },
        payload: { date: '2026-03-01' },
      });

      expect(mockAggregateForDate).toHaveBeenCalledWith(expect.any(Date));
      const calledDate = mockAggregateForDate.mock.calls[0][0] as Date;
      expect(calledDate.toISOString().startsWith('2026-03-01')).toBe(true);
    });

    it('returns 503 when tenant DB credentials not configured', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockIsConfigured.mockReturnValueOnce(false);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/aggregate',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(503);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/aggregate',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // POST /admin/intelligence/generate-insights
  // =========================================================================
  describe('POST /admin/intelligence/generate-insights', () => {
    it('triggers insight generation and returns result', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const result = {
        insightsGenerated: 4,
        byType: {
          featureGap: 1,
          workflowOpportunity: 1,
          defaultCandidate: 1,
          skillImprovement: 1,
        },
      };
      mockGenerateInsights.mockResolvedValueOnce(result);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/generate-insights',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject(result);
    });

    it('returns 403 for PLATFORM_VIEWER', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/intelligence/generate-insights',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
