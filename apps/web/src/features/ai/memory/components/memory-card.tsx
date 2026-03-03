import { useState } from 'react';
import { useI18n } from '@nexa/i18n';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { CATEGORY_I18N_KEYS, CATEGORY_STYLES } from '../constants';
import type { Memory } from '../types';

interface MemoryCardProps {
  memory: Memory;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

export function MemoryCard({ memory, onEdit, onDelete, index }: MemoryCardProps) {
  const { t } = useI18n('ai');
  const [expanded, setExpanded] = useState(false);

  const style = CATEGORY_STYLES[memory.category];
  const isExplicit = memory.source === 'EXPLICIT';

  const createdDate = formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true });
  const lastUsedDate = memory.lastAccessedAt
    ? formatDistanceToNow(new Date(memory.lastAccessedAt), { addSuffix: true })
    : null;

  return (
    <article
      className="animate-fade-in-up group rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Content — truncated to 3 lines unless expanded */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left"
        aria-label={expanded ? t('memory.collapseContent') : t('memory.expandContent')}
      >
        <p className={`text-sm leading-relaxed text-foreground ${!expanded ? 'line-clamp-3' : ''}`}>
          &ldquo;{memory.content}&rdquo;
        </p>
      </button>

      {/* Metadata badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}
        >
          {t(CATEGORY_I18N_KEYS[memory.category])}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isExplicit ? 'bg-[#ede9fe] text-[#7c3aed]' : 'bg-[#f3f4f6] text-[#374151]'
          }`}
        >
          {isExplicit ? t('memory.source.explicit') : t('memory.source.implicit')}
        </span>
      </div>

      {/* Footer — dates + hover actions */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t('memory.created', { date: createdDate })}
          </span>
          {lastUsedDate && (
            <span className="text-xs text-muted-foreground">
              {t('memory.lastUsed', { date: lastUsedDate })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(memory.id)}
            className="h-8 w-8 rounded-lg p-0 hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
            aria-label={t('memory.edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(memory.id)}
            className="h-8 w-8 rounded-lg p-0 hover:bg-[#fee2e2] hover:text-[#991b1b]"
            aria-label={t('memory.deleteTitle')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}
