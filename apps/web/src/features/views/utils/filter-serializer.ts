/**
 * Filter serializer — converts between UI filter/sort state and the API
 * request/response formats.
 *
 * Used when:
 * 1. Applying filters to refresh the list
 * 2. Saving filters as part of a saved view
 *
 * For list refresh: serialises to the format expected by entity list
 * endpoints (POST body or query params). For MVP/E7: the entity list
 * page passes serialised conditions via an onFilterChange callback,
 * and the specific entity data hook (e.g., useUsers) can choose to
 * apply them.
 *
 * Created per E7-3 Task 9.1.
 */

import type {
  DataViewFieldDto,
  FilterConditionState,
  SavedViewConditionDto,
  SortConfigItem,
  SortRuleState,
} from '../types';

/**
 * Converts FilterConditionState[] to the API request format.
 * Strips UI-only fields (id, fieldKey, fieldLabel, fieldType) and
 * maps to the shape expected by POST /views/saved and PUT /views/saved/:id.
 */
export function serializeConditionsForApi(
  conditions: FilterConditionState[],
): Omit<SavedViewConditionDto, 'id'>[] {
  return conditions
    .filter((c) => c.dataViewFieldId) // Skip incomplete conditions
    .map((c) => ({
      dataViewFieldId: c.dataViewFieldId,
      operator: c.operator,
      value: c.value,
      valueList: c.valueList,
      datePresetId: c.datePresetId,
      groupId: c.groupId,
      groupLogic: c.groupLogic,
      outerLogic: c.outerLogic,
      conditionOrder: c.conditionOrder,
    }));
}

/**
 * Converts SortRuleState[] to the API request format.
 * Strips UI-only fields (id, fieldLabel).
 */
export function serializeSortForApi(sortRules: SortRuleState[]): SortConfigItem[] {
  return sortRules.map((r) => ({
    field: r.field,
    direction: r.direction,
    priority: r.priority,
  }));
}

/**
 * Deserialise saved view conditions back to UI state.
 * Enriches each condition with field metadata (fieldKey, fieldLabel,
 * fieldType) for display in the filter modal.
 */
export function deserializeConditions(
  conditions: SavedViewConditionDto[],
  fields: DataViewFieldDto[],
): FilterConditionState[] {
  if (!conditions.length) return [];

  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  return conditions.map((c) => {
    const field = fieldMap.get(c.dataViewFieldId);
    return {
      id: crypto.randomUUID(),
      dataViewFieldId: c.dataViewFieldId,
      fieldKey: field?.fieldKey ?? '',
      fieldLabel: field?.fieldLabel ?? '',
      fieldType: field?.fieldType ?? 'STRING',
      operator: c.operator,
      value: c.value ?? null,
      valueList: c.valueList ?? null,
      datePresetId: c.datePresetId ?? null,
      groupId: c.groupId,
      groupLogic: c.groupLogic,
      outerLogic: c.outerLogic,
      conditionOrder: c.conditionOrder,
    };
  });
}

/**
 * Deserialise saved view sort config back to UI state.
 * Enriches each sort rule with fieldLabel from field metadata.
 */
export function deserializeSortRules(
  sortConfig: SortConfigItem[],
  fields: DataViewFieldDto[],
): SortRuleState[] {
  if (!sortConfig.length) return [];

  const fieldMap = new Map(fields.map((f) => [f.fieldKey, f]));

  return sortConfig.map((s) => ({
    id: crypto.randomUUID(),
    field: s.field,
    fieldLabel: fieldMap.get(s.field)?.fieldLabel ?? s.field,
    direction: s.direction,
    priority: s.priority,
  }));
}
