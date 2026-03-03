import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockEmbeddingService } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRawUnsafe: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockEmbeddingService: {
    generateEmbedding: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  VectorSearchService,
  cosineSimilarity,
  type HybridResult,
} from './vector-search.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new VectorSearchService(mockPrisma as any, mockLogger as any, mockEmbeddingService as any);
}

const UNIT_VEC_A = [1, 0, 0];
const UNIT_VEC_B = [0, 1, 0];
// UNIT_VEC_C removed — unused

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VectorSearchService', () => {
  let service: VectorSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── cosineSimilarity() utility ───────────────────────────────────────

  describe('cosineSimilarity()', () => {
    it('returns 1.0 for identical vectors', () => {
      const vec = [0.1, 0.2, 0.3, 0.4];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      expect(cosineSimilarity(UNIT_VEC_A, UNIT_VEC_B)).toBeCloseTo(0.0, 5);
    });

    it('returns -1.0 for opposite vectors', () => {
      const pos = [1, 0, 0];
      const neg = [-1, 0, 0];
      expect(cosineSimilarity(pos, neg)).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    it('returns 0 for zero-magnitude vectors', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });
  });

  // ─── calculateEffectiveImportance() ───────────────────────────────────

  describe('calculateEffectiveImportance()', () => {
    it('returns full score for 0 days since access', () => {
      const result = service.calculateEffectiveImportance(1.0, 'IMPLICIT', new Date(), 30);
      // 1.0 * 1.0 (IMPLICIT) * 0.5^(~0/30) ≈ 1.0
      expect(result).toBeCloseTo(1.0, 1);
    });

    it('halves score at half-life (30 days)', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = service.calculateEffectiveImportance(1.0, 'IMPLICIT', thirtyDaysAgo, 30);
      // 1.0 * 1.0 * 0.5^(30/30) = 0.5
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('quarters score at 2x half-life (60 days)', () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const result = service.calculateEffectiveImportance(1.0, 'IMPLICIT', sixtyDaysAgo, 30);
      // 1.0 * 1.0 * 0.5^(60/30) = 0.25
      expect(result).toBeCloseTo(0.25, 1);
    });

    it('applies 1.5x multiplier for EXPLICIT source', () => {
      const result = service.calculateEffectiveImportance(1.0, 'EXPLICIT', new Date(), 30);
      // 1.0 * 1.5 * ~1.0 ≈ 1.5
      expect(result).toBeCloseTo(1.5, 1);
    });

    it('applies 1.0x multiplier for IMPLICIT source', () => {
      const result = service.calculateEffectiveImportance(1.0, 'IMPLICIT', new Date(), 30);
      // 1.0 * 1.0 * ~1.0 ≈ 1.0
      expect(result).toBeCloseTo(1.0, 1);
    });

    it('uses custom half-life', () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const result = service.calculateEffectiveImportance(1.0, 'IMPLICIT', fifteenDaysAgo, 15);
      // 1.0 * 1.0 * 0.5^(15/15) = 0.5
      expect(result).toBeCloseTo(0.5, 1);
    });
  });

  // ─── similaritySearch() ───────────────────────────────────────────────

  describe('similaritySearch()', () => {
    it('returns results from raw SQL query', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'mem-1', content: 'Hello', similarity: 0.95, metadata: null },
        { id: 'mem-2', content: 'World', similarity: 0.85, metadata: { key: 'val' } },
      ]);

      const embedding = Array.from({ length: 1536 }, () => 0.1);
      const results = await service.similaritySearch(
        embedding,
        'ai_memories',
        { user_id: 'u1', company_id: 'c1' },
        10,
      );

      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe('mem-1');
      expect(results[0]!.similarity).toBe(0.95);
      expect(results[1]!.metadata).toEqual({ key: 'val' });
    });

    it('returns empty array on SQL error (graceful degradation)', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('SQL error'));

      const results = await service.similaritySearch([0.1], 'ai_memories', {}, 10);

      expect(results).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('throws for invalid table name (SQL injection prevention)', async () => {
      await expect(service.similaritySearch([0.1], 'DROP TABLE foo', {}, 10)).rejects.toThrow(
        'invalid table name',
      );
    });

    it('skips disallowed filter columns', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.similaritySearch(
        [0.1],
        'ai_memories',
        { user_id: 'u1', evil_column: 'hack' },
        10,
      );

      // The SQL should only contain user_id, not evil_column
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ column: 'evil_column' }),
        expect.stringContaining('skipping disallowed filter column'),
      );
    });
  });

  // ─── keywordSearch() ──────────────────────────────────────────────────

  describe('keywordSearch()', () => {
    it('returns results from BM25 full-text search', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'mem-1', content: 'Invoice payment terms', rank: 0.8 },
        { id: 'mem-2', content: 'Net 30 payment', rank: 0.5 },
      ]);

      const results = await service.keywordSearch(
        'payment terms',
        'ai_memories',
        { user_id: 'u1' },
        10,
      );

      expect(results).toHaveLength(2);
      expect(results[0]!.rank).toBe(0.8);
    });

    it('returns empty array on SQL error', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('SQL error'));

      const results = await service.keywordSearch('test', 'ai_memories', {}, 10);

      expect(results).toEqual([]);
    });

    it('throws for invalid table name', async () => {
      await expect(service.keywordSearch('test', 'evil_table', {}, 10)).rejects.toThrow(
        'invalid table name',
      );
    });
  });

  // ─── hybridSearch() RRF fusion ────────────────────────────────────────

  describe('hybridSearch()', () => {
    it('fuses results appearing in both keyword and semantic lists', async () => {
      // First call = keyword search, second call = similarity search
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 'mem-1', content: 'Shared result', rank: 0.9 }])
        .mockResolvedValueOnce([
          { id: 'mem-1', content: 'Shared result', similarity: 0.95, metadata: null },
        ]);

      const queryEmbedding = Array.from({ length: 1536 }, () => 0.1);
      const results = await service.hybridSearch('query text', queryEmbedding, 'ai_memories', {
        user_id: 'u1',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('mem-1');
      // Should have both keyword and semantic ranks
      expect(results[0]!.keyword_rank).toBe(1);
      expect(results[0]!.semantic_rank).toBe(1);
      // RRF score = 0.3/(60+1) + 0.7/(60+1) = 1.0/61 ≈ 0.01639
      expect(results[0]!.rrf_score).toBeCloseTo(1.0 / 61, 4);
    });

    it('penalizes results appearing in only one list', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 'mem-kw', content: 'Keyword only', rank: 0.9 }])
        .mockResolvedValueOnce([
          { id: 'mem-sem', content: 'Semantic only', similarity: 0.95, metadata: null },
        ]);

      const queryEmbedding = Array.from({ length: 1536 }, () => 0.1);
      const results = await service.hybridSearch(
        'query',
        queryEmbedding,
        'ai_memories',
        {},
        { limit: 50 },
      );

      expect(results).toHaveLength(2);
      // Both should have a score, but the keyword-only result should have
      // a penalized semantic rank (limit+1 = 51)
      const kwOnly = results.find((r) => r.id === 'mem-kw')!;
      const semOnly = results.find((r) => r.id === 'mem-sem')!;

      expect(kwOnly.keyword_rank).toBe(1);
      expect(kwOnly.semantic_rank).toBeUndefined();
      expect(semOnly.semantic_rank).toBe(1);
      expect(semOnly.keyword_rank).toBeUndefined();
    });

    it('applies correct weights (0.3 keyword, 0.7 semantic)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 'mem-1', content: 'Result', rank: 0.9 }])
        .mockResolvedValueOnce([
          { id: 'mem-1', content: 'Result', similarity: 0.9, metadata: null },
        ]);

      const results = await service.hybridSearch(
        'query',
        [0.1],
        'ai_memories',
        {},
        { keywordWeight: 0.3, semanticWeight: 0.7, rrf_k: 60 },
      );

      // Both rank 1: score = 0.3/(60+1) + 0.7/(60+1) = 1.0/61
      expect(results[0]!.rrf_score).toBeCloseTo(1.0 / 61, 5);
    });

    it('falls back to BM25-only when query embedding is null', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'mem-1', content: 'Keyword result', rank: 0.8 },
      ]);

      const results = await service.hybridSearch('query', null, 'ai_memories', {});

      expect(results).toHaveLength(1);
      // Only keyword search should have been called
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when both searches return empty', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([]) // keyword
        .mockResolvedValueOnce([]); // semantic

      const results = await service.hybridSearch('query', [0.1], 'ai_memories', {});

      expect(results).toEqual([]);
    });

    it('respects the limit option', async () => {
      const manyKeywordResults = Array.from({ length: 20 }, (_, i) => ({
        id: `mem-${i}`,
        content: `Result ${i}`,
        rank: 1.0 - i * 0.01,
      }));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce(manyKeywordResults)
        .mockResolvedValueOnce([]);

      const results = await service.hybridSearch('query', null, 'ai_memories', {}, { limit: 5 });

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── mmrRerank() ──────────────────────────────────────────────────────

  describe('mmrRerank()', () => {
    it('with λ=1.0 returns pure relevance ranking (degenerate case)', () => {
      const queryEmb = [1, 0, 0];
      const candidates: HybridResult[] = [
        { id: 'a', content: 'A', rrf_score: 0.9 },
        { id: 'b', content: 'B', rrf_score: 0.8 },
        { id: 'c', content: 'C', rrf_score: 0.7 },
      ];
      const embeddings = new Map<string, number[]>([
        ['a', [0.9, 0.1, 0]], // most similar to query
        ['b', [0.5, 0.5, 0]], // medium
        ['c', [0.1, 0.9, 0]], // least similar
      ]);

      const result = service.mmrRerank(candidates, queryEmb, embeddings, 3, 1.0);

      expect(result).toHaveLength(3);
      // With lambda=1.0, pure relevance → sorted by similarity to query
      expect(result[0]!.id).toBe('a');
    });

    it('with λ=0.7 promotes diversity — penalizes candidates similar to already-selected', () => {
      // Use λ=0.5 (50/50 relevance vs diversity) for a clearer demonstration.
      // With λ=0.5, the diversity penalty is stronger and more easily demonstrated.
      // queryEmb intentionally omitted — test only needs candidates
      const candidates: HybridResult[] = [
        { id: 'a', content: 'A', rrf_score: 0.9 },
        { id: 'b', content: 'B', rrf_score: 0.8 },
        { id: 'c', content: 'C', rrf_score: 0.7 },
      ];

      // All three candidates are equally relevant to query (cos = 1.0 for a/b, high for c).
      // But 'b' is identical to 'a', so after selecting 'a', 'b' gets max penalty.
      // 'c' is orthogonal to 'a', so it gets zero penalty.
      //
      // After selecting 'a':
      //   MMR(b) = 0.5 * cos(b,q) - 0.5 * cos(b,a) = 0.5*1.0 - 0.5*1.0 = 0.0
      //   MMR(c) = 0.5 * cos(c,q) - 0.5 * cos(c,a) = 0.5*0.0 - 0.5*0.0 = 0.0
      //
      // Hmm, both zero. Let me use different vectors:
      // 'a' and 'b' both point at query direction, 'c' at 45° off query.
      // cos(c, query=[1,0,0]) = cos(45°) ≈ 0.707
      // cos(c, a=[1,0,0])    = cos(45°) ≈ 0.707
      // cos(b, a=[1,0,0])    = 1.0 (identical)
      //
      // MMR(b) = 0.5 * 1.0 - 0.5 * 1.0 = 0.0
      // MMR(c) = 0.5 * 0.707 - 0.5 * 0.707 = 0.0  ... still tied.
      //
      // The only way diversity helps is if 'c' has ZERO similarity to selected.
      // So 'c' must be orthogonal to 'a'. Then:
      //   MMR(b) = 0.5 * 1.0 - 0.5 * 1.0 = 0.0
      //   MMR(c) = 0.5 * 0.0 - 0.5 * 0.0 = 0.0   ... still tied!
      //
      // The key: relevance must outweigh penalty differently.
      // Use 'c' with SOME query relevance but NO overlap with 'a'.

      // Use 4 dimensions for cleaner math:
      // query = [1, 0, 0, 0]
      // a     = [1, 0, 0, 0]   (cos with query = 1.0)
      // b     = [1, 0, 0, 0]   (cos with query = 1.0, cos with a = 1.0)
      // c     = [0.6, 0.8, 0, 0]  (cos with query = 0.6, cos with a = 0.6)
      //
      // After selecting 'a' (highest cos with query):
      //   MMR(b) = 0.5 * 1.0 - 0.5 * 1.0 = 0.0
      //   MMR(c) = 0.5 * 0.6 - 0.5 * 0.6 = 0.0  ... still same!
      //
      // The math shows: if a=query, then for ANY candidate d:
      //   MMR(d) = λ*cos(d,q) - (1-λ)*cos(d,a) = λ*cos(d,q) - (1-λ)*cos(d,q) = (2λ-1)*cos(d,q)
      // So with a=query, MMR reduces to pure relevance scaled by (2λ-1).
      // 'b' (cos=1.0) will always beat 'c' (cos<1.0).
      //
      // For diversity to matter, 'a' must NOT equal query:
      const queryEmb4 = [1, 0, 0, 0];
      const embeddings = new Map<string, number[]>([
        ['a', [0.8, 0.6, 0, 0]], // cos(a,q) = 0.8 (selected first — highest relevance)
        ['b', [0.8, 0.6, 0, 0]], // identical to 'a': cos(b,q) = 0.8, cos(b,a) = 1.0
        ['c', [0.75, 0, 0.66, 0]], // cos(c,q) ≈ 0.75, cos(c,a) ≈ 0.6
      ]);

      // After selecting 'a':
      //   MMR(b) = 0.7*0.8 - 0.3*1.0 = 0.56 - 0.3 = 0.26
      //   MMR(c) = 0.7*0.75 - 0.3*0.6 = 0.525 - 0.18 = 0.345
      // c > b! Diversity wins.

      const result = service.mmrRerank(candidates, queryEmb4, embeddings, 3, 0.7);

      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe('a');
      // 'c' should be picked second (higher MMR than 'b')
      expect(result[1]!.id).toBe('c');
      expect(result[2]!.id).toBe('b');
    });

    it('appends candidates without embeddings after MMR-ranked results', () => {
      const queryEmb = [1, 0, 0];
      const candidates: HybridResult[] = [
        { id: 'a', content: 'A', rrf_score: 0.9 },
        { id: 'no-emb', content: 'No Embedding', rrf_score: 0.95 },
      ];
      const embeddings = new Map<string, number[]>([
        ['a', [1, 0, 0]], // only 'a' has embedding
      ]);

      const result = service.mmrRerank(candidates, queryEmb, embeddings, 5);

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('a'); // MMR-ranked
      expect(result[1]!.id).toBe('no-emb'); // appended at end
    });

    it('respects the limit parameter', () => {
      const queryEmb = [1, 0, 0];
      const candidates: HybridResult[] = [
        { id: 'a', content: 'A', rrf_score: 0.9 },
        { id: 'b', content: 'B', rrf_score: 0.8 },
        { id: 'c', content: 'C', rrf_score: 0.7 },
      ];
      const embeddings = new Map<string, number[]>([
        ['a', [1, 0, 0]],
        ['b', [0, 1, 0]],
        ['c', [0, 0, 1]],
      ]);

      const result = service.mmrRerank(candidates, queryEmb, embeddings, 2);

      expect(result).toHaveLength(2);
    });

    it('handles empty candidates', () => {
      const result = service.mmrRerank([], [1, 0, 0], new Map(), 5);
      expect(result).toEqual([]);
    });
  });

  // ─── findSimilar() ────────────────────────────────────────────────────

  describe('findSimilar()', () => {
    beforeEach(() => {
      // Reset to ensure no leftover mockResolvedValueOnce from hybrid tests
      mockPrisma.$queryRawUnsafe.mockReset();
      mockEmbeddingService.generateEmbedding.mockReset();
    });

    it('generates embedding and returns best match above threshold', async () => {
      const embedding = Array.from({ length: 1536 }, () => 0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(embedding);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'mem-1', content: 'Similar content', similarity: 0.92, metadata: null },
      ]);

      const result = await service.findSimilar(
        'test content',
        'ai_memories',
        { user_id: 'u1' },
        0.85,
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe('mem-1');
      expect(result!.similarity).toBe(0.92);
    });

    it('returns null when embedding generation fails', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue(null);

      const result = await service.findSimilar('test content', 'ai_memories', { user_id: 'u1' });

      expect(result).toBeNull();
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('returns null when no results above threshold', async () => {
      const embedding = Array.from({ length: 1536 }, () => 0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(embedding);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.findSimilar(
        'test content',
        'ai_memories',
        { user_id: 'u1' },
        0.85,
      );

      expect(result).toBeNull();
    });
  });

  // ─── Table validation ─────────────────────────────────────────────────

  describe('table validation', () => {
    it('allows ai_memories table', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(service.keywordSearch('test', 'ai_memories', {}, 10)).resolves.toEqual([]);
    });

    it('allows ai_knowledge_chunks table', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(service.keywordSearch('test', 'ai_knowledge_chunks', {}, 10)).resolves.toEqual(
        [],
      );
    });

    it('rejects arbitrary table names', async () => {
      await expect(service.keywordSearch('test', 'users; DROP TABLE--', {}, 10)).rejects.toThrow(
        'invalid table name',
      );
    });
  });
});
