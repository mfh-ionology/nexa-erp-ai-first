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
    bankTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
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
import { bankImportRoutesPlugin } from './bank-import.routes.js';
import { parseCSV, parseOFX, parseQIF, generateExternalId } from './bank-import.service.js';

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
// Sample file contents
// ---------------------------------------------------------------------------

const VALID_CSV = `Date,Description,Amount,Reference
2026-01-15,ACME PAYMENT,1500.00,REF001
2026-01-16,ELECTRIC BILL,-250.00,DD001
2026-01-17,REFUND,75.50,`;

const CSV_NO_REFERENCE_HEADER = `Date,Description,Amount
2026-01-15,ACME PAYMENT,1500.00
2026-01-16,ELECTRIC BILL,-250.00`;

const VALID_OFX = `
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20260115
<TRNAMT>1500.00
<NAME>ACME PAYMENT
<FITID>TXN001
<CHECKNUM>REF001
</STMTTRN>
<STMTTRN>
<DTPOSTED>20260116
<TRNAMT>-250.00
<NAME>ELECTRIC BILL
<FITID>TXN002
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const VALID_QIF = `!Type:Bank
D15/01/2026
T1500.00
PACME PAYMENT
NREF001
^
D16/01/2026
T-250.00
PELECTRIC BILL
NDD001
^`;

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
  await app.register(bankImportRoutesPlugin, { prefix: '/finance' });

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

/**
 * Sets up mocks for a successful import flow.
 * Returns the created transaction records mock.
 */
function setupSuccessfulImportMocks(
  existingExternalIds: string[] = [],
  createdTransactions?: Array<Record<string, unknown>>,
) {
  // Bank account exists
  mockPrisma.bankAccount.findFirst.mockResolvedValue({
    id: TEST_BANK_ACCOUNT_ID,
    name: 'Main Business Account',
  });

  // Existing transactions for duplicate detection
  mockPrisma.bankTransaction.findMany.mockResolvedValue(
    existingExternalIds.map((eid) => ({ externalId: eid })),
  );

  // Transaction mock — pass through the function
  let createCallIndex = 0;
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      createCallIndex = 0;
      return fn(mockPrisma);
    },
  );

  // Create mock — returns the data passed in with an id
  mockPrisma.bankTransaction.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      const defaultTxns = createdTransactions || [];
      if (defaultTxns[createCallIndex]) {
        const result = defaultTxns[createCallIndex];
        createCallIndex++;
        return result;
      }
      createCallIndex++;
      return {
        id: `txn-${createCallIndex}-${crypto.randomUUID().slice(0, 8)}`,
        externalId: data.externalId,
        transactionDate: data.transactionDate,
        description: data.description,
        amount: data.amount,
        reference: data.reference ?? null,
        type: data.type ?? null,
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
// Unit tests: CSV Parser
// ---------------------------------------------------------------------------

describe('CSV Parser', () => {
  it('parses valid CSV with all fields', () => {
    const result = parseCSV(VALID_CSV, TEST_BANK_ACCOUNT_ID);

    expect(result).toHaveLength(3);

    expect(result[0].description).toBe('ACME PAYMENT');
    expect(result[0].amount).toBe(1500.0);
    expect(result[0].reference).toBe('REF001');
    expect(result[0].type).toBe('CREDIT');
    expect(result[0].transactionDate).toBeInstanceOf(Date);

    expect(result[1].description).toBe('ELECTRIC BILL');
    expect(result[1].amount).toBe(-250.0);
    expect(result[1].reference).toBe('DD001');
    expect(result[1].type).toBe('DEBIT');

    expect(result[2].description).toBe('REFUND');
    expect(result[2].amount).toBe(75.5);
    expect(result[2].reference).toBe(null);
    expect(result[2].type).toBe('CREDIT');
  });

  it('parses CSV without Reference header', () => {
    const result = parseCSV(CSV_NO_REFERENCE_HEADER, TEST_BANK_ACCOUNT_ID);

    expect(result).toHaveLength(2);
    expect(result[0].reference).toBe(null);
  });

  it('generates deterministic externalId', () => {
    const result1 = parseCSV(VALID_CSV, TEST_BANK_ACCOUNT_ID);
    const result2 = parseCSV(VALID_CSV, TEST_BANK_ACCOUNT_ID);

    // Same input should produce same externalIds
    expect(result1[0].externalId).toBe(result2[0].externalId);
    expect(result1[1].externalId).toBe(result2[1].externalId);

    // Different rows should have different externalIds
    expect(result1[0].externalId).not.toBe(result1[1].externalId);
  });

  it('handles UK date format (DD/MM/YYYY)', () => {
    const csv = `Date,Description,Amount,Reference
