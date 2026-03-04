// ---------------------------------------------------------------------------
// Unit tests for TrainingExampleService — E5d-2 Task 8.5
// Tests: CRUD with companyId scoping, category validation, source immutability,
// soft-delete, cross-tenant isolation
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiTrainingExample: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { TrainingExampleService } from './training-example.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-001';
const TEST_USER_ID = 'user-001';
const OTHER_COMPANY_ID = 'company-999';

function createService() {
  return new TrainingExampleService(mockPrisma as any, mockLogger as any);
}

function makeExampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'example-1',
    companyId: TEST_COMPANY_ID,
    skillKey: null,
    inputText: 'What VAT for EU purchase?',
    outputText: 'Use reverse charge — VAT code 3',
    category: 'TERMINOLOGY',
    source: 'ADMIN_CURATED',
    isActive: true,
    createdById: TEST_USER_ID,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrainingExampleService', () => {
  let service: TrainingExampleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // createExample
  // ═══════════════════════════════════════════════════════════════════════

  describe('createExample()', () => {
    it('creates an example with companyId scoping', async () => {
      mockPrisma.aiTrainingExample.create.mockResolvedValue(makeExampleRow());

      const result = await service.createExample(TEST_COMPANY_ID, TEST_USER_ID, {
        inputText: 'What VAT for EU purchase?',
        outputText: 'Use reverse charge — VAT code 3',
        category: 'TERMINOLOGY',
      });

      expect(result.id).toBe('example-1');
      expect(result.companyId).toBe(TEST_COMPANY_ID);
      expect(mockPrisma.aiTrainingExample.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
            createdById: TEST_USER_ID,
            source: 'ADMIN_CURATED',
          }),
        }),
      );
    });

    it('defaults source to ADMIN_CURATED', async () => {
      mockPrisma.aiTrainingExample.create.mockResolvedValue(makeExampleRow());

      await service.createExample(TEST_COMPANY_ID, TEST_USER_ID, {
        inputText: 'Q',
        outputText: 'A',
        category: 'TERMINOLOGY',
      });

      expect(mockPrisma.aiTrainingExample.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: 'ADMIN_CURATED' }),
        }),
      );
    });

    it('accepts CORRECTION_DERIVED source', async () => {
      mockPrisma.aiTrainingExample.create.mockResolvedValue(
        makeExampleRow({ source: 'CORRECTION_DERIVED' }),
      );

      const result = await service.createExample(TEST_COMPANY_ID, TEST_USER_ID, {
        inputText: 'Q',
        outputText: 'A',
        category: 'TERMINOLOGY',
        source: 'CORRECTION_DERIVED',
      });

      expect(result.source).toBe('CORRECTION_DERIVED');
    });

    it('throws for invalid category', async () => {
      await expect(
        service.createExample(TEST_COMPANY_ID, TEST_USER_ID, {
          inputText: 'Q',
          outputText: 'A',
          category: 'INVALID_CATEGORY',
        }),
      ).rejects.toThrow('Invalid category');
    });

    it('throws for invalid source', async () => {
      await expect(
        service.createExample(TEST_COMPANY_ID, TEST_USER_ID, {
          inputText: 'Q',
          outputText: 'A',
          category: 'TERMINOLOGY',
          source: 'INVALID_SOURCE',
        }),
      ).rejects.toThrow('Invalid source');
    });

    it('accepts all 5 valid categories', async () => {
      const categories = [
        'BUSINESS_PROCESS',
        'TERMINOLOGY',
        'INDUSTRY_RULES',
        'CUSTOM_FIELDS',
        'HISTORICAL_PATTERN',
      ];

      for (const category of categories) {
        vi.clearAllMocks();
        mockPrisma.aiTrainingExample.create.mockResolvedValue(makeExampleRow({ category }));

        const result = await service.createExample(TEST_COMPANY_ID, TEST_USER_ID, {
          inputText: 'Q',
          outputText: 'A',
          category,
        });

        expect(result.category).toBe(category);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getExample — companyId scoping
  // ═══════════════════════════════════════════════════════════════════════

  describe('getExample()', () => {
    it('returns example when found with matching companyId', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(makeExampleRow());

      const result = await service.getExample('example-1', TEST_COMPANY_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('example-1');
    });

    it('returns null for cross-tenant access (wrong companyId)', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(null);

      const result = await service.getExample('example-1', OTHER_COMPANY_ID);

      expect(result).toBeNull();
      expect(mockPrisma.aiTrainingExample.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'example-1', companyId: OTHER_COMPANY_ID },
        }),
      );
    });

    it('returns null for non-existent example', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(null);

      const result = await service.getExample('nonexistent', TEST_COMPANY_ID);

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // updateExample — source immutability
  // ═══════════════════════════════════════════════════════════════════════

  describe('updateExample()', () => {
    it('updates example fields (not source)', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(makeExampleRow());
      mockPrisma.aiTrainingExample.update.mockResolvedValue(
        makeExampleRow({ inputText: 'Updated Q' }),
      );

      const result = await service.updateExample('example-1', TEST_COMPANY_ID, {
        inputText: 'Updated Q',
      });

      expect(result).not.toBeNull();
      expect(mockPrisma.aiTrainingExample.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inputText: 'Updated Q' }),
        }),
      );
    });

    it('does not include source in update data (source is immutable)', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(makeExampleRow());
      mockPrisma.aiTrainingExample.update.mockResolvedValue(makeExampleRow());

      await service.updateExample('example-1', TEST_COMPANY_ID, {
        inputText: 'Updated',
      });

      const updateCall = mockPrisma.aiTrainingExample.update.mock.calls[0]![0];
      expect(updateCall.data).not.toHaveProperty('source');
    });

    it('validates category on update', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(makeExampleRow());

      await expect(
        service.updateExample('example-1', TEST_COMPANY_ID, {
          category: 'INVALID',
        }),
      ).rejects.toThrow('Invalid category');
    });

    it('returns null for cross-tenant update attempt', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(null);

      const result = await service.updateExample('example-1', OTHER_COMPANY_ID, {
        inputText: 'Hacked',
      });

      expect(result).toBeNull();
      expect(mockPrisma.aiTrainingExample.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // deleteExample — soft-delete
  // ═══════════════════════════════════════════════════════════════════════

  describe('deleteExample()', () => {
    it('soft-deletes by setting isActive = false', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(makeExampleRow());
      mockPrisma.aiTrainingExample.update.mockResolvedValue(makeExampleRow({ isActive: false }));

      const result = await service.deleteExample('example-1', TEST_COMPANY_ID);

      expect(result).toBe(true);
      expect(mockPrisma.aiTrainingExample.update).toHaveBeenCalledWith({
        where: { id: 'example-1', companyId: TEST_COMPANY_ID },
        data: { isActive: false },
      });
    });

    it('returns false for non-existent example', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(null);

      const result = await service.deleteExample('nonexistent', TEST_COMPANY_ID);

      expect(result).toBe(false);
    });

    it('returns false for cross-tenant delete attempt', async () => {
      mockPrisma.aiTrainingExample.findFirst.mockResolvedValue(null);

      const result = await service.deleteExample('example-1', OTHER_COMPANY_ID);

      expect(result).toBe(false);
      expect(mockPrisma.aiTrainingExample.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // listExamples — companyId scoping + filters
  // ═══════════════════════════════════════════════════════════════════════

  describe('listExamples()', () => {
    it('enforces companyId in WHERE clause', async () => {
      mockPrisma.aiTrainingExample.findMany.mockResolvedValue([]);
      mockPrisma.aiTrainingExample.count.mockResolvedValue(0);

      await service.listExamples(TEST_COMPANY_ID);

      expect(mockPrisma.aiTrainingExample.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
        }),
      );
    });

    it('filters by category', async () => {
      mockPrisma.aiTrainingExample.findMany.mockResolvedValue([]);
      mockPrisma.aiTrainingExample.count.mockResolvedValue(0);

      await service.listExamples(TEST_COMPANY_ID, { category: 'TERMINOLOGY' });

      expect(mockPrisma.aiTrainingExample.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'TERMINOLOGY' }),
        }),
      );
    });

    it('supports cursor-based pagination', async () => {
      const examples = [makeExampleRow({ id: 'e-1' }), makeExampleRow({ id: 'e-2' })];
      mockPrisma.aiTrainingExample.findMany.mockResolvedValue(examples);
      mockPrisma.aiTrainingExample.count.mockResolvedValue(5);

      const result = await service.listExamples(TEST_COMPANY_ID, { limit: 1 });

      expect(result.nextCursor).toBe('e-2');
      expect(result.data).toHaveLength(1);
    });
  });
});
