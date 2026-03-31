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
    systemSetting: { findMany: vi.fn() },
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

  mockPrisma.systemSetting.findMany.mockResolvedValue([]);

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
// P&L sample accounts (with classification relation)
// ---------------------------------------------------------------------------

function makePnlAccounts() {
  return [
    {
      code: '4000',
      name: 'Sales Revenue',
      normalBalance: 'CREDIT',
      openingBalance: 0,
      classification: { code: 'REV', name: 'Revenue' },
    },
    {
      code: '4100',
      name: 'Service Revenue',
      normalBalance: 'CREDIT',
      openingBalance: 0,
      classification: { code: 'REV', name: 'Revenue' },
    },
    {
      code: '5000',
      name: 'Cost of Materials',
      normalBalance: 'DEBIT',
      openingBalance: 0,
      classification: { code: 'COGS', name: 'Cost of Goods Sold' },
    },
    {
      code: '6000',
      name: 'Salaries',
      normalBalance: 'DEBIT',
      openingBalance: 0,
      classification: { code: 'OPEX', name: 'Operating Expenses' },
    },
    {
      code: '6100',
      name: 'Rent',
      normalBalance: 'DEBIT',
      openingBalance: 0,
      classification: { code: 'OPEX', name: 'Operating Expenses' },
    },
    {
      code: '7000',
      name: 'Interest Income',
      normalBalance: 'CREDIT',
      openingBalance: 0,
      classification: { code: 'OI', name: 'Other Income' },
    },
    {
      code: '8000',
      name: 'Bank Charges',
      normalBalance: 'DEBIT',
      openingBalance: 0,
      classification: { code: 'FIN', name: 'Finance Costs' },
    },
    {
      code: '9000',
      name: 'Corporation Tax',
      normalBalance: 'DEBIT',
      openingBalance: 0,
      classification: { code: 'TAX', name: 'Taxation' },
    },
  ];
}

// ---------------------------------------------------------------------------
// Balance Sheet sample accounts (with classification relation)
// ---------------------------------------------------------------------------

