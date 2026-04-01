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
    systemSetting: { findFirst: vi.fn() },
    bankAccount: { findMany: vi.fn() },
    financialPeriod: { findMany: vi.fn() },
    journalEntry: { count: vi.fn() },
    bankTransaction: { count: vi.fn() },
    journalLine: { groupBy: vi.fn() },
    vatReturn: { findMany: vi.fn() },
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
import { dashboardRoutesPlugin } from './dashboard.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';

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
  await app.register(dashboardRoutesPlugin, { prefix: '/finance' });

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
              'finance.dashboard': fullPerm,
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

/** Set up default mock return values for all Prisma calls used by the dashboard */
function setupDefaultDashboardMocks(
  opts: {
    fiscalYear?: number;
    bankAccounts?: Array<{ name: string; currentBalance: unknown }>;
    periods?: Array<{ id: string; periodNumber: number; status: string }>;
    draftJournalCount?: number;
    unmatchedBankTxCount?: number;
    revenueAgg?: Array<{ companyId: string; _sum: { debit: unknown; credit: unknown } }>;
    expenseAgg?: Array<{ companyId: string; _sum: { debit: unknown; credit: unknown } }>;
    vatReturns?: Array<{ periodStart: Date; periodEnd: Date; status: string }>;
    fiscalYearStartMonth?: number | null;
  } = {},
) {
  // Setting: fiscal year start month
  if (opts.fiscalYearStartMonth !== undefined) {
    mockPrisma.systemSetting.findFirst.mockResolvedValue(
      opts.fiscalYearStartMonth !== null ? { value: String(opts.fiscalYearStartMonth) } : null,
    );
  } else {
    mockPrisma.systemSetting.findFirst.mockResolvedValue(null);
  }

  // Bank accounts
  mockPrisma.bankAccount.findMany.mockResolvedValue(opts.bankAccounts ?? []);

  // Financial periods
  mockPrisma.financialPeriod.findMany.mockResolvedValue(opts.periods ?? []);

  // Draft journals count
  mockPrisma.journalEntry.count.mockResolvedValue(opts.draftJournalCount ?? 0);

  // Unmatched bank transactions count
  mockPrisma.bankTransaction.count.mockResolvedValue(opts.unmatchedBankTxCount ?? 0);

  // Revenue aggregation — journalLine.groupBy is called twice (revenue, then expenses)
  // We differentiate by call order
  const revenueAgg = opts.revenueAgg ?? [];
  const expenseAgg = opts.expenseAgg ?? [];
  mockPrisma.journalLine.groupBy
    .mockResolvedValueOnce(revenueAgg)
    .mockResolvedValueOnce(expenseAgg);

  // VAT returns
  mockPrisma.vatReturn.findMany.mockResolvedValue(opts.vatReturns ?? []);
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
// GET /finance/dashboard — AC-1: returns key financial metrics
// ---------------------------------------------------------------------------

describe('GET /finance/dashboard', () => {
  it('returns 200 with dashboard data structure (AC-1)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      bankAccounts: [
        { name: 'Current Account', currentBalance: 15000 },
        { name: 'Savings Account', currentBalance: 50000 },
      ],
      periods: [
        { id: 'p1', periodNumber: 1, status: 'CLOSED' },
        { id: 'p2', periodNumber: 2, status: 'CLOSED' },
        { id: 'p3', periodNumber: 3, status: 'OPEN' },
      ],
      draftJournalCount: 5,
      unmatchedBankTxCount: 3,
      revenueAgg: [{ companyId: TEST_COMPANY_ID, _sum: { debit: 0, credit: 100000 } }],
      expenseAgg: [{ companyId: TEST_COMPANY_ID, _sum: { debit: 65000, credit: 0 } }],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.fiscalYear).toBe(2026);

    // Cash position
    expect(body.data.cashPosition.totalBankBalance).toBe(65000);
    expect(body.data.cashPosition.bankAccounts).toHaveLength(2);
    expect(body.data.cashPosition.bankAccounts[0].name).toBe('Current Account');
    expect(body.data.cashPosition.bankAccounts[0].balance).toBe(15000);
    expect(body.data.cashPosition.bankAccounts[1].name).toBe('Savings Account');
    expect(body.data.cashPosition.bankAccounts[1].balance).toBe(50000);

    // P&L summary
    expect(body.data.profitAndLoss.totalRevenue).toBe(100000);
    expect(body.data.profitAndLoss.totalExpenses).toBe(65000);
    expect(body.data.profitAndLoss.netProfit).toBe(35000);

    // Activity
    expect(body.data.activity.draftJournals).toBe(5);
    expect(body.data.activity.unmatchedBankTransactions).toBe(3);
    expect(body.data.activity.openPeriods).toBe(1);
    expect(body.data.activity.closedPeriods).toBe(2);

    // Alerts is an array
    expect(Array.isArray(body.data.alerts)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // AC-2: Metrics include cash position, P&L, activity, alerts
  // ---------------------------------------------------------------------------

  it('includes cash position with sum of bank balances (AC-2)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      bankAccounts: [
        { name: 'Account A', currentBalance: 10000.5 },
        { name: 'Account B', currentBalance: 20000.75 },
        { name: 'Account C', currentBalance: -500.25 },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.cashPosition.totalBankBalance).toBe(29501);
    expect(body.data.cashPosition.bankAccounts).toHaveLength(3);
  });

  it('includes P&L summary with revenue, expenses, net profit (AC-2)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      revenueAgg: [{ companyId: TEST_COMPANY_ID, _sum: { debit: 500, credit: 80000 } }],
      expenseAgg: [{ companyId: TEST_COMPANY_ID, _sum: { debit: 45000, credit: 2000 } }],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Revenue (CREDIT-normal): credits - debits = 80000 - 500 = 79500
    expect(body.data.profitAndLoss.totalRevenue).toBe(79500);
    // Expenses (DEBIT-normal): debits - credits = 45000 - 2000 = 43000
    expect(body.data.profitAndLoss.totalExpenses).toBe(43000);
    // Net profit = revenue - expenses = 79500 - 43000 = 36500
    expect(body.data.profitAndLoss.netProfit).toBe(36500);
  });

  it('includes activity counts for draft journals, unmatched txns, periods (AC-2)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      draftJournalCount: 12,
      unmatchedBankTxCount: 7,
      periods: [
        { id: 'p1', periodNumber: 1, status: 'CLOSED' },
        { id: 'p2', periodNumber: 2, status: 'LOCKED' },
        { id: 'p3', periodNumber: 3, status: 'OPEN' },
        { id: 'p4', periodNumber: 4, status: 'OPEN' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.activity.draftJournals).toBe(12);
    expect(body.data.activity.unmatchedBankTransactions).toBe(7);
    expect(body.data.activity.openPeriods).toBe(2);
    // CLOSED + LOCKED both count as closed
    expect(body.data.activity.closedPeriods).toBe(2);
  });

  it('generates alert for unmatched bank transactions (AC-2)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      unmatchedBankTxCount: 3,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const txAlert = body.data.alerts.find(
      (a: { type: string }) => a.type === 'unmatched_transactions',
    );
    expect(txAlert).toBeDefined();
    expect(txAlert.message).toBe('3 unreconciled bank transactions');
    expect(txAlert.severity).toBe('info');
  });

  it('generates warning-level alert for high unmatched bank tx count (AC-2)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      unmatchedBankTxCount: 15,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const txAlert = body.data.alerts.find(
      (a: { type: string }) => a.type === 'unmatched_transactions',
    );
    expect(txAlert).toBeDefined();
    expect(txAlert.severity).toBe('warning');
  });

  it('generates alert for draft journals (AC-2)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      draftJournalCount: 2,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const draftAlert = body.data.alerts.find((a: { type: string }) => a.type === 'draft_journals');
    expect(draftAlert).toBeDefined();
    expect(draftAlert.message).toBe('2 draft journals pending');
    expect(draftAlert.severity).toBe('info');
  });

  it('generates no alerts when everything is clean', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      draftJournalCount: 0,
      unmatchedBankTxCount: 0,
      periods: [], // No periods = no overdue period alerts
      vatReturns: [], // No completed quarters to check (depends on date)
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2099',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Far future year (2099): no completed quarters, no overdue periods
    expect(body.data.alerts).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // AC-3: Period-aware, defaults to current fiscal year, supports ?fiscalYear
  // ---------------------------------------------------------------------------

  it('accepts ?fiscalYear filter (AC-3)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2025',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.fiscalYear).toBe(2025);
  });

  it('defaults to current fiscal year when no ?fiscalYear (AC-3)', async () => {
    app = await buildTestApp();

    // No fiscal year setting found -> defaults to January start -> current calendar year
    setupDefaultDashboardMocks({ fiscalYearStartMonth: null });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should be the current year (or current year - 1 if fiscal year starts later)
    expect(body.data.fiscalYear).toBeGreaterThanOrEqual(2025);
    expect(body.data.fiscalYear).toBeLessThanOrEqual(new Date().getFullYear() + 1);
  });

  it('queries financial periods for the specified fiscal year (AC-3)', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks();

    await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.financialPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          fiscalYear: 2026,
        }),
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('handles empty bank accounts gracefully', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({ bankAccounts: [] });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.cashPosition.totalBankBalance).toBe(0);
    expect(body.data.cashPosition.bankAccounts).toHaveLength(0);
  });

  it('handles zero revenue and expenses gracefully', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({
      revenueAgg: [],
      expenseAgg: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.profitAndLoss.totalRevenue).toBe(0);
    expect(body.data.profitAndLoss.totalExpenses).toBe(0);
    expect(body.data.profitAndLoss.netProfit).toBe(0);
  });

  it('handles Decimal values from Prisma correctly', async () => {
    app = await buildTestApp();

    const decimalLike = (val: number) => ({
      toString: () => val.toString(),
      toNumber: () => val,
      valueOf: () => val,
      [Symbol.toPrimitive]: () => val,
    });

    setupDefaultDashboardMocks({
      bankAccounts: [{ name: 'Account A', currentBalance: decimalLike(12345.6789) }],
      revenueAgg: [
        {
          companyId: TEST_COMPANY_ID,
          _sum: { debit: decimalLike(100), credit: decimalLike(5000.5) },
        },
      ],
      expenseAgg: [
        {
          companyId: TEST_COMPANY_ID,
          _sum: { debit: decimalLike(3000.25), credit: decimalLike(50) },
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.cashPosition.totalBankBalance).toBe(12345.6789);
    // Revenue: 5000.5 - 100 = 4900.5
    expect(body.data.profitAndLoss.totalRevenue).toBe(4900.5);
    // Expenses: 3000.25 - 50 = 2950.25
    expect(body.data.profitAndLoss.totalExpenses).toBe(2950.25);
    // Net profit: 4900.5 - 2950.25 = 1950.25
    expect(body.data.profitAndLoss.netProfit).toBe(1950.25);
  });

  it('handles singular grammar for 1 unmatched transaction', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({ unmatchedBankTxCount: 1 });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const txAlert = body.data.alerts.find(
      (a: { type: string }) => a.type === 'unmatched_transactions',
    );
    expect(txAlert.message).toBe('1 unreconciled bank transaction');
  });

  it('handles singular grammar for 1 draft journal', async () => {
    app = await buildTestApp();

    setupDefaultDashboardMocks({ draftJournalCount: 1 });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const draftAlert = body.data.alerts.find((a: { type: string }) => a.type === 'draft_journals');
    expect(draftAlert.message).toBe('1 draft journal pending');
  });

  // ---------------------------------------------------------------------------
  // AC-4: Auth & permissions
  // ---------------------------------------------------------------------------

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2026',
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
      url: '/finance/dashboard?fiscalYear=2026',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects invalid fiscalYear (below 2000)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=1999',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid fiscalYear (above 2100)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/dashboard?fiscalYear=2101',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });
});
