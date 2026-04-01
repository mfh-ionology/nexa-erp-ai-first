import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';
import FormData from 'form-data';

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
    chartOfAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    journalEntry: {
      create: vi.fn(),
    },
    financialPeriod: {
      findFirst: vi.fn(),
    },
    budget: {
      findFirst: vi.fn(),
    },
    budgetLine: {
      upsert: vi.fn(),
    },
    exchangeRate: {
      upsert: vi.fn(),
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
      constructor(val: number | string) {
        this.value = typeof val === 'string' ? parseFloat(val) : val;
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
import { importRoutesPlugin } from './import.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_BUDGET_ID = '33333333-3333-4000-a000-333333333333';
const TEST_PERIOD_ID = '44444444-4444-4000-a000-444444444444';

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
  await app.register(importRoutesPlugin, { prefix: '/finance' });

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
              'finance.accounts': fullPerm,
              'finance.journals': fullPerm,
              'finance.budgets': fullPerm,
              'finance.exchangeRates': fullPerm,
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

/**
 * Build a multipart/form-data payload for injection.
 * Returns { payload, headers } suitable for app.inject().
 */
function buildMultipart(
  csvContent: string,
  filename = 'data.csv',
  extraFields?: Record<string, string>,
): { payload: Buffer; headers: Record<string, string> } {
  const form = new FormData();

  // Add extra fields before file
  if (extraFields) {
    for (const [key, val] of Object.entries(extraFields)) {
      form.append(key, val);
    }
  }

  form.append('file', Buffer.from(csvContent), {
    filename,
    contentType: 'text/csv',
  });

  const payload = form.getBuffer();
  const headers = form.getHeaders();

  return { payload, headers };
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
// POST /finance/accounts/import — Account CSV Import
// ---------------------------------------------------------------------------

describe('POST /finance/accounts/import', () => {
  it('imports valid CSV and returns count', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.upsert.mockResolvedValue({ id: 'new-id' });

    const csv =
      'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n' +
      '9001,Test Import Account,ASSET,DEBIT,,,,true\n';

    const { payload, headers } = buildMultipart(csv, 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.imported).toBe(1);
    expect(body.data.errors).toHaveLength(0);
    expect(mockPrisma.chartOfAccount.upsert).toHaveBeenCalledTimes(1);
  });

  it('imports multiple rows', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.upsert.mockResolvedValue({ id: 'new-id' });

    const csv =
      'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n' +
      '9001,Cash,ASSET,DEBIT,,,,true\n' +
      '9002,Bank,ASSET,DEBIT,,,,true\n' +
      '9003,Revenue,REVENUE,CREDIT,,,,true\n';

    const { payload, headers } = buildMultipart(csv, 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(3);
    expect(body.data.errors).toHaveLength(0);
  });

  it('returns row-level errors for invalid rows', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.upsert.mockResolvedValue({ id: 'new-id' });

    const csv =
      'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n' +
      ',Missing Code,ASSET,DEBIT,,,,true\n' +
      '9002,Valid Row,ASSET,DEBIT,,,,true\n';

    const { payload, headers } = buildMultipart(csv, 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(1);
    expect(body.data.errors.length).toBeGreaterThan(0);
    expect(body.data.errors[0].row).toBe(2);
  });

  it('returns imported: 0 for empty CSV (header only)', async () => {
    app = await buildTestApp();

    const csv =
      'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n';

    const { payload, headers } = buildMultipart(csv, 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.errors).toHaveLength(0);
  });

  it('returns 400 when no file uploaded', async () => {
    app = await buildTestApp();

    // Send without multipart content
    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: '{}',
    });

    // Fastify multipart will throw or return 400
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const csv =
      'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n';
    const { payload, headers } = buildMultipart(csv, 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { ...headers },
      payload,
    });

    expect(res.statusCode).toBe(401);
  });

  it('captures Prisma errors per-row without aborting', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.upsert
      .mockResolvedValueOnce({ id: 'ok-1' })
      .mockRejectedValueOnce(new Error('Unique constraint violation'))
      .mockResolvedValueOnce({ id: 'ok-2' });

    const csv =
      'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n' +
      '9001,First,ASSET,DEBIT,,,,true\n' +
      '9002,Dupe,ASSET,DEBIT,,,,true\n' +
      '9003,Third,ASSET,DEBIT,,,,true\n';

    const { payload, headers } = buildMultipart(csv, 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(2);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0].row).toBe(3); // Row 3 failed
    expect(body.data.errors[0].message).toContain('Unique constraint');
  });
});

// ---------------------------------------------------------------------------
// POST /finance/journals/import — Journal CSV Import
// ---------------------------------------------------------------------------

