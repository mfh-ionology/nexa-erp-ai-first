import { useCallback, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { FilterStateReturn } from '../hooks/use-filter-state';
import { useBatchLov } from '../hooks/use-lov';
import type { ViewState } from '../hooks/use-view-state';
import { AdvancedFilterPanel } from './advanced-filter-panel';
import { SortTab } from './sort-tab';

/** Tab identifier constants */
const TAB_FILTERS = 'filters' as const;
const TAB_SORT = 'sort' as const;

interface AdvancedFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewKey: string;
  viewState: ViewState;
  filterState: FilterStateReturn;
  /** Called after filters are applied — receives the serialised result */
  onApply?: (result: ReturnType<FilterStateReturn['applyFilters']>) => void;
}

export function AdvancedFilterModal({
  open,
  onOpenChange,
  viewKey,
  viewState,
  filterState,
  onApply,
}: AdvancedFilterModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'filters' | 'sort'>(TAB_FILTERS);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] rounded-xl bg-background p-0 gap-0 shadow-[0_4px_24px_rgba(124,58,237,0.08)]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-heading text-lg font-semibold">
            {t('views.filterAndSort')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('views.filterAndSort')}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as 'filters' | 'sort');
          }}
          className="w-full"
        >
          <div className="px-6 pt-3">
            <TabsList className="w-full">
              <TabsTrigger
                value={TAB_FILTERS}
                className="flex-1 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
              >
                {t('views.filters')}
              </TabsTrigger>
              <TabsTrigger
                value={TAB_SORT}
                className="flex-1 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
              >
                {t('views.sort')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={TAB_FILTERS} className="px-6 py-4 min-h-[300px]">
            <AdvancedFilterPanel
              fields={viewState.fields ?? []}
              conditions={filterState.conditions}
              filterLogic={filterState.filterLogic}
              lovData={lovData}
              datePresets={viewState.datePresets ?? []}
              onAddCondition={filterState.addCondition}
              onRemoveCondition={filterState.removeCondition}
              onUpdateCondition={filterState.updateCondition}
              onSetFilterLogic={filterState.setFilterLogic}
            />
          </TabsContent>

          <TabsContent value={TAB_SORT} className="px-6 py-4 min-h-[300px]">
            <SortTab
              sortRules={filterState.sortRules}
              fields={viewState.fields ?? []}
              onAddRule={filterState.addSortRule}
              onRemoveRule={filterState.removeSortRule}
              onUpdateRule={filterState.updateSortRule}
              onReorderRules={filterState.reorderSortRules}
            />
          </TabsContent>
        </Tabs>

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
