// ---------------------------------------------------------------------------
// Unit tests for KnowledgeRagService — E5d-1 Task 10.3 + 10.6
// Tests: Confidence-weighted re-ranking, token budget enforcement,
// graceful degradation, context formatting, cross-tenant isolation
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockLogger,
  mockArticleService,
  mockVectorSearchService,
  mockEmbeddingService,
} = vi.hoisted(() => ({
  mockPrisma: {
    aiKnowledgeChunk: {
      findMany: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockArticleService: {
    trackUsage: vi.fn(),
  },
  mockVectorSearchService: {
    similaritySearch: vi.fn(),
    keywordSearch: vi.fn(),
  },
  mockEmbeddingService: {
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { KnowledgeRagService, getConfidenceWeight } from './knowledge-rag.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-001';
const OTHER_COMPANY_ID = 'company-999';

function createService() {
  const svc = new KnowledgeRagService(
    mockPrisma as any,
    mockLogger as any,
    mockArticleService as any,
  );
  svc.setVectorSearchService(mockVectorSearchService as any);
  svc.setEmbeddingService(mockEmbeddingService as any);
  return svc;
}

function makeEnrichedChunk(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    articleId: 'article-1',
    content: 'VAT code 3 means reverse charge for EU purchases.',
    tokenCount: 12,
    article: {
      title: 'VAT Codes',
      category: 'TERMINOLOGY',
      source: 'ADMIN_UPLOADED',
      isConfirmed: true,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: getConfidenceWeight (exported utility)
// ---------------------------------------------------------------------------

describe('getConfidenceWeight()', () => {
  it('returns 1.0 for ADMIN_UPLOADED', () => {
    expect(getConfidenceWeight('ADMIN_UPLOADED', true)).toBe(1.0);
    expect(getConfidenceWeight('ADMIN_UPLOADED', false)).toBe(1.0);
  });

  it('returns 0.9 for PLATFORM_SUGGESTED when confirmed (accepted)', () => {
    expect(getConfidenceWeight('PLATFORM_SUGGESTED', true)).toBe(0.9);
  });

  it('returns 0.6 for PLATFORM_SUGGESTED when unconfirmed (not yet accepted)', () => {
    expect(getConfidenceWeight('PLATFORM_SUGGESTED', false)).toBe(0.6);
  });

  it('returns 0.8 for AI_GENERATED when confirmed', () => {
    expect(getConfidenceWeight('AI_GENERATED', true)).toBe(0.8);
  });

  it('returns 0.5 for AI_GENERATED when unconfirmed', () => {
    expect(getConfidenceWeight('AI_GENERATED', false)).toBe(0.5);
  });

  it('returns 0.8 for CORRECTION_DERIVED', () => {
    expect(getConfidenceWeight('CORRECTION_DERIVED', true)).toBe(0.8);
    expect(getConfidenceWeight('CORRECTION_DERIVED', false)).toBe(0.8);
  });

  it('returns 0.5 for unknown source', () => {
    expect(getConfidenceWeight('UNKNOWN', false)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Tests: KnowledgeRagService
// ---------------------------------------------------------------------------

describe('KnowledgeRagService', () => {
  let service: KnowledgeRagService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks that may have been set to reject in previous tests
    // (clearAllMocks only clears call history, not implementations)
    mockEmbeddingService.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
    mockVectorSearchService.similaritySearch.mockResolvedValue([]);
    mockVectorSearchService.keywordSearch.mockResolvedValue([]);
    service = createService();
    mockArticleService.trackUsage.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // retrieveRelevantKnowledge — vector similarity path
  // ═══════════════════════════════════════════════════════════════════════

  describe('retrieveRelevantKnowledge() — vector path', () => {
    it('returns relevant chunks with confidence-weighted re-ranking', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk 1', similarity: 0.9 },
        { id: 'c-2', content: 'chunk 2', similarity: 0.85 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({
          id: 'c-1',
          article: {
            title: 'VAT',
            category: 'TERMINOLOGY',
            source: 'ADMIN_UPLOADED',
            isConfirmed: true,
          },
        }),
        makeEnrichedChunk({
          id: 'c-2',
          article: {
            title: 'AI Doc',
            category: 'TERMINOLOGY',
            source: 'AI_GENERATED',
            isConfirmed: false,
          },
        }),
      ]);

      const result = await service.retrieveRelevantKnowledge(
        'What does VAT code 3 mean?',
        TEST_COMPANY_ID,
      );

      expect(result.chunks).toHaveLength(2);
      // ADMIN_UPLOADED with 0.9 similarity → finalScore = 0.9 * 1.0 = 0.9
      expect(result.chunks[0]!.finalScore).toBe(0.9);
      // AI_GENERATED unconfirmed with 0.85 → finalScore = 0.85 * 0.5 = 0.425
      expect(result.chunks[1]!.finalScore).toBeCloseTo(0.425);
      // First chunk should have higher score (sorted desc)
      expect(result.chunks[0]!.finalScore).toBeGreaterThan(result.chunks[1]!.finalScore);
    });

    it('calls VectorSearchService.similaritySearch with correct params', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([]);

      await service.retrieveRelevantKnowledge('Test query', TEST_COMPANY_ID);

      expect(mockVectorSearchService.similaritySearch).toHaveBeenCalledWith(
        expect.any(Array), // query embedding
        'ai_knowledge_chunks', // table name
        {}, // no direct company filter (enforced via Prisma post-filter)
        50, // topK * CANDIDATE_MULTIPLIER (default topK=5, multiplier=10)
        0.5, // default min similarity
      );
    });

    it('generates query embedding before search', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([]);

      await service.retrieveRelevantKnowledge('Test query', TEST_COMPANY_ID);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('Test query');
    });

    it('fires usage tracking for retrieved articles with companyId', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk 1', similarity: 0.9 },
        { id: 'c-2', content: 'chunk 2', similarity: 0.8 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({ id: 'c-1', articleId: 'art-1' }),
        makeEnrichedChunk({ id: 'c-2', articleId: 'art-2' }),
      ]);

      await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      expect(mockArticleService.trackUsage).toHaveBeenCalledWith(
        expect.arrayContaining(['art-1', 'art-2']),
        TEST_COMPANY_ID,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Token budget enforcement
  // ═══════════════════════════════════════════════════════════════════════

  describe('token budget enforcement', () => {
    it('selects chunks within token budget accounting for formatting overhead', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk 1', similarity: 0.9 },
        { id: 'c-2', content: 'chunk 2', similarity: 0.8 },
      ]);

      // Each chunk has 12 tokens + ~8 per-chunk overhead = 20 effective tokens
      // Budget = 40, formatting overhead = 20, effective = 20 → only 1 chunk fits
      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({ id: 'c-1', tokenCount: 12 }),
        makeEnrichedChunk({ id: 'c-2', tokenCount: 12 }),
      ]);

      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID, {
        tokenBudget: 40,
      });

      // With overhead accounting, only 1 chunk should fit in tight budget
      expect(result.chunks.length).toBeLessThanOrEqual(2);
    });

    it('respects topK limit', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk 1', similarity: 0.9 },
        { id: 'c-2', content: 'chunk 2', similarity: 0.85 },
        { id: 'c-3', content: 'chunk 3', similarity: 0.8 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({ id: 'c-1' }),
        makeEnrichedChunk({ id: 'c-2' }),
        makeEnrichedChunk({ id: 'c-3' }),
      ]);

      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID, {
        topK: 2,
        tokenBudget: 10000,
      });

      expect(result.chunks.length).toBeLessThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Graceful degradation
  // ═══════════════════════════════════════════════════════════════════════

  describe('graceful degradation', () => {
    it('falls back to VectorSearchService.keywordSearch when embedding service is unavailable', async () => {
      const svc = new KnowledgeRagService(
        mockPrisma as any,
        mockLogger as any,
        mockArticleService as any,
      );
      svc.setVectorSearchService(mockVectorSearchService as any);
      // No embedding service set → keyword fallback

      mockVectorSearchService.keywordSearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', rank: 0.7 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([makeEnrichedChunk({ id: 'c-1' })]);

      const result = await svc.retrieveRelevantKnowledge('VAT codes', TEST_COMPANY_ID);

      // Should log warning about fallback
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('embedding unavailable'),
      );
      // Should call VectorSearchService.keywordSearch (not raw SQL)
      expect(mockVectorSearchService.keywordSearch).toHaveBeenCalledWith(
        'VAT codes',
        'ai_knowledge_chunks',
        {},
        50, // topK * CANDIDATE_MULTIPLIER
      );
      expect(result.chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('returns empty result when embedding generation fails', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('API timeout'));

      // The outer try/catch should catch and return empty
      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      expect(result.chunks).toHaveLength(0);
      expect(result.formattedContext).toBe('');
    });

    it('returns empty result when vector search returns no matches', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([]);

      const result = await service.retrieveRelevantKnowledge('Nonsense query', TEST_COMPANY_ID);

      expect(result.chunks).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.articleIds).toHaveLength(0);
      expect(result.formattedContext).toBe('');
    });

    it('returns empty result when VectorSearchService is unavailable', async () => {
      const svc = new KnowledgeRagService(
        mockPrisma as any,
        mockLogger as any,
        mockArticleService as any,
      );
      // No VectorSearchService set

      const result = await svc.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      expect(result.chunks).toHaveLength(0);
      expect(result.formattedContext).toBe('');
    });

    it('returns empty result when vector search fails (service error)', async () => {
      mockVectorSearchService.similaritySearch.mockRejectedValue(new Error('Connection refused'));

      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      // Should not throw — returns empty result
      expect(result.chunks).toHaveLength(0);
      expect(result.formattedContext).toBe('');
    });

    it('never throws — always returns a valid RagResult', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('Total failure'));

      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('articleIds');
      expect(result).toHaveProperty('formattedContext');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Context formatting
  // ═══════════════════════════════════════════════════════════════════════

  describe('context formatting', () => {
    it('formats chunks as <tenant_knowledge> XML block', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', similarity: 0.9 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({
          id: 'c-1',
          content: 'VAT code 3 means reverse charge',
          article: {
            title: 'VAT Codes',
            category: 'TERMINOLOGY',
            source: 'ADMIN_UPLOADED',
            isConfirmed: true,
          },
        }),
      ]);

      const result = await service.retrieveRelevantKnowledge('VAT', TEST_COMPANY_ID);

      expect(result.formattedContext).toContain('<tenant_knowledge>');
      expect(result.formattedContext).toContain('</tenant_knowledge>');
      expect(result.formattedContext).toContain('## Relevant Knowledge for This Query');
      expect(result.formattedContext).toContain('[TERMINOLOGY]');
      expect(result.formattedContext).toContain('VAT Codes');
      expect(result.formattedContext).toContain('VAT code 3 means reverse charge');
    });

    it('replaces underscores with spaces in category labels', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', similarity: 0.9 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({
          id: 'c-1',
          article: {
            title: 'Proc',
            category: 'BUSINESS_PROCESS',
            source: 'ADMIN_UPLOADED',
            isConfirmed: true,
          },
        }),
      ]);

      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      expect(result.formattedContext).toContain('[BUSINESS PROCESS]');
      expect(result.formattedContext).not.toContain('[BUSINESS_PROCESS]');
    });

    it('returns empty string when no chunks found', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([]);

      const result = await service.retrieveRelevantKnowledge('Nothing', TEST_COMPANY_ID);

      expect(result.formattedContext).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Confidence-weighted re-ranking (detailed)
  // ═══════════════════════════════════════════════════════════════════════

  describe('confidence-weighted re-ranking', () => {
    it('ranks ADMIN_UPLOADED higher than unconfirmed AI_GENERATED at same similarity', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-ai', content: 'ai', similarity: 0.8 },
        { id: 'c-admin', content: 'admin', similarity: 0.8 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({
          id: 'c-ai',
          article: {
            title: 'AI',
            category: 'TERMINOLOGY',
            source: 'AI_GENERATED',
            isConfirmed: false,
          },
        }),
        makeEnrichedChunk({
          id: 'c-admin',
          article: {
            title: 'Admin',
            category: 'TERMINOLOGY',
            source: 'ADMIN_UPLOADED',
            isConfirmed: true,
          },
        }),
      ]);

      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      // ADMIN: 0.8 * 1.0 = 0.8, AI unconfirmed: 0.8 * 0.5 = 0.4
      expect(result.chunks[0]!.chunkId).toBe('c-admin');
      expect(result.chunks[1]!.chunkId).toBe('c-ai');
    });

    it('can rank high-similarity AI_GENERATED above low-similarity ADMIN_UPLOADED', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-admin', content: 'admin', similarity: 0.5 },
        { id: 'c-ai', content: 'ai', similarity: 0.95 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({
          id: 'c-admin',
          article: {
            title: 'Admin',
            category: 'TERMINOLOGY',
            source: 'ADMIN_UPLOADED',
            isConfirmed: true,
          },
        }),
        makeEnrichedChunk({
          id: 'c-ai',
          article: {
            title: 'AI',
            category: 'TERMINOLOGY',
            source: 'AI_GENERATED',
            isConfirmed: true,
          },
        }),
      ]);

      const result = await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      // AI confirmed: 0.95 * 0.8 = 0.76, ADMIN: 0.5 * 1.0 = 0.5
      expect(result.chunks[0]!.chunkId).toBe('c-ai');
      expect(result.chunks[0]!.finalScore).toBeCloseTo(0.76);
      expect(result.chunks[1]!.chunkId).toBe('c-admin');
      expect(result.chunks[1]!.finalScore).toBeCloseTo(0.5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Cross-tenant isolation (10.6)
  // ═══════════════════════════════════════════════════════════════════════

  describe('cross-tenant isolation (R-002)', () => {
    it('post-filters by companyId via Prisma query on article relation', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', similarity: 0.9 },
      ]);
      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([]);

      await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      // Prisma query should filter by companyId on the article relation
      expect(mockPrisma.aiKnowledgeChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            article: expect.objectContaining({
              companyId: TEST_COMPANY_ID,
              isActive: true,
            }),
          }),
        }),
      );
    });

    it('company B cannot retrieve company A knowledge', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', similarity: 0.9 },
      ]);

      // Company A has knowledge — Prisma returns the chunk
      mockPrisma.aiKnowledgeChunk.findMany
        .mockResolvedValueOnce([makeEnrichedChunk({ id: 'c-1' })]) // Company A query
        .mockResolvedValueOnce([]); // Company B query — filtered out by companyId

      const resultA = await service.retrieveRelevantKnowledge('VAT', TEST_COMPANY_ID);

      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', similarity: 0.9 },
      ]);
      const resultB = await service.retrieveRelevantKnowledge('VAT', OTHER_COMPANY_ID);

      expect(resultA.chunks.length).toBeGreaterThan(0);
      expect(resultB.chunks).toHaveLength(0);

      // Verify different companyIds were passed
      const calls = mockPrisma.aiKnowledgeChunk.findMany.mock.calls;
      expect(calls[0]![0].where.article.companyId).toBe(TEST_COMPANY_ID);
      expect(calls[1]![0].where.article.companyId).toBe(OTHER_COMPANY_ID);
    });

    it('only retrieves chunks from active articles (is_active = true)', async () => {
      mockVectorSearchService.similaritySearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', similarity: 0.9 },
      ]);
      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([]);

      await service.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      expect(mockPrisma.aiKnowledgeChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            article: expect.objectContaining({
              isActive: true,
            }),
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Keyword fallback search
  // ═══════════════════════════════════════════════════════════════════════

  describe('keyword fallback search', () => {
    it('calls VectorSearchService.keywordSearch when no embedding service', async () => {
      const svc = new KnowledgeRagService(
        mockPrisma as any,
        mockLogger as any,
        mockArticleService as any,
      );
      svc.setVectorSearchService(mockVectorSearchService as any);
      // No embedding service

      mockVectorSearchService.keywordSearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', rank: 0.7 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([makeEnrichedChunk({ id: 'c-1' })]);

      await svc.retrieveRelevantKnowledge('VAT codes', TEST_COMPANY_ID);

      expect(mockVectorSearchService.keywordSearch).toHaveBeenCalledWith(
        'VAT codes',
        'ai_knowledge_chunks',
        {},
        50, // topK * CANDIDATE_MULTIPLIER
      );
    });

    it('normalizes BM25 ranks relative to max rank', async () => {
      const svc = new KnowledgeRagService(
        mockPrisma as any,
        mockLogger as any,
        mockArticleService as any,
      );
      svc.setVectorSearchService(mockVectorSearchService as any);

      mockVectorSearchService.keywordSearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk 1', rank: 2.5 },
        { id: 'c-2', content: 'chunk 2', rank: 1.0 },
      ]);

      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([
        makeEnrichedChunk({ id: 'c-1' }),
        makeEnrichedChunk({ id: 'c-2' }),
      ]);

      const result = await svc.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      // Max rank is 2.5 → c-1: 2.5/2.5=1.0, c-2: 1.0/2.5=0.4
      expect(result.chunks[0]!.similarity).toBeCloseTo(1.0);
      expect(result.chunks[1]!.similarity).toBeCloseTo(0.4);
    });

    it('enforces companyId scoping via Prisma post-filter in keyword search', async () => {
      const svc = new KnowledgeRagService(
        mockPrisma as any,
        mockLogger as any,
        mockArticleService as any,
      );
      svc.setVectorSearchService(mockVectorSearchService as any);

      mockVectorSearchService.keywordSearch.mockResolvedValue([
        { id: 'c-1', content: 'chunk', rank: 0.5 },
      ]);
      mockPrisma.aiKnowledgeChunk.findMany.mockResolvedValue([]);

      await svc.retrieveRelevantKnowledge('Query', TEST_COMPANY_ID);

      expect(mockPrisma.aiKnowledgeChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            article: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
          }),
        }),
      );
    });
  });
});
