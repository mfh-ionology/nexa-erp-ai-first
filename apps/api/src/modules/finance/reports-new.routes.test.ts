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
      findMany: vi.fn(),
    },
    chartOfAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    dimensionType: { findFirst: vi.fn() },
    dimensionValue: { findMany: vi.fn() },
    dimensionBalance: { findMany: vi.fn() },
    simulationLine: { groupBy: vi.fn(), findMany: vi.fn() },
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

const DIM_TYPE_ID = 'dddd0000-0000-4000-a000-000000000001';
const DIM_VALUE_ID_1 = 'dddd0000-0000-4000-a000-000000000010';
const DIM_VALUE_ID_2 = 'dddd0000-0000-4000-a000-000000000020';

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
// GET /finance/reports/gl-detail
// ===========================================================================

describe('GET /finance/reports/gl-detail', () => {
  it('returns account entries with running balance for a single account', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      code: '1000',
      name: 'Cash',
      normalBalance: 'DEBIT',
      openingBalance: 5000,
    });

    mockPrisma.financialPeriod.findMany.mockResolvedValue([
      { id: PERIOD_ID_1 },
      { id: PERIOD_ID_2 },
    ]);

    mockPrisma.journalLine.findMany.mockResolvedValue([
      {
        journalEntry: {
          id: 'je-001',
          entryNumber: 'JE-2026-0001',
          transactionDate: new Date('2026-01-15'),
          description: 'Office supplies',
          reference: 'INV-001',
          source: 'MANUAL',
        },
        debit: 0,
        credit: 500,
        dimensions: [],
      },
      {
        journalEntry: {
          id: 'je-002',
          entryNumber: 'JE-2026-0002',
          transactionDate: new Date('2026-02-01'),
          description: 'Sales received',
          reference: null,
          source: 'AR_INVOICE',
        },
        debit: 1000,
        credit: 0,
        dimensions: [],
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/gl-detail?fiscalYear=2026&periodFrom=1&periodTo=2&accountCode=1000',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountCode).toBe('1000');
    expect(body.data.accountName).toBe('Cash');
    expect(body.data.openingBalance).toBe(5000);
    expect(body.data.entries).toHaveLength(2);

    // Entry 1: debit=0, credit=500; DEBIT acct: 5000 + 0 - 500 = 4500
    expect(body.data.entries[0].entryNumber).toBe('JE-2026-0001');
    expect(body.data.entries[0].debit).toBe(0);
    expect(body.data.entries[0].credit).toBe(500);
    expect(body.data.entries[0].runningBalance).toBe(4500);
    expect(body.data.entries[0].isSimulation).toBe(false);

    // Entry 2: debit=1000, credit=0; 4500 + 1000 - 0 = 5500
    expect(body.data.entries[1].runningBalance).toBe(5500);

    expect(body.data.closingBalance).toBe(5500);
    expect(body.data.totalDebit).toBe(1000);
    expect(body.data.totalCredit).toBe(500);
  });

  it('returns 404 when accountCode does not exist', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/gl-detail?fiscalYear=2026&accountCode=9999',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).not.toBe(200);
  });

  it('computes running balance correctly for CREDIT normal account', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      code: '4000',
      name: 'Sales Revenue',
      normalBalance: 'CREDIT',
      openingBalance: 0,
    });

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    mockPrisma.journalLine.findMany.mockResolvedValue([
      {
        journalEntry: {
          id: 'je-001',
          entryNumber: 'JE-2026-0001',
          transactionDate: new Date('2026-01-15'),
          description: 'Revenue',
          reference: null,
          source: 'AR_INVOICE',
        },
        debit: 0,
        credit: 1000,
        dimensions: [],
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/gl-detail?fiscalYear=2026&accountCode=4000',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // CREDIT acct: 0 + 1000 - 0 = 1000
    expect(body.data.entries[0].runningBalance).toBe(1000);
    expect(body.data.closingBalance).toBe(1000);
  });

  it('returns empty entries when no periods match', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      code: '1000',
      name: 'Cash',
      normalBalance: 'DEBIT',
      openingBalance: 5000,
    });

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/gl-detail?fiscalYear=2025&accountCode=1000',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.entries).toHaveLength(0);
    expect(body.data.openingBalance).toBe(5000);
    expect(body.data.closingBalance).toBe(5000);
  });

  it('requires accountCode query parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/gl-detail?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('validates fiscalYear range', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/gl-detail?fiscalYear=1999&accountCode=1000',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/gl-detail?fiscalYear=2026&accountCode=1000',
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
      url: '/finance/reports/gl-detail?fiscalYear=2026&accountCode=1000',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('filters lines by dimensionValueId when provided', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      code: '1000',
      name: 'Cash',
      normalBalance: 'DEBIT',
      openingBalance: 0,
    });

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/finance/reports/gl-detail?fiscalYear=2026&accountCode=1000&dimensionValueId=${DIM_VALUE_ID_1}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dimensions: { some: { dimensionValueId: DIM_VALUE_ID_1 } },
        }),
      }),
    );
  });
});

