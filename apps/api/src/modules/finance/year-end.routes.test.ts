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
      create: vi.fn(),
      update: vi.fn(),
    },
    chartOfAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    accountMapping: {
      findFirst: vi.fn(),
    },
    journalLine: {
      groupBy: vi.fn(),
    },
    journalEntry: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
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
  nextNumber: vi.fn().mockResolvedValue('JE-000001'),
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

// Mock the multi-currency service used by createGlPosting
vi.mock('./multi-currency.service.js', () => ({
  convertLinesToBaseCurrency: vi
    .fn()
    .mockImplementation(
      async (
        _tx: unknown,
        _companyId: string,
        _baseCurrency: string,
        _date: Date,
        lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }>,
      ) => lines,
    ),
  getBaseCurrencyCode: vi.fn().mockResolvedValue('GBP'),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { yearEndRoutesPlugin } from './year-end.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_FISCAL_YEAR = 2026;

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
  await app.register(yearEndRoutesPlugin, { prefix: '/finance' });

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

/** Create 12 sample periods for a fiscal year, all CLOSED. */
function makeClosedPeriods(fiscalYear: number = TEST_FISCAL_YEAR) {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `period-${String(i + 1).padStart(2, '0')}`,
    companyId: TEST_COMPANY_ID,
    name: `Period ${String(i + 1)} ${String(fiscalYear)}`,
    periodNumber: i + 1,
    fiscalYear,
    startDate: new Date(`${String(fiscalYear)}-${String(i + 1).padStart(2, '0')}-01`),
    endDate: new Date(`${String(fiscalYear)}-${String(i + 1).padStart(2, '0')}-28`),
    status: 'CLOSED',
    closedAt: new Date(),
    closedBy: TEST_USER_ID,
    lockedAt: null,
    lockedBy: null,
  }));
}

/** Create sample P&L accounts. */
function makePlAccounts() {
  return [
    {
      id: 'acc-4000',
      code: '4000',
      name: 'Sales Revenue',
      accountType: 'REVENUE',
      currentBalance: { toNumber: () => 50000 },
      openingBalance: { toNumber: () => 0 },
      isActive: true,
      isPostable: true,
    },
    {
      id: 'acc-4100',
      code: '4100',
      name: 'Service Revenue',
      accountType: 'REVENUE',
      currentBalance: { toNumber: () => 10000 },
      openingBalance: { toNumber: () => 0 },
      isActive: true,
      isPostable: true,
    },
    {
      id: 'acc-5000',
      code: '5000',
      name: 'Cost of Sales',
      accountType: 'EXPENSE',
      currentBalance: { toNumber: () => 30000 },
      openingBalance: { toNumber: () => 0 },
      isActive: true,
      isPostable: true,
    },
    {
      id: 'acc-7000',
      code: '7000',
      name: 'Salaries',
      accountType: 'EXPENSE',
      currentBalance: { toNumber: () => 15000 },
      openingBalance: { toNumber: () => 0 },
      isActive: true,
      isPostable: true,
    },
  ];
}

/** Journal line aggregates for the year. */
function makeLineAggregates() {
  return [
    {
      accountCode: '4000',
      _sum: { debit: { toNumber: () => 0 }, credit: { toNumber: () => 50000 } },
    },
    {
      accountCode: '4100',
      _sum: { debit: { toNumber: () => 0 }, credit: { toNumber: () => 10000 } },
    },
    {
      accountCode: '5000',
      _sum: { debit: { toNumber: () => 30000 }, credit: { toNumber: () => 0 } },
    },
    {
      accountCode: '7000',
      _sum: { debit: { toNumber: () => 15000 }, credit: { toNumber: () => 0 } },
    },
  ];
}

/** All accounts (for opening balance update). */
function makeAllAccounts() {
  return [
    ...makePlAccounts(),
    {
      id: 'acc-1000',
      code: '1000',
      name: 'Cash',
      accountType: 'ASSET',
      currentBalance: { toNumber: () => 25000 },
      openingBalance: { toNumber: () => 0 },
      isActive: true,
      isPostable: true,
    },
    {
      id: 'acc-3200',
      code: '3200',
      name: 'Retained Earnings',
      accountType: 'EQUITY',
      currentBalance: { toNumber: () => 15000 },
      openingBalance: { toNumber: () => 0 },
      isActive: true,
      isPostable: true,
    },
  ];
}

