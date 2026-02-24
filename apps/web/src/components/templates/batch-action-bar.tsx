import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import type { BatchAction } from './types';

export interface BatchActionBarProps {
  /** Number of selected rows */
  selectedCount: number;
  /** Batch action buttons */
  actions: BatchAction[];
  /** Callback to clear selection */
  onClear: () => void;
  /** Selected row IDs for passing to action handlers */
  selectedIds: string[];
}

export function BatchActionBar({
  selectedCount,
  actions,
  onClear,
  selectedIds,
}: BatchActionBarProps) {
  const { t } = useI18n();
  const barRef = useRef<HTMLDivElement>(null);

  // Escape key clears selection — only if no closer interactive element handled it
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        onClear();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClear]);

  if (selectedCount === 0) return null;

  return (
    <div
      ref={barRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'flex items-center justify-between gap-3 px-4 py-3',
        'border-t bg-background/95 backdrop-blur-sm shadow-lg',
        'animate-in slide-in-from-bottom duration-200 motion-reduce:animate-none',
      )}
      role="toolbar"
      aria-label={t('actions')}
    >
      <span className="text-sm font-medium text-foreground">
        {t('selected', { count: selectedCount })}
      </span>

      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => action.onAction(selectedIds)}
          >
            {t(action.labelKey)}
          </Button>
        ))}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label={t('close')}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
