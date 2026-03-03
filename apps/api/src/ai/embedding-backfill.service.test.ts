import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockEmbeddingService } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockEmbeddingService: {
    generateEmbeddings: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { EmbeddingBackfillService } from './embedding-backfill.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new EmbeddingBackfillService(
    mockPrisma as any,
    mockLogger as any,
    mockEmbeddingService as any,
  );
}

const FAKE_EMBEDDING = Array.from({ length: 1536 }, (_, i) => i * 0.001);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbeddingBackfillService', () => {
  let service: EmbeddingBackfillService;

  beforeEach(() => {
    mockPrisma.$queryRaw.mockReset();
    mockPrisma.$executeRaw.mockReset();
    mockEmbeddingService.generateEmbeddings.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();
    service = createService();
    // Mock the internal delay method so tests run instantly
    (service as any).delay = vi.fn().mockResolvedValue(undefined);
  });

  // ─── Backfill processes only NULL embedding memories ──────────────────

  describe('backfillMemoryEmbeddings()', () => {
    it('processes only memories with NULL embedding', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([
          { id: 'mem-1', content: 'Memory one' },
          { id: 'mem-2', content: 'Memory two' },
        ])
        .mockResolvedValueOnce([]);

      mockEmbeddingService.generateEmbeddings.mockResolvedValue([FAKE_EMBEDDING, FAKE_EMBEDDING]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await service.backfillMemoryEmbeddings(50);

      expect(result.total).toBe(2);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('returns no-op result when no memories need backfill', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.backfillMemoryEmbeddings();

      expect(result.total).toBe(0);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockEmbeddingService.generateEmbeddings).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('no memories need backfill'),
      );
    });

    it('handles partial batch failures — some embeddings fail, others succeed', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([
          { id: 'mem-1', content: 'Memory one' },
          { id: 'mem-2', content: 'Memory two' },
          { id: 'mem-3', content: 'Memory three' },
        ])
        .mockResolvedValueOnce([]);

      // Second embedding fails (null)
      mockEmbeddingService.generateEmbeddings.mockResolvedValue([
        FAKE_EMBEDDING,
        null,
        FAKE_EMBEDDING,
      ]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await service.backfillMemoryEmbeddings(50);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('is idempotent — re-running skips already-embedded memories', async () => {
      // First run: 2 memories to process
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([
          { id: 'mem-1', content: 'Memory one' },
          { id: 'mem-2', content: 'Memory two' },
        ])
        .mockResolvedValueOnce([]);

      mockEmbeddingService.generateEmbeddings.mockResolvedValue([FAKE_EMBEDDING, FAKE_EMBEDDING]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result1 = await service.backfillMemoryEmbeddings(50);
      expect(result1.processed).toBe(2);

      // Second run: 0 memories to process (all have embeddings now)
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result2 = await service.backfillMemoryEmbeddings(50);
      expect(result2.total).toBe(0);
      expect(result2.processed).toBe(0);
    });

    it('handles DB error when storing individual embedding', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([
          { id: 'mem-1', content: 'Memory one' },
          { id: 'mem-2', content: 'Memory two' },
        ])
        .mockResolvedValueOnce([]);

      mockEmbeddingService.generateEmbeddings.mockResolvedValue([FAKE_EMBEDDING, FAKE_EMBEDDING]);
      mockPrisma.$executeRaw
        .mockResolvedValueOnce(1) // mem-1 succeeds
        .mockRejectedValueOnce(new Error('DB write error')); // mem-2 fails

      const result = await service.backfillMemoryEmbeddings(50);

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ memoryId: 'mem-2' }),
        expect.stringContaining('failed to store embedding'),
      );
    });

    it('processes multiple batches with rate limiting', async () => {
      // Batch 1: full batch of 50, Batch 2: partial batch of 10
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(60) }])
        .mockResolvedValueOnce(
          Array.from({ length: 50 }, (_, i) => ({ id: `mem-${i}`, content: `Memory ${i}` })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 10 }, (_, i) => ({
            id: `mem-${50 + i}`,
            content: `Memory ${50 + i}`,
          })),
        )
        .mockResolvedValueOnce([]); // empty = end

      // First batch returns 50 embeddings, second batch returns 10
      mockEmbeddingService.generateEmbeddings
        .mockResolvedValueOnce(Array.from({ length: 50 }, () => FAKE_EMBEDDING))
        .mockResolvedValueOnce(Array.from({ length: 10 }, () => FAKE_EMBEDDING));
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await service.backfillMemoryEmbeddings(50);

      expect(result.total).toBe(60);
      expect(result.processed).toBe(60);
      expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalledTimes(2);
      // Rate-limit delay called between batches (batch1 is full size = batchSize)
      expect((service as any).delay).toHaveBeenCalledWith(500);
    });
  });
});
