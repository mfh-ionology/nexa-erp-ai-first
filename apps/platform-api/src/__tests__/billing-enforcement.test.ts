// ---------------------------------------------------------------------------
// Billing Enforcement Tests — E3b.5 Task 4
// Source: BR-PLT-004, BR-PLT-005, State Machine §20.2
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

function makeBillingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'billing-uuid-1',
    tenantId: TENANT_ID,
    stripeCustomerId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    gracePeriodDays: 14,
    lastPaymentAt: null,
    dunningLevel: 0,
    enforcementAction: 'NONE',
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
  mockTenantBillingUpdate.mockResolvedValue(makeBillingRecord());
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

describe('Billing Enforcement (E3b.5 Task 4)', () => {
  // =========================================================================
  // PATCH /admin/tenants/:id/billing/enforcement
  // =========================================================================
  describe('PATCH /admin/tenants/:id/billing/enforcement', () => {
    // -----------------------------------------------------------------------
    // Valid transitions
    // -----------------------------------------------------------------------
    it('NONE → WARNING → 200, webhook pushed, audit logged, billingStatus updated', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Payment overdue 7 days',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe(TENANT_ID);
      expect(body.data.previousAction).toBe('NONE');
      expect(body.data.newAction).toBe('WARNING');
      expect(body.data.reason).toBe('Payment overdue 7 days');
      expect(body.data.effectiveAt).toBeDefined();

      // Verify transaction updated billing and tenant
      expect(mockTenantBillingUpdate).toHaveBeenCalled();
      expect(mockTenantUpdate).toHaveBeenCalled();

      // Verify webhook pushed
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'billing.enforcement_changed',
        expect.objectContaining({
          tenantId: TENANT_ID,
          oldAction: 'NONE',
          newAction: 'WARNING',
          reason: 'Payment overdue 7 days',
        }),
      );

      // Verify audit log created
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'billing.enforcement_changed',
            targetType: 'tenant',
            targetId: TENANT_ID,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('WARNING → READ_ONLY → 200, webhook pushed', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'WARNING' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'READ_ONLY',
          reason: 'Grace period expired',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('WARNING');
      expect(body.data.newAction).toBe('READ_ONLY');

      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'billing.enforcement_changed',
        expect.objectContaining({
          oldAction: 'WARNING',
          newAction: 'READ_ONLY',
        }),
      );
    });

    it('READ_ONLY → SUSPENDED → 200, tenant status also changes to SUSPENDED, two webhooks', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'READ_ONLY' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'SUSPENDED',
          reason: 'Continued non-payment',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('READ_ONLY');
      expect(body.data.newAction).toBe('SUSPENDED');

      // Verify tenant update includes status = SUSPENDED
      expect(mockTenantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUSPENDED',
            billingStatus: 'BLOCKED',
          }) as Record<string, unknown>,
        }),
      );

      // Verify two webhooks: billing.enforcement_changed + tenant.suspended
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'billing.enforcement_changed',
        expect.objectContaining({
          oldAction: 'READ_ONLY',
          newAction: 'SUSPENDED',
        }),
      );
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.suspended',
        expect.objectContaining({
          tenantId: TENANT_ID,
          reason: 'Continued non-payment',
          suspendedBy: ADMIN_USER_ID,
          enforcementAction: 'SUSPENDED',
        }),
      );
    });

    it('SUSPENDED → NONE → 200 (payment received, reactivation)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'SUSPENDED',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'SUSPENDED' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'NONE',
          reason: 'Full payment received',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('SUSPENDED');
      expect(body.data.newAction).toBe('NONE');

      // Verify tenant update includes status = ACTIVE and billingStatus = CURRENT
      expect(mockTenantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            billingStatus: 'CURRENT',
          }) as Record<string, unknown>,
        }),
      );

      // Verify two webhooks: billing.enforcement_changed + tenant.reactivated
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'billing.enforcement_changed',
        expect.objectContaining({
          oldAction: 'SUSPENDED',
          newAction: 'NONE',
        }),
      );
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.reactivated',
        expect.objectContaining({
          tenantId: TENANT_ID,
          reactivatedBy: ADMIN_USER_ID,
        }),
      );
    });

    it('WARNING → NONE → 200 (payment received during grace)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'WARNING' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'NONE',
          reason: 'Payment received during grace period',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('WARNING');
      expect(body.data.newAction).toBe('NONE');

      // Only one webhook (billing.enforcement_changed), no tenant.reactivated
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledTimes(1);
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'billing.enforcement_changed',
        expect.objectContaining({
          oldAction: 'WARNING',
          newAction: 'NONE',
        }),
      );
    });

    // -----------------------------------------------------------------------
    // Invalid transitions (skipping levels)
    // -----------------------------------------------------------------------
    it('NONE → READ_ONLY (skip) → 422 INVALID_ENFORCEMENT_TRANSITION', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'READ_ONLY',
          reason: 'Trying to skip levels',
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_ENFORCEMENT_TRANSITION');
    });

    it('NONE → SUSPENDED (skip) → 422 INVALID_ENFORCEMENT_TRANSITION', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'SUSPENDED',
          reason: 'Trying to skip to suspended',
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_ENFORCEMENT_TRANSITION');
    });

    it('WARNING → SUSPENDED (skip) → 422 INVALID_ENFORCEMENT_TRANSITION', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'WARNING' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'SUSPENDED',
          reason: 'Trying to skip from warning to suspended',
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_ENFORCEMENT_TRANSITION');
    });

    // -----------------------------------------------------------------------
    // Idempotency
    // -----------------------------------------------------------------------
    it('already at target action (idempotent) → 200, no webhook', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'WARNING' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Re-applying warning',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('WARNING');
      expect(body.data.newAction).toBe('WARNING');

      // No webhook or audit for idempotent operation
      // Note: $transaction IS still called (idempotency detected inside it), but no side effects
      expect(mockPushWebhook).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Grace period update
    // -----------------------------------------------------------------------
    it('accepts optional gracePeriodDays and passes to billing update', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          gracePeriodDays: 7,
          reason: 'Short grace period',
        },
      });

      expect(res.statusCode).toBe(200);

      // Verify billing update includes gracePeriodDays
      expect(mockTenantBillingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enforcementAction: 'WARNING',
            gracePeriodDays: 7,
          }) as Record<string, unknown>,
        }),
      );
    });

    // -----------------------------------------------------------------------
    // Authorization
    // -----------------------------------------------------------------------
    it('PLATFORM_VIEWER cannot change enforcement → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('no auth returns 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    // -----------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------
    it('missing reason → 400', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('invalid enforcementAction value → 400', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'INVALID_ACTION',
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    // -----------------------------------------------------------------------
    // Error cases
    // -----------------------------------------------------------------------
    it('non-existent tenant → 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Test',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('TENANT_NOT_FOUND');
    });

    it('creates default billing record if none exists, then transitions', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      // No billing record exists
      mockTenantBillingFindUnique.mockResolvedValueOnce(null);
      // Create default returns NONE enforcement
      mockTenantBillingCreate.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'First dunning notice',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('NONE');
      expect(body.data.newAction).toBe('WARNING');

      // Verify default billing record was created
      expect(mockTenantBillingCreate).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          enforcementAction: 'NONE',
          dunningLevel: 0,
          gracePeriodDays: 14,
        },
      });
    });

    // -----------------------------------------------------------------------
    // Additional valid transitions (completeness)
    // -----------------------------------------------------------------------
    it('READ_ONLY → WARNING → 200 (partial payment / admin override)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'READ_ONLY' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Partial payment received, downgrading enforcement',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('READ_ONLY');
      expect(body.data.newAction).toBe('WARNING');
    });

    it('READ_ONLY → NONE → 200 (full payment)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'READ_ONLY' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'NONE',
          reason: 'Full payment received',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('READ_ONLY');
      expect(body.data.newAction).toBe('NONE');
    });

    // -----------------------------------------------------------------------
    // Invalid reverse transition
    // -----------------------------------------------------------------------
    it('SUSPENDED → WARNING (invalid) → 422', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'SUSPENDED',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'SUSPENDED' }),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Trying partial reactivation',
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_ENFORCEMENT_TRANSITION');
    });
  });
});
