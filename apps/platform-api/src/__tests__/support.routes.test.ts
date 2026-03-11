// ---------------------------------------------------------------------------
// Support Console Routes Tests — E13b.5 Task 3.4
// Covers: search by code (exact), display name (partial, case-insensitive),
// search by email (finds associated tenant), empty query validation, 50 limit
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
const TENANT_ID = '00000000-0000-4000-a000-000000000001';
const PLAN_ID = '00000000-0000-4000-a000-000000000090';

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------

const mockTenantFindUnique = vi.fn();
const mockTenantFindMany = vi.fn();
const mockTenantCount = vi.fn();
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();

const mockPlatformUserFindUnique = vi.fn();
const mockPlatformUserFindMany = vi.fn();

const mockCreateAuditLog = vi.fn();
const mockPlanFindMany = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanCreate = vi.fn();
const mockPlanUpdate = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
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
const mockProviderCredFindFirst = vi.fn();
const mockQueryRaw = vi.fn();
const mockUserFindMany = vi.fn();

// Impersonation session mocks
const mockImpersonationFindFirst = vi.fn();
const mockImpersonationCreate = vi.fn();
const mockImpersonationFindUnique = vi.fn();
const mockImpersonationFindMany = vi.fn();
const mockImpersonationCount = vi.fn();
const mockImpersonationUpdate = vi.fn();

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

// Knowledge model stubs
const mockArticleFindMany = vi.fn().mockResolvedValue([]);
const mockArticleFindUnique = vi.fn();
const mockArticleCreate = vi.fn();
const mockArticleUpdate = vi.fn();
const mockArticleDelete = vi.fn();
const mockResponseGroupBy = vi.fn().mockResolvedValue([]);
const mockResponseFindMany = vi.fn().mockResolvedValue([]);
const mockResponseUpsert = vi.fn();

// AI alert stubs
const mockAiAlertFindMany = vi.fn().mockResolvedValue([]);
const mockAiAlertCount = vi.fn().mockResolvedValue(0);
const mockAiAlertUpdate = vi.fn();

// Vendor credential stubs
const mockVendorCredFindMany = vi.fn().mockResolvedValue([]);
const mockVendorCredFindUnique = vi.fn();
const mockVendorCredCreate = vi.fn();
const mockVendorCredUpdate = vi.fn();
const mockVendorCredDelete = vi.fn();

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
      findUnique: (...args: unknown[]) => mockPlatformUserFindUnique(...args),
      findMany: (...args: unknown[]) => mockPlatformUserFindMany(...args),
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
      create: (...args: unknown[]) => mockImpersonationCreate(...args),
      findUnique: (...args: unknown[]) => mockImpersonationFindUnique(...args),
      findMany: (...args: unknown[]) => mockImpersonationFindMany(...args),
      count: (...args: unknown[]) => mockImpersonationCount(...args),
      update: (...args: unknown[]) => mockImpersonationUpdate(...args),
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
      findMany: (...args: unknown[]) => mockAiAlertFindMany(...args),
      count: (...args: unknown[]) => mockAiAlertCount(...args),
      update: (...args: unknown[]) => mockAiAlertUpdate(...args),
    },
    vendorProviderCredential: {
      findMany: (...args: unknown[]) => mockVendorCredFindMany(...args),
      findUnique: (...args: unknown[]) => mockVendorCredFindUnique(...args),
      create: (...args: unknown[]) => mockVendorCredCreate(...args),
      update: (...args: unknown[]) => mockVendorCredUpdate(...args),
      delete: (...args: unknown[]) => mockVendorCredDelete(...args),
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeTenantRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    code: 'acme',
    displayName: 'Acme Corporation',
    legalName: 'Acme Corp Ltd',
    status: 'ACTIVE',
    billingStatus: 'CURRENT',
    lastActivityAt: new Date('2026-03-10T14:00:00Z'),
    plan: { code: 'professional' },
    ...overrides,
  };
}

