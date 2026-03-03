// Views module query tool handlers — READ-only handlers for views skill pack
// Registered at API startup via registerViewsQueryHandlers()

import type { PrismaClient } from '@nexa/db';
import type { QueryToolHandler } from '@nexa/ai-tools';
import type { QueryExecutor } from '../query-executor.js';

// ─── Shared visibility filter ────────────────────────────────────────────────

/**
 * Build the SavedView scope-based visibility filter clause.
 * PERSONAL → creator only, ROLE → user belongs to the view's AccessGroup, GLOBAL → all.
 *
 * The ROLE filter traverses: SavedView.role (AccessGroup) → AccessGroup.userAccessGroups
 * (UserAccessGroup[]) → checks that the current user+company has a matching assignment.
 */
function visibilityFilter(userId: string, companyId: string) {
  return [
    { scope: 'GLOBAL' as const },
    { scope: 'PERSONAL' as const, createdBy: userId },
    {
      scope: 'ROLE' as const,
      role: {
        userAccessGroups: { some: { userId, companyId } },
      },
    },
  ];
}

// ─── Handler factories ───────────────────────────────────────────────────────
// Each factory captures the PrismaClient via closure and returns a typed
// QueryToolHandler. This avoids shared mutable state and preserves type safety.

/**
 * Look up a DataView by viewKey, optionally resolving a SavedView by name.
 * Returns view metadata the AI can use to navigate the user.
 */
function createOpenEntityListHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, userId, input }) => {
    const viewKey = input.viewKey as string;
    const savedViewName = input.savedViewName as string | undefined;

    const dataView = await db.dataView.findFirst({
      where: { companyId, viewKey, isActive: true },
      select: {
        id: true,
        viewKey: true,
        viewName: true,
        entityTable: true,
      },
    });

    if (!dataView) {
      return {
        data: { error: `No active data view found for viewKey: ${viewKey}` },
        rowCount: 0,
      };
    }

    let savedView:
      | {
          id: string;
          name: string;
          filterCount: number;
          scope: string;
        }
      | undefined;

    if (savedViewName) {
      const sv = await db.savedView.findFirst({
        where: {
          companyId,
          dataViewId: dataView.id,
          name: { contains: savedViewName, mode: 'insensitive' },
          OR: visibilityFilter(userId, companyId),
        },
        select: {
          id: true,
          name: true,
          scope: true,
          _count: { select: { conditions: true } },
        },
      });

      if (sv) {
        savedView = {
          id: sv.id,
          name: sv.name,
          filterCount: sv._count.conditions,
          scope: sv.scope,
        };
      }
    }

    return {
      data: {
        viewKey: dataView.viewKey,
        viewName: dataView.viewName,
        entityTable: dataView.entityTable,
        ...(savedView ? { savedView } : {}),
      },
      rowCount: 1,
    };
  };
}

/**
 * Search SavedView records by name (case-insensitive), scoped by companyId
 * and user visibility (PERSONAL → creator only, ROLE → matching role, GLOBAL → all).
 * Returns max 10 results.
 */
function createSearchViewsHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, userId, input }) => {
    const query = input.query as string;

    const results = await db.savedView.findMany({
      where: {
        companyId,
        name: { contains: query, mode: 'insensitive' },
        OR: visibilityFilter(userId, companyId),
      },
      select: {
        id: true,
        name: true,
        scope: true,
        dataView: {
          select: {
            viewKey: true,
            viewName: true,
          },
        },
        _count: { select: { conditions: true } },
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    const data = results.map((sv) => ({
      id: sv.id,
      name: sv.name,
      viewKey: sv.dataView.viewKey,
      viewName: sv.dataView.viewName,
      scope: sv.scope,
      filterCount: sv._count.conditions,
    }));

    return { data, rowCount: data.length };
  };
}

/**
 * List all SavedView records visible to the user, optionally filtered by viewKey.
 * Scoped by companyId and user visibility.
 */
function createListSavedViewsHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, userId, input }) => {
    const viewKey = input.viewKey as string | undefined;

    // Build the base where clause with companyId scoping and visibility
    const where: Record<string, unknown> = {
      companyId,
      OR: visibilityFilter(userId, companyId),
    };

    // Optionally filter by viewKey via the DataView relation
    if (viewKey) {
      where.dataView = { viewKey };
    }

    const results = await db.savedView.findMany({
      where,
      select: {
        id: true,
        name: true,
        scope: true,
        isDefault: true,
        isFavourite: true,
        dataView: {
          select: {
            viewKey: true,
            viewName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = results.map((sv) => ({
      id: sv.id,
      name: sv.name,
      viewKey: sv.dataView.viewKey,
      viewName: sv.dataView.viewName,
      scope: sv.scope,
      isDefault: sv.isDefault,
      isFavourite: sv.isFavourite,
    }));

    return { data, rowCount: data.length };
  };
}

// ─── Registration ───────────────────────────────────────────────────────────

/**
 * Register all views query handlers with the QueryExecutor.
 * Called during API startup (from apps/api/src/ai/index.ts).
 *
 * Each handler captures the PrismaClient via closure. The QueryExecutor's
 * registerHandler() method sets the handler on an already-registered tool
 * definition (registered via registerViewsTools).
 */
export function registerViewsQueryHandlers(queryExecutor: QueryExecutor, db: PrismaClient): void {
  queryExecutor.registerHandler('open_entity_list', createOpenEntityListHandler(db));
  queryExecutor.registerHandler('search_views', createSearchViewsHandler(db));
  queryExecutor.registerHandler('list_saved_views', createListSavedViewsHandler(db));
}
