import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const ADMIN_USER_ID = '00000000-0000-4000-b000-000000000020';
const VIEWER_USER_ID = '00000000-0000-4000-b000-000000000021';
const TENANT_ID = '00000000-0000-4000-b000-000000000100';
const PLAN_ID = '00000000-0000-4000-b000-000000000200';

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

const mockTenantFindMany = vi.fn();
const mockTenantFindUnique = vi.fn();
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();
const mockTenantCount = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockTenantBillingCreate = vi.fn();
const mockTenantBillingFindUnique = vi.fn();
const mockTenantAiQuotaCreate = vi.fn();
const mockTenantAiQuotaFindUnique = vi.fn();
const mockTenantAiQuotaUpdate = vi.fn();
const mockModuleOverrideFindMany = vi.fn();
const mockModuleOverrideUpsert = vi.fn();
const mockFeatureFlagUpsert = vi.fn();
const mockQueryRaw = vi.fn();

// Auth plugin required mocks
const mockFindUniquePlatformUser = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockUpdateManyRefreshToken = vi.fn();
const mockFindFirstRefreshToken = vi.fn();

// Transaction mock — executes the callback with a tx proxy
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
      findUnique: (...args: unknown[]) => mockTenantAiQuotaFindUnique(...args),
      update: (...args: unknown[]) => mockTenantAiQuotaUpdate(...args),
    },
    plan: {
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
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

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    tenant: {
      findMany: (...args: unknown[]) => mockTenantFindMany(...args),
      findUnique: (...args: unknown[]) => mockTenantFindUnique(...args),
      create: (...args: unknown[]) => mockTenantCreate(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
      count: (...args: unknown[]) => mockTenantCount(...args),
    },
    plan: {
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockPlanFindUniqueOrThrow(...args),
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
    tenantBilling: {
      findUnique: (...args: unknown[]) => mockTenantBillingFindUnique(...args),
      create: (...args: unknown[]) => mockTenantBillingCreate(...args),
    },
    tenantAiQuota: {
      findUnique: (...args: unknown[]) => mockTenantAiQuotaFindUnique(...args),
      create: (...args: unknown[]) => mockTenantAiQuotaCreate(...args),
      update: (...args: unknown[]) => mockTenantAiQuotaUpdate(...args),
    },
    tenantModuleOverride: {
      upsert: (...args: unknown[]) => mockModuleOverrideUpsert(...args),
    },
    tenantFeatureFlag: {
      upsert: (...args: unknown[]) => mockFeatureFlagUpsert(...args),
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
// Mock webhook service (verify events dispatched without real HTTP)
// ---------------------------------------------------------------------------

const mockPushWebhook = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/webhook.service.js', () => ({
  WebhookServiceImpl: vi.fn().mockImplementation(() => ({
    pushWebhook: (...args: unknown[]) => mockPushWebhook(...args),
  })),
}));

// ---------------------------------------------------------------------------
// JWT Helper
// ---------------------------------------------------------------------------

async function generateTestJwt(
  userId: string,
  role: string,
): Promise<string> {
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

const PLAN_RECORD = {
  id: PLAN_ID,
  code: 'starter',
  displayName: 'Starter Plan',
  isActive: true,
  monthlyAiTokenAllowance: BigInt(1_000_000),
};

function makeTenantRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    code: 'acme-corp',
    displayName: 'Acme Corp',
    legalName: 'Acme Corporation Ltd',
    status: 'PROVISIONING',
    billingStatus: 'CURRENT',
    planId: PLAN_ID,
    region: 'uk-south',
    dbHost: 'db-1.internal',
    dbName: 'tenant_acme',
    dbPort: 5432,
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    plan: { id: PLAN_ID, code: 'starter', displayName: 'Starter Plan' },
    ...overrides,
  };
}

function makeTenantListItem(overrides: Record<string, unknown> = {}) {
  return {
    ...makeTenantRecord(overrides),
    _count: { moduleOverrides: 0 },
    ...(overrides._count ? { _count: overrides._count } : {}),
  };
}

function makeTenantDetailRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...makeTenantRecord({ status: 'ACTIVE', ...overrides }),
    moduleOverrides: [],
    featureFlags: [],
    billing: {
      subscriptionStatus: null,
      currentPeriodEnd: null,
      gracePeriodDays: 14,
      dunningLevel: 0,
      enforcementAction: 'NONE',
    },
    aiQuota: {
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-02-01'),
      tokensUsed: BigInt(0),
      tokenAllowance: BigInt(1_000_000),
      softLimitPct: 80,
      hardLimitPct: 100,
    },
    ...(overrides.moduleOverrides ? { moduleOverrides: overrides.moduleOverrides } : {}),
    ...(overrides.featureFlags ? { featureFlags: overrides.featureFlags } : {}),
    ...(overrides.billing !== undefined ? { billing: overrides.billing } : {}),
    ...(overrides.aiQuota !== undefined ? { aiQuota: overrides.aiQuota } : {}),
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
  // Override webhook base URL for tests
  process.env.PLATFORM_WEBHOOK_BASE_URL = 'http://localhost:3000';
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Default mocks
  mockCreateAuditLog.mockResolvedValue({ id: 'audit-1' });
  mockTenantCount.mockResolvedValue(0);
  mockPlanFindUniqueOrThrow.mockResolvedValue(PLAN_RECORD);
  mockModuleOverrideFindMany.mockResolvedValue([]);

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

