import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted — integration test mocks at DB/event level only
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiMemory: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    aiMemorySettings: {
      findUnique: vi.fn(),
    },
    aiConversationSummary: {
      findMany: vi.fn(),
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
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { MemoryService, type MemoryRecord } from './memory.service.js';
import { MemoryParserService } from './memory-parser.service.js';
import { PatternDetectionService } from './pattern-detection.service.js';
import { SemanticDedupService } from './semantic-dedup.service.js';
import { PreCompactionService, type AiMessage } from './pre-compaction.service.js';
import { MemoryCitationService } from './memory-citation.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

let memIdCounter = 0;
function makeDbMemory(content: string, overrides: Record<string, unknown> = {}) {
  memIdCounter++;
  return {
    id: `mem-${memIdCounter}`,
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

// ---------------------------------------------------------------------------
// Integration Tests — End-to-end flows
// ---------------------------------------------------------------------------

describe('Implicit Learning — Integration Tests', () => {
  let memoryService: MemoryService;
  let memoryParser: MemoryParserService;
  let patternDetection: PatternDetectionService;
  let semanticDedup: SemanticDedupService;
  let preCompaction: PreCompactionService;
  let citationService: MemoryCitationService;

  beforeEach(() => {
    vi.clearAllMocks();
    memIdCounter = 0;

    // Wire real service instances with mocked DB/events
    memoryService = new MemoryService(mockPrisma as any, mockEventBus as any, mockLogger as any);
    semanticDedup = new SemanticDedupService(mockPrisma as any, mockLogger as any);
    memoryParser = new MemoryParserService(
      mockPrisma as any,
      mockLogger as any,
      memoryService,
      mockEventBus as any,
    );
    memoryParser.setSemanticDedup(semanticDedup);

    patternDetection = new PatternDetectionService(
      mockLogger as any,
      mockEventBus as any,
      memoryService,
    );
    patternDetection.setSemanticDedup(semanticDedup);

    preCompaction = new PreCompactionService(mockLogger as any, memoryService, semanticDedup);
    citationService = new MemoryCitationService(mockLogger as any, memoryService);

    // Default mocks
    mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null);
    mockPrisma.aiMemory.findMany.mockResolvedValue([]);
    mockPrisma.aiMemory.count.mockResolvedValue(0);
  });

  // ─── E2E: Explicit Memory Creation ──────────────────────────────────────

  describe('E2E: User says "Remember I prefer FIFO" → explicit memory created → AI acknowledges', () => {
    it('creates an EXPLICIT memory from user instruction', async () => {
      const createdMem = makeDbMemory('FIFO costing for inventory', {
        source: 'EXPLICIT',
        importance: 1.0,
        category: 'INSTRUCTION',
      });
      mockPrisma.aiMemory.create.mockResolvedValue(createdMem);

      // Step 1: Parse user message for memory intent
      const intent = memoryParser.parseForMemoryIntent(
        'Remember that I prefer FIFO costing for inventory',
        '',
      );

      expect(intent).not.toBeNull();
      expect(intent!.type).toBe('CREATE');

      // Step 2: Process the intent
      const result = await memoryParser.processMemoryIntent(
        defaultUserId,
        defaultCompanyId,
        intent!,
      );

      // Step 3: Verify memory was created
      expect(result.memory).not.toBeNull();
      expect(result.message).toContain('MEMORY_CREATED');
      expect(mockPrisma.aiMemory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'EXPLICIT',
            userId: defaultUserId,
            companyId: defaultCompanyId,
          }),
        }),
      );

      // Step 4: Verify event was emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.memory.created',
        expect.objectContaining({
          userId: defaultUserId,
          companyId: defaultCompanyId,
          source: 'EXPLICIT',
        }),
      );
    });
  });

  // ─── E2E: Implicit Memory from Pattern Detection ───────────────────────

  describe('E2E: User opens "Overdue Invoices" 4 times → implicit memory created', () => {
    it('detects view pattern and creates implicit memory', async () => {
      const createdMem = makeDbMemory('User frequently opens the "Overdue Invoices" view', {
        source: 'IMPLICIT',
        importance: 0.5,
      });
      mockPrisma.aiMemory.create.mockResolvedValue(createdMem);

      // Step 1: Record 4 view actions
      for (let i = 0; i < 4; i++) {
        patternDetection.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'view',
          entityType: 'invoice',
          viewKey: 'Overdue Invoices',
        });
      }

      // Step 2: Analyse patterns
      const patterns = patternDetection.analysePatterns(defaultUserId, defaultCompanyId);

      expect(patterns.length).toBeGreaterThanOrEqual(1);
      const viewPattern = patterns.find((p) => p.patternType === 'VIEW_PREFERENCE');
      expect(viewPattern).toBeDefined();
      expect(viewPattern!.occurrenceCount).toBe(4);

      // Step 3: Create implicit memory from pattern
      const memory = await patternDetection.createImplicitMemory(
        defaultUserId,
        defaultCompanyId,
        viewPattern!,
      );

      // Step 4: Verify the implicit memory was created
      expect(memory).not.toBeNull();
      expect(mockPrisma.aiMemory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'IMPLICIT',
            importance: 0.5,
          }),
        }),
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.memory.created',
        expect.objectContaining({
          source: 'IMPLICIT',
        }),
      );
    });

    it('does NOT create memory with only 2 occurrences', () => {
      for (let i = 0; i < 2; i++) {
        patternDetection.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'view',
          entityType: 'invoice',
          viewKey: 'Overdue Invoices',
        });
      }

      const patterns = patternDetection.analysePatterns(defaultUserId, defaultCompanyId);
      const viewPattern = patterns.find((p) => p.patternType === 'VIEW_PREFERENCE');
      expect(viewPattern).toBeUndefined();
    });
  });

  // ─── E2E: User Correction Flow ─────────────────────────────────────────

  describe('E2E: User says "No, actually LIFO" → FIFO memory updated to LIFO → source upgraded to EXPLICIT', () => {
    it('corrects existing memory in-place and upgrades source', async () => {
      // Setup: existing IMPLICIT FIFO memory
      const existingFifo = makeDbMemory('FIFO costing for inventory', {
        id: 'mem-fifo',
        source: 'IMPLICIT',
        importance: 0.5,
        category: 'INSTRUCTION',
      });

      // listMemories returns the existing FIFO memory for keyword search
      mockPrisma.aiMemory.findMany.mockResolvedValue([existingFifo]);
      mockPrisma.aiMemory.count.mockResolvedValue(1);

      // Atomic update via db.aiMemory.update
      const updatedMem = makeDbMemory('LIFO costing for inventory', {
        id: 'mem-fifo',
        source: 'EXPLICIT',
        importance: 1.5,
        category: 'INSTRUCTION',
      });
      mockPrisma.aiMemory.findFirst.mockResolvedValue(existingFifo);
      mockPrisma.aiMemory.update.mockResolvedValue(updatedMem);

      // Step 1: Parse correction intent
      const intent = memoryParser.parseForMemoryIntent(
        'No actually, I want LIFO costing for inventory',
        '',
      );

      expect(intent).not.toBeNull();
      expect(intent!.type).toBe('UPDATE');

      // Step 2: Process the correction
      const result = await memoryParser.processMemoryIntent(
        defaultUserId,
        defaultCompanyId,
        intent!,
      );

      // Step 3: Verify correction result
      expect(result.message).toContain('MEMORY_CORRECTED');

      // Step 4: Verify atomic update — content + source + importance in single write
      expect(mockPrisma.aiMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mem-fifo' },
          data: expect.objectContaining({
            source: 'EXPLICIT',
            importance: 1.5,
          }),
        }),
      );

      // Step 5: Verify event was emitted with CORRECTION reason
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.memory.updated',
        expect.objectContaining({
          memoryId: 'mem-fifo',
          previousSource: 'IMPLICIT',
          newSource: 'EXPLICIT',
          reason: 'CORRECTION',
        }),
      );
    });
  });

  // ─── E2E: Pre-Compaction Flush ──────────────────────────────────────────

  describe('E2E: Pre-compaction triggered → facts extracted → new memories created → old messages trimmed', () => {
    it('extracts facts and creates implicit memories before compaction', async () => {
      const createdMem = makeDbMemory('FIFO costing for inventory', {
        source: 'IMPLICIT',
      });
      mockPrisma.aiMemory.create.mockResolvedValue(createdMem);

      // Messages about to be compacted
      const messages: AiMessage[] = [
        { role: 'user', content: 'I decided to use FIFO costing for all inventory' },
        { role: 'user', content: 'I prefer Net 30 payment terms for new customers' },
        {
          role: 'assistant',
          content: "I've created invoice #INV-1042 for Acme Ltd with Net 30 terms.",
        },
      ];

      // Step 1: Extract and flush
      const result = await preCompaction.extractAndFlush(defaultUserId, defaultCompanyId, messages);

      // Step 2: Verify memories were created
      expect(result.memoriesCreated).toBeGreaterThanOrEqual(1);

      // Step 3: Verify memories were created with correct source
      expect(mockPrisma.aiMemory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'IMPLICIT',
            metadata: expect.objectContaining({
              extractedBy: 'pre-compaction',
            }),
          }),
        }),
      );
    });

    it('does not double-extract the same messages', async () => {
      mockPrisma.aiMemory.create.mockResolvedValue(makeDbMemory('Test', { source: 'IMPLICIT' }));

      const messages: AiMessage[] = [
        { id: 'msg-100', role: 'user', content: 'I decided to use FIFO' },
      ];

      // First call
      const result1 = await preCompaction.extractAndFlush(
        defaultUserId,
        defaultCompanyId,
        messages,
      );
      expect(result1.memoriesCreated).toBeGreaterThanOrEqual(1);

      const createCallsAfterFirst = mockPrisma.aiMemory.create.mock.calls.length;

      // Second call with same messages
      const result2 = await preCompaction.extractAndFlush(
        defaultUserId,
        defaultCompanyId,
        messages,
      );
      expect(result2.memoriesCreated).toBe(0);
      expect(result2.memoriesMerged).toBe(0);

      // No new create calls
      expect(mockPrisma.aiMemory.create.mock.calls.length).toBe(createCallsAfterFirst);
    });
  });

  // ─── E2E: Citation Flow ─────────────────────────────────────────────────

  describe('E2E: Memory citation in AI response', () => {
    it('detects cited memories in AI response', () => {
      const memories: MemoryRecord[] = [
        {
          id: 'mem-net30',
          userId: defaultUserId,
          companyId: defaultCompanyId,
          category: 'PREFERENCE',
          content: 'User prefers Net 30 payment terms for invoices',
          source: 'EXPLICIT',
          importance: 1.0,
          lastAccessedAt: new Date(),
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Step 1: AI generates a response mentioning Net 30 terms
      const aiResponse =
        'Based on your preference for Net 30 payment terms, I have applied them to the new invoice.';

      // Step 2: Detect which memories were cited
      const citedIds = citationService.detectCitedMemories(memories, aiResponse);
      expect(citedIds).toContain('mem-net30');
    });
  });
});
