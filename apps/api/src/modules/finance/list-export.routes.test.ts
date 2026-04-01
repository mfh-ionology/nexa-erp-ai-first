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
    chartOfAccount: {
      findMany: vi.fn(),
    },
    journalEntry: {
      findMany: vi.fn(),
    },
    bankAccount: {
      findMany: vi.fn(),
    },
    budget: {
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
import { listExportRoutesPlugin } from './list-export.routes.js';

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
  await app.register(listExportRoutesPlugin, { prefix: '/finance' });

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

// ---------------------------------------------------------------------------
// GET /finance/accounts/export
// ---------------------------------------------------------------------------

describe('GET /finance/accounts/export', () => {
  it('returns CSV with account data', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      {
        code: '1000',
        name: 'Cash',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        isPostable: true,
        isActive: true,
        parentCode: null,
        openingBalance: 5000,
        currentBalance: 5800,
      },
      {
        code: '2000',
        name: 'Accounts Payable',
        accountType: 'LIABILITY',
        normalBalance: 'CREDIT',
        isPostable: true,
        isActive: true,
        parentCode: null,
        openingBalance: 2000,
        currentBalance: 2400,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts/export?format=csv',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.headers['content-disposition']).toContain('chart-of-accounts-');
    expect(res.headers['content-disposition']).toContain('.csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Code');
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Account Type');
    // Should have header + 2 data rows
    const dataLines = lines.filter((l: string) => l.trim().length > 0);
    expect(dataLines.length).toBe(3);
  });

  it('returns Excel when format=excel', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts/export?format=excel',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
  });
});

// ---------------------------------------------------------------------------
// GET /finance/journals/export
// ---------------------------------------------------------------------------

describe('GET /finance/journals/export', () => {
  it('returns CSV with journal entry data', async () => {
    app = await buildTestApp();

    mockPrisma.journalEntry.findMany.mockResolvedValue([
      {
        entryNumber: 'JE-0001',
        transactionDate: new Date('2026-01-15'),
        description: 'Office supplies',
        reference: 'INV-100',
        status: 'POSTED',
        source: 'MANUAL',
        totalDebit: 500,
        totalCredit: 500,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/journals/export?format=csv',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Entry Number');
    expect(lines[0]).toContain('Description');
    expect(lines[0]).toContain('Total Debit');
    const dataLines = lines.filter((l: string) => l.trim().length > 0);
    expect(dataLines.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/export
// ---------------------------------------------------------------------------

describe('GET /finance/bank-accounts/export', () => {
  it('returns CSV with bank account data', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findMany.mockResolvedValue([
      {
        name: 'Main Current Account',
        sortCode: '12-34-56',
        accountNumber: '12345678',
        currencyCode: 'GBP',
        glAccountCode: '1200',
        currentBalance: 25000,
        isActive: true,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts/export?format=csv',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Account Name');
    expect(lines[0]).toContain('Sort Code');
    expect(lines[0]).toContain('Current Balance');
  });
});

// ---------------------------------------------------------------------------
// GET /finance/budgets/export
// ---------------------------------------------------------------------------

describe('GET /finance/budgets/export', () => {
  it('returns CSV with budget data', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findMany.mockResolvedValue([
      {
        name: 'Annual Budget 2026',
        fiscalYear: 2026,
        status: 'APPROVED',
        totalAmount: 120000,
        createdAt: new Date('2026-01-01'),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets/export?format=csv',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    const lines = res.body.split('\n');
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Fiscal Year');
    expect(lines[0]).toContain('Total Amount');
  });

  it('returns Excel when format=excel', async () => {
    app = await buildTestApp();

    mockPrisma.budget.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/budgets/export?format=excel',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
  });
});
