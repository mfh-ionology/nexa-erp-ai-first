import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockLogger, mockMemoryService } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockMemoryService: {
    touchMemory: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { MemoryCitationService } from './memory-citation.service.js';
import type { MemoryRecord } from './memory.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new MemoryCitationService(mockLogger as any, mockMemoryService as any);
}

function makeMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    companyId: 'company-1',
    category: 'PREFERENCE',
    content: 'User prefers Net 30 payment terms for new customers',
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

describe('MemoryCitationService', () => {
  let service: MemoryCitationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── Memory Access Tracking ─────────────────────────────────────────────

  describe('trackMemoryAccess()', () => {
    it('calls touchMemory for each provided memory ID', async () => {
      await service.trackMemoryAccess(['mem-1', 'mem-2', 'mem-3']);

      expect(mockMemoryService.touchMemory).toHaveBeenCalledTimes(3);
      expect(mockMemoryService.touchMemory).toHaveBeenCalledWith('mem-1');
      expect(mockMemoryService.touchMemory).toHaveBeenCalledWith('mem-2');
      expect(mockMemoryService.touchMemory).toHaveBeenCalledWith('mem-3');
    });

    it('does nothing when given empty array', async () => {
      await service.trackMemoryAccess([]);

      expect(mockMemoryService.touchMemory).not.toHaveBeenCalled();
    });

    it('swallows errors from touchMemory (fire-and-forget)', async () => {
      mockMemoryService.touchMemory
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      // Should not throw
      await expect(service.trackMemoryAccess(['mem-fail', 'mem-ok'])).resolves.toBeUndefined();
    });

    it('logs the count of tracked memories', async () => {
      await service.trackMemoryAccess(['mem-1', 'mem-2']);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { count: 2 },
        'Memory access tracked for cited memories',
      );
    });
  });

  // ─── Cited Memory Detection ─────────────────────────────────────────────

  describe('detectCitedMemories()', () => {
    it('detects cited memories when response contains memory keywords', () => {
      const memories = [
        makeMemory({
          id: 'mem-net30',
          content: 'User prefers Net 30 payment terms for new customers',
        }),
        makeMemory({
          id: 'mem-fifo',
          content: 'Always use FIFO costing method for inventory',
        }),
      ];

      // Response mentions Net 30 and payment terms → should match mem-net30
      const response =
        'Based on your preference for Net 30 payment terms, I have applied them to this invoice.';
      const cited = service.detectCitedMemories(memories, response);

      expect(cited).toContain('mem-net30');
    });

    it('returns empty array when response does not match any memories', () => {
      const memories = [
        makeMemory({
          id: 'mem-net30',
          content: 'User prefers Net 30 payment terms',
        }),
      ];

      const response = 'Here is the current weather forecast for London.';
      const cited = service.detectCitedMemories(memories, response);

      expect(cited).toEqual([]);
    });

    it('returns empty array when no memories are injected', () => {
      const cited = service.detectCitedMemories([], 'Some AI response');
      expect(cited).toEqual([]);
    });

    it('returns empty array when response is empty', () => {
      const memories = [makeMemory()];
      const cited = service.detectCitedMemories(memories, '');
      expect(cited).toEqual([]);
    });

    it('matches case-insensitively', () => {
      const memories = [
        makeMemory({
          id: 'mem-fifo',
          content: 'Always use FIFO costing method for inventory',
        }),
      ];

      const response = 'I applied the fifo costing method to the inventory valuation.';
      const cited = service.detectCitedMemories(memories, response);

      expect(cited).toContain('mem-fifo');
    });

    it('can detect multiple cited memories', () => {
      const memories = [
        makeMemory({
          id: 'mem-net30',
          content: 'User prefers Net 30 payment terms',
        }),
        makeMemory({
          id: 'mem-fifo',
          content: 'Always use FIFO costing method for inventory',
        }),
      ];

      const response =
        'I applied Net 30 payment terms to the invoice and used the FIFO costing method for inventory valuation.';
      const cited = service.detectCitedMemories(memories, response);

      expect(cited).toContain('mem-net30');
      expect(cited).toContain('mem-fifo');
    });
  });
});
