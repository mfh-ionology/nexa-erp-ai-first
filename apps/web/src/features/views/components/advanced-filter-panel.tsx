/**
 * AdvancedFilterPanel — advanced filter mode with condition rows,
 * AND/OR logic toggles, and group bracketing.
 *
 * Features:
 * - Condition rows with field/operator/value selection
 * - AND/OR toggle between conditions within a group
 * - Group bracketing with visual indicators (border-left)
 * - "Add Condition" and "Add Group" buttons
 *
 * The Simple/Advanced mode toggle and the switch-to-simple warning dialog
 * are rendered by the parent FilterSortModal.
 *
 * Created per E7-3 Task 5.1.
 */

import { useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import type {
  DataViewFieldDto,
  DateRangePresetDto,
  FilterConditionState,
  LovStaticValue,
} from '../types';
import { ConditionRow } from './condition-row';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdvancedFilterPanelProps {
  fields: DataViewFieldDto[];
  conditions: FilterConditionState[];
  filterLogic: 'AND' | 'OR';
  lovData: Record<string, LovStaticValue[]>;
  datePresets: DateRangePresetDto[];
  onAddCondition: (field?: DataViewFieldDto) => FilterConditionState;
  onRemoveCondition: (id: string) => void;
  onUpdateCondition: (id: string, updates: Partial<FilterConditionState>) => void;
  onSetFilterLogic: (logic: 'AND' | 'OR') => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group conditions by groupId for visual bracketing.
 */
function groupConditions(conditions: FilterConditionState[]): Map<number, FilterConditionState[]> {
  const groups = new Map<number, FilterConditionState[]>();
  for (const c of conditions) {
    const group = groups.get(c.groupId) ?? [];
    group.push(c);
    groups.set(c.groupId, group);
  }
  return groups;
}

function getNextGroupId(conditions: FilterConditionState[]): number {
  if (conditions.length === 0) return 0;
  return Math.max(...conditions.map((c) => c.groupId)) + 1;
}

// ---------------------------------------------------------------------------
// Condition Group — renders a bracketed group of conditions
// ---------------------------------------------------------------------------

function ConditionGroup({
  groupId,
  conditions,
  fields,
  lovData,
  datePresets,
  isOnlyGroup,
  outerLogic,
  onUpdateCondition,
  onRemoveCondition,
  onToggleOuterLogic,
  showOuterToggle,
}: {
  groupId: number;
  conditions: FilterConditionState[];
  fields: DataViewFieldDto[];
  lovData: Record<string, LovStaticValue[]>;
  datePresets: DateRangePresetDto[];
  isOnlyGroup: boolean;
  outerLogic: 'AND' | 'OR';
  onUpdateCondition: (id: string, updates: Partial<FilterConditionState>) => void;
  onRemoveCondition: (id: string) => void;
  onToggleOuterLogic: () => void;
  showOuterToggle: boolean;
}) {
  const { t } = useI18n();

  const handleToggleInnerLogic = useCallback(
    (conditionId: string) => {
      const condition = conditions.find((c) => c.id === conditionId);
      if (!condition) return;
      const newLogic: 'AND' | 'OR' = condition.groupLogic === 'AND' ? 'OR' : 'AND';
      // Update all conditions in this group to the same logic
      for (const c of conditions) {
        onUpdateCondition(c.id, { groupLogic: newLogic });
      }
    },
    [conditions, onUpdateCondition],
  );

  return (
    <div className="space-y-1">
      {/* Outer logic toggle between groups */}
      {showOuterToggle && (
        <div className="flex justify-start py-1">
          <button
            type="button"
            onClick={onToggleOuterLogic}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              'bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            {outerLogic === 'AND' ? t('views.and') : t('views.or')}
          </button>
        </div>
      )}

      {/* Group bracket wrapper */}
      <div
        className={cn(
          'space-y-1',
          !isOnlyGroup && 'rounded-lg border-l-2 border-primary/30 pl-3 py-2',
        )}
        role="group"
        aria-label={!isOnlyGroup ? `${t('views.groupBracket')} ${String(groupId + 1)}` : undefined}
      >
        {conditions.map((condition, idx) => (
          <ConditionRow
            key={condition.id}
            condition={condition}
            fields={fields}
            lovData={lovData}
            datePresets={datePresets}
            onUpdate={(updates) => {
              onUpdateCondition(condition.id, updates);
            }}
            onRemove={() => {
              onRemoveCondition(condition.id);
            }}
            showLogicToggle={idx < conditions.length - 1}
            groupLogic={condition.groupLogic}
            onToggleLogic={() => {
              handleToggleInnerLogic(condition.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdvancedFilterPanel({
  fields,
  conditions,
  filterLogic,
  lovData,
  datePresets,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onSetFilterLogic,
}: AdvancedFilterPanelProps) {
  const { t } = useI18n();

  // All filterable fields (advanced mode includes advancedFilterOnly fields)
  const filterableFields = useMemo(() => fields.filter((f) => f.filterable), [fields]);

  // Group conditions by groupId
  const groupedConditions = useMemo(() => groupConditions(conditions), [conditions]);
  const groupEntries = useMemo(
    () => Array.from(groupedConditions.entries()).sort(([a], [b]) => a - b),
    [groupedConditions],
  );

  // Add a new condition to the default group (0)
  const handleAddCondition = useCallback(() => {
    onAddCondition();
  }, [onAddCondition]);

  // Add a new group with one empty condition
  const handleAddGroup = useCallback(() => {
    const nextGroupId = getNextGroupId(conditions);
    const newCondition = onAddCondition();
    onUpdateCondition(newCondition.id, {
      groupId: nextGroupId,
      outerLogic: filterLogic,
    });
  }, [conditions, onAddCondition, onUpdateCondition, filterLogic]);

  // Toggle outerLogic for all conditions in a group and sync top-level filterLogic
  const handleToggleOuterLogic = useCallback(
    (groupId: number) => {
      const groupConds = groupedConditions.get(groupId);
      if (!groupConds) return;
      const current = groupConds[0]?.outerLogic ?? 'AND';
      const newLogic: 'AND' | 'OR' = current === 'AND' ? 'OR' : 'AND';
      for (const c of groupConds) {
        onUpdateCondition(c.id, { outerLogic: newLogic });
      }
      onSetFilterLogic(newLogic);
    },
    [groupedConditions, onUpdateCondition, onSetFilterLogic],
  );

  return (
    <div className="space-y-3">
      {/* Condition rows */}
      <ScrollArea className="max-h-[300px]">
        {conditions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            {t('views.noFilters')}
          </div>
        ) : (
          <div className="space-y-1 pr-2">
            {groupEntries.map(([groupId, groupConds], groupIdx) => (
              <ConditionGroup
                key={groupId}
                groupId={groupId}
                conditions={groupConds}
                fields={filterableFields}
                lovData={lovData}
                datePresets={datePresets}
                isOnlyGroup={groupEntries.length === 1}
                outerLogic={groupConds[0]?.outerLogic ?? 'AND'}
                onUpdateCondition={onUpdateCondition}
                onRemoveCondition={onRemoveCondition}
                onToggleOuterLogic={() => {
                  handleToggleOuterLogic(groupId);
                }}
                showOuterToggle={groupIdx > 0}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleAddCondition}
        >
          <Plus className="mr-1 size-3" />
          {t('views.addCondition')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleAddGroup}
        >
          <Plus className="mr-1 size-3" />
          {t('views.addGroup')}
        </Button>
      </div>
    </div>
  );
}
