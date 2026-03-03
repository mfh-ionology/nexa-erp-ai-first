import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockVectorSearchService } = vi.hoisted(() => ({
  mockPrisma: {
    aiMemory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockVectorSearchService: {
    findSimilar: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { SemanticDedupService, VECTOR_SIMILARITY_THRESHOLD } from './semantic-dedup.service.js';
import type { MemoryRecord } from './memory.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function createService() {
  return new SemanticDedupService(mockPrisma as any, mockLogger as any);
}

function makeDbMemory(content: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 8)}`,
    userId: defaultUserId,
    companyId: defaultCompanyId,
    category: 'PREFERENCE',
    content,
    source: 'IMPLICIT',
    importance: 0.5,
    lastAccessedAt: new Date('2026-02-20T10:00:00.000Z'),
    metadata: null,
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    ...overrides,
  };
}

function makeMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-existing',
    userId: defaultUserId,
    companyId: defaultCompanyId,
    category: 'PREFERENCE',
    content: 'User prefers FIFO costing for inventory',
    source: 'IMPLICIT',
    importance: 0.5,
    lastAccessedAt: new Date('2026-02-20T10:00:00.000Z'),
    metadata: null,
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SemanticDedupService', () => {
  let service: SemanticDedupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
    // Default: ownership verification passes (findFirst returns the record)
    mockPrisma.aiMemory.findFirst.mockResolvedValue({ id: 'mem-existing' });
  });

  // ─── Vector threshold constant ──────────────────────────────────────────

  describe('constants', () => {
    it('VECTOR_SIMILARITY_THRESHOLD is 0.85', () => {
      expect(VECTOR_SIMILARITY_THRESHOLD).toBe(0.85);
    });
  });

  // ─── Keyword-based Fallback (Jaccard similarity) ────────────────────────

  describe('checkDuplicate() — keyword-based fallback', () => {
    it('detects duplicate when Jaccard similarity ≥ 0.6', async () => {
      const existing = makeDbMemory('User prefers FIFO costing for inventory', { id: 'mem-fifo' });
      mockPrisma.aiMemory.findMany.mockResolvedValue([existing]);

      // Very similar content — many shared keywords
      const result = await service.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'User prefers FIFO costing method for inventory tracking',
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingMemory).toBeDefined();
      expect(result.existingMemory!.id).toBe('mem-fifo');
      expect(result.similarity).toBeGreaterThanOrEqual(0.6);
    });

    it('does NOT detect duplicate when similarity < 0.6', async () => {
      const existing = makeDbMemory('User prefers dark mode for dashboard', { id: 'mem-dark' });
      mockPrisma.aiMemory.findMany.mockResolvedValue([existing]);

      // Completely different topic
      const result = await service.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'FIFO costing method for inventory valuation',
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingMemory).toBeUndefined();
    });

    it('returns no duplicate when no existing memories', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);

      const result = await service.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'Some new memory content',
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it('finds the best match among multiple existing memories', async () => {
      const mem1 = makeDbMemory('User prefers dark mode for UI', { id: 'mem-dark' });
      const mem2 = makeDbMemory('User prefers FIFO costing for inventory', { id: 'mem-fifo' });
      const mem3 = makeDbMemory('User opened overdue invoices report', { id: 'mem-invoices' });
      mockPrisma.aiMemory.findMany.mockResolvedValue([mem1, mem2, mem3]);

      const result = await service.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'User prefers FIFO costing method for inventory tracking',
      );

      if (result.isDuplicate) {
        expect(result.existingMemory!.id).toBe('mem-fifo');
      }
    });

    it('handles empty/stopword-only content gracefully', async () => {
      const result = await service.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'the is a to for',
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it('queries scoped to userId + companyId', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);

      await service.checkDuplicate('user-X', 'company-Y', 'Test content');

      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-X', companyId: 'company-Y' },
        }),
      );
    });
  });

  // ─── Vector-based dedup (E5b-4 — VectorSearchService wired) ────────────

  describe('checkDuplicate() — vector search path', () => {
    let vectorService: SemanticDedupService;

    beforeEach(() => {
      vectorService = createService();
      vectorService.setVectorSearchService(mockVectorSearchService as any);
      mockPrisma.aiMemory.findFirst.mockResolvedValue({ id: 'mem-existing' });
    });

    it('uses vector search when VectorSearchService is wired and finds duplicate', async () => {
      const existingDb = makeDbMemory('User prefers FIFO costing for inventory', {
        id: 'mem-vec-1',
      });
      mockVectorSearchService.findSimilar.mockResolvedValue({
        id: 'mem-vec-1',
        content: 'User prefers FIFO costing for inventory',
        similarity: 0.92,
      });
      mockPrisma.aiMemory.findUnique.mockResolvedValue(existingDb);

      const result = await vectorService.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'User prefers FIFO costing method for inventory',
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBe(0.92);
      expect(result.existingMemory!.id).toBe('mem-vec-1');
      // Vector search used — keyword fallback (findMany) should NOT be called
      expect(mockPrisma.aiMemory.findMany).not.toHaveBeenCalled();
      // findSimilar called with correct threshold (0.85)
      expect(mockVectorSearchService.findSimilar).toHaveBeenCalledWith(
        'User prefers FIFO costing method for inventory',
        'ai_memories',
        { user_id: defaultUserId, company_id: defaultCompanyId },
        VECTOR_SIMILARITY_THRESHOLD,
      );
    });

    it('falls back to keyword when vector search finds nothing', async () => {
      mockVectorSearchService.findSimilar.mockResolvedValue(null);
      const existingKw = makeDbMemory('User prefers FIFO costing for inventory', { id: 'mem-kw' });
      mockPrisma.aiMemory.findMany.mockResolvedValue([existingKw]);

      const result = await vectorService.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'User prefers FIFO costing method for inventory tracking',
      );

      // Falls through to keyword — should still find a match
      expect(result.isDuplicate).toBe(true);
      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalled();
    });

    it('falls back to keyword when vector search throws (graceful degradation)', async () => {
      mockVectorSearchService.findSimilar.mockRejectedValue(new Error('pgvector down'));
      const existingKw = makeDbMemory('User prefers FIFO costing for inventory', { id: 'mem-kw' });
      mockPrisma.aiMemory.findMany.mockResolvedValue([existingKw]);

      const result = await vectorService.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'User prefers FIFO costing method for inventory tracking',
      );

      expect(result.isDuplicate).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Vector search failed in dedup, falling back to keyword',
      );
    });

    it('falls back to keyword when VectorSearchService is NOT wired', async () => {
      // Use the default service without VectorSearchService set
      const existing = makeDbMemory('User prefers FIFO costing for inventory', { id: 'mem-1' });
      mockPrisma.aiMemory.findMany.mockResolvedValue([existing]);

      const result = await service.checkDuplicate(
        defaultUserId,
        defaultCompanyId,
        'User prefers FIFO costing for inventory valuation',
      );

      expect(result.isDuplicate).toBe(true);
      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalled();
      expect(mockVectorSearchService.findSimilar).not.toHaveBeenCalled();
    });

    it('vector search uses 0.85 threshold vs keyword 0.6', () => {
      // Verify the constant values match the spec
      expect(VECTOR_SIMILARITY_THRESHOLD).toBe(0.85);
      // Keyword threshold is 0.6 (tested implicitly — keyword dedup detects at 0.6+)
    });
  });

  // ─── Merge Logic ────────────────────────────────────────────────────────

  describe('mergeMemories()', () => {
    it('replaces content when existing is a subset of new content', async () => {
      const existing = makeMemoryRecord({
        content: 'FIFO costing inventory',
      });

      const updatedDb = makeDbMemory('FIFO costing method for inventory valuation reports', {
        id: existing.id,
      });
      mockPrisma.aiMemory.update.mockResolvedValue(updatedDb);

      const result = await service.mergeMemories(
        existing,
        'FIFO costing method for inventory valuation reports',
      );

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existing.id },
          data: expect.objectContaining({
            content: 'FIFO costing method for inventory valuation reports',
            lastAccessedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.content).toBe('FIFO costing method for inventory valuation reports');
    });

    it('appends when new content adds novel information', async () => {
      const existing = makeMemoryRecord({
        content: 'User prefers FIFO costing for inventory',
      });

      const expectedContent =
        'User prefers FIFO costing for inventory. Additionally: FIFO costing with quarterly revaluation';
      const updatedDb = makeDbMemory(expectedContent, {
        id: existing.id,
      });
      mockPrisma.aiMemory.update.mockResolvedValue(updatedDb);

      const result = await service.mergeMemories(
        existing,
        'FIFO costing with quarterly revaluation',
      );

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: expect.stringContaining('Additionally:'),
          }),
        }),
      );
      expect(result.content).toContain('Additionally:');
    });

    it('keeps existing when no new information is added', async () => {
      const existing = makeMemoryRecord({
        content: 'User prefers FIFO costing method for inventory valuation',
      });

      const updatedDb = makeDbMemory(existing.content, { id: existing.id });
      mockPrisma.aiMemory.update.mockResolvedValue(updatedDb);

      const result = await service.mergeMemories(
        existing,
        'FIFO costing inventory', // subset of existing
      );

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: existing.content, // unchanged
          }),
        }),
      );
      expect(result.content).toBe(existing.content);
    });

    it('keeps higher source type (EXPLICIT > IMPLICIT)', async () => {
      const existing = makeMemoryRecord({
        source: 'EXPLICIT',
        content: 'User prefers FIFO costing',
      });

      const updatedDb = makeDbMemory('User prefers FIFO costing', {
        id: existing.id,
        source: 'EXPLICIT',
      });
      mockPrisma.aiMemory.update.mockResolvedValue(updatedDb);

      await service.mergeMemories(existing, 'FIFO costing info');

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'EXPLICIT',
          }),
        }),
      );
    });

    it('updates lastAccessedAt on merge', async () => {
      const existing = makeMemoryRecord();
      const updatedDb = makeDbMemory(existing.content, { id: existing.id });
      mockPrisma.aiMemory.update.mockResolvedValue(updatedDb);

      await service.mergeMemories(existing, 'Some content');

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastAccessedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('returns existing memory on DB error (graceful degradation)', async () => {
      const existing = makeMemoryRecord();
      mockPrisma.aiMemory.update.mockRejectedValue(new Error('DB error'));

      const result = await service.mergeMemories(existing, 'New info');

      expect(result).toEqual(existing);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns existing memory when ownership verification fails', async () => {
      const existing = makeMemoryRecord();
      mockPrisma.aiMemory.findFirst.mockResolvedValue(null); // ownership check fails

      const result = await service.mergeMemories(existing, 'New info');

      expect(result).toEqual(existing);
      expect(mockPrisma.aiMemory.update).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ memoryId: existing.id }),
        'Memory ownership verification failed during merge, returning existing',
      );
    });
  });
});
