import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus, mockLogger, mockMemoryService } = vi.hoisted(() => ({
  mockPrisma: {
    aiMemorySettings: {
      findUnique: vi.fn(),
    },
    aiMemory: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
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
  mockMemoryService: {
    createMemory: vi.fn(),
    listMemories: vi.fn(),
    updateMemory: vi.fn(),
    deleteMemory: vi.fn(),
    touchMemory: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { MemoryParserService, type MemoryIntent } from './memory-parser.service.js';
import type { MemoryRecord } from './memory.service.js';
import type { SemanticDedupCheck } from './pattern-detection.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function createService() {
  return new MemoryParserService(
    mockPrisma as any,
    mockLogger as any,
    mockMemoryService as any,
    mockEventBus as any,
  );
}

function makeMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-1',
    userId: defaultUserId,
    companyId: defaultCompanyId,
    category: 'INSTRUCTION',
    content: 'User prefers Net 30 payment terms',
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

describe('MemoryParserService', () => {
  let service: MemoryParserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();

    // Default: memory is enabled, no settings record → all categories enabled
    mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null);
    // Default: ownership verification passes
    mockPrisma.aiMemory.findFirst.mockResolvedValue({ id: 'mem-1' });
  });

  // ─── Intent Detection — CREATE ──────────────────────────────────────────

  describe('parseForMemoryIntent() — CREATE intent', () => {
    it.each([
      ['Remember that I prefer Net 30 terms', 'remember that'],
      ['Remember I always use FIFO costing', 'remember i'],
      ['Always use dark mode for reports', 'always use'],
      ['Never use LIFO costing for inventory', 'never use'],
      ['My preference is to sort by date', 'my preference is'],
      ['I prefer landscape layout for reports', 'i prefer'],
      ['From now on, use GBP as the default currency', 'from now on'],
      ['Going forward, always round to 2 decimal places', 'going forward'],
    ])('detects CREATE intent from "%s"', (message, _trigger) => {
      const result = service.parseForMemoryIntent(message, '');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('CREATE');
      expect(result!.content.length).toBeGreaterThan(0);
    });

    it('returns null for messages without memory intent', () => {
      expect(service.parseForMemoryIntent('Hello, how are you?', '')).toBeNull();
      expect(service.parseForMemoryIntent('Show me the invoices', '')).toBeNull();
      expect(service.parseForMemoryIntent('What is the current balance?', '')).toBeNull();
    });

    it('assigns PREFERENCE category when afterTrigger contains preference keywords', () => {
      // "remember that" is the CREATE trigger → afterTrigger = "I prefer FIFO over LIFO"
      // inferCategory checks afterTrigger for "prefer" → returns PREFERENCE
      const result = service.parseForMemoryIntent('Remember that I prefer FIFO over LIFO', '');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('PREFERENCE');
    });

    it('assigns INSTRUCTION category for command-like content', () => {
      const result = service.parseForMemoryIntent(
        'Remember that invoices must be approved by a manager',
        '',
      );
      expect(result).not.toBeNull();
      expect(result!.category).toBe('INSTRUCTION');
    });

    it('normalises content — capitalises and trims', () => {
      const result = service.parseForMemoryIntent('remember that net 30 is the default.', '');
      expect(result).not.toBeNull();
      expect(result!.content).toBe('Net 30 is the default');
    });
  });

  // ─── Intent Detection — FORGET ────────────────────────────────────────

  describe('parseForMemoryIntent() — FORGET intent', () => {
    it.each([
      ['Forget about FIFO costing', 'forget about'],
      ['Forget that preference for dark mode', 'forget that'],
      ['Forget my preference for Net 30', 'forget my'],
      ['Stop remembering my sort preference', 'stop remembering'],
      ['Delete my preference for LIFO', 'delete my preference'],
      ['Remove my preference for landscape layout', 'remove my preference'],
    ])('detects FORGET intent from "%s"', (message, _trigger) => {
      const result = service.parseForMemoryIntent(message, '');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('FORGET');
    });
  });

  // ─── Intent Detection — CORRECTION / UPDATE ───────────────────────────

  describe('parseForMemoryIntent() — UPDATE (correction) intent', () => {
    it.each([
      ['No actually, I prefer LIFO costing now', 'no actually'],
      ['No, actually I want Net 60 terms', 'no, actually'],
      ["That's wrong, use FIFO instead", "that's wrong"],
      ['I changed my mind about the payment terms', 'i changed my mind'],
      ['Not anymore, switch to FIFO costing', 'not anymore'],
      ['Instead of LIFO, use FIFO costing', 'instead of'],
      ['Correction: the default currency should be EUR', 'correction:'],
      ['Update my preference to Net 60 terms', 'update my preference'],
      ['Actually I prefer FIFO costing method', 'actually i prefer'],
    ])('detects UPDATE intent from "%s"', (message, _trigger) => {
      const result = service.parseForMemoryIntent(message, '');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('UPDATE');
    });

    it('extracts referenced content from "instead of X" pattern within correction', () => {
      // "no actually" is the correction trigger → afterTrigger = "use FIFO instead of LIFO"
      // extractReferencedContent finds "instead of LIFO" in the afterTrigger
      const result = service.parseForMemoryIntent('No actually, use FIFO instead of LIFO', '');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('UPDATE');
      expect(result!.referencedContent).toBe('lifo');
    });

    it('correction takes priority over create triggers', () => {
      // "actually i prefer" is a correction trigger, even though "i prefer" is a create trigger
      const result = service.parseForMemoryIntent('Actually I prefer FIFO now', '');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('UPDATE');
    });
  });

  // ─── processMemoryIntent — CREATE ──────────────────────────────────────

  describe('processMemoryIntent() — CREATE', () => {
    it('creates an explicit memory with INSTRUCTION category and importance 1.5', async () => {
      const created = makeMemoryRecord({ source: 'EXPLICIT' });
      mockMemoryService.createMemory.mockResolvedValue(created);

      const intent: MemoryIntent = {
        type: 'CREATE',
        content: 'Net 30 payment terms for new customers',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(mockMemoryService.createMemory).toHaveBeenCalledWith(
        defaultUserId,
        defaultCompanyId,
        expect.objectContaining({
          content: 'Net 30 payment terms for new customers',
          category: 'INSTRUCTION',
          source: 'EXPLICIT',
        }),
      );
      expect(result.memory).toEqual(created);
      expect(result.message).toContain('MEMORY_CREATED');
    });

    it('returns MEMORY_DISABLED when memory is disabled', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue({
        isEnabled: false,
        enabledCategories: [],
      });

      const intent: MemoryIntent = {
        type: 'CREATE',
        content: 'Some preference',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(result.memory).toBeNull();
      expect(result.message).toBe('MEMORY_DISABLED');
      expect(mockMemoryService.createMemory).not.toHaveBeenCalled();
    });

    it('returns CATEGORY_DISABLED when the category is not enabled', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue({
        isEnabled: true,
        enabledCategories: ['PREFERENCE'], // INSTRUCTION is not enabled
      });

      const intent: MemoryIntent = {
        type: 'CREATE',
        content: 'Some instruction',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(result.memory).toBeNull();
      expect(result.message).toBe('CATEGORY_DISABLED:INSTRUCTION');
      expect(mockMemoryService.createMemory).not.toHaveBeenCalled();
    });

    it('allows creation when enabledCategories is empty (all allowed)', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue({
        isEnabled: true,
        enabledCategories: [],
      });

      const created = makeMemoryRecord();
      mockMemoryService.createMemory.mockResolvedValue(created);

      const intent: MemoryIntent = {
        type: 'CREATE',
        content: 'Test memory',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(result.memory).not.toBeNull();
    });

    it('performs semantic dedup and merges when duplicate found', async () => {
      const existingMem = makeMemoryRecord({ id: 'existing', source: 'IMPLICIT' });
      const mergedMem = makeMemoryRecord({ id: 'existing', content: 'Merged content' });

      const mockDedup: SemanticDedupCheck = {
        checkDuplicate: vi.fn().mockResolvedValue({
          isDuplicate: true,
          existingMemory: existingMem,
          similarity: 0.9,
        }) as any,
        mergeMemories: vi.fn().mockResolvedValue(mergedMem) as any,
      };

      service.setSemanticDedup(mockDedup);

      const intent: MemoryIntent = {
        type: 'CREATE',
        content: 'Net 30 payment terms',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(result.message).toContain('MEMORY_MERGED');
      expect(mockMemoryService.createMemory).not.toHaveBeenCalled();
    });
  });

  // ─── processMemoryIntent — FORGET ──────────────────────────────────────

  describe('processMemoryIntent() — FORGET', () => {
    it('deletes the best matching memory', async () => {
      const matchingMem = makeMemoryRecord({ id: 'mem-to-forget', content: 'FIFO costing' });
      mockMemoryService.listMemories.mockResolvedValue({
        data: [matchingMem],
        nextCursor: null,
        total: 1,
      });
      mockMemoryService.deleteMemory.mockResolvedValue(true);

      const intent: MemoryIntent = {
        type: 'FORGET',
        content: 'FIFO costing',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(mockMemoryService.deleteMemory).toHaveBeenCalledWith(
        'mem-to-forget',
        defaultUserId,
        defaultCompanyId,
      );
      expect(result.message).toContain('MEMORY_FORGOTTEN');
    });

    it('returns MEMORY_NOT_FOUND when no matching memory exists', async () => {
      mockMemoryService.listMemories.mockResolvedValue({
        data: [],
        nextCursor: null,
        total: 0,
      });

      const intent: MemoryIntent = {
        type: 'FORGET',
        content: 'Something that does not exist',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(result.memory).toBeNull();
      expect(result.message).toContain('MEMORY_NOT_FOUND');
      expect(mockMemoryService.deleteMemory).not.toHaveBeenCalled();
    });
  });

  // ─── processMemoryIntent — UPDATE (correction) ─────────────────────────

  describe('processMemoryIntent() — UPDATE (correction)', () => {
    it('updates existing memory in-place and upgrades source to EXPLICIT', async () => {
      const existingMem = makeMemoryRecord({
        id: 'mem-fifo',
        content: 'FIFO costing',
        source: 'IMPLICIT',
      });
      mockMemoryService.listMemories.mockResolvedValue({
        data: [existingMem],
        nextCursor: null,
        total: 1,
      });

      const updatedMem = makeMemoryRecord({
        id: 'mem-fifo',
        content: 'LIFO costing method',
        source: 'EXPLICIT',
      });
      mockPrisma.aiMemory.update.mockResolvedValue(updatedMem);

      const intent: MemoryIntent = {
        type: 'UPDATE',
        content: 'LIFO costing method',
        category: 'INSTRUCTION',
        referencedContent: 'FIFO costing',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      // Single atomic update — content + source + importance + metadata in one write
      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mem-fifo' },
          data: expect.objectContaining({
            content: 'LIFO costing method',
            source: 'EXPLICIT',
            importance: 1.5,
          }),
        }),
      );

      // updateMemory is NOT called — atomic write bypasses it
      expect(mockMemoryService.updateMemory).not.toHaveBeenCalled();

      expect(result.message).toContain('MEMORY_CORRECTED');
    });

    it('emits ai.memory.updated event with CORRECTION reason', async () => {
      // Existing memory about FIFO costing
      const existingMem = makeMemoryRecord({
        id: 'mem-x',
        source: 'IMPLICIT',
        content: 'FIFO costing method for inventory',
      });
      mockMemoryService.listMemories.mockResolvedValue({
        data: [existingMem],
        nextCursor: null,
        total: 1,
      });
      const updatedMem = makeMemoryRecord({ id: 'mem-x', category: 'INSTRUCTION' });
      mockPrisma.aiMemory.update.mockResolvedValue(updatedMem);

      // Correction with overlapping keywords so findMemoryToCorrect matches
      const intent: MemoryIntent = {
        type: 'UPDATE',
        content: 'LIFO costing method for inventory',
        category: 'INSTRUCTION',
      };

      await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.memory.updated', {
        memoryId: 'mem-x',
        userId: defaultUserId,
        companyId: defaultCompanyId,
        category: 'INSTRUCTION',
        previousSource: 'IMPLICIT',
        newSource: 'EXPLICIT',
        reason: 'CORRECTION',
      });
    });

    it('falls back to CREATE when ownership verification fails during correction', async () => {
      const existingMem = makeMemoryRecord({
        id: 'mem-stolen',
        content: 'FIFO costing method',
        source: 'IMPLICIT',
      });
      mockMemoryService.listMemories.mockResolvedValue({
        data: [existingMem],
        nextCursor: null,
        total: 1,
      });

      // Ownership check fails — findFirst returns null
      mockPrisma.aiMemory.findFirst.mockResolvedValue(null);

      const created = makeMemoryRecord({ source: 'EXPLICIT' });
      mockMemoryService.createMemory.mockResolvedValue(created);

      const intent: MemoryIntent = {
        type: 'UPDATE',
        content: 'LIFO costing method',
        category: 'INSTRUCTION',
        referencedContent: 'FIFO costing',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      // Should not have updated the unverified memory
      expect(mockPrisma.aiMemory.update).not.toHaveBeenCalled();
      // Should fall back to creating a new memory
      expect(mockMemoryService.createMemory).toHaveBeenCalled();
      expect(result.message).toContain('MEMORY_CREATED');
    });

    it('creates new explicit memory when no matching memory found for correction', async () => {
      // No matching memory found
      mockMemoryService.listMemories.mockResolvedValue({
        data: [],
        nextCursor: null,
        total: 0,
      });

      const created = makeMemoryRecord({ source: 'EXPLICIT' });
      mockMemoryService.createMemory.mockResolvedValue(created);

      const intent: MemoryIntent = {
        type: 'UPDATE',
        content: 'New standalone preference',
        category: 'INSTRUCTION',
      };

      const result = await service.processMemoryIntent(defaultUserId, defaultCompanyId, intent);

      // Should fall back to creating a new explicit memory
      expect(mockMemoryService.createMemory).toHaveBeenCalled();
      expect(result.message).toContain('MEMORY_CREATED');
    });
  });
});
