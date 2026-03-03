import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiSkill: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aiSkillOverride: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

import { SkillsService } from './skills.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultCompanyId = 'company-1';

function createService() {
  return new SkillsService(mockPrisma as any, mockLogger as any);
}

function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'skill-1',
    name: 'create_invoice',
    displayName: 'Create Invoice',
    description: 'Creates a new invoice',
    category: 'ar',
    skillContent: 'You create invoices for the AR module.',
    triggerPhrases: ['create invoice', 'new invoice'],
    inputSchema: { type: 'object', properties: {} },
    outputType: 'invoice',
    requiredTools: ['get_customers'],
    isActive: true,
    moduleKey: 'ar',
    packKey: 'ar-core',
    negativeTriggers: [],
    contextRequired: [],
    parameters: null,
    examples: null,
    priority: 100,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillsService', () => {
  let service: SkillsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
    mockPrisma.aiSkillOverride.findMany.mockResolvedValue([]);
  });

  // ─── listSkills ──────────────────────────────────────────────────────────

  describe('listSkills()', () => {
    it('returns all skills ordered by priority desc, name asc', async () => {
      const skills = [
        makeSkill({ id: 'skill-1', priority: 200 }),
        makeSkill({ id: 'skill-2', priority: 100 }),
      ];
      mockPrisma.aiSkill.findMany.mockResolvedValue(skills);

      const result = await service.listSkills(defaultCompanyId);

      expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('filters by moduleKey', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([makeSkill()]);

      await service.listSkills(defaultCompanyId, { moduleKey: 'ar' });

      expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleKey: 'ar' },
        }),
      );
    });

    it('applies tenant overrides — disabled skills included with isActive false', async () => {
      const skills = [makeSkill({ id: 'skill-1' }), makeSkill({ id: 'skill-2' })];
      mockPrisma.aiSkill.findMany.mockResolvedValue(skills);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([
        { skillId: 'skill-1', isActive: false, triggerPhrasesOverride: [], priorityOverride: null },
      ]);

      const result = await service.listSkills(defaultCompanyId);

      // CRUD listing returns ALL skills so admins can manage and re-enable them
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('skill-1');
      expect(result[0]!.isActive).toBe(false);
      expect(result[1]!.id).toBe('skill-2');
      expect(result[1]!.isActive).toBe(true);
    });

    it('applies tenant overrides — trigger phrases replaced', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([makeSkill()]);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([
        {
          skillId: 'skill-1',
          isActive: null,
          triggerPhrasesOverride: ['custom trigger'],
          priorityOverride: null,
        },
      ]);

      const result = await service.listSkills(defaultCompanyId);

      expect(result[0]!.triggerPhrases).toEqual(['custom trigger']);
    });

    it('applies tenant overrides — priority overridden', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([makeSkill({ priority: 100 })]);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([
        {
          skillId: 'skill-1',
          isActive: null,
          triggerPhrasesOverride: [],
          priorityOverride: 999,
        },
      ]);

      const result = await service.listSkills(defaultCompanyId);

      expect(result[0]!.priority).toBe(999);
    });
  });

  // ─── getSkill ────────────────────────────────────────────────────────────

  describe('getSkill()', () => {
    it('returns skill with tenant override applied', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeSkill());
      mockPrisma.aiSkillOverride.findUnique.mockResolvedValue(null);

      const result = await service.getSkill('skill-1', defaultCompanyId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('skill-1');
    });

    it('returns null when skill not found', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

      const result = await service.getSkill('nonexistent', defaultCompanyId);

      expect(result).toBeNull();
    });

    it('returns skill with isActive false when override disables it', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeSkill());
      mockPrisma.aiSkillOverride.findUnique.mockResolvedValue({
        isActive: false,
        triggerPhrasesOverride: [],
        priorityOverride: null,
      });

      const result = await service.getSkill('skill-1', defaultCompanyId);

      // CRUD endpoint returns disabled skills so admins can manage them
      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(false);
    });
  });

  // ─── createSkill ─────────────────────────────────────────────────────────

  describe('createSkill()', () => {
    it('creates a skill with all fields', async () => {
      const created = makeSkill();
      mockPrisma.aiSkill.create.mockResolvedValue(created);

      const result = await service.createSkill({
        name: 'create_invoice',
        displayName: 'Create Invoice',
        category: 'ar',
        skillContent: 'You create invoices for the AR module.',
        triggerPhrases: ['create invoice'],
        inputSchema: { type: 'object', properties: {} },
        outputType: 'invoice',
        requiredTools: [],
      });

      expect(mockPrisma.aiSkill.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'create_invoice',
          displayName: 'Create Invoice',
          isActive: true,
          priority: 100,
        }),
      });
      expect(result.id).toBe('skill-1');
    });

    it('uses default values for optional fields', async () => {
      mockPrisma.aiSkill.create.mockResolvedValue(makeSkill());

      await service.createSkill({
        name: 'test',
        displayName: 'Test',
        category: 'test',
        skillContent: 'test content',
        triggerPhrases: [],
        inputSchema: { type: 'object', properties: {} },
        outputType: 'text',
        requiredTools: [],
      });

      expect(mockPrisma.aiSkill.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
          negativeTriggers: [],
          contextRequired: [],
          parameters: null,
          examples: null,
          priority: 100,
        }),
      });
    });
  });

  // ─── updateSkill ─────────────────────────────────────────────────────────

  describe('updateSkill()', () => {
    it('updates only the provided fields', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeSkill());
      mockPrisma.aiSkill.update.mockResolvedValue(makeSkill({ displayName: 'Updated Name' }));

      const result = await service.updateSkill('skill-1', { displayName: 'Updated Name' });

      expect(mockPrisma.aiSkill.update).toHaveBeenCalledWith({
        where: { id: 'skill-1' },
        data: { displayName: 'Updated Name' },
      });
      expect(result).not.toBeNull();
    });

    it('returns null when skill not found', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

      const result = await service.updateSkill('nonexistent', { displayName: 'X' });

      expect(result).toBeNull();
      expect(mockPrisma.aiSkill.update).not.toHaveBeenCalled();
    });
  });

  // ─── deleteSkill ─────────────────────────────────────────────────────────

  describe('deleteSkill()', () => {
    it('deletes existing skill and returns true', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeSkill());
      mockPrisma.aiSkill.delete.mockResolvedValue(makeSkill());

      const result = await service.deleteSkill('skill-1');

      expect(result).toBe(true);
      expect(mockPrisma.aiSkill.delete).toHaveBeenCalledWith({ where: { id: 'skill-1' } });
    });

    it('returns false when skill not found', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

      const result = await service.deleteSkill('nonexistent');

      expect(result).toBe(false);
      expect(mockPrisma.aiSkill.delete).not.toHaveBeenCalled();
    });
  });
});
