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
    bankAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    chartOfAccount: {
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
import { bankAccountsRoutesPlugin } from './bank-accounts.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_BANK_ACCOUNT_ID = '22222222-2222-4000-a000-222222222222';

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
  await app.register(bankAccountsRoutesPlugin, { prefix: '/finance' });

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
          ? { 'finance.bankAccounts': fullPerm, 'finance.accounts': fullPerm }
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

/** Sample bank account data matching the Prisma model shape */
function makeSampleBankAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BANK_ACCOUNT_ID,
    companyId: TEST_COMPANY_ID,
    name: 'Main Business Account',
    sortCode: '123456',
    accountNumber: '12345678',
    iban: 'GB29NWBK60161331926819',
    swiftBic: 'NWBKGB2L',
    currencyCode: 'GBP',
    glAccountCode: '1200',
    currentBalance: 0,
    lastReconciledDate: null,
    openBankingStatus: 'DISCONNECTED',
    openBankingProvider: null,
    openBankingConnId: null,
    openBankingLastSync: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    glAccount: {
      code: '1200',
      name: 'Bank Current Account',
      accountType: 'ASSET',
    },
    ...overrides,
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

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts — AC-1: list with pagination
// ---------------------------------------------------------------------------

describe('GET /finance/bank-accounts', () => {
  it('returns list of bank accounts with pagination meta', async () => {
    app = await buildTestApp();
    const accounts = [
      makeSampleBankAccount(),
      makeSampleBankAccount({
        id: '33333333-3333-4000-a000-333333333333',
        name: 'Savings Account',
        glAccountCode: '1201',
      }),
    ];

    mockPrisma.bankAccount.findMany.mockResolvedValue(accounts);
    mockPrisma.bankAccount.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('Main Business Account');
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by isActive', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.bankAccount.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts?isActive=true',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, isActive: true }),
      }),
    );
  });

  it('filters by currencyCode', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.bankAccount.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts?currencyCode=EUR',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, currencyCode: 'EUR' }),
      }),
    );
  });

  it('supports search on name and account details', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);
    mockPrisma.bankAccount.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts?search=main',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          OR: [
            { name: { contains: 'main', mode: 'insensitive' } },
            { sortCode: { contains: 'main', mode: 'insensitive' } },
            { accountNumber: { contains: 'main', mode: 'insensitive' } },
            { glAccountCode: { contains: 'main', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:id — AC-1, AC-3
// ---------------------------------------------------------------------------

describe('GET /finance/bank-accounts/:id', () => {
  it('returns full bank account detail with GL account summary', async () => {
    app = await buildTestApp();
    const bankAccount = makeSampleBankAccount();

    mockPrisma.bankAccount.findFirst.mockResolvedValue(bankAccount);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_BANK_ACCOUNT_ID);
    expect(body.data.name).toBe('Main Business Account');
    expect(body.data.sortCode).toBe('123456');
    expect(body.data.accountNumber).toBe('12345678');
    expect(body.data.currentBalance).toBe(0);
    expect(body.data.lastReconciledDate).toBeNull();
    expect(body.data.openBankingStatus).toBe('DISCONNECTED');
    expect(body.data.glAccount).toBeDefined();
    expect(body.data.glAccount.code).toBe('1200');
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts — AC-1, AC-2: create with validation
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts', () => {
  it('creates a new bank account successfully', async () => {
    app = await buildTestApp();
    const created = makeSampleBankAccount();

    // GL account validation: exists and has isBankAccount=true
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      id: '44444444-4444-4000-a000-444444444444',
      isBankAccount: true,
    });
    mockPrisma.bankAccount.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Main Business Account',
        sortCode: '123456',
        accountNumber: '12345678',
        glAccountCode: '1200',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Main Business Account');
    expect(body.data.sortCode).toBe('123456');
  });

  // AC-2: Sort code validation
  it('rejects sort code that is not exactly 6 digits', async () => {
    app = await buildTestApp();

    const invalidSortCodes = ['12345', '1234567', 'ABCDEF', '12-34-56', '12 34 56'];

    for (const sortCode of invalidSortCodes) {
      const res = await app.inject({
        method: 'POST',
        url: '/finance/bank-accounts',
        headers: {
          authorization: `Bearer ${testJwt}`,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Test Account',
          sortCode,
          accountNumber: '12345678',
          glAccountCode: '1200',
        },
      });

      expect(res.statusCode).toBe(400);
    }
  });

  // AC-2: Account number validation
  it('rejects account number that is not exactly 8 digits', async () => {
    app = await buildTestApp();

    const invalidAccountNumbers = ['1234567', '123456789', 'ABCDEFGH', '1234-5678'];

    for (const accountNumber of invalidAccountNumbers) {
      const res = await app.inject({
        method: 'POST',
        url: '/finance/bank-accounts',
        headers: {
          authorization: `Bearer ${testJwt}`,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Test Account',
          sortCode: '123456',
          accountNumber,
          glAccountCode: '1200',
        },
      });

      expect(res.statusCode).toBe(400);
    }
  });

  // AC-2: GL account must exist
  it('rejects when GL account does not exist', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        glAccountCode: '9999',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_GL_ACCOUNT');
  });

  // AC-2: GL account must have isBankAccount=true
  it('rejects when GL account does not have isBankAccount=true', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      id: '44444444-4444-4000-a000-444444444444',
      isBankAccount: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        glAccountCode: '1200',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('GL_NOT_BANK_ACCOUNT');
  });

  // Duplicate GL account code per company
  it('returns 409 for duplicate GL account code', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      id: '44444444-4444-4000-a000-444444444444',
      isBankAccount: true,
    });
    mockPrisma.bankAccount.create.mockRejectedValue({ code: 'P2002' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Duplicate Account',
        glAccountCode: '1200',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('DUPLICATE_GL_ACCOUNT');
  });

  // IBAN validation
  it('rejects invalid IBAN format', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        glAccountCode: '1200',
        iban: 'INVALID',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('accepts valid IBAN format', async () => {
    app = await buildTestApp();
    const created = makeSampleBankAccount({ iban: 'GB29NWBK60161331926819' });

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      id: '44444444-4444-4000-a000-444444444444',
      isBankAccount: true,
    });
    mockPrisma.bankAccount.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        glAccountCode: '1200',
        iban: 'GB29NWBK60161331926819',
      },
    });

    expect(res.statusCode).toBe(201);
  });

  it('requires name field', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        glAccountCode: '1200',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('requires glAccountCode field', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts',
      headers: { 'content-type': 'application/json' },
      payload: {
        name: 'Test Account',
        glAccountCode: '1200',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/bank-accounts/:id — AC-1, AC-2: update with validation
// ---------------------------------------------------------------------------

describe('PATCH /finance/bank-accounts/:id', () => {
  it('updates bank account name successfully', async () => {
    app = await buildTestApp();

    const existing = makeSampleBankAccount();
    const updated = makeSampleBankAccount({ name: 'Updated Business Account' });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.bankAccount.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated Business Account' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Updated Business Account');
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
  });

  // AC-2: Validates GL account on update
  it('validates GL account exists and has isBankAccount=true on update', async () => {
    app = await buildTestApp();

    const existing = makeSampleBankAccount();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null); // GL account not found

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { glAccountCode: '9999' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_GL_ACCOUNT');
  });

  it('rejects GL account without isBankAccount=true on update', async () => {
    app = await buildTestApp();

    const existing = makeSampleBankAccount();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      id: '44444444-4444-4000-a000-444444444444',
      isBankAccount: false,
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { glAccountCode: '1300' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('GL_NOT_BANK_ACCOUNT');
  });

  // AC-2: Sort code validation on update
  it('rejects invalid sort code on update', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { sortCode: '12345' },
    });

    expect(res.statusCode).toBe(400);
  });

  // AC-2: Account number validation on update
  it('rejects invalid account number on update', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { accountNumber: '1234567' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('allows setting sort code to null', async () => {
    app = await buildTestApp();

    const existing = makeSampleBankAccount();
    const updated = makeSampleBankAccount({ sortCode: null });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.bankAccount.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { sortCode: null },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.sortCode).toBeNull();
  });

  it('returns 409 for duplicate GL account code on update', async () => {
    app = await buildTestApp();

    const existing = makeSampleBankAccount();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      id: '44444444-4444-4000-a000-444444444444',
      isBankAccount: true,
    });
    mockPrisma.bankAccount.update.mockRejectedValue({ code: 'P2002' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { glAccountCode: '1201' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('DUPLICATE_GL_ACCOUNT');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: 'No Auth' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/search — AC-1, AC-4
// ---------------------------------------------------------------------------

describe('GET /finance/bank-accounts/search', () => {
  it('searches bank accounts by name and account details', async () => {
    app = await buildTestApp();
    const results = [makeSampleBankAccount({ name: 'Main Business Account' })];

    mockPrisma.bankAccount.findMany.mockResolvedValue(results);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts/search?search=main',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Main Business Account');
  });

  it('uses case-insensitive search', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts/search?search=MAIN',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'MAIN', mode: 'insensitive' } },
            { sortCode: { contains: 'MAIN', mode: 'insensitive' } },
            { accountNumber: { contains: 'MAIN', mode: 'insensitive' } },
            { glAccountCode: { contains: 'MAIN', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('requires search parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts/search',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('filters search by isActive', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts/search?search=main&isActive=true',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          isActive: true,
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/bank-accounts/search?search=test',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission checks (AC-4)
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('returns 403 for VIEWER role on GET /bank-accounts', async () => {
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
      url: '/finance/bank-accounts',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /bank-accounts', async () => {
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
      url: '/finance/bank-accounts',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        glAccountCode: '1200',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on PATCH /bank-accounts/:id', async () => {
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
      method: 'PATCH',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'No Access' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on GET /bank-accounts/search', async () => {
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
      url: '/finance/bank-accounts/search?search=test',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
