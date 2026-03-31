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
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    accountClassification: {
      findFirst: vi.fn(),
    },
    journalLine: {
      count: vi.fn(),
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
import { accountsRoutesPlugin } from './accounts.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_ACCOUNT_ID = '22222222-2222-4000-a000-222222222222';

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
  await app.register(accountsRoutesPlugin, { prefix: '/finance' });

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
          ? { 'finance.accounts': fullPerm, 'finance.settings': fullPerm }
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

/** Sample account data matching the Prisma model shape */
function makeSampleAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_ACCOUNT_ID,
    code: '1000',
    name: 'Cash',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    parentCode: null,
    classificationId: null,
    classification: null,
    isPostable: true,
    isControl: false,
    isBankAccount: false,
    isSystemAccount: false,
    isActive: true,
    taxCode: null,
    departmentCode: null,
    currencyCode: null,
    openingBalance: 0,
    currentBalance: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    children: [],
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
// GET /finance/accounts — AC-1: flat list with parentCode
// ---------------------------------------------------------------------------

describe('GET /finance/accounts', () => {
  it('returns flat list of accounts with pagination meta', async () => {
    app = await buildTestApp();
    const accounts = [
      makeSampleAccount(),
      makeSampleAccount({ id: '33333333-3333-4000-a000-333333333333', code: '2000', name: 'Bank' }),
    ];

    mockPrisma.chartOfAccount.findMany.mockResolvedValue(accounts);
    mockPrisma.chartOfAccount.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].code).toBe('1000');
    expect(body.data[0].parentCode).toBeNull();
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('supports ?tree=true for nested JSON (AC-1)', async () => {
    app = await buildTestApp();
    const parent = makeSampleAccount({ code: '1000', name: 'Assets', parentCode: null });
    const child = makeSampleAccount({
      id: '33333333-3333-4000-a000-333333333333',
      code: '1100',
      name: 'Current Assets',
      parentCode: '1000',
    });

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([parent, child]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts?tree=true',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    // Root level should contain only the parent
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe('1000');
    expect(body.data[0].children).toHaveLength(1);
    expect(body.data[0].children[0].code).toBe('1100');
  });

  it('filters by accountType', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
    mockPrisma.chartOfAccount.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/accounts?accountType=ASSET',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, accountType: 'ASSET' }),
      }),
    );
  });

  it('filters by isActive', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
    mockPrisma.chartOfAccount.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/accounts?isActive=true',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, isActive: true }),
      }),
    );
  });

  it('supports search on code and name', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
    mockPrisma.chartOfAccount.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/accounts?search=cash',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          OR: [
            { code: { contains: 'cash', mode: 'insensitive' } },
            { name: { contains: 'cash', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/accounts/:id — AC-2
// ---------------------------------------------------------------------------

describe('GET /finance/accounts/:id', () => {
  it('returns full account with classification and children', async () => {
    app = await buildTestApp();
    const account = makeSampleAccount({
      classificationId: '44444444-4444-4000-a000-444444444444',
      classification: {
        id: '44444444-4444-4000-a000-444444444444',
        code: 'CA',
        name: 'Current Assets',
        accountType: 'ASSET',
        reportSection: 'BALANCE_SHEET',
      },
      children: [
        makeSampleAccount({
          id: '55555555-5555-4000-a000-555555555555',
          code: '1100',
          name: 'Petty Cash',
        }),
      ],
    });

    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(account);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_ACCOUNT_ID);
    expect(body.data.classification).toBeDefined();
    expect(body.data.classification.code).toBe('CA');
    expect(body.data.children).toHaveLength(1);
    expect(body.data.children[0].code).toBe('1100');
  });

  it('returns 404 for non-existent account', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/accounts — AC-3: create with validation
// ---------------------------------------------------------------------------

describe('POST /finance/accounts', () => {
  it('creates a new account successfully', async () => {
    app = await buildTestApp();
    const created = makeSampleAccount({ code: '3000', name: 'Revenue' });

    mockPrisma.chartOfAccount.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: '3000',
        name: 'Revenue',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.code).toBe('3000');
  });

  it('validates parent code exists when provided', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null); // parent not found

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: '1100',
        name: 'Sub Account',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        parentCode: '9999',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_PARENT');
  });

  it('returns 409 for duplicate code', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.create.mockRejectedValue({ code: 'P2002' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: '1000',
        name: 'Duplicate',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('DUPLICATE_CODE');
  });

  // AC-8: BR-FIN-017 — account code validation
  it('rejects code shorter than 2 characters (BR-FIN-017)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: 'A',
        name: 'Short Code',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects code with special characters (BR-FIN-017)', async () => {
    app = await buildTestApp();

    const specialCharCodes = ['10-00', '10+00', '10.00', '10*00'];

    for (const code of specialCharCodes) {
      const res = await app.inject({
        method: 'POST',
        url: '/finance/accounts',
        headers: {
          authorization: `Bearer ${testJwt}`,
          'content-type': 'application/json',
        },
        payload: {
          code,
          name: 'Special Chars',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
        },
      });

      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects invalid accountType', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: '1000',
        name: 'Bad Type',
        accountType: 'INVALID',
        normalBalance: 'DEBIT',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid normalBalance', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: '1000',
        name: 'Bad Balance',
        accountType: 'ASSET',
        normalBalance: 'WRONG',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/accounts',
      headers: { 'content-type': 'application/json' },
      payload: {
        code: '1000',
        name: 'Test',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/accounts/:id — AC-4: update with system account protection
// ---------------------------------------------------------------------------

describe('PATCH /finance/accounts/:id', () => {
  it('updates account name successfully', async () => {
    app = await buildTestApp();

    const existing = makeSampleAccount();
    const updated = makeSampleAccount({ name: 'Cash Updated' });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.chartOfAccount.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Cash Updated' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Cash Updated');
  });

  it('returns 404 for non-existent account', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
  });

  // AC-7: BR-FIN-006 — system account protection
  it('blocks protected field changes on system accounts (AC-7, BR-FIN-006)', async () => {
    app = await buildTestApp();

    const systemAccount = makeSampleAccount({ isSystemAccount: true });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(systemAccount);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { accountType: 'LIABILITY' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SYSTEM_ACCOUNT_PROTECTED');
  });

  it('allows name update on system accounts', async () => {
    app = await buildTestApp();

    const systemAccount = makeSampleAccount({ isSystemAccount: true });
    const updated = makeSampleAccount({ isSystemAccount: true, name: 'Renamed System' });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(systemAccount);
    mockPrisma.chartOfAccount.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Renamed System' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Renamed System');
  });

  // AC-6: BR-FIN-005 — cannot deactivate with current-year postings
  it('blocks deactivation when account has current-year postings (AC-6, BR-FIN-005)', async () => {
    app = await buildTestApp();

    const existing = makeSampleAccount({ isActive: true });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.journalLine.count.mockResolvedValue(5); // has postings

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ACCOUNT_HAS_POSTINGS');
  });

  it('allows deactivation when no current-year postings', async () => {
    app = await buildTestApp();

    const existing = makeSampleAccount({ isActive: true });
    const updated = makeSampleAccount({ isActive: false });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(existing);
    mockPrisma.journalLine.count.mockResolvedValue(0); // no postings
    mockPrisma.chartOfAccount.update.mockResolvedValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isActive).toBe(false);
  });

  // AC-7: BR-FIN-006 — cannot deactivate system accounts
  it('blocks deactivation of system accounts (AC-7, BR-FIN-006)', async () => {
    app = await buildTestApp();

    const systemAccount = makeSampleAccount({ isSystemAccount: true, isActive: true });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(systemAccount);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SYSTEM_ACCOUNT_PROTECTED');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: 'No Auth' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/accounts/search — AC-5
// ---------------------------------------------------------------------------

describe('GET /finance/accounts/search', () => {
  it('searches accounts by code and name', async () => {
    app = await buildTestApp();
    const results = [makeSampleAccount({ code: '1000', name: 'Cash at Bank' })];

    mockPrisma.chartOfAccount.findMany.mockResolvedValue(results);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts/search?search=cash',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Cash at Bank');
  });

  it('uses case-insensitive search', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/accounts/search?search=CASH',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { code: { contains: 'CASH', mode: 'insensitive' } },
            { name: { contains: 'CASH', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('requires search parameter', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts/search',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('filters search by accountType', async () => {
    app = await buildTestApp();
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/accounts/search?search=revenue&accountType=REVENUE',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          accountType: 'REVENUE',
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/accounts/search?search=test',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission checks (AC-9)
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('returns 403 for VIEWER role on GET /accounts', async () => {
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
      url: '/finance/accounts',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /accounts', async () => {
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
      url: '/finance/accounts',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        code: '1000',
        name: 'Test',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on PATCH /accounts/:id', async () => {
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
      url: `/finance/accounts/${TEST_ACCOUNT_ID}`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'No Access' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on GET /accounts/search', async () => {
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
      url: '/finance/accounts/search?search=test',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
