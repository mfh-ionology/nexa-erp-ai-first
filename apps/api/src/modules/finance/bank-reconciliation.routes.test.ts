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
    bankReconciliation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    bankReconciliationLine: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    bankTransaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    bankTransactionMatch: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    journalLine: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
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
  Prisma: {
    Decimal: class Decimal {
      private value: string;
      constructor(v: string | number) {
        this.value = String(v);
      }
      toString() {
        return this.value;
      }
      toNumber() {
        return Number(this.value);
      }
    },
  },
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
import { bankReconciliationRoutesPlugin } from './bank-reconciliation.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_BANK_ACCOUNT_ID = '22222222-2222-4000-a000-222222222222';
const TEST_RECONCILIATION_ID = '33333333-3333-4000-a000-333333333333';
const TEST_BANK_TRANSACTION_ID = '44444444-4444-4000-a000-444444444444';
const TEST_JOURNAL_LINE_ID = '55555555-5555-4000-a000-555555555555';
const TEST_MATCH_ID = '66666666-6666-4000-a000-666666666666';

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
  await app.register(bankReconciliationRoutesPlugin, { prefix: '/finance' });

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

function makeSampleReconciliation(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_RECONCILIATION_ID,
    companyId: TEST_COMPANY_ID,
    bankAccountId: TEST_BANK_ACCOUNT_ID,
    statementDate: new Date('2026-03-31T00:00:00Z'),
    statementBalance: 10000,
    glBalance: 9500,
    difference: 500,
    status: 'IN_PROGRESS',
    completedAt: null,
    completedBy: null,
    createdAt: new Date('2026-03-31T00:00:00Z'),
    updatedAt: new Date('2026-03-31T00:00:00Z'),
    createdBy: TEST_USER_ID,
    ...overrides,
  };
}

function makeSampleBankTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BANK_TRANSACTION_ID,
    companyId: TEST_COMPANY_ID,
    bankAccountId: TEST_BANK_ACCOUNT_ID,
    transactionDate: new Date('2026-03-15T00:00:00Z'),
    description: 'Payment from Customer',
    amount: 500,
    reference: 'REF001',
    type: 'CREDIT',
    isMatched: false,
    ...overrides,
  };
}

function makeSampleMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_MATCH_ID,
    companyId: TEST_COMPANY_ID,
    bankTransactionId: TEST_BANK_TRANSACTION_ID,
    journalLineId: TEST_JOURNAL_LINE_ID,
    matchType: 'MANUAL',
    confidence: null,
    matchedAt: new Date('2026-03-31T10:00:00Z'),
    matchedBy: TEST_USER_ID,
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
// POST /finance/bank-accounts/:bankAccountId/reconciliations — AC-1
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts/:bankAccountId/reconciliations', () => {
  it('creates a new reconciliation session', async () => {
    app = await buildTestApp();
    const created = makeSampleReconciliation();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      glAccountCode: '1200',
    });
    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(null); // no existing in-progress
    mockPrisma.journalLine.aggregate.mockResolvedValue({
      _sum: { debit: 10000, credit: 500 },
    });
    mockPrisma.bankReconciliation.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        statementDate: '2026-03-31',
        statementBalance: 10000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.bankAccountId).toBe(TEST_BANK_ACCOUNT_ID);
    expect(body.data.status).toBe('IN_PROGRESS');
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        statementDate: '2026-03-31',
        statementBalance: 10000,
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when reconciliation already in progress', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      glAccountCode: '1200',
    });
    // Return existing in-progress reconciliation
    mockPrisma.bankReconciliation.findFirst.mockResolvedValue({
      id: 'existing-reconciliation-id',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        statementDate: '2026-03-31',
        statementBalance: 10000,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('RECONCILIATION_IN_PROGRESS');
  });

  it('requires statementBalance field', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        statementDate: '2026-03-31',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('requires statementDate field', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        statementBalance: 10000,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: { 'content-type': 'application/json' },
      payload: {
        statementDate: '2026-03-31',
        statementBalance: 10000,
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:bankAccountId/reconciliations/:id — AC-2
// ---------------------------------------------------------------------------

describe('GET /finance/bank-accounts/:bankAccountId/reconciliations/:id', () => {
  it('returns reconciliation with matched and unmatched transactions', async () => {
    app = await buildTestApp();

    const reconciliation = makeSampleReconciliation({
      lines: [{ matchId: TEST_MATCH_ID }],
    });

    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(reconciliation);
    mockPrisma.bankTransactionMatch.findMany.mockResolvedValue([
      {
        ...makeSampleMatch(),
        bankTransaction: makeSampleBankTransaction(),
      },
    ]);
    mockPrisma.bankTransaction.findMany.mockResolvedValue([
      makeSampleBankTransaction({
        id: '77777777-7777-4000-a000-777777777777',
        description: 'Unmatched payment',
      }),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_RECONCILIATION_ID);
    expect(body.data.matchedTransactions).toHaveLength(1);
    expect(body.data.matchedTransactions[0].matchId).toBe(TEST_MATCH_ID);
    expect(body.data.unmatchedTransactions).toHaveLength(1);
    expect(body.data.unmatchedTransactions[0].description).toBe('Unmatched payment');
  });

  it('returns 404 for non-existent reconciliation', async () => {
    app = await buildTestApp();
    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:id/match — AC-3
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts/:id/match', () => {
  it('creates a manual match between bank transaction and journal line', async () => {
    app = await buildTestApp();

    const match = makeSampleMatch();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      glAccountCode: '1200',
    });
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: false }),
    );
    mockPrisma.journalLine.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_LINE_ID,
    });
    mockPrisma.bankTransactionMatch.create.mockResolvedValue(match);
    mockPrisma.bankTransaction.update.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: true }),
    );
    // No active reconciliation
    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.matchType).toBe('MANUAL');
    expect(body.data.bankTransactionId).toBe(TEST_BANK_TRANSACTION_ID);
    expect(body.data.journalLineId).toBe(TEST_JOURNAL_LINE_ID);
  });

  it('adds match to active reconciliation session if one exists', async () => {
    app = await buildTestApp();

    const match = makeSampleMatch();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValueOnce({
      id: TEST_BANK_ACCOUNT_ID,
      glAccountCode: '1200',
    });
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: false }),
    );
    mockPrisma.journalLine.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_LINE_ID,
    });
    mockPrisma.bankTransactionMatch.create.mockResolvedValue(match);
    mockPrisma.bankTransaction.update.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: true }),
    );
    // Active reconciliation exists
    mockPrisma.bankReconciliation.findFirst
      .mockResolvedValueOnce({ id: TEST_RECONCILIATION_ID })
      // For recalculate: findFirst returns reconciliation data
      .mockResolvedValueOnce(
        makeSampleReconciliation({
          lines: [{ matchId: TEST_MATCH_ID }],
        }),
      );
    mockPrisma.bankReconciliationLine.create.mockResolvedValue({
      id: 'line-id',
      reconciliationId: TEST_RECONCILIATION_ID,
      matchId: TEST_MATCH_ID,
    });
    // Recalculate needs bank account + journal line aggregate
    mockPrisma.bankAccount.findFirst.mockResolvedValueOnce({
      glAccountCode: '1200',
    });
    mockPrisma.journalLine.aggregate.mockResolvedValue({
      _sum: { debit: 10000, credit: 500 },
    });
    mockPrisma.bankReconciliation.update.mockResolvedValue(makeSampleReconciliation());

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockPrisma.bankReconciliationLine.create).toHaveBeenCalled();
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for non-existent bank transaction', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
    });
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('BANK_TRANSACTION_NOT_FOUND');
  });

  it('returns 409 when bank transaction already matched', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
    });
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: true }),
    );

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ALREADY_MATCHED');
  });

  it('returns 404 for non-existent journal line', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
    });
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: false }),
    );
    mockPrisma.journalLine.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('JOURNAL_LINE_NOT_FOUND');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: { 'content-type': 'application/json' },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/bank-transactions/:id/unmatch — AC-4
// ---------------------------------------------------------------------------

