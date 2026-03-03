// ---------------------------------------------------------------------------
// EntitySearchService — Proxy for entity search across modules
// E5b-7 Task 1.2
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';

import type { EntityTriggerService, EntityTriggerRecord } from './entity-triggers.service.js';
import { NotFoundError } from '../core/errors/not-found-error.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface EntitySearchParams {
  type: string;
  q: string;
  companyId: string;
  userId: string;
  scopeBy?: string;
  scopeValue?: string;
}

export interface EntitySearchResult {
  id: string;
  displayName: string;
  subtitle: string | null;
  entityType: string;
}

// ─── Trigger cache (ISSUE #1 fix) ────────────────────────────────────────

/** Cache TTL in milliseconds (5 minutes — triggers rarely change) */
const TRIGGER_CACHE_TTL_MS = 5 * 60 * 1000;

interface TriggerCache {
  byEntityType: Map<string, EntityTriggerRecord>;
  fetchedAt: number;
}

// ─── Allowed field names per entity model (ISSUE #2 fix) ─────────────────
// Only these Prisma model fields can be used as displayField, subtitleField,
// or scopeBy in dynamic where/orderBy clauses. Prevents field injection.

const ALLOWED_FIELDS: Record<string, ReadonlySet<string>> = {
  DataView: new Set([
    'viewKey',
    'viewName',
    'entityTable',
    'defaultSortField',
    'defaultSortDir',
    'isActive',
    'createdBy',
    'updatedBy',
  ]),
  SavedView: new Set([
    'name',
    'groupName',
    'scope',
    'createdBy',
    'isFavourite',
    'isDefault',
    'dataViewId',
  ]),
};

function isAllowedField(entityType: string, fieldName: string): boolean {
  const allowed = ALLOWED_FIELDS[entityType];
  return !!allowed && allowed.has(fieldName);
}

// ─── Service ──────────────────────────────────────────────────────────────

const MAX_RESULTS = 8;

export class EntitySearchService {
  private triggerCache: TriggerCache | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly entityTriggerService: EntityTriggerService,
    private readonly logger: Logger,
  ) {}

  /** Invalidate the trigger cache (called on trigger mutations) */
  invalidateTriggerCache(): void {
    this.triggerCache = null;
  }

  async search(params: EntitySearchParams): Promise<EntitySearchResult[]> {
    // 1. Look up the active entity trigger by entityType (cached — ISSUE #1 fix)
    const trigger = await this.resolveTrigger(params.type);

    if (!trigger) {
      throw new NotFoundError(
        'ENTITY_TYPE_NOT_FOUND',
        `No active entity trigger found for type "${params.type}"`,
        'ai.error.entityTypeNotFound',
        { type: params.type },
      );
    }

    // 2. Validate ALL dynamic fields against allowlist
    // displayField, subtitleField, and scopeBy are all used in dynamic Prisma
    // where/orderBy/property-access — every one must be in the allowlist.
    if (!isAllowedField(trigger.entityType, trigger.displayField)) {
      this.logger.warn(
        { entityType: trigger.entityType, field: 'displayField', value: trigger.displayField },
        'Entity trigger has disallowed displayField — rejecting search',
      );
      throw new NotFoundError(
        'ENTITY_SEARCH_NOT_SUPPORTED',
        `Entity search is not yet supported for type "${trigger.entityType}"`,
        'ai.error.entitySearchNotSupported',
        { type: trigger.entityType },
      );
    }

    if (trigger.subtitleField && !isAllowedField(trigger.entityType, trigger.subtitleField)) {
      this.logger.warn(
        { entityType: trigger.entityType, field: 'subtitleField', value: trigger.subtitleField },
        'Entity trigger has disallowed subtitleField — rejecting search',
      );
      throw new NotFoundError(
        'ENTITY_SEARCH_NOT_SUPPORTED',
        `Entity search is not yet supported for type "${trigger.entityType}"`,
        'ai.error.entitySearchNotSupported',
        { type: trigger.entityType },
      );
    }

    if (trigger.scopeBy && !isAllowedField(trigger.entityType, trigger.scopeBy)) {
      this.logger.warn(
        { entityType: trigger.entityType, field: 'scopeBy', value: trigger.scopeBy },
        'Entity trigger has disallowed scopeBy — rejecting search',
      );
      throw new NotFoundError(
        'ENTITY_SEARCH_NOT_SUPPORTED',
        `Entity search is not yet supported for type "${trigger.entityType}"`,
        'ai.error.entitySearchNotSupported',
        { type: trigger.entityType },
      );
    }

    // 3. Validate scopeBy against the trigger's declared scopeBy (ISSUE #4 fix)
    // Ignore client-provided scopeBy if it doesn't match the trigger's declared value
    let effectiveScopeBy: string | undefined;
    let effectiveScopeValue: string | undefined;
    if (
      params.scopeBy &&
      params.scopeValue &&
      trigger.scopeBy &&
      params.scopeBy === trigger.scopeBy
    ) {
      effectiveScopeBy = params.scopeBy;
      effectiveScopeValue = params.scopeValue;
    }

    // 4. Dispatch to the appropriate entity search handler
    const handler = ENTITY_SEARCH_HANDLERS[trigger.entityType];
    if (!handler) {
      throw new NotFoundError(
        'ENTITY_SEARCH_NOT_SUPPORTED',
        `Entity search is not yet supported for type "${trigger.entityType}"`,
        'ai.error.entitySearchNotSupported',
        { type: trigger.entityType },
      );
    }

    const results = await handler(this.db, {
      q: params.q,
      companyId: params.companyId,
      userId: params.userId,
      displayField: trigger.displayField,
      subtitleField: trigger.subtitleField,
      scopeBy: effectiveScopeBy,
      scopeValue: effectiveScopeValue,
    });

    this.logger.debug(
      { entityType: params.type, query: params.q, resultCount: results.length },
      'Entity search completed',
    );

    return results;
  }

  // ─── Trigger cache helpers (ISSUE #1 fix) ──────────────────────────────

  private async resolveTrigger(entityType: string): Promise<EntityTriggerRecord | undefined> {
    const now = Date.now();

    if (this.triggerCache && now - this.triggerCache.fetchedAt < TRIGGER_CACHE_TTL_MS) {
      return this.triggerCache.byEntityType.get(entityType);
    }

    const triggers = await this.entityTriggerService.listTriggers({ isActive: true });
    const byEntityType = new Map<string, EntityTriggerRecord>();
    for (const t of triggers) {
      if (!byEntityType.has(t.entityType)) {
        byEntityType.set(t.entityType, t);
      }
    }

    this.triggerCache = { byEntityType, fetchedAt: now };
    return byEntityType.get(entityType);
  }
}

