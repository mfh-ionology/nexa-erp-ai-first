import { useCallback } from 'react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { FilterStateReturn } from '../hooks/use-filter-state';
import { useBatchLov } from '../hooks/use-lov';
import type { ViewState } from '../hooks/use-view-state';
import { SimpleFilterPanel } from './simple-filter-panel';

interface QuickFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewKey: string;
  viewState: ViewState;
  filterState: FilterStateReturn;
  /** Called after filters are applied — receives the serialised result */
  onApply?: (result: ReturnType<FilterStateReturn['applyFilters']>) => void;
  /** Entity display name for the modal title (e.g. "Users") */
  entityName?: string;
}

export function QuickFilterModal({
  open,
  onOpenChange,
  viewKey,
  viewState,
  filterState,
  onApply,
  entityName,
}: QuickFilterModalProps) {
  const { t } = useI18n();

  // Batch-fetch LOVs when the modal is open
  const { lovData } = useBatchLov(viewKey, viewState.fields ?? [], open);

  const handleApply = useCallback(() => {
    const result = filterState.applyFilters();
    onApply?.(result);
    onOpenChange(false);
  }, [filterState, onApply, onOpenChange]);

  const handleReset = useCallback(() => {
    filterState.resetFilters();
  }, [filterState]);

  const title = entityName ? t('views.quickFilter.title', { entity: entityName }) : t('filter');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-xl bg-background p-0 gap-0 shadow-[0_4px_24px_rgba(124,58,237,0.08)]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-heading text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[200px]">
          <SimpleFilterPanel
            fields={viewState.fields ?? []}
            conditions={filterState.conditions}
            onUpdateCondition={filterState.updateCondition}
            onAddCondition={filterState.addCondition}
            lovData={lovData}
            datePresets={viewState.datePresets ?? []}
          />
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 flex flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            {t('views.reset')}
          </Button>
          <Button type="button" size="sm" onClick={handleApply}>
            {t('views.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