15/01/2026,PAYMENT,100.00,REF`;

    const result = parseCSV(csv, TEST_BANK_ACCOUNT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].transactionDate.toISOString()).toContain('2026-01-15');
  });

  it('handles Windows line endings (CRLF)', () => {
    const csv = 'Date,Description,Amount,Reference\r\n2026-01-15,PAYMENT,100.00,REF\r\n';

    const result = parseCSV(csv, TEST_BANK_ACCOUNT_ID);
    expect(result).toHaveLength(1);
  });

  it('handles quoted fields in CSV', () => {
    const csv = `Date,Description,Amount,Reference
2026-01-15,"ACME, INC. PAYMENT",1500.00,REF001`;

    const result = parseCSV(csv, TEST_BANK_ACCOUNT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('ACME, INC. PAYMENT');
  });

  it('skips empty lines', () => {
    const csv = `Date,Description,Amount,Reference
2026-01-15,PAYMENT,100.00,REF

2026-01-16,PAYMENT2,200.00,REF2
`;

    const result = parseCSV(csv, TEST_BANK_ACCOUNT_ID);
    expect(result).toHaveLength(2);
  });

  it('throws on header-only CSV', () => {
    const csv = 'Date,Description,Amount,Reference';

    expect(() => parseCSV(csv, TEST_BANK_ACCOUNT_ID)).toThrow('CSV must have a header row');
  });

  it('throws on invalid header', () => {
    const csv = `Name,Value,Other
row1,1,2`;

    expect(() => parseCSV(csv, TEST_BANK_ACCOUNT_ID)).toThrow('CSV header must contain');
  });

  it('throws on invalid date', () => {
    const csv = `Date,Description,Amount,Reference
not-a-date,PAYMENT,100.00,REF`;

    expect(() => parseCSV(csv, TEST_BANK_ACCOUNT_ID)).toThrow('invalid date format');
  });

  it('throws on invalid amount', () => {
    const csv = `Date,Description,Amount,Reference
2026-01-15,PAYMENT,not-a-number,REF`;

    expect(() => parseCSV(csv, TEST_BANK_ACCOUNT_ID)).toThrow('invalid amount');
  });

  it('throws on row with too few fields', () => {
    const csv = `Date,Description,Amount,Reference
2026-01-15,PAYMENT`;

    expect(() => parseCSV(csv, TEST_BANK_ACCOUNT_ID)).toThrow('expected at least 3 fields');
  });
});

// ---------------------------------------------------------------------------
// Unit tests: OFX Parser
// ---------------------------------------------------------------------------

describe('OFX Parser', () => {
  it('parses valid OFX with FITID as externalId', () => {
    const result = parseOFX(VALID_OFX, TEST_BANK_ACCOUNT_ID);

    expect(result).toHaveLength(2);

    expect(result[0].description).toBe('ACME PAYMENT');
    expect(result[0].amount).toBe(1500.0);
    expect(result[0].externalId).toBe('TXN001');
    expect(result[0].reference).toBe('REF001');
    expect(result[0].type).toBe('CREDIT');

    expect(result[1].description).toBe('ELECTRIC BILL');
    expect(result[1].amount).toBe(-250.0);
    expect(result[1].externalId).toBe('TXN002');
    expect(result[1].type).toBe('DEBIT');
  });

  it('parses OFX XML-style tags', () => {
    const ofxXml = `
