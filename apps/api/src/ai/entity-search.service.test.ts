import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEntityTriggerService, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    dataView: {
      findMany: vi.fn(),
    },
    savedView: {
      findMany: vi.fn(),
    },
  },
  mockEntityTriggerService: {
    listTriggers: vi.fn(),
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

import { EntitySearchService } from './entity-search.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new EntitySearchService(
    mockPrisma as any,
    mockEntityTriggerService as any,
    mockLogger as any,
  );
}

function makeTrigger(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trigger-1',
    moduleKey: 'datatable',
    triggerWord: 'view',
    entityType: 'DataView',
    searchEndpoint: '/api/v1/data-views/search',
    displayField: 'viewName',
    subtitleField: 'entityTable',
    scopeBy: null,
    icon: 'layout-list',
    priority: 100,
    isActive: true,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

function makeDataView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dv-1',
    companyId: 'company-1',
    viewName: 'Active Invoices',
    entityTable: 'customer_invoices',
    isActive: true,
    ...overrides,
  };
}

function makeSavedView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sv-1',
    companyId: 'company-1',
    name: 'Overdue View',
    groupName: 'Finance',
    scope: 'COMPANY',
    createdBy: 'user-1',
    ...overrides,
  };
}

const DEFAULT_SEARCH_PARAMS = {
  companyId: 'company-1',
  userId: 'user-1',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntitySearchService', () => {
  let service: EntitySearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── DataView search ───────────────────────────────────────────────────

  describe('search() — DataView', () => {
    it('returns results scoped by companyId', async () => {
      const trigger = makeTrigger();
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      const results = await service.search({
        type: 'DataView',
        q: 'Active',
        ...DEFAULT_SEARCH_PARAMS,
      });

      expect(mockPrisma.dataView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1',
          }),
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0]!.entityType).toBe('DataView');
    });

    it('applies q search filter (case-insensitive contains on display field)', async () => {
      const trigger = makeTrigger();
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      await service.search({
        type: 'DataView',
        q: 'active',
        ...DEFAULT_SEARCH_PARAMS,
      });

      expect(mockPrisma.dataView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            viewName: { contains: 'active', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('limits to 8 results', async () => {
      const trigger = makeTrigger();
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      await service.search({
        type: 'DataView',
        q: 'test',
        ...DEFAULT_SEARCH_PARAMS,
      });

      expect(mockPrisma.dataView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 8,
        }),
      );
    });

    it('maps results to { id, displayName, subtitle, entityType } format', async () => {
      const trigger = makeTrigger();
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([
        makeDataView({ id: 'dv-1', viewName: 'Active Invoices', entityTable: 'customer_invoices' }),
        makeDataView({ id: 'dv-2', viewName: 'Draft Orders', entityTable: null }),
      ]);

      const results = await service.search({
        type: 'DataView',
        q: 'view',
        ...DEFAULT_SEARCH_PARAMS,
      });

      expect(results).toEqual([
        {
          id: 'dv-1',
          displayName: 'Active Invoices',
          subtitle: 'customer_invoices',
          entityType: 'DataView',
        },
        {
          id: 'dv-2',
          displayName: 'Draft Orders',
          subtitle: null,
          entityType: 'DataView',
        },
      ]);
    });
  });

  // ─── SavedView search ──────────────────────────────────────────────────

  describe('search() — SavedView', () => {
    it('searches SavedView table for SavedView entity type', async () => {
      const trigger = makeTrigger({
        entityType: 'SavedView',
        triggerWord: 'saved view',
        displayField: 'name',
        subtitleField: 'groupName',
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.savedView.findMany.mockResolvedValue([
        makeSavedView({ id: 'sv-1', name: 'Overdue View', groupName: 'Finance' }),
      ]);

      const results = await service.search({
        type: 'SavedView',
        q: 'Overdue',
        ...DEFAULT_SEARCH_PARAMS,
      });

      expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1',
            name: { contains: 'Overdue', mode: 'insensitive' },
          }),
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'sv-1',
        displayName: 'Overdue View',
        subtitle: 'Finance',
        entityType: 'SavedView',
      });
    });

    it('filters SavedView by scope — excludes other users personal views (ISSUE #3)', async () => {
      const trigger = makeTrigger({
        entityType: 'SavedView',
        triggerWord: 'saved view',
        displayField: 'name',
        subtitleField: 'groupName',
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      await service.search({
        type: 'SavedView',
        q: 'test',
        ...DEFAULT_SEARCH_PARAMS,
      });

      // Verify the OR clause filtering scope
      const callArgs = mockPrisma.savedView.findMany.mock.calls[0]![0];
      expect(callArgs.where.OR).toEqual([
        { scope: { not: 'PERSONAL' } },
        { scope: 'PERSONAL', createdBy: 'user-1' },
      ]);
    });
  });

  // ─── Scope validation (ISSUE #4) ─────────────────────────────────────

  describe('search() — scopeBy validation', () => {
    it('ignores client scopeBy when it does not match trigger scopeBy', async () => {
      const trigger = makeTrigger({
        entityType: 'DataView',
        scopeBy: 'entityTable', // trigger declares entityTable (in allowlist)
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      await service.search({
        type: 'DataView',
        q: 'test',
        ...DEFAULT_SEARCH_PARAMS,
        scopeBy: 'createdBy', // client tries different field — should be ignored
        scopeValue: 'other-user-uuid',
      });

      // createdBy should NOT appear in the where clause since it doesn't match trigger.scopeBy
      const callArgs = mockPrisma.dataView.findMany.mock.calls[0]![0];
      expect(callArgs.where.createdBy).toBeUndefined();
      expect(callArgs.where.entityTable).toBeUndefined(); // also not applied, since client didn't send it
    });

    it('applies scopeBy when it matches trigger declaration', async () => {
      const trigger = makeTrigger({
        entityType: 'DataView',
        scopeBy: 'defaultSortField',
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      await service.search({
        type: 'DataView',
        q: 'test',
        ...DEFAULT_SEARCH_PARAMS,
        scopeBy: 'defaultSortField',
        scopeValue: 'some-uuid',
      });

      const callArgs = mockPrisma.dataView.findMany.mock.calls[0]![0];
      expect(callArgs.where.defaultSortField).toBe('some-uuid');
    });
  });

  // ─── Field validation (ISSUE #2) ─────────────────────────────────────

  describe('search() — field allowlist validation', () => {
    it('rejects trigger with disallowed displayField', async () => {
      const trigger = makeTrigger({
        entityType: 'DataView',
        displayField: 'password', // not in allowlist
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);

      await expect(
        service.search({
          type: 'DataView',
          q: 'test',
          ...DEFAULT_SEARCH_PARAMS,
        }),
      ).rejects.toThrow('Entity search is not yet supported');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ field: 'displayField', value: 'password' }),
        expect.stringContaining('disallowed displayField'),
      );
    });

    it('rejects trigger with disallowed subtitleField', async () => {
      const trigger = makeTrigger({
        entityType: 'DataView',
        displayField: 'viewName', // allowed
        subtitleField: 'internalSecret', // not in allowlist
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);

      await expect(
        service.search({
          type: 'DataView',
          q: 'test',
          ...DEFAULT_SEARCH_PARAMS,
        }),
      ).rejects.toThrow('Entity search is not yet supported');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ field: 'subtitleField', value: 'internalSecret' }),
        expect.stringContaining('disallowed subtitleField'),
      );
    });

    it('rejects trigger with disallowed scopeBy field', async () => {
      const trigger = makeTrigger({
        entityType: 'DataView',
        displayField: 'viewName', // allowed
        subtitleField: 'entityTable', // allowed
        scopeBy: 'deletedAt', // not in allowlist
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);

      await expect(
        service.search({
          type: 'DataView',
          q: 'test',
          ...DEFAULT_SEARCH_PARAMS,
        }),
      ).rejects.toThrow('Entity search is not yet supported');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ field: 'scopeBy', value: 'deletedAt' }),
        expect.stringContaining('disallowed scopeBy'),
      );
    });

    it('allows trigger with null subtitleField (no validation needed)', async () => {
      const trigger = makeTrigger({
        entityType: 'DataView',
        displayField: 'viewName',
        subtitleField: null,
        scopeBy: null,
      });
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      const results = await service.search({
        type: 'DataView',
        q: 'test',
        ...DEFAULT_SEARCH_PARAMS,
      });

      expect(results).toHaveLength(1);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  // ─── Caching (ISSUE #1) ──────────────────────────────────────────────

  describe('search() — trigger caching', () => {
    it('does not re-fetch triggers on second call within cache TTL', async () => {
      const trigger = makeTrigger();
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      await service.search({ type: 'DataView', q: 'test', ...DEFAULT_SEARCH_PARAMS });
      await service.search({ type: 'DataView', q: 'test2', ...DEFAULT_SEARCH_PARAMS });

      // listTriggers should only be called once (cached on second call)
      expect(mockEntityTriggerService.listTriggers).toHaveBeenCalledTimes(1);
    });

    it('invalidateTriggerCache forces re-fetch on next call', async () => {
      const trigger = makeTrigger();
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      await service.search({ type: 'DataView', q: 'test', ...DEFAULT_SEARCH_PARAMS });
      service.invalidateTriggerCache();
      await service.search({ type: 'DataView', q: 'test2', ...DEFAULT_SEARCH_PARAMS });

      expect(mockEntityTriggerService.listTriggers).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Error cases ───────────────────────────────────────────────────────

  describe('search() — error handling', () => {
    it('throws NotFoundError when entity type has no matching trigger', async () => {
      mockEntityTriggerService.listTriggers.mockResolvedValue([
        makeTrigger({ entityType: 'DataView' }),
      ]);

      await expect(
        service.search({
          type: 'NonExistentType',
          q: 'test',
          ...DEFAULT_SEARCH_PARAMS,
        }),
      ).rejects.toThrow('No active entity trigger found for type "NonExistentType"');
    });

    it('throws NotFoundError when entity type has no entry in the field allowlist', async () => {
      // FutureEntity has no ALLOWED_FIELDS entry, so displayField validation
      // rejects it before it can reach the handler lookup.
      mockEntityTriggerService.listTriggers.mockResolvedValue([
        makeTrigger({ entityType: 'FutureEntity', displayField: 'name' }),
      ]);

      await expect(
        service.search({
          type: 'FutureEntity',
          q: 'test',
          ...DEFAULT_SEARCH_PARAMS,
        }),
      ).rejects.toThrow('Entity search is not yet supported for type "FutureEntity"');

      // Verify the warn log was triggered (field validation path)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'FutureEntity', field: 'displayField' }),
        expect.stringContaining('disallowed displayField'),
      );
    });
  });

  // ─── Logging ───────────────────────────────────────────────────────────

  describe('search() — logging', () => {
    it('logs debug message on successful search', async () => {
      const trigger = makeTrigger();
      mockEntityTriggerService.listTriggers.mockResolvedValue([trigger]);
      mockPrisma.dataView.findMany.mockResolvedValue([makeDataView()]);

      await service.search({
        type: 'DataView',
        q: 'test',
        ...DEFAULT_SEARCH_PARAMS,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'DataView',
          query: 'test',
          resultCount: 1,
        }),
        'Entity search completed',
      );
    });
  });
});
