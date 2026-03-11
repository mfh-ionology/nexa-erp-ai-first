// ---------------------------------------------------------------------------
// Audit Log Routes Tests — E13b.6 Task 1.4
// Covers: list with filters, pagination, sorting, detail found/not-found,
//         RBAC (PLATFORM_VIEWER can read), unauthenticated rejection
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

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------

const mockAuditLogFindMany = vi.fn();
const mockAuditLogFindUnique = vi.fn();
const mockCreateAuditLog = vi.fn();

// Stubs for other models that app.ts route plugins query during registration
const mockTenantFindUnique = vi.fn().mockResolvedValue(null);
const mockTenantFindMany = vi.fn().mockResolvedValue([]);
const mockTenantCount = vi.fn().mockResolvedValue(0);
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();
const mockPlatformUserFindUnique = vi.fn().mockResolvedValue(null);
const mockPlatformUserFindMany = vi.fn().mockResolvedValue([]);
const mockPlanFindMany = vi.fn().mockResolvedValue([]);
const mockPlanFindUnique = vi.fn().mockResolvedValue(null);
const mockPlanFindUniqueOrThrow = vi.fn();
const mockPlanCreate = vi.fn();
const mockPlanUpdate = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();
const mockModuleOverrideFindMany = vi.fn().mockResolvedValue([]);
const mockModuleOverrideUpsert = vi.fn();
const mockFeatureFlagUpsert = vi.fn();
const mockFeatureFlagFindMany = vi.fn().mockResolvedValue([]);
const mockTenantAiUsageFindMany = vi.fn().mockResolvedValue([]);
const mockTenantAiUsageCreate = vi.fn();
const mockTenantAiUsageAggregate = vi.fn();
const mockTenantAiQuotaFindFirst = vi.fn().mockResolvedValue(null);
const mockTenantAiQuotaUpdate = vi.fn();
const mockTenantAiQuotaCreate = vi.fn();
const mockTenantBillingCreate = vi.fn();
const mockProviderCredFindFirst = vi.fn().mockResolvedValue(null);
const mockQueryRaw = vi.fn();
const mockUserFindMany = vi.fn().mockResolvedValue([]);

// Impersonation session mocks
const mockImpersonationFindFirst = vi.fn().mockResolvedValue(null);
const mockImpersonationCreate = vi.fn();
const mockImpersonationFindUnique = vi.fn().mockResolvedValue(null);
const mockImpersonationFindMany = vi.fn().mockResolvedValue([]);
const mockImpersonationCount = vi.fn().mockResolvedValue(0);
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
    tenantBilling: { create: (...args: unknown[]) => mockTenantBillingCreate(...args) },
    tenantAiQuota: { create: (...args: unknown[]) => mockTenantAiQuotaCreate(...args) },
    plan: { findUniqueOrThrow: (...args: unknown[]) => mockPlanFindUniqueOrThrow(...args) },
    tenantModuleOverride: {
      findMany: (...args: unknown[]) => mockModuleOverrideFindMany(...args),
      upsert: (...args: unknown[]) => mockModuleOverrideUpsert(...args),
    },
    tenantFeatureFlag: { upsert: (...args: unknown[]) => mockFeatureFlagUpsert(...args) },
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
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
      findUnique: (...args: unknown[]) => mockAuditLogFindUnique(...args),
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
// Test data helpers
// ---------------------------------------------------------------------------

function makeAuditEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    platformUserId: ADMIN_USER_ID,
    action: 'tenant.create',
    targetType: 'tenant',
    targetId: '00000000-0000-4000-a000-000000000001',
    details: { displayName: 'Acme Corp' },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2026-03-10T14:00:00Z'),
    createdAt: new Date('2026-03-10T14:00:00Z'),
    platformUser: {
      id: ADMIN_USER_ID,
      email: 'admin@nexa.io',
      displayName: 'Admin User',
    },
    ...overrides,
  };
}

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: { cursor?: string | null; hasMore?: boolean };
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

  // Defaults
  mockCreateAuditLog.mockResolvedValue({ id: 'audit-1' });
  mockAuditLogFindMany.mockResolvedValue([]);
  mockAuditLogFindUnique.mockResolvedValue(null);
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
// GET /admin/audit-log — List
// ===========================================================================

