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
      simulation: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      simulationLine: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        groupBy: vi.fn(),
      },
      chartOfAccount: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      financialPeriod: {
        findFirst: vi.fn(),
      },
      // Journal mocks needed for convert action (createJournalEntry)
      journalEntry: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      journalLine: {
        create: vi.fn(),
      },
      journalLineDimension: {
        create: vi.fn(),
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
    JsonNull: 'DbNull',
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

// Mock multi-currency service (used by createJournalEntry during convert)
vi.mock('./multi-currency.service.js', () => ({
  convertLinesToBaseCurrency: vi.fn(
    async (_tx: unknown, _companyId: string, _base: string, _date: Date, lines: unknown[]) => lines,
  ),
  getBaseCurrencyCode: vi.fn(async () => 'GBP'),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { simulationsRoutesPlugin } from './simulations.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_PERIOD_ID = '22222222-2222-4000-a000-222222222222';
const TEST_SIMULATION_ID = '55555555-5555-4000-a000-555555555555';
const TEST_JOURNAL_ID = '33333333-3333-4000-a000-333333333333';

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
  await app.register(simulationsRoutesPlugin, { prefix: '/finance' });

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
          ? { 'finance.simulations': fullPerm, 'finance.journals': fullPerm }
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

/** Create a mock simulation row as Prisma would return */
function makeMockSimulation(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SIMULATION_ID,
    entryNumber: 'SIM-00001',
    transactionDate: new Date('2026-01-15'),
    description: 'Test simulation',
    reference: 'REF-SIM-001',
    status: 'ACTIVE',
    periodId: TEST_PERIOD_ID,
    totalDebit: 1000,
    totalCredit: 1000,
    transferredToId: null,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    lines: [
      {
        id: 'sim-line-1',
        lineNumber: 1,
        accountCode: '1000',
        description: 'Debit line',
        debit: 1000,
        credit: 0,
        vatCode: null,
        dimensionValues: null,
        account: { name: 'Cash' },
      },
      {
        id: 'sim-line-2',
        lineNumber: 2,
        accountCode: '2000',
        description: 'Credit line',
        debit: 0,
        credit: 1000,
        vatCode: null,
        dimensionValues: null,
        account: { name: 'Bank' },
      },
    ],
    ...overrides,
  };
}

function makeMockJournalEntry() {
  return {
    id: TEST_JOURNAL_ID,
    entryNumber: 'JE-00001',
    transactionDate: new Date('2026-01-15'),
    description: 'Test simulation',
    reference: 'REF-SIM-001',
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
        id: 'je-line-1',
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
        account: { name: 'Cash' },
      },
      {
        id: 'je-line-2',
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
        account: { name: 'Bank' },
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
// POST /finance/simulations — Create
// ---------------------------------------------------------------------------

describe('POST /finance/simulations', () => {
  it('creates simulation with auto-generated entryNumber', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Period exists and is OPEN
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // Accounts exist
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '2000' }]);

    // Number series returns entry number
    mockNextNumber.mockResolvedValue('SIM-00001');

    // Simulation creation
    mockPrisma.simulation.create.mockResolvedValue({ id: TEST_SIMULATION_ID });
    mockPrisma.simulationLine.create.mockResolvedValue({ id: 'sim-line-1' });

    // Return full simulation
    const mockSim = makeMockSimulation();
    mockPrisma.simulation.findUniqueOrThrow.mockResolvedValue(mockSim);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/simulations',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        transactionDate: '2026-01-15',
        description: 'Test simulation',
        reference: 'REF-SIM-001',
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
    expect(body.data.entryNumber).toBe('SIM-00001');
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.lines).toHaveLength(2);

    // Verify nextNumber was called with SIMULATION
    expect(mockNextNumber).toHaveBeenCalledWith(expect.anything(), TEST_COMPANY_ID, 'SIMULATION');

    // Verify simulation.created event was emitted
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'simulation.created',
      expect.objectContaining({
        simulationId: TEST_SIMULATION_ID,
        entryNumber: 'SIM-00001',
        companyId: TEST_COMPANY_ID,
      }),
    );
  });

  it('rejects unbalanced lines', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/simulations',
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
          { accountCode: '2000', debit: 0, credit: 500 },
        ],
      },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('ENTRY_NOT_BALANCED');
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
      url: '/finance/simulations',
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
      url: '/finance/simulations',
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

  it('rejects fewer than 2 lines', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/simulations',
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
      url: '/finance/simulations',
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
// GET /finance/simulations — List
// ---------------------------------------------------------------------------

describe('GET /finance/simulations', () => {
  it('returns paginated list of simulations', async () => {
    app = await buildTestApp();

    const mockSim = makeMockSimulation();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { lines, ...listItem } = mockSim;
    mockPrisma.simulation.findMany.mockResolvedValue([listItem]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/simulations',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].entryNumber).toBe('SIM-00001');
  });

  it('filters by status', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/simulations?status=ACTIVE',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.simulation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('filters by periodId', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/simulations?periodId=${TEST_PERIOD_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.simulation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ periodId: TEST_PERIOD_ID }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// GET /finance/simulations/:id — Detail
// ---------------------------------------------------------------------------

describe('GET /finance/simulations/:id', () => {
  it('returns simulation detail with lines', async () => {
    app = await buildTestApp();

    const mockSim = makeMockSimulation();
    mockPrisma.simulation.findFirst.mockResolvedValue(mockSim);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_SIMULATION_ID);
    expect(body.data.lines).toHaveLength(2);
    expect(body.data.lines[0].accountName).toBe('Cash');
  });

  it('returns 404 for non-existent simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /finance/simulations/:id — Update
// ---------------------------------------------------------------------------

describe('PATCH /finance/simulations/:id', () => {
  it('updates an ACTIVE simulation', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Existing ACTIVE simulation
    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'ACTIVE',
    });

    // Accounts exist
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '3000' }]);

    mockPrisma.simulationLine.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.simulationLine.create.mockResolvedValue({ id: 'new-line' });
    mockPrisma.simulation.update.mockResolvedValue({ id: TEST_SIMULATION_ID });

    const updatedSim = makeMockSimulation({
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
          dimensionValues: null,
          account: { name: 'Cash' },
        },
        {
          id: 'new-line-2',
          lineNumber: 2,
          accountCode: '3000',
          description: 'Updated credit',
          debit: 0,
          credit: 2000,
          vatCode: null,
          dimensionValues: null,
          account: { name: 'Revenue' },
        },
      ],
    });
    mockPrisma.simulation.findUniqueOrThrow.mockResolvedValue(updatedSim);

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
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

  it('rejects update of TRANSFERRED simulation', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'TRANSFERRED',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { description: 'Try to change' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SIMULATION_NOT_ACTIVE');
  });

  it('rejects unbalanced replacement lines', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'ACTIVE',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        lines: [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '2000', debit: 0, credit: 500 },
        ],
      },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.code).toBe('ENTRY_NOT_BALANCED');
  });
});

