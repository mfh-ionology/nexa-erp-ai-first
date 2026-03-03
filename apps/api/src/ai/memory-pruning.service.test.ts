import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockMemoryService, mockQueue, mockWorker } = vi.hoisted(() => {
  const mockQueue = {
    add: vi.fn(),
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    client: Promise.resolve({}),
  };

  const mockWorker = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockPrisma: {
      aiMemorySettings: {
        findMany: vi.fn(),
      },
      aiMemory: {
        count: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
        groupBy: vi.fn(),
      },
      $executeRawUnsafe: vi.fn(),
    },
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    mockMemoryService: {
      calculateEffectiveImportance: vi.fn(),
    },
    mockQueue,
    mockWorker,
  };
});

// Mock BullMQ — capture the worker processor function so we can invoke it
let capturedWorkerProcessor: ((job: any) => Promise<void>) | null = null;

vi.mock('bullmq', () => {
  return {
    Queue: class MockQueue {
      constructor() {
        return mockQueue;
      }
    },
    Worker: class MockWorker {
      constructor(_name: string, processor: any) {
        capturedWorkerProcessor = processor;
        Object.assign(this, mockWorker);
        // Immediately register event handlers like the real Worker
        return mockWorker as any;
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { MemoryPruningService } from './memory-pruning.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new MemoryPruningService(mockMemoryService as any, mockPrisma as any, mockLogger as any, {
    host: 'localhost',
    port: 6379,
  });
}

function makeMemoryCandidate(
  id: string,
  opts: {
    importance?: number;
    source?: string;
    daysAgo?: number;
    createdDaysAgo?: number;
    metadata?: Record<string, unknown> | null;
  } = {},
) {
  const lastAccessed = new Date();
  lastAccessed.setDate(lastAccessed.getDate() - (opts.daysAgo ?? 100));
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - (opts.createdDaysAgo ?? opts.daysAgo ?? 100));
  return {
    id,
    importance: opts.importance ?? 0.3,
    source: opts.source ?? 'IMPLICIT',
    lastAccessedAt: lastAccessed,
    createdAt,
    metadata: opts.metadata ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryPruningService', () => {
  let service: MemoryPruningService;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedWorkerProcessor = null;
    service = createService();
  });

  // ─── Constructor / scheduling ──────────────────────────────────────────

  describe('constructor', () => {
    it('creates a BullMQ Queue and Worker', () => {
      expect(service).toBeDefined();
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('schedules a repeatable job', async () => {
      // scheduleRepeatable is called in constructor via void promise
      // Give it a tick to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(mockQueue.add).toHaveBeenCalledWith(
        'memory-pruning-trigger',
        expect.objectContaining({ scheduledAt: expect.any(String) }),
        expect.objectContaining({
          repeat: { pattern: '0 2 * * *' },
        }),
      );
    });
  });

  // ─── Pruning logic ─────────────────────────────────────────────────────

  describe('runPruning (via worker processor)', () => {
    it('hard-deletes low-importance memories exceeding retentionDays', async () => {
      // User has settings with maxMemories=100, retentionDays=90
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          companyId: 'company-1',
          maxMemories: 100,
          retentionDays: 90,
          decayHalfLifeDays: 30,
        },
      ]);

      // User has 150 memories (exceeds limit)
      mockPrisma.aiMemory.count.mockResolvedValue(150);

      // Candidates: old memories created > 90 days ago (exceeds retentionDays → hard delete path)
      const candidate1 = makeMemoryCandidate('mem-1', { daysAgo: 100, createdDaysAgo: 120 });
      const candidate2 = makeMemoryCandidate('mem-2', { daysAgo: 120, createdDaysAgo: 150 });
      mockPrisma.aiMemory.findMany.mockResolvedValue([candidate1, candidate2]);

      // All candidates have low effective importance
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(0.05);

      // deleteMany result
      mockPrisma.aiMemory.deleteMany.mockResolvedValue({ count: 2 });

      // No additional users without settings
      mockPrisma.aiMemory.groupBy.mockResolvedValue([]);

      // Invoke the worker processor
      expect(capturedWorkerProcessor).not.toBeNull();
      await capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } });

      expect(mockPrisma.aiMemory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['mem-1', 'mem-2'] } },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ memoriesDeleted: 2, usersProcessed: 1 }),
        'MemoryPruningService: pruning run complete',
      );
    });

    it('archives (not deletes) low-importance memories within retentionDays', async () => {
      // retentionDays=365 — memories created 100 days ago are WITHIN retention
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          companyId: 'company-1',
          maxMemories: 100,
          retentionDays: 365,
          decayHalfLifeDays: 30,
        },
      ]);

      mockPrisma.aiMemory.count.mockResolvedValue(150);

      // Created 100 days ago (within 365-day retention) but low importance and last accessed 100 days ago
      const candidate = makeMemoryCandidate('mem-archive', {
        daysAgo: 100,
        createdDaysAgo: 100,
        metadata: null,
      });
      mockPrisma.aiMemory.findMany.mockResolvedValue([candidate]);

      // Low effective importance (below 0.1 threshold)
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(0.05);

      // Mock the archive update
      mockPrisma.aiMemory.update.mockResolvedValue({ ...candidate, metadata: { archived: true } });
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      mockPrisma.aiMemory.groupBy.mockResolvedValue([]);

      await capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } });

      // Should archive (update metadata) not hard-delete
      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem-archive' },
        data: {
          metadata: expect.objectContaining({
            archived: true,
            archivedAt: expect.any(String),
          }),
        },
      });
      // Embedding cleared via raw SQL
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'UPDATE ai_memories SET embedding = NULL WHERE id = $1',
        'mem-archive',
      );
      // deleteMany should NOT have been called (within retention)
      expect(mockPrisma.aiMemory.deleteMany).not.toHaveBeenCalled();
    });

    it('skips already-archived memories during archive phase', async () => {
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          companyId: 'company-1',
          maxMemories: 100,
          retentionDays: 365,
          decayHalfLifeDays: 30,
        },
      ]);

      mockPrisma.aiMemory.count.mockResolvedValue(150);

      // Already archived memory (metadata.archived = true)
      const candidate = makeMemoryCandidate('mem-already-archived', {
        daysAgo: 100,
        createdDaysAgo: 100,
        metadata: { archived: true, archivedAt: '2026-01-01T00:00:00Z' },
      });
      mockPrisma.aiMemory.findMany.mockResolvedValue([candidate]);

      mockMemoryService.calculateEffectiveImportance.mockReturnValue(0.05);
      mockPrisma.aiMemory.groupBy.mockResolvedValue([]);

      await capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } });

      // Should NOT archive again (already archived)
      expect(mockPrisma.aiMemory.update).not.toHaveBeenCalled();
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
      expect(mockPrisma.aiMemory.deleteMany).not.toHaveBeenCalled();
    });

    it('does not prune when user is under their memory limit', async () => {
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([
        { userId: 'user-1', companyId: 'company-1', maxMemories: 500, retentionDays: 365 },
      ]);
      mockPrisma.aiMemory.count.mockResolvedValue(50); // well under limit
      mockPrisma.aiMemory.groupBy.mockResolvedValue([]);

      await capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } });

      expect(mockPrisma.aiMemory.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.aiMemory.deleteMany).not.toHaveBeenCalled();
    });

    it('does not prune memories with high effective importance', async () => {
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([
        { userId: 'user-1', companyId: 'company-1', maxMemories: 100, retentionDays: 365 },
      ]);
      mockPrisma.aiMemory.count.mockResolvedValue(150);

      const candidate = makeMemoryCandidate('mem-1', { daysAgo: 100 });
      mockPrisma.aiMemory.findMany.mockResolvedValue([candidate]);

      // Importance is above threshold (0.1)
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(0.5);

      mockPrisma.aiMemory.groupBy.mockResolvedValue([]);

      await capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } });

      // No deletion because all candidates have high importance
      expect(mockPrisma.aiMemory.deleteMany).not.toHaveBeenCalled();
    });

    it('prunes users without settings using default 500 limit', async () => {
      // No explicit settings
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([]);

      // One user+company pair exceeding default 500 limit
      mockPrisma.aiMemory.groupBy.mockResolvedValue([
        { userId: 'user-2', companyId: 'company-1', _count: { id: 600 } },
      ]);

      mockPrisma.aiMemory.count.mockResolvedValue(600);

      // createdDaysAgo must exceed default retentionDays (365) to trigger hard-delete path
      const candidate = makeMemoryCandidate('mem-old', { daysAgo: 100, createdDaysAgo: 400 });
      mockPrisma.aiMemory.findMany.mockResolvedValue([candidate]);
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(0.02);
      mockPrisma.aiMemory.deleteMany.mockResolvedValue({ count: 1 });

      await capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } });

      expect(mockPrisma.aiMemory.deleteMany).toHaveBeenCalled();
    });

    it('skips users without settings who are under 500 limit', async () => {
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([]);
      mockPrisma.aiMemory.groupBy.mockResolvedValue([
        { userId: 'user-2', companyId: 'company-1', _count: { id: 200 } },
      ]);

      await capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } });

      expect(mockPrisma.aiMemory.count).not.toHaveBeenCalled();
      expect(mockPrisma.aiMemory.deleteMany).not.toHaveBeenCalled();
    });

    it('handles errors gracefully for individual users', async () => {
      mockPrisma.aiMemorySettings.findMany.mockResolvedValue([
        { userId: 'user-1', companyId: 'company-1', maxMemories: 100, retentionDays: 365 },
      ]);
      mockPrisma.aiMemory.count.mockRejectedValue(new Error('DB error'));
      mockPrisma.aiMemory.groupBy.mockResolvedValue([]);

      // Should not throw — logs warning and continues
      await expect(
        capturedWorkerProcessor!({ data: { scheduledAt: new Date().toISOString() } }),
      ).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', error: 'DB error' }),
        'MemoryPruningService: failed to prune memories for user',
      );
    });
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  describe('close()', () => {
    it('closes worker and queue', async () => {
      await service.close();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});
