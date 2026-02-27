import { useCallback, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { cn } from '@/lib/utils';
import { useViewStore } from '@/stores/view-store';

import type { FilterMode } from '../types';

import type { FilterStateReturn } from '../hooks/use-filter-state';
import { useBatchLov } from '../hooks/use-lov';
import type { ViewState } from '../hooks/use-view-state';
import { AdvancedFilterPanel } from './advanced-filter-panel';
import { SimpleFilterPanel } from './simple-filter-panel';
import { SortTab } from './sort-tab';

/** Operators that are only available in advanced filter mode */
const ADVANCED_ONLY_OPS = new Set<string>([
  'NOT_EQUALS',
  'STARTS_WITH',
  'ENDS_WITH',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'BETWEEN',
  'NOT_IN',
  'IS_EMPTY',
  'IS_NOT_EMPTY',
]);

/** Tab identifier constants */
const TAB_FILTERS = 'filters' as const;
const TAB_SORT = 'sort' as const;

interface FilterSortModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewKey: string;
  viewState: ViewState;
  filterState: FilterStateReturn;
  /** Called after filters are applied — receives the serialised result */
  onApply?: (result: ReturnType<FilterStateReturn['applyFilters']>) => void;
}

export function FilterSortModal({
  open,
  onOpenChange,
  viewKey,
  viewState,
  filterState,
  onApply,
}: FilterSortModalProps) {
  const { t } = useI18n();

  // Read and control the active tab from the Zustand store
  const activeTab = useViewStore((s) => s.activeFilterModalTab);
  const setActiveTab = useViewStore((s) => s.setFilterModalTab);

  // Batch-fetch VIEW_SPECIFIC and GLOBAL LOVs when the filter modal is open
  const { lovData } = useBatchLov(viewKey, viewState.fields ?? [], open);

  const handleApply = useCallback(() => {
    const result = filterState.applyFilters();
    onApply?.(result);
    onOpenChange(false);
  }, [filterState, onApply, onOpenChange]);

  const handleReset = useCallback(() => {
    filterState.resetFilters();
  }, [filterState]);

  const [showSwitchWarning, setShowSwitchWarning] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleModeChange = useCallback(
    (mode: FilterMode) => {
      if (mode === filterState.filterMode) return;

      if (mode === 'simple' && filterState.conditions.length > 0) {
        // Check if conditions use advanced-only features
        const groupIds = new Set(filterState.conditions.map((c) => c.groupId));
        const hasGroups = groupIds.size > 1;
        const hasOr = filterState.conditions.some((c) => c.groupLogic === 'OR');
        const hasAdvancedOps = filterState.conditions.some((c) =>
          ADVANCED_ONLY_OPS.has(c.operator),
        );
        const fieldIds = filterState.conditions.map((c) => c.dataViewFieldId);
        const hasDupeFields = new Set(fieldIds).size < fieldIds.length;

        if (hasGroups || hasOr || hasAdvancedOps || hasDupeFields) {
          setShowSwitchWarning(true);
          return;
        }
      }

      filterState.setFilterMode(mode);
    },
    [filterState],
  );

  const confirmSwitchToSimple = useCallback(() => {
    setShowSwitchWarning(false);

    // Strip conditions incompatible with simple mode before switching
    const seenFields = new Set<string>();
    const toRemove: string[] = [];
    const toNormalize: string[] = [];

    for (const c of filterState.conditions) {
      const isAdvancedOp = ADVANCED_ONLY_OPS.has(c.operator);
      const hasOrLogic = c.groupLogic === 'OR';
      const isDuplicateField = c.dataViewFieldId && seenFields.has(c.dataViewFieldId);

      if (isAdvancedOp || hasOrLogic || isDuplicateField) {
        toRemove.push(c.id);
      } else {
        if (c.dataViewFieldId) seenFields.add(c.dataViewFieldId);
        if (c.groupId !== 0 || c.outerLogic !== 'AND') {
          toNormalize.push(c.id);
        }
      }
    }

    for (const id of toRemove) {
      filterState.removeCondition(id);
    }
    for (const id of toNormalize) {
      filterState.updateCondition(id, { groupId: 0, groupLogic: 'AND', outerLogic: 'AND' });
    }

    filterState.setFilterMode('simple');
  }, [filterState]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[640px] rounded-lg bg-background p-0 gap-0 shadow-[0_4px_24px_rgba(124,58,237,0.08)] hover:shadow-[0_8px_32px_rgba(124,58,237,0.12)] transition-shadow">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="font-serif text-lg font-semibold">
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
              {/* Mode toggle — always visible */}
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex rounded-lg bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleModeChange('simple');
                    }}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      filterState.filterMode === 'simple'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t('views.simpleMode')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleModeChange('advanced');
                    }}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      filterState.filterMode === 'advanced'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t('views.advancedMode')}
                  </button>
                </div>
              </div>

              {filterState.filterMode === 'simple' && (
                <SimpleFilterPanel
                  fields={viewState.fields ?? []}
                  conditions={filterState.conditions}
                  onUpdateCondition={filterState.updateCondition}
                  onAddCondition={filterState.addCondition}
                  lovData={lovData}
                  datePresets={viewState.datePresets ?? []}
                />
              )}
              {filterState.filterMode === 'advanced' && (
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
              )}
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

      {/* Switch-to-simple warning dialog */}
      <AlertDialog open={showSwitchWarning} onOpenChange={setShowSwitchWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              {t('views.switchToSimple')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('views.advancedWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchToSimple}>
              {t('views.switchToSimple')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
