/**
 * useFilterState — manages the transient filter editing state inside the
 * Filter & Sort modal. Separate from saved view state to allow cancel/discard
 * of in-progress edits.
 *
 * On modal open:
 *   - If active view has conditions → populate from view's conditions
 *   - Otherwise → start empty
 *
 * Created per E7-3 Task 2.3.
 */

import { useCallback, useMemo, useState } from 'react';

import type { ViewState } from './use-view-state';
import type {
  DataViewFieldDto,
  FilterConditionState,
  FilterMode,
  FilterOperator,
  SavedViewConditionDto,
  SortConfigItem,
  SortRuleState,
} from '../types';
import {
  deserializeConditions,
  deserializeSortRules,
  serializeConditionsForApi,
  serializeSortForApi,
} from '../utils/filter-serializer';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface FilterStateReturn {
  conditions: FilterConditionState[];
  sortRules: SortRuleState[];
  filterMode: FilterMode;
  filterLogic: 'AND' | 'OR';
  isDirty: boolean;

  // Condition actions
  addCondition: (field?: DataViewFieldDto) => FilterConditionState;
  removeCondition: (id: string) => void;
  updateCondition: (id: string, updates: Partial<FilterConditionState>) => void;

  // Sort actions
  addSortRule: (field?: DataViewFieldDto) => void;
  removeSortRule: (id: string) => void;
  updateSortRule: (id: string, updates: Partial<SortRuleState>) => void;
  reorderSortRules: (fromIndex: number, toIndex: number) => void;

  // Mode and logic actions
  setFilterMode: (mode: FilterMode) => void;
  setFilterLogic: (logic: 'AND' | 'OR') => void;

  // Bulk actions
  applyFilters: () => {
    conditions: FilterConditionState[];
    sortRules: SortRuleState[];
    filterLogic: 'AND' | 'OR';
    serializedConditions: Omit<SavedViewConditionDto, 'id'>[];
    serializedSort: SortConfigItem[];
  };
  resetFilters: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function defaultOperatorForType(fieldType: string): FilterOperator {
  switch (fieldType) {
    case 'STRING':
      return 'CONTAINS';
    case 'NUMBER':
    case 'CURRENCY':
      return 'EQUALS';
    case 'DATE':
      return 'EQUALS';
    case 'BOOLEAN':
      return 'EQUALS';
    case 'ENUM':
      return 'IN';
    default:
      return 'EQUALS';
  }
}

// Deserialization reuses filter-serializer.ts — no duplicate helpers needed.

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFilterState(viewState: ViewState): FilterStateReturn {
  const activeView = useMemo(() => {
    if (!viewState.activeViewId || !viewState.savedViews) return null;
    return viewState.savedViews.find((v) => v.id === viewState.activeViewId) ?? null;
  }, [viewState.activeViewId, viewState.savedViews]);

  // E7.5: Initial conditions — priority:
  //   1. Active saved view's persisted conditions (if view selected AND has conditions)
  //   2. viewState.activeFilters (live applied filters, e.g., after ad-hoc Apply)
  //   3. Empty (no filters)
  const initialConditions = useMemo(() => {
    if (activeView && activeView.conditions.length > 0) {
      return deserializeConditions(activeView.conditions, viewState.fields ?? []);
    }
    if (viewState.activeFilters.length > 0) {
      return viewState.activeFilters;
    }
    return [];
  }, [activeView, viewState.fields, viewState.activeFilters]);

  const initialSortRules = useMemo(() => {
    if (activeView && activeView.sortConfig.length > 0) {
      return deserializeSortRules(activeView.sortConfig, viewState.fields ?? []);
    }
    if (viewState.activeSortRules.length > 0) {
      return viewState.activeSortRules;
    }
    return [];
  }, [activeView, viewState.fields, viewState.activeSortRules]);

  const initialFilterLogic = activeView?.filterLogic ?? viewState.filterLogic;

  // Local editing state
  const [conditions, setConditions] = useState<FilterConditionState[]>(initialConditions);
  const [sortRules, setSortRules] = useState<SortRuleState[]>(initialSortRules);
  const [filterMode, setFilterMode] = useState<FilterMode>('simple');
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>(initialFilterLogic);
  const [isDirty, setIsDirty] = useState(false);

  // Re-sync when active view changes (modal reopen scenario)
  const [lastViewId, setLastViewId] = useState<string | null>(viewState.activeViewId);
  if (viewState.activeViewId !== lastViewId) {
    setLastViewId(viewState.activeViewId);
    setConditions(initialConditions);
    setSortRules(initialSortRules);
    setFilterLogic(initialFilterLogic);
    setIsDirty(false);
  }

  // -------------------------------------------------------------------------
  // Condition actions
  // -------------------------------------------------------------------------

  const addCondition = useCallback(
    (field?: DataViewFieldDto): FilterConditionState => {
      const newCondition: FilterConditionState = {
        id: generateId(),
        dataViewFieldId: field?.id ?? '',
        fieldKey: field?.fieldKey ?? '',
        fieldLabel: field?.fieldLabel ?? '',
        fieldType: field?.fieldType ?? 'STRING',
        operator: field ? defaultOperatorForType(field.fieldType) : 'EQUALS',
        value: null,
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: filterLogic,
        conditionOrder: conditions.length,
      };
      setConditions((prev) => [...prev, newCondition]);
      setIsDirty(true);
      return newCondition;
    },
    [conditions.length, filterLogic],
  );

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) =>
      prev.filter((c) => c.id !== id).map((c, idx) => ({ ...c, conditionOrder: idx })),
    );
    setIsDirty(true);
  }, []);

  const updateCondition = useCallback((id: string, updates: Partial<FilterConditionState>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    setIsDirty(true);
  }, []);

  // -------------------------------------------------------------------------
  // Sort actions
  // -------------------------------------------------------------------------

  const addSortRule = useCallback(
    (field?: DataViewFieldDto) => {
      const newRule: SortRuleState = {
        id: generateId(),
        field: field?.fieldKey ?? '',
        fieldLabel: field?.fieldLabel ?? '',
        direction: 'ASC',
        priority: sortRules.length + 1,
      };
      setSortRules((prev) => [...prev, newRule]);
      setIsDirty(true);
    },
    [sortRules.length],
  );

  const removeSortRule = useCallback((id: string) => {
    setSortRules((prev) =>
      prev.filter((r) => r.id !== id).map((r, idx) => ({ ...r, priority: idx + 1 })),
    );
    setIsDirty(true);
  }, []);

  const updateSortRule = useCallback((id: string, updates: Partial<SortRuleState>) => {
    setSortRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    setIsDirty(true);
  }, []);

  const reorderSortRules = useCallback((fromIndex: number, toIndex: number) => {
    setSortRules((prev) => {
      const next = [...prev];
      const moved = next.splice(fromIndex, 1)[0];
      if (!moved) return prev;
      next.splice(toIndex, 0, moved);
      return next.map((r, idx) => ({ ...r, priority: idx + 1 }));
    });
    setIsDirty(true);
  }, []);

  // -------------------------------------------------------------------------
  // Bulk actions
  // -------------------------------------------------------------------------

  const applyFilters = useCallback(() => {
    setIsDirty(false);
    return {
      conditions,
      sortRules,
      filterLogic,
      serializedConditions: serializeConditionsForApi(conditions),
      serializedSort: serializeSortForApi(sortRules),
    };
  }, [conditions, sortRules, filterLogic]);

  const resetFilters = useCallback(() => {
    setConditions([]);
    setSortRules([]);
    setFilterLogic('AND');
    setIsDirty(true);
  }, []);

  return {
    conditions,
    sortRules,
    filterMode,
    filterLogic,
    isDirty,

    addCondition,
    removeCondition,
    updateCondition,

    addSortRule,
    removeSortRule,
    updateSortRule,
    reorderSortRules,

    setFilterMode,
    setFilterLogic: useCallback((logic: 'AND' | 'OR') => {
      setFilterLogic(logic);
      setIsDirty(true);
    }, []),

    applyFilters,
    resetFilters,
  };
}
