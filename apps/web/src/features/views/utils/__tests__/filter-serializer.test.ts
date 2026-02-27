import { describe, it, expect, vi, beforeEach } from 'vitest';

import type {
  DataViewFieldDto,
  FilterConditionState,
  SavedViewConditionDto,
  SortConfigItem,
  SortRuleState,
} from '../../types';

// Mock crypto.randomUUID for deterministic test output
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${++uuidCounter}`,
});

import {
  serializeConditionsForApi,
  serializeSortForApi,
  deserializeConditions,
  deserializeSortRules,
} from '../filter-serializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConditionState(overrides: Partial<FilterConditionState> = {}): FilterConditionState {
  return {
    id: `ui-cond-${Math.random()}`,
    dataViewFieldId: 'field-1',
    fieldKey: 'name',
    fieldLabel: 'Name',
    fieldType: 'STRING',
    operator: 'CONTAINS',
    value: 'test',
    valueList: null,
    datePresetId: null,
    groupId: 0,
    groupLogic: 'AND',
    outerLogic: 'AND',
    conditionOrder: 0,
    ...overrides,
  };
}

function makeField(overrides: Partial<DataViewFieldDto> = {}): DataViewFieldDto {
  return {
    id: 'field-1',
    fieldKey: 'name',
    fieldLabel: 'Name',
    fieldType: 'STRING',
    defaultVisible: true,
    defaultOrder: 0,
    defaultWidth: 200,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: false,
    lovType: 'NONE',
    lovScope: null,
    lovStaticValues: null,
    lovDependsOn: null,
    lovSearchMin: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// serializeConditionsForApi
// ---------------------------------------------------------------------------

describe('serializeConditionsForApi', () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  it('converts FilterConditionState[] to API format (strips UI-only fields)', () => {
    const conditions: FilterConditionState[] = [
      makeConditionState({
        id: 'ui-1',
        dataViewFieldId: 'f1',
        fieldKey: 'status',
        fieldLabel: 'Status',
        fieldType: 'ENUM',
        operator: 'EQUALS',
        value: 'ACTIVE',
        conditionOrder: 0,
      }),
    ];

    const result = serializeConditionsForApi(conditions);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      dataViewFieldId: 'f1',
      operator: 'EQUALS',
      value: 'ACTIVE',
      valueList: null,
      datePresetId: null,
      groupId: 0,
      groupLogic: 'AND',
      outerLogic: 'AND',
      conditionOrder: 0,
    });

    // Should NOT contain UI-only fields
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('fieldKey');
    expect(result[0]).not.toHaveProperty('fieldLabel');
    expect(result[0]).not.toHaveProperty('fieldType');
  });

  it('skips incomplete conditions (no dataViewFieldId)', () => {
    const conditions: FilterConditionState[] = [
      makeConditionState({ dataViewFieldId: '' }), // incomplete
      makeConditionState({ dataViewFieldId: 'f1' }), // valid
    ];

    const result = serializeConditionsForApi(conditions);
    expect(result).toHaveLength(1);
    expect(result[0]!.dataViewFieldId).toBe('f1');
  });

  it('date preset conditions preserve datePresetId', () => {
    const conditions: FilterConditionState[] = [
      makeConditionState({
        dataViewFieldId: 'f-date',
        fieldType: 'DATE',
        operator: 'EQUALS',
        value: null,
        datePresetId: 'preset-today',
      }),
    ];

    const result = serializeConditionsForApi(conditions);
    expect(result[0]!.datePresetId).toBe('preset-today');
    expect(result[0]!.value).toBeNull();
  });

  it('custom date range conditions preserve value as JSON string', () => {
    const dateRange = JSON.stringify(['2026-01-01', '2026-01-31']);
    const conditions: FilterConditionState[] = [
      makeConditionState({
        dataViewFieldId: 'f-date',
        fieldType: 'DATE',
        operator: 'BETWEEN',
        value: dateRange,
        datePresetId: null,
      }),
    ];

    const result = serializeConditionsForApi(conditions);
    expect(result[0]!.value).toBe(dateRange);
    expect(result[0]!.operator).toBe('BETWEEN');
  });

  it('multi-value (IN) conditions preserve valueList', () => {
    const conditions: FilterConditionState[] = [
      makeConditionState({
        dataViewFieldId: 'f-status',
        fieldType: 'ENUM',
        operator: 'IN',
        value: null,
        valueList: ['ACTIVE', 'PENDING', 'REVIEW'],
      }),
    ];

    const result = serializeConditionsForApi(conditions);
    expect(result[0]!.valueList).toEqual(['ACTIVE', 'PENDING', 'REVIEW']);
    expect(result[0]!.operator).toBe('IN');
    expect(result[0]!.value).toBeNull();
  });

  it('group bracketing preserves groupId and group/outer logic', () => {
    const conditions: FilterConditionState[] = [
      makeConditionState({
        dataViewFieldId: 'f1',
        groupId: 1,
        groupLogic: 'OR',
        outerLogic: 'AND',
        conditionOrder: 0,
      }),
      makeConditionState({
        dataViewFieldId: 'f2',
        groupId: 1,
        groupLogic: 'OR',
        outerLogic: 'AND',
        conditionOrder: 1,
      }),
      makeConditionState({
        dataViewFieldId: 'f3',
        groupId: 2,
        groupLogic: 'AND',
        outerLogic: 'OR',
        conditionOrder: 2,
      }),
    ];

    const result = serializeConditionsForApi(conditions);

    expect(result[0]!.groupId).toBe(1);
    expect(result[0]!.groupLogic).toBe('OR');
    expect(result[0]!.outerLogic).toBe('AND');

    expect(result[1]!.groupId).toBe(1);
    expect(result[1]!.groupLogic).toBe('OR');

    expect(result[2]!.groupId).toBe(2);
    expect(result[2]!.groupLogic).toBe('AND');
    expect(result[2]!.outerLogic).toBe('OR');
  });
});

// ---------------------------------------------------------------------------
// serializeSortForApi
// ---------------------------------------------------------------------------

describe('serializeSortForApi', () => {
  it('converts SortRuleState[] to API format', () => {
    const sortRules: SortRuleState[] = [
      { id: 'sr-1', field: 'name', fieldLabel: 'Name', direction: 'ASC', priority: 1 },
      { id: 'sr-2', field: 'date', fieldLabel: 'Date', direction: 'DESC', priority: 2 },
    ];

    const result = serializeSortForApi(sortRules);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ field: 'name', direction: 'ASC', priority: 1 });
    expect(result[1]).toEqual({ field: 'date', direction: 'DESC', priority: 2 });

    // Should not contain UI-only fields
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('fieldLabel');
  });
});

// ---------------------------------------------------------------------------
// deserializeConditions
// ---------------------------------------------------------------------------

describe('deserializeConditions', () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  it('converts API conditions back to UI state with field metadata', () => {
    const fields: DataViewFieldDto[] = [
      makeField({ id: 'f1', fieldKey: 'status', fieldLabel: 'Status', fieldType: 'ENUM' }),
    ];

    const apiConditions: SavedViewConditionDto[] = [
      {
        id: 'api-cond-1',
        dataViewFieldId: 'f1',
        operator: 'IN',
        value: null,
        valueList: ['ACTIVE', 'PENDING'],
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ];

    const result = deserializeConditions(apiConditions, fields);

    expect(result).toHaveLength(1);
    expect(result[0]!.fieldKey).toBe('status');
    expect(result[0]!.fieldLabel).toBe('Status');
    expect(result[0]!.fieldType).toBe('ENUM');
    expect(result[0]!.operator).toBe('IN');
    expect(result[0]!.valueList).toEqual(['ACTIVE', 'PENDING']);
    // Should have a client-generated UUID, not the API id
    expect(result[0]!.id).toMatch(/^uuid-/);
  });

  it('returns empty array for empty conditions', () => {
    const result = deserializeConditions([], []);
    expect(result).toEqual([]);
  });

  it('handles unknown field gracefully (defaults to STRING)', () => {
    const apiConditions: SavedViewConditionDto[] = [
      {
        id: 'cond-1',
        dataViewFieldId: 'unknown-field',
        operator: 'EQUALS',
        value: 'test',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ];

    const result = deserializeConditions(apiConditions, []);

    expect(result[0]!.fieldKey).toBe('');
    expect(result[0]!.fieldLabel).toBe('');
    expect(result[0]!.fieldType).toBe('STRING'); // default fallback
  });

  it('date preset conditions preserve datePresetId', () => {
    const fields = [makeField({ id: 'f-date', fieldType: 'DATE' })];
    const apiConditions: SavedViewConditionDto[] = [
      {
        id: 'cond-1',
        dataViewFieldId: 'f-date',
        operator: 'EQUALS',
        value: null,
        valueList: null,
        datePresetId: 'preset-ytd',
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ];

    const result = deserializeConditions(apiConditions, fields);
    expect(result[0]!.datePresetId).toBe('preset-ytd');
    expect(result[0]!.value).toBeNull();
  });

  it('custom date range conditions preserve value as JSON string', () => {
    const fields = [makeField({ id: 'f-date', fieldType: 'DATE' })];
    const dateRange = JSON.stringify(['2026-01-01', '2026-01-31']);
    const apiConditions: SavedViewConditionDto[] = [
      {
        id: 'cond-1',
        dataViewFieldId: 'f-date',
        operator: 'BETWEEN',
        value: dateRange,
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ];

    const result = deserializeConditions(apiConditions, fields);
    expect(result[0]!.value).toBe(dateRange);
    expect(result[0]!.operator).toBe('BETWEEN');
  });
});

// ---------------------------------------------------------------------------
// deserializeSortRules
// ---------------------------------------------------------------------------

describe('deserializeSortRules', () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  it('converts API sort config back to UI state with field labels', () => {
    const fields: DataViewFieldDto[] = [
      makeField({ fieldKey: 'name', fieldLabel: 'Name' }),
      makeField({ id: 'f2', fieldKey: 'date', fieldLabel: 'Created Date' }),
    ];

    const sortConfig: SortConfigItem[] = [
      { field: 'name', direction: 'ASC', priority: 1 },
      { field: 'date', direction: 'DESC', priority: 2 },
    ];

    const result = deserializeSortRules(sortConfig, fields);

    expect(result).toHaveLength(2);
    expect(result[0]!.field).toBe('name');
    expect(result[0]!.fieldLabel).toBe('Name');
    expect(result[0]!.direction).toBe('ASC');
    expect(result[0]!.priority).toBe(1);
    expect(result[0]!.id).toMatch(/^uuid-/);

    expect(result[1]!.fieldLabel).toBe('Created Date');
    expect(result[1]!.direction).toBe('DESC');
  });

  it('returns empty array for empty sort config', () => {
    const result = deserializeSortRules([], []);
    expect(result).toEqual([]);
  });

  it('falls back to field key as label for unknown fields', () => {
    const sortConfig: SortConfigItem[] = [{ field: 'unknownField', direction: 'ASC', priority: 1 }];

    const result = deserializeSortRules(sortConfig, []);
    expect(result[0]!.fieldLabel).toBe('unknownField');
  });
});