// ---------------------------------------------------------------------------
// Entity search handlers — one per supported entity type
// Future module epics register additional handlers here
// ---------------------------------------------------------------------------

interface SearchHandlerParams {
  q: string;
  companyId: string;
  userId: string;
  displayField: string;
  subtitleField: string | null;
  scopeBy?: string;
  scopeValue?: string;
}

type SearchHandler = (
  db: PrismaClient,
  params: SearchHandlerParams,
) => Promise<EntitySearchResult[]>;

const ENTITY_SEARCH_HANDLERS: Record<string, SearchHandler> = {
  DataView: searchDataViews,
  SavedView: searchSavedViews,
};

// ---------------------------------------------------------------------------
// DataView search handler
// ---------------------------------------------------------------------------

async function searchDataViews(
  db: PrismaClient,
  params: SearchHandlerParams,
): Promise<EntitySearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
  const where: any = {
    companyId: params.companyId,
    isActive: true,
    [params.displayField]: {
      contains: params.q,
      mode: 'insensitive',
    },
  };

  if (params.scopeBy && params.scopeValue) {
    where[params.scopeBy] = params.scopeValue;
  }

  const rows = await db.dataView.findMany({
    where,
    take: MAX_RESULTS,
    orderBy: { [params.displayField]: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    displayName: (row as Record<string, unknown>)[params.displayField] as string,
    subtitle: params.subtitleField
      ? (((row as Record<string, unknown>)[params.subtitleField] as string | null) ?? null)
      : null,
    entityType: 'DataView',
  }));
}

// ---------------------------------------------------------------------------
// SavedView search handler (ISSUE #3 fix — filter by scope/createdBy)
// ---------------------------------------------------------------------------

async function searchSavedViews(
  db: PrismaClient,
  params: SearchHandlerParams,
): Promise<EntitySearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
  const where: any = {
    companyId: params.companyId,
    [params.displayField]: {
      contains: params.q,
      mode: 'insensitive',
    },
    // ISSUE #3 fix: Only return views the user is allowed to see.
    // PERSONAL views are only visible to their creator.
    // SHARED and COMPANY views are visible to all in the company.
    OR: [{ scope: { not: 'PERSONAL' } }, { scope: 'PERSONAL', createdBy: params.userId }],
  };

  if (params.scopeBy && params.scopeValue) {
    where[params.scopeBy] = params.scopeValue;
  }

  const rows = await db.savedView.findMany({
    where,
    take: MAX_RESULTS,
    orderBy: { [params.displayField]: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    displayName: (row as Record<string, unknown>)[params.displayField] as string,
    subtitle: params.subtitleField
      ? (((row as Record<string, unknown>)[params.subtitleField] as string | null) ?? null)
      : null,
    entityType: 'SavedView',
  }));
}
