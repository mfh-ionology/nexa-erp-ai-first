import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies — vi.hoisted ensures variables exist when vi.mock runs
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    dataViewField: {
      findMany: vi.fn(),
    },
    currency: { findMany: vi.fn() },
    country: { findMany: vi.fn() },
    department: { findMany: vi.fn() },
    paymentTerms: { findMany: vi.fn() },
    vatCode: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    accessGroup: { findMany: vi.fn() },
  },
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
  LovType: {
    NONE: 'NONE',
    STATIC: 'STATIC',
    GLOBAL: 'GLOBAL',
    VIEW_SPECIFIC: 'VIEW_SPECIFIC',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { LovService } from './lov.service.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const FIELD_ID_CURRENCY = 'aaaaaaaa-0000-4000-a000-000000000001';
const FIELD_ID_DEPT = 'aaaaaaaa-0000-4000-a000-000000000002';
const FIELD_ID_STATIC = 'aaaaaaaa-0000-4000-a000-000000000003';
const FIELD_ID_TAGS = 'aaaaaaaa-0000-4000-a000-000000000004';
const FIELD_ID_NONE = 'aaaaaaaa-0000-4000-a000-000000000005';
const FIELD_ID_UNKNOWN = 'aaaaaaaa-0000-4000-a000-000000000099';
const FIELD_ID_COUNTRY = 'aaaaaaaa-0000-4000-a000-000000000006';

function makeField(overrides: Record<string, unknown> = {}) {
  return {
    id: FIELD_ID_CURRENCY,
    dataViewId: 'dv-1',
    fieldKey: 'currencyCode',
    fieldLabel: 'Currency',
    fieldType: 'STRING',
    defaultVisible: true,
    defaultOrder: 1,
    defaultWidth: 150,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: 'GLOBAL',
    lovScope: 'currencies',
    lovStaticValues: null,
    lovDependsOn: null,
    lovSearchMin: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('LovService', () => {
  let service: LovService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LovService(mockPrisma as never, mockLogger as never);
  });

  // -------------------------------------------------------------------------
  // batchFetchLov — batch returns results keyed by fieldId
  // -------------------------------------------------------------------------

  describe('batchFetchLov', () => {
    it('returns results keyed by fieldId for GLOBAL LOV', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([
        { code: 'GBP', name: 'British Pound' },
        { code: 'USD', name: 'US Dollar' },
        { code: 'EUR', name: 'Euro' },
      ]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
      ]);

      expect(result).toEqual({
        [FIELD_ID_CURRENCY]: [
          { value: 'GBP', label: 'British Pound' },
          { value: 'USD', label: 'US Dollar' },
          { value: 'EUR', label: 'Euro' },
        ],
      });
    });

    it('returns results for multiple fields in a single batch', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
        makeField({ id: FIELD_ID_DEPT, lovType: 'GLOBAL', lovScope: 'departments' }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([{ code: 'GBP', name: 'British Pound' }]);
      mockPrisma.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: 'Engineering' },
        { id: 'dept-2', name: 'Sales' },
      ]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
        { fieldId: FIELD_ID_DEPT, lovScope: 'departments' },
      ]);

      expect(result[FIELD_ID_CURRENCY]).toHaveLength(1);
      expect(result[FIELD_ID_DEPT]).toHaveLength(2);
      expect(result[FIELD_ID_DEPT]).toEqual([
        { value: 'dept-1', label: 'Engineering' },
        { value: 'dept-2', label: 'Sales' },
      ]);
    });

    it('deduplicates fieldIds before querying metadata', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([{ code: 'GBP', name: 'British Pound' }]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
      ]);

      // Should only query once for metadata with unique field IDs
      expect(mockPrisma.dataViewField.findMany).toHaveBeenCalledWith({
        where: { id: { in: [FIELD_ID_CURRENCY] } },
      });
    });
  });

  // -------------------------------------------------------------------------
  // STATIC type returns empty (client-side only)
  // -------------------------------------------------------------------------

  describe('STATIC LOV', () => {
    it('returns empty array for STATIC lovType', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_STATIC,
          lovType: 'STATIC',
          lovScope: null,
          lovStaticValues: [{ value: 'DRAFT', label: 'Draft' }],
        }),
      ]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_STATIC, lovScope: 'unused' },
      ]);

      expect(result[FIELD_ID_STATIC]).toEqual([]);
      // Should NOT query any entity table
      expect(mockPrisma.currency.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.department.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // NONE lovType returns empty
  // -------------------------------------------------------------------------

  describe('NONE LOV', () => {
    it('returns empty array for NONE lovType', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_NONE, lovType: 'NONE', lovScope: null }),
      ]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_NONE, lovScope: 'anything' },
      ]);

      expect(result[FIELD_ID_NONE]).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown field returns empty with warning
  // -------------------------------------------------------------------------

  describe('unknown field', () => {
    it('returns empty array and logs warning for unknown fieldId', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_UNKNOWN, lovScope: 'currencies' },
      ]);

      expect(result[FIELD_ID_UNKNOWN]).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { fieldId: FIELD_ID_UNKNOWN },
        'LOV requested for unknown field',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Unknown LOV scope returns empty with warning
  // -------------------------------------------------------------------------

  describe('unknown scope', () => {
    it('returns empty array and logs warning for unregistered lovScope', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'unknown_scope' }),
      ]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'unknown_scope' },
      ]);

      expect(result[FIELD_ID_CURRENCY]).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { lovScope: 'unknown_scope', fieldId: FIELD_ID_CURRENCY },
        'Unknown LOV scope requested',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Company scoping
  // -------------------------------------------------------------------------

  describe('company scoping', () => {
    it('includes companyId in where clause for company-scoped models', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_DEPT, lovType: 'GLOBAL', lovScope: 'departments' }),
      ]);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_DEPT, lovScope: 'departments' },
      ]);

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
            isActive: true,
          }),
        }),
      );
    });

    it('excludes companyId from where clause for non-company-scoped models', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
      ]);

      const callArgs = mockPrisma.currency.findMany.mock.calls[0]![0]!;
      expect(callArgs.where).not.toHaveProperty('companyId');
      expect(callArgs.where).toHaveProperty('isActive', true);
    });
  });

  // -------------------------------------------------------------------------
  // Server-side search filters results
  // -------------------------------------------------------------------------

  describe('server-side search', () => {
    it('applies search filter when search meets lovSearchMin threshold', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_DEPT,
          lovType: 'VIEW_SPECIFIC',
          lovScope: 'departments',
          lovSearchMin: 2,
        }),
      ]);
      mockPrisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_DEPT, lovScope: 'departments', search: 'Eng' },
      ]);

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Eng', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('does not apply search filter when search is below lovSearchMin threshold', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_DEPT,
          lovType: 'VIEW_SPECIFIC',
          lovScope: 'departments',
          lovSearchMin: 3,
        }),
      ]);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_DEPT, lovScope: 'departments', search: 'En' },
      ]);

      const callArgs = mockPrisma.department.findMany.mock.calls[0]![0]!;
      expect(callArgs.where).not.toHaveProperty('name');
    });

    it('applies search filter when lovSearchMin is 0 (search from first character)', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_CURRENCY,
          lovType: 'GLOBAL',
          lovScope: 'currencies',
          lovSearchMin: 0,
        }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies', search: 'Pound' },
      ]);

      const callArgs = mockPrisma.currency.findMany.mock.calls[0]![0]!;
      expect(callArgs.where).toHaveProperty('name');
      expect(callArgs.where.name).toEqual({ contains: 'Pound', mode: 'insensitive' });
    });

    it('does not apply search filter when search is empty string', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_DEPT,
          lovType: 'VIEW_SPECIFIC',
          lovScope: 'departments',
          lovSearchMin: 1,
        }),
      ]);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_DEPT, lovScope: 'departments', search: '' },
      ]);

      const callArgs = mockPrisma.department.findMany.mock.calls[0]![0]!;
      expect(callArgs.where).not.toHaveProperty('name');
    });
  });

  // -------------------------------------------------------------------------
  // Dependent LOV filters by parent value
  // -------------------------------------------------------------------------

  describe('dependent LOV', () => {
    it('filters by parent value when lovDependsOn and parentValue are set', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_TAGS,
          lovType: 'GLOBAL',
          lovScope: 'tags',
          lovDependsOn: 'tagType',
        }),
      ]);
      mockPrisma.tag.findMany.mockResolvedValue([
        { id: 'tag-1', name: 'VIP' },
        { id: 'tag-2', name: 'Wholesale' },
      ]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_TAGS, lovScope: 'tags', parentValue: 'CUSTOMER' },
      ]);

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tagType: 'CUSTOMER',
            companyId: TEST_COMPANY_ID,
            isActive: true,
          }),
        }),
      );
    });

    it('does not filter by parent when parentValue is not provided', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_TAGS,
          lovType: 'GLOBAL',
          lovScope: 'tags',
          lovDependsOn: 'tagType',
        }),
      ]);
      mockPrisma.tag.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [{ fieldId: FIELD_ID_TAGS, lovScope: 'tags' }]);

      const callArgs = mockPrisma.tag.findMany.mock.calls[0]![0]!;
      expect(callArgs.where).not.toHaveProperty('tagType');
    });

    it('does not filter by parent when lovDependsOn is null', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_DEPT,
          lovType: 'GLOBAL',
          lovScope: 'departments',
          lovDependsOn: null,
        }),
      ]);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_DEPT, lovScope: 'departments', parentValue: 'some-value' },
      ]);

      // parentField for departments is undefined, so no parent filtering
      const callArgs = mockPrisma.department.findMany.mock.calls[0]![0]!;
      expect(callArgs.where).not.toHaveProperty('parentField');
    });
  });

  // -------------------------------------------------------------------------
  // Limit parameter
  // -------------------------------------------------------------------------

  describe('limit', () => {
    it('respects custom limit parameter', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies', limit: 10 },
      ]);

      expect(mockPrisma.currency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('defaults to 50 when limit is not provided', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
      ]);

      expect(mockPrisma.currency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // VIEW_SPECIFIC LOV
  // -------------------------------------------------------------------------

  describe('VIEW_SPECIFIC LOV', () => {
    it('queries the same as GLOBAL using the scope registry', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({
          id: FIELD_ID_DEPT,
          lovType: 'VIEW_SPECIFIC',
          lovScope: 'departments',
          lovSearchMin: 2,
        }),
      ]);
      mockPrisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_DEPT, lovScope: 'departments', search: 'Eng' },
      ]);

      expect(result[FIELD_ID_DEPT]).toEqual([{ value: 'dept-1', label: 'Engineering' }]);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('returns empty array and logs error when query fails', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
      ]);
      mockPrisma.currency.findMany.mockRejectedValue(new Error('Connection refused'));

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
      ]);

      expect(result[FIELD_ID_CURRENCY]).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          lovScope: 'currencies',
          fieldId: FIELD_ID_CURRENCY,
        }),
        'Failed to fetch LOV data',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Ordering
  // -------------------------------------------------------------------------

  describe('ordering', () => {
    it('orders results by label field ascending', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_COUNTRY, lovType: 'GLOBAL', lovScope: 'countries' }),
      ]);
      mockPrisma.country.findMany.mockResolvedValue([]);

      await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_COUNTRY, lovScope: 'countries' },
      ]);

      expect(mockPrisma.country.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Value coercion
  // -------------------------------------------------------------------------

  describe('value coercion', () => {
    it('converts values to strings', async () => {
      mockPrisma.dataViewField.findMany.mockResolvedValue([
        makeField({ id: FIELD_ID_CURRENCY, lovType: 'GLOBAL', lovScope: 'currencies' }),
      ]);
      mockPrisma.currency.findMany.mockResolvedValue([{ code: 'GBP', name: 'British Pound' }]);

      const result = await service.batchFetchLov(TEST_COMPANY_ID, [
        { fieldId: FIELD_ID_CURRENCY, lovScope: 'currencies' },
      ]);

      expect(result[FIELD_ID_CURRENCY]![0]!.value).toBe('GBP');
      expect(result[FIELD_ID_CURRENCY]![0]!.label).toBe('British Pound');
      expect(typeof result[FIELD_ID_CURRENCY]![0]!.value).toBe('string');
      expect(typeof result[FIELD_ID_CURRENCY]![0]!.label).toBe('string');
    });
  });
});
