import { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';

import type { ViewState } from '../hooks/use-view-state';
import type { useViewMutations } from '../hooks/use-view-mutations';
import type { useColumnMutations } from '../hooks/use-column-mutations';
import { ViewsAndColumnsModal } from './views-columns-modal';

interface ViewsColumnsButtonProps {
  viewKey: string;
  viewState: ViewState;
  mutations: ReturnType<typeof useViewMutations>;
  columnMutations: ReturnType<typeof useColumnMutations>;
}

export function ViewsColumnsButton({
  viewKey,
  viewState,
  mutations,
  columnMutations,
}: ViewsColumnsButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={t('views.modal.title')}
      >
        <Columns3 className="size-4" />
        <span className="hidden sm:inline">{t('views.button.label')}</span>
      </Button>

      <ViewsAndColumnsModal
        open={open}
        onOpenChange={setOpen}
        viewKey={viewKey}
        viewState={viewState}
        mutations={mutations}
        columnMutations={columnMutations}
      />
    </>
  );
}