interface SuccessResponse<T> {
  success: true;
  data: T;
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
  mockPlanFindUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, code: 'starter' });
  mockModuleOverrideFindMany.mockResolvedValue([]);
  mockResponseGroupBy.mockResolvedValue([]);
  mockResponseFindMany.mockResolvedValue([]);
  // Default: general search returns empty for all queries
  mockTenantFindUnique.mockResolvedValue(null);
  mockTenantFindMany.mockResolvedValue([]);
  mockPlatformUserFindMany.mockResolvedValue([]);
  mockImpersonationFindMany.mockResolvedValue([]);

  const { buildApp } = await import('../app.js');
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  await app?.close();
});

// ===========================================================================
// Support Console Search Tests — GET /admin/support/search
// ===========================================================================

describe('GET /admin/support/search', () => {
  // -------------------------------------------------------------------------
  // Search by tenant code (exact match)
  // -------------------------------------------------------------------------
  it('searches by tenant code with exact match', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const tenant = makeTenantRecord();
    // type=domain triggers exact match on code
    mockTenantFindUnique.mockResolvedValueOnce(tenant);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search?q=acme&type=domain',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[]; total: number }>;
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toEqual(
      expect.objectContaining({
        id: TENANT_ID,
        code: 'acme',
        displayName: 'Acme Corporation',
        matchField: 'code',
        matchValue: 'acme',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Search by display name (partial, case-insensitive)
  // -------------------------------------------------------------------------
  it('searches by display name with partial case-insensitive match', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const tenant = makeTenantRecord();
    mockTenantFindMany.mockResolvedValueOnce([tenant]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search?q=acme&type=name',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[]; total: number }>;
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toEqual(
      expect.objectContaining({
        displayName: 'Acme Corporation',
        matchField: 'displayName',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Search by email finds associated tenant
  // -------------------------------------------------------------------------
  it('searches by email and finds associated tenant via impersonation history', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const platformUser = { id: ADMIN_USER_ID, email: 'admin@acme.com' };
    const tenant = makeTenantRecord();

    // Email search: find platform user by email
    mockPlatformUserFindMany.mockResolvedValueOnce([platformUser]);
    // Find impersonation sessions for that user
    mockImpersonationFindMany.mockResolvedValueOnce([{ tenantId: TENANT_ID }]);
    // Fetch matching tenants
    mockTenantFindMany
      .mockResolvedValueOnce([tenant]) // tenants from impersonation lookup
      .mockResolvedValueOnce([tenant]); // tenants from domain part search (acme)

    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search?q=admin@acme.com&type=email',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[]; total: number }>;
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(body.data.items[0]).toEqual(
      expect.objectContaining({
        id: TENANT_ID,
        displayName: 'Acme Corporation',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Empty query returns validation error
  // -------------------------------------------------------------------------
  it('returns validation error for empty query', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search?q=',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as ErrorResponse;
    expect(body.success).toBe(false);
  });

  it('returns validation error when q parameter is missing', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Results limited to 50
  // -------------------------------------------------------------------------
  it('limits results to 50 maximum', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    // Generate 60 tenant records
    const tenants = Array.from({ length: 60 }, (_, i) =>
      makeTenantRecord({
        id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
        code: `tenant-${String(i)}`,
        displayName: `Test Company ${String(i)}`,
      }),
    );
    mockTenantFindMany.mockResolvedValueOnce(tenants);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search?q=Test&type=name',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[]; total: number }>;
    expect(body.data.items.length).toBeLessThanOrEqual(50);
  });

  // -------------------------------------------------------------------------
  // RBAC: PLATFORM_VIEWER can also search
  // -------------------------------------------------------------------------
  it('allows PLATFORM_VIEWER to search', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
    mockTenantFindUnique.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search?q=nonexistent&type=domain',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[]; total: number }>;
    expect(body.data.items).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Search by ID (exact match)
  // -------------------------------------------------------------------------
  it('searches by tenant ID with exact match', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const tenant = makeTenantRecord();
    mockTenantFindUnique.mockResolvedValueOnce(tenant);

    const res = await app.inject({
      method: 'GET',
      url: `/admin/support/search?q=${TENANT_ID}&type=id`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[]; total: number }>;
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toEqual(
      expect.objectContaining({
        id: TENANT_ID,
        matchField: 'id',
        matchValue: TENANT_ID,
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Unauthenticated request is rejected
  // -------------------------------------------------------------------------
  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/support/search?q=test',
    });

    expect(res.statusCode).toBe(401);
  });
});
