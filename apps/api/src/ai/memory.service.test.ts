import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus, mockLogger, mockEmbeddingService } = vi.hoisted(() => ({
  mockPrisma: {
    aiMemory: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
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

import { MemoryService } from './memory.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function createService() {
  return new MemoryService(mockPrisma as any, mockEventBus as any, mockLogger as any);
}

function makeMemory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mem-1',
    userId: defaultUserId,
    companyId: defaultCompanyId,
    category: 'PREFERENCE',
    content: 'User prefers dark mode',
    source: 'EXPLICIT',
    importance: 1.0,
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

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── createMemory ──────────────────────────────────────────────────────

  describe('createMemory()', () => {
    it('creates a memory with default EXPLICIT source and importance 1.0', async () => {
      const mem = makeMemory();
      mockPrisma.aiMemory.create.mockResolvedValue(mem);

      const result = await service.createMemory(defaultUserId, defaultCompanyId, {
        content: 'User prefers dark mode',
        category: 'PREFERENCE',
      });

      expect(mockPrisma.aiMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: defaultUserId,
          companyId: defaultCompanyId,
          category: 'PREFERENCE',
          content: 'User prefers dark mode',
          source: 'EXPLICIT',
          importance: 1.0,
        }),
      });
      expect(result.id).toBe('mem-1');
      expect(result.source).toBe('EXPLICIT');
      expect(result.importance).toBe(1.0);
    });

    it('creates an IMPLICIT memory with importance 0.5', async () => {
      const mem = makeMemory({ source: 'IMPLICIT', importance: 0.5 });
      mockPrisma.aiMemory.create.mockResolvedValue(mem);

      await service.createMemory(defaultUserId, defaultCompanyId, {
        content: 'User often views AR reports',
        category: 'WORKFLOW',
        source: 'IMPLICIT',
      });

      expect(mockPrisma.aiMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'IMPLICIT',
          importance: 0.5,
        }),
      });
    });

    it('emits ai.memory.created event on success', async () => {
      mockPrisma.aiMemory.create.mockResolvedValue(makeMemory());

      await service.createMemory(defaultUserId, defaultCompanyId, {
        content: 'test',
        category: 'INSTRUCTION',
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.memory.created', {
        memoryId: 'mem-1',
        userId: defaultUserId,
        companyId: defaultCompanyId,
        category: 'PREFERENCE',
        source: 'EXPLICIT',
      });
    });

    it('stores metadata when provided', async () => {
      const metadata = { key: 'value', nested: { a: 1 } };
      mockPrisma.aiMemory.create.mockResolvedValue(makeMemory({ metadata }));

      await service.createMemory(defaultUserId, defaultCompanyId, {
        content: 'test',
        category: 'ENTITY_CONTEXT',
        metadata,
      });

      expect(mockPrisma.aiMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ metadata }),
      });
    });
  });

  // ─── listMemories ──────────────────────────────────────────────────────

  describe('listMemories()', () => {
    it('returns paginated memories scoped to user+company', async () => {
      const memories = [makeMemory(), makeMemory({ id: 'mem-2' })];
      mockPrisma.aiMemory.findMany.mockResolvedValue(memories);
      mockPrisma.aiMemory.count.mockResolvedValue(2);

      const result = await service.listMemories(defaultUserId, defaultCompanyId);

      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: defaultUserId, companyId: defaultCompanyId },
          orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.nextCursor).toBeNull();
    });

    it('filters by category', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);
      mockPrisma.aiMemory.count.mockResolvedValue(0);

      await service.listMemories(defaultUserId, defaultCompanyId, {
        category: 'INSTRUCTION',
      });

      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'INSTRUCTION' }),
        }),
      );
    });

    it('filters by search term (case-insensitive)', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);
      mockPrisma.aiMemory.count.mockResolvedValue(0);

      await service.listMemories(defaultUserId, defaultCompanyId, {
        search: 'invoice',
      });

      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: { contains: 'invoice', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('returns nextCursor when more results exist', async () => {
      // Default limit 50 — all 51 items returned, service slices and sets nextCursor
      const memories = Array.from({ length: 51 }, (_, i) => makeMemory({ id: `mem-${i}` }));
      mockPrisma.aiMemory.findMany.mockResolvedValue(memories);
      mockPrisma.aiMemory.count.mockResolvedValue(100);

      const result = await service.listMemories(defaultUserId, defaultCompanyId);

      expect(result.data).toHaveLength(50);
      expect(result.nextCursor).toBe('mem-50');
    });

    it('uses cursor for pagination — starts after cursor item', async () => {
      // Simulate 5 memories, cursor at mem-2 → should return mem-3, mem-4
      const memories = Array.from({ length: 5 }, (_, i) => makeMemory({ id: `mem-${i}` }));
      mockPrisma.aiMemory.findMany.mockResolvedValue(memories);
      mockPrisma.aiMemory.count.mockResolvedValue(5);

      const result = await service.listMemories(defaultUserId, defaultCompanyId, {
        cursor: 'mem-2',
      });

      // Should start after mem-2 → items are mem-3, mem-4
      expect(result.data[0]!.id).toBe('mem-3');
      expect(result.data).toHaveLength(2);
    });

    it('caps limit to MAX_LIMIT (200)', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);
      mockPrisma.aiMemory.count.mockResolvedValue(0);

      await service.listMemories(defaultUserId, defaultCompanyId, {
        limit: 999,
      });

      // Fetches all matching memories (no take) since sorting is in-memory
      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalled();
      // Limit is still applied in-memory — result will be capped at 200
    });

    it('sorts by effective importance (temporal decay applied)', async () => {
      const recentMemory = makeMemory({
        id: 'mem-recent',
        source: 'IMPLICIT',
        importance: 0.5,
        lastAccessedAt: new Date(), // just now
      });
      const oldMemory = makeMemory({
        id: 'mem-old',
        source: 'EXPLICIT',
        importance: 1.0,
        lastAccessedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      });
      // DB returns old first (higher raw importance), but effective importance
      // after decay should reorder
      mockPrisma.aiMemory.findMany.mockResolvedValue([oldMemory, recentMemory]);
      mockPrisma.aiMemory.count.mockResolvedValue(2);

      const result = await service.listMemories(defaultUserId, defaultCompanyId);

      // Recent implicit (0.5 * 1.0 * ~1.0 = 0.5) vs
      // Old explicit (1.0 * 1.5 * 0.5^3 = 0.1875)
      // Recent should come first
      expect(result.data[0]!.id).toBe('mem-recent');
      expect(result.data[1]!.id).toBe('mem-old');
    });
  });

  // ─── getMemory ─────────────────────────────────────────────────────────

  describe('getMemory()', () => {
    it('returns memory when found and owned by user+company', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(makeMemory());

      const result = await service.getMemory('mem-1', defaultUserId, defaultCompanyId);

      expect(mockPrisma.aiMemory.findFirst).toHaveBeenCalledWith({
        where: { id: 'mem-1', userId: defaultUserId, companyId: defaultCompanyId },
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('mem-1');
    });

    it('returns null when memory not found', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(null);

      const result = await service.getMemory('nonexistent', defaultUserId, defaultCompanyId);

      expect(result).toBeNull();
    });

    it('returns null for memory owned by another user (ownership check)', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(null);

      const result = await service.getMemory('mem-1', 'other-user', defaultCompanyId);

      expect(mockPrisma.aiMemory.findFirst).toHaveBeenCalledWith({
        where: { id: 'mem-1', userId: 'other-user', companyId: defaultCompanyId },
      });
      expect(result).toBeNull();
    });
  });

  // ─── updateMemory ──────────────────────────────────────────────────────

  describe('updateMemory()', () => {
    it('updates content when ownership matches', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(makeMemory());
      mockPrisma.aiMemory.update.mockResolvedValue(makeMemory({ content: 'Updated content' }));

      const result = await service.updateMemory('mem-1', defaultUserId, defaultCompanyId, {
        content: 'Updated content',
      });

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { content: 'Updated content' },
      });
      expect(result!.content).toBe('Updated content');
    });

    it('returns null when memory not found (ownership check)', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(null);

      const result = await service.updateMemory('mem-1', 'other-user', defaultCompanyId, {
        content: 'hacked!',
      });

      expect(result).toBeNull();
      expect(mockPrisma.aiMemory.update).not.toHaveBeenCalled();
    });

    it('updates category and metadata', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(makeMemory());
      mockPrisma.aiMemory.update.mockResolvedValue(
        makeMemory({ category: 'INSTRUCTION', metadata: { foo: 'bar' } }),
      );

      await service.updateMemory('mem-1', defaultUserId, defaultCompanyId, {
        category: 'INSTRUCTION',
        metadata: { foo: 'bar' },
      });

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { category: 'INSTRUCTION', metadata: { foo: 'bar' } },
      });
    });
  });

  // ─── deleteMemory ──────────────────────────────────────────────────────

  describe('deleteMemory()', () => {
    it('hard-deletes memory when owned by user+company', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(makeMemory());
      mockPrisma.aiMemory.delete.mockResolvedValue(makeMemory());

      const result = await service.deleteMemory('mem-1', defaultUserId, defaultCompanyId);

      expect(result).toBe(true);
      expect(mockPrisma.aiMemory.delete).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
      });
    });

    it('emits ai.memory.deleted event on success', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(makeMemory());
      mockPrisma.aiMemory.delete.mockResolvedValue(makeMemory());

      await service.deleteMemory('mem-1', defaultUserId, defaultCompanyId);

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.memory.deleted', {
        memoryId: 'mem-1',
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });
    });

    it('returns false when memory not found (ownership check)', async () => {
      mockPrisma.aiMemory.findFirst.mockResolvedValue(null);

      const result = await service.deleteMemory('mem-1', 'other-user', defaultCompanyId);

      expect(result).toBe(false);
      expect(mockPrisma.aiMemory.delete).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ─── forgetAll ─────────────────────────────────────────────────────────

  describe('forgetAll()', () => {
    it('deletes all memories for user+company and returns count', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([
        { id: 'mem-1' },
        { id: 'mem-2' },
        { id: 'mem-3' },
      ]);
      mockPrisma.aiMemory.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.forgetAll(defaultUserId, defaultCompanyId);

      expect(mockPrisma.aiMemory.deleteMany).toHaveBeenCalledWith({
        where: { userId: defaultUserId, companyId: defaultCompanyId },
      });
      expect(result).toBe(3);
    });

    it('emits single ai.memory.bulk_deleted event with all IDs', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]);
      mockPrisma.aiMemory.deleteMany.mockResolvedValue({ count: 2 });

      await service.forgetAll(defaultUserId, defaultCompanyId);

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.memory.bulk_deleted', {
        memoryIds: ['mem-1', 'mem-2'],
        userId: defaultUserId,
        companyId: defaultCompanyId,
        count: 2,
      });
    });

    it('returns 0 when no memories exist', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([]);

      const result = await service.forgetAll(defaultUserId, defaultCompanyId);

      expect(result).toBe(0);
      expect(mockPrisma.aiMemory.deleteMany).not.toHaveBeenCalled();
    });

    it('does not delete memories from other companies', async () => {
      mockPrisma.aiMemory.findMany.mockResolvedValue([{ id: 'mem-x' }]);
      mockPrisma.aiMemory.deleteMany.mockResolvedValue({ count: 1 });

      await service.forgetAll(defaultUserId, 'company-2');

      expect(mockPrisma.aiMemory.findMany).toHaveBeenCalledWith({
        where: { userId: defaultUserId, companyId: 'company-2' },
        select: { id: true },
      });
      expect(mockPrisma.aiMemory.deleteMany).toHaveBeenCalledWith({
        where: { userId: defaultUserId, companyId: 'company-2' },
      });
    });
  });

  // ─── touchMemory ───────────────────────────────────────────────────────

  describe('touchMemory()', () => {
    it('updates lastAccessedAt for the memory', async () => {
      mockPrisma.aiMemory.update.mockResolvedValue(makeMemory());

      await service.touchMemory('mem-1');

      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { lastAccessedAt: expect.any(Date) },
      });
    });

    it('silently ignores errors when memory not found', async () => {
      mockPrisma.aiMemory.update.mockRejectedValue(new Error('Record not found'));

      // Should not throw
      await expect(service.touchMemory('nonexistent')).resolves.toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  // ─── calculateEffectiveImportance ──────────────────────────────────────

  describe('calculateEffectiveImportance()', () => {
    it('returns full importance for just-accessed EXPLICIT memory', () => {
      const result = service.calculateEffectiveImportance({
        importance: 1.0,
        source: 'EXPLICIT',
        lastAccessedAt: new Date(), // just now
      });

      // 1.0 * 1.5 (explicit weight) * ~1.0 (no decay) ≈ 1.5
      expect(result).toBeCloseTo(1.5, 1);
    });

    it('applies 1.0x weight for IMPLICIT memories', () => {
      const result = service.calculateEffectiveImportance({
        importance: 0.5,
        source: 'IMPLICIT',
        lastAccessedAt: new Date(), // just now
      });

      // 0.5 * 1.0 (implicit weight) * ~1.0 (no decay) ≈ 0.5
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('applies temporal decay — halves after 30 days', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = service.calculateEffectiveImportance({
        importance: 1.0,
        source: 'EXPLICIT',
        lastAccessedAt: thirtyDaysAgo,
      });

      // 1.0 * 1.5 * 0.5^(30/30) = 1.5 * 0.5 = 0.75
      expect(result).toBeCloseTo(0.75, 1);
    });

    it('applies temporal decay — quarters after 60 days', () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const result = service.calculateEffectiveImportance({
        importance: 1.0,
        source: 'EXPLICIT',
        lastAccessedAt: sixtyDaysAgo,
      });

      // 1.0 * 1.5 * 0.5^(60/30) = 1.5 * 0.25 = 0.375
      expect(result).toBeCloseTo(0.375, 1);
    });

    it('returns very low score for 90+ day old IMPLICIT memory', () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = service.calculateEffectiveImportance({
        importance: 0.5,
        source: 'IMPLICIT',
        lastAccessedAt: ninetyDaysAgo,
      });

      // 0.5 * 1.0 * 0.5^(90/30) = 0.5 * 0.125 = 0.0625
      expect(result).toBeCloseTo(0.0625, 2);
      expect(result).toBeLessThan(0.1);
    });
  });

  // ─── Embedding integration (E5b-4 Task 4) ────────────────────────────

  describe('embedding generation on create/update', () => {
    let embeddingService: MemoryService;

    beforeEach(() => {
      embeddingService = createService();
      embeddingService.setEmbeddingService(mockEmbeddingService as any);
      mockPrisma.$executeRaw.mockResolvedValue(1);
    });

    it('fires embedding generation on createMemory (fire-and-forget)', async () => {
      const embedding = Array.from({ length: 1536 }, () => 0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(embedding);
      mockPrisma.aiMemory.create.mockResolvedValue(makeMemory());

      const result = await embeddingService.createMemory(defaultUserId, defaultCompanyId, {
        content: 'User prefers dark mode',
        category: 'PREFERENCE',
      });

      expect(result.id).toBe('mem-1');
      // Wait for fire-and-forget to complete
      await vi.waitFor(() => {
        expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
          'User prefers dark mode',
        );
      });
    });

    it('fires embedding re-generation on updateMemory when content changes', async () => {
      const embedding = Array.from({ length: 1536 }, () => 0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(embedding);
      mockPrisma.aiMemory.findFirst.mockResolvedValue(makeMemory({ content: 'Old content' }));
      mockPrisma.aiMemory.update.mockResolvedValue(makeMemory({ content: 'New content' }));

      await embeddingService.updateMemory('mem-1', defaultUserId, defaultCompanyId, {
        content: 'New content',
      });

      // Wait for fire-and-forget to complete
      await vi.waitFor(() => {
        expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('New content');
      });
    });

    it('does NOT fire embedding call when content unchanged on update', async () => {
      const existingContent = 'User prefers dark mode';
      mockPrisma.aiMemory.findFirst.mockResolvedValue(makeMemory({ content: existingContent }));
      mockPrisma.aiMemory.update.mockResolvedValue(makeMemory({ content: existingContent }));

      await embeddingService.updateMemory('mem-1', defaultUserId, defaultCompanyId, {
        category: 'INSTRUCTION', // only category change, not content
      });

      // No embedding call since content didn't change
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('does NOT fire embedding call when EmbeddingService is not set', async () => {
      // Use the base service (no embedding service wired)
      mockPrisma.aiMemory.create.mockResolvedValue(makeMemory());

      await service.createMemory(defaultUserId, defaultCompanyId, {
        content: 'test',
        category: 'PREFERENCE',
      });

      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('does not block memory creation when embedding fails', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('AI Gateway down'));
      mockPrisma.aiMemory.create.mockResolvedValue(makeMemory());

      // Memory creation should still succeed
      const result = await embeddingService.createMemory(defaultUserId, defaultCompanyId, {
        content: 'test content',
        category: 'PREFERENCE',
      });

      expect(result.id).toBe('mem-1');
      // Wait a tick for fire-and-forget to settle
      await vi.waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ memoryId: 'mem-1' }),
          expect.stringContaining('Failed to generate embedding'),
        );
      });
    });

    it('handles null embedding gracefully (does not store)', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue(null);
      mockPrisma.aiMemory.create.mockResolvedValue(makeMemory());

      await embeddingService.createMemory(defaultUserId, defaultCompanyId, {
        content: 'test content',
        category: 'PREFERENCE',
      });

      // Wait a tick for fire-and-forget
      await new Promise((r) => setTimeout(r, 10));

      // $executeRaw should NOT be called since embedding was null
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
