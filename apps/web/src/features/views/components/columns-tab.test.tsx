/* eslint-disable @typescript-eslint/naming-convention */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ColumnsTab } from './columns-tab';
import type { ViewState } from '../hooks/use-view-state';
import type { useColumnMutations } from '../hooks/use-column-mutations';
import type { ColumnState, DataViewFieldDto } from '../types';

// --- Mock @dnd-kit ---
// Simplified mocks — DndContext is a passthrough, useSortable returns no-op transform
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  closestCenter: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  KeyboardSensor: class {},
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

// --- Test data ---

const mockColumnState: ColumnState[] = [
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
  {
    fieldId: 'f2',
    fieldKey: 'email',
    fieldLabel: 'Email',
    visible: true,
    order: 1,
    width: 200,
    pinned: 'NONE',
    pinnable: false,
    sortable: true,
    fieldType: 'STRING',
  },
  {
    fieldId: 'f3',
    fieldKey: 'role',
    fieldLabel: 'Role',
    visible: false,
    order: 2,
    width: 120,
    pinned: 'LEFT',
    pinnable: true,
    sortable: false,
    fieldType: 'STRING',
  },
];

const mockFields: DataViewFieldDto[] = mockColumnState.map((col) => ({
  id: col.fieldId,
  fieldKey: col.fieldKey,
  fieldLabel: col.fieldLabel,
  fieldType: col.fieldType,
  defaultVisible: true,
  defaultOrder: col.order,
  defaultWidth: col.width,
  sortable: col.sortable,
  filterable: false,
  advancedFilterOnly: false,
  pinnable: col.pinnable,
  lovType: 'NONE' as const,
  lovScope: null,
  lovStaticValues: null,
  lovDependsOn: null,
  lovSearchMin: 0,
}));

function createMockViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    dataView: undefined,
    fields: mockFields,
    savedViews: [],
    datePresets: [],
    columnState: mockColumnState,
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

function createMockColumnMutations() {
  return {
    bulkUpdate: { mutate: vi.fn(), isPending: false },
    debouncedUpdateWidth: vi.fn(),
  } as unknown as ReturnType<typeof useColumnMutations>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ColumnsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all columns from columnState', () => {
    render(
      <ColumnsTab
        viewState={createMockViewState()}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('renders checkboxes for column visibility', () => {
    render(
      <ColumnsTab
        viewState={createMockViewState()}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    // Each column has a visibility checkbox — labelled with column name
    const nameCheckbox = screen.getByRole('checkbox', { name: 'Name' });
    const emailCheckbox = screen.getByRole('checkbox', { name: 'Email' });
    const roleCheckbox = screen.getByRole('checkbox', { name: 'Role' });

    expect(nameCheckbox).toBeInTheDocument();
    expect(emailCheckbox).toBeInTheDocument();
    expect(roleCheckbox).toBeInTheDocument();
  });

  it('calls toggleColumnVisibility when checkbox is clicked', () => {
    const mockViewState = createMockViewState();

    render(
      <ColumnsTab
        viewState={mockViewState}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    const nameCheckbox = screen.getByRole('checkbox', { name: 'Name' });
    fireEvent.click(nameCheckbox);

    expect(mockViewState.toggleColumnVisibility).toHaveBeenCalledWith('f1');
  });

  it('renders pin toggle for pinnable columns only', () => {
    render(
      <ColumnsTab
        viewState={createMockViewState()}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    // Name (pinnable) and Role (pinnable) should have pin buttons
    // Email (not pinnable) should NOT have a pin button
    const pinButtons = screen.getAllByRole('button', {
      name: /views\.columns\.pin/i,
    });

    // Name and Role are pinnable
    expect(pinButtons.length).toBe(2);
  });

  it('renders Apply and Reset to Default buttons', () => {
    render(
      <ColumnsTab
        viewState={createMockViewState()}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('views.columns.apply')).toBeInTheDocument();
    expect(screen.getByText('views.columns.resetToDefault')).toBeInTheDocument();
  });

  it('disables Apply when not dirty', () => {
    render(
      <ColumnsTab
        viewState={createMockViewState({ isDirty: false })}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    const applyButton = screen.getByText('views.columns.apply').closest('button');
    expect(applyButton).toBeDisabled();
  });

  it('enables Apply when dirty', () => {
    render(
      <ColumnsTab
        viewState={createMockViewState({ isDirty: true })}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    const applyButton = screen.getByText('views.columns.apply').closest('button');
    expect(applyButton).not.toBeDisabled();
  });

  it('calls updateColumnState with defaults on Reset to Default click', () => {
    const mockViewState = createMockViewState();

    render(
      <ColumnsTab
        viewState={mockViewState}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    const resetButton = screen.getByText('views.columns.resetToDefault');
    fireEvent.click(resetButton);

    expect(mockViewState.updateColumnState).toHaveBeenCalled();
  });

  it('renders drag handles for reordering', () => {
    render(
      <ColumnsTab
        viewState={createMockViewState()}
        columnMutations={createMockColumnMutations()}
        onClose={vi.fn()}
      />,
    );

    // Each column row should have a drag handle button
    const dragHandles = screen.getAllByLabelText('views.columns.dragToReorder');
    expect(dragHandles.length).toBe(3);
  });
});
