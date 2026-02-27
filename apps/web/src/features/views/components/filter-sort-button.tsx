import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { FilterStateReturn } from '../hooks/use-filter-state';
import type { ViewState } from '../hooks/use-view-state';
import { FilterSortModal } from './filter-sort-modal';

interface FilterSortButtonProps {
  viewKey: string;
  viewState: ViewState;
  filterState: FilterStateReturn;
  /** Called after filters are applied */
  onApply?: (result: ReturnType<FilterStateReturn['applyFilters']>) => void;
}

export function FilterSortButton({
  viewKey,
  viewState,
  filterState,
  onApply,
}: FilterSortButtonProps) {
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
        aria-label={t('views.filterAndSort')}
        className="relative"
      >
        <ListFilter className="size-4" />
        <span className="hidden sm:inline">{t('views.filterAndSort')}</span>
        {activeCount > 0 && (
          <Badge className="ml-1 size-5 rounded-full p-0 text-[10px] leading-none">
            {activeCount}
          </Badge>
        )}
      </Button>

      <FilterSortModal
        open={open}
        onOpenChange={setOpen}
        viewKey={viewKey}
        viewState={viewState}
        filterState={filterState}
        onApply={onApply}
      />
    </>
  );
}
