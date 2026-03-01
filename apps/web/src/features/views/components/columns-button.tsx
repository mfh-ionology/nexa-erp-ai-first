import { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger } from '@/components/ui/popover';

import type { ViewState } from '../hooks/use-view-state';
import type { useColumnMutations } from '../hooks/use-column-mutations';
import { ColumnsPopover } from './columns-popover';

interface ColumnsButtonProps {
  viewState: ViewState;
  columnMutations: ReturnType<typeof useColumnMutations>;
}

export function ColumnsButton({ viewState, columnMutations }: ColumnsButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('views.columns.title')}>
          <Columns3 className="size-4" />
          <span className="hidden sm:inline">{t('views.columns')}</span>
        </Button>
      </PopoverTrigger>
      <ColumnsPopover
        viewState={viewState}
        columnMutations={columnMutations}
        onClose={() => {
          setOpen(false);
        }}
      />
    </Popover>
  );
}
