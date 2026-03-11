/**
 * React hook for batch print operations on list pages.
 *
 * Supports two modes based on user print preference:
 * - AUTO_DOWNLOAD: generates PDFs sequentially via the single-document endpoint and downloads each
 * - BROWSER_PRINT: generates PDFs one at a time and opens print dialogs sequentially
 *
 * Note: The backend batch-generate endpoint (POST /documents/batch-generate) does not yet
 * have a corresponding download endpoint to retrieve the generated ZIP. Until that endpoint
 * is added, AUTO_DOWNLOAD uses sequential single-document downloads.
 *
 * Non-blocking with progress tracking and cancellation support.
 */

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import type { DocumentType, PrintAction } from '../api/use-print-preferences';
import { usePrintPreferences } from '../api/use-print-preferences';
import { generateAndDownloadPdf, generateAndPrintPdf } from '../utils/pdf-actions';
import { lookupResolvedPreference } from '../utils/resolve-print-action';

// -- Types --------------------------------------------------------------------

export type BatchPrintState =
  | 'idle'
  | 'generating'
  | 'downloading'
  | 'printing'
  | 'complete'
  | 'error';

export interface BatchPrintStatus {
  state: BatchPrintState;
  total: number;
  completed: number;
  failed: number;
  errors: string[];
}

export interface UseBatchPrintResult {
  executeBatchPrint: (documentType: DocumentType, recordIds: string[]) => void;
  batchStatus: BatchPrintStatus;
  cancel: () => void;
}

const INITIAL_STATUS: BatchPrintStatus = {
  state: 'idle',
  total: 0,
  completed: 0,
  failed: 0,
  errors: [],
};

// -- Hook ---------------------------------------------------------------------

export function useBatchPrint(): UseBatchPrintResult {
  const { data: preferences, isLoading: preferencesLoading } = usePrintPreferences();
  const { t } = useI18n('print');

  const [batchStatus, setBatchStatus] = useState<BatchPrintStatus>(INITIAL_STATUS);
  const cancelledRef = useRef(false);

  // Sequential BROWSER_PRINT handler
  const executeSequentialPrint = useCallback(
    async (documentType: DocumentType, recordIds: string[]) => {
      const total = recordIds.length;
      let completed = 0;
      let failed = 0;
      const errors: string[] = [];

      setBatchStatus({ state: 'printing', total, completed, failed, errors });

      for (const recordId of recordIds) {
        if (cancelledRef.current) return;

        try {
          await generateAndPrintPdf(documentType, recordId);
          completed++;
        } catch (err) {
          failed++;
          errors.push(err instanceof Error ? err.message : String(err));
        }

        // Check again after await — cancel() may have been called during generation
        if (cancelledRef.current) return;

        setBatchStatus({ state: 'printing', total, completed, failed, errors: [...errors] });
      }

      // Final cancel check before showing completion toasts
      if (cancelledRef.current) return;

      if (failed > 0 && failed === total) {
        setBatchStatus({ state: 'error', total, completed, failed, errors });
        toast.error(t('actions.batchError', { failed: String(failed), total: String(total) }));
      } else {
        setBatchStatus({ state: 'complete', total, completed, failed, errors });
        toast.success(
          t('actions.batchComplete', { completed: String(completed), total: String(total) }),
        );
        if (failed > 0) {
          toast.error(t('actions.batchError', { failed: String(failed), total: String(total) }));
        }
      }
    },
    [t],
  );

  // Sequential AUTO_DOWNLOAD handler
  const executeSequentialDownload = useCallback(
    async (documentType: DocumentType, recordIds: string[]) => {
      const total = recordIds.length;
      let completed = 0;
      let failed = 0;
      const errors: string[] = [];

      setBatchStatus({ state: 'downloading', total, completed, failed, errors });

      for (const recordId of recordIds) {
        if (cancelledRef.current) return;

        try {
          await generateAndDownloadPdf(documentType, recordId);
          completed++;
        } catch (err) {
          failed++;
          errors.push(err instanceof Error ? err.message : String(err));
        }

        // Check again after await — cancel() may have been called during generation
        if (cancelledRef.current) return;

        setBatchStatus({ state: 'downloading', total, completed, failed, errors: [...errors] });
      }

      // Final cancel check before showing completion toasts
      if (cancelledRef.current) return;

      if (failed > 0 && failed === total) {
        setBatchStatus({ state: 'error', total, completed, failed, errors });
        toast.error(t('actions.batchError', { failed: String(failed), total: String(total) }));
      } else {
        setBatchStatus({ state: 'complete', total, completed, failed, errors });
        toast.success(
          t('actions.batchComplete', { completed: String(completed), total: String(total) }),
        );
        if (failed > 0) {
          toast.error(t('actions.batchError', { failed: String(failed), total: String(total) }));
        }
      }
    },
    [t],
  );

  const executeBatchPrint = useCallback(
    (documentType: DocumentType, recordIds: string[]) => {
      if (recordIds.length === 0) return;

      // Guard: preferences not yet loaded — skip rather than falsely resolving to NONE
      if (preferencesLoading || !preferences) {
        return;
      }

      cancelledRef.current = false;
      const action: PrintAction = lookupResolvedPreference(documentType, preferences);

      if (action === 'NONE') return;

      if (action === 'AUTO_DOWNLOAD') {
        void executeSequentialDownload(documentType, recordIds);
      } else if (action === 'BROWSER_PRINT') {
        // Browser can only show one print dialog at a time — process sequentially
        void executeSequentialPrint(documentType, recordIds);
      }
    },
    [preferences, preferencesLoading, executeSequentialDownload, executeSequentialPrint],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setBatchStatus(INITIAL_STATUS);
    toast.info(t('actions.batchCancel'));
  }, [t]);

  return { executeBatchPrint, batchStatus, cancel };
}
