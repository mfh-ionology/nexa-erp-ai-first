import { useState } from 'react';
import { Filter } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { FilterStateReturn } from '../hooks/use-filter-state';
import type { ViewState } from '../hooks/use-view-state';
import { QuickFilterModal } from './quick-filter-modal';

interface QuickFilterButtonProps {
  viewKey: string;
  viewState: ViewState;
  filterState: FilterStateReturn;
  /** Called after filters are applied */
  onApply?: (result: ReturnType<FilterStateReturn['applyFilters']>) => void;
  /** Entity display name for the modal title */
  entityName?: string;
}

export function QuickFilterButton({
  viewKey,
  viewState,
  filterState,
  onApply,
  entityName,
}: QuickFilterButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // Use applied filter count from viewState (not transient editing state)
  const activeCount = viewState.activeFilterCount;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={t('filter')}
        className="relative"
      >
        <Filter className="size-4" />
        <span className="hidden sm:inline">{t('filter')}</span>
        {activeCount > 0 && (
          <Badge className="ml-1 size-5 rounded-full p-0 text-[10px] leading-none">
            {activeCount}
          </Badge>
        )}
      </Button>

      <QuickFilterModal
        open={open}
        onOpenChange={setOpen}
        viewKey={viewKey}
        viewState={viewState}
        filterState={filterState}
        onApply={onApply}
        entityName={entityName}
      />
    </>
  );
}
