/**
 * Entity type display utilities for the cross-cutting feature module.
 *
 * Centralises the mapping of Prisma model names to human-readable labels,
 * lucide icons, React Router paths, MIME type icons, and file size formatting.
 *
 * Consumed by LinkItem, AddLinkForm, AttachmentList, and other cross-cutting
 * components that need to display entity metadata.
 */

import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  FileCode,
  FileArchive,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  Landmark,
  ClipboardList,
  Boxes,
  Truck,
  Building,
  CreditCard,
  Receipt,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Entity type → human-readable i18n translation key
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABEL_KEYS: Record<string, string> = {
  Customer: 'crossCutting.recordLinks.entityCustomer',
  CustomerInvoice: 'crossCutting.recordLinks.entityCustomerInvoice',
  SalesOrder: 'crossCutting.recordLinks.entitySalesOrder',
  PurchaseOrder: 'crossCutting.recordLinks.entityPurchaseOrder',
  SupplierBill: 'crossCutting.recordLinks.entitySupplierBill',
  Employee: 'crossCutting.recordLinks.entityEmployee',
  JournalEntry: 'crossCutting.recordLinks.entityJournalEntry',
  InventoryItem: 'crossCutting.recordLinks.entityInventoryItem',
  GoodsReceiptNote: 'crossCutting.recordLinks.entityGoodsReceiptNote',
  SupplierPayment: 'crossCutting.recordLinks.entitySupplierPayment',
  CustomerPayment: 'crossCutting.recordLinks.entityCustomerPayment',
  CreditNote: 'crossCutting.recordLinks.entityCreditNote',
  Dispatch: 'crossCutting.recordLinks.entityDispatch',
  Department: 'crossCutting.recordLinks.entityDepartment',
  PaymentTerms: 'crossCutting.recordLinks.entityPaymentTerms',
  VatCode: 'crossCutting.recordLinks.entityVatCode',
};

// ---------------------------------------------------------------------------
// Entity type → lucide icon component
// ---------------------------------------------------------------------------

const ENTITY_TYPE_ICONS: Record<string, LucideIcon> = {
  CustomerInvoice: FileText,
  SalesOrder: ShoppingCart,
  PurchaseOrder: Package,
  Customer: Users,
  SupplierBill: Receipt,
  Employee: Users,
  JournalEntry: Landmark,
  InventoryItem: Boxes,
  GoodsReceiptNote: ClipboardList,
  SupplierPayment: Wallet,
  CustomerPayment: CreditCard,
  CreditNote: CreditCard,
  Dispatch: Truck,
  Department: Building,
  PaymentTerms: ClipboardList,
  VatCode: ClipboardList,
};

// ---------------------------------------------------------------------------
// Entity type → React Router base route
// ---------------------------------------------------------------------------

const ENTITY_TYPE_ROUTES: Record<string, string> = {
  CustomerInvoice: '/finance/invoices',
  SalesOrder: '/sales/orders',
  PurchaseOrder: '/purchasing/orders',
  Customer: '/crm/customers',
  SupplierBill: '/finance/bills',
  JournalEntry: '/finance/journal-entries',
  InventoryItem: '/inventory/items',
  GoodsReceiptNote: '/inventory/goods-receipts',
  SupplierPayment: '/finance/supplier-payments',
  CustomerPayment: '/finance/customer-payments',
  CreditNote: '/finance/credit-notes',
  Employee: '/hr/employees',
  Dispatch: '/inventory/dispatches',
  Department: '/system/departments',
  PaymentTerms: '/system/payment-terms',
  VatCode: '/system/vat-codes',
};

// ---------------------------------------------------------------------------
// Valid entity types (matches backend VALID_ENTITY_TYPES registry)
// ---------------------------------------------------------------------------

export const VALID_ENTITY_TYPES = [
  'Customer',
  'CustomerInvoice',
  'SalesOrder',
  'PurchaseOrder',
  'SupplierBill',
  'Employee',
  'JournalEntry',
  'InventoryItem',
  'GoodsReceiptNote',
  'SupplierPayment',
  'CustomerPayment',
  'CreditNote',
  'Dispatch',
  'Department',
  'PaymentTerms',
  'VatCode',
] as const;

export type ValidEntityType = (typeof VALID_ENTITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Maps a Prisma model name to a human-readable i18n translation key.
 *
 * Falls back to a space-separated version of the camelCase model name
 * when the entity type is not in the registry.
 *
 * @example getEntityTypeLabel('CustomerInvoice') → 'crossCutting.recordLinks.entityCustomerInvoice'
 * @example getEntityTypeLabel('Unknown') → 'Unknown'
 */
export function getEntityTypeLabelKey(entityType: string): string {
  return ENTITY_TYPE_LABEL_KEYS[entityType] ?? entityType;
}

/**
 * Maps a Prisma model name to a human-readable display label (plain string).
 *
 * Inserts spaces before uppercase letters in camelCase model names.
 *
 * @example getEntityTypeLabel('CustomerInvoice') → 'Customer Invoice'
 * @example getEntityTypeLabel('SalesOrder') → 'Sales Order'
 */
export function getEntityTypeLabel(entityType: string): string {
  return entityType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * Maps an entity type to its lucide icon component.
 *
 * Falls back to the generic `File` icon for unknown entity types.
 *
 * @example getEntityTypeIcon('CustomerInvoice') → FileText component
 * @example getEntityTypeIcon('SalesOrder') → ShoppingCart component
 */
export function getEntityTypeIcon(entityType: string): LucideIcon {
  return ENTITY_TYPE_ICONS[entityType] ?? File;
}

/**
 * Maps an entity type + entity ID to a React Router path.
 *
 * Returns `undefined` if the entity type is not in the route registry
 * (the caller should handle this gracefully — e.g. render a non-navigable reference).
 *
 * @example getEntityTypeRoute('CustomerInvoice', 'abc-123') → '/finance/invoices/abc-123'
 * @example getEntityTypeRoute('Unknown', 'id') → undefined
 */
export function getEntityTypeRoute(entityType: string, entityId: string): string | undefined {
  const base = ENTITY_TYPE_ROUTES[entityType];
  return base ? `${base}/${entityId}` : undefined;
}

/**
 * Maps a MIME type string to the appropriate lucide file icon.
 *
 * Handles common categories: images, PDFs, spreadsheets, code, archives.
 * Falls back to the generic `File` icon.
 *
 * @example getMimeTypeIcon('application/pdf') → FileText
 * @example getMimeTypeIcon('image/png') → Image
 * @example getMimeTypeIcon('text/csv') → FileSpreadsheet
 */
export function getMimeTypeIcon(mimeType: string): LucideIcon {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType === 'text/csv' || mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return FileSpreadsheet;
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return FileText;
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript'))
    return FileCode;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed'))
    return FileArchive;
  return File;
}

/**
 * Formats a byte count as a human-readable file size string.
 *
 * Uses binary units (1 KB = 1024 bytes) with one decimal place.
 *
 * @example formatFileSize(3) → '3 B'
 * @example formatFileSize(156_000) → '152.3 KB'
 * @example formatFileSize(2_500_000) → '2.4 MB'
 * @example formatFileSize(1_500_000_000) → '1.4 GB'
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
