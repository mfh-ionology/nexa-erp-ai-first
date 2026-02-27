/* eslint-disable @typescript-eslint/naming-convention */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

import { ViewsAndColumnsModal } from './views-columns-modal';
import type { ViewState } from '../hooks/use-view-state';
import type { useViewMutations } from '../hooks/use-view-mutations';
import type { useColumnMutations } from '../hooks/use-column-mutations';

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
    savedViews: [],
    datePresets: [],
    columnState: [
      {
        fieldId: 'f1',
        fieldKey: 'name',
        fieldLabel: 'Name',
        visible: true,
        order: 0,
        width: 150,
        pinned: 'NONE',
        pinnable: true,
        sortable: true,
        fieldType: 'STRING',
      },
    ],
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

function createMockColumnMutations() {
  return {
    bulkUpdate: { mutate: vi.fn(), isPending: false },
    debouncedUpdateWidth: vi.fn(),
  } as unknown as ReturnType<typeof useColumnMutations>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ViewsAndColumnsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with two tabs when open', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsAndColumnsModal
          open={true}
          onOpenChange={vi.fn()}
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          columnMutations={createMockColumnMutations()}
        />
      </Wrapper>,
    );

    // Modal title
    expect(screen.getByText('views.modal.title')).toBeInTheDocument();

    // Two tabs
    expect(screen.getByRole('tab', { name: /views\.tabs\.views/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /views\.tabs\.columns/i })).toBeInTheDocument();
  });

  it('switches between Views and Columns tabs', async () => {
    const user = userEvent.setup();
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsAndColumnsModal
          open={true}
          onOpenChange={vi.fn()}
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          columnMutations={createMockColumnMutations()}
        />
      </Wrapper>,
    );

    // Default: Views tab is active
    const viewsTab = screen.getByRole('tab', { name: /views\.tabs\.views/i });
    const columnsTab = screen.getByRole('tab', { name: /views\.tabs\.columns/i });

    expect(viewsTab).toHaveAttribute('data-state', 'active');
    expect(columnsTab).toHaveAttribute('data-state', 'inactive');

    // Switch to Columns tab using userEvent (Radix needs pointer events)
    await user.click(columnsTab);

    expect(columnsTab).toHaveAttribute('data-state', 'active');
    expect(viewsTab).toHaveAttribute('data-state', 'inactive');
  });

  it('does not render content when closed', () => {
    const Wrapper = createQueryWrapper();

    render(
      <Wrapper>
        <ViewsAndColumnsModal
          open={false}
          onOpenChange={vi.fn()}
          viewKey="USERS"
          viewState={createMockViewState()}
          mutations={createMockMutations()}
          columnMutations={createMockColumnMutations()}
        />
      </Wrapper>,
    );

    expect(screen.queryByText('views.modal.title')).not.toBeInTheDocument();
  });
});
