/**
 * Print feature barrel exports.
 *
 * Provides hooks, components, and types for document print actions
 * (post-save auto-download/browser-print and batch printing).
 */

// Hooks
export { usePostSavePrint } from './hooks/use-post-save-print';
export type { UsePostSavePrintResult } from './hooks/use-post-save-print';

export { useBatchPrint } from './hooks/use-batch-print';
export type {
  BatchPrintStatus,
  BatchPrintState,
  UseBatchPrintResult,
} from './hooks/use-batch-print';

export { usePrintAction } from './hooks/use-print-action';
export type { UsePrintActionResult } from './hooks/use-print-action';

// Components
export { PrintSelectedButton } from './components/print-selected-button';
export type { PrintSelectedButtonProps } from './components/print-selected-button';

export { PrintActionIndicator } from './components/print-action-indicator';
export type { PrintActionIndicatorProps } from './components/print-action-indicator';

// Types (re-exported from API layer for convenience)
export type { PrintAction, DocumentType } from './api/use-print-preferences';
