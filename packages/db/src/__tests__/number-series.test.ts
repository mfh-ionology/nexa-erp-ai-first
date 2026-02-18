import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  nextNumber,
  NumberSeriesError,
  NumberSeriesNotFoundError,
  NumberSeriesInactiveError,
} from '../services/number-series.service';

let prisma: PrismaClient;

// Track created entity IDs for cleanup
let companyIds: string[] = [];
let seriesIds: string[] = [];

beforeAll(async () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set for tests');
  }
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
});

async function cleanup() {
  if (seriesIds.length > 0) {
    await prisma.numberSeries.deleteMany({ where: { id: { in: seriesIds } } });
    seriesIds = [];
  }
  if (companyIds.length > 0) {
    await prisma.companyProfile.deleteMany({ where: { id: { in: companyIds } } });
    companyIds = [];
  }
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function createCompany(name: string): Promise<string> {
  const company = await prisma.companyProfile.create({
    data: {
      name,
      baseCurrencyCode: 'GBP',
      countryCode: 'GB',
      createdBy: 'test',
      updatedBy: 'test',
    },
  });
  companyIds.push(company.id);
  return company.id;
}

async function createSeries(
  companyId: string,
  entityType: string,
  prefix: string,
  opts?: { padding?: number; suffix?: string; isActive?: boolean },
): Promise<string> {
  const series = await prisma.numberSeries.create({
    data: {
      companyId,
      entityType,
      prefix,
      padding: opts?.padding ?? 5,
      suffix: opts?.suffix ?? null,
      isActive: opts?.isActive ?? true,
    },
  });
  seriesIds.push(series.id);
  return series.id;
}

// ---------------------------------------------------------------------------
// E1.5-INT-001: Concurrency — 10 parallel calls produce unique gap-free numbers
// ---------------------------------------------------------------------------

describe('nextNumber() concurrency', () => {
  it('10 parallel calls produce unique, sequential, gap-free numbers (E1.5-INT-001)', async () => {
    const companyId = await createCompany('Concurrency test');
    await createSeries(companyId, 'CONCURRENCY_TEST', 'CT-');

    // Fire 10 concurrent calls
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.$transaction(async (tx) => nextNumber(tx, companyId, 'CONCURRENCY_TEST')),
      ),
    );

    // All 10 should be unique
    const unique = new Set(results);
    expect(unique.size).toBe(10);

    // Parse the numeric portions and verify sequential gap-free
    const nums = results.map((r) => parseInt(r.replace('CT-', ''), 10)).sort((a, b) => a - b);
    expect(nums[0]).toBe(1);
    expect(nums[nums.length - 1]).toBe(10);

    // Verify no gaps: every number from 1..10 is present
    for (let i = 0; i < 10; i++) {
      expect(nums[i]).toBe(i + 1);
    }
  });

  it('rolled-back transaction does not consume a number (gap-free guarantee)', async () => {
    const companyId = await createCompany('Rollback test');
    await createSeries(companyId, 'ROLLBACK_TEST', 'RB-');

    // Allocate first number successfully
    const first = await prisma.$transaction(async (tx) =>
      nextNumber(tx, companyId, 'ROLLBACK_TEST'),
    );
    expect(first).toBe('RB-00001');

    // Transaction that allocates a number then rolls back
    await expect(
      prisma.$transaction(async (tx) => {
        await nextNumber(tx, companyId, 'ROLLBACK_TEST');
        throw new Error('Simulated document creation failure');
      }),
    ).rejects.toThrow('Simulated document creation failure');

    // Next successful call should get the same number the rolled-back tx would have used
    const afterRollback = await prisma.$transaction(async (tx) =>
      nextNumber(tx, companyId, 'ROLLBACK_TEST'),
    );
    expect(afterRollback).toBe('RB-00002');
  });
});

// ---------------------------------------------------------------------------
// E1.5-INT-002: Format output matches prefix + LPAD(value, padding, '0')
// ---------------------------------------------------------------------------

describe('nextNumber() formatting', () => {
  it('formats with prefix + zero-padded value (E1.5-INT-002)', async () => {
    const companyId = await createCompany('Format test');
    await createSeries(companyId, 'FORMAT_TEST', 'INV-', { padding: 5 });

    const first = await prisma.$transaction(async (tx) => nextNumber(tx, companyId, 'FORMAT_TEST'));
    expect(first).toBe('INV-00001');

    const second = await prisma.$transaction(async (tx) =>
      nextNumber(tx, companyId, 'FORMAT_TEST'),
    );
    expect(second).toBe('INV-00002');
  });

  it('formats with custom padding', async () => {
    const companyId = await createCompany('Padding test');
    await createSeries(companyId, 'PAD_TEST', 'EMP-', { padding: 4 });

    const first = await prisma.$transaction(async (tx) => nextNumber(tx, companyId, 'PAD_TEST'));
    expect(first).toBe('EMP-0001');
  });

  it('appends suffix when present', async () => {
    const companyId = await createCompany('Suffix test');
    await createSeries(companyId, 'SUFFIX_TEST', 'ORD-', { padding: 5, suffix: '/A' });

    const first = await prisma.$transaction(async (tx) => nextNumber(tx, companyId, 'SUFFIX_TEST'));
    expect(first).toBe('ORD-00001/A');
  });
});

