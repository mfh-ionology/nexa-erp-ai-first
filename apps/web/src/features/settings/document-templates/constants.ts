/**
 * Shared constants for Document Template Management (E12-2).
 */

import type { DocumentType } from './api';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SALES_INVOICE: 'Sales Invoice',
  CREDIT_NOTE: 'Credit Note',
  CASH_RECEIPT: 'Cash Receipt',
  PROFORMA_INVOICE: 'Proforma Invoice',
  CUSTOMER_STATEMENT: 'Customer Statement',
  SALES_ORDER: 'Sales Order',
  SALES_QUOTE: 'Sales Quote',
  DELIVERY_NOTE: 'Delivery Note',
  PURCHASE_ORDER: 'Purchase Order',
  GOODS_RECEIPT_NOTE: 'Goods Receipt Note',
  SUPPLIER_REMITTANCE: 'Supplier Remittance',
  PAYSLIP: 'Payslip',
  P45: 'P45',
  P60: 'P60',
};
