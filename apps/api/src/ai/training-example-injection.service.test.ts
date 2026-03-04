// ---------------------------------------------------------------------------
// Unit tests for TrainingExampleInjectionService — E5d-2 Task 8.6
// Tests: skill key priority, 3-example limit, token budget enforcement,
// graceful degradation
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiTrainingExample: {
      findMany: vi.fn(),
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

import { TrainingExampleInjectionService } from './training-example-injection.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-001';

function createService() {
  return new TrainingExampleInjectionService(mockPrisma as any, mockLogger as any);
}

function makeExampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ex-1',
    inputText: 'What VAT for EU purchase?',
    outputText: 'Use reverse charge — VAT code 3',
    category: 'TERMINOLOGY',
    skillKey: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrainingExampleInjectionService', () => {
  let service: TrainingExampleInjectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // retrieveRelevantExamples — skill key priority
  // ═══════════════════════════════════════════════════════════════════════

  describe('retrieveRelevantExamples() — skill key priority', () => {
    it('prioritises skill-matching examples over category matches', async () => {
      const skillMatch = makeExampleRow({ id: 'ex-skill', skillKey: 'create_invoice' });
      // First call = skill match, second = category (not called because 3 filled), third = fallback
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce([skillMatch, skillMatch, skillMatch]) // skill matches (3 = MAX)
        .mockResolvedValueOnce([]) // category — shouldn't be called, already at max
        .mockResolvedValueOnce([]); // fallback — shouldn't be called

      const result = await service.retrieveRelevantExamples(
        TEST_COMPANY_ID,
        'create_invoice',
        'TERMINOLOGY',
      );

      expect(result.examples).toHaveLength(3);
      // Skill query should have been called
      expect(mockPrisma.aiTrainingExample.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ skillKey: 'create_invoice' }),
        }),
      );
    });

    it('falls back to category when no skill matches', async () => {
      const catMatch = makeExampleRow({ id: 'ex-cat', category: 'TERMINOLOGY' });
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce([]) // no skill matches
        .mockResolvedValueOnce([catMatch]) // category match
        .mockResolvedValueOnce([]); // fallback

      const result = await service.retrieveRelevantExamples(
        TEST_COMPANY_ID,
        'unknown_skill',
        'TERMINOLOGY',
      );

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0]!.id).toBe('ex-cat');
    });

    it('falls back to any active examples when no skill or category matches', async () => {
      const fallback = makeExampleRow({ id: 'ex-fallback' });
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce([]) // no skill matches (skillKey is null)
        .mockResolvedValueOnce([]); // no category (category is null)
      // When skillKey and category are both null, only fallback query runs
      mockPrisma.aiTrainingExample.findMany.mockResolvedValueOnce([fallback]);

      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID);

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0]!.id).toBe('ex-fallback');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3-example limit
  // ═══════════════════════════════════════════════════════════════════════

  describe('3-example limit', () => {
    it('returns at most 3 examples even if more are available', async () => {
      const examples = [
        makeExampleRow({ id: 'ex-1' }),
        makeExampleRow({ id: 'ex-2' }),
        makeExampleRow({ id: 'ex-3' }),
      ];
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce(examples) // skill matches fill 3
        .mockResolvedValueOnce([]) // category — skipped (already at max)
        .mockResolvedValueOnce([]); // fallback — skipped

      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID, 'some_skill');

      expect(result.examples.length).toBeLessThanOrEqual(3);
    });

    it('combines skill and category results up to 3', async () => {
      const skillMatch = makeExampleRow({ id: 'ex-skill', skillKey: 'create_invoice' });
      const catMatch1 = makeExampleRow({ id: 'ex-cat-1' });
      const catMatch2 = makeExampleRow({ id: 'ex-cat-2' });
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce([skillMatch]) // 1 skill match
        .mockResolvedValueOnce([catMatch1, catMatch2]) // 2 category matches = total 3
        .mockResolvedValueOnce([]); // fallback — skipped (already at max)

      const result = await service.retrieveRelevantExamples(
        TEST_COMPANY_ID,
        'create_invoice',
        'TERMINOLOGY',
      );

      expect(result.examples).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Token budget enforcement
  // ═══════════════════════════════════════════════════════════════════════

  describe('token budget enforcement', () => {
    it('respects token budget and excludes examples that exceed it', async () => {
      const longExample = makeExampleRow({
        id: 'ex-long',
        inputText: 'x'.repeat(400), // ~100 tokens for input alone
        outputText: 'y'.repeat(400), // ~100 tokens for output
      });
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce([longExample, longExample, longExample])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Very tight budget: only enough for header + maybe 1 example
      const result = await service.retrieveRelevantExamples(
        TEST_COMPANY_ID,
        'some_skill',
        null,
        50,
      );

      // Should have fewer than 3 (budget limited)
      expect(result.examples.length).toBeLessThan(3);
      expect(result.totalTokens).toBeLessThanOrEqual(50);
    });

    it('returns empty when budget is too small for even the header', async () => {
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce([makeExampleRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Budget too small for header + any example
      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID, 'some_skill', null, 1);

      expect(result.examples).toHaveLength(0);
      expect(result.formattedContext).toBe('');
      expect(result.totalTokens).toBe(0);
    });

    it('uses Infinity budget when tokenBudget is not provided', async () => {
      const examples = [
        makeExampleRow({ id: 'ex-1' }),
        makeExampleRow({ id: 'ex-2' }),
        makeExampleRow({ id: 'ex-3' }),
      ];
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce(examples)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID, 'skill');

      expect(result.examples).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Graceful degradation
  // ═══════════════════════════════════════════════════════════════════════

  describe('graceful degradation', () => {
    it('returns empty result when no examples exist', async () => {
      mockPrisma.aiTrainingExample.findMany.mockResolvedValue([]);

      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID);

      expect(result.examples).toHaveLength(0);
      expect(result.formattedContext).toBe('');
      expect(result.totalTokens).toBe(0);
    });

    it('returns empty result on database error (never throws)', async () => {
      mockPrisma.aiTrainingExample.findMany.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID, 'skill');

      expect(result.examples).toHaveLength(0);
      expect(result.formattedContext).toBe('');
      expect(result.totalTokens).toBe(0);
    });

    it('logs warning on database error', async () => {
      mockPrisma.aiTrainingExample.findMany.mockRejectedValue(new Error('DB timeout'));

      await service.retrieveRelevantExamples(TEST_COMPANY_ID);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: TEST_COMPANY_ID }),
        'TrainingExampleInjection: retrieval failed, returning empty',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Context formatting
  // ═══════════════════════════════════════════════════════════════════════

  describe('context formatting', () => {
    it('formats examples as "## Training Examples" with Q/A lines', async () => {
      const examples = [makeExampleRow({ id: 'ex-1' })];
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce(examples)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID, 'skill');

      expect(result.formattedContext).toContain('## Training Examples');
      expect(result.formattedContext).toContain('Q: "What VAT for EU purchase?"');
      expect(result.formattedContext).toContain('A: "Use reverse charge — VAT code 3"');
    });

    it('returns totalTokens > 0 when examples are formatted', async () => {
      mockPrisma.aiTrainingExample.findMany
        .mockResolvedValueOnce([makeExampleRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.retrieveRelevantExamples(TEST_COMPANY_ID, 'skill');

      expect(result.totalTokens).toBeGreaterThan(0);
    });
  });
});
