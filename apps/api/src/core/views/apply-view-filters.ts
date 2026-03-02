/**
 * Reusable helper — converts serialized filter conditions from API query params
 * into a Prisma `where` clause using the metadata-driven filter builder.
 *
 * Usage in any entity list endpoint:
 *   const filterWhere = await applyViewFilters(prisma, companyId, 'USERS', conditionsJson, filterLogic);
 *   const where = { companyId, ...filterWhere };
 *
 * Created per E7-5 Task 1.4.
 */

import type { PrismaClient } from '@nexa/db';

import {
  buildPrismaWhere,
  type FilterCondition,
  type FieldMetadata,
  type DatePresetInfo,
} from './filter-builder.js';

/**
 * Parses JSON-encoded filter conditions from a query param string,
 * loads the DataViewField metadata for the given viewKey,
 * and returns a Prisma-compatible `where` clause.
 *
 * Returns `{}` if no conditions are provided or if parsing fails.
 *
 * @param prisma - PrismaClient instance
 * @param companyId - Current company scope
 * @param viewKey - The DataView key (e.g., 'USERS', 'ACCESS_GROUPS')
 * @param conditionsJson - JSON-encoded FilterCondition[] from query params
 * @param filterLogic - Top-level logic ('AND' or 'OR')
 * @returns Prisma-compatible where clause to MERGE with existing where (not replace)
 */
export async function applyViewFilters(
  prisma: PrismaClient,
  companyId: string,
  viewKey: string,
  conditionsJson: string | undefined,
  filterLogic: 'AND' | 'OR' = 'AND',
): Promise<Record<string, unknown>> {
  if (!conditionsJson) return {};

  // Parse conditions JSON
  let conditions: FilterCondition[];
  try {
    conditions = JSON.parse(conditionsJson) as FilterCondition[];
  } catch {
    return {};
  }

  if (!Array.isArray(conditions) || conditions.length === 0) return {};

  // Load DataView + field metadata for this viewKey
  const dataView = await prisma.dataView.findFirst({
    where: { companyId, viewKey },
    include: {
      fields: {
        where: { isActive: true, filterable: true },
        select: { id: true, fieldKey: true, fieldType: true },
      },
    },
  });

  if (!dataView) return {};

  // Build field metadata map (keyed by field ID)
  const fieldMap = new Map<string, FieldMetadata>(
    dataView.fields.map((f) => [f.id, { id: f.id, fieldKey: f.fieldKey, fieldType: f.fieldType }]),
  );

  // Load date presets for date field resolution
  const presets = await prisma.dateRangePreset.findMany({
    where: { companyId, isActive: true },
    select: { id: true, presetKey: true },
  });
  const datePresetsMap = new Map<string, DatePresetInfo>(
    presets.map((p) => [p.id, { id: p.id, presetKey: p.presetKey }]),
  );

  return buildPrismaWhere(conditions, fieldMap, filterLogic, datePresetsMap);
}
