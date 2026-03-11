/**
 * React hook that orchestrates print actions after a document save.
 *
 * Resolves the user's print preference for the given document type and
 * triggers either auto-download, browser print dialog, or no-op.
 *
 * Non-blocking: the caller fires `triggerPrintAction` without awaiting it
 * so the save flow is never blocked by PDF generation.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import type { DocumentType } from '../api/use-print-preferences';
import { usePrintPreferences } from '../api/use-print-preferences';
import { generateAndDownloadPdf, generateAndPrintPdf } from '../utils/pdf-actions';
import { lookupResolvedPreference } from '../utils/resolve-print-action';

export interface UsePostSavePrintResult {
  triggerPrintAction: (documentType: DocumentType, recordId: string) => Promise<void>;
  isPrinting: boolean;
}

/**
 * Returns a `triggerPrintAction` callback that resolves the user's
 * print preference and triggers the appropriate browser action.
 *
 * - AUTO_DOWNLOAD: generates PDF and triggers file download
 * - BROWSER_PRINT: generates PDF and opens native print dialog
 * - NONE: no-op
 *
 * Shows success/error toasts. Never throws — errors are caught and
 * displayed via toast so the save operation is not blocked.
 *
 * Note: Uses `usePrintPreferences()` + `lookupResolvedPreference()` directly
 * (rather than the `usePrintAction(documentType)` hook from E13-1) because
 * this hook needs to handle any document type at trigger-time, not a single
 * fixed type at hook-init-time. `usePrintAction` is intended for external
 * consumers (future business module pages) that render for a known doc type.
 */
export function usePostSavePrint(): UsePostSavePrintResult {
  const { data: preferences, isLoading: preferencesLoading } = usePrintPreferences();
  const { t } = useI18n('print');
  const [isPrinting, setIsPrinting] = useState(false);

  const triggerPrintAction = useCallback(
    async (documentType: DocumentType, recordId: string): Promise<void> => {
      // Guard: preferences not yet loaded — skip rather than falsely resolving to NONE
      if (preferencesLoading || !preferences) {
        return;
      }

      const action = lookupResolvedPreference(documentType, preferences);

      if (action === 'NONE') {
        return;
      }

      setIsPrinting(true);
      try {
        if (action === 'AUTO_DOWNLOAD') {
          await generateAndDownloadPdf(documentType, recordId);
          toast.success(t('actions.downloadSuccess'));
        } else if (action === 'BROWSER_PRINT') {
          await generateAndPrintPdf(documentType, recordId);
          toast.success(t('actions.printTriggered'));
        }
      } catch {
        toast.error(t('actions.generateError'));
      } finally {
        setIsPrinting(false);
      }
    },
    [preferences, preferencesLoading, t],
  );

  return { triggerPrintAction, isPrinting };
}
