/**
 * "Print Selected" button for list page action bars.
 *
 * Renders a button that triggers batch print for the selected rows.
 * Shows progress indicator during batch generation.
 * Uses `useBatchPrint()` hook internally for batch orchestration.
 */

import { Loader2, Printer } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';

import type { DocumentType } from '../api/use-print-preferences';
import { useBatchPrint } from '../hooks/use-batch-print';

export interface PrintSelectedButtonProps {
  documentType: DocumentType;
  selectedIds: string[];
}

export function PrintSelectedButton({ documentType, selectedIds }: PrintSelectedButtonProps) {
  const { t } = useI18n('print');
  const { executeBatchPrint, batchStatus, cancel } = useBatchPrint();

  const isActive =
    batchStatus.state === 'generating' ||
    batchStatus.state === 'downloading' ||
    batchStatus.state === 'printing';

  const handleClick = () => {
    if (isActive) {
      cancel();
    } else {
      executeBatchPrint(documentType, selectedIds);
    }
  };

  const label = isActive
    ? t('actions.batchGenerating', {
        completed: String(batchStatus.completed),
        total: String(batchStatus.total),
      })
    : selectedIds.length > 0
      ? t('actions.printSelectedCount', { count: selectedIds.length })
      : t('actions.printSelected');

  return (
    <Button
      size="sm"
      disabled={selectedIds.length === 0 && !isActive}
      onClick={handleClick}
      data-testid="print-selected-button"
      className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6] disabled:opacity-50"
    >
      {isActive ? <Loader2 className="animate-spin" /> : <Printer />}
      {label}
    </Button>
  );
}
