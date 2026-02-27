/**
 * SortTab — manages sort rules inside the Filter & Sort modal.
 *
 * Vertical list of drag-reorderable sort rules. Each rule has a field select,
 * ASC/DESC direction toggle, and remove button. Max 5 rules.
 *
 * Uses @dnd-kit for drag-reorder, same pattern as columns-tab.tsx.
 *
 * Created per E7-3 Task 6.1.
 */

import { useCallback, useMemo } from 'react';
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
import { ArrowDownAZ, ArrowUpAZ, GripVertical, Plus, X } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { DataViewFieldDto, SortRuleState } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SORT_RULES = 5;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SortTabProps {
  sortRules: SortRuleState[];
  fields: DataViewFieldDto[];
  onAddRule: (field?: DataViewFieldDto) => void;
  onRemoveRule: (id: string) => void;
  onUpdateRule: (id: string, updates: Partial<SortRuleState>) => void;
  onReorderRules: (fromIndex: number, toIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Sortable rule row
// ---------------------------------------------------------------------------

interface SortableRuleRowProps {
  rule: SortRuleState;
  fields: DataViewFieldDto[];
  usedFieldKeys: Set<string>;
  onUpdate: (id: string, updates: Partial<SortRuleState>) => void;
  onRemove: (id: string) => void;
}

function SortableRuleRow({
  rule,
  fields,
  usedFieldKeys,
  onUpdate,
  onRemove,
}: SortableRuleRowProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Sortable fields: include the currently selected field + any unselected sortable fields
  const availableFields = useMemo(
    () =>
      fields.filter(
        (f) => f.sortable && (!usedFieldKeys.has(f.fieldKey) || f.fieldKey === rule.field),
      ),
    [fields, usedFieldKeys, rule.field],
  );

  const handleFieldChange = useCallback(
    (fieldId: string) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;
      onUpdate(rule.id, {
        field: field.fieldKey,
        fieldLabel: field.fieldLabel,
      });
    },
    [fields, onUpdate, rule.id],
  );

  const handleDirectionToggle = useCallback(() => {
    onUpdate(rule.id, {
      direction: rule.direction === 'ASC' ? 'DESC' : 'ASC',
    });
  }, [onUpdate, rule.id, rule.direction]);

  const handleRemove = useCallback(() => {
    onRemove(rule.id);
  }, [onRemove, rule.id]);

  // Resolve field ID from fieldKey for the Select value
  const selectedFieldId = useMemo(() => {
    const field = fields.find((f) => f.fieldKey === rule.field);
    return field?.id ?? '';
  }, [fields, rule.field]);

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
        aria-label={t('views.dragToReorder')}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Priority number */}
      <span className="w-5 text-center text-xs font-mono text-muted-foreground tabular-nums">
        {rule.priority}
      </span>

      {/* Field select */}
      <Select value={selectedFieldId} onValueChange={handleFieldChange}>
        <SelectTrigger className="h-8 flex-1 min-w-0 text-sm">
          <SelectValue placeholder={t('views.selectField')} />
        </SelectTrigger>
        <SelectContent>
          {availableFields.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.fieldLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Direction toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDirectionToggle}
        className={cn(
          'h-8 gap-1 px-2 text-xs font-medium',
          'hover:bg-primary/10 hover:text-primary',
        )}
        title={rule.direction === 'ASC' ? t('views.ascending') : t('views.descending')}
        aria-label={rule.direction === 'ASC' ? t('views.ascending') : t('views.descending')}
      >
        {rule.direction === 'ASC' ? (
          <ArrowUpAZ className="size-4 text-primary" />
        ) : (
          <ArrowDownAZ className="size-4 text-primary" />
        )}
        <span className="hidden sm:inline">
          {rule.direction === 'ASC' ? t('views.ascending') : t('views.descending')}
        </span>
      </Button>

      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleRemove}
        className="size-7 text-muted-foreground hover:text-destructive"
        aria-label={t('views.removeSortRule')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main sort tab
// ---------------------------------------------------------------------------

export function SortTab({
  sortRules,
  fields,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  onReorderRules,
}: SortTabProps) {
  const { t } = useI18n();

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
  const sortableIds = useMemo(() => sortRules.map((r) => r.id), [sortRules]);

  // Track used field keys to prevent duplicate sort fields
  const usedFieldKeys = useMemo(
    () => new Set(sortRules.map((r) => r.field).filter(Boolean)),
    [sortRules],
  );

  // Handle drag end — reorder sort rules
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = sortRules.findIndex((r) => r.id === active.id);
      const toIndex = sortRules.findIndex((r) => r.id === over.id);
      if (fromIndex === -1 || toIndex === -1) return;

      onReorderRules(fromIndex, toIndex);
    },
    [sortRules, onReorderRules],
  );

  const handleAddRule = useCallback(() => {
    onAddRule();
  }, [onAddRule]);

  const atMax = sortRules.length >= MAX_SORT_RULES;

  return (
    <div className="flex flex-col gap-3">
      {sortRules.length === 0 ? (
        /* Empty state */
        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          {t('views.noSortRules')}
        </div>
      ) : (
        /* Sort rules list */
        <ScrollArea className="max-h-[280px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {sortRules.map((rule) => (
                  <SortableRuleRow
                    key={rule.id}
                    rule={rule}
                    fields={fields}
                    usedFieldKeys={usedFieldKeys}
                    onUpdate={onUpdateRule}
                    onRemove={onRemoveRule}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>
      )}

      {/* Add sort rule button */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddRule}
          disabled={atMax}
          className="gap-1 text-primary hover:text-primary hover:bg-primary/10"
        >
          <Plus className="size-3.5" />
          {t('views.addSortRule')}
        </Button>
        {atMax && <p className="mt-1 text-xs text-muted-foreground">{t('views.maxSortRules')}</p>}
      </div>
    </div>
  );
}
