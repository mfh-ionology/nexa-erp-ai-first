import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockEventBus, mockNextNumber } =
  vi.hoisted(() => ({
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
      chartOfAccount: { findMany: vi.fn(), update: vi.fn() },
      financialPeriod: { findFirst: vi.fn(), findMany: vi.fn() },
      journalEntry: { findFirst: vi.fn(), create: vi.fn(), findUniqueOrThrow: vi.fn() },
      journalLine: { create: vi.fn() },
      journalLineDimension: { create: vi.fn() },
      accountMapping: { findFirst: vi.fn() },
      dimensionRequirement: { findMany: vi.fn() },
      dimensionValue: { findMany: vi.fn() },
      dimensionBalance: { upsert: vi.fn() },
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
    mockNextNumber: vi.fn(),
  }));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  nextNumber: mockNextNumber,
  Prisma: {
    Decimal: class MockDecimal {
      private value: string;
      constructor(val: string | number) {
        this.value = String(val);
      }
      toString() {
        return this.value;
      }
      toNumber() {
        return parseFloat(this.value);
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
import { openingBalancesRoutesPlugin } from './opening-balances.routes.js';
import { parseOpeningBalancesCsv } from './opening-balances.service.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_PERIOD_ID = '33333333-3333-4000-a000-333333333333';
const TEST_JOURNAL_ID = '44444444-4444-4000-a000-444444444444';

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET);

// ---------------------------------------------------------------------------
// Sample CSV data
// ---------------------------------------------------------------------------

const VALID_CSV = `AccountCode,Debit,Credit
1000,50000.00,0
1100,25000.00,0
2100,0,30000.00
3200,0,45000.00`;

const BALANCED_CSV = `AccountCode,Debit,Credit
1000,50000.00,0
1100,25000.00,0
2100,0,30000.00
3200,0,45000.00`;

const UNBALANCED_CSV = `AccountCode,Debit,Credit
1000,50000.00,0
1100,25000.00,0
2100,0,20000.00`;

const INVALID_HEADER_CSV = `Code,Amount
1000,50000.00`;

const EMPTY_DATA_CSV = `AccountCode,Debit,Credit
1000,0,0
2000,0,0`;

const NEGATIVE_AMOUNT_CSV = `AccountCode,Debit,Credit
1000,-500.00,0`;

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
  await app.register(openingBalancesRoutesPlugin, { prefix: '/finance' });

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
          ? { 'finance.accounts': fullPerm, 'finance.bankAccounts': fullPerm }
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

/**
 * Set up mocks for a successful opening balance import.
 * Configures period lookup, account validation, no existing OB, and GL posting.
 */
function setupSuccessfulImportMocks(options?: {
  existingOpeningBalance?: boolean;
  suspenseAccountCode?: string;
  unbalanced?: boolean;
}) {
  const { existingOpeningBalance = false, suspenseAccountCode = '9999' } = options ?? {};

  // Period lookup by transaction date
  mockPrisma.financialPeriod.findFirst.mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown> | undefined;
    // For fiscal year start date lookup (status: 'OPEN')
    if (where && where.status === 'OPEN') {
      return {
        startDate: new Date('2026-04-01'),
        fiscalYear: 2026,
        id: TEST_PERIOD_ID,
      };
    }
    // For period lookup by date range (used by createGlPosting and checkExisting)
    return {
      id: TEST_PERIOD_ID,
      status: 'OPEN',
      fiscalYear: 2026,
      periodNumber: 1,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
    };
  });

  // Periods in fiscal year (for checkExistingOpeningBalance)
  mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: TEST_PERIOD_ID }]);

  // Existing opening balance check (AC-5)
  mockPrisma.journalEntry.findFirst.mockResolvedValue(
    existingOpeningBalance ? { id: 'existing-ob-id', entryNumber: 'JE-0001' } : null,
  );

  // Account validation — all accounts exist and are postable
  mockPrisma.chartOfAccount.findMany.mockResolvedValue([
    { code: '1000', isActive: true, isPostable: true, isControl: false },
    { code: '1100', isActive: true, isPostable: true, isControl: false },
    { code: '2100', isActive: true, isPostable: true, isControl: false },
    { code: '3200', isActive: true, isPostable: true, isControl: false },
    { code: suspenseAccountCode, isActive: true, isPostable: true, isControl: false },
  ]);

  // Suspense account mapping lookup
  mockPrisma.accountMapping.findFirst.mockResolvedValue({
    accountCode: suspenseAccountCode,
  });

  // Dimension requirements (none)
  mockPrisma.dimensionRequirement.findMany.mockResolvedValue([]);

  // Account balance update (called by updateAccountBalances inside createGlPosting)
  mockPrisma.chartOfAccount.update.mockResolvedValue({});

  // Dimension balance upsert (called by updateDimensionBalances inside createGlPosting)
  mockPrisma.dimensionBalance.upsert.mockResolvedValue({});

  // Next number generation
  mockNextNumber.mockResolvedValue('JE-0042');

  // $transaction mock — execute the function with mockPrisma as the tx
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      return fn(mockPrisma);
    },
  );

  // Journal entry create
  mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_JOURNAL_ID });

  // Journal line create
  let lineIndex = 0;
  mockPrisma.journalLine.create.mockImplementation(async () => {
    lineIndex++;
    return { id: `line-${lineIndex}` };
  });

  // Journal entry findUniqueOrThrow — return full detail
  mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue({
    id: TEST_JOURNAL_ID,
    entryNumber: 'JE-0042',
    transactionDate: new Date('2026-04-01'),
    description: 'Opening Balances',
    reference: null,
    source: 'OPENING_BALANCE',
    sourceId: null,
    sourceReference: 'OPENING_BALANCE_IMPORT',
    status: 'POSTED',
    periodId: TEST_PERIOD_ID,
    totalDebit: 75000,
    totalCredit: 75000,
    postedAt: new Date(),
    postedBy: TEST_USER_ID,
    reversalOfId: null,
    isAutoGenerated: true,
    templateId: null,
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'line-1',
        lineNumber: 1,
        accountCode: '1000',
        description: 'Opening Balance',
        debit: 50000,
        credit: 0,
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
      {
        id: 'line-2',
        lineNumber: 2,
        accountCode: '1100',
        description: 'Opening Balance',
        debit: 25000,
        credit: 0,
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
      {
        id: 'line-3',
        lineNumber: 3,
        accountCode: '2100',
        description: 'Opening Balance',
        debit: 0,
        credit: 30000,
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
      {
        id: 'line-4',
        lineNumber: 4,
        accountCode: '3200',
        description: 'Opening Balance',
        debit: 0,
        credit: 45000,
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
    ],
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
// Unit tests: CSV Parser
// ---------------------------------------------------------------------------

describe('parseOpeningBalancesCsv', () => {
  it('parses valid CSV with AccountCode, Debit, Credit columns', () => {
    const result = parseOpeningBalancesCsv(VALID_CSV);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ accountCode: '1000', debit: 50000, credit: 0 });
    expect(result[1]).toEqual({ accountCode: '1100', debit: 25000, credit: 0 });
    expect(result[2]).toEqual({ accountCode: '2100', debit: 0, credit: 30000 });
    expect(result[3]).toEqual({ accountCode: '3200', debit: 0, credit: 45000 });
  });

  it('handles empty debit/credit fields as zero', () => {
    const csv = `AccountCode,Debit,Credit
1000,50000.00,
2100,,30000.00`;

    const result = parseOpeningBalancesCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ accountCode: '1000', debit: 50000, credit: 0 });
    expect(result[1]).toEqual({ accountCode: '2100', debit: 0, credit: 30000 });
  });

  it('skips lines where both debit and credit are zero', () => {
    const csv = `AccountCode,Debit,Credit
1000,50000.00,0
2100,0,0
3200,0,45000.00`;

    const result = parseOpeningBalancesCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].accountCode).toBe('1000');
    expect(result[1].accountCode).toBe('3200');
  });

  it('handles Windows line endings (CRLF)', () => {
    const csv = 'AccountCode,Debit,Credit\r\n1000,50000.00,0\r\n';
    const result = parseOpeningBalancesCsv(csv);
    expect(result).toHaveLength(1);
  });

  it('handles quoted fields', () => {
    const csv = `AccountCode,Debit,Credit
"1000",50000.00,0`;
    const result = parseOpeningBalancesCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].accountCode).toBe('1000');
  });

  it('is case-insensitive on header', () => {
    const csv = `accountcode,debit,credit
1000,1000.00,0`;
    const result = parseOpeningBalancesCsv(csv);
    expect(result).toHaveLength(1);
  });

  it('throws on invalid header', () => {
    expect(() => parseOpeningBalancesCsv(INVALID_HEADER_CSV)).toThrow(
      'CSV header must contain: AccountCode, Debit, Credit',
    );
  });

  it('throws on header-only CSV', () => {
    expect(() => parseOpeningBalancesCsv('AccountCode,Debit,Credit')).toThrow(
      'CSV must have a header row and at least one data row',
    );
  });

  it('throws on empty data rows (all whitespace)', () => {
    expect(() => parseOpeningBalancesCsv(EMPTY_DATA_CSV)).toThrow(
      'CSV contains no valid data rows',
    );
  });

  it('throws on negative debit amount', () => {
    expect(() => parseOpeningBalancesCsv(NEGATIVE_AMOUNT_CSV)).toThrow('debit must be >= 0');
  });

  it('throws on invalid debit amount', () => {
    const csv = `AccountCode,Debit,Credit
1000,abc,0`;
    expect(() => parseOpeningBalancesCsv(csv)).toThrow('invalid debit amount');
  });

  it('throws on invalid credit amount', () => {
    const csv = `AccountCode,Debit,Credit
1000,0,xyz`;
    expect(() => parseOpeningBalancesCsv(csv)).toThrow('invalid credit amount');
  });

  it('throws on missing account code', () => {
    const csv = `AccountCode,Debit,Credit
,5000.00,0`;
    expect(() => parseOpeningBalancesCsv(csv)).toThrow('AccountCode is required');
  });

  it('throws on row with too few fields', () => {
    const csv = `AccountCode,Debit,Credit
1000,5000.00`;
    expect(() => parseOpeningBalancesCsv(csv)).toThrow('expected at least 3 fields');
  });
});

