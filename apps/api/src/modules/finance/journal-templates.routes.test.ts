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
      journalTemplate: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      journalEntry: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      journalLine: {
        create: vi.fn(),
      },
      chartOfAccount: {
        findMany: vi.fn(),
      },
      financialPeriod: {
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
import { journalTemplatesRoutesPlugin } from './journal-templates.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_TEMPLATE_ID = '22222222-2222-4000-a000-222222222222';
const TEST_PERIOD_ID = '33333333-3333-4000-a000-333333333333';
const TEST_JOURNAL_ID = '44444444-4444-4000-a000-444444444444';

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
  await app.register(journalTemplatesRoutesPlugin, { prefix: '/finance' });

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
          ? { 'finance.journals': fullPerm, 'finance.templates': fullPerm }
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

const SAMPLE_TEMPLATE_LINES = [
  { accountCode: '1000', debit: 500, credit: 0, description: 'Rent debit' },
  { accountCode: '2000', debit: 0, credit: 500, description: 'Rent credit' },
];

function makeMockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_TEMPLATE_ID,
    companyId: TEST_COMPANY_ID,
    name: 'Monthly Rent',
    description: 'Recurring monthly rent journal',
    frequency: 'MONTHLY',
    isActive: true,
    templateLines: SAMPLE_TEMPLATE_LINES,
    nextDueDate: new Date('2026-02-01'),
    lastExecutedAt: new Date('2026-01-01T10:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    ...overrides,
  };
}