// ===========================================================================
// GET /finance/reports/general-ledger
// ===========================================================================

describe('GET /finance/reports/general-ledger', () => {
  it('returns all accounts with their entries and running balances', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: 5000,
      },
      {
        code: '4000',
        name: 'Revenue',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        openingBalance: 0,
      },
    ]);

    // First call for account 1000, second for 4000
    mockPrisma.journalLine.findMany
      .mockResolvedValueOnce([
        {
          journalEntry: {
            entryNumber: 'JE-001',
            transactionDate: new Date('2026-01-15'),
            description: 'Cash receipt',
          },
          debit: 1000,
          credit: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          journalEntry: {
            entryNumber: 'JE-001',
            transactionDate: new Date('2026-01-15'),
            description: 'Revenue',
          },
          debit: 0,
          credit: 1000,
        },
      ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/general-ledger?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accounts).toHaveLength(2);

    // Cash: opening 5000, +1000 debit = 6000
    const cashAcct = body.data.accounts[0];
    expect(cashAcct.accountCode).toBe('1000');
    expect(cashAcct.openingBalance).toBe(5000);
    expect(cashAcct.entries).toHaveLength(1);
    expect(cashAcct.closingBalance).toBe(6000);

    // Revenue: opening 0, +1000 credit (CREDIT normal) = 1000
    const revenueAcct = body.data.accounts[1];
    expect(revenueAcct.accountCode).toBe('4000');
    expect(revenueAcct.closingBalance).toBe(1000);

    expect(body.data.grandTotals.totalDebit).toBe(1000);
    expect(body.data.grandTotals.totalCredit).toBe(1000);
  });

  it('filters by accountCodeFrom and accountCodeTo range', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/reports/general-ledger?fiscalYear=2026&accountCodeFrom=1000&accountCodeTo=3000',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          code: { gte: '1000', lte: '3000' },
        }),
      }),
    );
  });

  it('skips accounts with no activity and no opening balance', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

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
        name: 'Unused',
        accountType: 'EXPENSE',
        normalBalance: 'DEBIT',
        openingBalance: 0,
      },
    ]);

    // First call for 1000 has activity, second for 9000 has none
    mockPrisma.journalLine.findMany
      .mockResolvedValueOnce([
        {
          journalEntry: {
            entryNumber: 'JE-001',
            transactionDate: new Date('2026-01-15'),
            description: 'Test',
          },
          debit: 100,
          credit: 0,
        },
      ])
      .mockResolvedValueOnce([]); // no lines for 9000

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/general-ledger?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Only Cash should appear; 9000 has zero opening and no lines
    expect(body.data.accounts).toHaveLength(1);
    expect(body.data.accounts[0].accountCode).toBe('1000');
  });

  it('returns empty result when no periods match', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: 0,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/general-ledger?fiscalYear=2025',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.accounts).toHaveLength(0);
    expect(body.data.grandTotals.totalDebit).toBe(0);
    expect(body.data.grandTotals.totalCredit).toBe(0);
  });

  it('computes grand totals across all accounts', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: 0,
      },
      {
        code: '4000',
        name: 'Revenue',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        openingBalance: 0,
      },
    ]);

    mockPrisma.journalLine.findMany
      .mockResolvedValueOnce([
        {
          journalEntry: {
            entryNumber: 'JE-001',
            transactionDate: new Date('2026-01-15'),
            description: 'Test',
          },
          debit: 500,
          credit: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          journalEntry: {
            entryNumber: 'JE-001',
            transactionDate: new Date('2026-01-15'),
            description: 'Test',
          },
          debit: 0,
          credit: 500,
        },
      ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/general-ledger?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.grandTotals.totalDebit).toBe(500);
    expect(body.data.grandTotals.totalCredit).toBe(500);
  });

  it('filters lines by dimensionValueId when provided', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: 0,
      },
    ]);
    mockPrisma.journalLine.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/finance/reports/general-ledger?fiscalYear=2026&dimensionValueId=${DIM_VALUE_ID_1}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dimensions: { some: { dimensionValueId: DIM_VALUE_ID_1 } },
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/general-ledger?fiscalYear=2026',
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
      url: '/finance/reports/general-ledger?fiscalYear=2026',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ===========================================================================
// GET /finance/reports/departmental-pnl
// ===========================================================================

