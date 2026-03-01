import { useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';
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

import type { ViewState } from '../hooks/use-view-state';
import type { useViewMutations } from '../hooks/use-view-mutations';

interface DeleteViewButtonProps {
  viewState: ViewState;
  mutations: ReturnType<typeof useViewMutations>;
}

export function DeleteViewButton({ viewState, mutations }: DeleteViewButtonProps) {
  const { t } = useI18n();
  const [showConfirm, setShowConfirm] = useState(false);

  const activeViewId = viewState.activeViewId;
  const activeView = viewState.savedViews?.find((v) => v.id === activeViewId) ?? null;

  // Disabled when "All" (default) is active — no view to delete
  const isDisabled = !activeViewId;

  const handleDelete = useCallback(() => {
    if (!activeViewId) return;

    mutations.removeView.mutate(activeViewId);
    viewState.setActiveView(null);
    setShowConfirm(false);
  }, [activeViewId, mutations, viewState]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={() => {
          setShowConfirm(true);
        }}
        aria-label={t('delete')}
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('views.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('views.delete.message', { name: activeView?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('views.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
