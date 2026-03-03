'use client';

import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

export type MemoryCategory = 'PREFERENCE' | 'INSTRUCTION' | 'WORKFLOW' | 'CORRECTION' | 'DECISION';

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  source: 'Explicit' | 'Learned';
  date: string;
  lastUsed: string;
  conversationCount: number;
}

const categoryStyles: Record<MemoryCategory, { bg: string; text: string; icon: string }> = {
  PREFERENCE: { bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]', icon: '\uD83D\uDCCC' },
  INSTRUCTION: { bg: 'bg-[#e0e7ff]', text: 'text-[#3730a3]', icon: '\uD83D\uDCCC' },
  WORKFLOW: { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]', icon: '\uD83D\uDD04' },
  CORRECTION: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', icon: '\uD83D\uDD27' },
  DECISION: { bg: 'bg-[#ede9fe]', text: 'text-[#6d28d9]', icon: '\uD83D\uDCCB' },
};

interface MemoryCardProps {
  memory: Memory;
  onEdit: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
  delay?: number;
}

export function MemoryCard({ memory, onEdit, onDelete, delay = 0 }: MemoryCardProps) {
  const style = categoryStyles[memory.category];

  return (
    <div
      className="animate-fade-in-up group rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Content */}
      <p className="text-sm leading-relaxed text-foreground">
        {'"'}
        {memory.content}
        {'"'}
      </p>

      {/* Metadata row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}
        >
          {style.icon} {memory.category}
        </span>
        <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#374151]">
          {memory.source}
        </span>
        <span className="text-xs text-muted-foreground">{memory.date}</span>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Last used: {memory.lastUsed}</span>
          <span className="text-xs text-muted-foreground">
            Used in {memory.conversationCount} conversation
            {memory.conversationCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(memory)}
            className="h-8 w-8 rounded-lg p-0 hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
            aria-label="Edit memory"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(memory)}
            className="h-8 w-8 rounded-lg p-0 hover:bg-[#fee2e2] hover:text-[#991b1b]"
            aria-label="Delete memory"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
