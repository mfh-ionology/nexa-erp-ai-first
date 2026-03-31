import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockEventBus } = vi.hoisted(() => ({
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    drain: vi.fn(),
  },
  mockPrisma: {
    user: { findUnique: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    financialPeriod: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    bankAccount: {
      findMany: vi.fn(),
    },
    bankReconciliation: {
      findFirst: vi.fn(),
    },
    journalEntry: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockResolveUserRole: vi.fn(),
  mockPermissionService: {
    getEffectivePermissions: vi.fn(),
    hasPermission: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateGroup: vi.fn(),
    invalidateAll: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn(),
    deriveEnabledModules: vi.fn(),
    getFieldVisibility: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  Prisma: {
    Decimal: class Decimal {
      private value: number;
      constructor(v: number | string) {
        this.value = typeof v === 'string' ? parseFloat(v) : v;
      }
      toNumber() {
        return this.value;
      }
      toString() {
        return String(this.value);
      }
    },
  },
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { monthEndRoutesPlugin } from './month-end.routes.js';
import { _resetMonthEndStates } from './month-end.service.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_PERIOD_ID = '22222222-2222-4000-a000-222222222222';

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTestJwt(overrides: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({
    tenantId: TEST_TENANT_ID,
    role: 'ADMIN',
    enabledModules: ['FINANCE'],
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(TEST_USER_ID)
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secretBytes);
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  registerErrorHandler(app);
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);

  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(monthEndRoutesPlugin, { prefix: '/finance' });

  await app.ready();
  return app;
}

function setupMocks() {
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });

  mockResolveUserRole.mockResolvedValue('ADMIN');

  mockPermissionService.getEffectivePermissions.mockImplementation(
    async (_prisma: unknown, _userId: string, _companyId: string, userRole: string) => {
      const hasAccess = ['ADMIN', 'MANAGER'].includes(userRole);
      const fullPerm = {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      };
      return {
        permissions: hasAccess
          ? {
              'finance.periods': fullPerm,
            }
          : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

/** Sample period matching the Prisma FinancialPeriod model shape */
function makeSamplePeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_PERIOD_ID,
    companyId: TEST_COMPANY_ID,
    name: 'January 2026',
    periodNumber: 1,
    fiscalYear: 2026,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
    status: 'OPEN',
    closedAt: null,
    closedBy: null,
    lockedAt: null,
    lockedBy: null,
    createdAt: new Date('2025-12-01T00:00:00Z'),
    updatedAt: new Date('2025-12-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;
let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
  _resetMonthEndStates();
  setupMocks();
});

afterEach(async () => {
  if (app) await app.close();
});

// ---------------------------------------------------------------------------
// POST /finance/month-end/start — AC-1: Initiate month-end close
// ---------------------------------------------------------------------------

describe('POST /finance/month-end/start', () => {
  it('initiates month-end close for an OPEN period and returns checklist', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.periodId).toBe(TEST_PERIOD_ID);
    expect(body.data.status).toBe('IN_PROGRESS');
    expect(body.data.steps).toHaveLength(6);
    expect(body.data.startedAt).toBeTruthy();
    expect(body.data.startedBy).toBeTruthy();
  });

  it('returns 404 for non-existent period', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 for a CLOSED period', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod({ status: 'CLOSED' }));

    const res = await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('PERIOD_NOT_OPEN');
  });

  it('returns 409 if month-end already started for period', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    // Start once
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Try to start again
    const res = await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('MONTH_END_ALREADY_STARTED');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/month-end/:periodId — AC-2: Checklist with completion status
// ---------------------------------------------------------------------------

describe('GET /finance/month-end/:periodId', () => {
  it('returns NOT_STARTED checklist when month-end has not been initiated', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());

    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('NOT_STARTED');
    expect(body.data.steps).toHaveLength(6);
    expect(body.data.steps.every((s: { completed: boolean }) => !s.completed)).toBe(true);
  });

  it('returns IN_PROGRESS checklist with auto-checked steps', async () => {
    app = await buildTestApp();
    const period = makeSamplePeriod();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(period);
    mockPrisma.bankAccount.findMany.mockResolvedValue([]); // No bank accounts
    mockPrisma.journalEntry.count.mockResolvedValue(0); // No draft journals

    // Start month-end first
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Get checklist
    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('IN_PROGRESS');

    // Auto-check: RECONCILE_BANKS should be true (no bank accounts)
    const bankStep = body.data.steps.find((s: { code: string }) => s.code === 'RECONCILE_BANKS');
    expect(bankStep.completed).toBe(true);

    // Auto-check: REVIEW_UNPOSTED should be true (0 draft journals)
    const unpostedStep = body.data.steps.find(
      (s: { code: string }) => s.code === 'REVIEW_UNPOSTED',
    );
    expect(unpostedStep.completed).toBe(true);
  });

  it('auto-check RECONCILE_BANKS is false when bank has no completed reconciliation', async () => {
    app = await buildTestApp();
    const period = makeSamplePeriod();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(period);

    // Has bank accounts but no reconciliation for them
    mockPrisma.bankAccount.findMany.mockResolvedValue([{ id: 'bank-1' }]);
    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(null);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    // Start month-end
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Get checklist
    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const bankStep = body.data.steps.find((s: { code: string }) => s.code === 'RECONCILE_BANKS');
    expect(bankStep.completed).toBe(false);
  });

  it('auto-check REVIEW_UNPOSTED is false when draft journals exist', async () => {
    app = await buildTestApp();
    const period = makeSamplePeriod();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(period);
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(3); // 3 draft journals

    // Start month-end
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const unpostedStep = body.data.steps.find(
      (s: { code: string }) => s.code === 'REVIEW_UNPOSTED',
    );
    expect(unpostedStep.completed).toBe(false);
  });

  it('returns 404 for non-existent period', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Checklist items verification
// ---------------------------------------------------------------------------

describe('Checklist items (AC-3)', () => {
  it('contains all 6 required checklist steps', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());

    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    const body = res.json();
    const codes = body.data.steps.map((s: { code: string }) => s.code);

    expect(codes).toContain('RECONCILE_BANKS');
    expect(codes).toContain('REVIEW_UNPOSTED');
    expect(codes).toContain('REVIEW_ACCRUALS');
    expect(codes).toContain('REVIEW_FIXED_ASSETS');
    expect(codes).toContain('REVIEW_VAT');
    expect(codes).toContain('CLOSE_PERIOD');
    expect(codes).toHaveLength(6);
  });

  it('auto-check flags are set correctly', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());

    const res = await app.inject({
      method: 'GET',
      url: `/finance/month-end/${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    const body = res.json();
    const stepMap = new Map(
      body.data.steps.map((s: { code: string; autoCheck: boolean }) => [s.code, s.autoCheck]),
    );

    expect(stepMap.get('RECONCILE_BANKS')).toBe(true);
    expect(stepMap.get('REVIEW_UNPOSTED')).toBe(true);
    expect(stepMap.get('REVIEW_ACCRUALS')).toBe(false);
    expect(stepMap.get('REVIEW_FIXED_ASSETS')).toBe(false);
    expect(stepMap.get('REVIEW_VAT')).toBe(false);
    expect(stepMap.get('CLOSE_PERIOD')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/month-end/:periodId/complete-step — AC-4: Mark step done
// ---------------------------------------------------------------------------

describe('POST /finance/month-end/:periodId/complete-step', () => {
  it('marks a manual step as complete', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    // Start month-end first
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Complete REVIEW_ACCRUALS
    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/complete-step`,
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { stepCode: 'REVIEW_ACCRUALS' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const accrualStep = body.data.steps.find((s: { code: string }) => s.code === 'REVIEW_ACCRUALS');
    expect(accrualStep.completed).toBe(true);
    expect(accrualStep.completedAt).toBeTruthy();
    expect(accrualStep.completedBy).toBeTruthy();
  });

  it('rejects completing an auto-check step', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    // Start month-end first
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Try to complete RECONCILE_BANKS (auto-check)
    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/complete-step`,
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { stepCode: 'RECONCILE_BANKS' },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('STEP_AUTO_CHECKED');
  });

  it('returns 400 when month-end has not been started', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());

    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/complete-step`,
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { stepCode: 'REVIEW_ACCRUALS' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('MONTH_END_NOT_STARTED');
  });

  it('returns 404 for non-existent period', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/complete-step`,
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { stepCode: 'REVIEW_ACCRUALS' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/complete-step`,
      payload: { stepCode: 'REVIEW_ACCRUALS' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/month-end/:periodId/close — AC-5: Close period
// ---------------------------------------------------------------------------

describe('POST /finance/month-end/:periodId/close', () => {
  it('closes the period when all steps are complete', async () => {
    app = await buildTestApp();
    const period = makeSamplePeriod();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(period);
    mockPrisma.bankAccount.findMany.mockResolvedValue([]); // Auto-pass
    mockPrisma.journalEntry.count.mockResolvedValue(0); // Auto-pass

    // closePeriod uses $transaction
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        financialPeriod: {
          findFirst: vi.fn().mockResolvedValue(period),
          update: vi.fn().mockResolvedValue({
            ...period,
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: TEST_USER_ID,
          }),
        },
      };
      return fn(tx);
    });

    // After close, findFirst returns the closed period
    const closedPeriod = {
      ...period,
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: TEST_USER_ID,
    };

    // Start month-end
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Complete all manual steps
    for (const step of ['REVIEW_ACCRUALS', 'REVIEW_FIXED_ASSETS', 'REVIEW_VAT']) {
      await app.inject({
        method: 'POST',
        url: `/finance/month-end/${TEST_PERIOD_ID}/complete-step`,
        headers: { authorization: `Bearer ${testJwt}` },
        payload: { stepCode: step },
      });
    }

    // Now return the closed period for the final findFirst after closing
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(closedPeriod);

    // Close
    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('COMPLETED');
    expect(body.data.completedAt).toBeTruthy();
    expect(body.data.completedBy).toBeTruthy();

    // Verify CLOSE_PERIOD step is marked complete
    const closeStep = body.data.steps.find((s: { code: string }) => s.code === 'CLOSE_PERIOD');
    expect(closeStep.completed).toBe(true);
  });

  it('returns 409 when not all steps are complete', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    // Start month-end
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Don't complete any manual steps — try to close immediately
    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('STEPS_INCOMPLETE');
  });

  it('returns 409 when auto-check step fails (draft journals exist)', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());
    mockPrisma.bankAccount.findMany.mockResolvedValue([]); // Auto-pass banks
    mockPrisma.journalEntry.count.mockResolvedValue(5); // Draft journals exist!

    // Start month-end
    await app.inject({
      method: 'POST',
      url: '/finance/month-end/start',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Complete all manual steps
    for (const step of ['REVIEW_ACCRUALS', 'REVIEW_FIXED_ASSETS', 'REVIEW_VAT']) {
      await app.inject({
        method: 'POST',
        url: `/finance/month-end/${TEST_PERIOD_ID}/complete-step`,
        headers: { authorization: `Bearer ${testJwt}` },
        payload: { stepCode: step },
      });
    }

    // Try to close — REVIEW_UNPOSTED auto-check fails
    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('STEPS_INCOMPLETE');
    expect(body.error.message).toContain('Review and post/delete draft journals');
  });

  it('returns 400 when month-end has not been started', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(makeSamplePeriod());

    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('MONTH_END_NOT_STARTED');
  });

  it('returns 404 for non-existent period', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/close`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/month-end/${TEST_PERIOD_ID}/close`,
    });

    expect(res.statusCode).toBe(401);
  });
});
