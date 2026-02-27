import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin, PinOff } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ColumnState, PinPosition } from '../types';
import type { ViewState } from '../hooks/use-view-state';
import type { useColumnMutations } from '../hooks/use-column-mutations';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColumnsTabProps {
  viewState: ViewState;
  columnMutations: ReturnType<typeof useColumnMutations>;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Pin cycle helper: NONE → LEFT → RIGHT → NONE
// ---------------------------------------------------------------------------

const PIN_CYCLE: PinPosition[] = ['NONE', 'LEFT', 'RIGHT'];

function nextPin(current: PinPosition): PinPosition {
  const idx = PIN_CYCLE.indexOf(current);
  return PIN_CYCLE[(idx + 1) % PIN_CYCLE.length] ?? 'NONE';
}

function pinLabel(pin: PinPosition, t: (key: string) => string): string {
  switch (pin) {
    case 'LEFT':
      return t('views.columns.pinLeft');
    case 'RIGHT':
      return t('views.columns.pinRight');
    default:
      return t('views.columns.pinNone');
  }
}

// ---------------------------------------------------------------------------
// Sortable column row
// ---------------------------------------------------------------------------

interface SortableColumnRowProps {
  column: ColumnState;
  onToggleVisibility: (fieldId: string) => void;
  onCyclePin: (fieldId: string) => void;
}

function SortableColumnRow({ column, onToggleVisibility, onCyclePin }: SortableColumnRowProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.fieldId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
        'hover:bg-accent/50',
        isDragging && 'z-50 bg-card shadow-md opacity-90',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded focus-visible:outline-none focus-visible:ring-2"
        aria-label={t('views.columns.dragToReorder')}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Visibility checkbox */}
      <Checkbox
        checked={column.visible}
        onCheckedChange={() => {
          onToggleVisibility(column.fieldId);
        }}
        aria-label={column.fieldLabel}
      />

      {/* Column label */}
      <span
        className={cn('flex-1 text-sm select-none', !column.visible && 'text-muted-foreground')}
      >
        {column.fieldLabel}
      </span>

      {/* Pin toggle */}
      {column.pinnable && (
        <button
          type="button"
          onClick={() => {
            onCyclePin(column.fieldId);
          }}
          className={cn(
            'rounded p-1 transition-colors focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-2',
            column.pinned === 'LEFT' && 'text-primary bg-primary/10',
            column.pinned === 'RIGHT' && 'text-blue-600 bg-blue-600/10',
            column.pinned === 'NONE' &&
              'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
          title={pinLabel(column.pinned, t)}
          aria-label={pinLabel(column.pinned, t)}
        >
          {column.pinned === 'NONE' ? (
            <PinOff className="size-3.5" />
          ) : (
            <Pin className="size-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main columns tab
// ---------------------------------------------------------------------------

export function ColumnsTab({ viewState, columnMutations, onClose }: ColumnsTabProps) {
  const { t } = useI18n();
  const [isApplying, setIsApplying] = useState(false);

  // Sorted column list for the DnD context — use order as-is from viewState
  const columns = viewState.columnState;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Sortable item IDs
  const sortableIds = useMemo(() => columns.map((c) => c.fieldId), [columns]);

  // Handle drag end — reorder columns
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = columns.findIndex((c) => c.fieldId === active.id);
      const toIndex = columns.findIndex((c) => c.fieldId === over.id);
      if (fromIndex === -1 || toIndex === -1) return;

      viewState.reorderColumns(fromIndex, toIndex);
    },
    [columns, viewState],
  );

  // Toggle column visibility
  const handleToggleVisibility = useCallback(
    (fieldId: string) => {
      viewState.toggleColumnVisibility(fieldId);
    },
    [viewState],
  );

  // Cycle pin position
  const handleCyclePin = useCallback(
    (fieldId: string) => {
      const col = columns.find((c) => c.fieldId === fieldId);
      if (!col) return;
      viewState.setColumnPin(fieldId, nextPin(col.pinned));
    },
    [columns, viewState],
  );

  // Apply — persist column preferences to backend
  const handleApply = useCallback(() => {
    setIsApplying(true);
    const prefs = columns.map((col) => ({
      dataViewFieldId: col.fieldId,
      visible: col.visible,
      displayOrder: col.order,
      width: col.width,
      pinned: col.pinned,
    }));

    columnMutations.bulkUpdate.mutate(prefs, {
      onSuccess: () => {
        viewState.markClean();
        setIsApplying(false);
        onClose();
      },
      onError: () => {
        setIsApplying(false);
      },
    });
  }, [columns, columnMutations, viewState, onClose]);

  // Reset to Default — revert to field metadata defaults
  const handleResetToDefault = useCallback(() => {
    if (!viewState.fields) return;

    const defaults = viewState.fields.map((f) => ({
      fieldId: f.id,
      visible: f.defaultVisible,
      order: f.defaultOrder,
      width: f.defaultWidth,
      pinned: 'NONE' as PinPosition,
    }));

    viewState.updateColumnState(defaults);
  }, [viewState]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t('views.columns.title')}
      </p>

      {/* Column list */}
      <ScrollArea className="max-h-[320px]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {columns.map((col) => (
                <SortableColumnRow
                  key={col.fieldId}
                  column={col}
                  onToggleVisibility={handleToggleVisibility}
                  onCyclePin={handleCyclePin}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetToDefault}
          className="text-muted-foreground"
        >
          {t('views.columns.resetToDefault')}
        </Button>

        <div className="flex-1" />

        <Button
          variant="default"
          size="sm"
          onClick={handleApply}
          disabled={!viewState.isDirty || isApplying}
        >
          {t('views.columns.apply')}
        </Button>
      </div>
    </div>
  );
}
