/**
 * Client-side print action resolution utility.
 *
 * Resolves the effective print action for a document type using the
 * preference cascade: user preference → company default → NONE.
 *
 * Used by `usePrintAction` hook and after-save logic in E13-2.
 */

import type { DocumentType, PrintAction, PrintPreferenceItem } from '../api/use-print-preferences';

/**
 * Look up the print action from the API's pre-resolved preferences.
 * Use when working with the response from GET /system/print-preferences
 * (which already applies the user -> company default -> NONE cascade).
 */
export function lookupResolvedPreference(
  documentType: DocumentType,
  resolvedPreferences: PrintPreferenceItem[] | undefined,
): PrintAction {
  const match = resolvedPreferences?.find((p) => p.documentType === documentType);
  return match?.action ?? 'NONE';
}
