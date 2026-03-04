/* eslint-disable i18next/no-literal-string, @typescript-eslint/naming-convention, @typescript-eslint/no-confusing-void-expression */
/**
 * Variable Reference Panel — lists available Handlebars variables
 * for the selected document type.
 *
 * Each variable has a copy-to-clipboard button and click-to-insert action.
 */

import { useCallback } from 'react';
import { Copy, Braces } from 'lucide-react';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { DocumentType } from '../api/types';

// --- Document type variable map (matches backend) ---

export const DOCUMENT_TYPE_VARIABLES: Record<string, string[]> = {
  CustomerInvoice: [
    'invoiceNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'dueDate',
    'issueDate',
    'lineItems',
    'companyName',
    'companyEmail',
    'companyPhone',
    'companyAddress',
  ],
  CustomerStatement: [
    'customerName',
    'customerEmail',
    'statementDate',
    'openingBalance',
    'closingBalance',
    'currency',
    'transactions',
    'companyName',
    'companyEmail',
  ],
  SalesQuote: [
    'quoteNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'validUntil',
    'lineItems',
    'companyName',
    'companyEmail',
  ],
  SalesOrder: [
    'orderNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'expectedDeliveryDate',
    'lineItems',
    'companyName',
    'companyEmail',
  ],
  PurchaseOrder: [
    'poNumber',
    'supplierName',
    'supplierEmail',
    'totalAmount',
    'currency',
    'expectedDeliveryDate',
    'lineItems',
    'companyName',
    'companyEmail',
  ],
  CreditNote: [
    'creditNoteNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'reason',
    'originalInvoiceNumber',
    'companyName',
    'companyEmail',
  ],
  Payslip: [
    'employeeName',
    'employeeEmail',
    'payPeriod',
    'grossPay',
    'netPay',
    'currency',
    'deductions',
    'companyName',
  ],
};

// --- Component ---

export interface VariableReferencePanelProps {
  documentType: DocumentType | '';
  onInsert: (variable: string) => void;
}

export function VariableReferencePanel({ documentType, onInsert }: VariableReferencePanelProps) {
  const { t } = useI18n();

  const variables = documentType ? (DOCUMENT_TYPE_VARIABLES[documentType] ?? []) : [];

  const handleCopy = useCallback(
    async (variable: string) => {
      await navigator.clipboard.writeText(`{{${variable}}}`);
      toast.success(t('emailTemplates.variables.copied'));
    },
    [t],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Braces className="size-4 text-[#7c3aed]" />
          {t('emailTemplates.variables.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {variables.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('emailTemplates.variables.empty')}
          </p>
        ) : (
          <div className="space-y-1">
            {variables.map((variable) => (
              <div
                key={variable}
                className="group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[#f5f3ff] cursor-pointer"
                onClick={() => onInsert(variable)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onInsert(variable);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Insert {{${variable}}}`}
              >
                <code className="font-mono text-xs text-[#7c3aed]">{`{{${variable}}}`}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopy(variable);
                  }}
                  aria-label={`Copy {{${variable}}}`}
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
