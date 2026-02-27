/* eslint-disable @typescript-eslint/naming-convention */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';

import type { FilterStateReturn } from '../../hooks/use-filter-state';
import type { ViewState } from '../../hooks/use-view-state';
import type { DataViewFieldDto } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock child panels to keep tests focused on the modal shell
vi.mock('../simple-filter-panel', () => ({
  SimpleFilterPanel: () => createElement('div', { 'data-testid': 'simple-filter-panel' }),
}));

vi.mock('../advanced-filter-panel', () => ({
  AdvancedFilterPanel: () => createElement('div', { 'data-testid': 'advanced-filter-panel' }),
}));

vi.mock('../sort-tab', () => ({
  SortTab: () => createElement('div', { 'data-testid': 'sort-tab' }),
}));

// Mock LOV hook
vi.mock('../../hooks/use-lov', () => ({
  useBatchLov: () => ({ lovData: {}, isLoading: false }),
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

async function importComponent() {
  const mod = await import('../filter-sort-modal');
  return mod.FilterSortModal;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterSortModal', () => {
  let FilterSortModal: Awaited<ReturnType<typeof importComponent>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    FilterSortModal = await importComponent();
  });

  it('renders with two tabs (Filters, Sort)', () => {
    const onOpenChange = vi.fn();
    const viewState = makeViewState();
    const filterState = makeFilterState();

    render(
      <FilterSortModal
        open={true}
        onOpenChange={onOpenChange}
        viewKey="USERS"
        viewState={viewState}
        filterState={filterState}
      />,
    );

    // Tab triggers should be visible
    expect(screen.getByRole('tab', { name: /views\.filters/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /views\.sort/i })).toBeInTheDocument();
  });

  it('renders dialog title with translation key', () => {
    render(
      <FilterSortModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    // Title and sr-only description both contain the key; verify at least one is present
    const matches = screen.getAllByText('views.filterAndSort');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('Apply button calls applyFilters and closes modal', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onApply = vi.fn();
    const filterState = makeFilterState();

    render(
      <FilterSortModal
        open={true}
        onOpenChange={onOpenChange}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={filterState}
        onApply={onApply}
      />,
    );

    const applyButton = screen.getByRole('button', { name: /views\.apply/i });
    await user.click(applyButton);

    expect(filterState.applyFilters).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Reset button calls resetFilters', async () => {
    const user = userEvent.setup();
    const filterState = makeFilterState();

    render(
      <FilterSortModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={filterState}
      />,
    );

    const resetButton = screen.getByRole('button', { name: /views\.reset/i });
    await user.click(resetButton);

    expect(filterState.resetFilters).toHaveBeenCalledTimes(1);
  });

  it('renders simple filter panel by default', () => {
    render(
      <FilterSortModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState({ filterMode: 'simple' })}
      />,
    );

    expect(screen.getByTestId('simple-filter-panel')).toBeInTheDocument();
  });

  it('renders advanced filter panel when mode is advanced', () => {
    render(
      <FilterSortModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState({ filterMode: 'advanced' })}
      />,
    );

    expect(screen.getByTestId('advanced-filter-panel')).toBeInTheDocument();
  });

  it('mode toggle buttons are rendered', () => {
    render(
      <FilterSortModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.getByText('views.simpleMode')).toBeInTheDocument();
    expect(screen.getByText('views.advancedMode')).toBeInTheDocument();
  });

  it('clicking Advanced mode button calls setFilterMode', async () => {
    const user = userEvent.setup();
    const filterState = makeFilterState({ filterMode: 'simple' });

    render(
      <FilterSortModal
        open={true}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={filterState}
      />,
    );

    const advancedBtn = screen.getByText('views.advancedMode');
    await user.click(advancedBtn);

    expect(filterState.setFilterMode).toHaveBeenCalledWith('advanced');
  });

  it('does not render when open is false', () => {
    render(
      <FilterSortModal
        open={false}
        onOpenChange={vi.fn()}
        viewKey="USERS"
        viewState={makeViewState()}
        filterState={makeFilterState()}
      />,
    );

    expect(screen.queryAllByText('views.filterAndSort')).toHaveLength(0);
  });
});