function makeMockJournalEntry() {
  return {
    id: TEST_JOURNAL_ID,
    entryNumber: 'JE-00001',
    transactionDate: new Date('2026-01-15'),
    description: 'From template: Monthly Rent',
    reference: null,
    source: 'MANUAL',
    sourceId: null,
    sourceReference: null,
    isAutoGenerated: false,
    status: 'DRAFT',
    postedAt: null,
    postedBy: null,
    reversalOfId: null,
    periodId: TEST_PERIOD_ID,
    totalDebit: 500,
    totalCredit: 500,
    templateId: TEST_TEMPLATE_ID,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    lines: [
      {
        id: 'line-1',
        lineNumber: 1,
        accountCode: '1000',
        description: 'Rent debit',
        debit: 500,
        credit: 0,
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
      },
      {
        id: 'line-2',
        lineNumber: 2,
        accountCode: '2000',
        description: 'Rent credit',
        debit: 0,
        credit: 500,
        vatCode: null,
        currencyCode: null,
        foreignAmount: null,
        exchangeRate: null,
      },
    ],
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
// GET /finance/templates — AC-1: List templates
// ---------------------------------------------------------------------------

describe('GET /finance/templates', () => {
  it('lists templates with frequency and next due date (AC-1)', async () => {
    app = await buildTestApp();

    const mockTemplates = [makeMockTemplate()];
    mockPrisma.journalTemplate.findMany.mockResolvedValue(mockTemplates);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/templates',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Monthly Rent');
    expect(body.data[0].frequency).toBe('MONTHLY');
    expect(body.data[0].nextDueDate).toBe('2026-02-01');
  });

  it('filters by frequency query param', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/templates?frequency=WEEKLY',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toHaveLength(0);
  });

  it('returns 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/templates',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/templates — AC-2: Create template
// ---------------------------------------------------------------------------

describe('POST /finance/templates', () => {
  it('creates template with lines JSON (AC-2)', async () => {
    app = await buildTestApp();

    const mockTemplate = makeMockTemplate();
    mockPrisma.journalTemplate.create.mockResolvedValue(mockTemplate);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/templates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Monthly Rent',
        description: 'Recurring monthly rent journal',
        frequency: 'MONTHLY',
        templateLines: SAMPLE_TEMPLATE_LINES,
        nextDueDate: '2026-02-01',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Monthly Rent');
    expect(body.data.frequency).toBe('MONTHLY');
    expect(body.data.templateLines).toHaveLength(2);
    expect(mockPrisma.journalTemplate.create).toHaveBeenCalledTimes(1);
  });

  it('rejects template with fewer than 2 lines', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/templates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Bad Template',
        frequency: 'MONTHLY',
        templateLines: [{ accountCode: '1000', debit: 100, credit: 0 }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects template without a name', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/templates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        frequency: 'MONTHLY',
        templateLines: SAMPLE_TEMPLATE_LINES,
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/templates/:id — AC-3: Update template
// ---------------------------------------------------------------------------

describe('PATCH /finance/templates/:id', () => {
  it('updates template name (AC-3)', async () => {
    app = await buildTestApp();

    const mockTemplate = makeMockTemplate({ name: 'Updated Rent' });
    mockPrisma.journalTemplate.findFirst.mockResolvedValue({ id: TEST_TEMPLATE_ID });
    mockPrisma.journalTemplate.update.mockResolvedValue(mockTemplate);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/templates/${TEST_TEMPLATE_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated Rent' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Updated Rent');
  });

  it('returns 404 for non-existent template', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/templates/${TEST_TEMPLATE_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated Rent' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /finance/templates/:id — AC-4: Soft-delete
// ---------------------------------------------------------------------------

describe('DELETE /finance/templates/:id', () => {
  it('soft-deletes template by setting isActive=false (AC-4)', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findFirst.mockResolvedValue({ id: TEST_TEMPLATE_ID });
    mockPrisma.journalTemplate.update.mockResolvedValue(makeMockTemplate({ isActive: false }));

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/templates/${TEST_TEMPLATE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(false);
    expect(mockPrisma.journalTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_TEMPLATE_ID },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('returns 404 for non-existent template', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/templates/${TEST_TEMPLATE_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/templates/:id/execute — AC-5, AC-6: Execute template
// ---------------------------------------------------------------------------

describe('POST /finance/templates/:id/execute', () => {
  it('creates a journal entry from template lines (AC-5)', async () => {
    app = await buildTestApp();

    // Template lookup (before transaction)
    mockPrisma.journalTemplate.findFirst.mockResolvedValue(makeMockTemplate());

    // Transaction mock
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Period validation
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // Account validation
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '2000' }]);

    // Number series
    mockNextNumber.mockResolvedValue('JE-00001');

    // Journal entry creation
    mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_JOURNAL_ID });
    mockPrisma.journalLine.create.mockResolvedValue({ id: 'line-1' });
    mockPrisma.journalTemplate.update.mockResolvedValue(makeMockTemplate());

    // Return full journal entry
    mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue(makeMockJournalEntry());

    const res = await app.inject({
      method: 'POST',
      url: `/finance/templates/${TEST_TEMPLATE_ID}/execute`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        periodId: TEST_PERIOD_ID,
        transactionDate: '2026-01-15',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.entryNumber).toBe('JE-00001');
    expect(body.data.templateId).toBe(TEST_TEMPLATE_ID);
    expect(body.data.lines).toHaveLength(2);
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.source).toBe('MANUAL');
  });

  it('updates lastExecutedAt and calculates next due date (AC-6)', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findFirst.mockResolvedValue(makeMockTemplate());

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '2000' }]);

    mockNextNumber.mockResolvedValue('JE-00002');
    mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_JOURNAL_ID });
    mockPrisma.journalLine.create.mockResolvedValue({ id: 'line-1' });
    mockPrisma.journalTemplate.update.mockResolvedValue(makeMockTemplate());
    mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue(makeMockJournalEntry());

    await app.inject({
      method: 'POST',
      url: `/finance/templates/${TEST_TEMPLATE_ID}/execute`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { periodId: TEST_PERIOD_ID },
    });

    // Verify template was updated with lastExecutedAt and nextDueDate
    expect(mockPrisma.journalTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_TEMPLATE_ID },
        data: expect.objectContaining({
          lastExecutedAt: expect.any(Date),
          nextDueDate: expect.any(Date),
        }),
      }),
    );
  });

  it('returns 404 for inactive template', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/templates/${TEST_TEMPLATE_ID}/execute`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when period not found', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findFirst.mockResolvedValue(makeMockTemplate());

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/templates/${TEST_TEMPLATE_ID}/execute`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(404);
  });

  it('emits journal.created event on successful execution', async () => {
    app = await buildTestApp();

    mockPrisma.journalTemplate.findFirst.mockResolvedValue(makeMockTemplate());

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '2000' }]);

    mockNextNumber.mockResolvedValue('JE-00003');
    mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_JOURNAL_ID });
    mockPrisma.journalLine.create.mockResolvedValue({ id: 'line-1' });
    mockPrisma.journalTemplate.update.mockResolvedValue(makeMockTemplate());
    mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue(makeMockJournalEntry());

    const res = await app.inject({
      method: 'POST',
      url: `/finance/templates/${TEST_TEMPLATE_ID}/execute`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { periodId: TEST_PERIOD_ID },
    });

    expect(res.statusCode).toBe(201);
    expect(mockEventBus.emit).toHaveBeenCalledWith('journal.created', {
      journalEntryId: TEST_JOURNAL_ID,
      entryNumber: 'JE-00001',
      companyId: TEST_COMPANY_ID,
      source: 'MANUAL',
      createdBy: TEST_USER_ID,
    });
  });
});

// ---------------------------------------------------------------------------
// calculateNextDueDate unit tests
// ---------------------------------------------------------------------------

describe('calculateNextDueDate', () => {
  // Import the function directly for unit testing
  let calculateNextDueDate: (frequency: string, fromDate: Date) => Date;

  beforeAll(async () => {
    const mod = await import('./journal-templates.service.js');
    calculateNextDueDate = mod.calculateNextDueDate;
  });

  it('adds 1 day for DAILY', () => {
    const result = calculateNextDueDate('DAILY', new Date('2026-01-15T12:00:00Z'));
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-16');
  });

  it('adds 7 days for WEEKLY', () => {
    const result = calculateNextDueDate('WEEKLY', new Date('2026-01-15T12:00:00Z'));
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-22');
  });

  it('adds 1 month for MONTHLY', () => {
    const result = calculateNextDueDate('MONTHLY', new Date('2026-01-15T12:00:00Z'));
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-15');
  });

  it('adds 3 months for QUARTERLY', () => {
    const result = calculateNextDueDate('QUARTERLY', new Date('2026-01-15T12:00:00Z'));
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('adds 1 year for YEARLY', () => {
    const result = calculateNextDueDate('YEARLY', new Date('2026-01-15T12:00:00Z'));
    expect(result.toISOString().slice(0, 10)).toBe('2027-01-15');
  });
});
