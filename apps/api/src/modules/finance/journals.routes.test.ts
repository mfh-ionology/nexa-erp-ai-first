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
      systemSetting: { findMany: vi.fn() },
      journalEntry: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      journalLine: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      journalLineDimension: {
        create: vi.fn(),
      },
      chartOfAccount: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      financialPeriod: {
        findFirst: vi.fn(),
      },
      dimensionRequirement: {
        findMany: vi.fn(),
      },
      dimensionValue: {
        findMany: vi.fn(),
      },
      dimensionBalance: {
        upsert: vi.fn(),
      },
      accountMandatoryDimension: {
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
    mockNextNumber: vi.fn(),
  }));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  nextNumber: mockNextNumber,
  Prisma: {
    Decimal: class Decimal {
      private value: number;
      constructor(v: number | string) {
        this.value = Number(v);
      }
      toNumber() {
        return this.value;
      }
      toString() {
        return String(this.value);
      }
    },
  },
  SettingCategory: {
    GENERAL: 'GENERAL',
    FINANCE: 'FINANCE',
  },
  SettingValueType: {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    JSON: 'JSON',
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
import { journalsRoutesPlugin } from './journals.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_PERIOD_ID = '22222222-2222-4000-a000-222222222222';
const TEST_JOURNAL_ID = '33333333-3333-4000-a000-333333333333';
const TEST_REVERSAL_ID = '44444444-4444-4000-a000-444444444444';

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
  await app.register(journalsRoutesPlugin, { prefix: '/finance' });

  await app.ready();
  return app;
}

function setupMocks() {
  // Middleware queries
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });

  mockResolveUserRole.mockResolvedValue('ADMIN');

  mockPrisma.systemSetting.findMany.mockResolvedValue([]);

  // Default: no dimension requirements
  mockPrisma.dimensionRequirement.findMany.mockResolvedValue([]);
  mockPrisma.dimensionValue.findMany.mockResolvedValue([]);
  // Default: no per-account mandatory dimensions
  mockPrisma.accountMandatoryDimension.findMany.mockResolvedValue([]);

  // Configure permission service: full access for ADMIN
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
          ? { 'finance.journals': fullPerm, 'finance.settings': fullPerm }
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

/** Create a mock journal entry row as Prisma would return */
function makeMockJournalEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_JOURNAL_ID,
    entryNumber: 'JE-00001',
    transactionDate: new Date('2026-01-15'),
    description: 'Test journal entry',
    reference: 'REF-001',
    source: 'MANUAL',
    sourceId: null,
    sourceReference: null,
    isAutoGenerated: false,
    status: 'DRAFT',
    postedAt: null,
    postedBy: null,
    reversalOfId: null,
    periodId: TEST_PERIOD_ID,
    totalDebit: 1000,
    totalCredit: 1000,
    templateId: null,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    lines: [
      {
        id: 'line-1',
        lineNumber: 1,
        accountCode: '1000',
        description: 'Debit line',
        debit: 1000,
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
        accountCode: '2000',
        description: 'Credit line',
        debit: 0,
        credit: 1000,
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
        dimensions: [],
      },
    ],
    ...overrides,
  };
}

function makeMockListItem(overrides: Record<string, unknown> = {}) {
  const full = makeMockJournalEntry(overrides);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lines, sourceId, templateId, createdBy, updatedBy, ...listFields } = full;
  return listFields;
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
// POST /finance/journals — AC-1: Create draft journal entry
// ---------------------------------------------------------------------------

