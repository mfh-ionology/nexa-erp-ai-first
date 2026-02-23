import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const TEST_SERVICE_TOKEN = 'test-internal-service-token-for-erp';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_PLAN_ID = '00000000-0000-4000-a000-000000000010';

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

const mockFindUniqueTenant = vi.fn();

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    tenant: {
      findUnique: (...args: unknown[]) => mockFindUniqueTenant(...args),
    },
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

function makeTenantWithPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_TENANT_ID,
    code: 'dev-tenant',
    displayName: 'Dev Tenant',
    status: 'ACTIVE',
    planId: TEST_PLAN_ID,
    billingStatus: 'CURRENT',
    sandboxEnabled: false,
    plan: {
      id: TEST_PLAN_ID,
      code: 'pro',
      displayName: 'Pro Plan',
      maxUsers: 25,
      maxCompanies: 5,
      enabledModules: ['finance', 'ar', 'ap', 'sales', 'inventory'],
      apiRateLimit: 1000,
      isActive: true,
    },
    billing: {
      id: 'billing-1',
      tenantId: TEST_TENANT_ID,
      enforcementAction: 'NONE',
    },
    moduleOverrides: [],
    featureFlags: [],
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

interface EntitlementData {
  status: string;
  planCode: string;
  billingStatus: string;
  enforcementAction: string;
  maxUsers: number;
  maxCompanies: number;
  enabledModules: string[];
  featureFlags: Record<string, boolean>;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Platform Entitlements Routes (Task 4)', () => {
  // =========================================================================
  // Service Token Auth
  // =========================================================================
  describe('Service token authentication', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Authorization header has wrong prefix', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: { authorization: 'Basic some-token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when service token is invalid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: { authorization: 'Bearer wrong-token' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Bearer token is empty', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: { authorization: 'Bearer ' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('accepts valid service token and proceeds to handler', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // GET /platform/tenants/:tenantId/entitlements
  // =========================================================================
  describe('GET /platform/tenants/:tenantId/entitlements', () => {
    it('returns 200 with correct entitlement payload', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<EntitlementData>>();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.planCode).toBe('pro');
      expect(body.data.billingStatus).toBe('CURRENT');
      expect(body.data.enforcementAction).toBe('NONE');
      expect(body.data.maxUsers).toBe(25);
      expect(body.data.maxCompanies).toBe(5);
      expect(body.data.enabledModules).toEqual(['ap', 'ar', 'finance', 'inventory', 'sales']);
      expect(body.data.featureFlags).toEqual({});
    });

    it('applies module overrides correctly', async () => {
      const tenant = makeTenantWithPlan({
        moduleOverrides: [
          { moduleKey: 'manufacturing', enabled: true, reason: 'Trial' },
          { moduleKey: 'sales', enabled: false, reason: 'Disabled by admin' },
        ],
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<EntitlementData>>();
      expect(body.data.enabledModules).toContain('manufacturing');
      expect(body.data.enabledModules).not.toContain('sales');
    });

    it('includes feature flags in response', async () => {
      const tenant = makeTenantWithPlan({
        featureFlags: [
          { featureKey: 'ai_forecasting', enabled: true },
          { featureKey: 'beta_reports', enabled: false },
        ],
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<EntitlementData>>();
      expect(body.data.featureFlags).toEqual({
        ai_forecasting: true,
        beta_reports: false,
      });
    });

    it('returns enforcementAction from billing when present', async () => {
      const tenant = makeTenantWithPlan({
        billing: {
          id: 'billing-1',
          tenantId: TEST_TENANT_ID,
          enforcementAction: 'WARNING',
        },
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<EntitlementData>>();
      expect(body.data.enforcementAction).toBe('WARNING');
    });

    it('defaults enforcementAction to NONE when no billing record', async () => {
      const tenant = makeTenantWithPlan({ billing: null });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<EntitlementData>>();
      expect(body.data.enforcementAction).toBe('NONE');
    });

    it('returns 404 for non-existent tenant', async () => {
      mockFindUniqueTenant.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('returns 400 for invalid tenantId format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/platform/tenants/not-a-uuid/entitlements',
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(400);
    });

    it('includes Cache-Control header', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      expect(res.headers['cache-control']).toBe('private, max-age=300');
    });

    it('responds within 50ms (NFR46 benchmark)', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const start = performance.now();
      await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });
      const elapsed = performance.now() - start;

      // NOTE: This test uses a mocked DB, so it only validates framework overhead,
      // not real query latency. A true NFR46 benchmark requires an integration test
      // against a live database. With mocks, should be well under 50ms.
      expect(elapsed).toBeLessThan(50);
    });
  });

  // =========================================================================
  // GET /platform/tenants/:tenantId/status
  // =========================================================================
  describe('GET /platform/tenants/:tenantId/status', () => {
    it('returns 200 with tenant status', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/status`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        status: string;
        billingStatus: string;
        enforcementAction: string;
        sandboxEnabled: boolean;
      }>>();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.billingStatus).toBe('CURRENT');
      expect(body.data.enforcementAction).toBe('NONE');
      expect(body.data.sandboxEnabled).toBe(false);
    });

    it('returns 404 for non-existent tenant', async () => {
      mockFindUniqueTenant.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/status`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns enforcement action from billing', async () => {
      const tenant = makeTenantWithPlan({
        billing: {
          id: 'billing-1',
          tenantId: TEST_TENANT_ID,
          enforcementAction: 'SUSPENDED',
        },
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/status`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<{ enforcementAction: string }>>();
      expect(body.data.enforcementAction).toBe('SUSPENDED');
    });
  });

  // =========================================================================
  // GET /platform/tenants/:tenantId/modules/:moduleKey/access
  // =========================================================================
  describe('GET /platform/tenants/:tenantId/modules/:moduleKey/access', () => {
    it('returns allowed=true for module in plan', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/modules/finance/access`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ allowed: boolean; reason?: string }>>();
      expect(body.data.allowed).toBe(true);
      expect(body.data.reason).toBeUndefined();
    });

    it('returns allowed=false for module not in plan', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/modules/manufacturing/access`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{ allowed: boolean; reason?: string }>>();
      expect(body.data.allowed).toBe(false);
      expect(body.data.reason).toBe('Module not included in your plan');
    });

    it('respects module override enabling a module', async () => {
      const tenant = makeTenantWithPlan({
        moduleOverrides: [
          { moduleKey: 'manufacturing', enabled: true, reason: 'Trial' },
        ],
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/modules/manufacturing/access`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<{ allowed: boolean }>>();
      expect(body.data.allowed).toBe(true);
    });

    it('respects module override disabling a module', async () => {
      const tenant = makeTenantWithPlan({
        moduleOverrides: [
          { moduleKey: 'finance', enabled: false, reason: 'Disabled by admin' },
        ],
      });
      mockFindUniqueTenant.mockResolvedValue(tenant);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/modules/finance/access`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<{ allowed: boolean; reason?: string }>>();
      expect(body.data.allowed).toBe(false);
      expect(body.data.reason).toBe('Module disabled by admin');
    });

    it('returns 404 for non-existent tenant', async () => {
      mockFindUniqueTenant.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/modules/finance/access`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // GET /platform/tenants/:tenantId/users/quota
  // =========================================================================
  describe('GET /platform/tenants/:tenantId/users/quota', () => {
    it('returns canAddUser=true when under quota', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/users/quota?currentCount=10`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<{
        currentCount: number;
        maxUsers: number;
        canAddUser: boolean;
      }>>();
      expect(body.data.currentCount).toBe(10);
      expect(body.data.maxUsers).toBe(25);
      expect(body.data.canAddUser).toBe(true);
    });

    it('returns canAddUser=false when at quota', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/users/quota?currentCount=25`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<{
        currentCount: number;
        maxUsers: number;
        canAddUser: boolean;
      }>>();
      expect(body.data.currentCount).toBe(25);
      expect(body.data.maxUsers).toBe(25);
      expect(body.data.canAddUser).toBe(false);
    });

    it('returns canAddUser=false when over quota', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/users/quota?currentCount=30`,
        headers: serviceAuthHeader(),
      });

      const body = res.json<SuccessResponse<{
        currentCount: number;
        maxUsers: number;
        canAddUser: boolean;
      }>>();
      expect(body.data.canAddUser).toBe(false);
    });

    it('returns 400 when currentCount query param is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/users/quota`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for non-existent tenant', async () => {
      mockFindUniqueTenant.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/users/quota?currentCount=5`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // JWT verify hook skips /platform/* routes
  // =========================================================================
  describe('JWT verify hook bypass for /platform/* routes', () => {
    it('/platform/* routes do NOT require JWT auth (uses service token instead)', async () => {
      mockFindUniqueTenant.mockResolvedValue(makeTenantWithPlan());

      // Use service token (not JWT) — should work
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      expect(res.statusCode).toBe(200);
    });

    it('/platform/* routes fail with JWT token (wrong auth mechanism)', async () => {
      // JWT token would be accepted by the JWT hook but rejected by service token guard
      // since it's not the PLATFORM_SERVICE_TOKEN
      const res = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TEST_TENANT_ID}/entitlements`,
        headers: { authorization: 'Bearer some-jwt-token-not-service-token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