describe('POST /finance/bank-transactions/:id/unmatch', () => {
  it('removes a match from a bank transaction', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: true }),
    );
    mockPrisma.bankTransactionMatch.findMany.mockResolvedValue([makeSampleMatch()]);
    mockPrisma.bankReconciliationLine.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.bankTransactionMatch.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.bankTransaction.update.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: false }),
    );
    // No active reconciliation
    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-transactions/${TEST_BANK_TRANSACTION_ID}/unmatch`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 for non-existent bank transaction', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-transactions/${TEST_BANK_TRANSACTION_ID}/unmatch`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when bank transaction is not matched', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankTransaction.findFirst.mockResolvedValue(
      makeSampleBankTransaction({ isMatched: false }),
    );

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-transactions/${TEST_BANK_TRANSACTION_ID}/unmatch`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('NOT_MATCHED');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-transactions/${TEST_BANK_TRANSACTION_ID}/unmatch`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:bankAccountId/reconciliations/:id/complete — AC-5
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts/:bankAccountId/reconciliations/:id/complete', () => {
  it('completes reconciliation when difference is zero', async () => {
    app = await buildTestApp();

    const completedRecon = makeSampleReconciliation({
      status: 'COMPLETED',
      difference: 0,
      completedAt: new Date('2026-03-31T12:00:00Z'),
      completedBy: TEST_USER_ID,
    });

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );

    // First findFirst: get reconciliation
    mockPrisma.bankReconciliation.findFirst
      .mockResolvedValueOnce(
        makeSampleReconciliation({
          statementBalance: 9500,
          difference: 0,
        }),
      )
      // For recalculate: findFirst returns reconciliation data
      .mockResolvedValueOnce(
        makeSampleReconciliation({
          companyId: TEST_COMPANY_ID,
          bankAccountId: TEST_BANK_ACCOUNT_ID,
          statementBalance: 9500,
          lines: [],
        }),
      )
      // After recalculate: re-fetch
      .mockResolvedValueOnce({
        difference: 0,
        statementBalance: 9500,
      });

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      glAccountCode: '1200',
    });
    mockPrisma.journalLine.aggregate.mockResolvedValue({
      _sum: { debit: 10000, credit: 500 },
    });

    // recalculate update
    mockPrisma.bankReconciliation.update
      .mockResolvedValueOnce(makeSampleReconciliation({ difference: 0 }))
      // completion update
      .mockResolvedValueOnce(completedRecon);

    mockPrisma.bankAccount.update.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      lastReconciledDate: new Date('2026-03-31T00:00:00Z'),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}/complete`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('COMPLETED');
  });

  it('rejects completion when difference is not zero (BR-FIN-009)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );

    mockPrisma.bankReconciliation.findFirst
      .mockResolvedValueOnce(
        makeSampleReconciliation({
          statementBalance: 10000,
          difference: 500,
        }),
      )
      // For recalculate
      .mockResolvedValueOnce(
        makeSampleReconciliation({
          companyId: TEST_COMPANY_ID,
          bankAccountId: TEST_BANK_ACCOUNT_ID,
          statementBalance: 10000,
          lines: [],
        }),
      )
      // After recalculate
      .mockResolvedValueOnce({
        difference: 500,
        statementBalance: 10000,
      });

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      glAccountCode: '1200',
    });
    mockPrisma.journalLine.aggregate.mockResolvedValue({
      _sum: { debit: 10000, credit: 500 },
    });
    mockPrisma.bankReconciliation.update.mockResolvedValue(
      makeSampleReconciliation({ difference: 500 }),
    );

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}/complete`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('RECONCILIATION_NOT_BALANCED');
  });

  it('rejects completion of non-IN_PROGRESS reconciliation', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );

    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(
      makeSampleReconciliation({ status: 'COMPLETED' }),
    );

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}/complete`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  it('returns 404 for non-existent reconciliation', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankReconciliation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}/complete`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}/complete`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:bankAccountId/reconciliations — AC-6
// ---------------------------------------------------------------------------

describe('GET /finance/bank-accounts/:bankAccountId/reconciliations', () => {
  it('returns list of reconciliations with pagination meta', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
    });

    const reconciliations = [
      makeSampleReconciliation(),
      makeSampleReconciliation({
        id: '88888888-8888-4000-a000-888888888888',
        status: 'COMPLETED',
      }),
    ];

    mockPrisma.bankReconciliation.findMany.mockResolvedValue(reconciliations);
    mockPrisma.bankReconciliation.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by status', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
    });
    mockPrisma.bankReconciliation.findMany.mockResolvedValue([]);
    mockPrisma.bankReconciliation.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations?status=COMPLETED`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankReconciliation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          bankAccountId: TEST_BANK_ACCOUNT_ID,
          status: 'COMPLETED',
        }),
      }),
    );
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission enforcement — AC-7
// ---------------------------------------------------------------------------

describe('Permission enforcement for bank reconciliation', () => {
  it('returns 403 for VIEWER role on POST reconciliation', async () => {
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        statementDate: '2026-03-31',
        statementBalance: 10000,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on GET reconciliations list', async () => {
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST match', async () => {
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/match`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        journalLineId: TEST_JOURNAL_LINE_ID,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST unmatch', async () => {
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
      url: `/finance/bank-transactions/${TEST_BANK_TRANSACTION_ID}/unmatch`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST complete', async () => {
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/reconciliations/${TEST_RECONCILIATION_ID}/complete`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
