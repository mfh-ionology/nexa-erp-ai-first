// ---------------------------------------------------------------------------
// Unit tests for CorrectionPatternService — E5d-2 Task 8.4
// Tests: topic extraction, threshold checks, category mapping, duplicate
// detection, wasAutoResolved flag, event emission
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockKnowledgeArticleService, mockEventBus } = vi.hoisted(() => ({
  mockPrisma: {
    aiCorrectionLog: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    aiKnowledgeArticle: {
      findMany: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockKnowledgeArticleService: {
    createArticle: vi.fn(),
    updateArticle: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { CorrectionPatternService, extractTopic } from './correction-pattern.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-001';
const TEST_USER_ID = 'user-001';

function createService() {
  return new CorrectionPatternService(
    mockPrisma as any,
    mockLogger as any,
    mockKnowledgeArticleService as any,
    mockEventBus as any,
  );
}

function makeCorrectionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'correction-1',
    companyId: TEST_COMPANY_ID,
    userId: TEST_USER_ID,
    conversationId: null,
    messageId: null,
    skillKey: null,
    originalResponse: 'Original response',
    correctedResponse: 'Corrected response text',
    correctionType: 'TERMINOLOGY',
    wasAutoResolved: false,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

function makeMatchingCorrections(count: number, topic: string = 'corrected response text') {
  return Array.from({ length: count }, (_, i) => ({
    id: `correction-${i + 1}`,
    companyId: TEST_COMPANY_ID,
    correctedResponse: topic.charAt(0).toUpperCase() + topic.slice(1), // capitalise first char — extractTopic lowercases
    correctionType: 'TERMINOLOGY',
    wasAutoResolved: false,
    createdAt: new Date('2026-03-01T00:00:00Z'),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractTopic() — pure function', () => {
  it('normalises to lowercase and sorts words', () => {
    expect(extractTopic('HELLO WORLD')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(extractTopic('  hello  ')).toBe('hello');
  });

  it('truncates long topics to 100 characters', () => {
    // 15 unique words then truncated to 100 chars
    const longText = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
    expect(extractTopic(longText).length).toBeLessThanOrEqual(100);
  });

  it('returns empty string for empty input', () => {
    expect(extractTopic('')).toBe('');
  });

  it('produces order-invariant topic keys', () => {
    expect(extractTopic('use vat code 3 for eu purchases')).toBe(
      extractTopic('for eu purchases use vat code 3'),
    );
  });

  it('strips punctuation for cleaner matching', () => {
    expect(extractTopic('Hello, world!')).toBe(extractTopic('Hello world'));
  });

  it('deduplicates words', () => {
    expect(extractTopic('the the the cat')).toBe('cat the');
  });

  it('handles combined normalisation', () => {
    const input = '  THIS IS A Test  ';
    expect(extractTopic(input)).toBe('a is test this');
  });
});

describe('CorrectionPatternService', () => {
  let service: CorrectionPatternService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
    // Default: no existing articles
    mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([]);
    mockPrisma.aiCorrectionLog.updateMany.mockResolvedValue({ count: 0 });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // checkAndGenerateArticle — threshold checks
  // ═══════════════════════════════════════════════════════════════════════

  describe('checkAndGenerateArticle()', () => {
    it('does NOT generate an article when corrections < threshold (2 < 3)', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(2));

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockKnowledgeArticleService.createArticle).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('generates an article when corrections >= threshold (3)', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      mockKnowledgeArticleService.createArticle.mockResolvedValue({
        id: 'article-new',
        companyId: TEST_COMPANY_ID,
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockKnowledgeArticleService.createArticle).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEST_USER_ID,
        expect.objectContaining({
          source: 'CORRECTION_DERIVED',
          confidenceScore: 0.5,
          isConfirmed: false,
        }),
      );
    });

    it('generates an article when corrections > threshold (5)', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(5));
      mockKnowledgeArticleService.createArticle.mockResolvedValue({
        id: 'article-new',
        companyId: TEST_COMPANY_ID,
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockKnowledgeArticleService.createArticle).toHaveBeenCalled();
    });

    it('skips when topic is empty', async () => {
      const correction = makeCorrectionRecord({ correctedResponse: '' });

      await service.checkAndGenerateArticle(correction);

      expect(mockPrisma.aiCorrectionLog.findMany).not.toHaveBeenCalled();
      expect(mockKnowledgeArticleService.createArticle).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // correctionType → category mapping
  // ═══════════════════════════════════════════════════════════════════════

  describe('correctionType → category mapping', () => {
    it('maps TERMINOLOGY → TERMINOLOGY', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      mockKnowledgeArticleService.createArticle.mockResolvedValue({
        id: 'article-new',
        companyId: TEST_COMPANY_ID,
      });

      await service.checkAndGenerateArticle(
        makeCorrectionRecord({ correctionType: 'TERMINOLOGY' }),
      );

      expect(mockKnowledgeArticleService.createArticle).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEST_USER_ID,
        expect.objectContaining({ category: 'TERMINOLOGY' }),
      );
    });

    it('maps PROCESS → BUSINESS_PROCESS', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      mockKnowledgeArticleService.createArticle.mockResolvedValue({
        id: 'article-new',
        companyId: TEST_COMPANY_ID,
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord({ correctionType: 'PROCESS' }));

      expect(mockKnowledgeArticleService.createArticle).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEST_USER_ID,
        expect.objectContaining({ category: 'BUSINESS_PROCESS' }),
      );
    });

    it('maps DATA → CUSTOM_FIELDS', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      mockKnowledgeArticleService.createArticle.mockResolvedValue({
        id: 'article-new',
        companyId: TEST_COMPANY_ID,
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord({ correctionType: 'DATA' }));

      expect(mockKnowledgeArticleService.createArticle).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEST_USER_ID,
        expect.objectContaining({ category: 'CUSTOM_FIELDS' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Duplicate detection — existing article → increment confidence
  // ═══════════════════════════════════════════════════════════════════════

  describe('duplicate detection', () => {
    it('increments existing article confidence instead of creating new', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      // Existing correction-derived article with matching topic
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([
        {
          id: 'existing-article',
          title: 'Auto-learned: corrected response text',
          content: 'corrected response text',
          confidenceScore: 0.5,
          source: 'CORRECTION_DERIVED',
          isActive: true,
        },
      ]);
      mockKnowledgeArticleService.updateArticle.mockResolvedValue({
        id: 'existing-article',
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      // Should update (increment confidence), NOT create
      expect(mockKnowledgeArticleService.createArticle).not.toHaveBeenCalled();
      expect(mockKnowledgeArticleService.updateArticle).toHaveBeenCalledWith(
        'existing-article',
        TEST_COMPANY_ID,
        { confidenceScore: 0.6 }, // 0.5 + 0.1
      );
    });

    it('caps confidence at 0.8', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([
        {
          id: 'existing-article',
          title: 'Auto-learned: corrected response text',
          content: 'corrected response text',
          confidenceScore: 0.8,
          source: 'CORRECTION_DERIVED',
          isActive: true,
        },
      ]);
      mockKnowledgeArticleService.updateArticle.mockResolvedValue({
        id: 'existing-article',
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockKnowledgeArticleService.updateArticle).toHaveBeenCalledWith(
        'existing-article',
        TEST_COMPANY_ID,
        { confidenceScore: 0.8 }, // capped, not 0.9
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // wasAutoResolved flag update
  // ═══════════════════════════════════════════════════════════════════════

  describe('wasAutoResolved flag', () => {
    it('marks source corrections as wasAutoResolved = true after article generation', async () => {
      const corrections = makeMatchingCorrections(3);
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(corrections);
      mockKnowledgeArticleService.createArticle.mockResolvedValue({
        id: 'article-new',
        companyId: TEST_COMPANY_ID,
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockPrisma.aiCorrectionLog.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['correction-1', 'correction-2', 'correction-3'] } },
        data: { wasAutoResolved: true },
      });
    });

    it('marks source corrections as resolved even for duplicate article (increment path)', async () => {
      const corrections = makeMatchingCorrections(3);
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(corrections);
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([
        {
          id: 'existing-article',
          title: 'Auto-learned: corrected response text',
          content: 'corrected response text',
          confidenceScore: 0.5,
          source: 'CORRECTION_DERIVED',
          isActive: true,
        },
      ]);
      mockKnowledgeArticleService.updateArticle.mockResolvedValue({
        id: 'existing-article',
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockPrisma.aiCorrectionLog.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['correction-1', 'correction-2', 'correction-3'] } },
        data: { wasAutoResolved: true },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Event emission
  // ═══════════════════════════════════════════════════════════════════════

  describe('event emission', () => {
    it('emits ai.correction.autoArticleGenerated when a new article is created', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      mockKnowledgeArticleService.createArticle.mockResolvedValue({
        id: 'article-new',
        companyId: TEST_COMPANY_ID,
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.correction.autoArticleGenerated',
        expect.objectContaining({
          articleId: 'article-new',
          companyId: TEST_COMPANY_ID,
          correctionCount: 3,
        }),
      );
    });

    it('does NOT emit event when below threshold', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(2));

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('does NOT emit event when incrementing existing article (no new article)', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(makeMatchingCorrections(3));
      mockPrisma.aiKnowledgeArticle.findMany.mockResolvedValue([
        {
          id: 'existing-article',
          title: 'Auto-learned: corrected response text',
          content: 'corrected response text',
          confidenceScore: 0.5,
          source: 'CORRECTION_DERIVED',
          isActive: true,
        },
      ]);
      mockKnowledgeArticleService.updateArticle.mockResolvedValue({
        id: 'existing-article',
      });

      await service.checkAndGenerateArticle(makeCorrectionRecord());

      expect(mockEventBus.emit).not.toHaveBeenCalledWith(
        'ai.correction.autoArticleGenerated',
        expect.anything(),
      );
    });
  });
});
