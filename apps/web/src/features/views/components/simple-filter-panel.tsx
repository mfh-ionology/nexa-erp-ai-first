import { useCallback, useMemo } from 'react';
import { useI18n } from '@nexa/i18n';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import type {
  DataViewFieldDto,
  DateRangePresetDto,
  FilterConditionState,
  LovStaticValue,
} from '../types';
import { DateFilterControl } from './date-filter-control';
import { MultiSelectFilter } from './multi-select-filter';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimpleFilterPanelProps {
  fields: DataViewFieldDto[];
  conditions: FilterConditionState[];
  onUpdateCondition: (fieldId: string, updates: Partial<FilterConditionState>) => void;
  onAddCondition: (field: DataViewFieldDto) => FilterConditionState;
  lovData: Record<string, LovStaticValue[]>;
  datePresets: DateRangePresetDto[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the existing condition for a field, or create one on-the-fly.
 * Simple mode maps 1 field → 1 condition.
 */
function findConditionForField(
  conditions: FilterConditionState[],
  fieldId: string,
): FilterConditionState | null {
  return conditions.find((c) => c.dataViewFieldId === fieldId) ?? null;
}

// ---------------------------------------------------------------------------
// Boolean filter control — three-state: All / Yes / No
// ---------------------------------------------------------------------------

function BooleanFilterControl({
  condition,
  onUpdate,
}: {
  condition: FilterConditionState | null;
  onUpdate: (updates: Partial<FilterConditionState>) => void;
}) {
  const { t } = useI18n();

  const value = condition?.value;

  const handleClick = useCallback(
    (val: string | null) => {
      onUpdate({
        operator: 'EQUALS',
        value: val,
        valueList: null,
        datePresetId: null,
      });
    },
    [onUpdate],
  );

  return (
    <div className="flex items-center gap-1">
      {/* eslint-disable i18next/no-literal-string -- programmatic boolean identifiers, not user-facing */}
      {[
        { label: t('views.allValues'), val: null as string | null },
        { label: t('yes'), val: 'true' },
        { label: t('no'), val: 'false' },
      ].map(({ label, val }) => {
        /* eslint-enable i18next/no-literal-string */
        const isActive = value === val;
        return (
          <button
            key={val ?? 'all'}
            type="button"
            onClick={() => {
              handleClick(val);
            }}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number range filter control — min/max
// ---------------------------------------------------------------------------

function NumberRangeFilter({
  condition,
  onUpdate,
}: {
  condition: FilterConditionState | null;
  onUpdate: (updates: Partial<FilterConditionState>) => void;
}) {
  const { t } = useI18n();

  // Parse existing range from value (JSON: ["min", "max"])
  const range = useMemo((): { min: string; max: string } => {
    if (!condition?.value) return { min: '', max: '' };
    if (condition.operator === 'BETWEEN') {
      try {
        const parsed = JSON.parse(condition.value) as [string | undefined, string | undefined];
        return { min: parsed[0] ?? '', max: parsed[1] ?? '' };
      } catch {
        return { min: '', max: '' };
      }
    }
    if (condition.operator === 'GTE') return { min: condition.value, max: '' };
    if (condition.operator === 'LTE') return { min: '', max: condition.value };
    return { min: '', max: '' };
  }, [condition]);

  const handleChange = useCallback(
    (field: 'min' | 'max', val: string) => {
      const min = field === 'min' ? val : range.min;
      const max = field === 'max' ? val : range.max;

      if (min && max) {
        onUpdate({
          operator: 'BETWEEN',
          value: JSON.stringify([min, max]),
          valueList: null,
          datePresetId: null,
        });
      } else if (min) {
        onUpdate({
          operator: 'GTE',
          value: min,
          valueList: null,
          datePresetId: null,
        });
      } else if (max) {
        onUpdate({
          operator: 'LTE',
          value: max,
          valueList: null,
          datePresetId: null,
        });
      } else {
        onUpdate({
          operator: 'EQUALS',
          value: null,
          valueList: null,
          datePresetId: null,
        });
      }
    },
    [range, onUpdate],
  );

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        placeholder={t('views.from')}
        value={range.min}
        onChange={(e) => {
          handleChange('min', e.target.value);
        }}
        className="h-8 w-20 text-xs"
      />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span className="text-xs text-muted-foreground">{`\u2013`}</span>
      <Input
        type="number"
        placeholder={t('views.to')}
        value={range.max}
        onChange={(e) => {
          handleChange('max', e.target.value);
        }}
        className="h-8 w-20 text-xs"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text filter control — CONTAINS search
// ---------------------------------------------------------------------------

function TextFilterControl({
  condition,
  onUpdate,
}: {
  condition: FilterConditionState | null;
  onUpdate: (updates: Partial<FilterConditionState>) => void;
}) {
  const { t } = useI18n();

  return (
    <Input
      type="text"
      placeholder={t('views.enterValue')}
      value={condition?.value ?? ''}
      onChange={(e) => {
        onUpdate({
          operator: 'CONTAINS',
          value: e.target.value || null,
          valueList: null,
          datePresetId: null,
        });
      }}
      className="h-8 w-[180px] text-xs"
    />
  );
}

// ---------------------------------------------------------------------------
// Single filter row — renders the appropriate control for a field
// ---------------------------------------------------------------------------

function FilterRow({
  field,
  condition,
  lovData,
  datePresets,
  onUpdate,
}: {
  field: DataViewFieldDto;
  condition: FilterConditionState | null;
  lovData: Record<string, LovStaticValue[]>;
  datePresets: DateRangePresetDto[];
  onUpdate: (updates: Partial<FilterConditionState>) => void;
}) {
  const hasLov = field.lovType !== 'NONE';
  const isDate = field.fieldType === 'DATE';
  const isBoolean = field.fieldType === 'BOOLEAN';
  const isNumber = field.fieldType === 'NUMBER' || field.fieldType === 'CURRENCY';

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50">
      <span className="shrink-0 text-sm text-foreground">{field.fieldLabel}</span>
      <div className="flex shrink-0 items-center">
        {isDate && (
          <DateFilterControl condition={condition} datePresets={datePresets} onUpdate={onUpdate} />
        )}
        {isBoolean && <BooleanFilterControl condition={condition} onUpdate={onUpdate} />}
        {isNumber && !hasLov && <NumberRangeFilter condition={condition} onUpdate={onUpdate} />}
        {(field.fieldType === 'STRING' || field.fieldType === 'ENUM') && hasLov && (
          <MultiSelectFilter
            fieldId={field.id}
            lovType={field.lovType as 'STATIC' | 'GLOBAL' | 'VIEW_SPECIFIC'}
            lovScope={field.lovScope}
            lovSearchMin={field.lovSearchMin}
            lovStaticValues={field.lovStaticValues}
            lovData={lovData}
            selected={condition?.valueList ?? []}
            onSelectionChange={(values) => {
              onUpdate({
                operator: 'IN',
                valueList: values.length > 0 ? values : null,
                value: null,
                datePresetId: null,
              });
            }}
          />
        )}
        {isNumber && hasLov && (
          <MultiSelectFilter
            fieldId={field.id}
            lovType={field.lovType as 'STATIC' | 'GLOBAL' | 'VIEW_SPECIFIC'}
            lovScope={field.lovScope}
            lovSearchMin={field.lovSearchMin}
            lovStaticValues={field.lovStaticValues}
            lovData={lovData}
            selected={condition?.valueList ?? []}
            onSelectionChange={(values) => {
              onUpdate({
                operator: 'IN',
                valueList: values.length > 0 ? values : null,
                value: null,
                datePresetId: null,
              });
            }}
          />
        )}
        {(field.fieldType === 'STRING' || field.fieldType === 'ENUM') && !hasLov && !isDate && (
          <TextFilterControl condition={condition} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SimpleFilterPanel({
  fields,
  conditions,
  onUpdateCondition,
  onAddCondition,
  lovData,
  datePresets,
}: SimpleFilterPanelProps) {
  const { t } = useI18n();

  // Only show fields that are filterable and not advancedFilterOnly
  const filterableFields = useMemo(
    () => fields.filter((f) => f.filterable && !f.advancedFilterOnly),
    [fields],
  );

  const handleUpdate = useCallback(
    (field: DataViewFieldDto, updates: Partial<FilterConditionState>) => {
      const existing = findConditionForField(conditions, field.id);
      if (existing) {
        onUpdateCondition(existing.id, updates);
      } else {
        // Create a new condition for this field, then immediately update it
        const created = onAddCondition(field);
        onUpdateCondition(created.id, updates);
      }
    },
    [conditions, onUpdateCondition, onAddCondition],
  );

  if (filterableFields.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        {t('views.noFilters')}
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[360px]">
      <div className="space-y-0.5">
        {filterableFields.map((field) => {
          const condition = findConditionForField(conditions, field.id);
          return (
            <FilterRow
              key={field.id}
              field={field}
              condition={condition}
              lovData={lovData}
              datePresets={datePresets}
              onUpdate={(updates) => {
                handleUpdate(field, updates);
              }}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
