import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-platform-secret-that-is-at-least-32-chars!!';
const ADMIN_USER_ID = '00000000-0000-4000-b000-000000000020';
const VIEWER_USER_ID = '00000000-0000-4000-b000-000000000021';
const PLAN_ID = '00000000-0000-4000-b000-000000000200';

// ---------------------------------------------------------------------------
// Mock getPlatformPrisma
// ---------------------------------------------------------------------------

const mockPlanFindMany = vi.fn();
const mockPlanFindUnique = vi.fn();
const mockPlanCreate = vi.fn();
const mockPlanUpdate = vi.fn();
const mockCreateAuditLog = vi.fn();

// Tenant mocks (required by tenant routes import graph)
const mockTenantFindMany = vi.fn();
const mockTenantFindUnique = vi.fn();
const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();
const mockTenantCount = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
const mockTenantBillingCreate = vi.fn();
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
// Mock webhook service
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

function makePlanRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
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
  mockPlanFindUniqueOrThrow.mockResolvedValue(makePlanRecord());
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

describe('Plan CRUD Routes (E3b.5 Task 1)', () => {
  // =========================================================================
  // POST /admin/plans — create plan
  // =========================================================================
  describe('POST /admin/plans', () => {
    it('creates a plan with valid data and returns 201', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const createdPlan = makePlanRecord();
      mockPlanCreate.mockResolvedValueOnce(createdPlan);

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
          enabledModules: ['system', 'finance', 'sales'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: PLAN_ID,
        code: 'starter',
        displayName: 'Starter Plan',
        maxUsers: 10,
        maxCompanies: 3,
        monthlyAiTokenAllowance: '1000000',
        aiHardLimit: true,
        apiRateLimit: 1000,
        isActive: true,
      });
    });

    it('duplicate code returns 409 CONFLICT', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const prismaError = new Error('Unique constraint failed');
      Object.assign(prismaError, { code: 'P2002' });
      mockPlanCreate.mockRejectedValueOnce(prismaError);

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

      expect(res.statusCode).toBe(409);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('CONFLICT');
    });

    it('creates audit log on plan creation', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPlanCreate.mockResolvedValueOnce(makePlanRecord());

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
          enabledModules: ['system'],
        },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'plan.created',
            targetType: 'plan',
            targetId: PLAN_ID,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('PLATFORM_VIEWER cannot create plans → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'viewer-plan',
          displayName: 'Viewer Plan',
          maxUsers: 5,
          maxCompanies: 1,
          monthlyAiTokenAllowance: 500_000,
          enabledModules: ['system'],
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 for invalid code format', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'INVALID CODE',
          displayName: 'Bad Code',
          maxUsers: 10,
          maxCompanies: 3,
          monthlyAiTokenAllowance: 1_000_000,
          enabledModules: ['system'],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for missing required fields', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'test',
          // missing displayName, maxUsers, maxCompanies, etc.
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /admin/plans — list plans
  // =========================================================================
  describe('GET /admin/plans', () => {
    it('returns all plans as array with 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      const plans = [
        makePlanRecord(),
        makePlanRecord({ id: '00000000-0000-4000-b000-000000000201', code: 'pro' }),
      ];
      mockPlanFindMany.mockResolvedValueOnce(plans);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<unknown[]>>();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it('filters by active=true', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPlanFindMany.mockResolvedValueOnce([makePlanRecord()]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/plans?active=true',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPlanFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }) as Record<string, unknown>,
        }),
      );
    });

    it('filters by active=false', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPlanFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/plans?active=false',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPlanFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }) as Record<string, unknown>,
        }),
      );
    });

    it('returns all plans when no active filter', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPlanFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPlanFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('PLATFORM_VIEWER can list plans → 200', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');
      mockPlanFindMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/plans',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('no auth returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/plans',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // PATCH /admin/plans/:id — update plan
  // =========================================================================
  describe('PATCH /admin/plans/:id', () => {
    it('updates plan fields and returns 200', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPlanFindUnique.mockResolvedValueOnce({ id: PLAN_ID });
      const updatedPlan = makePlanRecord({ displayName: 'Starter Plan Updated', maxUsers: 20 });
      mockPlanUpdate.mockResolvedValueOnce(updatedPlan);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/plans/${PLAN_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Starter Plan Updated', maxUsers: 20 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<SuccessResponse<Record<string, unknown>>>();
      expect(body.success).toBe(true);
      expect(body.data.displayName).toBe('Starter Plan Updated');
      expect(body.data.maxUsers).toBe(20);
    });

    it('non-existent plan returns 404', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPlanFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/plans/${PLAN_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Updated' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('PLAN_NOT_FOUND');
    });

    it('returns 400 when empty body provided', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/plans/${PLAN_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('creates audit log on plan update', async () => {
      const token = await generateTestJwt(ADMIN_USER_ID, 'PLATFORM_ADMIN');
      mockPlanFindUnique.mockResolvedValueOnce({ id: PLAN_ID });
      mockPlanUpdate.mockResolvedValueOnce(makePlanRecord({ maxUsers: 50 }));

      await app.inject({
        method: 'PATCH',
        url: `/admin/plans/${PLAN_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { maxUsers: 50 },
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'plan.updated',
            targetType: 'plan',
            targetId: PLAN_ID,
            platformUserId: ADMIN_USER_ID,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('PLATFORM_VIEWER cannot update plans → 403', async () => {
      const token = await generateTestJwt(VIEWER_USER_ID, 'PLATFORM_VIEWER');

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/plans/${PLAN_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Updated' },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<ErrorResponse>();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });
});