// ---------------------------------------------------------------------------
// DELETE /finance/simulations/:id
// ---------------------------------------------------------------------------

describe('DELETE /finance/simulations/:id', () => {
  it('deletes an ACTIVE simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'ACTIVE',
    });
    mockPrisma.simulation.delete.mockResolvedValue({ id: TEST_SIMULATION_ID });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('deletes an INVALID simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'INVALID',
    });
    mockPrisma.simulation.delete.mockResolvedValue({ id: TEST_SIMULATION_ID });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('rejects deletion of TRANSFERRED simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'TRANSFERRED',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SIMULATION_TRANSFERRED');
  });

  it('returns 404 for non-existent simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/simulations/${TEST_SIMULATION_ID}`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/simulations/:id/convert — Convert to journal entry
// ---------------------------------------------------------------------------

describe('POST /finance/simulations/:id/convert', () => {
  it('converts ACTIVE simulation to DRAFT journal entry', async () => {
    app = await buildTestApp();

    // The convert action calls simulation.findFirst directly (not via $transaction)
    const mockSim = makeMockSimulation();
    mockPrisma.simulation.findFirst.mockResolvedValue(mockSim);

    // createJournalEntry uses $transaction internally
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );

    // Period exists (for createJournalEntry)
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      id: TEST_PERIOD_ID,
      status: 'OPEN',
    });

    // Accounts exist (for createJournalEntry)
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([{ code: '1000' }, { code: '2000' }]);

    // Number series for journal
    mockNextNumber.mockResolvedValue('JE-00001');

    // Journal creation
    mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_JOURNAL_ID });
    mockPrisma.journalLine.create.mockResolvedValue({ id: 'je-line-1' });

    // Return full journal entry
    const mockJournal = makeMockJournalEntry();
    mockPrisma.journalEntry.findUniqueOrThrow.mockResolvedValue(mockJournal);

    // Simulation update (mark as TRANSFERRED)
    mockPrisma.simulation.update.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'TRANSFERRED',
      transferredToId: TEST_JOURNAL_ID,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/convert`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.entryNumber).toBe('JE-00001');
    expect(body.data.status).toBe('DRAFT');

    // Verify simulation marked as TRANSFERRED
    expect(mockPrisma.simulation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_SIMULATION_ID },
        data: expect.objectContaining({
          status: 'TRANSFERRED',
          transferredToId: TEST_JOURNAL_ID,
        }),
      }),
    );

    // Verify simulation.converted event
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'simulation.converted',
      expect.objectContaining({
        simulationId: TEST_SIMULATION_ID,
        journalEntryId: TEST_JOURNAL_ID,
        companyId: TEST_COMPANY_ID,
      }),
    );
  });

  it('rejects conversion of TRANSFERRED simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'TRANSFERRED',
      lines: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/convert`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SIMULATION_NOT_ACTIVE');
  });

  it('rejects conversion of INVALID simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'INVALID',
      lines: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/convert`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SIMULATION_NOT_ACTIVE');
  });

  it('returns 404 for non-existent simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/convert`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/simulations/:id/invalidate — Mark as INVALID
// ---------------------------------------------------------------------------

describe('POST /finance/simulations/:id/invalidate', () => {
  it('invalidates an ACTIVE simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'ACTIVE',
    });

    const invalidatedSim = makeMockSimulation({ status: 'INVALID' });
    mockPrisma.simulation.update.mockResolvedValue(invalidatedSim);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/invalidate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('INVALID');

    // Verify simulation.invalidated event
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'simulation.invalidated',
      expect.objectContaining({
        simulationId: TEST_SIMULATION_ID,
        companyId: TEST_COMPANY_ID,
      }),
    );
  });

  it('rejects invalidation of TRANSFERRED simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'TRANSFERRED',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/invalidate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SIMULATION_NOT_ACTIVE');
  });

  it('rejects invalidation of already INVALID simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue({
      id: TEST_SIMULATION_ID,
      status: 'INVALID',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/invalidate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('SIMULATION_NOT_ACTIVE');
  });

  it('returns 404 for non-existent simulation', async () => {
    app = await buildTestApp();

    mockPrisma.simulation.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/simulations/${TEST_SIMULATION_ID}/invalidate`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