// ---------------------------------------------------------------------------
// POST /finance/opening-balances/import — AC-1: CSV import
// ---------------------------------------------------------------------------

describe('POST /finance/opening-balances/import', () => {
  it('imports balanced CSV and creates OPENING_BALANCE journal entry (AC-1)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: BALANCED_CSV,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.journalEntry).toBeDefined();
    expect(body.data.journalEntry.source).toBe('OPENING_BALANCE');
    expect(body.data.journalEntry.status).toBe('POSTED');
    expect(body.data.lineCount).toBe(4);
  });

  it('validates all account codes exist and are postable (AC-3)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    // Override chartOfAccount to have a missing account
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1000', isActive: true, isPostable: true, isControl: false },
      // 1100 missing!
      { code: '2100', isActive: true, isPostable: true, isControl: false },
      { code: '3200', isActive: true, isPostable: true, isControl: false },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: BALANCED_CSV,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('adds suspense line when unbalanced (AC-4)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: UNBALANCED_CSV,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.suspenseAdded).toBe(true);
    expect(body.data.suspenseAmount).toBeGreaterThan(0);
  });

  it('rejects duplicate opening balance for same fiscal year (AC-5)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks({ existingOpeningBalance: true });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: BALANCED_CSV,
      },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('OPENING_BALANCE_EXISTS');
  });

  it('returns 400 for invalid CSV content', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: 'not a valid csv',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for empty csv field', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('accepts optional transactionDate override', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: BALANCED_CSV,
        transactionDate: '2026-04-01',
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('accepts optional description override', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        csv: BALANCED_CSV,
        description: 'Custom Opening Balances 2026/27',
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: { 'content-type': 'application/json' },
      payload: { csv: BALANCED_CSV },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
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
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { csv: BALANCED_CSV },
    });

    expect(res.statusCode).toBe(403);
  });

  it('uses createGlPosting with source=OPENING_BALANCE', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { csv: BALANCED_CSV },
    });

    // createGlPosting is called inside $transaction — verify journal entry was created
    expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(1);
    const createCall = mockPrisma.journalEntry.create.mock.calls[0][0];
    expect(createCall.data.source).toBe('OPENING_BALANCE');
    expect(createCall.data.sourceReference).toBe('OPENING_BALANCE_IMPORT');
    expect(createCall.data.isAutoGenerated).toBe(true);
    expect(createCall.data.status).toBe('POSTED');
  });

  it('creates journal lines for each CSV row', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { csv: BALANCED_CSV },
    });

    // 4 CSV rows = 4 journal lines (balanced, no suspense)
    expect(mockPrisma.journalLine.create).toHaveBeenCalledTimes(4);

    const lineCalls = mockPrisma.journalLine.create.mock.calls;
    expect(lineCalls[0][0].data.accountCode).toBe('1000');
    expect(lineCalls[0][0].data.debit).toBe(50000);
    expect(lineCalls[0][0].data.credit).toBe(0);

    expect(lineCalls[1][0].data.accountCode).toBe('1100');
    expect(lineCalls[2][0].data.accountCode).toBe('2100');
    expect(lineCalls[3][0].data.accountCode).toBe('3200');
  });
});

