/* eslint-disable @typescript-eslint/naming-convention */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

import { ViewsTab } from './views-tab';
import type { ViewState } from '../hooks/use-view-state';
import type { useViewMutations } from '../hooks/use-view-mutations';
import type { SavedViewDto } from '../types';

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: 'user-1' },
      permissions: { isSuperAdmin: false, accessGroups: [] },
    }),
  ),
}));

// --- Mock toast ---
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// --- Mock ConfirmationDialog ---
vi.mock('@/components/action-bar/confirmation-dialog', () => ({
  ConfirmationDialog: () => null,
}));

// --- Mock API client ---
vi.mock('@nexa/api-client', () => ({
  ApiError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

// --- Mock form utilities ---
vi.mock('@/lib/form-utils', () => {
  return {
    Form: ({ children, ...rest }: { children: ReactNode }) => createElement('form', rest, children),
    FormField: ({
      render,
    }: {
      render: (args: Record<string, unknown>) => ReactNode;
      control: unknown;
      name: string;
    }) =>
      render({ field: { value: '', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn(), name: '' } }),
    FormItem: ({ children }: { children: ReactNode }) => createElement('div', null, children),
    FormLabel: ({ children }: { children: ReactNode }) => createElement('label', null, children),
    FormControl: ({ children }: { children: ReactNode }) => createElement('div', null, children),
    FormMessage: () => null,
    useZodForm: () => ({
      control: {},
      handleSubmit: (fn: () => void) => (e: Event) => {
        e.preventDefault();
        fn();
      },
      watch: () => 'PERSONAL',
      setError: vi.fn(),
    }),
  };
});

// --- Test helpers ---

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockPersonalView: SavedViewDto = {
  id: 'v1',
  name: 'My Active Users',
  groupName: 'Users',
  scope: 'PERSONAL',
  createdBy: 'user-1',
  dataViewId: 'dv1',
  isFavourite: false,
  favouriteOrder: 0,
  isDefault: false,
  filterLogic: 'AND',
  sortConfig: [],
  columnConfig: [],
  conditions: [],
};

const mockRoleView: SavedViewDto = {
  id: 'v2',
  name: 'Team View',
  groupName: 'Sales',
  scope: 'ROLE',
  createdBy: 'user-2',
  dataViewId: 'dv1',
  isFavourite: true,
  favouriteOrder: 1,
  isDefault: false,
  filterLogic: 'AND',
  sortConfig: [],
  columnConfig: [],
  conditions: [],
};

const mockGlobalView: SavedViewDto = {
  id: 'v3',
  name: 'All Users',
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

function createMockViewState(overrides: Partial<ViewState> = {}): ViewState {
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
    fields: [],
    savedViews: [mockPersonalView, mockRoleView, mockGlobalView],
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

function createMockMutations() {
  return {
    createView: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    updateView: { mutate: vi.fn(), isPending: false },
    replaceView: { mutate: vi.fn(), isPending: false },
    removeView: { mutate: vi.fn(), isPending: false },
    toggleFav: { mutate: vi.fn(), isPending: false },
    setDef: { mutate: vi.fn(), isPending: false },
  } as unknown as ReturnType<typeof useViewMutations>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ViewsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders scope section headers with counts', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsTab
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    // Scope headers should be rendered
    expect(screen.getByText('views.scope.personal')).toBeInTheDocument();
    expect(screen.getByText('views.scope.role')).toBeInTheDocument();
    expect(screen.getByText('views.scope.global')).toBeInTheDocument();
  });

  it('groups views by scope and shows view names', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsTab
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    // View names should be displayed
    expect(screen.getByText('My Active Users')).toBeInTheDocument();
    expect(screen.getByText('Team View')).toBeInTheDocument();
    expect(screen.getByText('All Users')).toBeInTheDocument();
  });

  it('shows default badge for default view', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsTab
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    // The global view (v3) has isDefault=true, should show badge
    expect(screen.getByText('views.badge.default')).toBeInTheDocument();
  });

  it('shows Save as New View button', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsTab
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText('views.actions.saveNew')).toBeInTheDocument();
  });

  it('shows Save Current View button when dirty and has active view', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsTab
          viewKey="USERS"
          viewState={createMockViewState({ activeViewId: 'v1', isDirty: true })}
          mutations={createMockMutations()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText('views.actions.saveCurrent')).toBeInTheDocument();
  });

  it('hides Save Current View button when not dirty', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsTab
          viewKey="USERS"
          viewState={createMockViewState({ activeViewId: 'v1', isDirty: false })}
          mutations={createMockMutations()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.queryByText('views.actions.saveCurrent')).not.toBeInTheDocument();
  });

  it('renders star toggle buttons for each view', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsTab
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    // Each view has a star toggle — look for favourite/unfavourite aria labels
    const favButtons = screen.getAllByLabelText(/views\.actions\.(favourite|unfavourite)/);
    expect(favButtons.length).toBe(3);
  });
});
