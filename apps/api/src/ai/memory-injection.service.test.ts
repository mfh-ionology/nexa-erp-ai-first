import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockMemoryService, mockLogger, mockVectorSearchService, mockEmbeddingService } =
  vi.hoisted(() => ({
    mockPrisma: {
      aiMemorySettings: {
        findUnique: vi.fn(),
      },
      aiMemory: {
        findMany: vi.fn(),
      },
      aiConversationSummary: {
        findMany: vi.fn(),
      },
      $queryRawUnsafe: vi.fn(),
    },
    mockMemoryService: {
      calculateEffectiveImportance: vi.fn(),
      touchMemory: vi.fn().mockResolvedValue(undefined),
    },
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    mockVectorSearchService: {
      hybridSearch: vi.fn(),
      calculateEffectiveImportance: vi.fn(),
      mmrRerank: vi.fn(),
    },
    mockEmbeddingService: {
      generateEmbedding: vi.fn(),
    },
  }));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { MemoryInjectionService } from './memory-injection.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function createService() {
  return new MemoryInjectionService(mockPrisma as any, mockMemoryService as any, mockLogger as any);
}

function makeMemory(category: string, content: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 8)}`,
    userId: defaultUserId,
    companyId: defaultCompanyId,
    category,
    content,
    source: 'EXPLICIT',
    importance: 1.0,
    lastAccessedAt: new Date('2026-02-20T10:00:00.000Z'),
    metadata: null,
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    ...overrides,
  };
}

function makeSummary(summary: string, daysAgo: number = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    summary,
    topics: ['topic1'],
    createdAt: date,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryInjectionService', () => {
  let service: MemoryInjectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();

    // Default happy-path mocks
    mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null); // no settings → enabled by default
    mockPrisma.aiMemory.findMany.mockResolvedValue([
      makeMemory('INSTRUCTION', 'Always use Net 30 payment terms'),
      makeMemory('PREFERENCE', 'Prefers overdue invoices sorted by amount'),
    ]);
    mockPrisma.aiConversationSummary.findMany.mockResolvedValue([
      makeSummary('Discussed quarterly AR review. Approved write-off of 3 invoices.', 1),
      makeSummary('Set up new customer Acme Ltd with special pricing.', 5),
      makeSummary('Reviewed bank reconciliation for February.', 10),
    ]);
    mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);
  });

  // ─── Context assembly — happy path ─────────────────────────────────────

  describe('assembleUserContext() — happy path', () => {
    it('returns a formatted <user_context> block', async () => {
      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toContain('<user_context>');
      expect(result).toContain('</user_context>');
      expect(result).toContain('## Your Memories About This User');
    });

    it('includes memories with correct category labels', async () => {
      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toContain('[INSTRUCTION] Always use Net 30 payment terms');
      expect(result).toContain('[PREFERENCE] Prefers overdue invoices sorted by amount');
    });

    it('includes recent conversation summaries', async () => {
      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toContain('## Recent Conversation Summaries');
      expect(result).toContain('Discussed quarterly AR review');
      expect(result).toContain('Set up new customer Acme Ltd');
    });

    it('sorts memories by effective importance descending', async () => {
      mockMemoryService.calculateEffectiveImportance
        .mockReturnValueOnce(0.5) // first memory (lower score)
        .mockReturnValueOnce(1.5); // second memory (higher score)

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      const prefIdx = result.indexOf('[PREFERENCE]');
      const instrIdx = result.indexOf('[INSTRUCTION]');
      expect(prefIdx).toBeLessThan(instrIdx); // higher score first
    });

    it('calls touchMemory for each included memory (AC-10)', async () => {
      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toContain('<user_context>');
      // 2 memories are in the default mock setup
      expect(mockMemoryService.touchMemory).toHaveBeenCalledTimes(2);
    });

    it('does not call touchMemory when no memories exist', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([
        makeSummary('Summary 1', 1),
        makeSummary('Summary 2', 2),
        makeSummary('Summary 3', 3),
      ]);

      await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(mockMemoryService.touchMemory).not.toHaveBeenCalled();
    });
  });

  // ─── Memory settings check ─────────────────────────────────────────────

  describe('memory settings check', () => {
    it('returns empty string when memory is disabled', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue({
        isEnabled: false,
        enabledCategories: [],
      });

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toBe('');
      expect(mockPrisma.aiMemory.findMany).not.toHaveBeenCalled();
    });

    it('proceeds when no settings exist (default = enabled)', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null);

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toContain('<user_context>');
    });

    it('uses enabledCategories to filter memories', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue({
        isEnabled: true,
        enabledCategories: ['PREFERENCE', 'INSTRUCTION'],
      });

      await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { in: ['PREFERENCE', 'INSTRUCTION'] },
          }),
        }),
      );
    });

    it('defaults to all categories when settings have none', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null);

      await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: {
              in: ['PREFERENCE', 'WORKFLOW', 'ENTITY_CONTEXT', 'DECISION', 'INSTRUCTION'],
            },
          }),
        }),
      );
    });
  });

  // ─── Empty data ────────────────────────────────────────────────────────

  describe('empty data', () => {
    it('returns empty string when no memories and no summaries exist', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([]);

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toBe('');
    });

    it('returns context with only memories when no summaries exist and < 3', async () => {
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([makeSummary('One summary', 1)]);

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      // Should have memories section but NOT summaries (< MIN_SUMMARIES=3)
      expect(result).toContain('## Your Memories About This User');
      // With only 1 summary, the summaries section is skipped (need >= 3)
      expect(result).not.toContain('## Recent Conversation Summaries');
    });

    it('includes summaries section when no memories but summaries exist', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      // When no memories, summaries are shown even if < MIN_SUMMARIES
      expect(result).toContain('## Recent Conversation Summaries');
    });
  });

  // ─── Token budget enforcement ──────────────────────────────────────────

  describe('token budget enforcement', () => {
    it('truncates to ~8000 chars budget (MAX_CONTEXT_CHARS)', async () => {
      // Create many long memories that exceed the budget
      const longMemories = Array.from({ length: 100 }, (_, i) =>
        makeMemory(
          'PREFERENCE',
          `This is a very long memory entry number ${i} with lots of text: ${'x'.repeat(200)}`,
        ),
      );
      mockPrisma.aiMemory.findMany.mockResolvedValue(longMemories);
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result.length).toBeLessThanOrEqual(8000);
      expect(result).toContain('<user_context>');
      expect(result).toContain('</user_context>');
    });
  });

  // ─── Graceful degradation ──────────────────────────────────────────────

  describe('graceful degradation (IMP-006)', () => {
    it('returns empty string on database error (never throws)', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB connection lost' }),
        'Memory injection failed, proceeding without user context',
      );
    });

    it('returns empty string on memory fetch error', async () => {
      mockPrisma.aiMemory.findMany.mockRejectedValue(new Error('Query timeout'));

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toBe('');
    });
  });

  // ─── Cached injected memories ──────────────────────────────────────────

  describe('getLastInjectedMemories()', () => {
    it('returns empty array when no context has been assembled', () => {
      const result = service.getLastInjectedMemories(defaultUserId, defaultCompanyId);
      expect(result).toEqual([]);
    });

    it('returns the injected memories after assembleUserContext', async () => {
      const mem1 = makeMemory('INSTRUCTION', 'Always use Net 30 payment terms', { id: 'mem-1' });
      const mem2 = makeMemory('PREFERENCE', 'Prefers FIFO costing', { id: 'mem-2' });
      mockPrisma.aiMemory.findMany.mockResolvedValue([mem1, mem2]);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([]);

      await service.assembleUserContext(defaultUserId, defaultCompanyId);

      const cached = service.getLastInjectedMemories(defaultUserId, defaultCompanyId);
      expect(cached).toHaveLength(2);
      expect(cached[0]!.id).toBe('mem-1');
      expect(cached[1]!.id).toBe('mem-2');
    });

    it('returns empty array for different user', async () => {
      await service.assembleUserContext(defaultUserId, defaultCompanyId);

      const cached = service.getLastInjectedMemories('other-user', defaultCompanyId);
      expect(cached).toEqual([]);
    });
  });

  // ─── ENTITY_CONTEXT label mapping ──────────────────────────────────────

  describe('category label mapping', () => {
    it('maps ENTITY_CONTEXT to CONTEXT label', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([
        makeMemory('ENTITY_CONTEXT', 'Customer Acme Ltd has special terms'),
      ]);

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId);

      expect(result).toContain('[CONTEXT] Customer Acme Ltd has special terms');
    });
  });

  // ─── Hybrid retrieval path (E5b-4 Task 7) ────────────────────────────

  describe('assembleUserContext() — hybrid retrieval', () => {
    let hybridService: MemoryInjectionService;

    beforeEach(() => {
      hybridService = createService();
      hybridService.setVectorSearchService(mockVectorSearchService as any);
      hybridService.setEmbeddingService(mockEmbeddingService as any);

      // Default settings mock
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([
        makeSummary('Summary 1', 1),
        makeSummary('Summary 2', 2),
        makeSummary('Summary 3', 3),
      ]);
    });

    it('uses hybrid search when VectorSearchService + EmbeddingService + recentMessages are available', async () => {
      const queryEmbedding = Array.from({ length: 1536 }, () => 0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);

      const hybridResults = [
        { id: 'mem-h1', content: 'Net 30 payment terms', rrf_score: 0.8 },
        { id: 'mem-h2', content: 'FIFO costing preferred', rrf_score: 0.6 },
      ];
      mockVectorSearchService.hybridSearch.mockResolvedValue(hybridResults);
      mockVectorSearchService.calculateEffectiveImportance.mockReturnValue(0.8);

      // Full memory records for the hybrid results
      const mem1 = makeMemory('INSTRUCTION', 'Net 30 payment terms', {
        id: 'mem-h1',
        source: 'EXPLICIT',
      });
      const mem2 = makeMemory('PREFERENCE', 'FIFO costing preferred', {
        id: 'mem-h2',
        source: 'IMPLICIT',
      });
      mockPrisma.aiMemory.findMany.mockResolvedValue([mem1, mem2]);

      // MMR embeddings (raw SQL)
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'mem-h1', embedding: JSON.stringify(Array.from({ length: 1536 }, () => 0.1)) },
        { id: 'mem-h2', embedding: JSON.stringify(Array.from({ length: 1536 }, () => 0.2)) },
      ]);

      // MMR rerank returns same order
      mockVectorSearchService.mmrRerank.mockReturnValue(hybridResults);

      const result = await hybridService.assembleUserContext(defaultUserId, defaultCompanyId, [
        'What are my payment terms?',
      ]);

      expect(result).toContain('<user_context>');
      expect(mockVectorSearchService.hybridSearch).toHaveBeenCalledWith(
        'What are my payment terms?',
        queryEmbedding,
        'ai_memories',
        expect.objectContaining({
          user_id: defaultUserId,
          company_id: defaultCompanyId,
        }),
        expect.objectContaining({ limit: 100 }),
      );
    });

    it('falls back to Prisma-based fetch when VectorSearchService is NOT wired', async () => {
      // Use the base service (no vector search wired)
      mockPrisma.aiMemory.findMany.mockResolvedValue([
        makeMemory('INSTRUCTION', 'Net 30 payment terms', { id: 'mem-1' }),
      ]);
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);

      const result = await service.assembleUserContext(defaultUserId, defaultCompanyId, [
        'What are my payment terms?',
      ]);

      expect(result).toContain('<user_context>');
      // Should use Prisma path (findMany on aiMemory)
      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalled();
      expect(mockVectorSearchService.hybridSearch).not.toHaveBeenCalled();
    });

    it('falls back to Prisma when recentMessages is empty', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([
        makeMemory('INSTRUCTION', 'Net 30', { id: 'mem-1' }),
      ]);
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);

      const result = await hybridService.assembleUserContext(defaultUserId, defaultCompanyId, []);

      expect(result).toContain('<user_context>');
      expect(mockVectorSearchService.hybridSearch).not.toHaveBeenCalled();
    });

    it('falls back to Prisma when hybrid search throws', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockVectorSearchService.hybridSearch.mockRejectedValue(new Error('pgvector unavailable'));

      // Prisma fallback will be used
      mockPrisma.aiMemory.findMany.mockResolvedValue([
        makeMemory('INSTRUCTION', 'Net 30 payment terms', { id: 'mem-f' }),
      ]);
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);

      const result = await hybridService.assembleUserContext(defaultUserId, defaultCompanyId, [
        'payment terms?',
      ]);

      expect(result).toContain('<user_context>');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'pgvector unavailable' }),
        'Hybrid retrieval failed, falling back to Prisma-based fetch',
      );
    });

    it('returns empty context when hybrid search returns no results and Prisma fallback also empty', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockVectorSearchService.hybridSearch.mockResolvedValue([]);

      // Prisma fallback (triggered when hybrid returns empty)
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([]);

      const result = await hybridService.assembleUserContext(defaultUserId, defaultCompanyId, [
        'irrelevant query',
      ]);

      expect(result).toBe('');
    });

    it('concatenates last 2-3 user messages as search query', async () => {
      const queryEmbedding = [0.1, 0.2];
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorSearchService.hybridSearch.mockResolvedValue([]);
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([]);

      await hybridService.assembleUserContext(defaultUserId, defaultCompanyId, [
        'First message',
        'Second message',
        'Third message',
        'Fourth message',
      ]);

      // Should concatenate the last 3 messages (not all 4)
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        'Second message Third message Fourth message',
      );
    });
  });
});