// ---------------------------------------------------------------------------
// POST /finance/opening-balances/manual — AC-2: Manual entry
// ---------------------------------------------------------------------------

describe('POST /finance/opening-balances/manual', () => {
  it('creates OPENING_BALANCE journal from manual line entry (AC-2)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          { accountCode: '1000', debit: 50000, credit: 0 },
          { accountCode: '1100', debit: 25000, credit: 0 },
          { accountCode: '2100', debit: 0, credit: 30000 },
          { accountCode: '3200', debit: 0, credit: 45000 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.journalEntry).toBeDefined();
    expect(body.data.journalEntry.source).toBe('OPENING_BALANCE');
    expect(body.data.lineCount).toBe(4);
  });

  it('adds suspense line for unbalanced manual entry (AC-4)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          { accountCode: '1000', debit: 50000, credit: 0 },
          { accountCode: '2100', debit: 0, credit: 20000 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.suspenseAdded).toBe(true);
    expect(body.data.suspenseAmount).toBe(30000);
  });

  it('rejects duplicate opening balance for same fiscal year (AC-5)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks({ existingOpeningBalance: true });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          { accountCode: '1000', debit: 50000, credit: 0 },
          { accountCode: '3200', debit: 0, credit: 50000 },
        ],
      },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('OPENING_BALANCE_EXISTS');
  });

  it('returns 400 for empty lines array', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing lines field', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('validates all account codes exist (AC-3)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    // Override chartOfAccount to have missing accounts
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1000', isActive: true, isPostable: true, isControl: false },
      // 9999 (suspense) still present for the unbalanced case
      { code: '9999', isActive: true, isPostable: true, isControl: false },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          { accountCode: '1000', debit: 50000, credit: 0 },
          { accountCode: 'NONEXISTENT', debit: 0, credit: 50000 },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('accepts optional transactionDate and description', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          { accountCode: '1000', debit: 50000, credit: 0 },
          { accountCode: '3200', debit: 0, credit: 50000 },
        ],
        transactionDate: '2026-04-01',
        description: 'Opening Balances FY 2026/27',
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: { 'content-type': 'application/json' },
      payload: {
        lines: [
          { accountCode: '1000', debit: 50000, credit: 0 },
          { accountCode: '3200', debit: 0, credit: 50000 },
        ],
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
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
      method: 'POST',
      url: '/finance/opening-balances/manual',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          { accountCode: '1000', debit: 50000, credit: 0 },
          { accountCode: '3200', debit: 0, credit: 50000 },
        ],
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
