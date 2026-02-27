import type { PrismaClient, DataViewField } from '@nexa/db';
import type { Logger } from 'pino';
import type { BatchLovRequestItem, LovStaticValue } from './views.types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LOV_LIMIT = 50;

// ---------------------------------------------------------------------------
// LOV scope registry — maps lovScope identifiers to Prisma model configs
// ---------------------------------------------------------------------------

export interface LovScopeConfig {
  /** Prisma model accessor name (e.g. 'currency', 'department') */
  modelName: string;
  /** Field to use as the LOV value */
  valueField: string;
  /** Field to use as the LOV display label */
  labelField: string;
  /** Field name for dependent LOV filtering (parent FK) */
  parentField?: string;
  /** Whether the model is scoped by companyId */
  companyScoped: boolean;
  /** Field name for active filtering (omit if no active flag) */
  activeField?: string;
}

/**
 * Registry of supported LOV scopes.
 * New modules extend this registry as they are built (E14+ Finance, etc.).
 *
 * NOTE: Currency and Country use `code` as primary key (not uuid),
 * so they are NOT companyScoped — they are global reference data.
 */
export const LOV_SCOPE_REGISTRY: Record<string, LovScopeConfig> = {
  currencies: {
    modelName: 'currency',
    valueField: 'code',
    labelField: 'name',
    companyScoped: false,
    activeField: 'isActive',
  },
  countries: {
    modelName: 'country',
    valueField: 'code',
    labelField: 'name',
    companyScoped: false,
    activeField: 'isActive',
  },
  departments: {
    modelName: 'department',
    valueField: 'id',
    labelField: 'name',
    companyScoped: true,
    activeField: 'isActive',
  },
  paymentTerms: {
    modelName: 'paymentTerms',
    valueField: 'id',
    labelField: 'name',
    companyScoped: true,
    activeField: 'isActive',
  },
  vatCodes: {
    modelName: 'vatCode',
    valueField: 'id',
    labelField: 'name',
    companyScoped: true,
    activeField: 'isActive',
  },
  tags: {
    modelName: 'tag',
    valueField: 'id',
    labelField: 'name',
    parentField: 'tagType',
    companyScoped: true,
    activeField: 'isActive',
  },
  accessGroups: {
    modelName: 'accessGroup',
    valueField: 'id',
    labelField: 'name',
    companyScoped: true,
    activeField: 'isActive',
  },
};

// ---------------------------------------------------------------------------
// LovService — batch LOV fetching (AC: #6)
// ---------------------------------------------------------------------------

