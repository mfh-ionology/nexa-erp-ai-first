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
      findMany: vi.fn(),
    },
    journalLine: {
      groupBy: vi.fn(),
    },
    chartOfAccount: {
      findMany: vi.fn(),
    },
    simulationLine: {
      groupBy: vi.fn(),
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
import { reportsRoutesPlugin } from './reports.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';

const PERIOD_ID_1 = 'aaaa0000-0000-4000-a000-000000000001';
const PERIOD_ID_2 = 'aaaa0000-0000-4000-a000-000000000002';
const PERIOD_ID_3 = 'aaaa0000-0000-4000-a000-000000000003';

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
  await app.register(reportsRoutesPlugin, { prefix: '/finance' });

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
              'finance.reports': fullPerm,
              'finance.accounts': fullPerm,
              'finance.journals': fullPerm,
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

/** Sample chart-of-account rows */
function makeSampleAccounts() {
  return [
    {
      code: '1000',
      name: 'Cash',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      openingBalance: 5000,
    },
    {
      code: '2000',
      name: 'Accounts Payable',
      accountType: 'LIABILITY',
      normalBalance: 'CREDIT',
      openingBalance: 2000,
    },
    {
      code: '3000',
      name: 'Share Capital',
      accountType: 'EQUITY',
      normalBalance: 'CREDIT',
      openingBalance: 3000,
    },
    {
      code: '4000',
      name: 'Sales Revenue',
      accountType: 'REVENUE',
      normalBalance: 'CREDIT',
      openingBalance: 0,
    },
    {
      code: '5000',
      name: 'Office Expenses',
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
      openingBalance: 0,
    },
  ];
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
  setupMocks();
});

afterEach(async () => {
  if (app) await app.close();
});

// ---------------------------------------------------------------------------
// GET /finance/reports/trial-balance — AC-1: returns accounts with totals
// ---------------------------------------------------------------------------

