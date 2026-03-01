import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { FilterStateReturn } from '../hooks/use-filter-state';
import type { ViewState } from '../hooks/use-view-state';
import { AdvancedFilterModal } from './advanced-filter-modal';

interface AdvancedFilterButtonProps {
  viewKey: string;
  viewState: ViewState;
  filterState: FilterStateReturn;
  /** Called after filters are applied */
  onApply?: (result: ReturnType<FilterStateReturn['applyFilters']>) => void;
}

export function AdvancedFilterButton({
  viewKey,
  viewState,
  filterState,
  onApply,
}: AdvancedFilterButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // Same badge count as quick filter — shared filter state
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
        <SlidersHorizontal className="size-4" />
        <span className="hidden sm:inline">{t('views.advancedMode')}</span>
        {activeCount > 0 && (
          <Badge className="ml-1 size-5 rounded-full p-0 text-[10px] leading-none">
            {activeCount}
          </Badge>
        )}
      </Button>

      <AdvancedFilterModal
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
