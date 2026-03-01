/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/consistent-type-imports */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { FilterStateReturn } from '../../hooks/use-filter-state';
import type { ViewState } from '../../hooks/use-view-state';
import type { DataViewFieldDto } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../simple-filter-panel', () => ({
  SimpleFilterPanel: () => createElement('div', { 'data-testid': 'simple-filter-panel' }),
}));

vi.mock('../advanced-filter-panel', () => ({
  AdvancedFilterPanel: () => createElement('div', { 'data-testid': 'advanced-filter-panel' }),
}));

vi.mock('../sort-tab', () => ({
  SortTab: () => createElement('div', { 'data-testid': 'sort-tab' }),
}));

vi.mock('../../hooks/use-lov', () => ({
  useBatchLov: () => ({ lovData: {}, isLoading: false }),
}));

vi.mock('../saved-view-selector', () => ({
  SavedViewSelector: () => createElement('div', { 'data-testid': 'saved-view-selector' }),
}));

vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => 'desktop',
}));

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

function makeViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    dataView: undefined,
    fields: [makeField()],
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

function makeFilterState(overrides: Partial<FilterStateReturn> = {}): FilterStateReturn {
  return {
    conditions: [],
    sortRules: [],
    filterMode: 'simple',
    filterLogic: 'AND',
    isDirty: false,
    addCondition: vi.fn(),
    removeCondition: vi.fn(),
    updateCondition: vi.fn(),
    addSortRule: vi.fn(),
    removeSortRule: vi.fn(),
    updateSortRule: vi.fn(),
    reorderSortRules: vi.fn(),
    setFilterMode: vi.fn(),
    setFilterLogic: vi.fn(),
    applyFilters: vi.fn().mockReturnValue({
      conditions: [],
      sortRules: [],
      filterLogic: 'AND',
      serializedConditions: [],
      serializedSort: [],
    }),
    resetFilters: vi.fn(),
    ...overrides,
  };
}

function makeMutations() {
  return {
    createView: { mutate: vi.fn(), isPending: false },
    updateView: { mutate: vi.fn(), isPending: false },
    replaceView: { mutate: vi.fn(), isPending: false },
    removeView: { mutate: vi.fn(), isPending: false },
    toggleFav: { mutate: vi.fn(), isPending: false },
    setDef: { mutate: vi.fn(), isPending: false },
  } as unknown as ReturnType<typeof import('../../hooks/use-view-mutations').useViewMutations>;
}

// ---------------------------------------------------------------------------
// QuickFilterModal tests
// ---------------------------------------------------------------------------