describe('GET /admin/audit-log', () => {
  it('returns paginated audit log entries sorted by timestamp DESC', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const entry1 = makeAuditEntry({
      id: '00000000-0000-4000-a000-000000000001',
      timestamp: new Date('2026-03-10T14:00:00Z'),
    });
    const entry2 = makeAuditEntry({
      id: '00000000-0000-4000-a000-000000000002',
      action: 'tenant.suspend',
      timestamp: new Date('2026-03-10T13:00:00Z'),
    });
    mockAuditLogFindMany.mockResolvedValueOnce([entry1, entry2]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<unknown[]>;
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta?.hasMore).toBe(false);
    // Verify findMany was called with desc ordering
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { timestamp: 'desc' } }),
    );
  });

  it('filters by action and returns only matching records', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const entry = makeAuditEntry({ action: 'tenant.suspend' });
    mockAuditLogFindMany.mockResolvedValueOnce([entry]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log?action=tenant.suspend',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<unknown[]>;
    expect(body.data).toHaveLength(1);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: 'tenant.suspend' }),
      }),
    );
  });

  it('filters by targetType and returns only matching records', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([makeAuditEntry({ targetType: 'plan' })]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log?targetType=plan',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetType: 'plan' }),
      }),
    );
  });

  it('filters by platformUserId and returns only matching records', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([makeAuditEntry()]);

    const res = await app.inject({
      method: 'GET',
      url: `/admin/audit-log?platformUserId=${ADMIN_USER_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platformUserId: ADMIN_USER_ID }),
      }),
    );
  });

  it('filters by date range (from/to) and returns only records within range', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([makeAuditEntry()]);

    const from = '2026-03-01T00:00:00Z';
    const to = '2026-03-11T00:00:00Z';
    const res = await app.inject({
      method: 'GET',
      url: `/admin/audit-log?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          timestamp: {
            gte: new Date(from),
            lte: new Date(to),
          },
        }),
      }),
    );
  });

  it('combines filters correctly (action + date range)', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([]);

    const from = '2026-03-01T00:00:00Z';
    const res = await app.inject({
      method: 'GET',
      url: `/admin/audit-log?action=tenant.create&from=${encodeURIComponent(from)}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: 'tenant.create',
          timestamp: { gte: new Date(from) },
        }),
      }),
    );
  });

  it('cursor-based pagination returns next page correctly', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const cursorId = '00000000-0000-4000-a000-000000000010';
    const entry = makeAuditEntry({ id: '00000000-0000-4000-a000-000000000011' });
    mockAuditLogFindMany.mockResolvedValueOnce([entry]);

    const res = await app.inject({
      method: 'GET',
      url: `/admin/audit-log?cursor=${cursorId}&limit=10`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: cursorId },
      }),
    );
    const body = res.json() as SuccessResponse<unknown[]>;
    expect(body.meta?.hasMore).toBe(false);
    expect(body.meta?.cursor).toBeNull();
  });

  it('sets hasMore=true when more records exist beyond the limit', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    // Return limit+1 entries to trigger hasMore
    const entries = Array.from({ length: 4 }, (_, i) =>
      makeAuditEntry({ id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}` }),
    );
    mockAuditLogFindMany.mockResolvedValueOnce(entries);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log?limit=3',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<unknown[]>;
    expect(body.data).toHaveLength(3);
    expect(body.meta?.hasMore).toBe(true);
  });

  it('PLATFORM_VIEWER can access the list endpoint', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
    mockAuditLogFindMany.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================================
// GET /admin/audit-log/export — CSV Export
// ===========================================================================

describe('GET /admin/audit-log/export', () => {
  it('returns text/csv content type', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([makeAuditEntry()]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('returns Content-Disposition header with filename', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const disposition = res.headers['content-disposition'] as string;
    expect(disposition).toMatch(
      /^attachment; filename="platform-audit-log-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
  });

  it('CSV includes all expected columns with correct headers', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const entry = makeAuditEntry();
    mockAuditLogFindMany.mockResolvedValueOnce([entry]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    const lines = res.body.split('\n');
    expect(lines[0]).toBe(
      'timestamp,adminEmail,adminName,action,targetType,targetId,ipAddress,userAgent,details',
    );
    // Second line should contain the entry data
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('2026-03-10T14:00:00.000Z');
    expect(lines[1]).toContain('admin@nexa.io');
    expect(lines[1]).toContain('Admin User');
    expect(lines[1]).toContain('tenant.create');
    expect(lines[1]).toContain('192.168.1.1');
  });

  it('filters are applied to export results', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([makeAuditEntry({ action: 'tenant.suspend' })]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export?action=tenant.suspend',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: 'tenant.suspend' }),
      }),
    );
  });

  it('empty result returns CSV with headers only', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const lines = res.body.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      'timestamp,adminEmail,adminName,action,targetType,targetId,ipAddress,userAgent,details',
    );
  });

  it('respects 10,000 row safety limit', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10_000 }));
  });

  it('sets X-Truncated header when result hits the safety limit', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    // Return exactly 10,000 entries to trigger truncation detection
    const entries = Array.from({ length: 10_000 }, (_, i) =>
      makeAuditEntry({ id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}` }),
    );
    mockAuditLogFindMany.mockResolvedValueOnce(entries);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-truncated']).toBe('true');
    expect(res.headers['x-truncated-limit']).toBe('10000');
  });

  it('does not set X-Truncated header when result is below the limit', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindMany.mockResolvedValueOnce([makeAuditEntry()]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-truncated']).toBeUndefined();
  });

  it('PLATFORM_VIEWER can access the export endpoint', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
    mockAuditLogFindMany.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/export',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================================
// GET /admin/audit-log/:id — Detail
// ===========================================================================

describe('GET /admin/audit-log/:id', () => {
  it('returns full entry with details JSON, userAgent, ipAddress', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    const entry = makeAuditEntry();
    mockAuditLogFindUnique.mockResolvedValueOnce(entry);

    const res = await app.inject({
      method: 'GET',
      url: `/admin/audit-log/${entry.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as SuccessResponse<Record<string, unknown>>;
    expect(body.success).toBe(true);
    expect(body.data).toEqual(
      expect.objectContaining({
        id: entry.id,
        action: 'tenant.create',
        details: { displayName: 'Acme Corp' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: '2026-03-10T14:00:00.000Z',
        createdAt: '2026-03-10T14:00:00.000Z',
      }),
    );
    expect(body.data.platformUser).toEqual(
      expect.objectContaining({
        id: ADMIN_USER_ID,
        email: 'admin@nexa.io',
        displayName: 'Admin User',
      }),
    );
  });

  it('returns 404 for non-existent ID', async () => {
    const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
    mockAuditLogFindUnique.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/00000000-0000-4000-a000-999999999999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json() as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUDIT_LOG_NOT_FOUND');
  });

  it('PLATFORM_VIEWER can access the detail endpoint', async () => {
    const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
    const entry = makeAuditEntry();
    mockAuditLogFindUnique.mockResolvedValueOnce(entry);

    const res = await app.inject({
      method: 'GET',
      url: `/admin/audit-log/${entry.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit-log/00000000-0000-4000-a000-000000000001',
    });

    expect(res.statusCode).toBe(401);
  });
});
