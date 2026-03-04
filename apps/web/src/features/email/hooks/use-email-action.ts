/**
 * useEmailAction — shared hook for "Email" action on document detail pages.
 *
 * Checks if the document is in a sendable state and manages the
 * EmailCompositionDialog open/close state.
 *
 * E10-3 Task 7.2
 */

import { useCallback, useState } from 'react';

import type { DocumentType } from '../components/email-composition-dialog';

// ─── Sendable Status Map ─────────────────────────────────────────────────────
// IMPORTANT: This MUST mirror the backend SENDABLE_STATUS_MAP.
// Source of truth: apps/api/src/modules/communications/email/document-email.service.ts
// If the backend map changes, update this map to match.

const SENDABLE_STATUS_MAP: Record<string, string[]> = {
  CustomerInvoice: ['POSTED', 'APPROVED'],
  SalesQuote: ['SENT', 'APPROVED'],
  SalesOrder: ['CONFIRMED', 'APPROVED'],
  PurchaseOrder: ['APPROVED', 'SENT'],
  CreditNote: ['POSTED', 'APPROVED'],
  CustomerStatement: ['GENERATED'],
  Payslip: ['GENERATED', 'APPROVED'],
};

// ─── Document type labels for menu items ─────────────────────────────────────

const CUSTOMER_FACING_TYPES = new Set<string>([
  'CustomerInvoice',
  'CustomerStatement',
  'SalesQuote',
  'SalesOrder',
  'CreditNote',
]);

const EMPLOYEE_FACING_TYPES = new Set<string>(['Payslip']);

interface UseEmailActionOptions {
  documentType: DocumentType;
  status: string;
}

interface UseEmailActionReturn {
  /** Whether the document can be emailed (status is in sendable list) */
  canEmail: boolean;
  /** Opens the email composition dialog */
  openEmailDialog: () => void;
  /** Closes the email composition dialog */
  closeEmailDialog: () => void;
  /** Whether the dialog is currently open */
  emailDialogOpen: boolean;
  /** Callback for Dialog onOpenChange */
  setEmailDialogOpen: (open: boolean) => void;
  /** Label for the menu item: "Email to Customer" or "Email to Supplier" */
  emailActionLabel: string;
}

export function useEmailAction({
  documentType,
  status,
}: UseEmailActionOptions): UseEmailActionReturn {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const allowedStatuses = SENDABLE_STATUS_MAP[documentType] ?? [];
  const canEmail = allowedStatuses.includes(status);

  const openEmailDialog = useCallback(() => {
    if (canEmail) {
      setEmailDialogOpen(true);
    }
  }, [canEmail]);

  const closeEmailDialog = useCallback(() => {
    setEmailDialogOpen(false);
  }, []);

  const emailActionLabel = CUSTOMER_FACING_TYPES.has(documentType)
    ? 'Email to Customer'
    : EMPLOYEE_FACING_TYPES.has(documentType)
      ? 'Email to Employee'
      : 'Email to Supplier';

  return {
    canEmail,
    openEmailDialog,
    closeEmailDialog,
    emailDialogOpen,
    setEmailDialogOpen,
    emailActionLabel,
  };
}
