import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock PrismaClient — matches the query patterns used by views-query-handlers
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    dataView: {
      findFirst: vi.fn(),
    },
    savedView: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock QueryExecutor — captures registered handlers for direct invocation
const { registeredHandlers, mockQueryExecutor } = vi.hoisted(() => {
  const handlers = new Map<string, any>();
  return {
    registeredHandlers: handlers,
    mockQueryExecutor: {
      registerHandler: vi.fn((name: string, handler: any) => {
        handlers.set(name, handler);
      }),
    },
  };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { registerViewsQueryHandlers } from './views-query-handlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-test-1';
const TEST_USER_ID = 'user-test-1';

function getHandler(name: string) {
  const handler = registeredHandlers.get(name);
  if (!handler) throw new Error(`Handler "${name}" not registered`);
  return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('views-query-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();

    // Register handlers — creates closures that capture mockPrisma as the db instance
    registerViewsQueryHandlers(mockQueryExecutor as any, mockPrisma as any);
  });

  // ─── Registration ───────────────────────────────────────────────────────

  describe('registerViewsQueryHandlers', () => {
    it('registers all 3 query handlers', () => {
      expect(mockQueryExecutor.registerHandler).toHaveBeenCalledTimes(3);
      expect(mockQueryExecutor.registerHandler).toHaveBeenCalledWith(
        'open_entity_list',
        expect.any(Function),
      );
      expect(mockQueryExecutor.registerHandler).toHaveBeenCalledWith(
        'search_views',
        expect.any(Function),
      );
      expect(mockQueryExecutor.registerHandler).toHaveBeenCalledWith(
        'list_saved_views',
        expect.any(Function),
      );
    });
  });

  // ─── openEntityListHandler ──────────────────────────────────────────────

  describe('openEntityListHandler', () => {
    it('returns DataView details for a valid viewKey', async () => {
      mockPrisma.dataView.findFirst.mockResolvedValue({
        id: 'dv-1',
        viewKey: 'INVOICES',
        viewName: 'Invoices',
        entityTable: 'Invoice',
      });

      const handler = getHandler('open_entity_list');
      const result = await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'INVOICES' },
      });

      expect(result).toEqual({
        data: {
          viewKey: 'INVOICES',
          viewName: 'Invoices',
          entityTable: 'Invoice',
        },
        rowCount: 1,
      });
    });

    it('returns error when DataView not found', async () => {
      mockPrisma.dataView.findFirst.mockResolvedValue(null);

      const handler = getHandler('open_entity_list');
      const result = await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'NONEXISTENT' },
      });

      expect(result.data).toEqual({
        error: 'No active data view found for viewKey: NONEXISTENT',
      });
      expect(result.rowCount).toBe(0);
    });

    it('returns DataView with savedView when savedViewName is provided', async () => {
      mockPrisma.dataView.findFirst.mockResolvedValue({
        id: 'dv-1',
        viewKey: 'INVOICES',
        viewName: 'Invoices',
        entityTable: 'Invoice',
      });

      mockPrisma.savedView.findFirst.mockResolvedValue({
        id: 'sv-1',
        name: 'Overdue Invoices',
        scope: 'GLOBAL',
        _count: { conditions: 3 },
      });

      const handler = getHandler('open_entity_list');
      const result = await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'INVOICES', savedViewName: 'Overdue' },
      });

      expect(result).toEqual({
        data: {
          viewKey: 'INVOICES',
          viewName: 'Invoices',
          entityTable: 'Invoice',
          savedView: {
            id: 'sv-1',
            name: 'Overdue Invoices',
            filterCount: 3,
            scope: 'GLOBAL',
          },
        },
        rowCount: 1,
      });
    });

    it('returns DataView without savedView when savedViewName does not match', async () => {
      mockPrisma.dataView.findFirst.mockResolvedValue({
        id: 'dv-1',
        viewKey: 'INVOICES',
        viewName: 'Invoices',
        entityTable: 'Invoice',
      });

      mockPrisma.savedView.findFirst.mockResolvedValue(null);

      const handler = getHandler('open_entity_list');
      const result = await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'INVOICES', savedViewName: 'NonExistent' },
      });

      expect(result).toEqual({
        data: {
          viewKey: 'INVOICES',
          viewName: 'Invoices',
          entityTable: 'Invoice',
        },
        rowCount: 1,
      });
      // Should NOT have a savedView key at all
      expect(result.data).not.toHaveProperty('savedView');
    });

    it('enforces companyId scoping on DataView query', async () => {
      mockPrisma.dataView.findFirst.mockResolvedValue(null);

      const handler = getHandler('open_entity_list');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'INVOICES' },
      });

      expect(mockPrisma.dataView.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
          }),
        }),
      );
    });

    it('enforces companyId scoping on SavedView query', async () => {
      mockPrisma.dataView.findFirst.mockResolvedValue({
        id: 'dv-1',
        viewKey: 'INVOICES',
        viewName: 'Invoices',
        entityTable: 'Invoice',
      });
      mockPrisma.savedView.findFirst.mockResolvedValue(null);

      const handler = getHandler('open_entity_list');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'INVOICES', savedViewName: 'Overdue' },
      });

      expect(mockPrisma.savedView.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
          }),
        }),
      );
    });

    it('includes scope-based visibility filter (GLOBAL, PERSONAL, ROLE) on SavedView query', async () => {
      mockPrisma.dataView.findFirst.mockResolvedValue({
        id: 'dv-1',
        viewKey: 'INVOICES',
        viewName: 'Invoices',
        entityTable: 'Invoice',
      });
      mockPrisma.savedView.findFirst.mockResolvedValue(null);

      const handler = getHandler('open_entity_list');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'INVOICES', savedViewName: 'Overdue' },
      });

      const callArgs = mockPrisma.savedView.findFirst.mock.calls[0]![0];
      const orClause = callArgs.where.OR;

      // Verify all 3 scope branches are present
      expect(orClause).toHaveLength(3);
      expect(orClause).toEqual(
        expect.arrayContaining([
          { scope: 'GLOBAL' },
          { scope: 'PERSONAL', createdBy: TEST_USER_ID },
          {
            scope: 'ROLE',
            role: {
              userAccessGroups: { some: { userId: TEST_USER_ID, companyId: TEST_COMPANY_ID } },
            },
          },
        ]),
      );
    });
  });

  // ─── searchViewsHandler ─────────────────────────────────────────────────

  describe('searchViewsHandler', () => {
    it('returns matching saved views', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([
        {
          id: 'sv-1',
          name: 'Overdue 30 Days',
          scope: 'GLOBAL',
          dataView: { viewKey: 'INVOICES', viewName: 'Invoices' },
          _count: { conditions: 2 },
        },
        {
          id: 'sv-2',
          name: 'Overdue 60 Days',
          scope: 'PERSONAL',
          dataView: { viewKey: 'INVOICES', viewName: 'Invoices' },
          _count: { conditions: 3 },
        },
      ]);

      const handler = getHandler('search_views');
      const result = await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { query: 'overdue' },
      });

      expect(result.data).toHaveLength(2);
      expect(result.rowCount).toBe(2);
      expect(result.data).toEqual([
        {
          id: 'sv-1',
          name: 'Overdue 30 Days',
          viewKey: 'INVOICES',
          viewName: 'Invoices',
          scope: 'GLOBAL',
          filterCount: 2,
        },
        {
          id: 'sv-2',
          name: 'Overdue 60 Days',
          viewKey: 'INVOICES',
          viewName: 'Invoices',
          scope: 'PERSONAL',
          filterCount: 3,
        },
      ]);
    });

    it('returns empty array when no matches found', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('search_views');
      const result = await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { query: 'nonexistent' },
      });

      expect(result).toEqual({ data: [], rowCount: 0 });
    });

    it('enforces companyId scoping', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('search_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { query: 'test' },
      });

      expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
          }),
        }),
      );
    });

    it('includes scope-based visibility filter (GLOBAL, PERSONAL, ROLE)', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('search_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { query: 'test' },
      });

      const callArgs = mockPrisma.savedView.findMany.mock.calls[0]![0];
      const orClause = callArgs.where.OR;

      expect(orClause).toHaveLength(3);
      expect(orClause).toEqual(
        expect.arrayContaining([
          { scope: 'GLOBAL' },
          { scope: 'PERSONAL', createdBy: TEST_USER_ID },
          {
            scope: 'ROLE',
            role: {
              userAccessGroups: { some: { userId: TEST_USER_ID, companyId: TEST_COMPANY_ID } },
            },
          },
        ]),
      );
    });

    it('limits results to 10', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('search_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { query: 'test' },
      });

      expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });
  });

  // ─── listSavedViewsHandler ──────────────────────────────────────────────

  describe('listSavedViewsHandler', () => {
    it('returns all visible views', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([
        {
          id: 'sv-1',
          name: 'My Personal View',
          scope: 'PERSONAL',
          isDefault: false,
          isFavourite: true,
          dataView: { viewKey: 'INVOICES', viewName: 'Invoices' },
        },
        {
          id: 'sv-2',
          name: 'Admin Role View',
          scope: 'ROLE',
          isDefault: false,
          isFavourite: false,
          dataView: { viewKey: 'INVOICES', viewName: 'Invoices' },
        },
        {
          id: 'sv-3',
          name: 'Global Default',
          scope: 'GLOBAL',
          isDefault: true,
          isFavourite: false,
          dataView: { viewKey: 'CUSTOMERS', viewName: 'Customers' },
        },
      ]);

      const handler = getHandler('list_saved_views');
      const result = await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: {},
      });

      expect(result.data).toHaveLength(3);
      expect(result.rowCount).toBe(3);
      expect(result.data).toEqual([
        {
          id: 'sv-1',
          name: 'My Personal View',
          viewKey: 'INVOICES',
          viewName: 'Invoices',
          scope: 'PERSONAL',
          isDefault: false,
          isFavourite: true,
        },
        {
          id: 'sv-2',
          name: 'Admin Role View',
          viewKey: 'INVOICES',
          viewName: 'Invoices',
          scope: 'ROLE',
          isDefault: false,
          isFavourite: false,
        },
        {
          id: 'sv-3',
          name: 'Global Default',
          viewKey: 'CUSTOMERS',
          viewName: 'Customers',
          scope: 'GLOBAL',
          isDefault: true,
          isFavourite: false,
        },
      ]);
    });

    it('filters by viewKey when provided', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('list_saved_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: { viewKey: 'INVOICES' },
      });

      expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
            dataView: { viewKey: 'INVOICES' },
          }),
        }),
      );
    });

    it('does not include dataView filter when viewKey is not provided', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('list_saved_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: {},
      });

      const callArgs = mockPrisma.savedView.findMany.mock.calls[0]![0];
      expect(callArgs.where).not.toHaveProperty('dataView');
    });

    it('enforces companyId scoping', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('list_saved_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: {},
      });

      expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: TEST_COMPANY_ID,
          }),
        }),
      );
    });

    it('includes scope-based visibility filter (GLOBAL, PERSONAL, ROLE)', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('list_saved_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: {},
      });

      const callArgs = mockPrisma.savedView.findMany.mock.calls[0]![0];
      const orClause = callArgs.where.OR;

      expect(orClause).toHaveLength(3);
      expect(orClause).toEqual(
        expect.arrayContaining([
          { scope: 'GLOBAL' },
          { scope: 'PERSONAL', createdBy: TEST_USER_ID },
          {
            scope: 'ROLE',
            role: {
              userAccessGroups: { some: { userId: TEST_USER_ID, companyId: TEST_COMPANY_ID } },
            },
          },
        ]),
      );
    });

    it('orders results by name ascending', async () => {
      mockPrisma.savedView.findMany.mockResolvedValue([]);

      const handler = getHandler('list_saved_views');
      await handler({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        input: {},
      });

      expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });
  });
});
