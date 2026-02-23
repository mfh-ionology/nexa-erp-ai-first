// ---------------------------------------------------------------------------
// AI Quota Management Tests — E3b.5 Task 5
// Source: API Contracts §21.5, AC #1
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
const mockTenantBillingUpdate = vi.fn();
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
      update: (...args: unknown[]) => mockTenantBillingUpdate(...args),
      findUnique: (...args: unknown[]) => mockTenantBillingFindUnique(...args),
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
      update: (...args: unknown[]) => mockTenantBillingUpdate(...args),
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

function makeAiQuotaRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quota-uuid-1',
    tenantId: TENANT_ID,
    periodStart: new Date('2026-02-01T00:00:00Z'),
    periodEnd: new Date('2026-03-01T00:00:00Z'),
    tokensUsed: BigInt(250_000),
    tokenAllowance: BigInt(1_000_000),
    softLimitPct: 80,
    hardLimitPct: 100,
    burstAllowance: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
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

interface AiQuotaData {
  tenantId: string;
  planCode: string;
  tokenAllowance: string;
  tokensUsed: string;
  quotaPct: number;
  softLimitPct: number;
  hardLimitPct: number;
  burstAllowance: string | null;
  periodStart: string;
  periodEnd: string;
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
    id: PLAN_ID,
    code: 'starter',
    displayName: 'Starter Plan',
    isActive: true,
    monthlyAiTokenAllowance: BigInt(1_000_000),
  });
  mockModuleOverrideFindMany.mockResolvedValue([]);
  mockTenantBillingUpdate.mockResolvedValue({
    id: 'billing-uuid-1',
    tenantId: TENANT_ID,
    enforcementAction: 'NONE',
  });
  mockTenantUpdate.mockResolvedValue({
    id: TENANT_ID,
    code: 'acme-corp',
    status: 'ACTIVE',
    billingStatus: 'CURRENT',
  });

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

describe('AI Quota Management (E3b.5 Task 5)', () => {
  // =========================================================================
  // GET /admin/tenants/:id/ai/quota
  // =========================================================================
  describe('GET /admin/tenants/:id/ai/quota', () => {
    it('returns quota with computed quotaPct → 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter', monthlyAiTokenAllowance: BigInt(1_000_000) },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(
        makeAiQuotaRecord({
          tokensUsed: BigInt(250_000),
          tokenAllowance: BigInt(1_000_000),
        }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe(TENANT_ID);
      expect(body.data.planCode).toBe('starter');
      expect(body.data.tokenAllowance).toBe('1000000');
      expect(body.data.tokensUsed).toBe('250000');
      expect(body.data.quotaPct).toBe(25);
      expect(body.data.softLimitPct).toBe(80);
      expect(body.data.hardLimitPct).toBe(100);
      expect(body.data.burstAllowance).toBeNull();
      expect(body.data.periodStart).toBeDefined();
      expect(body.data.periodEnd).toBeDefined();
    });

    it('PLATFORM_VIEWER can view quota → 200', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter', monthlyAiTokenAllowance: BigInt(1_000_000) },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(makeAiQuotaRecord());

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.success).toBe(true);
    });

    it('returns quotaPct of 0 when tokenAllowance is 0', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'free', monthlyAiTokenAllowance: BigInt(0) },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(
        makeAiQuotaRecord({
          tokensUsed: BigInt(0),
          tokenAllowance: BigInt(0),
        }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.data.quotaPct).toBe(0);
    });

    it('returns burstAllowance when set', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'enterprise', monthlyAiTokenAllowance: BigInt(5_000_000) },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(
        makeAiQuotaRecord({
          tokenAllowance: BigInt(5_000_000),
          burstAllowance: BigInt(500_000),
        }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.data.burstAllowance).toBe('500000');
    });

    it('non-existent tenant → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('tenant exists but no quota record → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter', monthlyAiTokenAllowance: BigInt(1_000_000) },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('AI_QUOTA_NOT_FOUND');
    });

    it('no auth returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // PATCH /admin/tenants/:id/ai/quota
  // =========================================================================
  describe('PATCH /admin/tenants/:id/ai/quota', () => {
    it('update token allowance → 200, audit logged', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter' },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(makeAiQuotaRecord());
      mockTenantAiQuotaUpdate.mockResolvedValueOnce(
        makeAiQuotaRecord({ tokenAllowance: BigInt(2_000_000) }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          tokenAllowance: 2_000_000,
          reason: 'Upgraded token allowance for Q1',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.success).toBe(true);
      expect(body.data.tokenAllowance).toBe('2000000');

      // Verify audit log created
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.ai_quota_updated',
            targetType: 'tenant',
            targetId: TENANT_ID,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('update soft/hard limits → 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter' },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(makeAiQuotaRecord());
      mockTenantAiQuotaUpdate.mockResolvedValueOnce(
        makeAiQuotaRecord({ softLimitPct: 70, hardLimitPct: 120 }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          softLimitPct: 70,
          hardLimitPct: 120,
          reason: 'Adjusted limits for enterprise customer',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.data.softLimitPct).toBe(70);
      expect(body.data.hardLimitPct).toBe(120);
    });

    it('update burst allowance to a value → 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'enterprise' },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(makeAiQuotaRecord());
      mockTenantAiQuotaUpdate.mockResolvedValueOnce(
        makeAiQuotaRecord({ burstAllowance: BigInt(200_000) }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          burstAllowance: 200_000,
          reason: 'Enable burst for demo period',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.data.burstAllowance).toBe('200000');
    });

    it('set burst allowance to null → 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter' },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(
        makeAiQuotaRecord({ burstAllowance: BigInt(200_000) }),
      );
      mockTenantAiQuotaUpdate.mockResolvedValueOnce(
        makeAiQuotaRecord({ burstAllowance: null }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          burstAllowance: null,
          reason: 'Remove burst allowance',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.data.burstAllowance).toBeNull();
    });

    it('non-existent tenant → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          tokenAllowance: 2_000_000,
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('tenant exists but no quota record → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter' },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          tokenAllowance: 2_000_000,
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('AI_QUOTA_NOT_FOUND');
    });

    it('PLATFORM_VIEWER cannot update → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          tokenAllowance: 2_000_000,
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('missing reason → 400', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          tokenAllowance: 2_000_000,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('reason only (no quota fields) → 400', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          reason: 'No actual changes',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('no auth returns 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        payload: {
          tokenAllowance: 2_000_000,
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('audit failure does not break the operation', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        plan: { code: 'starter' },
      });
      mockTenantAiQuotaFindUnique.mockResolvedValueOnce(makeAiQuotaRecord());
      mockTenantAiQuotaUpdate.mockResolvedValueOnce(
        makeAiQuotaRecord({ tokenAllowance: BigInt(3_000_000) }),
      );
      // Audit log throws
      mockCreateAuditLog.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/ai/quota`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          tokenAllowance: 3_000_000,
          reason: 'Test audit failure resilience',
        },
      });

      // Operation still succeeds despite audit failure (BR-PLT-017)
      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<AiQuotaData>>();
      expect(body.data.tokenAllowance).toBe('3000000');
    });
  });
});
