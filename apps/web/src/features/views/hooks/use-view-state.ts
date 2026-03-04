import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ColumnDef } from '@tanstack/react-table';

import { useViewStore } from '@/stores/view-store';

import { useViewInit } from './use-view-init';
import { deserializeConditions, deserializeSortRules } from '../utils/filter-serializer';
import type {
  ColumnConfigItem,
  ColumnState,
  DataViewDto,
  DataViewFieldDto,
  DateRangePresetDto,
  FilterConditionState,
  PinPosition,
  SavedViewDto,
  SortRuleState,
  UserColumnPreferenceDto,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default view precedence: PERSONAL → ROLE → GLOBAL.
 * Returns the first `isDefault === true` view found in that order, or null.
 */
function resolveDefaultView(savedViews: SavedViewDto[]): SavedViewDto | null {
  const scopes: Array<SavedViewDto['scope']> = ['PERSONAL', 'ROLE', 'GLOBAL'];

  for (const scope of scopes) {
    const defaultView = savedViews.find((v) => v.scope === scope && v.isDefault);
    if (defaultView) return defaultView;
  }

  return null;
}

/**
 * Build column state from field metadata, optionally overlaying user
 * column preferences or a saved view's column config.
 */
function buildColumnState(
  fields: DataViewFieldDto[],
  userPrefs: UserColumnPreferenceDto[] | null,
  activeView: SavedViewDto | null,
): ColumnState[] {
  // Active saved view's column config takes highest priority
  if (activeView?.columnConfig.length) {
    return mergeWithViewConfig(fields, activeView.columnConfig);
  }

  // User column preferences take second priority
  if (userPrefs?.length) {
    return mergeWithUserPrefs(fields, userPrefs);
  }

  // Fall back to field metadata defaults
  return fields.map((f) => ({
    fieldId: f.id,
    fieldKey: f.fieldKey,
    fieldLabel: f.fieldLabel,
    visible: f.defaultVisible,
    order: f.defaultOrder,
    width: f.defaultWidth,
    pinned: 'NONE' as PinPosition,
    pinnable: f.pinnable,
    sortable: f.sortable,
    fieldType: f.fieldType,
  }));
}

function mergeWithViewConfig(
  fields: DataViewFieldDto[],
  columnConfig: ColumnConfigItem[],
): ColumnState[] {
  const configMap = new Map(columnConfig.map((c) => [c.fieldId, c]));

  return fields.map((f) => {
    const cfg = configMap.get(f.id);
    return {
      fieldId: f.id,
      fieldKey: f.fieldKey,
      fieldLabel: f.fieldLabel,
      visible: cfg?.visible ?? f.defaultVisible,
      order: cfg?.order ?? f.defaultOrder,
      width: cfg?.width ?? f.defaultWidth,
      pinned: cfg?.pinned ?? 'NONE',
      pinnable: f.pinnable,
      sortable: f.sortable,
      fieldType: f.fieldType,
    };
  });
}

function mergeWithUserPrefs(
  fields: DataViewFieldDto[],
  prefs: UserColumnPreferenceDto[],
): ColumnState[] {
  const prefMap = new Map(prefs.map((p) => [p.dataViewFieldId, p]));

  return fields.map((f) => {
    const pref = prefMap.get(f.id);
    return {
      fieldId: f.id,
      fieldKey: f.fieldKey,
      fieldLabel: f.fieldLabel,
      visible: pref?.visible ?? f.defaultVisible,
      order: pref?.displayOrder ?? f.defaultOrder,
      width: pref?.width ?? f.defaultWidth,
      pinned: pref?.pinned ?? 'NONE',
      pinnable: f.pinnable,
      sortable: f.sortable,
      fieldType: f.fieldType,
    };
  });
}

// Deserialization reuses filter-serializer.ts — no duplicate helpers needed.

/**
 * Sort columns: pinned-left first (by order), then unpinned (by order),
 * then pinned-right (by order).
 */
function sortColumns(columns: ColumnState[]): ColumnState[] {
  const left = columns.filter((c) => c.pinned === 'LEFT').sort((a, b) => a.order - b.order);
  const none = columns.filter((c) => c.pinned === 'NONE').sort((a, b) => a.order - b.order);
  const right = columns.filter((c) => c.pinned === 'RIGHT').sort((a, b) => a.order - b.order);
  return [...left, ...none, ...right];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface ViewState {
  // Data
  dataView: DataViewDto | undefined;
  fields: DataViewFieldDto[] | undefined;
  savedViews: SavedViewDto[] | undefined;
  datePresets: DateRangePresetDto[] | undefined;
  columnState: ColumnState[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tanstackColumns: ColumnDef<any>[];
  // Filter & sort state
  activeFilters: FilterConditionState[];
  activeSortRules: SortRuleState[];
  filterLogic: 'AND' | 'OR';
  activeFilterCount: number;
  // State
  activeViewId: string | null;
  isDirty: boolean;
  isLoading: boolean;
  error: Error | null;
  // Actions
  setActiveView: (viewId: string | null) => void;
  updateColumnState: (updates: Partial<ColumnState> & { fieldId: string }[]) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  toggleColumnVisibility: (fieldId: string) => void;
  setColumnPin: (fieldId: string, pin: PinPosition) => void;
  markClean: () => void;
  applyFilters: (
    conditions: FilterConditionState[],
    sortRules: SortRuleState[],
    filterLogic: 'AND' | 'OR',
  ) => void;
  clearFilters: () => void;
}

export function useViewState(viewKey: string): ViewState {
  // 1. Fetch view init data
  const initQuery = useViewInit(viewKey);
  const data = initQuery.data;

  // 2. Active view tracking — uses Zustand store with sessionStorage persistence
  const storeActiveViewId = useViewStore((s) => s.getActiveViewId(viewKey));
  const storeSetActiveView = useViewStore((s) => s.setActiveView);
  const activeViewId = storeActiveViewId;
  const [isDirty, setIsDirty] = useState(false);

  // 3. Local column state overrides (set when user modifies columns in the UI)
  const [localColumnOverrides, setLocalColumnOverrides] = useState<ColumnState[] | null>(null);

  // 3b. Active filter & sort state (applied filters, not transient modal edits)
  const [activeFilters, setActiveFilters] = useState<FilterConditionState[]>([]);
  const [activeSortRules, setActiveSortRules] = useState<SortRuleState[]>([]);
  const [filterLogicState, setFilterLogicState] = useState<'AND' | 'OR'>('AND');

  // Track whether we've applied the initial default view
  const hasAppliedDefault = useRef(false);

  // Resolve the active saved view object
  const savedViews = data?.savedViews;
  const activeView = useMemo(() => {
    if (!activeViewId || !savedViews) return null;
    return savedViews.find((v) => v.id === activeViewId) ?? null;
  }, [activeViewId, savedViews]);

  // 3. Apply default view on first data load (only if no session-persisted view)
  // This one-time initialization effect is guarded by hasAppliedDefault ref
  // and intentionally sets state synchronously to avoid a render with stale filters.
  const fields = data?.fields;
  useEffect(() => {
    if (!savedViews || !fields || hasAppliedDefault.current) return;
    hasAppliedDefault.current = true;

    // Resolve which view to use — session-persisted or default
    const viewToApply = activeViewId
      ? (savedViews.find((v) => v.id === activeViewId) ?? null)
      : resolveDefaultView(savedViews);

    if (viewToApply) {
      if (!activeViewId) {
        storeSetActiveView(viewKey, viewToApply.id, viewToApply.name);
      }
      // Populate filter state from the initial view (one-time init, ref-guarded)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFilters(deserializeConditions(viewToApply.conditions, fields));
      setActiveSortRules(deserializeSortRules(viewToApply.sortConfig, fields));
      setFilterLogicState(viewToApply.filterLogic);
    }
  }, [savedViews, fields, activeViewId, storeSetActiveView, viewKey]);

  // 4. Compute resolved column state
  const userColumnPreferences = data?.userColumnPreferences ?? null;
  const columnState = useMemo<ColumnState[]>(() => {
    // If user has locally modified columns (via Columns tab), use those
    if (localColumnOverrides) {
      return sortColumns(localColumnOverrides);
    }

    if (!fields) return [];

    return sortColumns(buildColumnState(fields, userColumnPreferences, activeView));
  }, [localColumnOverrides, fields, userColumnPreferences, activeView]);

  // 5. Build TanStack Table column definitions from columnState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tanstackColumns = useMemo<ColumnDef<any>[]>(
    () =>
      columnState
        .filter((c) => c.visible)
        .map((col) => ({
          id: col.fieldKey,
          accessorKey: col.fieldKey,
          header: col.fieldLabel,
          size: col.width,
          minSize: 40,
          maxSize: 800,
          enableSorting: col.sortable,
          enableResizing: true,
          enablePinning: col.pinnable,
          meta: {
            fieldId: col.fieldId,
            fieldType: col.fieldType,
            pinned: col.pinned,
          },
        })),
    [columnState],
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const setActiveView = useCallback(
    (viewId: string | null) => {
      const view = viewId ? (savedViews?.find((v) => v.id === viewId) ?? null) : null;
      storeSetActiveView(viewKey, viewId, view?.name ?? null);
      setLocalColumnOverrides(null); // Clear local overrides when switching views
      setIsDirty(false);

      // Populate filters from the loaded view
      if (view && fields) {
        setActiveFilters(deserializeConditions(view.conditions, fields));
        setActiveSortRules(deserializeSortRules(view.sortConfig, fields));
        setFilterLogicState(view.filterLogic);
      } else {
        setActiveFilters([]);
        setActiveSortRules([]);
        setFilterLogicState('AND');
      }
    },
    [viewKey, storeSetActiveView, savedViews, fields],
  );

  const updateColumnState = useCallback(
    (updates: Array<Partial<ColumnState> & { fieldId: string }>) => {
      setLocalColumnOverrides((prev) => {
        const base = prev ?? columnState;
        const updateMap = new Map(updates.map((u) => [u.fieldId, u]));
        return base.map((col) => {
          const update = updateMap.get(col.fieldId);
          return update ? { ...col, ...update } : col;
        });
      });
      setIsDirty(true);
    },
    [columnState],
  );

  const reorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      setLocalColumnOverrides((prev) => {
        const base = [...(prev ?? columnState)];
        const moved = base.splice(fromIndex, 1)[0];
        if (!moved) return base;
        base.splice(toIndex, 0, moved);
        // Reassign order values based on new positions
        return base.map((col, idx) => ({ ...col, order: idx }));
      });
      setIsDirty(true);
    },
    [columnState],
  );

  const toggleColumnVisibility = useCallback(
    (fieldId: string) => {
      setLocalColumnOverrides((prev) => {
        const base = prev ?? columnState;
        return base.map((col) =>
          col.fieldId === fieldId ? { ...col, visible: !col.visible } : col,
        );
      });
      setIsDirty(true);
    },
    [columnState],
  );

  const setColumnPin = useCallback(
    (fieldId: string, pin: PinPosition) => {
      setLocalColumnOverrides((prev) => {
        const base = prev ?? columnState;
        return base.map((col) => (col.fieldId === fieldId ? { ...col, pinned: pin } : col));
      });
      setIsDirty(true);
    },
    [columnState],
  );

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const applyFilters = useCallback(
    (conditions: FilterConditionState[], sortRules: SortRuleState[], logic: 'AND' | 'OR') => {
      setActiveFilters(conditions);
      setActiveSortRules(sortRules);
      setFilterLogicState(logic);
      if (activeViewId) setIsDirty(true);
    },
    [activeViewId],
  );

  const clearFilters = useCallback(() => {
    setActiveFilters([]);
    setActiveSortRules([]);
    setFilterLogicState('AND');
    if (activeViewId) setIsDirty(true);
  }, [activeViewId]);

  // Count active conditions that have a meaningful value or are no-value operators
  const activeFilterCount = useMemo(
    () =>
      activeFilters.filter(
        (c) =>
          c.dataViewFieldId &&
          (c.value !== null ||
            (c.valueList && c.valueList.length > 0) ||
            c.datePresetId !== null ||
            c.operator === 'IS_EMPTY' ||
            c.operator === 'IS_NOT_EMPTY'),
      ).length,
    [activeFilters],
  );

  return {
    // Data
    dataView: data?.dataView,
    fields: data?.fields,
    savedViews: data?.savedViews,
    datePresets: data?.datePresets,
    columnState,
    tanstackColumns,
    // Filter & sort state
    activeFilters,
    activeSortRules,
    filterLogic: filterLogicState,
    activeFilterCount,
    // State
    activeViewId,
    isDirty,
    isLoading: initQuery.isLoading,
    error: initQuery.error,
    // Actions
    setActiveView,
    updateColumnState,
    reorderColumns,
    toggleColumnVisibility,
    setColumnPin,
    markClean,
    applyFilters,
    clearFilters,
  };
}
