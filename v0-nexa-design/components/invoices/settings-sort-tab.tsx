'use client';

import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, X, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SortRule {
  id: string;
  field: string;
  direction: 'asc' | 'desc';
}

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
];

const initialSorts: SortRule[] = [
  { id: 's1', field: 'Due Date', direction: 'asc' },
  { id: 's2', field: 'Amount', direction: 'desc' },
];

export function SettingsSortTab() {
  const [sorts, setSorts] = useState(initialSorts);

  function addSort() {
    const usedFields = new Set(sorts.map((s) => s.field));
    const nextField = fieldOptions.find((f) => !usedFields.has(f)) || fieldOptions[0];
    setSorts((prev) => [...prev, { id: `s${Date.now()}`, field: nextField, direction: 'asc' }]);
  }

  function removeSort(id: string) {
    setSorts((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSort(id: string, updates: Partial<SortRule>) {
    setSorts((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">Sort Rules</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drag to reorder priority. First rule is the primary sort.
        </p>
      </div>

      {/* Sort Rules */}
      <div className="flex flex-col gap-2">
        {sorts.map((rule, idx) => (
          <div key={rule.id} className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2.5">
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40" />

            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#ede9fe] text-[10px] font-bold text-[#7c3aed]">
              {idx + 1}
            </span>

            <select
              value={rule.field}
              onChange={(e) => updateSort(rule.id, { field: e.target.value })}
              className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
            >
              {fieldOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                updateSort(rule.id, { direction: rule.direction === 'asc' ? 'desc' : 'asc' })
              }
              className={`flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors ${
                rule.direction === 'asc'
                  ? 'border-[#c4b5fd] bg-[#f5f3ff] text-[#7c3aed]'
                  : 'border-[#c4b5fd] bg-[#f5f3ff] text-[#7c3aed]'
              }`}
            >
              {rule.direction === 'asc' ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {rule.direction === 'asc' ? 'A-Z' : 'Z-A'}
            </button>

            <button
              onClick={() => removeSort(rule.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fee2e2] hover:text-[#ef4444]"
              aria-label="Remove sort rule"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Sort */}
      {sorts.length < fieldOptions.length && (
        <button
          onClick={addSort}
          className="mt-2 flex items-center gap-1.5 self-start text-sm font-medium text-[#7c3aed] hover:text-[#5b21b6] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Sort Rule
        </button>
      )}

      {/* Empty state */}
      {sorts.length === 0 && (
        <div className="mt-4 flex flex-col items-center py-8 text-center">
          <ArrowUpDown className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No sort rules applied</p>
          <p className="text-xs text-muted-foreground/70">
            Click "Add Sort Rule" to order your data
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Button
          variant="ghost"
          className="flex-1 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setSorts([])}
        >
          Clear All
        </Button>
        <Button className="flex-1 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6] text-sm">
          Apply Sort
        </Button>
      </div>
    </div>
  );
}
