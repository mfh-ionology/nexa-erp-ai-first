import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiEntityTrigger: {
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

import { EntityTriggerService } from './entity-triggers.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new EntityTriggerService(mockPrisma as any, mockLogger as any);
}

function makeTrigger(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trigger-1',
    moduleKey: 'ar',
    triggerWord: 'invoice',
    entityType: 'Invoice',
    searchEndpoint: '/api/ar/invoices/search',
    displayField: 'invoiceNumber',
    subtitleField: 'customerName',
    scopeBy: 'companyId',
    icon: 'file-text',
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

describe('EntityTriggerService', () => {
  let service: EntityTriggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── listTriggers ────────────────────────────────────────────────────────

  describe('listTriggers()', () => {
    it('returns all triggers ordered by priority desc, triggerWord asc', async () => {
      const triggers = [
        makeTrigger({ id: 't-1', priority: 200 }),
        makeTrigger({ id: 't-2', priority: 100 }),
      ];
      mockPrisma.aiEntityTrigger.findMany.mockResolvedValue(triggers);

      const result = await service.listTriggers();

      expect(mockPrisma.aiEntityTrigger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { triggerWord: 'asc' }],
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('filters by moduleKey', async () => {
      mockPrisma.aiEntityTrigger.findMany.mockResolvedValue([makeTrigger()]);

      await service.listTriggers({ moduleKey: 'ar' });

      expect(mockPrisma.aiEntityTrigger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleKey: 'ar' },
        }),
      );
    });

    it('returns empty array when no triggers exist', async () => {
      mockPrisma.aiEntityTrigger.findMany.mockResolvedValue([]);

      const result = await service.listTriggers();

      expect(result).toEqual([]);
    });
  });

  // ─── createTrigger ──────────────────────────────────────────────────────

  describe('createTrigger()', () => {
    it('creates a trigger with all fields', async () => {
      mockPrisma.aiEntityTrigger.create.mockResolvedValue(makeTrigger());

      const result = await service.createTrigger({
        moduleKey: 'ar',
        triggerWord: 'invoice',
        entityType: 'Invoice',
        searchEndpoint: '/api/ar/invoices/search',
        displayField: 'invoiceNumber',
        subtitleField: 'customerName',
        scopeBy: 'companyId',
        icon: 'file-text',
      });

      expect(mockPrisma.aiEntityTrigger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          moduleKey: 'ar',
          triggerWord: 'invoice',
          entityType: 'Invoice',
          priority: 100,
          isActive: true,
        }),
      });
      expect(result.id).toBe('trigger-1');
    });

    it('uses default values for optional fields', async () => {
      mockPrisma.aiEntityTrigger.create.mockResolvedValue(
        makeTrigger({ subtitleField: null, scopeBy: null, icon: null }),
      );

      await service.createTrigger({
        moduleKey: 'finance',
        triggerWord: 'account',
        entityType: 'Account',
        searchEndpoint: '/api/finance/accounts/search',
        displayField: 'accountCode',
      });

      expect(mockPrisma.aiEntityTrigger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subtitleField: null,
          scopeBy: null,
          icon: null,
          priority: 100,
          isActive: true,
        }),
      });
    });

    it('rejects duplicate [moduleKey, triggerWord] — Prisma unique constraint', async () => {
      const uniqueError = new Error(
        'Unique constraint failed on the fields: (`moduleKey`,`triggerWord`)',
      );
      (uniqueError as any).code = 'P2002';
      mockPrisma.aiEntityTrigger.create.mockRejectedValue(uniqueError);

      await expect(
        service.createTrigger({
          moduleKey: 'ar',
          triggerWord: 'invoice',
          entityType: 'Invoice',
          searchEndpoint: '/api/ar/invoices/search',
          displayField: 'invoiceNumber',
        }),
      ).rejects.toThrow('Unique constraint');
    });
  });

  // ─── updateTrigger ──────────────────────────────────────────────────────

  describe('updateTrigger()', () => {
    it('updates only the provided fields', async () => {
      mockPrisma.aiEntityTrigger.findUnique.mockResolvedValue(makeTrigger());
      mockPrisma.aiEntityTrigger.update.mockResolvedValue(
        makeTrigger({ displayField: 'updatedField' }),
      );

      const result = await service.updateTrigger('trigger-1', {
        displayField: 'updatedField',
      });

      expect(mockPrisma.aiEntityTrigger.update).toHaveBeenCalledWith({
        where: { id: 'trigger-1' },
        data: { displayField: 'updatedField' },
      });
      expect(result).not.toBeNull();
    });

    it('returns null when trigger not found', async () => {
      mockPrisma.aiEntityTrigger.findUnique.mockResolvedValue(null);

      const result = await service.updateTrigger('nonexistent', { displayField: 'x' });

      expect(result).toBeNull();
      expect(mockPrisma.aiEntityTrigger.update).not.toHaveBeenCalled();
    });
  });

  // ─── deleteTrigger ──────────────────────────────────────────────────────

  describe('deleteTrigger()', () => {
    it('deletes existing trigger and returns true', async () => {
      mockPrisma.aiEntityTrigger.findUnique.mockResolvedValue(makeTrigger());
      mockPrisma.aiEntityTrigger.delete.mockResolvedValue(makeTrigger());

      const result = await service.deleteTrigger('trigger-1');

      expect(result).toBe(true);
      expect(mockPrisma.aiEntityTrigger.delete).toHaveBeenCalledWith({
        where: { id: 'trigger-1' },
      });
    });

    it('returns false when trigger not found', async () => {
      mockPrisma.aiEntityTrigger.findUnique.mockResolvedValue(null);

      const result = await service.deleteTrigger('nonexistent');

      expect(result).toBe(false);
      expect(mockPrisma.aiEntityTrigger.delete).not.toHaveBeenCalled();
    });
  });
});
