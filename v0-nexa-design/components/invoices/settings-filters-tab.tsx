'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  valueTo?: string;
}

const initialConditions: FilterCondition[] = [
  { id: 'f1', field: 'Status', operator: 'equals', value: 'Overdue' },
  { id: 'f2', field: 'Amount', operator: 'greater than', value: '10000' },
  { id: 'f3', field: 'Due Date', operator: 'between', value: '01/01/2026', valueTo: '28/02/2026' },
];

const fieldOptions = [
  'Invoice Number',
  'Customer Name',
  'Transaction Date',
  'Amount',
  'Tax',
  'Status',
  'Due Date',
  'Payment Terms',
  'Created By',
  'Region',
  'Currency',
];

const operatorsByType: Record<string, string[]> = {
  text: ['contains', 'equals', 'starts with', 'ends with'],
  number: ['equals', 'greater than', 'less than', 'between'],
  date: ['equals', 'before', 'after', 'between'],
  enum: ['equals', 'in'],
};

function getOperatorsForField(field: string) {
  if (['Amount', 'Tax'].includes(field)) return operatorsByType.number;
  if (['Transaction Date', 'Due Date'].includes(field)) return operatorsByType.date;
  if (['Status'].includes(field)) return operatorsByType.enum;
  return operatorsByType.text;
}

const presetFilters = [
  { label: 'Overdue Invoices', field: 'Status', operator: 'equals', value: 'Overdue' },
  {
    label: 'This Month',
    field: 'Due Date',
    operator: 'between',
    value: '01/02/2026',
    valueTo: '28/02/2026',
  },
  { label: 'High Value (>10k)', field: 'Amount', operator: 'greater than', value: '10000' },
  { label: 'Draft Only', field: 'Status', operator: 'equals', value: 'Draft' },
];

export function SettingsFiltersTab() {
  const [conditions, setConditions] = useState(initialConditions);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      { id: `f${Date.now()}`, field: 'Status', operator: 'equals', value: '' },
    ]);
  }

  function updateCondition(id: string, updates: Partial<FilterCondition>) {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  function applyPreset(preset: (typeof presetFilters)[number]) {
    setConditions([
      {
        id: `f${Date.now()}`,
        field: preset.field,
        operator: preset.operator,
        value: preset.value,
        valueTo: preset.valueTo,
      },
    ]);
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Build Filters</h4>
        <div className="flex items-center gap-0.5 rounded-full bg-secondary p-0.5">
          <button
            onClick={() => setLogic('AND')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              logic === 'AND'
                ? 'bg-[#7c3aed] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            AND
          </button>
          <button
            onClick={() => setLogic('OR')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              logic === 'OR'
                ? 'bg-[#7c3aed] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            OR
          </button>
        </div>
      </div>

      {/* Conditions */}
      <div className="flex flex-col gap-2">
        {conditions.map((cond) => {
          const operators = getOperatorsForField(cond.field);
          const isBetween = cond.operator === 'between';
          return (
            <div
              key={cond.id}
              className="flex flex-wrap items-center gap-1.5 rounded-lg bg-secondary/50 p-2.5"
            >
              {/* Field */}
              <select
                value={cond.field}
                onChange={(e) =>
                  updateCondition(cond.id, {
                    field: e.target.value,
                    operator: getOperatorsForField(e.target.value)[0],
                  })
                }
                className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
              >
                {fieldOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              {/* Operator */}
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>

              {/* Value */}
              {cond.field === 'Status' ? (
                <select
                  value={cond.value}
                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
                >
                  {['Overdue', 'Paid', 'Due Soon', 'Draft', 'Posted'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                  placeholder="Value"
                  className="h-8 w-24 rounded-md border border-border bg-card px-2 font-mono text-xs text-foreground outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
                />
              )}

              {isBetween && (
                <input
                  type="text"
                  value={cond.valueTo || ''}
                  onChange={(e) => updateCondition(cond.id, { valueTo: e.target.value })}
                  placeholder="To"
                  className="h-8 w-24 rounded-md border border-border bg-card px-2 font-mono text-xs text-foreground outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
                />
              )}

              {/* Remove */}
              <button
                onClick={() => removeCondition(cond.id)}
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fee2e2] hover:text-[#ef4444]"
                aria-label="Remove condition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Condition */}
      <button
        onClick={addCondition}
        className="mt-2 flex items-center gap-1.5 self-start text-sm font-medium text-[#7c3aed] hover:text-[#5b21b6] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Condition
      </button>

      {/* Active Filter Badge */}
      {conditions.length > 0 && (
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-[#ede9fe] px-2.5 py-0.5 text-xs font-semibold text-[#7c3aed]">
            {conditions.length} active filter{conditions.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Quick Presets */}
      <div className="mt-4 border-t border-border pt-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested Filters
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {presetFilters.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-[#c4b5fd] px-3 py-1 text-xs font-medium text-[#7c3aed] transition-colors hover:bg-[#f5f3ff] hover:border-[#7c3aed]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Button
          variant="ghost"
          className="flex-1 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setConditions([])}
        >
          Clear All
        </Button>
        <Button className="flex-1 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6] text-sm">
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
