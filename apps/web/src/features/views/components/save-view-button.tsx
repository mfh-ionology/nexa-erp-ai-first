import { useCallback, useState } from 'react';
import { Save } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import type { ViewState } from '../hooks/use-view-state';
import type { useViewMutations } from '../hooks/use-view-mutations';
import { SaveViewForm } from './save-view-form';

interface SaveViewButtonProps {
  viewKey: string;
  viewState: ViewState;
  mutations: ReturnType<typeof useViewMutations>;
}

export function SaveViewButton({ viewKey, viewState, mutations }: SaveViewButtonProps) {
  const { t } = useI18n();
  const [showSaveAsNew, setShowSaveAsNew] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  const activeViewId = viewState.activeViewId;
  const activeView = viewState.savedViews?.find((v) => v.id === activeViewId) ?? null;
  const isDirty = viewState.isDirty;

  // Destructure only the properties needed by handleReplace to avoid
  // re-creating the callback when unrelated viewState fields change.
  const { filterLogic, activeSortRules, columnState, activeFilters } = viewState;

  const handleClick = useCallback(() => {
    if (activeView && isDirty) {
      // Dirty named view → show replace confirm dialog
      setShowReplaceConfirm(true);
    } else {
      // No named view or clean → show save as new form
      setShowSaveAsNew(true);
    }
  }, [activeView, isDirty]);

  const handleReplace = useCallback(() => {
    if (!activeView) return;

    // Replace the existing view with current state
    mutations.replaceView.mutate({
      id: activeView.id,
      data: {
        name: activeView.name,
        groupName: activeView.groupName,
        filterLogic,
        sortConfig: activeSortRules.map((r) => ({
          field: r.field,
          direction: r.direction,
          priority: r.priority,
        })),
        columnConfig: columnState.map((col) => ({
          fieldId: col.fieldId,
          visible: col.visible,
          order: col.order,
          width: col.width,
          pinned: col.pinned,
        })),
        conditions: activeFilters.map((c, idx) => ({
          dataViewFieldId: c.dataViewFieldId,
          operator: c.operator,
          value: c.value ?? undefined,
          valueList: c.valueList ?? undefined,
          datePresetId: c.datePresetId ?? undefined,
          groupId: c.groupId,
          groupLogic: c.groupLogic,
          outerLogic: c.outerLogic,
          conditionOrder: idx,
        })),
      },
    });

    setShowReplaceConfirm(false);
  }, [activeView, mutations, filterLogic, activeSortRules, columnState, activeFilters]);

  const handleSaveAsNewFromConfirm = useCallback(() => {
    setShowReplaceConfirm(false);
    setShowSaveAsNew(true);
  }, []);

  return (
    <>
      {/* Save button with popover for "Save as New" form */}
      <Popover open={showSaveAsNew} onOpenChange={setShowSaveAsNew}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" onClick={handleClick} aria-label={t('save')}>
            <Save className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[320px] p-4 rounded-xl shadow-[0_4px_24px_rgba(124,58,237,0.08)]"
        >
          <SaveViewForm
            viewKey={viewKey}
            viewState={viewState}
            mutations={mutations}
            onSuccess={() => {
              setShowSaveAsNew(false);
            }}
            onCancel={() => {
              setShowSaveAsNew(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Replace confirm dialog — dirty named view */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('views.save.replaceTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('views.save.replaceMessage', { name: activeView?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <Button variant="outline" size="sm" onClick={handleSaveAsNewFromConfirm}>
              {t('views.save.saveAsNew')}
            </Button>
            <AlertDialogAction onClick={handleReplace}>
              {t('views.save.replace', { name: activeView?.name ?? '' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