export class LovService {
  constructor(
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  /**
   * Batch-fetch LOV data for multiple fields in a single call.
   * Returns results keyed by fieldId.
   */
  async batchFetchLov(
    companyId: string,
    items: BatchLovRequestItem[],
  ): Promise<Record<string, LovStaticValue[]>> {
    // 1. Fetch field metadata for all requested fieldIds
    const fieldIds = [...new Set(items.map((i) => i.fieldId))];
    const fields = await this.db.dataViewField.findMany({
      where: { id: { in: fieldIds } },
    });
    const fieldMap = new Map(fields.map((f) => [f.id, f]));

    // 2. Process each item based on its lovType
    const results: Record<string, LovStaticValue[]> = {};

    await Promise.all(
      items.map(async (item) => {
        const field = fieldMap.get(item.fieldId);
        if (!field) {
          this.logger.warn({ fieldId: item.fieldId }, 'LOV requested for unknown field');
          results[item.fieldId] = [];
          return;
        }

        switch (field.lovType) {
          case 'STATIC':
            // STATIC LOVs are inline in lovStaticValues — should never
            // reach the server. Return empty if called.
            results[item.fieldId] = [];
            break;

          case 'GLOBAL':
          case 'VIEW_SPECIFIC':
            results[item.fieldId] = await this.fetchDynamicLov(companyId, item, field);
            break;

          default:
            // NONE or unknown — no LOV data
            results[item.fieldId] = [];
        }
      }),
    );

    return results;
  }

  /**
   * Fetch LOV values from a dynamically resolved Prisma model.
   * Supports server-side search, dependent filtering, and limit.
   */
  private async fetchDynamicLov(
    companyId: string,
    item: BatchLovRequestItem,
    field: DataViewField,
  ): Promise<LovStaticValue[]> {
    const config = LOV_SCOPE_REGISTRY[item.lovScope];
    if (!config) {
      this.logger.warn(
        { lovScope: item.lovScope, fieldId: item.fieldId },
        'Unknown LOV scope requested',
      );
      return [];
    }

    // Dynamic Prisma model access — use delegate type to satisfy strict checks
    type PrismaDelegate = {
      findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    };
    const model = (this.db as unknown as Record<string, PrismaDelegate | undefined>)[
      config.modelName
    ];
    if (!model) {
      this.logger.warn(
        { modelName: config.modelName, lovScope: item.lovScope },
        'LOV model not found on Prisma client',
      );
      return [];
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    // Company scoping (cross-cutting pattern)
    if (config.companyScoped) {
      where.companyId = companyId;
    }

    // Active filtering
    if (config.activeField) {
      where[config.activeField] = true;
    }

    // Server-side search (7.3)
    // Only apply when search is provided and meets lovSearchMin threshold.
    // lovSearchMin === 0 means "search from the first character" (no minimum).
    if (item.search && item.search.length > 0 && item.search.length >= field.lovSearchMin) {
      where[config.labelField] = {
        contains: item.search,
        mode: 'insensitive',
      };
    }

    // Dependent LOV filtering (7.4)
    // If parentValue is provided and field has lovDependsOn, filter by parent
    if (item.parentValue && field.lovDependsOn && config.parentField) {
      where[config.parentField] = item.parentValue;
    }

    const limit = item.limit ?? DEFAULT_LOV_LIMIT;

    try {
      const rows = await model.findMany({
        where,
        take: limit,
        orderBy: { [config.labelField]: 'asc' },
        select: {
          [config.valueField]: true,
          [config.labelField]: true,
        },
      });

      return rows.map((row) => ({
        value: String(row[config.valueField]),
        label: String(row[config.labelField]),
      }));
    } catch (error) {
      this.logger.error(
        { err: error, lovScope: item.lovScope, fieldId: item.fieldId },
        'Failed to fetch LOV data',
      );
      return [];
    }
  }

  /**
   * Fetch LOV values by scope directly (without field context).
   * Used by GET /views/lov/:lovScope where no specific field is referenced.
   */
  async fetchLovByScope(
    companyId: string,
    lovScope: string,
    search?: string,
    limit?: number,
  ): Promise<LovStaticValue[]> {
    const config = LOV_SCOPE_REGISTRY[lovScope];
    if (!config) {
      this.logger.warn({ lovScope }, 'Unknown LOV scope requested');
      return [];
    }

    type PrismaDelegate = {
      findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    };
    const model = (this.db as unknown as Record<string, PrismaDelegate | undefined>)[
      config.modelName
    ];
    if (!model) {
      this.logger.warn(
        { modelName: config.modelName, lovScope },
        'LOV model not found on Prisma client',
      );
      return [];
    }

    const where: Record<string, unknown> = {};
    if (config.companyScoped) {
      where.companyId = companyId;
    }
    if (config.activeField) {
      where[config.activeField] = true;
    }
    if (search && search.length > 0) {
      where[config.labelField] = { contains: search, mode: 'insensitive' };
    }

    const take = limit ?? DEFAULT_LOV_LIMIT;

    try {
      const rows = await model.findMany({
        where,
        take,
        orderBy: { [config.labelField]: 'asc' },
        select: { [config.valueField]: true, [config.labelField]: true },
      });
      return rows.map((row) => ({
        value: String(row[config.valueField]),
        label: String(row[config.labelField]),
      }));
    } catch (error) {
      this.logger.error({ err: error, lovScope }, 'Failed to fetch LOV data by scope');
      return [];
    }
  }
}
