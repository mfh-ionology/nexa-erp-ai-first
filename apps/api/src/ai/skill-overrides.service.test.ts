import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiSkill: {
      findUnique: vi.fn(),
    },
    aiSkillOverride: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
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

import { SkillOverrideService } from './skill-overrides.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSkillId = 'skill-1';
const defaultCompanyId = 'company-1';

function createService() {
  return new SkillOverrideService(mockPrisma as any, mockLogger as any);
}

function makeOverride(overrides: Record<string, unknown> = {}) {
  return {
    id: 'override-1',
    skillId: defaultSkillId,
    companyId: defaultCompanyId,
    isActive: null,
    triggerPhrasesOverride: [],
    priorityOverride: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillOverrideService', () => {
  let service: SkillOverrideService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── listOverrides ──────────────────────────────────────────────────────

  describe('listOverrides()', () => {
    it('returns all overrides for a company', async () => {
      const overrides = [
        makeOverride({ id: 'o-1', skillId: 'skill-1' }),
        makeOverride({ id: 'o-2', skillId: 'skill-2' }),
      ];
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue(overrides);

      const result = await service.listOverrides(defaultCompanyId);

      expect(mockPrisma.aiSkillOverride.findMany).toHaveBeenCalledWith({
        where: { companyId: defaultCompanyId },
        orderBy: [{ createdAt: 'desc' }],
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no overrides exist', async () => {
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([]);

      const result = await service.listOverrides('no-overrides-company');

      expect(result).toEqual([]);
    });
  });

  // ─── getOverride ──────────────────────────────────────────────────────

  describe('getOverride()', () => {
    it('returns override by skill+company composite key', async () => {
      mockPrisma.aiSkillOverride.findUnique.mockResolvedValue(makeOverride());

      const result = await service.getOverride(defaultSkillId, defaultCompanyId);

      expect(mockPrisma.aiSkillOverride.findUnique).toHaveBeenCalledWith({
        where: { skillId_companyId: { skillId: defaultSkillId, companyId: defaultCompanyId } },
      });
      expect(result).not.toBeNull();
      expect(result!.skillId).toBe(defaultSkillId);
    });

    it('returns null when override not found', async () => {
      mockPrisma.aiSkillOverride.findUnique.mockResolvedValue(null);

      const result = await service.getOverride('nonexistent', defaultCompanyId);

      expect(result).toBeNull();
    });
  });

  // ─── upsertOverride ────────────────────────────────────────────────────

  describe('upsertOverride()', () => {
    it('creates a new override when none exists', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue({ id: defaultSkillId, name: 'test' });
      mockPrisma.aiSkillOverride.upsert.mockResolvedValue(makeOverride({ isActive: false }));

      const result = await service.upsertOverride(defaultSkillId, defaultCompanyId, {
        isActive: false,
      });

      expect(mockPrisma.aiSkillOverride.upsert).toHaveBeenCalledWith({
        where: { skillId_companyId: { skillId: defaultSkillId, companyId: defaultCompanyId } },
        create: expect.objectContaining({
          skillId: defaultSkillId,
          companyId: defaultCompanyId,
          isActive: false,
        }),
        update: expect.objectContaining({
          isActive: false,
        }),
      });
      expect(result.isActive).toBe(false);
    });

    it('updates an existing override', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue({ id: defaultSkillId, name: 'test' });
      mockPrisma.aiSkillOverride.upsert.mockResolvedValue(
        makeOverride({
          triggerPhrasesOverride: ['custom phrase'],
          priorityOverride: 500,
        }),
      );

      const result = await service.upsertOverride(defaultSkillId, defaultCompanyId, {
        triggerPhrasesOverride: ['custom phrase'],
        priorityOverride: 500,
      });

      expect(result.triggerPhrasesOverride).toEqual(['custom phrase']);
      expect(result.priorityOverride).toBe(500);
    });

    it('throws when skill does not exist', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertOverride('nonexistent', defaultCompanyId, { isActive: false }),
      ).rejects.toThrow('Skill nonexistent not found');
    });
  });

  // ─── deleteOverride ────────────────────────────────────────────────────

  describe('deleteOverride()', () => {
    it('deletes existing override and returns true', async () => {
      mockPrisma.aiSkillOverride.findUnique.mockResolvedValue(makeOverride());
      mockPrisma.aiSkillOverride.delete.mockResolvedValue(makeOverride());

      const result = await service.deleteOverride(defaultSkillId, defaultCompanyId);

      expect(result).toBe(true);
      expect(mockPrisma.aiSkillOverride.delete).toHaveBeenCalledWith({
        where: { skillId_companyId: { skillId: defaultSkillId, companyId: defaultCompanyId } },
      });
    });

    it('returns false when override not found', async () => {
      mockPrisma.aiSkillOverride.findUnique.mockResolvedValue(null);

      const result = await service.deleteOverride('nonexistent', defaultCompanyId);

      expect(result).toBe(false);
      expect(mockPrisma.aiSkillOverride.delete).not.toHaveBeenCalled();
    });
  });
});