/**
 * Set up the full mock chain for a successful year-end close.
 * createGlPosting internally uses $transaction, so we mock it to handle both
 * the GL posting transaction and the period-locking transaction.
 */
function setupSuccessfulYearEndMocks() {
  const closedPeriods = makeClosedPeriods();
  const plAccounts = makePlAccounts();
  const allAccounts = makeAllAccounts();

  // financialPeriod.findMany: returns the 12 closed periods
  mockPrisma.financialPeriod.findMany.mockResolvedValue(closedPeriods);

  // chartOfAccount.findMany: first call returns P&L accounts, second returns all
  mockPrisma.chartOfAccount.findMany
    .mockResolvedValueOnce(plAccounts) // P&L accounts lookup
    .mockResolvedValueOnce(allAccounts); // All accounts for opening balance update

  // journalLine.groupBy: P&L aggregates
  mockPrisma.journalLine.groupBy.mockResolvedValue(makeLineAggregates());

  // accountMapping.findFirst: RETAINED_EARNINGS
  mockPrisma.accountMapping.findFirst.mockResolvedValue({
    accountCode: '3200',
  });

  // chartOfAccount.findFirst: verify retained earnings account
  mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
    code: '3200',
    isPostable: true,
    isActive: true,
  });

  // financialPeriod.create: P13 creation
  mockPrisma.financialPeriod.create.mockResolvedValue({
    id: 'period-13',
    periodNumber: 13,
    status: 'OPEN',
    startDate: new Date('2026-12-28'),
    endDate: new Date('2026-12-28'),
    name: 'Year-End Adjustments 2026',
  });

  // Mock $transaction for GL posting, opening balance updates, and period locking
  const mockJournalEntry = {
    id: 'je-yearend-001',
    entryNumber: 'JE-000001',
    transactionDate: new Date('2026-12-28'),
    description: 'Year-end close FY2026',
    reference: 'YE-2026',
    source: 'YEAR_END',
    sourceId: null,
    sourceReference: null,
    isAutoGenerated: true,
    status: 'POSTED',
    postedAt: new Date(),
    postedBy: TEST_USER_ID,
    periodId: 'period-13',
    totalDebit: { toNumber: () => 60000 },
    totalCredit: { toNumber: () => 60000 },
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    reversalOfId: null,
    reversedById: null,
    lines: [
      {
        id: 'line-1',
        lineNumber: 1,
        accountCode: '4000',
        description: 'Year-end close: zero Sales Revenue',
        debit: { toNumber: () => 50000 },
        credit: { toNumber: () => 0 },
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
      {
        id: 'line-2',
        lineNumber: 2,
        accountCode: '4100',
        description: 'Year-end close: zero Service Revenue',
        debit: { toNumber: () => 10000 },
        credit: { toNumber: () => 0 },
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
      {
        id: 'line-3',
        lineNumber: 3,
        accountCode: '5000',
        description: 'Year-end close: zero Cost of Sales',
        debit: { toNumber: () => 0 },
        credit: { toNumber: () => 30000 },
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
      {
        id: 'line-4',
        lineNumber: 4,
        accountCode: '7000',
        description: 'Year-end close: zero Salaries',
        debit: { toNumber: () => 0 },
        credit: { toNumber: () => 15000 },
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
      {
        id: 'line-5',
        lineNumber: 5,
        accountCode: '3200',
        description: 'Year-end close: net profit to Retained Earnings',
        debit: { toNumber: () => 0 },
        credit: { toNumber: () => 15000 },
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
    ],
  };

  // $transaction is used by createGlPosting, opening balance update, and period locking
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      financialPeriod: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'period-13',
          status: 'OPEN',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      chartOfAccount: {
        findMany: vi.fn().mockResolvedValue([
          ...plAccounts.map((a) => ({
            code: a.code,
            isPostable: true,
            isActive: true,
            isControl: false,
            name: a.name,
            accountType: a.accountType,
          })),
          {
            code: '3200',
            isPostable: true,
            isActive: true,
            isControl: false,
            name: 'Retained Earnings',
            accountType: 'EQUITY',
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      journalEntry: {
        create: vi.fn().mockResolvedValue({ id: 'je-yearend-001' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockJournalEntry),
      },
      journalLine: {
        create: vi.fn().mockResolvedValue({ id: 'line-x' }),
      },
      journalLineDimension: {
        create: vi.fn(),
      },
      dimensionType: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      dimensionRequirement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      dimensionValue: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      accountMandatoryDimension: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      numberSeries: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'ns-1', prefix: 'JE-', nextValue: 1, padWidth: 6 }),
        update: vi.fn(),
      },
      systemSetting: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    return fn(tx);
  });
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
// POST /finance/year-end/close — AC-1: Trigger year-end close
// ---------------------------------------------------------------------------

describe('POST /finance/year-end/close', () => {
  it('performs year-end close successfully with correct journal entry (AC-1, AC-2, AC-3)', async () => {
    app = await buildTestApp();
    setupSuccessfulYearEndMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.fiscalYear).toBe(TEST_FISCAL_YEAR);
    expect(body.data.journalEntryId).toBeTruthy();
    expect(body.data.journalEntryNumber).toBeTruthy();
    expect(body.data.p13PeriodId).toBeTruthy();
    expect(body.data.retainedEarningsAccountCode).toBe('3200');
    // Net profit = Revenue (50000 + 10000) - Expenses (30000 + 15000) = 15000
    expect(body.data.netProfitLoss).toBe(15000);
    expect(body.data.closedAt).toBeTruthy();
    expect(body.data.closedBy).toBe(TEST_USER_ID);
  });

  // -----------------------------------------------------------------------
  // AC-5: Validates all periods are CLOSED
  // -----------------------------------------------------------------------

  it('returns 422 when some periods are still OPEN (AC-5)', async () => {
    app = await buildTestApp();
    const periods = makeClosedPeriods();
    // Make period 3 and 7 still OPEN
    periods[2]!.status = 'OPEN';
    periods[6]!.status = 'OPEN';
    mockPrisma.financialPeriod.findMany.mockResolvedValue(periods);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('PERIODS_NOT_CLOSED');
    expect(body.error.message).toContain('OPEN');
  });

  it('returns 404 when no periods exist for fiscal year', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NO_PERIODS_FOUND');
  });

  it('returns 409 when all periods are already LOCKED (year-end already done)', async () => {
    app = await buildTestApp();
    const periods = makeClosedPeriods();
    for (const p of periods) {
      p.status = 'LOCKED';
    }
    mockPrisma.financialPeriod.findMany.mockResolvedValue(periods);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('YEAR_ALREADY_CLOSED');
  });

  // -----------------------------------------------------------------------
  // AC-3: Retained Earnings mapping required
  // -----------------------------------------------------------------------

  it('returns 422 when RETAINED_EARNINGS mapping is not configured (AC-3)', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findMany.mockResolvedValue(makeClosedPeriods());
    mockPrisma.financialPeriod.create.mockResolvedValue({
      id: 'period-13',
      periodNumber: 13,
      status: 'OPEN',
      startDate: new Date('2026-12-28'),
      endDate: new Date('2026-12-28'),
      name: 'Year-End Adjustments 2026',
    });
    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makePlAccounts());
    mockPrisma.journalLine.groupBy.mockResolvedValue(makeLineAggregates());
    mockPrisma.accountMapping.findFirst.mockResolvedValue(null); // No mapping!

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('RETAINED_EARNINGS_NOT_MAPPED');
  });

  // -----------------------------------------------------------------------
  // AC-6: Creates P13 if it doesn't exist
  // -----------------------------------------------------------------------

  it('creates P13 period when it does not exist (AC-6)', async () => {
    app = await buildTestApp();
    setupSuccessfulYearEndMocks();

    await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    // Verify P13 was created
    expect(mockPrisma.financialPeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          periodNumber: 13,
          fiscalYear: TEST_FISCAL_YEAR,
          status: 'OPEN',
        }),
      }),
    );
  });

  it('uses existing P13 if already present (AC-6)', async () => {
    app = await buildTestApp();

    const closedPeriods = makeClosedPeriods();
    // Add an existing P13
    const p13 = {
      id: 'existing-period-13',
      companyId: TEST_COMPANY_ID,
      name: 'Year-End Adjustments 2026',
      periodNumber: 13,
      fiscalYear: TEST_FISCAL_YEAR,
      startDate: new Date('2026-12-28'),
      endDate: new Date('2026-12-28'),
      status: 'OPEN',
      closedAt: null,
      closedBy: null,
      lockedAt: null,
      lockedBy: null,
    };
    mockPrisma.financialPeriod.findMany.mockResolvedValue([...closedPeriods, p13]);

    // Set up the rest of the mocks
    mockPrisma.chartOfAccount.findMany
      .mockResolvedValueOnce(makePlAccounts())
      .mockResolvedValueOnce(makeAllAccounts());
    mockPrisma.journalLine.groupBy.mockResolvedValue(makeLineAggregates());
    mockPrisma.accountMapping.findFirst.mockResolvedValue({ accountCode: '3200' });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      code: '3200',
      isPostable: true,
      isActive: true,
    });

    const mockJournalEntry = {
      id: 'je-yearend-002',
      entryNumber: 'JE-000002',
      transactionDate: new Date('2026-12-28'),
      description: 'Year-end close FY2026',
      reference: 'YE-2026',
      source: 'YEAR_END',
      sourceId: null,
      sourceReference: null,
      isAutoGenerated: true,
      status: 'POSTED',
      postedAt: new Date(),
      postedBy: TEST_USER_ID,
      periodId: 'existing-period-13',
      totalDebit: { toNumber: () => 60000 },
      totalCredit: { toNumber: () => 60000 },
      createdBy: TEST_USER_ID,
      updatedBy: TEST_USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      reversalOfId: null,
      reversedById: null,
      lines: [],
    };

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        financialPeriod: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing-period-13', status: 'OPEN' }),
          update: vi.fn().mockResolvedValue({}),
        },
        chartOfAccount: {
          findMany: vi.fn().mockResolvedValue([
            ...makePlAccounts().map((a) => ({
              code: a.code,
              isPostable: true,
              isActive: true,
              isControl: false,
              name: a.name,
              accountType: a.accountType,
            })),
            {
              code: '3200',
              isPostable: true,
              isActive: true,
              isControl: false,
              name: 'Retained Earnings',
              accountType: 'EQUITY',
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
        journalEntry: {
          create: vi.fn().mockResolvedValue({ id: 'je-yearend-002' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockJournalEntry),
        },
        journalLine: {
          create: vi.fn().mockResolvedValue({ id: 'line-x' }),
        },
        journalLineDimension: {
          create: vi.fn(),
        },
        dimensionType: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        dimensionRequirement: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        dimensionValue: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        accountMandatoryDimension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        numberSeries: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'ns-1', prefix: 'JE-', nextValue: 2, padWidth: 6 }),
          update: vi.fn(),
        },
        systemSetting: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };
      return fn(tx);
    });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.p13PeriodId).toBe('existing-period-13');
    // P13 should NOT have been created (uses existing)
    expect(mockPrisma.financialPeriod.create).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // AC-7: Locks all periods after close
  // -----------------------------------------------------------------------

  it('locks all periods for the year after close (AC-7)', async () => {
    app = await buildTestApp();
    setupSuccessfulYearEndMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // 12 regular + 1 P13 = 13 periods locked
    expect(body.data.periodsLocked).toBe(13);

    // Verify $transaction was called for period locking
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Auth tests
  // -----------------------------------------------------------------------

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(401);
  });

  // -----------------------------------------------------------------------
  // Validation tests
  // -----------------------------------------------------------------------

  it('returns 400 for invalid fiscal year', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: 1999 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when fiscal year is missing', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  // -----------------------------------------------------------------------
  // AC-4: Balance sheet carry forward
  // -----------------------------------------------------------------------

  it('updates opening balances for next year (AC-4)', async () => {
    app = await buildTestApp();
    setupSuccessfulYearEndMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(200);

    // The opening balance update happens in a $transaction call
    // Verify $transaction was called (for opening balance update + period locking)
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Incomplete fiscal year
  // -----------------------------------------------------------------------

  it('returns 422 when fiscal year has fewer than 12 periods', async () => {
    app = await buildTestApp();
    // Only 6 periods
    const partialPeriods = makeClosedPeriods().slice(0, 6);
    mockPrisma.financialPeriod.findMany.mockResolvedValue(partialPeriods);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/year-end/close',
      headers: { authorization: `Bearer ${testJwt}` },
      payload: { fiscalYear: TEST_FISCAL_YEAR },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('INCOMPLETE_FISCAL_YEAR');
  });
});
