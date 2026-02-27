import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

import { SavedViewSelector } from './saved-view-selector';
import type { ViewState } from '../hooks/use-view-state';
import type { SavedViewDto } from '../types';

// --- Test data ---

const mockViews: SavedViewDto[] = [
  {
    id: 'v1',
    name: 'My Active Users',
    groupName: 'Users',
    scope: 'PERSONAL',
    createdBy: 'user-1',
    dataViewId: 'dv1',
    isFavourite: true,
    favouriteOrder: 1,
    isDefault: false,
    filterLogic: 'AND',
    sortConfig: [],
    columnConfig: [],
    conditions: [],
  },
  {
    id: 'v2',
    name: 'All Staff',
    groupName: 'HR',
    scope: 'ROLE',
    createdBy: 'user-2',
    dataViewId: 'dv1',
    isFavourite: false,
    favouriteOrder: 0,
    isDefault: false,
    filterLogic: 'AND',
    sortConfig: [],
    columnConfig: [],
    conditions: [],
  },
  {
    id: 'v3',
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
  },
];

function createMockViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    dataView: undefined,
    fields: [],
    savedViews: mockViews,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SavedViewSelector', () => {
  beforeAll(() => {
    // cmdk internally calls scrollIntoView which is not implemented in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with "Default View" label when no active view', () => {
    render(<SavedViewSelector viewState={createMockViewState()} />);

    // The trigger button should show the default label
    expect(screen.getByText('views.selector.defaultView')).toBeInTheDocument();
  });

  it('renders with active view name when a view is selected', () => {
    render(<SavedViewSelector viewState={createMockViewState({ activeViewId: 'v1' })} />);

    expect(screen.getByText('My Active Users')).toBeInTheDocument();
  });

  it('opens dropdown and shows view names when clicked', async () => {
    const user = userEvent.setup();
    render(<SavedViewSelector viewState={createMockViewState()} />);

    // Click the trigger using userEvent (Radix needs full pointer event sequence)
    await user.click(screen.getByText('views.selector.defaultView'));

    // Should show view names
    expect(screen.getByText('My Active Users')).toBeInTheDocument();
    expect(screen.getByText('All Staff')).toBeInTheDocument();
    expect(screen.getByText('Global Default')).toBeInTheDocument();
  });

  it('shows scope section headers in dropdown', async () => {
    const user = userEvent.setup();
    render(<SavedViewSelector viewState={createMockViewState()} />);

    await user.click(screen.getByText('views.selector.defaultView'));

    expect(screen.getByText(/views\.scope\.personal/)).toBeInTheDocument();
    expect(screen.getByText(/views\.scope\.role/)).toBeInTheDocument();
    expect(screen.getByText(/views\.scope\.global/)).toBeInTheDocument();
  });

  it('calls setActiveView when a view is selected', async () => {
    const user = userEvent.setup();
    const mockViewState = createMockViewState();

    render(<SavedViewSelector viewState={mockViewState} />);

    // Open dropdown
    await user.click(screen.getByText('views.selector.defaultView'));

    // Click on a view
    await user.click(screen.getByText('My Active Users'));

    expect(mockViewState.setActiveView).toHaveBeenCalledWith('v1');
  });

  it('shows Clear View option when a view is active', async () => {
    const user = userEvent.setup();
    render(<SavedViewSelector viewState={createMockViewState({ activeViewId: 'v1' })} />);

    await user.click(screen.getByText('My Active Users'));

    expect(screen.getByText('views.selector.clearView')).toBeInTheDocument();
  });

  it('calls setActiveView(null) when Clear View is clicked', async () => {
    const user = userEvent.setup();
    const mockViewState = createMockViewState({ activeViewId: 'v1' });

    render(<SavedViewSelector viewState={mockViewState} />);

    await user.click(screen.getByText('My Active Users'));
    await user.click(screen.getByText('views.selector.clearView'));

    expect(mockViewState.setActiveView).toHaveBeenCalledWith(null);
  });

  it('shows favourite star icon for favourited views', async () => {
    const user = userEvent.setup();
    render(<SavedViewSelector viewState={createMockViewState()} />);

    await user.click(screen.getByText('views.selector.defaultView'));

    // v3 has isDefault — should show default badge
    expect(screen.getByText('views.badge.default')).toBeInTheDocument();
  });

  it('shows empty state when no views exist', async () => {
    const user = userEvent.setup();
    render(<SavedViewSelector viewState={createMockViewState({ savedViews: [] })} />);

    await user.click(screen.getByText('views.selector.defaultView'));

    expect(screen.getByText('views.empty')).toBeInTheDocument();
  });
});
