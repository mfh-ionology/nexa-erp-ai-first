import type { FieldDataType, FilterOperator } from '@nexa/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Condition shape — matches SavedViewCondition from DB or DTO input */
export interface FilterCondition {
  dataViewFieldId: string;
  operator: FilterOperator;
  value: string | null;
  valueList: string[] | null;
  datePresetId: string | null;
  groupId: number;
  groupLogic: 'AND' | 'OR';
  outerLogic: 'AND' | 'OR';
  conditionOrder: number;
}

/** Minimal field metadata needed for filter building */
export interface FieldMetadata {
  id: string;
  fieldKey: string;
  fieldType: FieldDataType;
}

/** Date preset info for resolving date presets to actual date ranges */
export interface DatePresetInfo {
  id: string;
  presetKey: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma where clause is loosely typed
type PrismaWhere = Record<string, any>;

// ---------------------------------------------------------------------------
// Date preset resolution (5.4)
// ---------------------------------------------------------------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = 1, so shift: if Sunday (0) go back 6 days, else go back (day - 1)
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return startOfDay(d);
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), 11, 31));
}

/**
 * Resolves a date preset key to a date range { gte, lte }.
 * Returns null if the preset key is not recognised.
 */
export function resolveDatePreset(
  presetKey: string,
  now: Date = new Date(),
): { gte: Date; lte: Date } | null {
  switch (presetKey) {
    case 'today':
      return { gte: startOfDay(now), lte: endOfDay(now) };

    case 'yesterday': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return { gte: startOfDay(d), lte: endOfDay(d) };
    }

    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return { gte: startOfDay(d), lte: endOfDay(d) };
    }

    case 'last3days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 3);
      return { gte: startOfDay(d), lte: endOfDay(now) };
    }

    case 'last7days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { gte: startOfDay(d), lte: endOfDay(now) };
    }

    case 'last30days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { gte: startOfDay(d), lte: endOfDay(now) };
    }

    case 'next7days': {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return { gte: startOfDay(now), lte: endOfDay(d) };
    }

    case 'next30days': {
      const d = new Date(now);
      d.setDate(d.getDate() + 30);
      return { gte: startOfDay(now), lte: endOfDay(d) };
    }

    case 'thisweek':
      return { gte: startOfWeek(now), lte: endOfWeek(now) };

    case 'lastweek': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { gte: startOfWeek(d), lte: endOfWeek(d) };
    }

    case 'nextweek': {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return { gte: startOfWeek(d), lte: endOfWeek(d) };
    }

    case 'thismonth':
      return { gte: startOfMonth(now), lte: endOfMonth(now) };

    case 'lastmonth': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { gte: startOfMonth(d), lte: endOfMonth(d) };
    }

    case 'nextmonth': {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { gte: startOfMonth(d), lte: endOfMonth(d) };
    }

    case 'thisyear':
      return { gte: startOfYear(now), lte: endOfYear(now) };

    case 'lastyear': {
      const d = new Date(now.getFullYear() - 1, 0, 1);
      return { gte: startOfYear(d), lte: endOfYear(d) };
    }

    case 'nextyear': {
      const d = new Date(now.getFullYear() + 1, 0, 1);
      return { gte: startOfYear(d), lte: endOfYear(d) };
    }

    case 'mtd':
      return { gte: startOfMonth(now), lte: endOfDay(now) };

    case 'ytd':
      return { gte: startOfYear(now), lte: endOfDay(now) };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Type-safe value parsing (5.5)
// ---------------------------------------------------------------------------

