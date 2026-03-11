/**
 * Maps entity types from the backend entity registry to frontend route paths.
 *
 * Used by EntityLink and EntityLinkChip components to create navigable
 * links from a task's linked record back to the source entity page.
 */

/**
 * Mapping of entity type names (as stored in Task.entityType) to a
 * route path template. The `$id` placeholder is replaced at runtime
 * with the actual entityId.
 */
/**
 * Routes with `$id` have detail pages; routes without are list-level
 * (detail pages for those entities are not yet built).
 */
const ENTITY_ROUTE_MAP: Record<string, string> = {
  Customer: '/crm',
  CustomerInvoice: '/ar/invoices/$id',
  SalesOrder: '/sales',
  PurchaseOrder: '/purchasing',
  SupplierBill: '/ap',
  Employee: '/hr',
  JournalEntry: '/finance',
  InventoryItem: '/inventory',
  GoodsReceiptNote: '/purchasing',
  SupplierPayment: '/ap',
  CustomerPayment: '/ar',
  CreditNote: '/ar',
  Dispatch: '/sales',
  Department: '/hr',
  VatCode: '/finance',
  PaymentTerms: '/system',
  EmailMessage: '/system/email-templates/$id',
  Task: '/tasks',
  User: '/system/users/$id',
  AccessGroup: '/system/access-groups/$id',
};

/**
 * Resolves a frontend route path for a given entity type and ID.
 *
 * Returns the full path with the ID substituted, or `null` if the
 * entity type is unknown or has no detail route.
 */
export function getEntityRoute(entityType: string, entityId: string): string | null {
  const template = ENTITY_ROUTE_MAP[entityType];
  if (!template) return null;
  return template.replace('$id', entityId);
}

/**
 * Returns a human-readable label for the entity type.
 * E.g. 'CustomerInvoice' → 'Invoice', 'SalesOrder' → 'Sales Order'.
 */
const ENTITY_DISPLAY_NAMES: Record<string, string> = {
  Customer: 'Customer',
  CustomerInvoice: 'Invoice',
  SalesOrder: 'Sales Order',
  PurchaseOrder: 'Purchase Order',
  SupplierBill: 'Supplier Bill',
  Employee: 'Employee',
  JournalEntry: 'Journal Entry',
  InventoryItem: 'Item',
  GoodsReceiptNote: 'GRN',
  SupplierPayment: 'Supplier Payment',
  CustomerPayment: 'Customer Payment',
  CreditNote: 'Credit Note',
  Dispatch: 'Dispatch',
  Department: 'Department',
  VatCode: 'VAT Code',
  PaymentTerms: 'Payment Terms',
  EmailMessage: 'Email',
  Task: 'Task',
};

export function getEntityDisplayName(entityType: string): string {
  return ENTITY_DISPLAY_NAMES[entityType] ?? entityType;
}
