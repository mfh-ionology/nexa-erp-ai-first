/**
 * ConditionRow — single condition row for the advanced filter panel.
 *
 * Renders three Select dropdowns (Field, Operator, Value) plus remove button.
 * Operator options are filtered by the selected field's type.
 * Value input adapts based on field type + operator.
 *
 * Created per E7-3 Task 5.2.
 */

import { useCallback, useMemo, useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type {
  DataViewFieldDto,
  DateRangePresetDto,
  FieldDataType,
  FilterConditionState,
  FilterOperator,
  LovStaticValue,
} from '../types';
import { DateFilterControl } from './date-filter-control';
import { MultiSelectFilter } from './multi-select-filter';

// ---------------------------------------------------------------------------
// Operator-to-field-type mapping
// ---------------------------------------------------------------------------

const OPERATORS_BY_TYPE: Record<FieldDataType, FilterOperator[]> = {
  STRING: [
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'STARTS_WITH',
    'ENDS_WITH',
    'IN',
    'NOT_IN',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ],
  NUMBER: [
    'EQUALS',
    'NOT_EQUALS',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'BETWEEN',
    'IN',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ],
  CURRENCY: [
    'EQUALS',
    'NOT_EQUALS',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'BETWEEN',
    'IN',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ],
  DATE: ['EQUALS', 'NOT_EQUALS', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  BOOLEAN: ['EQUALS'],
  ENUM: ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN'],
};

const OPERATOR_I18N_MAP: Record<FilterOperator, string> = {
  EQUALS: 'views.operator.equals',
  NOT_EQUALS: 'views.operator.notEquals',
  CONTAINS: 'views.operator.contains',
  STARTS_WITH: 'views.operator.startsWith',
  ENDS_WITH: 'views.operator.endsWith',
  GT: 'views.operator.gt',
  GTE: 'views.operator.gte',
  LT: 'views.operator.lt',
  LTE: 'views.operator.lte',
  BETWEEN: 'views.operator.between',
  IN: 'views.operator.in',
  NOT_IN: 'views.operator.notIn',
  IS_EMPTY: 'views.operator.isEmpty',
  IS_NOT_EMPTY: 'views.operator.isNotEmpty',
};

// Operators that require no value input
const NO_VALUE_OPERATORS: FilterOperator[] = ['IS_EMPTY', 'IS_NOT_EMPTY'];

// Operators that need two value inputs (from/to)
const BETWEEN_OPERATORS: FilterOperator[] = ['BETWEEN'];

// Operators that use multi-select
const MULTI_VALUE_OPERATORS: FilterOperator[] = ['IN', 'NOT_IN'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConditionRowProps {
  condition: FilterConditionState;
  fields: DataViewFieldDto[];
  lovData: Record<string, LovStaticValue[]>;
  datePresets: DateRangePresetDto[];
  onUpdate: (updates: Partial<FilterConditionState>) => void;
  onRemove: () => void;
  showLogicToggle: boolean;
  groupLogic: 'AND' | 'OR';
  onToggleLogic: () => void;
}

// ---------------------------------------------------------------------------
// Value input components
// ---------------------------------------------------------------------------

function BetweenValueInput({
  condition,
  onUpdate,
}: {
  condition: FilterConditionState;
  onUpdate: (updates: Partial<FilterConditionState>) => void;
}) {
  const { t } = useI18n();
  const isDate = condition.fieldType === 'DATE';
  const isNumber = condition.fieldType === 'NUMBER' || condition.fieldType === 'CURRENCY';

  const range = useMemo((): { from: string; to: string } => {
    if (!condition.value) return { from: '', to: '' };
    try {
      const parsed = JSON.parse(condition.value) as [string | undefined, string | undefined];
      return { from: parsed[0] ?? '', to: parsed[1] ?? '' };
    } catch {
      return { from: '', to: '' };
    }
  }, [condition.value]);

  const handleChange = useCallback(
    (field: 'from' | 'to', val: string) => {
      const from = field === 'from' ? val : range.from;
      const to = field === 'to' ? val : range.to;
      onUpdate({
        value: JSON.stringify([from, to]),
        valueList: null,
        datePresetId: null,
      });
    },
    [range, onUpdate],
  );

  if (isDate) {
    return <DateBetweenInput range={range} onChange={handleChange} />;
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type={isNumber ? 'number' : 'text'}
        placeholder={t('views.from')}
        value={range.from}
        onChange={(e) => {
          handleChange('from', e.target.value);
        }}
        className="h-7 w-20 text-xs"
      />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span className="text-xs text-muted-foreground">{`\u2013`}</span>
      <Input
        type={isNumber ? 'number' : 'text'}
        placeholder={t('views.to')}
        value={range.to}
        onChange={(e) => {
          handleChange('to', e.target.value);
        }}
        className="h-7 w-20 text-xs"
      />
    </div>
  );
}

function DateBetweenInput({
  range,
  onChange,
}: {
  range: { from: string; to: string };
  onChange: (field: 'from' | 'to', val: string) => void;
}) {
  const { t } = useI18n();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const fmt = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }), []);

  const fromDate = range.from ? new Date(range.from) : undefined;
  const toDate = range.to ? new Date(range.to) : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-[110px] justify-start text-xs font-normal"
          >
            <CalendarIcon className="mr-1 size-3 opacity-50" />
            {fromDate ? fmt.format(fromDate) : t('views.from')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-lg p-0" align="start">
          <Calendar
            mode="single"
            selected={fromDate}
            onSelect={(d) => {
              onChange('from', d ? d.toISOString().slice(0, 10) : '');
              setFromOpen(false);
            }}
            className="rounded-lg border"
          />
        </PopoverContent>
      </Popover>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span className="text-xs text-muted-foreground">{`\u2013`}</span>
      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-[110px] justify-start text-xs font-normal"
          >
            <CalendarIcon className="mr-1 size-3 opacity-50" />
            {toDate ? fmt.format(toDate) : t('views.to')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-lg p-0" align="start">
          <Calendar
            mode="single"
            selected={toDate}
            onSelect={(d) => {
              onChange('to', d ? d.toISOString().slice(0, 10) : '');
              setToOpen(false);
            }}
            className="rounded-lg border"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SingleValueInput({
  condition,
  onUpdate,
  datePresets,
}: {
  condition: FilterConditionState;
  onUpdate: (updates: Partial<FilterConditionState>) => void;
  datePresets: DateRangePresetDto[];
}) {
  const { t } = useI18n();

  if (condition.fieldType === 'DATE') {
    return (
      <DateFilterControl condition={condition} datePresets={datePresets} onUpdate={onUpdate} />
    );
  }

  if (condition.fieldType === 'BOOLEAN') {
    const BOOL_TRUE = 'true';
    const BOOL_FALSE = 'false';
    return (
      <Select
        value={condition.value ?? ''}
        onValueChange={(val) => {
          onUpdate({ value: val || null, valueList: null, datePresetId: null });
        }}
      >
        <SelectTrigger size="sm" className="h-7 w-[100px] text-xs">
          <SelectValue placeholder={t('views.enterValue')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={BOOL_TRUE}>{t('yes')}</SelectItem>
          <SelectItem value={BOOL_FALSE}>{t('no')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const isNumber = condition.fieldType === 'NUMBER' || condition.fieldType === 'CURRENCY';

  return (
    <Input
      type={isNumber ? 'number' : 'text'}
      placeholder={t('views.enterValue')}
      value={condition.value ?? ''}
      onChange={(e) => {
        onUpdate({
          value: e.target.value || null,
          valueList: null,
          datePresetId: null,
        });
      }}
      className="h-7 w-[140px] text-xs"
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConditionRow({
  condition,
  fields,
  lovData,
  datePresets,
  onUpdate,
  onRemove,
  showLogicToggle,
  groupLogic,
  onToggleLogic,
}: ConditionRowProps) {
  const { t } = useI18n();

  const selectedField = useMemo(
    () => fields.find((f) => f.id === condition.dataViewFieldId) ?? null,
    [fields, condition.dataViewFieldId],
  );

  const availableOperators = useMemo(
    () => OPERATORS_BY_TYPE[condition.fieldType],
    [condition.fieldType],
  );

  const isNoValue = NO_VALUE_OPERATORS.includes(condition.operator);
  const isBetween = BETWEEN_OPERATORS.includes(condition.operator);
  const isMultiValue = MULTI_VALUE_OPERATORS.includes(condition.operator);

  const handleFieldChange = useCallback(
    (fieldId: string) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;

      const typeOps = OPERATORS_BY_TYPE[field.fieldType];
      const defaultOp = typeOps[0];

      onUpdate({
        dataViewFieldId: field.id,
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        operator: defaultOp,
        value: null,
        valueList: null,
        datePresetId: null,
      });
    },
    [fields, onUpdate],
  );

  const handleOperatorChange = useCallback(
    (op: string) => {
      const operator = op as FilterOperator;
      // Clear value when switching to no-value or between operators
      const clearValue =
        NO_VALUE_OPERATORS.includes(operator) ||
        BETWEEN_OPERATORS.includes(operator) ||
        MULTI_VALUE_OPERATORS.includes(operator);

      onUpdate({
        operator,
        ...(clearValue && { value: null, valueList: null, datePresetId: null }),
      });
    },
    [onUpdate],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {/* Field Select */}
        <Select value={condition.dataViewFieldId || undefined} onValueChange={handleFieldChange}>
          <SelectTrigger size="sm" className="h-7 w-[140px] text-xs">
            <SelectValue placeholder={t('views.selectField')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {fields
                .filter((f) => f.filterable)
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.fieldLabel}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Operator Select */}
        <Select value={condition.operator} onValueChange={handleOperatorChange}>
          <SelectTrigger size="sm" className="h-7 w-[150px] text-xs">
            <SelectValue placeholder={t('views.selectOperator')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableOperators.map((op) => (
                <SelectItem key={op} value={op}>
                  {t(OPERATOR_I18N_MAP[op])}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Value Input — adapts to field type + operator */}
        {!isNoValue && !isBetween && !isMultiValue && (
          <SingleValueInput condition={condition} onUpdate={onUpdate} datePresets={datePresets} />
        )}

        {isBetween && <BetweenValueInput condition={condition} onUpdate={onUpdate} />}

        {isMultiValue && selectedField && (
          <MultiSelectFilter
            fieldId={selectedField.id}
            lovType={selectedField.lovType === 'NONE' ? 'STATIC' : selectedField.lovType}
            lovScope={selectedField.lovScope}
            lovSearchMin={selectedField.lovSearchMin}
            lovStaticValues={selectedField.lovStaticValues}
            lovData={lovData}
            selected={condition.valueList ?? []}
            onSelectionChange={(values) => {
              onUpdate({
                valueList: values.length > 0 ? values : null,
                value: null,
                datePresetId: null,
              });
            }}
          />
        )}

        {/* Remove button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={t('views.removeCondition')}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* AND/OR logic toggle between rows */}
      {showLogicToggle && (
        <div className="flex justify-start pl-2">
          <button
            type="button"
            onClick={onToggleLogic}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              'bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            {groupLogic === 'AND' ? t('views.and') : t('views.or')}
          </button>
        </div>
      )}
    </div>
  );
}