function parseValue(raw: string | null | undefined, fieldType: FieldDataType): unknown {
  if (raw === null || raw === undefined) return null;

  switch (fieldType) {
    case 'NUMBER':
    case 'CURRENCY': {
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    }
    case 'DATE': {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    case 'BOOLEAN':
      return raw.toLowerCase() === 'true';
    case 'STRING':
    case 'ENUM':
    default:
      return raw;
  }
}

function parseValueList(raw: string[] | null | undefined, fieldType: FieldDataType): unknown[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((v) => parseValue(v, fieldType)).filter((v) => v !== null);
}

// ---------------------------------------------------------------------------
// Operator mapping (5.2)
// ---------------------------------------------------------------------------

function buildOperatorClause(
  operator: FilterOperator,
  fieldType: FieldDataType,
  value: string | null,
  valueList: string[] | null,
): PrismaWhere | null {
  switch (operator) {
    case 'EQUALS': {
      const parsed = parseValue(value, fieldType);
      if (parsed === null) return null;
      return { equals: parsed };
    }

    case 'NOT_EQUALS': {
      const parsed = parseValue(value, fieldType);
      if (parsed === null) return null;
      return { not: { equals: parsed } };
    }

    case 'CONTAINS':
      if (!value) return null;
      return { contains: value, mode: 'insensitive' };

    case 'STARTS_WITH':
      if (!value) return null;
      return { startsWith: value, mode: 'insensitive' };

    case 'ENDS_WITH':
      if (!value) return null;
      return { endsWith: value, mode: 'insensitive' };

    case 'GT': {
      const parsed = parseValue(value, fieldType);
      if (parsed === null) return null;
      return { gt: parsed };
    }

    case 'GTE': {
      const parsed = parseValue(value, fieldType);
      if (parsed === null) return null;
      return { gte: parsed };
    }

    case 'LT': {
      const parsed = parseValue(value, fieldType);
      if (parsed === null) return null;
      return { lt: parsed };
    }

    case 'LTE': {
      const parsed = parseValue(value, fieldType);
      if (parsed === null) return null;
      return { lte: parsed };
    }

    case 'BETWEEN': {
      // value can be JSON "[min, max]" or valueList[0], valueList[1]
      let min: unknown;
      let max: unknown;

      if (valueList && valueList.length >= 2) {
        min = parseValue(valueList[0], fieldType);
        max = parseValue(valueList[1], fieldType);
      } else if (value) {
        try {
          const arr = JSON.parse(value) as string[];
          if (Array.isArray(arr) && arr.length >= 2) {
            min = parseValue(String(arr[0]), fieldType);
            max = parseValue(String(arr[1]), fieldType);
          }
        } catch {
          return null;
        }
      }

      if (min === null || max === null || min === undefined || max === undefined) return null;
      return { gte: min, lte: max };
    }

    case 'IN': {
      const parsed = parseValueList(valueList, fieldType);
      if (parsed.length === 0) return null;
      return { in: parsed };
    }

    case 'NOT_IN': {
      const parsed = parseValueList(valueList, fieldType);
      if (parsed.length === 0) return null;
      return { notIn: parsed };
    }

    case 'IS_EMPTY': {
      // For strings, null OR empty string — handled specially in buildConditionClause
      // to produce top-level OR wrapping two field-level conditions.
      // Non-string types: simple null check.
      return { equals: null };
    }

    case 'IS_NOT_EMPTY': {
      // For strings, not null AND not empty — handled specially in buildConditionClause
      // to produce top-level AND wrapping two field-level conditions.
      // Non-string types: simple not-null check.
      return { not: null };
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Nested field resolution
// ---------------------------------------------------------------------------

/**
 * Builds a nested Prisma where clause for dot-notation field keys.
 * e.g. "customer.name" → { customer: { name: clause } }
 */
function setNestedField(fieldKey: string, clause: PrismaWhere): PrismaWhere {
  const parts = fieldKey.split('.');
  if (parts.length === 1) {
    return { [fieldKey]: clause };
  }

  // Build from innermost to outermost
  let result: PrismaWhere = clause;
  for (let i = parts.length - 1; i >= 0; i--) {
    result = { [parts[i]!]: result };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Single condition builder
// ---------------------------------------------------------------------------

function buildConditionClause(
  condition: FilterCondition,
  field: FieldMetadata,
  datePresets: Map<string, DatePresetInfo>,
): PrismaWhere | null {
  // Handle date preset resolution (5.4)
  if (condition.datePresetId && field.fieldType === 'DATE') {
    const preset = datePresets.get(condition.datePresetId);
    if (!preset) return null;

    if (preset.presetKey === 'custom') {
      // Custom range: use value field as JSON [fromDate, toDate]
      if (condition.value) {
        try {
          const arr = JSON.parse(condition.value) as string[];
          if (Array.isArray(arr) && arr.length >= 2) {
            const from = new Date(arr[0]!);
            const to = new Date(arr[1]!);
            return setNestedField(field.fieldKey, { gte: from, lte: to });
          }
        } catch {
          return null;
        }
      }
      return null;
    }

    const range = resolveDatePreset(preset.presetKey);
    if (!range) return null;
    return setNestedField(field.fieldKey, { gte: range.gte, lte: range.lte });
  }

  // Handle IS_EMPTY / IS_NOT_EMPTY for STRING fields specially.
  // These need top-level OR/AND wrappers around two field-level conditions
  // because Prisma doesn't support `null` inside `in` arrays, and `AND`/`OR`
  // are not valid field-level operators.
  if (condition.operator === 'IS_EMPTY' && field.fieldType === 'STRING') {
    return {
      OR: [
        setNestedField(field.fieldKey, { equals: null }),
        setNestedField(field.fieldKey, { equals: '' }),
      ],
    };
  }
  if (condition.operator === 'IS_NOT_EMPTY' && field.fieldType === 'STRING') {
    return {
      AND: [
        setNestedField(field.fieldKey, { not: null }),
        setNestedField(field.fieldKey, { not: '' }),
      ],
    };
  }

  // Standard operator-based filtering
  const clause = buildOperatorClause(
    condition.operator,
    field.fieldType,
    condition.value,
    condition.valueList,
  );

  if (!clause) return null;
  return setNestedField(field.fieldKey, clause);
}

// ---------------------------------------------------------------------------
// Group bracketing (5.3)
// ---------------------------------------------------------------------------

interface ConditionGroup {
  groupId: number;
  groupLogic: 'AND' | 'OR';
  outerLogic: 'AND' | 'OR';
  conditions: PrismaWhere[];
}

function groupConditions(
  conditions: FilterCondition[],
  fieldMap: Map<string, FieldMetadata>,
  datePresets: Map<string, DatePresetInfo>,
): ConditionGroup[] {
  const groups = new Map<number, ConditionGroup>();

  // Sort by conditionOrder for deterministic processing
  const sorted = [...conditions].sort((a, b) => a.conditionOrder - b.conditionOrder);

  for (const condition of sorted) {
    const field = fieldMap.get(condition.dataViewFieldId);
    if (!field) continue;

    const clause = buildConditionClause(condition, field, datePresets);
    if (!clause) continue;

    const existing = groups.get(condition.groupId);
    if (existing) {
      existing.conditions.push(clause);
    } else {
      groups.set(condition.groupId, {
        groupId: condition.groupId,
        groupLogic: condition.groupLogic,
        outerLogic: condition.outerLogic,
        conditions: [clause],
      });
    }
  }

  return Array.from(groups.values());
}

// ---------------------------------------------------------------------------
// Main entry point (5.1)
// ---------------------------------------------------------------------------

/**
 * Converts SavedViewCondition[] into a Prisma-compatible where clause.
 *
 * Conditions are grouped by `groupId`. Within a group, conditions are combined
 * with `groupLogic` (AND/OR). Between groups, conditions are combined with
 * `outerLogic`. The top-level `filterLogic` wraps the outermost combination.
 *
 * @param conditions - The saved view conditions to convert
 * @param fieldMetadata - Map of fieldId → field metadata (for type-aware parsing)
 * @param filterLogic - Top-level logic ('AND' or 'OR')
 * @param datePresets - Map of presetId → preset info (for date range resolution)
 * @returns Prisma-compatible where clause object
 */
export function buildPrismaWhere(
  conditions: FilterCondition[],
  fieldMetadata: Map<string, FieldMetadata>,
  filterLogic: 'AND' | 'OR' = 'AND',
  datePresets: Map<string, DatePresetInfo> = new Map(),
): PrismaWhere {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime null guard for API input
  if (!conditions || conditions.length === 0) {
    return {};
  }

  const groups = groupConditions(conditions, fieldMetadata, datePresets);

  if (groups.length === 0) {
    return {};
  }

  // Single group — combine its conditions directly
  if (groups.length === 1) {
    const group = groups[0]!;
    if (group.conditions.length === 1) {
      return group.conditions[0]!;
    }
    return { [group.groupLogic]: group.conditions };
  }

  // Multiple groups — each group becomes a single clause, then combine with outerLogic
  const groupClauses: PrismaWhere[] = groups.map((group) => {
    if (group.conditions.length === 1) {
      return group.conditions[0]!;
    }
    return { [group.groupLogic]: group.conditions };
  });

  // Determine outer combination logic: use the outerLogic from the second group onwards
  // (first group's outerLogic is irrelevant — it has no preceding group to combine with).
  // If all subsequent groups agree on the same outerLogic, use that; otherwise fall back to filterLogic.
  const outerLogics = groups.slice(1).map((g) => g.outerLogic);
  const consistentOuter =
    outerLogics.length > 0 && outerLogics.every((o) => o === outerLogics[0])
      ? outerLogics[0]!
      : filterLogic;

  return { [consistentOuter]: groupClauses };
}
