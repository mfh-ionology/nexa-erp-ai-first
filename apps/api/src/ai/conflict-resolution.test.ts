import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockMemoryService, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiMemorySettings: {
      findUnique: vi.fn(),
    },
    aiMemory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    aiConversationSummary: {
      findMany: vi.fn(),
    },
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
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  MemoryInjectionService,
  type MemoryConflict as _MemoryConflict,
} from './memory-injection.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function createService() {
  return new MemoryInjectionService(mockPrisma as any, mockMemoryService as any, mockLogger as any);
}

function makeScoredMemory(overrides: Record<string, unknown> = {}) {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 8)}`,
    category: 'PREFERENCE',
    content: 'User prefers Net 30 payment terms',
    source: 'EXPLICIT',
    effectiveImportance: 1.0,
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    ...overrides,
  };
}

function makeDbMemory(category: string, content: string, overrides: Record<string, unknown> = {}) {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryInjectionService — Conflict Resolution (E5b-3 Task 4)', () => {
  let service: MemoryInjectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
    mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);
  });

  // ─── Explicit overrides Implicit (AC #4) ───────────────────────────────

  describe('resolveConflicts() — explicit overrides implicit', () => {
    it('EXPLICIT memory wins over IMPLICIT when on same topic', () => {
      // Need Jaccard > 0.7: 5 shared keywords, 1 unique each → 5/7 = 0.71
      const explicit = makeScoredMemory({
        id: 'mem-explicit',
        category: 'PREFERENCE',
        content: 'FIFO costing method inventory valuation reporting quarterly',
        source: 'EXPLICIT',
        effectiveImportance: 1.5,
      });
      const implicit = makeScoredMemory({
        id: 'mem-implicit',
        category: 'PREFERENCE',
        content: 'LIFO costing method inventory valuation reporting quarterly',
        source: 'IMPLICIT',
        effectiveImportance: 0.5,
      });

      const { resolved, conflicts } = service.resolveConflicts([explicit, implicit]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.id).toBe('mem-explicit');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.winnerId).toBe('mem-explicit');
      expect(conflicts[0]!.loserId).toBe('mem-implicit');
      expect(conflicts[0]!.reason).toBe('EXPLICIT_OVER_IMPLICIT');
    });

    it('EXPLICIT wins regardless of importance score', () => {
      const explicit = makeScoredMemory({
        id: 'mem-explicit',
        category: 'INSTRUCTION',
        content: 'FIFO costing method inventory valuation reporting quarterly',
        source: 'EXPLICIT',
        effectiveImportance: 0.2,
      });
      const implicit = makeScoredMemory({
        id: 'mem-implicit',
        category: 'INSTRUCTION',
        content: 'LIFO costing method inventory valuation reporting quarterly',
        source: 'IMPLICIT',
        effectiveImportance: 5.0,
      });

      const { resolved, conflicts } = service.resolveConflicts([explicit, implicit]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.id).toBe('mem-explicit');
      expect(conflicts[0]!.reason).toBe('EXPLICIT_OVER_IMPLICIT');
    });
  });

  // ─── Newer overrides Older (same source) ───────────────────────────────

  describe('resolveConflicts() — newer overrides older (same source)', () => {
    it('newer memory wins when both are EXPLICIT', () => {
      // High overlap: 5 shared / 7 total = 0.71 > 0.7 threshold
      const older = makeScoredMemory({
        id: 'mem-older',
        category: 'PREFERENCE',
        content: 'payment terms invoicing customer billing monthly thirty',
        source: 'EXPLICIT',
        effectiveImportance: 1.0,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const newer = makeScoredMemory({
        id: 'mem-newer',
        category: 'PREFERENCE',
        content: 'payment terms invoicing customer billing monthly sixty',
        source: 'EXPLICIT',
        effectiveImportance: 1.0,
        updatedAt: new Date('2026-02-15T00:00:00.000Z'),
      });

      const { resolved, conflicts } = service.resolveConflicts([older, newer]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.id).toBe('mem-newer');
      expect(conflicts[0]!.reason).toBe('NEWER_OVER_OLDER');
    });

    it('newer memory wins when both are IMPLICIT', () => {
      const older = makeScoredMemory({
        id: 'mem-older',
        category: 'PREFERENCE',
        content: 'LIFO inventory report valuation tracking scheduled batch',
        source: 'IMPLICIT',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const newer = makeScoredMemory({
        id: 'mem-newer',
        category: 'PREFERENCE',
        content: 'FIFO inventory report valuation tracking scheduled batch',
        source: 'IMPLICIT',
        updatedAt: new Date('2026-02-20T00:00:00.000Z'),
      });

      const { resolved, conflicts } = service.resolveConflicts([older, newer]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.id).toBe('mem-newer');
      expect(conflicts[0]!.reason).toBe('NEWER_OVER_OLDER');
    });
  });

  // ─── Higher importance wins ─────────────────────────────────────────────

  describe('resolveConflicts() — higher importance wins', () => {
    it('higher importance wins when same source and similar age', () => {
      const now = new Date();
      const high = makeScoredMemory({
        id: 'mem-high',
        category: 'PREFERENCE',
        content: 'FIFO costing method inventory valuation tracking scheduled',
        source: 'EXPLICIT',
        effectiveImportance: 2.0,
        updatedAt: now,
      });
      const low = makeScoredMemory({
        id: 'mem-low',
        category: 'PREFERENCE',
        content: 'LIFO costing method inventory valuation tracking scheduled',
        source: 'EXPLICIT',
        effectiveImportance: 0.5,
        updatedAt: now, // same time → no NEWER_OVER_OLDER
      });

      const { resolved, conflicts } = service.resolveConflicts([high, low]);

      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.id).toBe('mem-high');
      expect(conflicts[0]!.reason).toBe('HIGHER_IMPORTANCE');
    });
  });

  // ─── No conflict when memories are on different topics ──────────────────

  describe('resolveConflicts() — no conflict on different topics', () => {
    it('keeps both memories when they address different topics', () => {
      const mem1 = makeScoredMemory({
        id: 'mem-net30',
        category: 'PREFERENCE',
        content: 'User prefers Net 30 payment terms',
        source: 'EXPLICIT',
      });
      const mem2 = makeScoredMemory({
        id: 'mem-fifo',
        category: 'PREFERENCE',
        content: 'Always use FIFO costing method for inventory',
        source: 'EXPLICIT',
      });

      const { resolved, conflicts } = service.resolveConflicts([mem1, mem2]);

      expect(resolved).toHaveLength(2);
      expect(conflicts).toHaveLength(0);
    });

    it('keeps both memories when they are in different categories', () => {
      const instruction = makeScoredMemory({
        id: 'mem-instruction',
        category: 'INSTRUCTION',
        content: 'User prefers FIFO costing for inventory valuation',
        source: 'EXPLICIT',
      });
      const preference = makeScoredMemory({
        id: 'mem-preference',
        category: 'PREFERENCE',
        content: 'User prefers FIFO costing for inventory valuation',
        source: 'IMPLICIT',
      });

      // Different categories should not conflict
      const { resolved, conflicts } = service.resolveConflicts([instruction, preference]);

      expect(resolved).toHaveLength(2);
      expect(conflicts).toHaveLength(0);
    });

    it('keeps identical content (not a conflict — same instruction)', () => {
      const mem1 = makeScoredMemory({
        id: 'mem-1',
        category: 'PREFERENCE',
        content: 'User prefers Net 30 payment terms',
        source: 'EXPLICIT',
      });
      const mem2 = makeScoredMemory({
        id: 'mem-2',
        category: 'PREFERENCE',
        content: 'User prefers Net 30 payment terms', // identical
        source: 'IMPLICIT',
      });

      const { resolved, conflicts } = service.resolveConflicts([mem1, mem2]);

      // Same content = not a conflict (it's a duplicate, not a contradiction)
      expect(resolved).toHaveLength(2);
      expect(conflicts).toHaveLength(0);
    });
  });

  // ─── Single or empty memory list ────────────────────────────────────────

  describe('resolveConflicts() — edge cases', () => {
    it('returns single memory unchanged', () => {
      const mem = makeScoredMemory();
      const { resolved, conflicts } = service.resolveConflicts([mem]);

      expect(resolved).toHaveLength(1);
      expect(conflicts).toHaveLength(0);
    });

    it('returns empty arrays for empty input', () => {
      const { resolved, conflicts } = service.resolveConflicts([]);

      expect(resolved).toHaveLength(0);
      expect(conflicts).toHaveLength(0);
    });
  });

  // ─── Conflict Metadata Flagging (Task 4.2) ─────────────────────────────

  describe('assembleUserContext() — conflict metadata marking', () => {
    it('marks conflicting implicit memories with metadata', async () => {
      // Keywords need > 0.7 Jaccard similarity but different content
      // "costing method inventory valuation quarterly" vs "costing method inventory valuation annually"
      // Shared: costing, method, inventory, valuation → 4
      // Union: costing, method, inventory, valuation, quarterly, annually → 6
      // Jaccard: 4/6 = 0.667... still below 0.7
      // Need higher overlap: use 5 shared / 6 total = 0.83
      const explicitMem = makeDbMemory(
        'PREFERENCE',
        'FIFO costing method inventory valuation reports scheduled',
        { id: 'mem-explicit', source: 'EXPLICIT' },
      );
      const implicitMem = makeDbMemory(
        'PREFERENCE',
        'LIFO costing method inventory valuation reports scheduled',
        { id: 'mem-implicit', source: 'IMPLICIT' },
      );

      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null);
      mockPrisma.aiMemory.findMany.mockResolvedValue([explicitMem, implicitMem]);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([]);
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);
      mockPrisma.aiMemory.findUnique.mockResolvedValue({ metadata: null });
      mockPrisma.aiMemory.update.mockResolvedValue({});

      await service.assembleUserContext(defaultUserId, defaultCompanyId);

      // Allow async markConflictingMemories to complete
      await new Promise((r) => setTimeout(r, 100));

      // Should have tried to mark the implicit memory with conflict metadata
      // The conflict data is nested inside data.metadata (Prisma Json field)
      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mem-implicit' },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              conflictsWith: 'mem-explicit',
              conflictDetectedAt: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('does not mark conflicts when no conflicting memories exist', async () => {
      const mem1 = makeDbMemory('PREFERENCE', 'User prefers dark mode', { id: 'mem-1' });
      const mem2 = makeDbMemory('INSTRUCTION', 'Always round to 2 decimal places', { id: 'mem-2' });

      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null);
      mockPrisma.aiMemory.findMany.mockResolvedValue([mem1, mem2]);
      mockPrisma.aiConversationSummary.findMany.mockResolvedValue([]);
      mockMemoryService.calculateEffectiveImportance.mockReturnValue(1.0);

      await service.assembleUserContext(defaultUserId, defaultCompanyId);

      // Allow async to complete
      await new Promise((r) => setTimeout(r, 50));

      // findUnique is only called for conflict marking — should not be called
      expect(mockPrisma.aiMemory.findUnique).not.toHaveBeenCalled();
    });
  });
});
