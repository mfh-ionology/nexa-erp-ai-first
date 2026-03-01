import { PopoverContent } from '@/components/ui/popover';

import type { ViewState } from '../hooks/use-view-state';
import type { useColumnMutations } from '../hooks/use-column-mutations';
import { ColumnsTab } from './columns-tab';

interface ColumnsPopoverProps {
  viewState: ViewState;
  columnMutations: ReturnType<typeof useColumnMutations>;
  onClose: () => void;
}

export function ColumnsPopover({ viewState, columnMutations, onClose }: ColumnsPopoverProps) {
  return (
    <PopoverContent
      className="w-[320px] p-4 rounded-xl shadow-[0_4px_24px_rgba(124,58,237,0.08)]"
      align="start"
      sideOffset={8}
    >
      <ColumnsTab viewState={viewState} columnMutations={columnMutations} onClose={onClose} />
    </PopoverContent>
  );
}
