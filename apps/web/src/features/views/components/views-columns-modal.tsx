import { useCallback } from 'react';
import { useI18n } from '@nexa/i18n';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { ViewState } from '../hooks/use-view-state';
import type { useViewMutations } from '../hooks/use-view-mutations';
import type { useColumnMutations } from '../hooks/use-column-mutations';
import { ViewsTab } from './views-tab';
import { ColumnsTab } from './columns-tab';

interface ViewsAndColumnsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewKey: string;
  viewState: ViewState;
  mutations: ReturnType<typeof useViewMutations>;
  columnMutations: ReturnType<typeof useColumnMutations>;
}

export function ViewsAndColumnsModal({
  open,
  onOpenChange,
  viewKey,
  viewState,
  mutations,
  columnMutations,
}: ViewsAndColumnsModalProps) {
  const { t } = useI18n();

  // Persist column changes on modal close (AC6 / Task 6.8)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && viewState.isDirty) {
        const prefs = viewState.columnState.map((col) => ({
          dataViewFieldId: col.fieldId,
          visible: col.visible,
          displayOrder: col.order,
          width: col.width,
          pinned: col.pinned,
        }));
        columnMutations.bulkUpdate.mutate(prefs, {
          onSuccess: () => {
            viewState.markClean();
          },
        });
      }
      onOpenChange(nextOpen);
    },
    [viewState, columnMutations, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-xl bg-background p-0 gap-0 shadow-[0_4px_24px_rgba(124,58,237,0.08)] hover:shadow-[0_8px_32px_rgba(124,58,237,0.12)] transition-shadow">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-heading text-lg font-semibold">
            {t('views.modal.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('views.modal.description')}</DialogDescription>
        </DialogHeader>

        {/* eslint-disable i18next/no-literal-string */}
        <Tabs defaultValue="views" className="w-full">
          <div className="px-6 pt-3">
            <TabsList className="w-full">
              <TabsTrigger
                value="views"
                className="flex-1 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
              >
                {t('views.tabs.views')}
              </TabsTrigger>
              <TabsTrigger
                value="columns"
                className="flex-1 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
              >
                {t('views.tabs.columns')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="views" className="px-6 py-4 min-h-[300px]">
            <ViewsTab
              viewKey={viewKey}
              viewState={viewState}
              mutations={mutations}
              onClose={() => {
                handleOpenChange(false);
              }}
            />
          </TabsContent>

          <TabsContent value="columns" className="px-6 py-4 min-h-[300px]">
            <ColumnsTab
              viewState={viewState}
              columnMutations={columnMutations}
              onClose={() => {
                handleOpenChange(false);
              }}
            />
          </TabsContent>
        </Tabs>
        {/* eslint-enable i18next/no-literal-string */}
      </DialogContent>
    </Dialog>
  );
}
