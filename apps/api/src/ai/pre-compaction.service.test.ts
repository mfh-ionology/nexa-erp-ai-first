import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockLogger, mockMemoryService, mockSemanticDedup } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockMemoryService: {
    createMemory: vi.fn(),
    listMemories: vi.fn(),
    touchMemory: vi.fn().mockResolvedValue(undefined),
  },
  mockSemanticDedup: {
    checkDuplicate: vi.fn(),
    mergeMemories: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { PreCompactionService, type AiMessage } from './pre-compaction.service.js';
import type { MemoryRecord } from './memory.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function createService(withDedup = true) {
  return new PreCompactionService(
    mockLogger as any,
    mockMemoryService as any,
    withDedup ? (mockSemanticDedup as any) : null,
  );
}

function makeMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-1',
    userId: defaultUserId,
    companyId: defaultCompanyId,
    category: 'PREFERENCE',
    content: 'User prefers Net 30 payment terms',
    source: 'IMPLICIT',
    importance: 0.5,
    lastAccessedAt: new Date('2026-02-20T10:00:00.000Z'),
    metadata: null,
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    ...overrides,
  };
}

function makeMessage(role: string, content: string, id?: string): AiMessage {
  return { id, role, content };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PreCompactionService', () => {
  let service: PreCompactionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();

    // Default: dedup says not duplicate, memory creation succeeds
    mockSemanticDedup.checkDuplicate.mockResolvedValue({
      isDuplicate: false,
      similarity: 0,
    });
    mockMemoryService.createMemory.mockResolvedValue(makeMemoryRecord());
    mockMemoryService.listMemories.mockResolvedValue({
      data: [],
      nextCursor: null,
      total: 0,
    });
  });

  // ─── Fact Extraction — User Messages ────────────────────────────────────

  describe('extractFacts() — user messages', () => {
    it('extracts decisions from user messages', () => {
      const messages: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO costing for inventory'),
      ];

      const facts = service.extractFacts(messages);

      expect(facts.length).toBeGreaterThanOrEqual(1);
      const decision = facts.find((f) => f.factType === 'DECISION');
      expect(decision).toBeDefined();
      expect(decision!.source).toBe('user');
      expect(decision!.category).toBe('DECISION');
    });

    it('extracts preferences from user messages', () => {
      const messages: AiMessage[] = [
        makeMessage('user', 'I prefer Net 30 payment terms for new customers'),
      ];

      const facts = service.extractFacts(messages);

      const preference = facts.find((f) => f.factType === 'PREFERENCE');
      expect(preference).toBeDefined();
      expect(preference!.category).toBe('PREFERENCE');
    });

    it('extracts instructions from user messages', () => {
      const messages: AiMessage[] = [
        makeMessage('user', 'Remember that all invoices need approval from finance'),
      ];

      const facts = service.extractFacts(messages);

      const instruction = facts.find((f) => f.factType === 'INSTRUCTION');
      expect(instruction).toBeDefined();
      expect(instruction!.category).toBe('INSTRUCTION');
    });

    it('extracts entity context from user messages', () => {
      const messages: AiMessage[] = [
        makeMessage('user', 'Check the invoice #INV-1042 for customer Acme Ltd'),
      ];

      const facts = service.extractFacts(messages);

      const entity = facts.find((f) => f.factType === 'ENTITY_CONTEXT');
      expect(entity).toBeDefined();
      expect(entity!.category).toBe('ENTITY_CONTEXT');
    });

    it('handles multiple triggers in a single message', () => {
      const messages: AiMessage[] = [
        makeMessage(
          'user',
          'I prefer Net 30 terms. I decided to use FIFO costing. Remember that invoices need approval.',
        ),
      ];

      const facts = service.extractFacts(messages);

      const types = facts.map((f) => f.factType);
      expect(types).toContain('PREFERENCE');
      expect(types).toContain('DECISION');
      expect(types).toContain('INSTRUCTION');
    });
  });

  // ─── Fact Extraction — Assistant Messages ───────────────────────────────

  describe('extractFacts() — assistant messages', () => {
    it('extracts confirmed actions from assistant messages', () => {
      const messages: AiMessage[] = [
        makeMessage('assistant', "I've created invoice #INV-1042 for Acme Ltd with Net 30 terms."),
      ];

      const facts = service.extractFacts(messages);

      const confirmed = facts.find((f) => f.factType === 'ACTION_CONFIRMED');
      expect(confirmed).toBeDefined();
      expect(confirmed!.source).toBe('assistant');
      expect(confirmed!.category).toBe('ENTITY_CONTEXT');
    });

    it('does not extract decision/preference triggers from assistant messages', () => {
      const messages: AiMessage[] = [
        makeMessage('assistant', 'I prefer to use FIFO costing as you requested'),
      ];

      const facts = service.extractFacts(messages);

      // Assistant messages should only match ACTION_CONFIRMED triggers
      const preference = facts.find((f) => f.factType === 'PREFERENCE');
      expect(preference).toBeUndefined();
    });
  });

  // ─── Fact Extraction — Edge Cases ───────────────────────────────────────

  describe('extractFacts() — edge cases', () => {
    it('returns empty array for empty messages', () => {
      const facts = service.extractFacts([]);
      expect(facts).toEqual([]);
    });

    it('skips messages with empty content', () => {
      const messages: AiMessage[] = [makeMessage('user', ''), makeMessage('user', '   ')];

      const facts = service.extractFacts(messages);
      expect(facts).toEqual([]);
    });

    it('deduplicates identical facts from repeated triggers', () => {
      const messages: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO costing'),
        makeMessage('user', 'I decided to use FIFO costing'),
      ];

      const facts = service.extractFacts(messages);

      // Should not have duplicate facts
      const decisions = facts.filter((f) => f.factType === 'DECISION');
      expect(decisions.length).toBe(1);
    });
  });

  // ─── extractAndFlush — main pipeline ────────────────────────────────────

  describe('extractAndFlush()', () => {
    it('creates new memories for novel facts', async () => {
      const messages: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO costing for inventory'),
      ];

      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      expect(result.memoriesCreated).toBeGreaterThanOrEqual(1);
      expect(mockMemoryService.createMemory).toHaveBeenCalledWith(
        defaultUserId,
        defaultCompanyId,
        expect.objectContaining({
          source: 'IMPLICIT',
          metadata: expect.objectContaining({
            extractedBy: 'pre-compaction',
          }),
        }),
      );
    });

    it('merges with existing memory when dedup finds duplicate', async () => {
      const existingMem = makeMemoryRecord({ id: 'mem-existing' });
      mockSemanticDedup.checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        existingMemory: existingMem,
        similarity: 0.8,
      });
      mockSemanticDedup.mergeMemories.mockResolvedValue(existingMem);

      const messages: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO costing for inventory'),
      ];

      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      expect(result.memoriesMerged).toBeGreaterThanOrEqual(1);
      expect(mockSemanticDedup.mergeMemories).toHaveBeenCalled();
      expect(mockMemoryService.createMemory).not.toHaveBeenCalled();
    });

    it('returns zero counts for empty messages', async () => {
      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, []);

      expect(result).toEqual({
        memoriesCreated: 0,
        memoriesMerged: 0,
        memoriesReferenced: 0,
      });
    });

    it('proceeds with creation when dedup service is null', async () => {
      service = createService(false); // no dedup service

      const messages: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO costing for inventory'),
      ];

      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      expect(result.memoriesCreated).toBeGreaterThanOrEqual(1);
      expect(mockSemanticDedup.checkDuplicate).not.toHaveBeenCalled();
    });

    it('proceeds with creation when dedup service throws', async () => {
      mockSemanticDedup.checkDuplicate.mockRejectedValue(new Error('DB error'));

      const messages: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO costing for inventory'),
      ];

      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      // Should still create the memory despite dedup failure
      expect(result.memoriesCreated).toBeGreaterThanOrEqual(1);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ─── Referenced Memory Importance Update ────────────────────────────────

  describe('extractAndFlush() — referenced memory update', () => {
    it('touches existing memories whose keywords appear in the messages', async () => {
      const existingMem = makeMemoryRecord({
        id: 'mem-net30',
        content: 'Net 30 payment terms default',
      });
      mockMemoryService.listMemories.mockResolvedValue({
        data: [existingMem],
        nextCursor: null,
        total: 1,
      });

      const messages: AiMessage[] = [
        makeMessage('user', 'Please apply Net 30 payment terms default to this invoice'),
      ];

      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      expect(result.memoriesReferenced).toBeGreaterThanOrEqual(1);
      expect(mockMemoryService.touchMemory).toHaveBeenCalledWith('mem-net30');
    });

    it('does not touch memories that are not referenced', async () => {
      const existingMem = makeMemoryRecord({
        id: 'mem-fifo',
        content: 'FIFO costing method for inventory valuation',
      });
      mockMemoryService.listMemories.mockResolvedValue({
        data: [existingMem],
        nextCursor: null,
        total: 1,
      });

      // Message does not mention FIFO at all
      const messages: AiMessage[] = [makeMessage('user', 'What is the weather like today?')];

      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      expect(result.memoriesReferenced).toBe(0);
    });
  });

  // ─── Guard Against Double-Extraction ────────────────────────────────────

  describe('extractAndFlush() — double-extraction guard', () => {
    it('skips duplicate extraction for the same set of messages', async () => {
      const messages: AiMessage[] = [makeMessage('user', 'I decided to use FIFO costing', 'msg-1')];

      // First call
      await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);
      const firstCallCount = mockMemoryService.createMemory.mock.calls.length;

      // Second call with same messages
      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      expect(result).toEqual({
        memoriesCreated: 0,
        memoriesMerged: 0,
        memoriesReferenced: 0,
      });
      // createMemory should not have been called again
      expect(mockMemoryService.createMemory.mock.calls.length).toBe(firstCallCount);
    });

    it('processes different message sets independently', async () => {
      const messages1: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO costing', 'msg-1'),
      ];
      const messages2: AiMessage[] = [
        makeMessage('user', 'I prefer Net 60 payment terms', 'msg-2'),
      ];

      await service.extractAndFlush(defaultUserId, defaultCompanyId, messages1);
      const result2 = await service.extractAndFlush(defaultUserId, defaultCompanyId, messages2);

      expect(result2.memoriesCreated).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Flush with Empty Messages ──────────────────────────────────────────

  describe('extractAndFlush() — empty messages → no-op', () => {
    it('returns zero counts and does not call any services', async () => {
      const result = await service.extractAndFlush(defaultUserId, defaultCompanyId, []);

      expect(result).toEqual({
        memoriesCreated: 0,
        memoriesMerged: 0,
        memoriesReferenced: 0,
      });
      expect(mockMemoryService.createMemory).not.toHaveBeenCalled();
      expect(mockSemanticDedup.checkDuplicate).not.toHaveBeenCalled();
      expect(mockMemoryService.listMemories).not.toHaveBeenCalled();
    });
  });

  // ─── Graceful Degradation ───────────────────────────────────────────────

  describe('extractAndFlush() — graceful degradation', () => {
    it('returns partial results when individual fact processing fails', async () => {
      mockMemoryService.createMemory
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValue(makeMemoryRecord());

      const messages: AiMessage[] = [
        makeMessage('user', 'I decided to use FIFO. I prefer Net 30 terms.'),
      ];

      await service.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      // At least one should have succeeded even if the first failed
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