function makeBsAccounts() {
  return [
    {
      code: '1000',
      name: 'Land & Buildings',
      normalBalance: 'DEBIT',
      openingBalance: 50000,
      classification: { code: 'FA', name: 'Fixed Assets' },
    },
    {
      code: '1100',
      name: 'Equipment',
      normalBalance: 'DEBIT',
      openingBalance: 20000,
      classification: { code: 'FA', name: 'Fixed Assets' },
    },
    {
      code: '1200',
      name: 'Cash',
      normalBalance: 'DEBIT',
      openingBalance: 10000,
      classification: { code: 'CA', name: 'Current Assets' },
    },
    {
      code: '1300',
      name: 'Trade Debtors',
      normalBalance: 'DEBIT',
      openingBalance: 5000,
      classification: { code: 'CA', name: 'Current Assets' },
    },
    {
      code: '2000',
      name: 'Trade Creditors',
      normalBalance: 'CREDIT',
      openingBalance: 8000,
      classification: { code: 'CL', name: 'Current Liabilities' },
    },
    {
      code: '2100',
      name: 'VAT Payable',
      normalBalance: 'CREDIT',
      openingBalance: 2000,
      classification: { code: 'CL', name: 'Current Liabilities' },
    },
    {
      code: '2500',
      name: 'Bank Loan',
      normalBalance: 'CREDIT',
      openingBalance: 25000,
      classification: { code: 'LTL', name: 'Long-Term Liabilities' },
    },
    {
      code: '3000',
      name: 'Share Capital',
      normalBalance: 'CREDIT',
      openingBalance: 40000,
      classification: { code: 'EQ', name: 'Equity' },
    },
    {
      code: '3100',
      name: 'Retained Earnings',
      normalBalance: 'CREDIT',
      openingBalance: 10000,
      classification: { code: 'EQ', name: 'Equity' },
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

// ===========================================================================
// GET /finance/reports/profit-and-loss
// ===========================================================================

describe('GET /finance/reports/profit-and-loss', () => {
  it('AC-1: returns P&L grouped by classification with summary figures', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([
      { id: PERIOD_ID_1 },
      { id: PERIOD_ID_2 },
    ]);

    // Simulated posted journal lines
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      // Revenue: credit 10000
      { accountCode: '4000', _sum: { debit: 0, credit: 8000 } },
      { accountCode: '4100', _sum: { debit: 0, credit: 2000 } },
      // COGS: debit 3000
      { accountCode: '5000', _sum: { debit: 3000, credit: 0 } },
      // OPEX: debit 2000 + 500
      { accountCode: '6000', _sum: { debit: 2000, credit: 0 } },
      { accountCode: '6100', _sum: { debit: 500, credit: 0 } },
      // OI: credit 200
      { accountCode: '7000', _sum: { debit: 0, credit: 200 } },
      // FIN: debit 100
      { accountCode: '8000', _sum: { debit: 100, credit: 0 } },
      // TAX: debit 500
      { accountCode: '9000', _sum: { debit: 500, credit: 0 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makePnlAccounts());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026&periodFrom=1&periodTo=6',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data.fiscalYear).toBe(2026);
    expect(data.periodFrom).toBe(1);
    expect(data.periodTo).toBe(6);

    // Verify sections exist for all P&L classifications
    expect(data.sections).toHaveLength(6);
    const sectionCodes = data.sections.map((s: { classification: string }) => s.classification);
    expect(sectionCodes).toEqual(['REV', 'COGS', 'OPEX', 'OI', 'FIN', 'TAX']);

    // Revenue section
    const revSection = data.sections.find(
      (s: { classification: string }) => s.classification === 'REV',
    );
    expect(revSection.name).toBe('Revenue');
    expect(revSection.accounts).toHaveLength(2);
    expect(revSection.total).toBe(10000); // 8000 + 2000 (CREDIT normal => credits - debits)

    // COGS section
    const cogsSection = data.sections.find(
      (s: { classification: string }) => s.classification === 'COGS',
    );
    expect(cogsSection.total).toBe(3000); // DEBIT normal => debits - credits

    // AC-4: Summary calculations
    expect(data.grossProfit).toBe(7000); // 10000 - 3000
    expect(data.operatingExpenses).toBe(2500); // 2000 + 500
    expect(data.operatingProfit).toBe(4500); // 7000 - 2500
    expect(data.otherIncome).toBe(200);
    expect(data.financeCosts).toBe(100);
    expect(data.profitBeforeTax).toBe(4600); // 4500 + 200 - 100
    expect(data.taxation).toBe(500);
    expect(data.netProfit).toBe(4100); // 4600 - 500
  });

  it('AC-3: supports ?fiscalYear=2026&periodFrom=1&periodTo=12 filters', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026&periodFrom=1&periodTo=12',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.fiscalYear).toBe(2026);
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(12);

    // Verify correct period query
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

  it('AC-6: only includes POSTED journal entries', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026&periodFrom=1&periodTo=3',
      headers: { authorization: `Bearer ${testJwt}` },
    });

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

  it('defaults periodFrom=1 and periodTo=12 when not specified', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(12);
  });

  it('returns empty sections with zero totals when no activity', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.sections).toHaveLength(6);
    expect(body.data.grossProfit).toBe(0);
    expect(body.data.netProfit).toBe(0);
  });

  it('requires fiscalYear query parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for role without finance.reports permission', async () => {
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
      url: '/finance/reports/profit-and-loss?fiscalYear=2026',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('skips accounts with no opening balance and no activity', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '4000', _sum: { debit: 0, credit: 5000 } },
    ]);

    // Include an account with no activity (6100 Rent — no journal lines, zero opening)
    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makePnlAccounts());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const revSection = body.data.sections.find(
      (s: { classification: string }) => s.classification === 'REV',
    );
    // Only 4000 should appear in REV (4100 has no activity)
    expect(revSection.accounts).toHaveLength(1);
    expect(revSection.accounts[0].accountCode).toBe('4000');
  });

  it('handles accounts with opening balances but no journal activity', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);

    // Account with a non-zero opening balance
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '4000',
        name: 'Sales Revenue',
        normalBalance: 'CREDIT',
        openingBalance: 1000,
        classification: { code: 'REV', name: 'Revenue' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const revSection = body.data.sections.find(
      (s: { classification: string }) => s.classification === 'REV',
    );
    expect(revSection.accounts).toHaveLength(1);
    expect(revSection.accounts[0].openingBalance).toBe(1000);
    expect(revSection.accounts[0].balance).toBe(1000);
    expect(body.data.grossProfit).toBe(1000);
  });
});