// ---------------------------------------------------------------------------
// E1.5-INT-003: Deactivated series rejects generation
// ---------------------------------------------------------------------------

describe('nextNumber() deactivated series', () => {
  it('throws NumberSeriesInactiveError for inactive series (E1.5-INT-003)', async () => {
    const companyId = await createCompany('Inactive test');
    await createSeries(companyId, 'INACTIVE_TEST', 'X-', { isActive: false });

    await expect(
      prisma.$transaction(async (tx) => nextNumber(tx, companyId, 'INACTIVE_TEST')),
    ).rejects.toThrow(NumberSeriesInactiveError);
  });

  it('throws NumberSeriesNotFoundError for non-existent entity type', async () => {
    const companyId = await createCompany('NotFound test');

    await expect(
      prisma.$transaction(async (tx) => nextNumber(tx, companyId, 'DOES_NOT_EXIST')),
    ).rejects.toThrow(NumberSeriesNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// Error class hierarchy
// ---------------------------------------------------------------------------

describe('NumberSeriesError hierarchy', () => {
  it('NumberSeriesNotFoundError is instanceof NumberSeriesError', () => {
    const err = new NumberSeriesNotFoundError('company-1', 'INVOICE');
    expect(err).toBeInstanceOf(NumberSeriesError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NumberSeriesNotFoundError');
  });

  it('NumberSeriesInactiveError is instanceof NumberSeriesError', () => {
    const err = new NumberSeriesInactiveError('company-1', 'INVOICE');
    expect(err).toBeInstanceOf(NumberSeriesError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NumberSeriesInactiveError');
  });
});

// ---------------------------------------------------------------------------
// E1.5-INT-005: Unique constraint on [companyId, entityType]
// ---------------------------------------------------------------------------

describe('NumberSeries unique constraint', () => {
  it('prevents duplicate [companyId, entityType] (E1.5-INT-005)', async () => {
    const companyId = await createCompany('Unique constraint test');
    await createSeries(companyId, 'UNIQUE_TEST', 'U1-');

    // Second series with same companyId + entityType should fail
    await expect(
      prisma.numberSeries.create({
        data: {
          companyId,
          entityType: 'UNIQUE_TEST',
          prefix: 'U2-',
        },
      }),
    ).rejects.toThrow();
  });

  it('allows same entityType for different companies', async () => {
    const companyA = await createCompany('Company A');
    const companyB = await createCompany('Company B');

    await createSeries(companyA, 'SHARED_TYPE', 'A-');
    // Should succeed — different company
    const seriesId = await createSeries(companyB, 'SHARED_TYPE', 'B-');
    expect(seriesId).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// E1.5-INT-006: All 13 default series created by seed
// ---------------------------------------------------------------------------

describe('Seed data verification', () => {
  // Well-known seed company ID (from seed.ts)
  const DEFAULT_COMPANY_ID = '00000000-0000-4000-a000-000000000001';

  const expectedSeries = [
    { entityType: 'INVOICE', prefix: 'INV-', padding: 5 },
    { entityType: 'CREDIT_NOTE', prefix: 'CN-', padding: 5 },
    { entityType: 'SALES_ORDER', prefix: 'SO-', padding: 5 },
    { entityType: 'SALES_QUOTE', prefix: 'QT-', padding: 5 },
    { entityType: 'PURCHASE_ORDER', prefix: 'PO-', padding: 5 },
    { entityType: 'BILL', prefix: 'BIL-', padding: 5 },
    { entityType: 'JOURNAL', prefix: 'JE-', padding: 5 },
    { entityType: 'PAYMENT', prefix: 'PAY-', padding: 5 },
    { entityType: 'SHIPMENT', prefix: 'SHP-', padding: 5 },
    { entityType: 'GOODS_RECEIPT', prefix: 'GRN-', padding: 5 },
    { entityType: 'EMPLOYEE', prefix: 'EMP-', padding: 4 },
    { entityType: 'CUSTOMER', prefix: 'CUS-', padding: 5 },
    { entityType: 'SUPPLIER', prefix: 'SUP-', padding: 5 },
  ];

  it('all 13 default number series exist with correct config (E1.5-INT-006)', async () => {
    const series = await prisma.numberSeries.findMany({
      where: { companyId: DEFAULT_COMPANY_ID },
      orderBy: { entityType: 'asc' },
    });

    expect(series.length).toBe(13);

    for (const expected of expectedSeries) {
      const found = series.find((s) => s.entityType === expected.entityType);
      expect(found).toBeDefined();
      expect(found!.prefix).toBe(expected.prefix);
      expect(found!.padding).toBe(expected.padding);
      expect(found!.isActive).toBe(true);
    }
  });
});
