import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ViewState } from '../use-view-state';
import type {
  DataViewFieldDto,
  FilterConditionState,
  SavedViewConditionDto,
  SavedViewDto,
} from '../../types';
import type * as FilterSerializer from '../../utils/filter-serializer';

// Mock filter-serializer — keep deserialize functions real, mock serialize functions
vi.mock('../../utils/filter-serializer', async (importOriginal) => {
  const actual = await importOriginal<typeof FilterSerializer>();
  return {
    ...actual,
    serializeConditionsForApi: vi.fn((conditions: FilterConditionState[]) =>
      conditions.map((c) => ({
        dataViewFieldId: c.dataViewFieldId,
        operator: c.operator,
        value: c.value,
        valueList: c.valueList,
        datePresetId: c.datePresetId,
        groupId: c.groupId,
        groupLogic: c.groupLogic,
        outerLogic: c.outerLogic,
        conditionOrder: c.conditionOrder,
      })),
    ),
    serializeSortForApi: vi.fn(
      (rules: Array<{ field: string; direction: string; priority: number }>) =>
        rules.map((r) => ({
          field: r.field,
          direction: r.direction,
          priority: r.priority,
        })),
    ),
  };
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function makeSavedView(overrides: Partial<SavedViewDto> = {}): SavedViewDto {
  return {
    id: 'view-1',
    name: 'Test View',
    groupName: 'Test',
    scope: 'PERSONAL',
    createdBy: 'user-1',
    dataViewId: 'dv-1',
    isFavourite: false,
    favouriteOrder: 0,
    isDefault: false,
    filterLogic: 'AND',
    sortConfig: [],
    columnConfig: [],
    conditions: [],
    ...overrides,
  };
}

function makeViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    dataView: undefined,
    fields: [],
    savedViews: [],
    datePresets: [],
    columnState: [],
    tanstackColumns: [],
    activeFilters: [],
    activeSortRules: [],
    filterLogic: 'AND',
    activeFilterCount: 0,
    activeViewId: null,
    isDirty: false,
    isLoading: false,
    error: null,
    setActiveView: vi.fn(),
    updateColumnState: vi.fn(),
    reorderColumns: vi.fn(),
    toggleColumnVisibility: vi.fn(),
    setColumnPin: vi.fn(),
    markClean: vi.fn(),
    applyFilters: vi.fn(),
    clearFilters: vi.fn(),
    ...overrides,
  };
}