// ===========================================================================
// GET /finance/reports/balance-sheet
// ===========================================================================

describe('GET /finance/reports/balance-sheet', () => {
  it('AC-2: returns balance sheet grouped by classification', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([
      { id: PERIOD_ID_1 },
      { id: PERIOD_ID_2 },
    ]);

    // Simulated posted journal lines
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      // Cash increase: debit 5000
      { accountCode: '1200', _sum: { debit: 5000, credit: 0 } },
      // Trade debtors decrease: credit 2000
      { accountCode: '1300', _sum: { debit: 0, credit: 2000 } },
      // Trade creditors increase: credit 3000
      { accountCode: '2000', _sum: { debit: 0, credit: 3000 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makeBsAccounts());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026&periodFrom=1&periodTo=6',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data.fiscalYear).toBe(2026);
    expect(data.periodFrom).toBe(1);
    expect(data.periodTo).toBe(6);

    // Verify sections exist for all BS classifications
    expect(data.sections).toHaveLength(5);
    const sectionCodes = data.sections.map((s: { classification: string }) => s.classification);
    expect(sectionCodes).toEqual(['FA', 'CA', 'CL', 'LTL', 'EQ']);

    // Fixed Assets: Land 50000 + Equipment 20000 (no activity)
    const faSection = data.sections.find(
      (s: { classification: string }) => s.classification === 'FA',
    );
    expect(faSection.name).toBe('Fixed Assets');
    expect(faSection.total).toBe(70000);

    // Current Assets: Cash (10000+5000) + Debtors (5000-2000) = 18000
    const caSection = data.sections.find(
      (s: { classification: string }) => s.classification === 'CA',
    );
    expect(caSection.total).toBe(18000);

    // Total Assets = FA + CA = 70000 + 18000 = 88000
    expect(data.totalAssets).toBe(88000);

    // Current Liabilities: Creditors (8000+3000) + VAT (2000) = 13000
    const clSection = data.sections.find(
      (s: { classification: string }) => s.classification === 'CL',
    );
    expect(clSection.total).toBe(13000);

    // LTL: Bank Loan 25000
    const ltlSection = data.sections.find(
      (s: { classification: string }) => s.classification === 'LTL',
    );
    expect(ltlSection.total).toBe(25000);

    // Total Liabilities = CL + LTL = 13000 + 25000 = 38000
    expect(data.totalLiabilities).toBe(38000);

    // Equity: Share Capital 40000 + Retained Earnings 10000 = 50000
    const eqSection = data.sections.find(
      (s: { classification: string }) => s.classification === 'EQ',
    );
    expect(eqSection.total).toBe(50000);

    expect(data.totalEquity).toBe(50000);

    // AC-5: Assets = Liabilities + Equity => 88000 = 38000 + 50000
    expect(data.isBalanced).toBe(true);
  });

  it('AC-3: supports ?fiscalYear=2026&periodFrom=1&periodTo=12 filters', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026&periodFrom=1&periodTo=12',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.fiscalYear).toBe(2026);
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(12);

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

  it('AC-5: isBalanced=false when assets do not equal liabilities + equity', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);

    // Deliberately unbalanced: Assets = 10000, Liabilities + Equity = 8000
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1200',
        name: 'Cash',
        normalBalance: 'DEBIT',
        openingBalance: 10000,
        classification: { code: 'CA', name: 'Current Assets' },
      },
      {
        code: '2000',
        name: 'Trade Creditors',
        normalBalance: 'CREDIT',
        openingBalance: 3000,
        classification: { code: 'CL', name: 'Current Liabilities' },
      },
      {
        code: '3000',
        name: 'Share Capital',
        normalBalance: 'CREDIT',
        openingBalance: 5000,
        classification: { code: 'EQ', name: 'Equity' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.totalAssets).toBe(10000);
    expect(body.data.totalLiabilities).toBe(3000);
    expect(body.data.totalEquity).toBe(5000);
    expect(body.data.isBalanced).toBe(false); // 10000 != 3000 + 5000
  });

  it('AC-6: only includes POSTED journal entries', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026&periodFrom=1&periodTo=3',
      headers: { authorization: `Bearer ${testJwt}` },
    });

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

  it('defaults periodFrom=1 and periodTo=12 when not specified', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.periodFrom).toBe(1);
    expect(body.data.periodTo).toBe(12);
  });

  it('returns empty sections when no accounts exist', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.sections).toHaveLength(5);
    expect(body.data.totalAssets).toBe(0);
    expect(body.data.totalLiabilities).toBe(0);
    expect(body.data.totalEquity).toBe(0);
    expect(body.data.isBalanced).toBe(true); // 0 == 0 + 0
  });

  it('requires fiscalYear query parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('validates periodTo range (rejects period > 13)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026&periodTo=14',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for role without finance.reports permission', async () => {
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
      url: '/finance/reports/balance-sheet?fiscalYear=2026',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('correctly calculates DEBIT and CREDIT normal balance accounts', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    // Cash (DEBIT): opening 10000, debit 3000, credit 1000 => 10000 + 3000 - 1000 = 12000
    // Trade Creditors (CREDIT): opening 5000, debit 500, credit 2000 => 5000 + 2000 - 500 = 6500
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '1200', _sum: { debit: 3000, credit: 1000 } },
      { accountCode: '2000', _sum: { debit: 500, credit: 2000 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1200',
        name: 'Cash',
        normalBalance: 'DEBIT',
        openingBalance: 10000,
        classification: { code: 'CA', name: 'Current Assets' },
      },
      {
        code: '2000',
        name: 'Trade Creditors',
        normalBalance: 'CREDIT',
        openingBalance: 5000,
        classification: { code: 'CL', name: 'Current Liabilities' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    const caSection = body.data.sections.find(
      (s: { classification: string }) => s.classification === 'CA',
    );
    expect(caSection.accounts[0].balance).toBe(12000);

    const clSection = body.data.sections.find(
      (s: { classification: string }) => s.classification === 'CL',
    );
    expect(clSection.accounts[0].balance).toBe(6500);
  });

  it('skips accounts with zero opening balance and no journal activity', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '1200', _sum: { debit: 1000, credit: 0 } },
    ]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1200',
        name: 'Cash',
        normalBalance: 'DEBIT',
        openingBalance: 10000,
        classification: { code: 'CA', name: 'Current Assets' },
      },
      {
        code: '1400',
        name: 'Petty Cash',
        normalBalance: 'DEBIT',
        openingBalance: 0,
        classification: { code: 'CA', name: 'Current Assets' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/balance-sheet?fiscalYear=2026&periodFrom=1&periodTo=1',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const caSection = body.data.sections.find(
      (s: { classification: string }) => s.classification === 'CA',
    );
    // Only Cash should appear; Petty Cash has zero opening and no activity
    expect(caSection.accounts).toHaveLength(1);
    expect(caSection.accounts[0].accountCode).toBe('1200');
  });
});