describe('GET /finance/reports/departmental-pnl', () => {
  it('returns P&L pivoted by dimension values with per-column totals', async () => {
    app = await buildTestApp();

    mockPrisma.dimensionType.findFirst.mockResolvedValue({
      id: DIM_TYPE_ID,
      name: 'Department',
    });

    mockPrisma.dimensionValue.findMany.mockResolvedValue([
      { id: DIM_VALUE_ID_1, code: 'SALES', name: 'Sales' },
      { id: DIM_VALUE_ID_2, code: 'MKT', name: 'Marketing' },
    ]);

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '4000',
        name: 'Sales Revenue',
        normalBalance: 'CREDIT',
        classification: { code: 'REV', name: 'Revenue' },
      },
      {
        code: '5000',
        name: 'Office Expenses',
        normalBalance: 'DEBIT',
        classification: { code: 'OPEX', name: 'Operating Expenses' },
      },
    ]);

    // DimensionBalance for pre-aggregated data
    mockPrisma.dimensionBalance.findMany.mockResolvedValue([
      { accountCode: '4000', dimensionValueId: DIM_VALUE_ID_1, totalDebit: 0, totalCredit: 800 },
      { accountCode: '4000', dimensionValueId: DIM_VALUE_ID_2, totalDebit: 0, totalCredit: 200 },
      { accountCode: '5000', dimensionValueId: DIM_VALUE_ID_1, totalDebit: 300, totalCredit: 0 },
    ]);

    // Total journal line aggregations
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '4000', _sum: { debit: 0, credit: 1000 } },
      { accountCode: '5000', _sum: { debit: 500, credit: 0 } },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/departmental-pnl?fiscalYear=2026&dimensionTypeId=${DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.dimensionTypeName).toBe('Department');

    // 3 columns: Sales, Marketing, Unallocated
    expect(body.data.columns).toHaveLength(3);
    expect(body.data.columns[0].dimensionValueName).toBe('Sales');
    expect(body.data.columns[1].dimensionValueName).toBe('Marketing');
    expect(body.data.columns[2].dimensionValueName).toBe('Unallocated');

    // 6 sections for all P&L classifications
    expect(body.data.sections.length).toBeGreaterThanOrEqual(1);

    // Summary
    expect(body.data.summary.netProfitPerColumn).toHaveLength(3);
    expect(typeof body.data.summary.totalNetProfit).toBe('number');
  });

  it('returns 404 when dimensionTypeId does not exist', async () => {
    app = await buildTestApp();

    mockPrisma.dimensionType.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/departmental-pnl?fiscalYear=2026&dimensionTypeId=${DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).not.toBe(200);
  });

  it('computes unallocated column as remainder (total - allocated)', async () => {
    app = await buildTestApp();

    mockPrisma.dimensionType.findFirst.mockResolvedValue({
      id: DIM_TYPE_ID,
      name: 'Department',
    });

    mockPrisma.dimensionValue.findMany.mockResolvedValue([
      { id: DIM_VALUE_ID_1, code: 'SALES', name: 'Sales' },
    ]);

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '4000',
        name: 'Sales Revenue',
        normalBalance: 'CREDIT',
        classification: { code: 'REV', name: 'Revenue' },
      },
    ]);

    // Allocated: 600 out of 1000 goes to Sales dimension
    mockPrisma.dimensionBalance.findMany.mockResolvedValue([
      { accountCode: '4000', dimensionValueId: DIM_VALUE_ID_1, totalDebit: 0, totalCredit: 600 },
    ]);

    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '4000', _sum: { debit: 0, credit: 1000 } },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/departmental-pnl?fiscalYear=2026&dimensionTypeId=${DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Revenue section should have 1 account
    const revSection = body.data.sections.find(
      (s: { classification: string }) => s.classification === 'REV',
    );
    expect(revSection).toBeDefined();
    expect(revSection.accounts).toHaveLength(1);

    // Values: [Sales=600, Unallocated=400]
    const revenueAccount = revSection.accounts[0];
    expect(revenueAccount.values[0]).toBe(600); // Sales
    expect(revenueAccount.values[1]).toBe(400); // Unallocated (1000 - 600)
    expect(revenueAccount.total).toBe(1000);
  });

  it('handles empty result when no periods match', async () => {
    app = await buildTestApp();

    mockPrisma.dimensionType.findFirst.mockResolvedValue({
      id: DIM_TYPE_ID,
      name: 'Department',
    });

    mockPrisma.dimensionValue.findMany.mockResolvedValue([
      { id: DIM_VALUE_ID_1, code: 'SALES', name: 'Sales' },
    ]);

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
    mockPrisma.dimensionBalance.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/departmental-pnl?fiscalYear=2025&dimensionTypeId=${DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should have sections (empty accounts) and summary
    expect(body.data.summary.totalNetProfit).toBe(0);
  });

  it('requires dimensionTypeId query parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/departmental-pnl?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/departmental-pnl?fiscalYear=2026&dimensionTypeId=${DIM_TYPE_ID}`,
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
      url: `/finance/reports/departmental-pnl?fiscalYear=2026&dimensionTypeId=${DIM_TYPE_ID}`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
