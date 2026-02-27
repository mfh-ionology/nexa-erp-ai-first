import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { act } from 'react';

import { useViewState } from './use-view-state';
import { useViewStore } from '@/stores/view-store';
import type { ViewInitResponse, DataViewFieldDto, SavedViewDto } from '../types';

// --- Mock fetchViewInit at the API level ---
const mockFetchViewInit = vi.fn();
vi.mock('../api', () => ({
  fetchViewInit: (...args: unknown[]) => mockFetchViewInit(...args),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    views: {
      all: ['views'],
      init: (viewKey: string) => ['views', 'init', viewKey],
      saved: (viewKey: string) => ['views', 'saved', viewKey],
      favourites: () => ['views', 'favourites'],
      columns: (viewKey: string) => ['views', 'columns', viewKey],
    },
  },
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Test data ---

const baseField = (id: string, key: string, label: string, order: number): DataViewFieldDto => ({
  id,
  fieldKey: key,
  fieldLabel: label,
  fieldType: 'STRING',
  defaultVisible: true,
  defaultOrder: order,
  defaultWidth: 150,
  sortable: true,
  filterable: false,
  advancedFilterOnly: false,
  pinnable: true,
  lovType: 'NONE',
  lovScope: null,
  lovStaticValues: null,
  lovDependsOn: null,
  lovSearchMin: 0,
});

const testFields: DataViewFieldDto[] = [
  baseField('f1', 'name', 'Name', 0),
  baseField('f2', 'email', 'Email', 1),
  baseField('f3', 'role', 'Role', 2),
];

const personalDefaultView: SavedViewDto = {
  id: 'sv-personal',
  name: 'My Default',
  groupName: 'Users',
  scope: 'PERSONAL',
  createdBy: 'user-1',
  dataViewId: 'dv1',
  isFavourite: false,
  favouriteOrder: 0,
  isDefault: true,
  filterLogic: 'AND',
  sortConfig: [],
  columnConfig: [
    { fieldId: 'f1', visible: true, order: 0, width: 200, pinned: 'LEFT' },
    { fieldId: 'f2', visible: false, order: 1, width: 150, pinned: 'NONE' },
    { fieldId: 'f3', visible: true, order: 2, width: 120, pinned: 'NONE' },
  ],
  conditions: [],
};

const globalDefaultView: SavedViewDto = {
  id: 'sv-global',
  name: 'Global Default',
  groupName: 'System',
  scope: 'GLOBAL',
  createdBy: 'admin-1',
  dataViewId: 'dv1',
  isFavourite: false,
  favouriteOrder: 0,
  isDefault: true,
  filterLogic: 'AND',
  sortConfig: [],
  columnConfig: [],
  conditions: [],
};

function createInitResponse(
  savedViews: SavedViewDto[] = [],
  fields: DataViewFieldDto[] = testFields,
): ViewInitResponse {
  return {
    dataView: {
      id: 'dv1',
      viewKey: 'USERS',
      viewName: 'Users',
      entityTable: 'users',
      idField: 'id',
      defaultSortField: 'name',
      defaultSortDir: 'ASC',
    },
    fields,
    datePresets: [],
    savedViews,
    userColumnPreferences: null,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useViewState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Zustand store between tests to prevent state leakage (e.g. activeViewId
    // set by "applies personal default" leaking into "falls back to global default")
    useViewStore.setState({ activeViews: {} });
  });

  it('returns loading state initially', async () => {
    mockFetchViewInit.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.columnState).toEqual([]);
    expect(result.current.tanstackColumns).toEqual([]);
  });

  it('computes column state from field defaults when no views or preferences', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse());

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.columnState).toHaveLength(3);
    expect(result.current.columnState[0]!.fieldKey).toBe('name');
    expect(result.current.columnState[0]!.visible).toBe(true);
    expect(result.current.columnState[0]!.width).toBe(150);
    expect(result.current.columnState[0]!.pinned).toBe('NONE');
  });

  it('builds TanStack Table column definitions from visible columns', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse());

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All 3 fields are defaultVisible=true, so tanstackColumns should have 3
    expect(result.current.tanstackColumns).toHaveLength(3);
    expect(result.current.tanstackColumns[0]).toMatchObject({
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      size: 150,
    });
  });

  it('applies personal default view on init (precedence: PERSONAL > ROLE > GLOBAL)', async () => {
    mockFetchViewInit.mockResolvedValue(
      createInitResponse([personalDefaultView, globalDefaultView]),
    );

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should auto-select the personal default
    expect(result.current.activeViewId).toBe('sv-personal');

    // Column state should reflect the personal view's config:
    // f1: visible, width=200, pinned=LEFT
    // f2: not visible
    // f3: visible, width=120
    const nameCol = result.current.columnState.find((c) => c.fieldKey === 'name');
    expect(nameCol?.width).toBe(200);
    expect(nameCol?.pinned).toBe('LEFT');

    const emailCol = result.current.columnState.find((c) => c.fieldKey === 'email');
    expect(emailCol?.visible).toBe(false);
  });

  it('falls back to global default when no personal default exists', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse([globalDefaultView]));

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeViewId).toBe('sv-global');
  });

  it('toggleColumnVisibility marks state dirty', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse());

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.toggleColumnVisibility('f2');
    });

    expect(result.current.isDirty).toBe(true);

    // Email column should now be hidden
    const emailCol = result.current.columnState.find((c) => c.fieldKey === 'email');
    expect(emailCol?.visible).toBe(false);
  });

  it('setActiveView clears dirty state and local overrides', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse([personalDefaultView]));

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Make a change to mark dirty
    act(() => {
      result.current.toggleColumnVisibility('f1');
    });
    expect(result.current.isDirty).toBe(true);

    // Switch view should clear dirty
    act(() => {
      result.current.setActiveView(null);
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('reorderColumns reassigns order values', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse());

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Move column 0 (name) to position 2
    act(() => {
      result.current.reorderColumns(0, 2);
    });

    // After reorder: email(0), role(1), name(2)
    expect(result.current.columnState[0]!.fieldKey).toBe('email');
    expect(result.current.columnState[1]!.fieldKey).toBe('role');
    expect(result.current.columnState[2]!.fieldKey).toBe('name');
    expect(result.current.isDirty).toBe(true);
  });

  it('setColumnPin updates pin and marks dirty', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse());

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setColumnPin('f1', 'LEFT');
    });

    // After pinning, pinned-LEFT columns are sorted first
    const nameCol = result.current.columnState.find((c) => c.fieldKey === 'name');
    expect(nameCol?.pinned).toBe('LEFT');
    expect(result.current.isDirty).toBe(true);
  });

  it('markClean resets dirty flag', async () => {
    mockFetchViewInit.mockResolvedValue(createInitResponse());

    const { result } = renderHook(() => useViewState('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.toggleColumnVisibility('f1');
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.markClean();
    });
    expect(result.current.isDirty).toBe(false);
  });
});
