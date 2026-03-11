// ---------------------------------------------------------------------------
// Impersonation Routes Integration Tests — E13b.5 Task 7.1
// Covers: full start→end flow, reason validation, RBAC (PLATFORM_VIEWER reject),
// non-ACTIVE tenant reject, list sessions with pagination, session detail
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
const SESSION_ID = '00000000-0000-4000-b000-000000000050';
const SESSION_ID_2 = '00000000-0000-4000-b000-000000000051';
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

const NOW = new Date('2026-03-11T10:00:00.000Z');

function makeSessionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    platformUserId: ADMIN_USER_ID,
    tenantId: TENANT_ID,
    reason: 'Debugging billing issue for customer',
    startedAt: new Date('2026-03-11T09:00:00.000Z'),
    endedAt: null,
    expiresAt: new Date('2026-03-11T10:00:00.000Z'),
    actionsLog: null,
    platformUser: { id: ADMIN_USER_ID, email: 'admin@nexa.co', displayName: 'Platform Admin' },
    tenant: { id: TENANT_ID, code: 'acme', displayName: 'Acme Corporation' },
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
// POST /admin/tenants/:id/impersonate — Start impersonation
// ===========================================================================

describe('POST /admin/tenants/:id/impersonate', () => {
  it('starts impersonation session and returns token', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    // Service needs tenant lookup
    mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID, status: 'ACTIVE' });
    // Service creates session
    mockImpersonationCreate.mockResolvedValueOnce({ id: SESSION_ID });

    const res = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Debugging billing issue for customer' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as SuccessResponse<{
      sessionId: string;
      token: string;
      expiresAt: string;
    }>;
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(SESSION_ID);
    expect(body.data.token).toBeDefined();
    expect(body.data.expiresAt).toBeDefined();
  });

  it('rejects impersonation without reason (BR-PLT-012)', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    const res = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: '' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as ErrorResponse;
    expect(body.success).toBe(false);
  });

  it('rejects impersonation for PLATFORM_VIEWER (403)', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

    const res = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Some reason for testing' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as ErrorResponse;
    expect(body.success).toBe(false);
  });

  it('rejects impersonation for non-ACTIVE tenant', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID, status: 'SUSPENDED' });

    const res = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Debugging for suspended tenant' },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json() as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('active');
  });

  it('rejects impersonation for non-existent tenant', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockTenantFindUnique.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Debugging for missing tenant' },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json() as ErrorResponse;
    expect(body.success).toBe(false);
  });

  it('accepts custom duration', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID, status: 'ACTIVE' });
    mockImpersonationCreate.mockResolvedValueOnce({ id: SESSION_ID });

    const res = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Extended debugging session', durationMinutes: 120 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as SuccessResponse<{
      sessionId: string;
      token: string;
      expiresAt: string;
    }>;
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(SESSION_ID);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      payload: { reason: 'Test reason' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================================
// POST /admin/impersonation-sessions/:sessionId/end — End session
// ===========================================================================

describe('POST /admin/impersonation-sessions/:sessionId/end', () => {
  it('ends an active impersonation session', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockImpersonationFindUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUserId: ADMIN_USER_ID,
      tenantId: TENANT_ID,
      startedAt: new Date('2026-03-11T09:00:00.000Z'),
      endedAt: null,
    });
    mockImpersonationUpdate.mockResolvedValueOnce({});

    const res = await app.inject({
      method: 'POST',
      url: `/admin/impersonation-sessions/${SESSION_ID}/end`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{
      sessionId: string;
      endedAt: string;
      duration: number;
    }>;
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(SESSION_ID);
    expect(body.data.endedAt).toBeDefined();
    expect(body.data.duration).toBeGreaterThanOrEqual(0);
  });

  it('rejects end session for PLATFORM_VIEWER (403)', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

    const res = await app.inject({
      method: 'POST',
      url: `/admin/impersonation-sessions/${SESSION_ID}/end`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 for non-existent session', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockImpersonationFindUnique.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: `/admin/impersonation-sessions/${SESSION_ID}/end`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects ending already-ended session', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockImpersonationFindUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUserId: ADMIN_USER_ID,
      endedAt: new Date('2026-03-11T09:30:00.000Z'),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/admin/impersonation-sessions/${SESSION_ID}/end`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
  });
});

// ===========================================================================
// Full flow: start → verify → end → verify ended
// ===========================================================================

describe('Impersonation full flow', () => {
  it('start → verify session → end → verify ended', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    // Step 1: Start impersonation
    mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID, status: 'ACTIVE' });
    mockImpersonationCreate.mockResolvedValueOnce({ id: SESSION_ID });

    const startRes = await app.inject({
      method: 'POST',
      url: `/admin/tenants/${TENANT_ID}/impersonate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Full flow test — investigating data sync issue' },
    });

    expect(startRes.statusCode).toBe(201);
    const startBody = startRes.json() as SuccessResponse<{
      sessionId: string;
      token: string;
      expiresAt: string;
    }>;
    expect(startBody.data.sessionId).toBe(SESSION_ID);

    // Step 2: Verify session detail
    mockImpersonationFindUnique.mockResolvedValueOnce(makeSessionRecord());

    const detailRes = await app.inject({
      method: 'GET',
      url: `/admin/impersonation-sessions/${SESSION_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(detailRes.statusCode).toBe(200);
    const detailBody = detailRes.json() as SuccessResponse<{
      id: string;
      reason: string;
      endedAt: string | null;
    }>;
    expect(detailBody.data.id).toBe(SESSION_ID);
    expect(detailBody.data.endedAt).toBeNull();

    // Step 3: End impersonation
    mockImpersonationFindUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      platformUserId: ADMIN_USER_ID,
      tenantId: TENANT_ID,
      startedAt: new Date('2026-03-11T09:00:00.000Z'),
      endedAt: null,
    });
    mockImpersonationUpdate.mockResolvedValueOnce({});

    const endRes = await app.inject({
      method: 'POST',
      url: `/admin/impersonation-sessions/${SESSION_ID}/end`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(endRes.statusCode).toBe(200);
    const endBody = endRes.json() as SuccessResponse<{
      sessionId: string;
      endedAt: string;
      duration: number;
    }>;
    expect(endBody.data.sessionId).toBe(SESSION_ID);
    expect(endBody.data.endedAt).toBeDefined();

    // Step 4: Verify session is now ended
    mockImpersonationFindUnique.mockResolvedValueOnce(
      makeSessionRecord({ endedAt: new Date('2026-03-11T09:45:00.000Z') }),
    );

    const endedDetailRes = await app.inject({
      method: 'GET',
      url: `/admin/impersonation-sessions/${SESSION_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(endedDetailRes.statusCode).toBe(200);
    const endedBody = endedDetailRes.json() as SuccessResponse<{
      id: string;
      endedAt: string | null;
    }>;
    expect(endedBody.data.endedAt).not.toBeNull();
  });
});

// ===========================================================================
// GET /admin/impersonation-sessions — List sessions
// ===========================================================================

describe('GET /admin/impersonation-sessions', () => {
  it('lists sessions with pagination', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    const sessions = [makeSessionRecord(), makeSessionRecord({ id: SESSION_ID_2 })];
    mockImpersonationFindMany.mockResolvedValueOnce(sessions);
    mockImpersonationCount.mockResolvedValueOnce(2);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/impersonation-sessions',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{
      items: unknown[];
      total: number;
      hasMore: boolean;
    }>;
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
    expect(body.data.hasMore).toBe(false);
  });

  it('allows PLATFORM_VIEWER to list sessions', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

    mockImpersonationFindMany.mockResolvedValueOnce([]);
    mockImpersonationCount.mockResolvedValueOnce(0);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/impersonation-sessions',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[] }>;
    expect(body.data.items).toHaveLength(0);
  });

  it('filters sessions by tenantId', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockImpersonationFindMany.mockResolvedValueOnce([makeSessionRecord()]);
    mockImpersonationCount.mockResolvedValueOnce(1);

    const res = await app.inject({
      method: 'GET',
      url: `/admin/impersonation-sessions?tenantId=${TENANT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{ items: unknown[]; total: number }>;
    expect(body.data.items).toHaveLength(1);

    // Verify the filter was passed to Prisma
    expect(mockImpersonationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      }),
    );
  });

  it('indicates hasMore when more results exist', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    // Return limit+1 items to trigger hasMore (default limit 50, send 51)
    const sessions = Array.from({ length: 51 }, (_, i) =>
      makeSessionRecord({ id: `00000000-0000-4000-c000-${String(i).padStart(12, '0')}` }),
    );
    mockImpersonationFindMany.mockResolvedValueOnce(sessions);
    mockImpersonationCount.mockResolvedValueOnce(100);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/impersonation-sessions',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{
      items: unknown[];
      total: number;
      hasMore: boolean;
    }>;
    expect(body.data.items.length).toBeLessThanOrEqual(50);
    expect(body.data.hasMore).toBe(true);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/impersonation-sessions',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================================
// GET /admin/impersonation-sessions/:sessionId — Session detail
// ===========================================================================

describe('GET /admin/impersonation-sessions/:sessionId', () => {
  it('returns session detail with related data', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockImpersonationFindUnique.mockResolvedValueOnce(
      makeSessionRecord({ actionsLog: [{ action: 'view_dashboard' }, { action: 'edit_invoice' }] }),
    );

    const res = await app.inject({
      method: 'GET',
      url: `/admin/impersonation-sessions/${SESSION_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<{
      id: string;
      platformUser: { id: string; email: string; displayName: string };
      tenant: { id: string; code: string; displayName: string };
      reason: string;
      startedAt: string;
      endedAt: string | null;
      expiresAt: string;
      actionsCount: number;
    }>;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(SESSION_ID);
    expect(body.data.platformUser.email).toBe('admin@nexa.co');
    expect(body.data.tenant.code).toBe('acme');
    expect(body.data.reason).toBe('Debugging billing issue for customer');
    expect(body.data.actionsCount).toBe(2);
    expect(body.data.endedAt).toBeNull();
  });

  it('allows PLATFORM_VIEWER to view session detail', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

    mockImpersonationFindUnique.mockResolvedValueOnce(makeSessionRecord());

    const res = await app.inject({
      method: 'GET',
      url: `/admin/impersonation-sessions/${SESSION_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('returns 404 for non-existent session', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

    mockImpersonationFindUnique.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: `/admin/impersonation-sessions/${SESSION_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json() as ErrorResponse;
    expect(body.success).toBe(false);
  });
});