describe('Tenant Management Routes (E3b.2 Task 7)', () => {
  // =========================================================================
  // POST /admin/tenants — create tenant
  // =========================================================================
  describe('POST /admin/tenants', () => {
    it('creates tenant in PROVISIONING status and returns 201', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null); // code uniqueness check
      mockPlanFindUnique.mockResolvedValueOnce({ id: PLAN_ID, isActive: true, monthlyAiTokenAllowance: BigInt(1_000_000) }); // plan validation
      const createdTenant = makeTenantRecord();
      mockTenantCreate.mockResolvedValue(createdTenant);
      mockTenantBillingCreate.mockResolvedValue({ id: 'billing-1' });
      mockTenantAiQuotaCreate.mockResolvedValue({ id: 'quota-1' });

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'acme-corp',
          displayName: 'Acme Corp',
          legalName: 'Acme Corporation Ltd',
          planId: PLAN_ID,
          dbHost: 'db-1.internal',
          dbName: 'tenant_acme',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<SuccessResponse<unknown>>();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: TENANT_ID,
        code: 'acme-corp',
        displayName: 'Acme Corp',
        status: 'PROVISIONING',
      });
    });

    it('duplicate code returns 409 CONFLICT', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID }); // code already exists

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'acme-corp',
          displayName: 'Acme Corp',
          planId: PLAN_ID,
          dbHost: 'db-1.internal',
          dbName: 'tenant_acme',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('CONFLICT');
    });

    it('invalid planId (not found) returns 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null); // code uniqueness OK
      mockPlanFindUnique.mockResolvedValueOnce(null); // plan not found

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'new-tenant',
          displayName: 'New Tenant',
          planId: '00000000-0000-4000-b000-999999999999',
          dbHost: 'db-1.internal',
          dbName: 'tenant_new',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('PLAN_NOT_FOUND');
    });

    it('inactive plan returns 400 PLAN_INACTIVE', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null); // code uniqueness OK
      mockPlanFindUnique.mockResolvedValueOnce({ id: PLAN_ID, isActive: false }); // plan inactive

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'new-tenant',
          displayName: 'New Tenant',
          planId: PLAN_ID,
          dbHost: 'db-1.internal',
          dbName: 'tenant_new',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('PLAN_INACTIVE');
    });

    it('returns 400 for invalid code format', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'AB', // too short and uppercase
          displayName: 'Bad Code',
          planId: PLAN_ID,
          dbHost: 'db-1.internal',
          dbName: 'tenant_bad',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /admin/tenants — list tenants
  // =========================================================================
  describe('GET /admin/tenants', () => {
    it('returns paginated list with meta', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const tenants = [
        makeTenantListItem({ id: TENANT_ID, code: 'acme-corp', status: 'ACTIVE' }),
        makeTenantListItem({ id: '00000000-0000-4000-b000-000000000101', code: 'beta-inc', status: 'PROVISIONING' }),
      ];
      mockTenantFindMany.mockResolvedValue(tenants);
      mockTenantCount.mockResolvedValue(2);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.meta).toMatchObject({ total: 2, hasMore: false });
    });

    it('filters by status', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tenants?status=ACTIVE',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(mockTenantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }) as Record<string, unknown>,
        }),
      );
    });

    it('filters by planId', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants?planId=${PLAN_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(mockTenantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ planId: PLAN_ID }) as Record<string, unknown>,
        }),
      );
    });

    it('filters by search term', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tenants?search=acme',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(mockTenantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ code: { contains: 'acme', mode: 'insensitive' } }),
            ]) as unknown[],
          }) as Record<string, unknown>,
        }),
      );
    });

    it('PLATFORM_VIEWER can list tenants', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // GET /admin/tenants/:id — tenant detail
  // =========================================================================
  describe('GET /admin/tenants/:id', () => {
    it('returns full detail with plan, modules, flags', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const detail = makeTenantDetailRecord({
        moduleOverrides: [{
          id: 'mod-1',
          moduleKey: 'crm',
          enabled: false,
          reason: 'Not subscribed',
          changedBy: ADMIN_USER_ID,
          changedAt: new Date('2026-01-15T00:00:00Z'),
        }],
        featureFlags: [{
          id: 'flag-1',
          featureKey: 'ai-assistant',
          enabled: true,
          changedBy: ADMIN_USER_ID,
          changedAt: new Date('2026-01-15T00:00:00Z'),
        }],
      });
      mockTenantFindUnique.mockResolvedValueOnce(detail);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TENANT_ID);
      expect(body.data.plan).toMatchObject({ code: 'starter' });
      expect(body.data.moduleOverrides).toHaveLength(1);
      expect(body.data.featureFlags).toHaveLength(1);
      expect(body.data.billing).toBeDefined();
      expect(body.data.aiQuota).toBeDefined();
    });

    it('non-existent tenant returns 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('PLATFORM_VIEWER can view tenant detail', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
      const detail = makeTenantDetailRecord();
      mockTenantFindUnique.mockResolvedValueOnce(detail);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // PATCH /admin/tenants/:id — update settings
  // =========================================================================
  describe('PATCH /admin/tenants/:id', () => {
    it('updates settings and returns updated tenant', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        displayName: 'Acme Corp',
        legalName: null,
        region: 'uk-south',
        sandboxEnabled: false,
      }); // exists check + old values for audit (called inside transaction)
      const updated = makeTenantRecord({ displayName: 'Acme Corp Updated', status: 'ACTIVE' });
      mockTenantUpdate.mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Acme Corp Updated' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.displayName).toBe('Acme Corp Updated');
    });

    it('non-existent tenant returns 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Updated' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 400 when no fields provided', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('PLATFORM_VIEWER cannot update tenants → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Updated' },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Lifecycle transition tests
  // =========================================================================
  describe('Lifecycle transitions', () => {
    describe('POST /admin/tenants/:id/activate', () => {
      it('PROVISIONING -> ACTIVE returns 200', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        // SELECT FOR UPDATE returns PROVISIONING status
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'PROVISIONING' }]);
        const activated = makeTenantRecord({ status: 'ACTIVE', lastActivityAt: new Date() });
        mockTenantUpdate.mockResolvedValue(activated);

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/activate`,
          headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<SuccessResponse<Record<string, unknown>>>();
        expect(body.data.status).toBe('ACTIVE');
      });

      it('non-existent tenant returns 404', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([]); // no rows

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/activate`,
          headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(404);
      });
    });

    describe('POST /admin/tenants/:id/suspend', () => {
      it('ACTIVE -> SUSPENDED with reason returns 200', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ACTIVE' }]);
        const suspended = makeTenantRecord({ status: 'SUSPENDED' });
        mockTenantUpdate.mockResolvedValue(suspended);

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/suspend`,
          headers: { authorization: `Bearer ${token}` },
          payload: { reason: 'Non-payment' },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<SuccessResponse<Record<string, unknown>>>();
        expect(body.data.status).toBe('SUSPENDED');
      });

      it('without reason returns 400', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/suspend`,
          headers: { authorization: `Bearer ${token}` },
          payload: {},
        });

        expect(res.statusCode).toBe(400);
      });

      it('pushes tenant.suspended webhook', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ACTIVE' }]);
        mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'SUSPENDED' }));

        await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/suspend`,
          headers: { authorization: `Bearer ${token}` },
          payload: { reason: 'Non-payment' },
        });

        // Allow fire-and-forget promise to execute
        await new Promise((r) => setTimeout(r, 10));

        expect(mockPushWebhook).toHaveBeenCalledWith(
          'acme-corp',
          'tenant.suspended',
          expect.objectContaining({
            tenantId: TENANT_ID,
            reason: 'Non-payment',
            suspendedBy: ADMIN_USER_ID,
          }),
        );
      });
    });

    describe('POST /admin/tenants/:id/reactivate', () => {
      it('SUSPENDED -> ACTIVE returns 200', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
        const reactivated = makeTenantRecord({ status: 'ACTIVE', lastActivityAt: new Date() });
        mockTenantUpdate.mockResolvedValue(reactivated);

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/reactivate`,
          headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<SuccessResponse<Record<string, unknown>>>();
        expect(body.data.status).toBe('ACTIVE');
      });

      it('pushes tenant.reactivated webhook', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
        mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'ACTIVE' }));

        await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/reactivate`,
          headers: { authorization: `Bearer ${token}` },
        });

        await new Promise((r) => setTimeout(r, 10));

        expect(mockPushWebhook).toHaveBeenCalledWith(
          'acme-corp',
          'tenant.reactivated',
          expect.objectContaining({
            tenantId: TENANT_ID,
            reactivatedBy: ADMIN_USER_ID,
          }),
        );
      });
    });

    describe('POST /admin/tenants/:id/archive', () => {
      it('SUSPENDED -> ARCHIVED returns 200', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
        const archived = makeTenantRecord({ status: 'ARCHIVED' });
        mockTenantUpdate.mockResolvedValue(archived);

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/archive`,
          headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<SuccessResponse<Record<string, unknown>>>();
        expect(body.data.status).toBe('ARCHIVED');
      });

      it('pushes tenant.archived webhook', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
        mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'ARCHIVED' }));

        await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/archive`,
          headers: { authorization: `Bearer ${token}` },
        });

        await new Promise((r) => setTimeout(r, 10));

        expect(mockPushWebhook).toHaveBeenCalledWith(
          'acme-corp',
          'tenant.archived',
          expect.objectContaining({
            tenantId: TENANT_ID,
            archivedBy: ADMIN_USER_ID,
          }),
        );
      });
    });

    describe('Invalid state transitions', () => {
      it('ACTIVE -> ARCHIVED returns 422 INVALID_STATE_TRANSITION', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ACTIVE' }]);

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/archive`,
          headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(422);
        const body = res.json<ErrorResponse>();
        expect(body.error.code).toBe('INVALID_STATE_TRANSITION');
      });

      it('ARCHIVED -> ACTIVE returns 422 INVALID_STATE_TRANSITION', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ARCHIVED' }]);

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/reactivate`,
          headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(422);
        const body = res.json<ErrorResponse>();
        expect(body.error.code).toBe('INVALID_STATE_TRANSITION');
      });

      it('PROVISIONING -> SUSPENDED returns 422 INVALID_STATE_TRANSITION', async () => {
        const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
        mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'PROVISIONING' }]);

        const res = await app.inject({
          method: 'POST',
          url: `/admin/tenants/${TENANT_ID}/suspend`,
          headers: { authorization: `Bearer ${token}` },
          payload: { reason: 'Testing invalid transition' },
        });

        expect(res.statusCode).toBe(422);
        const body = res.json<ErrorResponse>();
        expect(body.error.code).toBe('INVALID_STATE_TRANSITION');
      });
    });
  });

  // =========================================================================
  // Auth tests
  // =========================================================================
  describe('Authentication and authorization', () => {
    it('PLATFORM_VIEWER can GET list and detail (200)', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      // List
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);
      const listRes = await app.inject({
        method: 'GET',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listRes.statusCode).toBe(200);

      // Detail
      mockTenantFindUnique.mockResolvedValueOnce(makeTenantDetailRecord());
      const detailRes = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(detailRes.statusCode).toBe(200);
    });

    it('PLATFORM_VIEWER cannot POST/PATCH/lifecycle (403)', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      // POST create
      const postRes = await app.inject({
        method: 'POST',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'test-tenant',
          displayName: 'Test',
          planId: PLAN_ID,
          dbHost: 'db.internal',
          dbName: 'test_db',
        },
      });
      expect(postRes.statusCode).toBe(403);

      // PATCH update
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Updated' },
      });
      expect(patchRes.statusCode).toBe(403);

      // Activate
      const activateRes = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/activate`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(activateRes.statusCode).toBe(403);

      // Suspend
      const suspendRes = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/suspend`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'Test' },
      });
      expect(suspendRes.statusCode).toBe(403);

      // Reactivate
      const reactivateRes = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/reactivate`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(reactivateRes.statusCode).toBe(403);

      // Archive
      const archiveRes = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/archive`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(archiveRes.statusCode).toBe(403);

      // Modules
      const modulesRes = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/modules`,
        headers: { authorization: `Bearer ${token}` },
        payload: { modules: [{ moduleKey: 'crm', enabled: true }] },
      });
      expect(modulesRes.statusCode).toBe(403);

      // Feature flags
      const flagsRes = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/feature-flags`,
        headers: { authorization: `Bearer ${token}` },
        payload: { flags: [{ featureKey: 'ai-chat', enabled: true }] },
      });
      expect(flagsRes.statusCode).toBe(403);
    });

    it('no auth returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/tenants',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // Audit log tests
  // =========================================================================
  describe('Audit logging (BR-PLT-017)', () => {
    it('creates audit log for tenant creation', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);
      mockPlanFindUnique.mockResolvedValueOnce({ id: PLAN_ID, isActive: true, monthlyAiTokenAllowance: BigInt(1_000_000) });
      mockTenantCreate.mockResolvedValue(makeTenantRecord());
      mockTenantBillingCreate.mockResolvedValue({ id: 'billing-1' });
      mockTenantAiQuotaCreate.mockResolvedValue({ id: 'quota-1' });

      await app.inject({
        method: 'POST',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'acme-corp',
          displayName: 'Acme Corp',
          planId: PLAN_ID,
          dbHost: 'db-1.internal',
          dbName: 'tenant_acme',
        },
      });

      // Audit log is created by the lifecycle service
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.create',
            targetType: 'tenant',
            targetId: TENANT_ID,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('creates audit log for tenant activation', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'PROVISIONING' }]);
      mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'ACTIVE' }));

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/activate`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.activate',
            targetType: 'tenant',
            targetId: TENANT_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('creates audit log for tenant suspension with reason', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ACTIVE' }]);
      mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'SUSPENDED' }));

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/suspend`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'Policy violation' },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.suspend',
            targetType: 'tenant',
            targetId: TENANT_ID,
            details: expect.objectContaining({ reason: 'Policy violation' }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('creates audit log for tenant update (PATCH)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        displayName: 'Acme Corp',
        legalName: null,
        region: 'uk-south',
        sandboxEnabled: false,
      });
      mockTenantUpdate.mockResolvedValue(makeTenantRecord({ displayName: 'Acme Corp Updated', status: 'ACTIVE' }));

      await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Acme Corp Updated' },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.update',
            targetType: 'tenant',
            targetId: TENANT_ID,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('creates audit log for tenant reactivation', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
      mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'ACTIVE' }));

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/reactivate`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.reactivate',
            targetType: 'tenant',
            targetId: TENANT_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('creates audit log for tenant archival', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
      mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'ARCHIVED' }));

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/archive`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.archive',
            targetType: 'tenant',
            targetId: TENANT_ID,
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  // =========================================================================
  // Module override tests
  // =========================================================================
  describe('PUT /admin/tenants/:id/modules', () => {
    it('upserts module overrides and returns 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID, code: 'acme-corp' });
      const upsertedModule = {
        id: 'mod-1',
        moduleKey: 'crm',
        enabled: false,
        reason: 'Not subscribed',
        changedBy: ADMIN_USER_ID,
        changedAt: new Date('2026-01-15T00:00:00Z'),
      };
      mockModuleOverrideUpsert.mockResolvedValue(upsertedModule);

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/modules`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          modules: [
            { moduleKey: 'crm', enabled: false, reason: 'Not subscribed' },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ moduleKey: 'crm', enabled: false });
    });

    it('non-existent tenant returns 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/modules`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          modules: [{ moduleKey: 'crm', enabled: true }],
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('pushes tenant.modules_changed webhook only for changed modules', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID, code: 'acme-corp' });
      // Simulate existing override: crm is already enabled — no change expected
      mockModuleOverrideFindMany.mockResolvedValueOnce([
        { moduleKey: 'crm', enabled: true },
      ]);
      mockModuleOverrideUpsert
        .mockResolvedValueOnce({
          id: 'mod-1', moduleKey: 'crm', enabled: true,
          reason: null, changedBy: ADMIN_USER_ID, changedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'mod-2', moduleKey: 'hr', enabled: false,
          reason: 'Disabled', changedBy: ADMIN_USER_ID, changedAt: new Date(),
        });

      await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/modules`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          modules: [
            { moduleKey: 'crm', enabled: true },    // no change — was already true
            { moduleKey: 'hr', enabled: false, reason: 'Disabled' }, // new override
          ],
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      // Only 'hr' changed — 'crm' was already enabled, so no webhook for it
      expect(mockPushWebhook).toHaveBeenCalledTimes(1);
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.modules_changed',
        expect.objectContaining({ moduleKey: 'hr', enabled: false }),
      );
    });
  });

  // =========================================================================
  // Feature flag tests
  // =========================================================================
  describe('PUT /admin/tenants/:id/feature-flags', () => {
    it('upserts feature flags and returns 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({ id: TENANT_ID });
      const upsertedFlag = {
        id: 'flag-1',
        featureKey: 'ai-chat',
        enabled: true,
        changedBy: ADMIN_USER_ID,
        changedAt: new Date('2026-01-15T00:00:00Z'),
      };
      mockFeatureFlagUpsert.mockResolvedValue(upsertedFlag);

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/feature-flags`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          flags: [{ featureKey: 'ai-chat', enabled: true }],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ featureKey: 'ai-chat', enabled: true });
    });

    it('non-existent tenant returns 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/feature-flags`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          flags: [{ featureKey: 'ai-chat', enabled: true }],
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for empty flags array', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/tenants/${TENANT_ID}/feature-flags`,
        headers: { authorization: `Bearer ${token}` },
        payload: { flags: [] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // POST /admin/tenants/:id/assign-plan — plan assignment (E3b.5 Task 2)
  // =========================================================================
  describe('POST /admin/tenants/:id/assign-plan', () => {
    const NEW_PLAN_ID = '00000000-0000-4000-b000-000000000201';

    const tenantWithPlan = {
      id: TENANT_ID,
      code: 'acme-corp',
      planId: PLAN_ID,
      plan: {
        id: PLAN_ID,
        code: 'starter',
        displayName: 'Starter Plan',
        maxUsers: 10,
        maxCompanies: 2,
        monthlyAiTokenAllowance: BigInt(1_000_000),
        apiRateLimit: 1000,
      },
    };

    const newPlanRecord = {
      id: NEW_PLAN_ID,
      code: 'professional',
      displayName: 'Professional Plan',
      maxUsers: 50,
      maxCompanies: 10,
      monthlyAiTokenAllowance: BigInt(5_000_000),
      apiRateLimit: 5000,
      isActive: true,
      enabledModules: ['system', 'finance', 'ar', 'ap', 'sales', 'crm'],
    };

    it('assigns valid plan → 200, returns old/new plan details', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithPlan);
      mockPlanFindUnique.mockResolvedValueOnce(newPlanRecord);
      mockTenantUpdate.mockResolvedValue({ ...tenantWithPlan, planId: NEW_PLAN_ID });

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: NEW_PLAN_ID, reason: 'Upgrading to professional' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe(TENANT_ID);
      expect(body.data.oldPlanCode).toBe('starter');
      expect(body.data.newPlanCode).toBe('professional');
      expect(body.data.oldPlanLimits).toMatchObject({ maxUsers: 10, maxCompanies: 2 });
      expect(body.data.newPlanLimits).toMatchObject({ maxUsers: 50, maxCompanies: 10 });
      expect(body.data.changedAt).toBeDefined();
    });

    it('pushes tenant.plan_changed webhook on plan change', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithPlan);
      mockPlanFindUnique.mockResolvedValueOnce(newPlanRecord);
      mockTenantUpdate.mockResolvedValue({ ...tenantWithPlan, planId: NEW_PLAN_ID });

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: NEW_PLAN_ID },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.plan_changed',
        expect.objectContaining({
          tenantId: TENANT_ID,
          oldPlanCode: 'starter',
          newPlanCode: 'professional',
          changedBy: ADMIN_USER_ID,
          enabledModules: newPlanRecord.enabledModules,
        }),
      );
    });

    it('creates audit log on plan change', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithPlan);
      mockPlanFindUnique.mockResolvedValueOnce(newPlanRecord);
      mockTenantUpdate.mockResolvedValue({ ...tenantWithPlan, planId: NEW_PLAN_ID });

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: NEW_PLAN_ID, reason: 'Upgrade' },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.plan_changed',
            targetType: 'tenant',
            targetId: TENANT_ID,
            platformUserId: ADMIN_USER_ID,
            details: expect.objectContaining({
              oldPlanCode: 'starter',
              newPlanCode: 'professional',
              reason: 'Upgrade',
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('assign same plan (idempotent) → 200, no webhook', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithPlan);
      // Return same plan as currently assigned
      mockPlanFindUnique.mockResolvedValueOnce({
        ...tenantWithPlan.plan,
        isActive: true,
        enabledModules: ['system', 'finance'],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.oldPlanCode).toBe('starter');
      expect(body.data.newPlanCode).toBe('starter');

      // No webhook should be pushed for idempotent assignment
      expect(mockPushWebhook).not.toHaveBeenCalled();
    });

    it('non-existent tenant → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: NEW_PLAN_ID },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('non-existent plan → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithPlan);
      mockPlanFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: NEW_PLAN_ID },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('PLAN_NOT_FOUND');
    });

    it('inactive plan → 400', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithPlan);
      mockPlanFindUnique.mockResolvedValueOnce({ ...newPlanRecord, isActive: false });

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: NEW_PLAN_ID },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('PLAN_INACTIVE');
    });

    it('PLATFORM_VIEWER cannot assign plan → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: NEW_PLAN_ID },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // GET /admin/tenants/:id/billing — billing status (E3b.5 Task 3)
  // =========================================================================
  describe('GET /admin/tenants/:id/billing', () => {
    const existingBillingRecord = {
      id: 'billing-uuid-1',
      tenantId: TENANT_ID,
      stripeCustomerId: 'cus_test123',
      subscriptionStatus: 'active',
      currentPeriodEnd: new Date('2026-03-01T00:00:00Z'),
      gracePeriodDays: 14,
      lastPaymentAt: new Date('2026-02-01T00:00:00Z'),
      dunningLevel: 0,
      enforcementAction: 'NONE',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const defaultBillingRecord = {
      id: 'billing-uuid-default',
      tenantId: TENANT_ID,
      stripeCustomerId: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      gracePeriodDays: 14,
      lastPaymentAt: null,
      dunningLevel: 0,
      enforcementAction: 'NONE',
      createdAt: new Date('2026-02-21T00:00:00Z'),
      updatedAt: new Date('2026-02-21T00:00:00Z'),
    };

    it('returns billing for tenant with existing billing record → 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        billingStatus: 'CURRENT',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(existingBillingRecord);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/billing`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        tenantId: TENANT_ID,
        billingStatus: 'CURRENT',
        stripeCustomerId: 'cus_test123',
        subscriptionStatus: 'active',
        currentPeriodEnd: '2026-03-01T00:00:00.000Z',
        gracePeriodDays: 14,
        lastPaymentAt: '2026-02-01T00:00:00.000Z',
        dunningLevel: 0,
        enforcementAction: 'NONE',
      });
    });

    it('returns defaults for tenant without billing record → 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        billingStatus: 'CURRENT',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(null); // no record
      mockTenantBillingCreate.mockResolvedValueOnce(defaultBillingRecord);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/billing`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        tenantId: TENANT_ID,
        billingStatus: 'CURRENT',
        stripeCustomerId: null,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        gracePeriodDays: 14,
        lastPaymentAt: null,
        dunningLevel: 0,
        enforcementAction: 'NONE',
      });
      // Verify a default billing record was created
      expect(mockTenantBillingCreate).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          enforcementAction: 'NONE',
          dunningLevel: 0,
          gracePeriodDays: 14,
        },
      });
    });

    it('non-existent tenant → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/billing`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('PLATFORM_VIEWER can view billing → 200', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        billingStatus: 'CURRENT',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(existingBillingRecord);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/billing`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe(TENANT_ID);
      expect(body.data.enforcementAction).toBe('NONE');
    });
  });
});
