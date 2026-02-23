// ---------------------------------------------------------------------------
// Plans & Billing Integration Tests — E3b.5 Task 6
// Cross-cutting flows: plan lifecycle, billing enforcement escalation,
// plan change + entitlements, idempotency, audit trail verification.
// Source: AC #1-#6, BR-PLT-004, BR-PLT-005, BR-PLT-006, BR-PLT-017
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const TEST_SERVICE_TOKEN = 'test-internal-service-token-for-erp';
const ADMIN_USER_ID = '00000000-0000-4000-b000-000000000020';
const TENANT_ID = '00000000-0000-4000-b000-000000000100';
const PLAN_ID_STARTER = '00000000-0000-4000-b000-000000000200';
const PLAN_ID_PROFESSIONAL = '00000000-0000-4000-b000-000000000201';

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

const mockTenantFindMany = vi.fn();
const mockTenantFindUnique = vi.fn();
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();
const mockTenantCount = vi.fn();
const mockPlanFindMany = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
const mockPlanCreate = vi.fn();
const mockPlanUpdate = vi.fn();
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
      findMany: (...args: unknown[]) => mockPlanFindMany(...args),
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockPlanFindUniqueOrThrow(...args),
      create: (...args: unknown[]) => mockPlanCreate(...args),
      update: (...args: unknown[]) => mockPlanUpdate(...args),
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
      findMany: (...args: unknown[]) => mockModuleOverrideFindMany(...args),
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