// Dynamic import to ensure mocks are in place
async function importHook() {
  const mod = await import('../use-filter-state');
  return mod.useFilterState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFilterState', () => {
  let useFilterState: Awaited<ReturnType<typeof importHook>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    useFilterState = await importHook();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('initial state is empty when no active view', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    expect(result.current.conditions).toEqual([]);
    expect(result.current.sortRules).toEqual([]);
    expect(result.current.filterMode).toBe('simple');
    expect(result.current.filterLogic).toBe('AND');
    expect(result.current.isDirty).toBe(false);
  });

  it('populates from active view conditions when view is loaded', () => {
    const fields: DataViewFieldDto[] = [
      makeField({ id: 'f1', fieldKey: 'status', fieldLabel: 'Status', fieldType: 'ENUM' }),
    ];
    const conditions: SavedViewConditionDto[] = [
      {
        id: 'cond-1',
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'ACTIVE',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ];
    const savedView = makeSavedView({
      id: 'sv-1',
      conditions,
      filterLogic: 'OR',
      sortConfig: [{ field: 'status', direction: 'DESC', priority: 1 }],
    });
    const viewState = makeViewState({
      fields,
      savedViews: [savedView],
      activeViewId: 'sv-1',
    });

    const { result } = renderHook(() => useFilterState(viewState));

    expect(result.current.conditions).toHaveLength(1);
    expect(result.current.conditions[0]!.dataViewFieldId).toBe('f1');
    expect(result.current.conditions[0]!.fieldKey).toBe('status');
    expect(result.current.conditions[0]!.fieldLabel).toBe('Status');
    expect(result.current.conditions[0]!.operator).toBe('EQUALS');
    expect(result.current.conditions[0]!.value).toBe('ACTIVE');

    expect(result.current.sortRules).toHaveLength(1);
    expect(result.current.sortRules[0]!.field).toBe('status');
    expect(result.current.sortRules[0]!.direction).toBe('DESC');

    expect(result.current.filterLogic).toBe('OR');
  });

  // -------------------------------------------------------------------------
  // Condition actions
  // -------------------------------------------------------------------------

  it('addCondition adds a new condition with correct defaults', () => {
    const field = makeField({
      id: 'f1',
      fieldKey: 'name',
      fieldLabel: 'Name',
      fieldType: 'STRING',
    });
    const viewState = makeViewState({ fields: [field] });
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addCondition(field);
    });

    expect(result.current.conditions).toHaveLength(1);
    const cond = result.current.conditions[0]!;
    expect(cond.dataViewFieldId).toBe('f1');
    expect(cond.fieldKey).toBe('name');
    expect(cond.fieldLabel).toBe('Name');
    expect(cond.fieldType).toBe('STRING');
    expect(cond.operator).toBe('CONTAINS'); // Default for STRING
    expect(cond.value).toBeNull();
    expect(cond.valueList).toBeNull();
    expect(cond.conditionOrder).toBe(0);
    expect(cond.id).toBeTruthy();
    expect(result.current.isDirty).toBe(true);
  });

  it('addCondition with no field creates an empty condition with EQUALS operator', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addCondition();
    });

    expect(result.current.conditions).toHaveLength(1);
    expect(result.current.conditions[0]!.operator).toBe('EQUALS');
    expect(result.current.conditions[0]!.dataViewFieldId).toBe('');
  });

  it('addCondition uses correct default operator for each field type', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    const types: Array<[string, string]> = [
      ['STRING', 'CONTAINS'],
      ['NUMBER', 'EQUALS'],
      ['CURRENCY', 'EQUALS'],
      ['DATE', 'EQUALS'],
      ['BOOLEAN', 'EQUALS'],
      ['ENUM', 'IN'],
    ];

    for (const [fieldType, expectedOp] of types) {
      act(() => {
        result.current.addCondition(
          makeField({ fieldType: fieldType as DataViewFieldDto['fieldType'] }),
        );
      });

      const lastCond = result.current.conditions[result.current.conditions.length - 1]!;
      expect(lastCond.operator).toBe(expectedOp);
    }
  });

  it('removeCondition removes by id and reorders remaining', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    let id1 = '';
    let id2 = '';
    act(() => {
      id1 = result.current.addCondition(makeField({ id: 'f1' })).id;
      id2 = result.current.addCondition(makeField({ id: 'f2' })).id;
      result.current.addCondition(makeField({ id: 'f3' }));
    });

    expect(result.current.conditions).toHaveLength(3);

    act(() => {
      result.current.removeCondition(id1);
    });

    expect(result.current.conditions).toHaveLength(2);
    expect(result.current.conditions[0]!.id).toBe(id2);
    // conditionOrder is re-assigned after removal
    expect(result.current.conditions[0]!.conditionOrder).toBe(0);
    expect(result.current.conditions[1]!.conditionOrder).toBe(1);
  });

  it('updateCondition updates operator and value', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    let condId = '';
    act(() => {
      condId = result.current.addCondition(makeField()).id;
    });

    act(() => {
      result.current.updateCondition(condId, {
        operator: 'EQUALS',
        value: 'test-value',
      });
    });

    expect(result.current.conditions[0]!.operator).toBe('EQUALS');
    expect(result.current.conditions[0]!.value).toBe('test-value');
    expect(result.current.isDirty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Sort actions
  // -------------------------------------------------------------------------

  it('addSortRule adds a new sort rule with ASC default', () => {
    const field = makeField({ fieldKey: 'name', fieldLabel: 'Name' });
    const viewState = makeViewState({ fields: [field] });
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addSortRule(field);
    });

    expect(result.current.sortRules).toHaveLength(1);
    expect(result.current.sortRules[0]!.field).toBe('name');
    expect(result.current.sortRules[0]!.direction).toBe('ASC');
    expect(result.current.sortRules[0]!.priority).toBe(1);
    expect(result.current.isDirty).toBe(true);
  });

  it('removeSortRule removes and re-assigns priority', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addSortRule(makeField({ fieldKey: 'a' }));
      result.current.addSortRule(makeField({ fieldKey: 'b' }));
      result.current.addSortRule(makeField({ fieldKey: 'c' }));
    });

    const idToRemove = result.current.sortRules[0]!.id;

    act(() => {
      result.current.removeSortRule(idToRemove);
    });

    expect(result.current.sortRules).toHaveLength(2);
    expect(result.current.sortRules[0]!.priority).toBe(1);
    expect(result.current.sortRules[1]!.priority).toBe(2);
  });

  it('reorderSortRules reassigns priorities', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addSortRule(makeField({ fieldKey: 'a' }));
      result.current.addSortRule(makeField({ fieldKey: 'b' }));
      result.current.addSortRule(makeField({ fieldKey: 'c' }));
    });

    // Move item at index 2 to index 0
    act(() => {
      result.current.reorderSortRules(2, 0);
    });

    expect(result.current.sortRules[0]!.field).toBe('c');
    expect(result.current.sortRules[0]!.priority).toBe(1);
    expect(result.current.sortRules[1]!.field).toBe('a');
    expect(result.current.sortRules[1]!.priority).toBe(2);
    expect(result.current.sortRules[2]!.field).toBe('b');
    expect(result.current.sortRules[2]!.priority).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Bulk actions
  // -------------------------------------------------------------------------

  it('resetFilters clears all conditions and sort rules', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addCondition(makeField());
      result.current.addSortRule(makeField());
      result.current.setFilterLogic('OR');
    });

    expect(result.current.conditions).toHaveLength(1);
    expect(result.current.sortRules).toHaveLength(1);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.conditions).toEqual([]);
    expect(result.current.sortRules).toEqual([]);
    expect(result.current.filterLogic).toBe('AND');
    expect(result.current.isDirty).toBe(true);
  });

  it('applyFilters returns serialized conditions and resets isDirty', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addCondition(makeField({ id: 'f1' }));
      result.current.addSortRule(makeField({ fieldKey: 'name' }));
    });

    expect(result.current.isDirty).toBe(true);

    let applied: ReturnType<typeof result.current.applyFilters> | undefined;
    act(() => {
      applied = result.current.applyFilters();
    });

    expect(applied).toBeDefined();
    expect(applied!.conditions).toHaveLength(1);
    expect(applied!.sortRules).toHaveLength(1);
    expect(applied!.filterLogic).toBe('AND');
    expect(applied!.serializedConditions).toBeDefined();
    expect(applied!.serializedSort).toBeDefined();
    expect(result.current.isDirty).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Mode & logic
  // -------------------------------------------------------------------------

  it('switching simple → advanced preserves existing conditions', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      result.current.addCondition(makeField({ id: 'f1', fieldType: 'STRING' }));
    });

    const condBefore = result.current.conditions[0]!;

    act(() => {
      result.current.setFilterMode('advanced');
    });

    expect(result.current.filterMode).toBe('advanced');
    expect(result.current.conditions).toHaveLength(1);
    expect(result.current.conditions[0]!.id).toBe(condBefore.id);
  });

  it('setFilterLogic changes logic and marks dirty', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    expect(result.current.filterLogic).toBe('AND');

    act(() => {
      result.current.setFilterLogic('OR');
    });

    expect(result.current.filterLogic).toBe('OR');
    expect(result.current.isDirty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // activeFilterCount-like calculation (conditions with values)
  // -------------------------------------------------------------------------

  it('conditions with values are properly tracked', () => {
    const viewState = makeViewState();
    const { result } = renderHook(() => useFilterState(viewState));

    act(() => {
      const cond = result.current.addCondition(makeField({ id: 'f1' }));
      result.current.updateCondition(cond.id, { value: 'test' });
    });

    // The condition should have the value set
    const withValue = result.current.conditions.filter(
      (c) => c.dataViewFieldId && c.value !== null,
    );
    expect(withValue).toHaveLength(1);
  });
});
