import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockEventBus, mockLogger, mockMemoryService } = vi.hoisted(() => ({
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
    calculateEffectiveImportance: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  PatternDetectionService,
  type PatternAction,
  type DetectedPattern,
  type SemanticDedupCheck,
} from './pattern-detection.service.js';
import type { MemoryRecord } from './memory.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function createService() {
  return new PatternDetectionService(
    mockLogger as any,
    mockEventBus as any,
    mockMemoryService as any,
  );
}

function makeMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-1',
    userId: defaultUserId,
    companyId: defaultCompanyId,
    category: 'PREFERENCE',
    content: 'User frequently opens the "Overdue Invoices" view',
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

describe('PatternDetectionService', () => {
  let service: PatternDetectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── Action Recording & Buffer Management ───────────────────────────────

  describe('recordAction() — buffer management', () => {
    it('records an action into the in-memory buffer', () => {
      const action: PatternAction = {
        actionType: 'view',
        entityType: 'invoice',
        viewKey: 'Overdue Invoices',
      };

      service.recordAction(defaultUserId, defaultCompanyId, action);

      const buffer = service.getActionBuffer(defaultUserId, defaultCompanyId);
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toMatchObject({
        actionType: 'view',
        entityType: 'invoice',
        viewKey: 'Overdue Invoices',
      });
      expect(buffer[0]!.timestamp).toBeInstanceOf(Date);
    });

    it('accumulates multiple actions for the same user', () => {
      service.recordAction(defaultUserId, defaultCompanyId, {
        actionType: 'view',
        entityType: 'invoice',
      });
      service.recordAction(defaultUserId, defaultCompanyId, {
        actionType: 'view',
        entityType: 'customer',
      });
      service.recordAction(defaultUserId, defaultCompanyId, {
        actionType: 'filter',
        filterApplied: 'overdue',
      });

      expect(service.getActionBuffer(defaultUserId, defaultCompanyId)).toHaveLength(3);
    });

    it('isolates action buffers per user', () => {
      service.recordAction('user-A', defaultCompanyId, {
        actionType: 'view',
        entityType: 'invoice',
      });
      service.recordAction('user-B', defaultCompanyId, {
        actionType: 'view',
        entityType: 'customer',
      });

      expect(service.getActionBuffer('user-A', defaultCompanyId)).toHaveLength(1);
      expect(service.getActionBuffer('user-B', defaultCompanyId)).toHaveLength(1);
    });

    it('returns empty array for users with no recorded actions', () => {
      expect(service.getActionBuffer('nonexistent-user', defaultCompanyId)).toEqual([]);
    });

    it('clears buffer for a user', () => {
      service.recordAction(defaultUserId, defaultCompanyId, { actionType: 'view' });
      expect(service.getActionBuffer(defaultUserId, defaultCompanyId)).toHaveLength(1);

      service.clearBuffer(defaultUserId, defaultCompanyId);
      expect(service.getActionBuffer(defaultUserId, defaultCompanyId)).toEqual([]);
    });
  });

  // ─── Pattern Analysis — VIEW_PREFERENCE ─────────────────────────────────

  describe('analysePatterns() — VIEW_PREFERENCE', () => {
    it('detects a pattern with 3+ occurrences of the same view', () => {
      for (let i = 0; i < 3; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'view',
          entityType: 'invoice',
          viewKey: 'Overdue Invoices',
        });
      }

      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);

      expect(patterns.length).toBeGreaterThanOrEqual(1);
      const viewPattern = patterns.find((p) => p.patternType === 'VIEW_PREFERENCE');
      expect(viewPattern).toBeDefined();
      expect(viewPattern!.occurrenceCount).toBe(3);
      expect(viewPattern!.suggestedCategory).toBe('PREFERENCE');
      expect(viewPattern!.description).toContain('Overdue Invoices');
    });

    it('does NOT detect a pattern with only 2 occurrences (below threshold)', () => {
      for (let i = 0; i < 2; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'view',
          entityType: 'invoice',
          viewKey: 'Overdue Invoices',
        });
      }

      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);
      const viewPattern = patterns.find((p) => p.patternType === 'VIEW_PREFERENCE');
      expect(viewPattern).toBeUndefined();
    });

    it('detects navigate actions as VIEW_PREFERENCE', () => {
      for (let i = 0; i < 4; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'navigate',
          entityType: 'customer',
        });
      }

      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);
      const viewPattern = patterns.find((p) => p.patternType === 'VIEW_PREFERENCE');
      expect(viewPattern).toBeDefined();
      expect(viewPattern!.occurrenceCount).toBe(4);
    });
  });

  // ─── Pattern Analysis — FILTER_PREFERENCE ───────────────────────────────

  describe('analysePatterns() — FILTER_PREFERENCE', () => {
    it('detects repeated filter application as a pattern', () => {
      for (let i = 0; i < 5; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'filter',
          entityType: 'invoice',
          filterApplied: 'status:overdue',
        });
      }

      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);
      const filterPattern = patterns.find((p) => p.patternType === 'FILTER_PREFERENCE');
      expect(filterPattern).toBeDefined();
      expect(filterPattern!.occurrenceCount).toBe(5);
      expect(filterPattern!.description).toContain('status:overdue');
      expect(filterPattern!.suggestedCategory).toBe('PREFERENCE');
    });

    it('does not detect filter pattern without filterApplied value', () => {
      for (let i = 0; i < 5; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'filter',
          entityType: 'invoice',
          // no filterApplied
        });
      }

      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);
      const filterPattern = patterns.find((p) => p.patternType === 'FILTER_PREFERENCE');
      expect(filterPattern).toBeUndefined();
    });
  });

  // ─── Pattern Analysis — WORKFLOW_PATTERN ────────────────────────────────

  describe('analysePatterns() — WORKFLOW_PATTERN', () => {
    it('detects repeated tool/skill actions as workflow pattern', () => {
      for (let i = 0; i < 4; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'create_invoice',
          entityType: 'invoice',
        });
      }

      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);
      const workflowPattern = patterns.find((p) => p.patternType === 'WORKFLOW_PATTERN');
      expect(workflowPattern).toBeDefined();
      expect(workflowPattern!.occurrenceCount).toBe(4);
      expect(workflowPattern!.suggestedCategory).toBe('WORKFLOW');
    });
  });

  // ─── Pattern Analysis — edge cases ──────────────────────────────────────

  describe('analysePatterns() — edge cases', () => {
    it('returns empty array for users with no actions', () => {
      const patterns = service.analysePatterns('no-actions-user', defaultCompanyId);
      expect(patterns).toEqual([]);
    });

    it('returns empty array for empty buffer', () => {
      service.clearBuffer(defaultUserId, defaultCompanyId);
      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);
      expect(patterns).toEqual([]);
    });

    it('detects multiple pattern types simultaneously', () => {
      // 3 view actions
      for (let i = 0; i < 3; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'view',
          entityType: 'invoice',
          viewKey: 'All Invoices',
        });
      }
      // 3 filter actions
      for (let i = 0; i < 3; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'filter',
          entityType: 'customer',
          filterApplied: 'status:active',
        });
      }
      // 3 workflow actions
      for (let i = 0; i < 3; i++) {
        service.recordAction(defaultUserId, defaultCompanyId, {
          actionType: 'approve_payment',
          entityType: 'payment',
        });
      }

      const patterns = service.analysePatterns(defaultUserId, defaultCompanyId);
      const types = patterns.map((p) => p.patternType);

      expect(types).toContain('VIEW_PREFERENCE');
      expect(types).toContain('FILTER_PREFERENCE');
      expect(types).toContain('WORKFLOW_PATTERN');
    });
  });

  // ─── Implicit Memory Creation ───────────────────────────────────────────

  describe('createImplicitMemory()', () => {
    const samplePattern: DetectedPattern = {
      patternType: 'VIEW_PREFERENCE',
      description: 'User frequently opens the "Overdue Invoices" view',
      occurrenceCount: 4,
      confidence: 0.67,
      suggestedCategory: 'PREFERENCE',
      patternKey: 'view:invoice:Overdue Invoices',
    };

    it('creates an implicit memory when no dedup service is available', async () => {
      const createdMem = makeMemoryRecord();
      mockMemoryService.createMemory.mockResolvedValue(createdMem);

      const result = await service.createImplicitMemory(
        defaultUserId,
        defaultCompanyId,
        samplePattern,
      );

      expect(mockMemoryService.createMemory).toHaveBeenCalledWith(
        defaultUserId,
        defaultCompanyId,
        expect.objectContaining({
          content: samplePattern.description,
          category: 'PREFERENCE',
          source: 'IMPLICIT',
          metadata: expect.objectContaining({
            patternType: 'VIEW_PREFERENCE',
            patternKey: 'view:invoice:Overdue Invoices',
            occurrenceCount: 4,
            confidence: 0.67,
          }),
        }),
      );
      expect(result).toEqual(createdMem);
    });

    it('performs dedup check and merges when duplicate found', async () => {
      const existingMem = makeMemoryRecord({ id: 'existing-mem' });
      const mergedMem = makeMemoryRecord({ id: 'existing-mem', content: 'Merged content' });

      const mockDedup = {
        checkDuplicate: vi.fn<any>().mockResolvedValue({
          isDuplicate: true,
          existingMemory: existingMem,
          similarity: 0.9,
        }),
        mergeMemories: vi.fn<any>().mockResolvedValue(mergedMem),
      } as unknown as SemanticDedupCheck;

      service.setSemanticDedup(mockDedup);

      const result = await service.createImplicitMemory(
        defaultUserId,
        defaultCompanyId,
        samplePattern,
      );

      expect(mockDedup.checkDuplicate).toHaveBeenCalledWith(
        defaultUserId,
        defaultCompanyId,
        samplePattern.description,
      );
      expect(mockDedup.mergeMemories).toHaveBeenCalledWith(
        existingMem,
        samplePattern.description,
        'IMPLICIT',
      );
      expect(mockMemoryService.createMemory).not.toHaveBeenCalled();
      expect(result).toEqual(mergedMem);
    });

    it('emits ai.memory.updated event on merge', async () => {
      const existingMem = makeMemoryRecord({ id: 'existing-mem', source: 'IMPLICIT' });
      const mergedMem = makeMemoryRecord({
        id: 'existing-mem',
        source: 'IMPLICIT',
        category: 'PREFERENCE',
      });

      const mockDedup = {
        checkDuplicate: vi.fn<any>().mockResolvedValue({
          isDuplicate: true,
          existingMemory: existingMem,
          similarity: 0.9,
        }),
        mergeMemories: vi.fn<any>().mockResolvedValue(mergedMem),
      } as unknown as SemanticDedupCheck;

      service.setSemanticDedup(mockDedup);
      await service.createImplicitMemory(defaultUserId, defaultCompanyId, samplePattern);

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.memory.updated', {
        memoryId: 'existing-mem',
        userId: defaultUserId,
        companyId: defaultCompanyId,
        category: 'PREFERENCE',
        previousSource: 'IMPLICIT',
        newSource: 'IMPLICIT',
        reason: 'MERGE',
      });
    });

    it('creates new memory when dedup finds no duplicate', async () => {
      const mockDedup = {
        checkDuplicate: vi.fn<any>().mockResolvedValue({
          isDuplicate: false,
          similarity: 0.2,
        }),
        mergeMemories: vi.fn<any>(),
      } as unknown as SemanticDedupCheck;

      service.setSemanticDedup(mockDedup);
      const createdMem = makeMemoryRecord();
      mockMemoryService.createMemory.mockResolvedValue(createdMem);

      const result = await service.createImplicitMemory(
        defaultUserId,
        defaultCompanyId,
        samplePattern,
      );

      expect(mockDedup.checkDuplicate).toHaveBeenCalled();
      expect(mockDedup.mergeMemories).not.toHaveBeenCalled();
      expect(mockMemoryService.createMemory).toHaveBeenCalled();
      expect(result).toEqual(createdMem);
    });

    it('gracefully degrades when dedup service throws', async () => {
      const mockDedup = {
        checkDuplicate: vi.fn<any>().mockRejectedValue(new Error('DB error')),
        mergeMemories: vi.fn<any>(),
      } as unknown as SemanticDedupCheck;

      service.setSemanticDedup(mockDedup);
      const createdMem = makeMemoryRecord();
      mockMemoryService.createMemory.mockResolvedValue(createdMem);

      const result = await service.createImplicitMemory(
        defaultUserId,
        defaultCompanyId,
        samplePattern,
      );

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockMemoryService.createMemory).toHaveBeenCalled();
      expect(result).toEqual(createdMem);
    });
  });
});