describe('POST /finance/journals', () => {
  it('creates a draft journal entry with auto-generated entryNumber (AC-1)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Period exists
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // Accounts exist
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '2000' }]);

    // Number series returns entry number
    mockNextNumber.mockResolvedValue('JE-00001');

    // Journal entry creation
    mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_JOURNAL_ID });
    mockPrisma.journalLine.create.mockResolvedValue({ id: 'line-1' });

    // Return full entry
    const mockEntry = makeMockJournalEntry();
    mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue(mockEntry);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        transactionDate: '2026-01-15',
        description: 'Test journal entry',
        reference: 'REF-001',
        periodId: TEST_PERIOD_ID,
        lines: [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '2000', debit: 0, credit: 1000 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.entryNumber).toBe('JE-00001');
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.lines).toHaveLength(2);

    // Verify nextNumber was called
    expect(mockNextNumber).toHaveBeenCalledWith(expect.anything(), TEST_COMPANY_ID, 'JOURNAL');

    // Verify journal.created event was emitted
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'journal.created',
      expect.objectContaining({
        journalEntryId: TEST_JOURNAL_ID,
        entryNumber: 'JE-00001',
        source: 'MANUAL',
      }),
    );
  });

  it('rejects with invalid period ID', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        transactionDate: '2026-01-15',
        description: 'Test',
        periodId: TEST_PERIOD_ID,
        lines: [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '2000', debit: 0, credit: 1000 },
        ],
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects with non-existent account code', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // Only one account exists
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        transactionDate: '2026-01-15',
        description: 'Test',
        periodId: TEST_PERIOD_ID,
        lines: [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '9999', debit: 0, credit: 1000 },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('rejects with fewer than 2 lines', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        transactionDate: '2026-01-15',
        description: 'Test',
        periodId: TEST_PERIOD_ID,
        lines: [{ accountCode: '1000', debit: 1000, credit: 0 }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/journals',
      headers: { 'content-type': 'application/json' },
      payload: {
        transactionDate: '2026-01-15',
        description: 'Test',
        periodId: TEST_PERIOD_ID,
        lines: [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '2000', debit: 0, credit: 1000 },
        ],
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/journals/:id — AC-2, AC-9: Update draft / immutability
// ---------------------------------------------------------------------------

describe('PATCH /finance/journals/:id', () => {
  it('updates a draft journal entry (AC-2)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Existing DRAFT entry
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      status: 'DRAFT',
      source: 'MANUAL',
    });

    // Accounts exist
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '3000' }]);

    mockPrisma.journalLine.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.journalLine.create.mockResolvedValue({ id: 'new-line' });
    mockPrisma.journalEntry.update.mockResolvedValue({ id: TEST_JOURNAL_ID });

    const updatedEntry = makeMockJournalEntry({
      description: 'Updated description',
      lines: [
        {
          id: 'new-line-1',
          lineNumber: 1,
          accountCode: '1000',
          description: 'Updated debit',
          debit: 2000,
          credit: 0,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
        {
          id: 'new-line-2',
          lineNumber: 2,
          accountCode: '3000',
          description: 'Updated credit',
          debit: 0,
          credit: 2000,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
      ],
    });
    mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue(updatedEntry);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/journals/${TEST_JOURNAL_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        description: 'Updated description',
        lines: [
          { accountCode: '1000', debit: 2000, credit: 0 },
          { accountCode: '3000', debit: 0, credit: 2000 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('rejects modification of POSTED entry (AC-9, BR-FIN-011)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // POSTED entry
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      status: 'POSTED',
      source: 'MANUAL',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/journals/${TEST_JOURNAL_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { description: 'Try to change' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ENTRY_IMMUTABLE');
  });

  it('rejects modification of REVERSED entry (AC-9, BR-FIN-011)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      status: 'REVERSED',
      source: 'MANUAL',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/journals/${TEST_JOURNAL_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { description: 'Try to change' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ENTRY_IMMUTABLE');
  });

  it('returns 404 for non-existent entry', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/journals/${TEST_JOURNAL_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { description: 'Update' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/journals/:id/post — AC-3, AC-4, AC-5, AC-6, AC-8, AC-12, AC-13
// ---------------------------------------------------------------------------

describe('POST /finance/journals/:id/post', () => {
  it('posts a balanced DRAFT entry, updates balances, emits event (AC-3, AC-4, AC-5, AC-6)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Existing DRAFT entry with balanced lines
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'DRAFT',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      lines: [
        { accountCode: '1000', debit: 1000, credit: 0, dimensions: [] },
        { accountCode: '2000', debit: 0, credit: 1000, dimensions: [] },
      ],
    });

    // Period is OPEN
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
      fiscalYear: 2026,
      periodNumber: 1,
    });

    // Accounts are valid
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1000', isActive: true, isPostable: true, isControl: false },
      { code: '2000', isActive: true, isPostable: true, isControl: false },
    ]);

    // Account balance update
    mockPrisma.chartOfAccount.update.mockResolvedValue({});

    // Post transition
    const postedEntry = makeMockJournalEntry({
      status: 'POSTED',
      postedAt: new Date().toISOString(),
      postedBy: TEST_USER_ID,
    });
    mockPrisma.journalEntry.update.mockResolvedValue(postedEntry);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('POSTED');

    // AC-4: Account balance updates were called
    expect(mockPrisma.chartOfAccount.update).toHaveBeenCalled();

    // AC-6: journal.posted event emitted
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'journal.posted',
      expect.objectContaining({
        journalEntryId: TEST_JOURNAL_ID,
        entryNumber: 'JE-00001',
        source: 'MANUAL',
      }),
    );
  });

  it('rejects unbalanced entry (AC-3, BR-FIN-001)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // DRAFT entry with UNBALANCED lines
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'DRAFT',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      lines: [
        { accountCode: '1000', debit: 1000, credit: 0, dimensions: [] },
        { accountCode: '2000', debit: 0, credit: 500, dimensions: [] },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ENTRY_NOT_BALANCED');
  });

  it('rejects posting to CLOSED period (AC-8, BR-FIN-003)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // DRAFT entry
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'DRAFT',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      lines: [
        { accountCode: '1000', debit: 1000, credit: 0, dimensions: [] },
        { accountCode: '2000', debit: 0, credit: 1000, dimensions: [] },
      ],
    });

    // Period is CLOSED
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'CLOSED',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('PERIOD_NOT_OPEN');
  });

  it('rejects posting to LOCKED period (AC-8, BR-FIN-003)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'DRAFT',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      lines: [
        { accountCode: '1000', debit: 1000, credit: 0, dimensions: [] },
        { accountCode: '2000', debit: 0, credit: 1000, dimensions: [] },
      ],
    });

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'LOCKED',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('PERIOD_NOT_OPEN');
  });

  it('rejects posting to non-postable account (BR-FIN-013)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'DRAFT',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      lines: [
        { accountCode: '1000', debit: 1000, credit: 0, dimensions: [] },
        { accountCode: '2000', debit: 0, credit: 1000, dimensions: [] },
      ],
    });

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // One account is not postable
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1000', isActive: true, isPostable: false, isControl: false },
      { code: '2000', isActive: true, isPostable: true, isControl: false },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ACCOUNT_NOT_POSTABLE');
  });

  it('rejects manual posting to control account (AC-13, BR-FIN-013)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'DRAFT',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      lines: [
        { accountCode: '1100', debit: 1000, credit: 0, dimensions: [] },
        { accountCode: '2000', debit: 0, credit: 1000, dimensions: [] },
      ],
    });

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // 1100 is a control account (AR/AP)
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1100', isActive: true, isPostable: true, isControl: true },
      { code: '2000', isActive: true, isPostable: true, isControl: false },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('CONTROL_ACCOUNT_MANUAL_POST');
  });

  it('rejects posting an already POSTED entry (BR-FIN-011)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      status: 'POSTED',
      source: 'MANUAL',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('enforces DimensionRequirement rules on posting (AC-12)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    const DIM_TYPE_ID = 'dim-type-001';

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'DRAFT',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      lines: [
        { accountCode: '5000', debit: 1000, credit: 0, dimensions: [] },
        { accountCode: '2000', debit: 0, credit: 1000, dimensions: [] },
      ],
    });

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '5000', isActive: true, isPostable: true, isControl: false },
      { code: '2000', isActive: true, isPostable: true, isControl: false },
    ]);

    // Dimension requirement: accounts 5000-5999 require a "Department" dimension
    mockPrisma.dimensionRequirement.findMany.mockResolvedValue([
      {
        dimensionTypeId: DIM_TYPE_ID,
        accountCodeFrom: '5000',
        accountCodeTo: '5999',
        dimensionType: { code: 'DEPT', name: 'Department' },
      },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('DIMENSION_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// POST /finance/journals/:id/reverse — AC-7: Reverse posted entry
// ---------------------------------------------------------------------------

describe('POST /finance/journals/:id/reverse', () => {
  it('reverses a POSTED entry creating a mirror entry (AC-7)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Original POSTED entry
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'POSTED',
      source: 'MANUAL',
      sourceId: null,
      sourceReference: null,
      transactionDate: new Date('2026-01-15'),
      description: 'Original entry',
      reference: 'REF-001',
      periodId: TEST_PERIOD_ID,
      lines: [
        {
          accountCode: '1000',
          description: 'Debit',
          debit: 1000,
          credit: 0,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
        {
          accountCode: '2000',
          description: 'Credit',
          debit: 0,
          credit: 1000,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
      ],
    });

    // Period is OPEN
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // Number series for reversal
    mockNextNumber.mockResolvedValue('JE-00002');

    // Create reversal entry
    mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_REVERSAL_ID });
    mockPrisma.journalLine.create.mockResolvedValue({ id: 'rev-line-1' });
    mockPrisma.journalEntry.update.mockResolvedValue({});
    mockPrisma.chartOfAccount.update.mockResolvedValue({});

    // Return full reversal entry
    const reversalEntry = makeMockJournalEntry({
      id: TEST_REVERSAL_ID,
      entryNumber: 'JE-00002',
      description: 'Reversal of JE-00001: Original entry',
      status: 'POSTED',
      postedAt: new Date().toISOString(),
      postedBy: TEST_USER_ID,
      reversalOfId: TEST_JOURNAL_ID,
      isAutoGenerated: true,
      lines: [
        {
          id: 'rev-line-1',
          lineNumber: 1,
          accountCode: '1000',
          description: 'Debit',
          debit: 0,
          credit: 1000,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
        {
          id: 'rev-line-2',
          lineNumber: 2,
          accountCode: '2000',
          description: 'Credit',
          debit: 1000,
          credit: 0,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
      ],
    });
    mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue(reversalEntry);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/reverse`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('POSTED');
    expect(body.data.reversalOfId).toBe(TEST_JOURNAL_ID);
    expect(body.data.isAutoGenerated).toBe(true);

    // Original entry marked as REVERSED
    expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_JOURNAL_ID },
        data: { status: 'REVERSED' },
      }),
    );

    // journal.reversed event emitted
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'journal.reversed',
      expect.objectContaining({
        journalEntryId: TEST_JOURNAL_ID,
        reversalEntryId: TEST_REVERSAL_ID,
        originalSource: 'MANUAL',
      }),
    );
  });

  it('rejects reversing a DRAFT entry (BR-FIN-011)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      status: 'DRAFT',
      source: 'MANUAL',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/reverse`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects reversing when period is CLOSED (BR-FIN-003)', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      status: 'POSTED',
      source: 'MANUAL',
      periodId: TEST_PERIOD_ID,
      transactionDate: new Date('2026-01-15'),
      description: 'Entry',
      reference: null,
      sourceId: null,
      sourceReference: null,
      lines: [
        {
          accountCode: '1000',
          description: null,
          debit: 1000,
          credit: 0,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
        {
          accountCode: '2000',
          description: null,
          debit: 0,
          credit: 1000,
          vatCode: null,
          currencyCode: null,
          foreignAmount: null,
          exchangeRate: null,
          dimensions: [],
        },
      ],
    });

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'CLOSED',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/reverse`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('PERIOD_NOT_OPEN');
  });

  it('returns 404 for non-existent entry', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/journals/${TEST_JOURNAL_ID}/reverse`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/journals — AC-11: List with filters
// ---------------------------------------------------------------------------

describe('GET /finance/journals', () => {
  it('returns paginated journal entries with filters (AC-11)', async () => {
    app = await buildTestApp();

    const mockEntries = [
      makeMockListItem(),
      makeMockListItem({ id: 'entry-2', entryNumber: 'JE-00002' }),
    ];

    mockPrisma.journalEntry.findMany.mockResolvedValue(mockEntries);
    mockPrisma.journalEntry.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/journals?status=DRAFT&source=MANUAL',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);

    // Verify filters were passed
    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          status: 'DRAFT',
          source: 'MANUAL',
        }),
      }),
    );
  });

  it('filters by date range (AC-11)', async () => {
    app = await buildTestApp();

    mockPrisma.journalEntry.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/journals?dateFrom=2026-01-01&dateTo=2026-01-31',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transactionDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('filters by periodId (AC-11)', async () => {
    app = await buildTestApp();

    mockPrisma.journalEntry.findMany.mockResolvedValue([]);
    mockPrisma.journalEntry.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: `/finance/journals?periodId=${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodId: TEST_PERIOD_ID,
        }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/journals',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/journals/search — text search
// ---------------------------------------------------------------------------

describe('GET /finance/journals/search', () => {
  it('searches journal entries by text', async () => {
    app = await buildTestApp();

    mockPrisma.journalEntry.findMany.mockResolvedValue([
      makeMockListItem({ description: 'Rent payment' }),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/journals/search?search=rent',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('rejects empty search term', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/journals/search?search=',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/journals/:id — detail view
// ---------------------------------------------------------------------------

describe('GET /finance/journals/:id', () => {
  it('returns journal entry detail with lines and dimensions', async () => {
    app = await buildTestApp();

    const mockEntry = makeMockJournalEntry();
    mockPrisma.journalEntry.findFirst.mockResolvedValue(mockEntry);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/journals/${TEST_JOURNAL_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_JOURNAL_ID);
    expect(body.data.lines).toHaveLength(2);
    expect(body.data.createdBy).toBe(TEST_USER_ID);
  });

  it('returns 404 for non-existent entry', async () => {
    app = await buildTestApp();

    mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/journals/${TEST_JOURNAL_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Permission enforcement
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('returns 403 for VIEWER role on POST /journals', async () => {
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
      url: '/finance/journals',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        transactionDate: '2026-01-15',
        description: 'Test',
        periodId: TEST_PERIOD_ID,
        lines: [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '2000', debit: 0, credit: 1000 },
        ],
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on GET /journals', async () => {
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
      url: '/finance/journals',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /journals/:id/post', async () => {
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
      url: `/finance/journals/${TEST_JOURNAL_ID}/post`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /journals/:id/reverse', async () => {
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
      url: `/finance/journals/${TEST_JOURNAL_ID}/reverse`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
