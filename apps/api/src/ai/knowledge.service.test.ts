import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiModuleKnowledge: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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

import { KnowledgeService } from './knowledge.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new KnowledgeService(mockPrisma as any, mockLogger as any);
}

function makeKnowledge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'know-1',
    moduleKey: 'ar',
    knowledgeType: 'OVERVIEW',
    title: 'AR Overview',
    content: 'Accounts Receivable manages customer invoices and payments.',
    priority: 100,
    isActive: true,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── listKnowledge ──────────────────────────────────────────────────────

  describe('listKnowledge()', () => {
    it('returns all knowledge entries ordered by priority desc, title asc', async () => {
      const entries = [
        makeKnowledge({ id: 'k-1', priority: 200 }),
        makeKnowledge({ id: 'k-2', priority: 100 }),
      ];
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue(entries);

      const result = await service.listKnowledge();

      expect(mockPrisma.aiModuleKnowledge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { title: 'asc' }],
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('filters by moduleKey', async () => {
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([makeKnowledge()]);

      await service.listKnowledge({ moduleKey: 'ar' });

      expect(mockPrisma.aiModuleKnowledge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ moduleKey: 'ar' }),
        }),
      );
    });

    it('filters by knowledge type', async () => {
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);

      await service.listKnowledge({ type: 'ENTITIES' });

      expect(mockPrisma.aiModuleKnowledge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ knowledgeType: 'ENTITIES' }),
        }),
      );
    });

    it('filters by both moduleKey and type', async () => {
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);

      await service.listKnowledge({ moduleKey: 'finance', type: 'BUSINESS_RULES' });

      expect(mockPrisma.aiModuleKnowledge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleKey: 'finance', knowledgeType: 'BUSINESS_RULES' },
        }),
      );
    });
  });

  // ─── getKnowledge ──────────────────────────────────────────────────────

  describe('getKnowledge()', () => {
    it('returns knowledge entry when found', async () => {
      mockPrisma.aiModuleKnowledge.findUnique.mockResolvedValue(makeKnowledge());

      const result = await service.getKnowledge('know-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('know-1');
      expect(result!.moduleKey).toBe('ar');
    });

    it('returns null when not found', async () => {
      mockPrisma.aiModuleKnowledge.findUnique.mockResolvedValue(null);

      const result = await service.getKnowledge('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── createKnowledge ──────────────────────────────────────────────────

  describe('createKnowledge()', () => {
    it('creates a knowledge entry with all fields', async () => {
      mockPrisma.aiModuleKnowledge.create.mockResolvedValue(makeKnowledge());

      const result = await service.createKnowledge({
        moduleKey: 'ar',
        knowledgeType: 'OVERVIEW',
        title: 'AR Overview',
        content: 'Accounts Receivable manages customer invoices and payments.',
      });

      expect(mockPrisma.aiModuleKnowledge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          moduleKey: 'ar',
          knowledgeType: 'OVERVIEW',
          title: 'AR Overview',
          priority: 100,
          isActive: true,
        }),
      });
      expect(result.id).toBe('know-1');
    });

    it('uses provided priority and isActive values', async () => {
      mockPrisma.aiModuleKnowledge.create.mockResolvedValue(
        makeKnowledge({ priority: 50, isActive: false }),
      );

      await service.createKnowledge({
        moduleKey: 'ar',
        knowledgeType: 'ENTITIES',
        title: 'AR Entities',
        content: 'Entity info',
        priority: 50,
        isActive: false,
      });

      expect(mockPrisma.aiModuleKnowledge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 50,
          isActive: false,
        }),
      });
    });
  });

  // ─── updateKnowledge ──────────────────────────────────────────────────

  describe('updateKnowledge()', () => {
    it('updates only the provided fields', async () => {
      mockPrisma.aiModuleKnowledge.findUnique.mockResolvedValue(makeKnowledge());
      mockPrisma.aiModuleKnowledge.update.mockResolvedValue(
        makeKnowledge({ title: 'Updated Title' }),
      );

      const result = await service.updateKnowledge('know-1', { title: 'Updated Title' });

      expect(mockPrisma.aiModuleKnowledge.update).toHaveBeenCalledWith({
        where: { id: 'know-1' },
        data: { title: 'Updated Title' },
      });
      expect(result).not.toBeNull();
    });

    it('returns null when knowledge not found', async () => {
      mockPrisma.aiModuleKnowledge.findUnique.mockResolvedValue(null);

      const result = await service.updateKnowledge('nonexistent', { title: 'X' });

      expect(result).toBeNull();
      expect(mockPrisma.aiModuleKnowledge.update).not.toHaveBeenCalled();
    });
  });

  // ─── deleteKnowledge ──────────────────────────────────────────────────

  describe('deleteKnowledge()', () => {
    it('deletes existing knowledge and returns true', async () => {
      mockPrisma.aiModuleKnowledge.findUnique.mockResolvedValue(makeKnowledge());
      mockPrisma.aiModuleKnowledge.delete.mockResolvedValue(makeKnowledge());

      const result = await service.deleteKnowledge('know-1');

      expect(result).toBe(true);
      expect(mockPrisma.aiModuleKnowledge.delete).toHaveBeenCalledWith({
        where: { id: 'know-1' },
      });
    });

    it('returns false when knowledge not found', async () => {
      mockPrisma.aiModuleKnowledge.findUnique.mockResolvedValue(null);

      const result = await service.deleteKnowledge('nonexistent');

      expect(result).toBe(false);
      expect(mockPrisma.aiModuleKnowledge.delete).not.toHaveBeenCalled();
    });
  });
});