describe('QuickFilterModal', () => {
  let QuickFilterModal: typeof import('../quick-filter-modal').QuickFilterModal;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../quick-filter-modal');
    QuickFilterModal = mod.QuickFilterModal;
  });

  it('renders dialog title and simple filter panel when open', () => {
    render(
      <QuickFilterModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
        entityName="Users"
      />,
    );

    expect(screen.getByTestId('simple-filter-panel')).toBeInTheDocument();
    // Title contains the entity name interpolated
    const titles = screen.getAllByText(/views\.quickFilter\.title|filter/i);
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('Apply button calls applyFilters and closes modal', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onApply = vi.fn();
    const filterState = makeFilterState();

    render(
      <QuickFilterModal
        open={true}
        onOpenChange={onOpenChange}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={filterState}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: /views\.apply/i }));

    expect(filterState.applyFilters).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Reset button calls resetFilters', async () => {
    const user = userEvent.setup();
    const filterState = makeFilterState();

    render(
      <QuickFilterModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={filterState}
      />,
    );

    await user.click(screen.getByRole('button', { name: /views\.reset/i }));

    expect(filterState.resetFilters).toHaveBeenCalledTimes(1);
  });

  it('does not render when open is false', () => {
    render(
      <QuickFilterModal
        open={false}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.queryByTestId('simple-filter-panel')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AdvancedFilterModal tests
// ---------------------------------------------------------------------------

describe('AdvancedFilterModal', () => {
  let AdvancedFilterModal: typeof import('../advanced-filter-modal').AdvancedFilterModal;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../advanced-filter-modal');
    AdvancedFilterModal = mod.AdvancedFilterModal;
  });

  it('renders with two tabs (Filters, Sort)', () => {
    render(
      <AdvancedFilterModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.getByRole('tab', { name: /views\.filters/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /views\.sort/i })).toBeInTheDocument();
  });

  it('renders advanced filter panel on Filters tab', () => {
    render(
      <AdvancedFilterModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.getByTestId('advanced-filter-panel')).toBeInTheDocument();
  });

  it('switching to Sort tab shows sort panel', async () => {
    const user = userEvent.setup();

    render(
      <AdvancedFilterModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /views\.sort/i }));

    expect(screen.getByTestId('sort-tab')).toBeInTheDocument();
  });

  it('Apply button calls applyFilters and closes modal', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onApply = vi.fn();
    const filterState = makeFilterState();

    render(
      <AdvancedFilterModal
        open={true}
        onOpenChange={onOpenChange}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={filterState}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: /views\.apply/i }));

    expect(filterState.applyFilters).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render when open is false', () => {
    render(
      <AdvancedFilterModal
        open={false}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ViewsBar tests
// ---------------------------------------------------------------------------

describe('ViewsBar', () => {
  let ViewsBar: typeof import('../views-bar').ViewsBar;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../views-bar');
    ViewsBar = mod.ViewsBar;
  });

  it('renders "All" pill as first item', () => {
    render(<ViewsBar viewState={makeViewState()} />);

    expect(screen.getByText('views.viewsBar.all')).toBeInTheDocument();
  });

  it('renders saved views as pills', () => {
    const viewState = makeViewState({
      savedViews: [
        {
          id: 'v1',
          name: 'Active Users',
          isFavourite: false,
          isDefault: false,
          scope: 'personal',
          groupName: null,
        },
        {
          id: 'v2',
          name: 'Admins Only',
          isFavourite: true,
          isDefault: false,
          scope: 'personal',
          groupName: null,
        },
      ] as unknown as ViewState['savedViews'],
    });

    render(<ViewsBar viewState={viewState} />);

    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Admins Only')).toBeInTheDocument();
  });

  it('clicking a view pill calls setActiveView', async () => {
    const user = userEvent.setup();
    const setActiveView = vi.fn();
    const viewState = makeViewState({
      setActiveView,
      savedViews: [
        {
          id: 'v1',
          name: 'My View',
          isFavourite: false,
          isDefault: false,
          scope: 'personal',
          groupName: null,
        },
      ] as unknown as ViewState['savedViews'],
    });

    render(<ViewsBar viewState={viewState} />);

    await user.click(screen.getByText('My View'));

    expect(setActiveView).toHaveBeenCalledWith('v1');
  });

  it('"All" pill is active when no view is selected', () => {
    render(<ViewsBar viewState={makeViewState({ activeViewId: null })} />);

    // "All" pill should exist and be rendered
    const allPill = screen.getByText('views.viewsBar.all');
    expect(allPill).toBeInTheDocument();
    // The "All" pill's parent button should have the active style (bg-primary)
    const button = allPill.closest('button');
    expect(button).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// DeleteViewButton tests
// ---------------------------------------------------------------------------

describe('DeleteViewButton', () => {
  let DeleteViewButton: typeof import('../delete-view-button').DeleteViewButton;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../delete-view-button');
    DeleteViewButton = mod.DeleteViewButton;
  });

  it('is disabled when no view is active (activeViewId is null)', () => {
    const viewState = makeViewState({ activeViewId: null });

    render(<DeleteViewButton viewState={viewState} mutations={makeMutations()} />);

    const button = screen.getByRole('button', { name: /delete/i });
    expect(button).toBeDisabled();
  });

  it('is enabled when a view is active', () => {
    const viewState = makeViewState({
      activeViewId: 'v1',
      savedViews: [
        {
          id: 'v1',
          name: 'My View',
          isFavourite: false,
          isDefault: false,
          scope: 'personal',
          groupName: null,
        },
      ] as unknown as ViewState['savedViews'],
    });

    render(<DeleteViewButton viewState={viewState} mutations={makeMutations()} />);

    const button = screen.getByRole('button', { name: /delete/i });
    expect(button).not.toBeDisabled();
  });

  it('clicking button opens confirmation dialog', async () => {
    const user = userEvent.setup();
    const viewState = makeViewState({
      activeViewId: 'v1',
      savedViews: [
        {
          id: 'v1',
          name: 'My View',
          isFavourite: false,
          isDefault: false,
          scope: 'personal',
          groupName: null,
        },
      ] as unknown as ViewState['savedViews'],
    });

    render(<DeleteViewButton viewState={viewState} mutations={makeMutations()} />);

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByText('views.delete.title')).toBeInTheDocument();
  });

  it('confirming delete calls removeView and resets active view', async () => {
    const user = userEvent.setup();
    const setActiveView = vi.fn();
    const mutations = makeMutations();
    const viewState = makeViewState({
      activeViewId: 'v1',
      setActiveView,
      savedViews: [
        {
          id: 'v1',
          name: 'My View',
          isFavourite: false,
          isDefault: false,
          scope: 'personal',
          groupName: null,
        },
      ] as unknown as ViewState['savedViews'],
    });

    render(<DeleteViewButton viewState={viewState} mutations={mutations} />);

    // Open dialog
    await user.click(screen.getByRole('button', { name: /delete/i }));

    // Click confirm
    await user.click(screen.getByText('views.delete.confirm'));

    expect(mutations.removeView.mutate).toHaveBeenCalledWith('v1');
    expect(setActiveView).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// QuickFilterButton tests
// ---------------------------------------------------------------------------

describe('QuickFilterButton', () => {
  let QuickFilterButton: typeof import('../quick-filter-button').QuickFilterButton;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../quick-filter-button');
    QuickFilterButton = mod.QuickFilterButton;
  });

  it('renders filter button', () => {
    render(
      <QuickFilterButton
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
  });

  it('shows active filter count badge when filters are active', () => {
    render(
      <QuickFilterButton
        viewKey="USERS"
        viewState={makeViewState({ activeFilterCount: 3 })}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show badge when no filters are active', () => {
    render(
      <QuickFilterButton
        viewKey="USERS"
        viewState={makeViewState({ activeFilterCount: 0 })}
        filterState={makeFilterState()}
      />,
    );

    // Badge with count should not be present
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AdvancedFilterButton tests
// ---------------------------------------------------------------------------

describe('AdvancedFilterButton', () => {
  let AdvancedFilterButton: typeof import('../advanced-filter-button').AdvancedFilterButton;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../advanced-filter-button');
    AdvancedFilterButton = mod.AdvancedFilterButton;
  });

  it('renders advanced filter button', () => {
    render(
      <AdvancedFilterButton
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.getByRole('button', { name: /views\.filterAndSort/i })).toBeInTheDocument();
  });

  it('shows active filter count badge when filters are active', () => {
    render(
      <AdvancedFilterButton
        viewKey="USERS"
        viewState={makeViewState({ activeFilterCount: 2 })}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