<STMTTRN>
<DTPOSTED>20260115</DTPOSTED>
<TRNAMT>500.00</TRNAMT>
<NAME>XML PAYMENT</NAME>
<FITID>XMLTXN01</FITID>
</STMTTRN>`;

    const result = parseOFX(ofxXml, TEST_BANK_ACCOUNT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe('XMLTXN01');
    expect(result[0].description).toBe('XML PAYMENT');
  });

  it('generates externalId when FITID is missing', () => {
    const ofxNoFitId = `
<STMTTRN>
<DTPOSTED>20260115
<TRNAMT>500.00
<NAME>NO FITID PAYMENT
</STMTTRN>`;

    const result = parseOFX(ofxNoFitId, TEST_BANK_ACCOUNT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBeTruthy();
    expect(result[0].externalId.length).toBe(40);
  });

  it('uses MEMO when NAME is missing', () => {
    const ofxMemo = `
<STMTTRN>
<DTPOSTED>20260115
<TRNAMT>100.00
<MEMO>MEMO DESC
<FITID>M001
</STMTTRN>`;

    const result = parseOFX(ofxMemo, TEST_BANK_ACCOUNT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('MEMO DESC');
  });

  it('throws on empty OFX', () => {
    expect(() => parseOFX('<OFX></OFX>', TEST_BANK_ACCOUNT_ID)).toThrow(
      'No valid transactions found in OFX',
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests: QIF Parser
// ---------------------------------------------------------------------------

describe('QIF Parser', () => {
  it('parses valid QIF content', () => {
    const result = parseQIF(VALID_QIF, TEST_BANK_ACCOUNT_ID);

    expect(result).toHaveLength(2);

    expect(result[0].description).toBe('ACME PAYMENT');
    expect(result[0].amount).toBe(1500.0);
    expect(result[0].reference).toBe('REF001');
    expect(result[0].type).toBe('CREDIT');

    expect(result[1].description).toBe('ELECTRIC BILL');
    expect(result[1].amount).toBe(-250.0);
    expect(result[1].reference).toBe('DD001');
    expect(result[1].type).toBe('DEBIT');
  });

  it('throws on empty QIF', () => {
    expect(() => parseQIF('!Type:Bank\n^', TEST_BANK_ACCOUNT_ID)).toThrow(
      'No valid transactions found in QIF',
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests: generateExternalId
// ---------------------------------------------------------------------------

describe('generateExternalId', () => {
  it('generates deterministic hash', () => {
    const id1 = generateExternalId('acc1', '2026-01-15', '100.00', 'TEST');
    const id2 = generateExternalId('acc1', '2026-01-15', '100.00', 'TEST');

    expect(id1).toBe(id2);
    expect(id1).toHaveLength(40);
  });

  it('different inputs produce different hashes', () => {
    const id1 = generateExternalId('acc1', '2026-01-15', '100.00', 'TEST1');
    const id2 = generateExternalId('acc1', '2026-01-15', '100.00', 'TEST2');

    expect(id1).not.toBe(id2);
  });

  it('bankAccountId is part of the hash', () => {
    const id1 = generateExternalId('acc1', '2026-01-15', '100.00', 'TEST');
    const id2 = generateExternalId('acc2', '2026-01-15', '100.00', 'TEST');

    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:id/import — AC-1: CSV import
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts/:id/import', () => {
  it('imports CSV file and creates BankTransaction records (AC-1, AC-2)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(3);
    expect(body.data.imported).toBe(3);
    expect(body.data.duplicatesSkipped).toBe(0);
    expect(body.data.importBatchId).toBeTruthy();
    expect(body.data.transactions).toHaveLength(3);
  });

  it('handles positive amounts as CREDIT and negative as DEBIT (AC-2)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(200);

    // Verify the create calls had correct type values
    const createCalls = mockPrisma.bankTransaction.create.mock.calls;
    expect(createCalls.length).toBe(3);

    // First transaction: 1500.00 -> CREDIT
    expect(createCalls[0][0].data.type).toBe('CREDIT');
    // Second transaction: -250.00 -> DEBIT
    expect(createCalls[1][0].data.type).toBe('DEBIT');
    // Third transaction: 75.50 -> CREDIT
    expect(createCalls[2][0].data.type).toBe('CREDIT');
  });

  it('imports OFX file (AC-3)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_OFX,
        format: 'ofx',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.total).toBe(2);
    expect(body.data.imported).toBe(2);
  });

  it('imports QIF file (AC-3)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_QIF,
        format: 'qif',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.total).toBe(2);
    expect(body.data.imported).toBe(2);
  });

  // AC-4: Duplicate detection via externalId (BR-FIN-008)
  it('skips duplicate transactions via externalId (AC-4, BR-FIN-008)', async () => {
    app = await buildTestApp();

    // Parse CSV to get the externalIds that would be generated
    const parsed = parseCSV(VALID_CSV, TEST_BANK_ACCOUNT_ID);
    // Simulate that the first transaction already exists
    const existingExternalId = parsed[0].externalId;

    setupSuccessfulImportMocks([existingExternalId]);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.total).toBe(3);
    expect(body.data.imported).toBe(2);
    expect(body.data.duplicatesSkipped).toBe(1);
    expect(body.data.transactions).toHaveLength(2);
  });

  it('skips all transactions when all are duplicates (AC-4)', async () => {
    app = await buildTestApp();

    const parsed = parseCSV(VALID_CSV, TEST_BANK_ACCOUNT_ID);
    const allExternalIds = parsed.map((t) => t.externalId);

    setupSuccessfulImportMocks(allExternalIds);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.total).toBe(3);
    expect(body.data.imported).toBe(0);
    expect(body.data.duplicatesSkipped).toBe(3);
    expect(body.data.transactions).toHaveLength(0);
  });

  // AC-5: Import batch tracking
  it('sets importBatchId and importedAt on created transactions (AC-5)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Verify importBatchId is a UUID
    expect(body.data.importBatchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Verify the create calls included importBatchId and importedAt
    const createCalls = mockPrisma.bankTransaction.create.mock.calls;
    expect(createCalls.length).toBeGreaterThan(0);

    for (const call of createCalls) {
      expect(call[0].data.importBatchId).toBe(body.data.importBatchId);
      expect(call[0].data.importedAt).toBeInstanceOf(Date);
    }
  });

  // AC-6: Returns summary
  it('returns summary with total, imported, duplicatesSkipped (AC-6)', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.data).toHaveProperty('importBatchId');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('imported');
    expect(body.data).toHaveProperty('duplicatesSkipped');
    expect(body.data).toHaveProperty('transactions');
    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.imported).toBe('number');
    expect(typeof body.data.duplicatesSkipped).toBe('number');
    expect(Array.isArray(body.data.transactions)).toBe(true);
  });

  // Error cases
  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for invalid CSV content', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      name: 'Test Account',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: 'not a valid csv',
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for empty content', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: '',
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing format', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for unsupported format', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'xlsx',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid bank account ID (not a UUID)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts/not-a-uuid/import',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // Auth tests
  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: { 'content-type': 'application/json' },
      payload: {
        content: VALID_CSV,
        format: 'csv',
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  // Atomicity — uses $transaction
  it('uses $transaction for atomicity', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  // Company isolation
  it('scopes bank account lookup to the company', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    expect(mockPrisma.bankAccount.findFirst).toHaveBeenCalledWith({
      where: { id: TEST_BANK_ACCOUNT_ID, companyId: TEST_COMPANY_ID },
      select: { id: true, name: true },
    });
  });

  // Sets companyId on created transactions
  it('sets companyId on all created transactions', async () => {
    app = await buildTestApp();
    setupSuccessfulImportMocks();

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/import`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        content: VALID_CSV,
        format: 'csv',
      },
    });

    const createCalls = mockPrisma.bankTransaction.create.mock.calls;
    for (const call of createCalls) {
      expect(call[0].data.companyId).toBe(TEST_COMPANY_ID);
      expect(call[0].data.bankAccountId).toBe(TEST_BANK_ACCOUNT_ID);
    }
  });
});
