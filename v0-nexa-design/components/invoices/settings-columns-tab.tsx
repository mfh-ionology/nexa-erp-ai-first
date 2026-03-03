'use client';

import { useState } from 'react';
import { GripVertical, Search, Pin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

interface ColumnItem {
  id: string;
  name: string;
  visible: boolean;
  pinned: 'left' | 'right' | null;
  width: number;
}

const initialColumns: ColumnItem[] = [
  { id: 'c1', name: 'Invoice Number', visible: true, pinned: 'left', width: 140 },
  { id: 'c2', name: 'Customer Name', visible: true, pinned: null, width: 180 },
  { id: 'c3', name: 'Transaction Date', visible: true, pinned: null, width: 120 },
  { id: 'c4', name: 'Amount', visible: true, pinned: null, width: 110 },
  { id: 'c5', name: 'Tax', visible: true, pinned: null, width: 90 },
  { id: 'c6', name: 'Status', visible: true, pinned: null, width: 100 },
  { id: 'c7', name: 'Due Date', visible: true, pinned: null, width: 120 },
  { id: 'c8', name: 'Payment Terms', visible: true, pinned: null, width: 130 },
  { id: 'c9', name: 'Created By', visible: false, pinned: null, width: 140 },
  { id: 'c10', name: 'Notes', visible: false, pinned: null, width: 200 },
  { id: 'c11', name: 'Region', visible: false, pinned: null, width: 100 },
  { id: 'c12', name: 'Currency', visible: false, pinned: null, width: 80 },
];

function getPinLabel(pinned: 'left' | 'right' | null) {
  if (pinned === 'left') return 'L';
  if (pinned === 'right') return 'R';
  return null;
}

function cyclePinned(current: 'left' | 'right' | null): 'left' | 'right' | null {
  if (current === null) return 'left';
  if (current === 'left') return 'right';
  return null;
}

export function SettingsColumnsTab() {
  const [columns, setColumns] = useState(initialColumns);
  const [search, setSearch] = useState('');

  function toggleVisibility(id: string) {
    setColumns((cols) => cols.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }

  function togglePin(id: string) {
    setColumns((cols) =>
      cols.map((c) => (c.id === id ? { ...c, pinned: cyclePinned(c.pinned) } : c)),
    );
  }

  const filtered = search
    ? columns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : columns;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-3">
        <h4 className="mb-2 text-sm font-semibold text-foreground">Manage Columns</h4>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Column List */}
      <div className="flex flex-col gap-0.5">
        {filtered.map((col) => {
          const pinLabel = getPinLabel(col.pinned);
          return (
            <div
              key={col.id}
              className={`group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[#f5f3ff] ${
                !col.visible ? 'opacity-50' : ''
              }`}
            >
              {/* Drag Handle */}
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40" />

              {/* Checkbox */}
              <Checkbox
                checked={col.visible}
                onCheckedChange={() => toggleVisibility(col.id)}
                aria-label={`Toggle ${col.name} visibility`}
              />

              {/* Column Name */}
              <span className="flex-1 font-mono text-sm text-foreground">{col.name}</span>

              {/* Pin Button */}
              <button
                onClick={() => togglePin(col.id)}
                className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-xs transition-colors ${
                  col.pinned
                    ? 'bg-[#ede9fe] text-[#7c3aed]'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
                }`}
                aria-label={`Pin ${col.name}`}
              >
                <Pin className="h-3 w-3" />
                {pinLabel && <span className="font-semibold">{pinLabel}</span>}
              </button>

              {/* Width */}
              <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                {col.width}px
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Button
          variant="ghost"
          className="flex-1 rounded-lg text-sm text-muted-foreground hover:text-foreground"
        >
          Reset to Default
        </Button>
        <Button className="flex-1 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6] text-sm">
          Apply
        </Button>
      </div>
    </div>
  );
}
