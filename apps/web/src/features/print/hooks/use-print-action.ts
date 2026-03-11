/**
 * React hook that returns the resolved print action for a given document type.
 *
 * Consumes cached `usePrintPreferences()` data and resolves via the
 * preference cascade: user preference → company default → NONE.
 *
 * Used by E13-2 to trigger auto-download or browser print dialog after save.
 */

import { useMemo } from 'react';

import type { DocumentType, PrintAction } from '../api/use-print-preferences';
import { usePrintPreferences } from '../api/use-print-preferences';
import { lookupResolvedPreference } from '../utils/resolve-print-action';

export interface UsePrintActionResult {
  action: PrintAction;
  isLoading: boolean;
}

/**
 * Returns the resolved print action for a specific document type.
 *
 * The resolved preferences from the API already contain the full cascade
 * (user → company default → fallback), so we just look up the matching entry.
 */
export function usePrintAction(documentType: DocumentType): UsePrintActionResult {
  const { data: preferences, isLoading } = usePrintPreferences();

  const action = useMemo((): PrintAction => {
    return lookupResolvedPreference(documentType, preferences);
  }, [preferences, documentType]);

  return { action, isLoading };
}