describe('GET /finance/reports/trial-balance', () => {
  it('returns trial balance with accounts and totals for a period range (AC-1, AC-2)', async () => {
    app = await buildTestApp();

    // Periods for fiscal year 2026, periods 1-3
    mockPrisma.financialPeriod.findMany.mockResolvedValue([
      { id: PERIOD_ID_1 },
      { id: PERIOD_ID_2 },
      { id: PERIOD_ID_3 },
    ]);

    // Aggregated journal lines — balanced debits and credits
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '1000', _sum: { debit: 1000, credit: 200 } },
      { accountCode: '4000', _sum: { debit: 0, credit: 800 } },
      { accountCode: '5000', _sum: { debit: 200, credit: 0 } },
      { accountCode: '2000', _sum: { debit: 0, credit: 200 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makeSampleAccounts());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=3',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.fiscalYear).toBe(2026);
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(3);

    // Should include accounts with activity or opening balance
    expect(body.data.accounts.length).toBeGreaterThan(0);

    // Cash account: opening 5000, debit 1000, credit 200
    // closingBalance for DEBIT = 5000 + 1000 - 200 = 5800
    const cashAccount = body.data.accounts.find(
      (a: { accountCode: string }) => a.accountCode === '1000',
    );
    expect(cashAccount).toBeDefined();
    expect(cashAccount.accountName).toBe('Cash');
    expect(cashAccount.openingBalance).toBe(5000);
    expect(cashAccount.totalDebit).toBe(1000);
    expect(cashAccount.totalCredit).toBe(200);
    expect(cashAccount.closingBalance).toBe(5800);

    // Revenue account: opening 0, debit 0, credit 800
    // closingBalance for CREDIT = 0 + 800 - 0 = 800
    const revenueAccount = body.data.accounts.find(
      (a: { accountCode: string }) => a.accountCode === '4000',
    );
    expect(revenueAccount).toBeDefined();
    expect(revenueAccount.closingBalance).toBe(800);

    // Totals
    expect(body.data.totals.totalDebit).toBe(1200);
    expect(body.data.totals.totalCredit).toBe(1200);
    expect(body.data.totals.isBalanced).toBe(true);
  });

  it('uses default periodFrom=1 and periodTo=12 when not specified (AC-2)', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(12);

    // Verify periods were queried with correct range
    expect(mockPrisma.financialPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          fiscalYear: 2026,
          periodNumber: { gte: 1, lte: 12 },
        }),
      }),
    );
  });

  it('respects normal balance direction for closing balance (AC-3)', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    // Accounts Payable (CREDIT normal): opening 2000, credit 500, debit 100
    // closingBalance = 2000 + 500 - 100 = 2400
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '2000', _sum: { debit: 100, credit: 500 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '2000',
        name: 'Accounts Payable',
        accountType: 'LIABILITY',
        normalBalance: 'CREDIT',
        openingBalance: 2000,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const apAccount = body.data.accounts[0];
    expect(apAccount.accountCode).toBe('2000');
    expect(apAccount.closingBalance).toBe(2400);
  });

  it('only includes POSTED journal entries (AC-4)', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makeSampleAccounts());

    await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    // Verify the groupBy was called with status: 'POSTED'
    expect(mockPrisma.journalLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({
            status: 'POSTED',
          }),
        }),
      }),
    );
  });

  it('includes opening balance from ChartOfAccount (AC-5)', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]); // No posted entries

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: 10000,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Account with opening balance but no activity should still appear
    expect(body.data.accounts).toHaveLength(1);
    expect(body.data.accounts[0].openingBalance).toBe(10000);
    expect(body.data.accounts[0].totalDebit).toBe(0);
    expect(body.data.accounts[0].totalCredit).toBe(0);
    // Closing = opening for DEBIT account with no activity
    expect(body.data.accounts[0].closingBalance).toBe(10000);
  });

  it('reports isBalanced=true when debits equal credits (AC-6)', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    // Balanced entries: debit 500 to expense, credit 500 to cash
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '5000', _sum: { debit: 500, credit: 0 } },
      { accountCode: '1000', _sum: { debit: 0, credit: 500 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makeSampleAccounts());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.totals.totalDebit).toBe(500);
    expect(body.data.totals.totalCredit).toBe(500);
    expect(body.data.totals.isBalanced).toBe(true);
  });

  it('excludes accounts with zero opening balance and no activity', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '1000', _sum: { debit: 100, credit: 0 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: 5000,
      },
      {
        code: '9000',
        name: 'Unused Account',
        accountType: 'EXPENSE',
        normalBalance: 'DEBIT',
        openingBalance: 0,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Only Cash should appear; Unused Account has zero opening and no activity
    expect(body.data.accounts).toHaveLength(1);
    expect(body.data.accounts[0].accountCode).toBe('1000');
  });

  it('returns empty accounts array when no periods match', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    // groupBy should NOT be called since there are no periodIds
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '9000',
        name: 'Unused',
        accountType: 'EXPENSE',
        normalBalance: 'DEBIT',
        openingBalance: 0,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2025&periodFrom=1&periodTo=12',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.accounts).toHaveLength(0);
    expect(body.data.totals.isBalanced).toBe(true);
  });

  it('requires fiscalYear query parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('validates periodFrom/periodTo range (rejects period > 13)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=14',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for VIEWER role without finance.reports permission', async () => {
    app = await buildTestApp();
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('handles Decimal values from Prisma correctly', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    // Simulate Prisma Decimal objects (they have toString and toNumber)
    const decimalLike = (val: number) => ({
      toString: () => val.toString(),
      toNumber: () => val,
      valueOf: () => val,
      [Symbol.toPrimitive]: () => val,
    });

    mockPrisma.journalLine.groupBy.mockResolvedValue([
      {
        accountCode: '1000',
        _sum: { debit: decimalLike(1500.5), credit: decimalLike(250.25) },
      },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: decimalLike(10000),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cashAccount = body.data.accounts[0];
    expect(cashAccount.openingBalance).toBe(10000);
    expect(cashAccount.totalDebit).toBe(1500.5);
    expect(cashAccount.totalCredit).toBe(250.25);
    // closingBalance = 10000 + 1500.5 - 250.25 = 11250.25
    expect(cashAccount.closingBalance).toBe(11250.25);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/reports/trial-balance — dimension filtering
// ---------------------------------------------------------------------------

describe('GET /finance/reports/trial-balance -- dimension filtering', () => {
  it('passes dimensionValueId through to journalLine.groupBy where clause', async () => {
    app = await buildTestApp();

    const dimValueId = 'dddd0000-0000-4000-a000-000000000010';

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/finance/reports/trial-balance?fiscalYear=2026&dimensionValueId=${dimValueId}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dimensions: { some: { dimensionValueId: dimValueId } },
        }),
      }),
    );
  });

  it('returns filtered results when dimensionValueId is provided', async () => {
    app = await buildTestApp();

    const dimValueId = 'dddd0000-0000-4000-a000-000000000010';

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    // Only return filtered lines
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '1000', _sum: { debit: 300, credit: 0 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makeSampleAccounts());

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/trial-balance?fiscalYear=2026&dimensionValueId=${dimValueId}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should still produce valid results with filtered data
    const cashAccount = body.data.accounts.find(
      (a: { accountCode: string }) => a.accountCode === '1000',
    );
    expect(cashAccount).toBeDefined();
    expect(cashAccount.totalDebit).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/reports/trial-balance — simulation inclusion
// ---------------------------------------------------------------------------

describe('GET /finance/reports/trial-balance -- simulation inclusion', () => {
  it('merges simulation line aggregations when includeSimulations=true', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    // Journal lines: Cash has 500 debit
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '1000', _sum: { debit: 500, credit: 0 } },
    ]);

    // Simulation lines: Cash has additional 200 debit
    mockPrisma.simulationLine.groupBy.mockResolvedValue([
      { accountCode: '1000', _sum: { debit: 200, credit: 0 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: 5000,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance?fiscalYear=2026&includeSimulations=true',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cashAccount = body.data.accounts[0];
    // 500 (journal) + 200 (simulation) = 700
    expect(cashAccount.totalDebit).toBe(700);
    // closingBalance = 5000 + 700 - 0 = 5700
    expect(cashAccount.closingBalance).toBe(5700);

    // Verify simulationLine.groupBy was called
    expect(mockPrisma.simulationLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          simulation: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      }),
    );
  });
});
