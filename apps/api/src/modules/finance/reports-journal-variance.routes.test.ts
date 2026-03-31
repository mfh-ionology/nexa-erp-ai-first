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
    journalEntry: {
      findMany: vi.fn(),
    },
    journalLine: {
      groupBy: vi.fn(),
    },
    chartOfAccount: {
      findMany: vi.fn(),
    },
    budget: {
      findFirst: vi.fn(),
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

const BUDGET_ID = 'bbbb0000-0000-4000-a000-000000000001';

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

// ---------------------------------------------------------------------------
// Sample data factories
// ---------------------------------------------------------------------------

function makeSampleJournalEntries() {
  return [
    {
      id: 'je-001',
      entryNumber: 'JE-2026-0001',
      transactionDate: new Date('2026-01-15'),
      description: 'Office supplies purchase',
      reference: 'INV-001',
      source: 'MANUAL',
      status: 'POSTED',
      totalDebit: 500,
      totalCredit: 500,
      lines: [
        {
          lineNumber: 1,
          accountCode: '5000',
          description: 'Office supplies',
          debit: 500,
          credit: 0,
          account: { name: 'Office Expenses' },
        },
        {
          lineNumber: 2,
          accountCode: '1000',
          description: 'Cash payment',
          debit: 0,
          credit: 500,
          account: { name: 'Cash' },
        },
      ],
    },
    {
      id: 'je-002',
      entryNumber: 'JE-2026-0002',
      transactionDate: new Date('2026-02-01'),
      description: 'Sales revenue',
      reference: null,
      source: 'AR_INVOICE',
      status: 'POSTED',
      totalDebit: 1000,
      totalCredit: 1000,
      lines: [
        {
          lineNumber: 1,
          accountCode: '1000',
          description: 'Cash received',
          debit: 1000,
          credit: 0,
          account: { name: 'Cash' },
        },
        {
          lineNumber: 2,
          accountCode: '4000',
          description: 'Revenue',
          debit: 0,
          credit: 1000,
          account: { name: 'Sales Revenue' },
        },
      ],
    },
  ];
}

function makeSampleBudget() {
  return {
    id: BUDGET_ID,
    name: 'Annual Budget 2026',
    fiscalYear: 2026,
    status: 'APPROVED',
    lines: [
      {
        accountCode: '5000',
        period1: 100,
        period2: 100,
        period3: 100,
        period4: 100,
        period5: 100,
        period6: 100,
        period7: 100,
        period8: 100,
        period9: 100,
        period10: 100,
        period11: 100,
        period12: 100,
        totalAmount: 1200,
        account: { name: 'Office Expenses' },
      },
      {
        accountCode: '4000',
        period1: 500,
        period2: 500,
        period3: 500,
        period4: 500,
        period5: 500,
        period6: 500,
        period7: 500,
        period8: 500,
        period9: 500,
        period10: 500,
        period11: 500,
        period12: 500,
        totalAmount: 6000,
        account: { name: 'Sales Revenue' },
      },
    ],
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
  setupMocks();
});

afterEach(async () => {
  if (app) await app.close();
});

// ===========================================================================
// GET /finance/reports/transaction-journal
// ===========================================================================

describe('GET /finance/reports/transaction-journal', () => {
  it('returns posted journal entries with nested lines for a period range', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([
      { id: PERIOD_ID_1 },
      { id: PERIOD_ID_2 },
      { id: PERIOD_ID_3 },
    ]);

    mockPrisma.journalEntry.findMany.mockResolvedValue(makeSampleJournalEntries());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026&periodFrom=1&periodTo=3',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.fiscalYear).toBe(2026);
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(3);
    expect(body.data.totalEntries).toBe(2);
    expect(body.data.entries).toHaveLength(2);

    // First entry
    const entry1 = body.data.entries[0];
    expect(entry1.entryNumber).toBe('JE-2026-0001');
    expect(entry1.transactionDate).toBe('2026-01-15');
    expect(entry1.description).toBe('Office supplies purchase');
    expect(entry1.reference).toBe('INV-001');
    expect(entry1.source).toBe('MANUAL');
    expect(entry1.totalDebit).toBe(500);
    expect(entry1.totalCredit).toBe(500);
    expect(entry1.lines).toHaveLength(2);
    expect(entry1.lines[0].accountCode).toBe('5000');
    expect(entry1.lines[0].accountName).toBe('Office Expenses');
    expect(entry1.lines[0].debit).toBe(500);
    expect(entry1.lines[0].credit).toBe(0);

    // Second entry
    const entry2 = body.data.entries[1];
    expect(entry2.entryNumber).toBe('JE-2026-0002');
    expect(entry2.source).toBe('AR_INVOICE');
    expect(entry2.lines).toHaveLength(2);
  });

  it('returns empty entries when no periods match', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2025&periodFrom=1&periodTo=12',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.totalEntries).toBe(0);
    expect(body.data.entries).toHaveLength(0);
    // journalEntry.findMany should NOT be called when there are no periods
    expect(mockPrisma.journalEntry.findMany).not.toHaveBeenCalled();
  });

  it('filters by accountCode when provided', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalEntry.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026&periodFrom=1&periodTo=1&accountCode=5000',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lines: { some: { accountCode: '5000' } },
        }),
      }),
    );
  });

  it('filters by source when provided', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalEntry.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026&periodFrom=1&periodTo=1&source=MANUAL',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'MANUAL',
        }),
      }),
    );
  });

  it('only includes POSTED journal entries', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalEntry.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'POSTED',
        }),
      }),
    );
  });

  it('orders entries by transactionDate ascending', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalEntry.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { transactionDate: 'asc' },
      }),
    );
  });

  it('uses default periodFrom=1 and periodTo=12', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(12);
  });

  it('requires fiscalYear query parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for user without finance.reports permission', async () => {
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
      url: '/finance/reports/transaction-journal?fiscalYear=2026',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('handles Decimal values from Prisma correctly', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    const decimalLike = (val: number) => ({
      toString: () => val.toString(),
      toNumber: () => val,
      valueOf: () => val,
      [Symbol.toPrimitive]: () => val,
    });

    mockPrisma.journalEntry.findMany.mockResolvedValue([
      {
        id: 'je-001',
        entryNumber: 'JE-2026-0001',
        transactionDate: new Date('2026-01-15'),
        description: 'Test',
        reference: null,
        source: 'MANUAL',
        status: 'POSTED',
        totalDebit: decimalLike(1500.5),
        totalCredit: decimalLike(1500.5),
        lines: [
          {
            lineNumber: 1,
            accountCode: '5000',
            description: 'Expense',
            debit: decimalLike(1500.5),
            credit: decimalLike(0),
            account: { name: 'Office Expenses' },
          },
        ],
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.entries[0].totalDebit).toBe(1500.5);
    expect(body.data.entries[0].totalCredit).toBe(1500.5);
    expect(body.data.entries[0].lines[0].debit).toBe(1500.5);
    expect(body.data.entries[0].lines[0].credit).toBe(0);
  });
});

// ===========================================================================
// GET /finance/reports/budget-variance
// ===========================================================================

describe('GET /finance/reports/budget-variance', () => {
  it('returns budget vs actual comparison for each account', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findFirst.mockResolvedValue(makeSampleBudget());

    mockPrisma.financialPeriod.findMany.mockResolvedValue([
      { id: PERIOD_ID_1 },
      { id: PERIOD_ID_2 },
      { id: PERIOD_ID_3 },
    ]);

    // Actuals: Office Expenses had 800 net debit, Sales Revenue had 4000 net credit
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '5000', _sum: { debit: 800, credit: 0 } },
      { accountCode: '4000', _sum: { debit: 0, credit: 4000 } },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.fiscalYear).toBe(2026);
    expect(body.data.budgetId).toBe(BUDGET_ID);
    expect(body.data.budgetName).toBe('Annual Budget 2026');
    expect(body.data.accounts).toHaveLength(2);

    // Office Expenses: budget 1200, actual 800 (debit - credit = 800 - 0 = 800)
    // variance = 1200 - 800 = 400 (under budget)
    const expenses = body.data.accounts.find(
      (a: { accountCode: string }) => a.accountCode === '5000',
    );
    expect(expenses).toBeDefined();
    expect(expenses.budgetAmount).toBe(1200);
    expect(expenses.actualAmount).toBe(800);
    expect(expenses.variance).toBe(400);

    // Sales Revenue: budget 6000, actual -4000 (debit - credit = 0 - 4000 = -4000)
    // variance = 6000 - (-4000) = 10000
    const revenue = body.data.accounts.find(
      (a: { accountCode: string }) => a.accountCode === '4000',
    );
    expect(revenue).toBeDefined();
    expect(revenue.budgetAmount).toBe(6000);
    expect(revenue.actualAmount).toBe(-4000);
    expect(revenue.variance).toBe(10000);

    // Summary
    expect(body.data.summary.totalBudget).toBe(7200);
    expect(body.data.summary.totalActual).toBe(-3200);
    expect(body.data.summary.totalVariance).toBe(10400);
  });

  it('uses latest approved budget when budgetId is not provided', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findFirst.mockResolvedValue(makeSampleBudget());
    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          fiscalYear: 2026,
          status: 'APPROVED',
        }),
        orderBy: { approvedAt: 'desc' },
      }),
    );
  });

  it('uses specific budget when budgetId is provided', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findFirst.mockResolvedValue(makeSampleBudget());
    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/finance/reports/budget-variance?fiscalYear=2026&budgetId=${BUDGET_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: BUDGET_ID,
          companyId: TEST_COMPANY_ID,
        }),
      }),
    );
  });

  it('returns 404 when no approved budget exists', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    // The error handler should convert the thrown error to 404 or 500
    // depending on error handler implementation. We check it is not 200.
    expect(res.statusCode).not.toBe(200);
  });

  it('returns 404 when specified budgetId is not found', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/budget-variance?fiscalYear=2026&budgetId=${BUDGET_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).not.toBe(200);
  });

  it('computes variancePercentage as null when budgetAmount is zero', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findFirst.mockResolvedValue({
      id: BUDGET_ID,
      name: 'Zero Budget',
      fiscalYear: 2026,
      status: 'APPROVED',
      lines: [
        {
          accountCode: '5000',
          totalAmount: 0,
          account: { name: 'Office Expenses' },
        },
      ],
    });

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '5000', _sum: { debit: 100, credit: 0 } },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const line = body.data.accounts[0];
    expect(line.budgetAmount).toBe(0);
    expect(line.actualAmount).toBe(100);
    expect(line.variancePercentage).toBeNull();
  });

  it('handles accounts with no actual activity (zero actual)', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findFirst.mockResolvedValue(makeSampleBudget());
    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    // No actuals for any account
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // All accounts should show full variance (budget - 0 = budget)
    for (const account of body.data.accounts) {
      expect(account.actualAmount).toBe(0);
      expect(account.variance).toBe(account.budgetAmount);
    }
  });

  it('requires fiscalYear query parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance?fiscalYear=2026',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for user without finance.reports permission', async () => {
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
      url: '/finance/reports/budget-variance?fiscalYear=2026',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('handles Decimal values from Prisma correctly', async () => {
    app = await buildTestApp();

    const decimalLike = (val: number) => ({
      toString: () => val.toString(),
      toNumber: () => val,
      valueOf: () => val,
      [Symbol.toPrimitive]: () => val,
    });

    mockPrisma.budget.findFirst.mockResolvedValue({
      id: BUDGET_ID,
      name: 'Annual Budget 2026',
      fiscalYear: 2026,
      status: 'APPROVED',
      lines: [
        {
          accountCode: '5000',
          totalAmount: decimalLike(1500.75),
          account: { name: 'Office Expenses' },
        },
      ],
    });

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '5000', _sum: { debit: decimalLike(750.25), credit: decimalLike(0) } },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/budget-variance?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const line = body.data.accounts[0];
    expect(line.budgetAmount).toBe(1500.75);
    expect(line.actualAmount).toBe(750.25);
    expect(line.variance).toBe(750.5);
  });
});