const STARTER_PLAN = {
  id: PLAN_ID_STARTER,
  code: 'starter',
  displayName: 'Starter Plan',
  maxUsers: 10,
  maxCompanies: 3,
  monthlyAiTokenAllowance: BigInt(1_000_000),
  aiHardLimit: true,
  enabledModules: ['system', 'finance', 'sales'],
  apiRateLimit: 1000,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const PROFESSIONAL_PLAN = {
  id: PLAN_ID_PROFESSIONAL,
  code: 'professional',
  displayName: 'Professional Plan',
  maxUsers: 50,
  maxCompanies: 10,
  monthlyAiTokenAllowance: BigInt(5_000_000),
  aiHardLimit: true,
  enabledModules: ['system', 'finance', 'ar', 'ap', 'sales', 'crm', 'inventory'],
  apiRateLimit: 5000,
  isActive: true,
  createdAt: new Date('2026-01-15T00:00:00Z'),
  updatedAt: new Date('2026-01-15T00:00:00Z'),
};

function makeTenantWithPlan(planId: string = PLAN_ID_STARTER, overrides: Record<string, unknown> = {}) {
  const plan = planId === PLAN_ID_STARTER ? STARTER_PLAN : PROFESSIONAL_PLAN;
  return {
    id: TENANT_ID,
    code: 'acme-corp',
    displayName: 'Acme Corp',
    legalName: 'Acme Corporation Ltd',
    status: 'ACTIVE',
    billingStatus: 'CURRENT',
    planId,
    region: 'uk-south',
    dbHost: 'db-1.internal',
    dbName: 'tenant_acme',
    dbPort: 5432,
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    plan: { id: plan.id, code: plan.code, displayName: plan.displayName, maxUsers: plan.maxUsers, maxCompanies: plan.maxCompanies, monthlyAiTokenAllowance: plan.monthlyAiTokenAllowance, apiRateLimit: plan.apiRateLimit, enabledModules: plan.enabledModules, isActive: true },
    ...overrides,
  };
}

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
  process.env.PLATFORM_SERVICE_TOKEN = TEST_SERVICE_TOKEN;
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Default mocks
  mockCreateAuditLog.mockResolvedValue({ id: 'audit-1' });
  mockTenantCount.mockResolvedValue(0);
  mockPlanFindUniqueOrThrow.mockResolvedValue(STARTER_PLAN);
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
// Helper: service token header for /platform/* endpoints
// ---------------------------------------------------------------------------

function serviceAuthHeader() {
  return { authorization: `Bearer ${TEST_SERVICE_TOKEN}` };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plans & Billing Integration (E3b.5 Task 6)', () => {
  // =========================================================================
  // Plan Lifecycle: Create plan → assign to tenant → verify → change plan
  // =========================================================================
  describe('Plan lifecycle flow', () => {
    it('creates a plan, assigns it to a tenant, verifies webhook pushed, then changes plan', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // ---------------------------------------------------------------
      // Step 1: Create a plan
      // ---------------------------------------------------------------
      mockPlanCreate.mockResolvedValueOnce(PROFESSIONAL_PLAN);

      const createPlanRes = await app.inject({
        method: 'POST',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'professional',
          displayName: 'Professional Plan',
          maxUsers: 50,
          maxCompanies: 10,
          monthlyAiTokenAllowance: 5_000_000,
          enabledModules: ['system', 'finance', 'ar', 'ap', 'sales', 'crm', 'inventory'],
          apiRateLimit: 5000,
        },
      });

      expect(createPlanRes.statusCode).toBe(201);
      const planBody = createPlanRes.json<SuccessResponse<Record<string, unknown>>>();
      expect(planBody.success).toBe(true);
      expect(planBody.data.code).toBe('professional');

      // Verify audit log for plan creation
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'plan.created',
            targetType: 'plan',
            targetId: PLAN_ID_PROFESSIONAL,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );

      // ---------------------------------------------------------------
      // Step 2: Assign the new plan to a tenant
      // ---------------------------------------------------------------
      vi.clearAllMocks();
      mockCreateAuditLog.mockResolvedValue({ id: 'audit-2' });

      const tenantOnStarter = makeTenantWithPlan(PLAN_ID_STARTER);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnStarter);
      mockPlanFindUnique.mockResolvedValueOnce(PROFESSIONAL_PLAN);
      mockTenantUpdate.mockResolvedValue({ ...tenantOnStarter, planId: PLAN_ID_PROFESSIONAL });

      const assignPlanRes = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_PROFESSIONAL, reason: 'Upgrade to professional' },
      });

      expect(assignPlanRes.statusCode).toBe(200);
      const assignBody = assignPlanRes.json<SuccessResponse<Record<string, unknown>>>();
      expect(assignBody.data.oldPlanCode).toBe('starter');
      expect(assignBody.data.newPlanCode).toBe('professional');
      expect(assignBody.data.changedAt).toBeDefined();

      // Verify limits are returned
      expect(assignBody.data.oldPlanLimits).toMatchObject({ maxUsers: 10, maxCompanies: 3 });
      expect(assignBody.data.newPlanLimits).toMatchObject({ maxUsers: 50, maxCompanies: 10 });

      // Verify webhook pushed (BR-PLT-006)
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.plan_changed',
        expect.objectContaining({
          tenantId: TENANT_ID,
          oldPlanCode: 'starter',
          newPlanCode: 'professional',
          changedBy: ADMIN_USER_ID,
          enabledModules: PROFESSIONAL_PLAN.enabledModules,
        }),
      );

      // Verify audit log for plan assignment
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
              reason: 'Upgrade to professional',
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        }),
      );

      // ---------------------------------------------------------------
      // Step 3: Change plan again (back to starter — downgrade)
      // ---------------------------------------------------------------
      vi.clearAllMocks();
      mockCreateAuditLog.mockResolvedValue({ id: 'audit-3' });

      const tenantOnPro = makeTenantWithPlan(PLAN_ID_PROFESSIONAL);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnPro);
      mockPlanFindUnique.mockResolvedValueOnce(STARTER_PLAN);
      mockTenantUpdate.mockResolvedValue({ ...tenantOnPro, planId: PLAN_ID_STARTER });

      const downgradePlanRes = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_STARTER, reason: 'Downgrade to starter' },
      });

      expect(downgradePlanRes.statusCode).toBe(200);
      const downgradeBody = downgradePlanRes.json<SuccessResponse<Record<string, unknown>>>();
      expect(downgradeBody.data.oldPlanCode).toBe('professional');
      expect(downgradeBody.data.newPlanCode).toBe('starter');

      // Verify webhook pushed for downgrade too
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.plan_changed',
        expect.objectContaining({
          oldPlanCode: 'professional',
          newPlanCode: 'starter',
          enabledModules: STARTER_PLAN.enabledModules,
        }),
      );
    });
  });

  // =========================================================================
  // Billing enforcement escalation: NONE → WARNING → READ_ONLY → SUSPENDED
  // =========================================================================
  describe('Billing enforcement escalation flow (BR-PLT-004)', () => {
    it('progresses through NONE → WARNING → READ_ONLY → SUSPENDED in sequence', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // ---------------------------------------------------------------
      // Step 1: NONE → WARNING
      // ---------------------------------------------------------------
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );
      mockTenantBillingUpdate.mockResolvedValue(
        makeBillingRecord({ enforcementAction: 'WARNING' }),
      );
      mockTenantUpdate.mockResolvedValue({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
        billingStatus: 'GRACE',
      });

      const step1Res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Payment overdue 7 days',
        },
      });

      expect(step1Res.statusCode).toBe(200);
      const step1Body = step1Res.json<SuccessResponse<Record<string, unknown>>>();
      expect(step1Body.data.previousAction).toBe('NONE');
      expect(step1Body.data.newAction).toBe('WARNING');

      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'billing.enforcement_changed',
        expect.objectContaining({
          tenantId: TENANT_ID,
          oldAction: 'NONE',
          newAction: 'WARNING',
        }),
      );

      // ---------------------------------------------------------------
      // Step 2: WARNING → READ_ONLY
      // ---------------------------------------------------------------
      vi.clearAllMocks();
      mockCreateAuditLog.mockResolvedValue({ id: 'audit-step2' });

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'WARNING' }),
      );
      mockTenantBillingUpdate.mockResolvedValue(
        makeBillingRecord({ enforcementAction: 'READ_ONLY' }),
      );
      mockTenantUpdate.mockResolvedValue({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
        billingStatus: 'OVERDUE',
      });

      const step2Res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'READ_ONLY',
          reason: 'Grace period expired',
        },
      });

      expect(step2Res.statusCode).toBe(200);
      const step2Body = step2Res.json<SuccessResponse<Record<string, unknown>>>();
      expect(step2Body.data.previousAction).toBe('WARNING');
      expect(step2Body.data.newAction).toBe('READ_ONLY');

      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'billing.enforcement_changed',
        expect.objectContaining({
          oldAction: 'WARNING',
          newAction: 'READ_ONLY',
        }),
      );

      // ---------------------------------------------------------------
      // Step 3: READ_ONLY → SUSPENDED
      // ---------------------------------------------------------------
      vi.clearAllMocks();
      mockCreateAuditLog.mockResolvedValue({ id: 'audit-step3' });

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'READ_ONLY' }),
      );
      mockTenantBillingUpdate.mockResolvedValue(
        makeBillingRecord({ enforcementAction: 'SUSPENDED' }),
      );
      mockTenantUpdate.mockResolvedValue({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'SUSPENDED',
        billingStatus: 'BLOCKED',
      });

      const step3Res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'SUSPENDED',
          reason: 'Continued non-payment — 60 days overdue',
        },
      });

      expect(step3Res.statusCode).toBe(200);
      const step3Body = step3Res.json<SuccessResponse<Record<string, unknown>>>();
      expect(step3Body.data.previousAction).toBe('READ_ONLY');
      expect(step3Body.data.newAction).toBe('SUSPENDED');

      // Verify tenant status changed to SUSPENDED
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
          reason: 'Continued non-payment — 60 days overdue',
          suspendedBy: ADMIN_USER_ID,
          enforcementAction: 'SUSPENDED',
        }),
      );
    });

    it('skip-level transition NONE → READ_ONLY is rejected at every step', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // NONE → READ_ONLY (skip WARNING)
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
          reason: 'Trying to skip',
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('INVALID_ENFORCEMENT_TRANSITION');

      // No webhook should be pushed
      expect(mockPushWebhook).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Plan change + entitlement verification
  // =========================================================================
  describe('Plan change + entitlement verification (BR-PLT-006)', () => {
    it('after plan assignment, entitlements endpoint reflects new modules and limits', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // ---------------------------------------------------------------
      // Step 1: Assign professional plan to tenant (currently on starter)
      // ---------------------------------------------------------------
      const tenantOnStarter = makeTenantWithPlan(PLAN_ID_STARTER);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnStarter);
      mockPlanFindUnique.mockResolvedValueOnce(PROFESSIONAL_PLAN);
      mockTenantUpdate.mockResolvedValue({ ...tenantOnStarter, planId: PLAN_ID_PROFESSIONAL });

      const assignRes = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_PROFESSIONAL },
      });

      expect(assignRes.statusCode).toBe(200);
      const assignBody = assignRes.json<SuccessResponse<Record<string, unknown>>>();
      expect(assignBody.data.oldPlanCode).toBe('starter');
      expect(assignBody.data.newPlanCode).toBe('professional');
      expect(assignBody.data.newPlanLimits).toMatchObject({
        maxUsers: 50,
        maxCompanies: 10,
      });

      // ---------------------------------------------------------------
      // Step 2: Verify entitlements endpoint returns new plan data
      // (simulating the ERP checking entitlements after cache invalidation)
      // ---------------------------------------------------------------
      const tenantOnPro = {
        id: TENANT_ID,
        code: 'acme-corp',
        displayName: 'Acme Corp',
        status: 'ACTIVE',
        planId: PLAN_ID_PROFESSIONAL,
        billingStatus: 'CURRENT',
        sandboxEnabled: false,
        plan: {
          id: PLAN_ID_PROFESSIONAL,
          code: 'professional',
          displayName: 'Professional Plan',
          maxUsers: 50,
          maxCompanies: 10,
          enabledModules: ['system', 'finance', 'ar', 'ap', 'sales', 'crm', 'inventory'],
          apiRateLimit: 5000,
          isActive: true,
        },
        billing: {
          id: 'billing-1',
          tenantId: TENANT_ID,
          enforcementAction: 'NONE',
        },
        moduleOverrides: [],
        featureFlags: [],
      };
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnPro);

      const entitlementRes = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      expect(entitlementRes.statusCode).toBe(200);
      const entBody = entitlementRes.json<SuccessResponse<Record<string, unknown>>>();
      expect(entBody.data.planCode).toBe('professional');
      expect(entBody.data.maxUsers).toBe(50);
      expect(entBody.data.maxCompanies).toBe(10);
      expect(entBody.data.enforcementAction).toBe('NONE');

      // Verify all professional plan modules are present
      const enabledModules = entBody.data.enabledModules as string[];
      expect(enabledModules).toContain('crm');
      expect(enabledModules).toContain('inventory');
      expect(enabledModules).toContain('ar');
      expect(enabledModules).toContain('ap');
    });

    it('enforcement changes are reflected in entitlements endpoint', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // ---------------------------------------------------------------
      // Step 1: Set enforcement to READ_ONLY (via valid transition NONE → WARNING first)
      // ---------------------------------------------------------------
      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );
      mockTenantBillingUpdate.mockResolvedValue(
        makeBillingRecord({ enforcementAction: 'WARNING' }),
      );
      mockTenantUpdate.mockResolvedValue({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
        billingStatus: 'GRACE',
      });

      const warningRes = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'Payment overdue',
        },
      });

      expect(warningRes.statusCode).toBe(200);

      // ---------------------------------------------------------------
      // Step 2: Verify entitlements endpoint shows WARNING enforcement
      // ---------------------------------------------------------------
      const tenantWithWarning = {
        id: TENANT_ID,
        code: 'acme-corp',
        displayName: 'Acme Corp',
        status: 'ACTIVE',
        planId: PLAN_ID_STARTER,
        billingStatus: 'GRACE',
        sandboxEnabled: false,
        plan: { ...STARTER_PLAN },
        billing: {
          id: 'billing-1',
          tenantId: TENANT_ID,
          enforcementAction: 'WARNING',
        },
        moduleOverrides: [],
        featureFlags: [],
      };
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithWarning);

      const entitlementRes = await app.inject({
        method: 'GET',
        url: `/platform/tenants/${TENANT_ID}/entitlements`,
        headers: serviceAuthHeader(),
      });

      expect(entitlementRes.statusCode).toBe(200);
      const entBody = entitlementRes.json<SuccessResponse<Record<string, unknown>>>();
      expect(entBody.data.enforcementAction).toBe('WARNING');
      expect(entBody.data.billingStatus).toBe('GRACE');
    });
  });

  // =========================================================================
  // Idempotency tests
  // =========================================================================
  describe('Idempotency', () => {
    it('assigning the same plan twice returns 200 without webhook or transaction', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const tenantOnStarter = makeTenantWithPlan(PLAN_ID_STARTER);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnStarter);
      mockPlanFindUnique.mockResolvedValueOnce({
        ...STARTER_PLAN,
        isActive: true,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_STARTER },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.oldPlanCode).toBe('starter');
      expect(body.data.newPlanCode).toBe('starter');

      // No webhook pushed for idempotent assignment
      expect(mockPushWebhook).not.toHaveBeenCalled();
    });

    it('setting enforcement to current level returns 200 without webhook or transaction', async () => {
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
          reason: 'Redundant warning',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('WARNING');
      expect(body.data.newAction).toBe('WARNING');

      // No webhook for idempotent enforcement
      expect(mockPushWebhook).not.toHaveBeenCalled();
    });

    it('double assign-plan returns consistent response both times', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // First assignment: starter → professional
      const tenantOnStarter = makeTenantWithPlan(PLAN_ID_STARTER);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnStarter);
      mockPlanFindUnique.mockResolvedValueOnce(PROFESSIONAL_PLAN);
      mockTenantUpdate.mockResolvedValue({ ...tenantOnStarter, planId: PLAN_ID_PROFESSIONAL });

      const res1 = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_PROFESSIONAL },
      });

      expect(res1.statusCode).toBe(200);
      const body1 = res1.json<SuccessResponse<Record<string, unknown>>>();
      expect(body1.data.newPlanCode).toBe('professional');

      // Second assignment: same plan again (now tenant is on professional)
      vi.clearAllMocks();
      mockCreateAuditLog.mockResolvedValue({ id: 'audit-idempotent' });

      const tenantOnPro = makeTenantWithPlan(PLAN_ID_PROFESSIONAL);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnPro);
      mockPlanFindUnique.mockResolvedValueOnce(PROFESSIONAL_PLAN);

      const res2 = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_PROFESSIONAL },
      });

      expect(res2.statusCode).toBe(200);
      const body2 = res2.json<SuccessResponse<Record<string, unknown>>>();
      expect(body2.data.oldPlanCode).toBe('professional');
      expect(body2.data.newPlanCode).toBe('professional');

      // No webhook on the second (idempotent) call
      expect(mockPushWebhook).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Audit trail verification
  // =========================================================================
  describe('Audit trail verification (BR-PLT-017)', () => {
    it('plan CRUD operations create audit log entries', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // Create plan
      mockPlanCreate.mockResolvedValueOnce(STARTER_PLAN);

      await app.inject({
        method: 'POST',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'starter',
          displayName: 'Starter Plan',
          maxUsers: 10,
          maxCompanies: 3,
          monthlyAiTokenAllowance: 1_000_000,
          enabledModules: ['system', 'finance', 'sales'],
        },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'plan.created',
            targetType: 'plan',
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );

      // Update plan
      vi.clearAllMocks();
      mockCreateAuditLog.mockResolvedValue({ id: 'audit-update' });
      mockPlanFindUnique.mockResolvedValueOnce({ id: PLAN_ID_STARTER });
      mockPlanUpdate.mockResolvedValueOnce({ ...STARTER_PLAN, maxUsers: 20 });

      await app.inject({
        method: 'PATCH',
        url: `/admin/plans/${PLAN_ID_STARTER}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { maxUsers: 20 },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'plan.updated',
            targetType: 'plan',
            targetId: PLAN_ID_STARTER,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('plan assignment creates audit log with old/new plan details', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const tenantOnStarter = makeTenantWithPlan(PLAN_ID_STARTER);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnStarter);
      mockPlanFindUnique.mockResolvedValueOnce(PROFESSIONAL_PLAN);
      mockTenantUpdate.mockResolvedValue({ ...tenantOnStarter, planId: PLAN_ID_PROFESSIONAL });

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_PROFESSIONAL, reason: 'Customer upgrade' },
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
              reason: 'Customer upgrade',
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('enforcement transitions create audit log entries', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );

      await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'WARNING',
          reason: 'First dunning notice',
        },
      });

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

    it('audit log failure does not break plan creation (BR-PLT-017)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockPlanCreate.mockResolvedValueOnce(STARTER_PLAN);
      mockCreateAuditLog.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await app.inject({
        method: 'POST',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'starter',
          displayName: 'Starter Plan',
          maxUsers: 10,
          maxCompanies: 3,
          monthlyAiTokenAllowance: 1_000_000,
          enabledModules: ['system'],
        },
      });

      // Plan creation still succeeds despite audit failure
      expect(res.statusCode).toBe(201);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
    });

    it('audit log failure does not break plan assignment (BR-PLT-017)', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const tenantOnStarter = makeTenantWithPlan(PLAN_ID_STARTER);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnStarter);
      mockPlanFindUnique.mockResolvedValueOnce(PROFESSIONAL_PLAN);
      mockTenantUpdate.mockResolvedValue({ ...tenantOnStarter, planId: PLAN_ID_PROFESSIONAL });
      mockCreateAuditLog.mockRejectedValue(new Error('DB connection lost'));

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_PROFESSIONAL },
      });

      // Plan assignment still succeeds
      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.newPlanCode).toBe('professional');
    });

    it('no audit log created for idempotent operations', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // Idempotent plan assignment
      const tenantOnStarter = makeTenantWithPlan(PLAN_ID_STARTER);
      mockTenantFindUnique.mockResolvedValueOnce(tenantOnStarter);
      mockPlanFindUnique.mockResolvedValueOnce({
        ...STARTER_PLAN,
        isActive: true,
      });

      await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_STARTER },
      });

      // No audit log for idempotent assignment
      expect(mockCreateAuditLog).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'tenant.plan_changed',
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  // =========================================================================
  // SUSPENDED → NONE reactivation flow
  // =========================================================================
  describe('Reactivation flow (SUSPENDED → NONE)', () => {
    it('SUSPENDED → NONE reactivates tenant and pushes both webhooks', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      mockTenantFindUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'SUSPENDED',
      });
      mockTenantBillingFindUnique.mockResolvedValueOnce(
        makeBillingRecord({ enforcementAction: 'SUSPENDED' }),
      );
      mockTenantBillingUpdate.mockResolvedValue(
        makeBillingRecord({ enforcementAction: 'NONE' }),
      );
      mockTenantUpdate.mockResolvedValue({
        id: TENANT_ID,
        code: 'acme-corp',
        status: 'ACTIVE',
        billingStatus: 'CURRENT',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/tenants/${TENANT_ID}/billing/enforcement`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          enforcementAction: 'NONE',
          reason: 'Full payment received — reactivating account',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.previousAction).toBe('SUSPENDED');
      expect(body.data.newAction).toBe('NONE');

      // Verify tenant status set to ACTIVE
      expect(mockTenantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            billingStatus: 'CURRENT',
          }) as Record<string, unknown>,
        }),
      );

      // Verify two webhooks
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

      // Verify audit log
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'billing.enforcement_changed',
            targetType: 'tenant',
            targetId: TENANT_ID,
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  // =========================================================================
  // Combined plan + billing flow
  // =========================================================================
  describe('Combined plan assignment and billing enforcement', () => {
    it('plan change on a tenant with active enforcement still works', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      // Tenant is on starter with WARNING enforcement
      const tenantWithWarning = makeTenantWithPlan(PLAN_ID_STARTER, {
        billingStatus: 'GRACE',
      });
      mockTenantFindUnique.mockResolvedValueOnce(tenantWithWarning);
      mockPlanFindUnique.mockResolvedValueOnce(PROFESSIONAL_PLAN);
      mockTenantUpdate.mockResolvedValue({ ...tenantWithWarning, planId: PLAN_ID_PROFESSIONAL });

      const res = await app.inject({
        method: 'POST',
        url: `/admin/tenants/${TENANT_ID}/assign-plan`,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: PLAN_ID_PROFESSIONAL, reason: 'Upgrade despite billing warning' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.data.newPlanCode).toBe('professional');

      // Webhook still pushed
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.plan_changed',
        expect.objectContaining({
          oldPlanCode: 'starter',
          newPlanCode: 'professional',
        }),
      );
    });
  });
});