describe('POST /finance/journals/import', () => {
  it('groups CSV rows by date+description+reference into journal entries', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
    });
    mockPrisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });

    // Two lines for same journal, two lines for another
    const csv =
      'transactionDate,description,reference,accountCode,debit,credit,vatCode\n' +
      '2026-01-15,Office Supplies,INV-001,6000,100.00,0.00,\n' +
      '2026-01-15,Office Supplies,INV-001,2100,0.00,100.00,\n' +
      '2026-01-20,Salary Payment,PAY-001,5000,5000.00,0.00,\n' +
      '2026-01-20,Salary Payment,PAY-001,1000,0.00,5000.00,\n';

    const { payload, headers } = buildMultipart(csv, 'journals.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(2); // 2 journal entries
    expect(body.data.errors).toHaveLength(0);
    expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(2);
  });

  it('rejects unbalanced journal lines', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
    });

    const csv =
      'transactionDate,description,reference,accountCode,debit,credit,vatCode\n' +
      '2026-01-15,Unbalanced,REF-1,6000,100.00,0.00,\n' +
      '2026-01-15,Unbalanced,REF-1,2100,0.00,50.00,\n';

    const { payload, headers } = buildMultipart(csv, 'journals.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.errors.length).toBeGreaterThan(0);
    expect(body.data.errors[0].message).toContain('unbalanced');
  });

  it('reports error when no financial period found', async () => {
    app = await buildTestApp();
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const csv =
      'transactionDate,description,reference,accountCode,debit,credit,vatCode\n' +
      '2099-01-15,Future Entry,,6000,100.00,0.00,\n' +
      '2099-01-15,Future Entry,,2100,0.00,100.00,\n';

    const { payload, headers } = buildMultipart(csv, 'journals.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.errors.length).toBeGreaterThan(0);
    expect(body.data.errors[0].message).toContain('No financial period');
  });

  it('returns row-level errors for invalid journal rows', async () => {
    app = await buildTestApp();

    const csv =
      'transactionDate,description,reference,accountCode,debit,credit,vatCode\n' +
      'not-a-date,Bad Row,,6000,100.00,0.00,\n';

    const { payload, headers } = buildMultipart(csv, 'journals.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.errors.length).toBeGreaterThan(0);
    expect(body.data.errors[0].row).toBe(2);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const csv = 'transactionDate,description,reference,accountCode,debit,credit,vatCode\n';
    const { payload, headers } = buildMultipart(csv, 'journals.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals/import',
      headers: { ...headers },
      payload,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/budgets/import — Budget CSV Import
// ---------------------------------------------------------------------------

describe('POST /finance/budgets/import', () => {
  it('imports budget lines for an existing budget', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue({ id: TEST_BUDGET_ID });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1' });
    mockPrisma.budgetLine.upsert.mockResolvedValue({ id: 'bl-1' });

    const csv =
      'accountCode,period1,period2,period3,period4,period5,period6,period7,period8,period9,period10,period11,period12\n' +
      '6000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000\n';

    const { payload, headers } = buildMultipart(csv, 'budget.csv', { budgetId: TEST_BUDGET_ID });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(1);
    expect(body.data.errors).toHaveLength(0);
    expect(mockPrisma.budgetLine.upsert).toHaveBeenCalledTimes(1);
  });

  it('returns error when account not found', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue({ id: TEST_BUDGET_ID });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null); // account not found

    const csv =
      'accountCode,period1,period2,period3,period4,period5,period6,period7,period8,period9,period10,period11,period12\n' +
      '9999,100,100,100,100,100,100,100,100,100,100,100,100\n';

    const { payload, headers } = buildMultipart(csv, 'budget.csv', { budgetId: TEST_BUDGET_ID });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.errors.length).toBeGreaterThan(0);
    expect(body.data.errors[0].message).toContain('9999');
    expect(body.data.errors[0].message).toContain('not found');
  });

  it('returns 404 when budget not found', async () => {
    app = await buildTestApp();
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const csv =
      'accountCode,period1,period2,period3,period4,period5,period6,period7,period8,period9,period10,period11,period12\n' +
      '6000,100,100,100,100,100,100,100,100,100,100,100,100\n';

    const { payload, headers } = buildMultipart(csv, 'budget.csv', { budgetId: 'nonexistent-id' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when budgetId field is missing', async () => {
    app = await buildTestApp();

    const csv =
      'accountCode,period1,period2,period3,period4,period5,period6,period7,period8,period9,period10,period11,period12\n' +
      '6000,100,100,100,100,100,100,100,100,100,100,100,100\n';

    // No budgetId extra field
    const { payload, headers } = buildMultipart(csv, 'budget.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('MISSING_BUDGET_ID');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const csv =
      'accountCode,period1,period2,period3,period4,period5,period6,period7,period8,period9,period10,period11,period12\n';
    const { payload, headers } = buildMultipart(csv, 'budget.csv', { budgetId: TEST_BUDGET_ID });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets/import',
      headers: { ...headers },
      payload,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/exchange-rates/import — Exchange Rate CSV Import
// ---------------------------------------------------------------------------

describe('POST /finance/exchange-rates/import', () => {
  it('imports valid exchange rates and returns count', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.upsert.mockResolvedValue({ id: 'rate-1' });

    const csv =
      'currencyCode,rateDate,buyRate,sellRate,midRate,source\n' +
      'USD,2026-01-15,1.262,1.268,1.265,MANUAL\n' +
      'EUR,2026-01-15,1.168,1.174,1.171,MANUAL\n';

    const { payload, headers } = buildMultipart(csv, 'rates.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(2);
    expect(body.data.errors).toHaveLength(0);
    expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledTimes(2);
  });

  it('upserts — importing same currency+date twice updates rather than duplicates', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.upsert.mockResolvedValue({ id: 'rate-1' });

    const csv =
      'currencyCode,rateDate,buyRate,sellRate,midRate,source\n' +
      'USD,2026-01-15,1.270,1.275,1.272,MANUAL\n';

    const { payload, headers } = buildMultipart(csv, 'rates.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(1);

    // Verify upsert was called with the correct where clause
    expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId_currencyCode_rateDate: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
            currencyCode: 'USD',
          }),
        }),
      }),
    );
  });

  it('returns row-level errors for invalid exchange rate rows', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.upsert.mockResolvedValue({ id: 'rate-1' });

    const csv =
      'currencyCode,rateDate,buyRate,sellRate,midRate,source\n' +
      'US,2026-01-15,1.262,1.268,1.265,MANUAL\n' + // Invalid: currency too short
      'EUR,2026-01-15,1.168,1.174,1.171,MANUAL\n'; // Valid

    const { payload, headers } = buildMultipart(csv, 'rates.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(1);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0].row).toBe(2);
  });

  it('rejects negative rates', async () => {
    app = await buildTestApp();

    const csv =
      'currencyCode,rateDate,buyRate,sellRate,midRate,source\n' +
      'USD,2026-01-15,-1.262,1.268,1.265,MANUAL\n';

    const { payload, headers } = buildMultipart(csv, 'rates.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.errors).toHaveLength(1);
  });

  it('defaults source to MANUAL when not specified', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.upsert.mockResolvedValue({ id: 'rate-1' });

    const csv =
      'currencyCode,rateDate,buyRate,sellRate,midRate,source\n' +
      'USD,2026-01-15,1.262,1.268,1.265,\n';

    const { payload, headers } = buildMultipart(csv, 'rates.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/import',
      headers: { authorization: `Bearer ${testJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.imported).toBe(1);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const csv = 'currencyCode,rateDate,buyRate,sellRate,midRate,source\n';
    const { payload, headers } = buildMultipart(csv, 'rates.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/import',
      headers: { ...headers },
      payload,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission enforcement
// ---------------------------------------------------------------------------

describe('Import permission enforcement', () => {
  it('returns 403 for VIEWER role on POST /accounts/import', async () => {
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

    const csv =
      'code,name,accountType,normalBalance,parentCode,classificationCode,taxCode,isPostable\n' +
      '9001,Test,ASSET,DEBIT,,,,true\n';
    const { payload, headers } = buildMultipart(csv, 'accounts.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts/import',
      headers: { authorization: `Bearer ${viewerJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /journals/import', async () => {
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

    const csv = 'transactionDate,description,reference,accountCode,debit,credit,vatCode\n';
    const { payload, headers } = buildMultipart(csv, 'journals.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals/import',
      headers: { authorization: `Bearer ${viewerJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /budgets/import', async () => {
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

    const csv =
      'accountCode,period1,period2,period3,period4,period5,period6,period7,period8,period9,period10,period11,period12\n';
    const { payload, headers } = buildMultipart(csv, 'budget.csv', { budgetId: TEST_BUDGET_ID });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/budgets/import',
      headers: { authorization: `Bearer ${viewerJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /exchange-rates/import', async () => {
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

    const csv = 'currencyCode,rateDate,buyRate,sellRate,midRate,source\n';
    const { payload, headers } = buildMultipart(csv, 'rates.csv');

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/import',
      headers: { authorization: `Bearer ${viewerJwt}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Import service unit tests
// ---------------------------------------------------------------------------

describe('parseCsv', () => {
  it('parses CSV buffer into row objects', async () => {
    // Dynamic import to test the service directly
    const { parseCsv } = await import('./import.service.js');

    const csv = 'code,name,amount\nA001,Test,100\nA002,Other,200';
    const result = parseCsv(Buffer.from(csv));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ code: 'A001', name: 'Test', amount: '100' });
    expect(result[1]).toEqual({ code: 'A002', name: 'Other', amount: '200' });
  });

  it('skips empty lines', async () => {
    const { parseCsv } = await import('./import.service.js');

    const csv = 'code,name\nA001,Test\n\nA002,Other\n\n';
    const result = parseCsv(Buffer.from(csv));

    expect(result).toHaveLength(2);
  });

  it('trims whitespace from values', async () => {
    const { parseCsv } = await import('./import.service.js');

    const csv = 'code,name\n  A001  ,  Test  \n';
    const result = parseCsv(Buffer.from(csv));

    expect(result[0]).toEqual({ code: 'A001', name: 'Test' });
  });
});
