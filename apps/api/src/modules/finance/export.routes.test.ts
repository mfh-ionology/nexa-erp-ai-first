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
    journalEntry: {
      findMany: vi.fn(),
    },
    simulationLine: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    budget: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
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
import { exportRoutesPlugin } from './export.routes.js';

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
  await app.register(exportRoutesPlugin, { prefix: '/finance' });

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
      code: '4000',
      name: 'Sales Revenue',
      accountType: 'REVENUE',
      normalBalance: 'CREDIT',
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
// GET /finance/reports/trial-balance/export
// ---------------------------------------------------------------------------

describe('GET /finance/reports/trial-balance/export', () => {
  it('returns CSV file with correct headers', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([
      { id: PERIOD_ID_1 },
      { id: PERIOD_ID_2 },
    ]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '1000', _sum: { debit: 1000, credit: 200 } },
      { accountCode: '4000', _sum: { debit: 0, credit: 800 } },
    ]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makeSampleAccounts());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance/export?fiscalYear=2026&format=csv',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.headers['content-disposition']).toContain('trial-balance-');
    expect(res.headers['content-disposition']).toContain('.csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Account Code');
    expect(lines[0]).toContain('Account Name');
    expect(lines[0]).toContain('Closing Balance');
  });

  it('returns Excel file when format=excel', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue(makeSampleAccounts());

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance/export?fiscalYear=2026&format=excel',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
  });

  it('defaults to CSV when format is not specified', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/trial-balance/export?fiscalYear=2026',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
  });
});

// ---------------------------------------------------------------------------
// GET /finance/reports/profit-and-loss/export
// ---------------------------------------------------------------------------

describe('GET /finance/reports/profit-and-loss/export', () => {
  it('returns CSV with flattened P&L sections', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '4000', _sum: { debit: 0, credit: 5000 } },
    ]);
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '4000',
        name: 'Sales',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        openingBalance: 0,
        classificationId: 'cls1',
        classification: {
          id: 'cls1',
          code: 'REVENUE',
          name: 'Revenue',
          accountType: 'REVENUE',
          reportSection: 'REVENUE',
        },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/profit-and-loss/export?fiscalYear=2026&format=csv',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Section');
    expect(lines[0]).toContain('Account Code');
    expect(lines[0]).toContain('Balance');
  });
});

// ---------------------------------------------------------------------------
// GET /finance/reports/transaction-journal/export
// ---------------------------------------------------------------------------

describe('GET /finance/reports/transaction-journal/export', () => {
  it('returns CSV with journal entry lines', async () => {
    app = await buildTestApp();

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalEntry.findMany.mockResolvedValue([
      {
        id: 'je1',
        entryNumber: 'JE-0001',
        transactionDate: new Date('2026-01-15'),
        description: 'Test entry',
        reference: 'REF-001',
        source: 'MANUAL',
        status: 'POSTED',
        totalDebit: 500,
        totalCredit: 500,
        lines: [
          {
            lineNumber: 1,
            accountCode: '1000',
            account: { name: 'Cash' },
            description: 'Cash debit',
            debit: 500,
            credit: 0,
            dimensions: [],
          },
          {
            lineNumber: 2,
            accountCode: '4000',
            account: { name: 'Sales' },
            description: 'Sales credit',
            debit: 0,
            credit: 500,
            dimensions: [],
          },
        ],
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/reports/transaction-journal/export?fiscalYear=2026&format=csv',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Entry Number');
    expect(lines[0]).toContain('Account Code');
    expect(lines[0]).toContain('Debit');
    expect(lines[0]).toContain('Credit');
    // Should have header + 2 data rows (one per journal line)
    const dataLines = lines.filter((l: string) => l.trim().length > 0);
    expect(dataLines.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/reports/budget-variance/export
// ---------------------------------------------------------------------------

describe('GET /finance/reports/budget-variance/export', () => {
  it('returns CSV with budget variance data', async () => {
    app = await buildTestApp();

    const budgetId = 'bbbb0000-0000-4000-a000-000000000001';

    mockPrisma.financialPeriod.findMany.mockResolvedValue([{ id: PERIOD_ID_1 }]);
    mockPrisma.journalLine.groupBy.mockResolvedValue([
      { accountCode: '5000', _sum: { debit: 800, credit: 0 } },
    ]);
    mockPrisma.budget.findFirst.mockResolvedValue({
      id: budgetId,
      name: 'Q1 Budget',
      fiscalYear: 2026,
      lines: [
        {
          accountCode: '5000',
          period1: 1000,
          period2: 0,
          period3: 0,
          period4: 0,
          period5: 0,
          period6: 0,
          period7: 0,
          period8: 0,
          period9: 0,
          period10: 0,
          period11: 0,
          period12: 0,
          totalAmount: 1000,
          account: { name: 'Office Expenses' },
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/finance/reports/budget-variance/export?fiscalYear=2026&budgetId=${budgetId}&format=csv`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Budget Amount');
    expect(lines[0]).toContain('Actual Amount');
    expect(lines[0]).toContain('Variance');
  });
});
