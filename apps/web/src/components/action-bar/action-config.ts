import {
  Ban,
  Check,
  ClipboardList,
  Copy,
  FileDown,
  History,
  Lock,
  Mail,
  Package,
  Printer,
  Search,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
  Clock,
  ShoppingCart,
  Truck,
  Receipt,
} from 'lucide-react';

import type {
  EntityActionConfig,
  OverflowAction,
  StatusActionSet,
} from './types';

// ---------------------------------------------------------------------------
// Noop placeholder — consuming pages replace with real callbacks
// ---------------------------------------------------------------------------
const noop = () => {};

// ---------------------------------------------------------------------------
// Global actions — present on ALL entity detail screens.
// Module-level constant so the reference is stable across renders.
// ---------------------------------------------------------------------------
const GLOBAL_ACTIONS: OverflowAction[] = [
  {
    key: 'aiExplain',
    labelKey: 'actionBar.aiExplain',
    icon: Sparkles,
    section: 'ai',
    onAction: noop,
  },
  {
    key: 'aiSuggest',
    labelKey: 'actionBar.aiSuggest',
    icon: Sparkles,
    section: 'ai',
    onAction: noop,
  },
  {
    key: 'aiFindSimilar',
    labelKey: 'actionBar.aiFindSimilar',
    icon: Search,
    section: 'ai',
    onAction: noop,
  },
  {
    key: 'viewAuditLog',
    labelKey: 'actionBar.viewAuditLog',
    icon: History,
    section: 'history',
    onAction: noop,
  },
  {
    key: 'statusTimeline',
    labelKey: 'actionBar.statusTimeline',
    icon: Clock,
    section: 'history',
    onAction: noop,
  },
];

// ---------------------------------------------------------------------------
// CustomerInvoice — DRAFT → APPROVED → POSTED → (VOID terminal)
// ---------------------------------------------------------------------------
const customerInvoiceConfig: EntityActionConfig = {
  entityType: 'customerInvoice',
  statusActions: {
    DRAFT: {
      primary: [
        {
          key: 'approve',
          labelKey: 'actionBar.approve',
          icon: Check,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'saveDraft',
          labelKey: 'actionBar.saveDraft',
          variant: 'outline',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'print',
          labelKey: 'actionBar.print',
          icon: Printer,
          section: 'document',
          shortcutHint: 'Mod+P',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
        {
          key: 'email',
          labelKey: 'actionBar.email',
          icon: Mail,
          section: 'document',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
        {
          key: 'exportPdf',
          labelKey: 'actionBar.exportPdf',
          icon: FileDown,
          section: 'document',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
        {
          key: 'duplicate',
          labelKey: 'actionBar.duplicate',
          icon: Copy,
          section: 'document',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canNew',
        },
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'delete',
          labelKey: 'actionBar.delete',
          icon: Trash2,
          variant: 'destructive',
          section: 'record',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.deleteTitle',
          confirmDescriptionKey: 'actionBar.confirm.deleteDescription',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canDelete',
        },
      ],
    },
    APPROVED: {
      primary: [
        {
          key: 'emailToCustomer',
          labelKey: 'actionBar.emailToCustomer',
          icon: Mail,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'post',
          labelKey: 'actionBar.post',
          icon: Check,
          section: 'status',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'print',
          labelKey: 'actionBar.print',
          icon: Printer,
          section: 'document',
          shortcutHint: 'Mod+P',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
        {
          key: 'exportPdf',
          labelKey: 'actionBar.exportPdf',
          icon: FileDown,
          section: 'document',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
      ],
    },
    POSTED: {
      primary: [],
      overflow: [
        {
          key: 'void',
          labelKey: 'actionBar.void',
          icon: Ban,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.voidTitle',
          confirmDescriptionKey: 'actionBar.confirm.voidDescription',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'print',
          labelKey: 'actionBar.print',
          icon: Printer,
          section: 'document',
          shortcutHint: 'Mod+P',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
        {
          key: 'email',
          labelKey: 'actionBar.email',
          icon: Mail,
          section: 'document',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
        {
          key: 'exportPdf',
          labelKey: 'actionBar.exportPdf',
          icon: FileDown,
          section: 'document',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canView',
        },
        {
          key: 'createCreditNote',
          labelKey: 'actionBar.createCreditNote',
          icon: Receipt,
          section: 'record',
          onAction: noop,
          permissionResource: 'finance.invoices.detail',
          permissionAction: 'canNew',
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// SalesOrder — DRAFT → APPROVED → IN_PROGRESS → ...
// ---------------------------------------------------------------------------
const salesOrderConfig: EntityActionConfig = {
  entityType: 'salesOrder',
  statusActions: {
    DRAFT: {
      primary: [
        {
          key: 'approve',
          labelKey: 'actionBar.approve',
          icon: Check,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'saveDraft',
          labelKey: 'actionBar.saveDraft',
          variant: 'outline',
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'delete',
          labelKey: 'actionBar.delete',
          icon: Trash2,
          variant: 'destructive',
          section: 'record',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.deleteTitle',
          confirmDescriptionKey: 'actionBar.confirm.deleteDescription',
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canDelete',
        },
      ],
    },
    APPROVED: {
      primary: [
        {
          key: 'createDispatch',
          labelKey: 'actionBar.createDispatch',
          icon: Truck,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'convertToInvoice',
          labelKey: 'actionBar.convertToInvoice',
          icon: Receipt,
          section: 'record',
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canNew',
        },
      ],
    },
    IN_PROGRESS: {
      primary: [
        {
          key: 'createDispatch',
          labelKey: 'actionBar.createDispatch',
          icon: Truck,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'convertToInvoice',
          labelKey: 'actionBar.convertToInvoice',
          icon: Receipt,
          section: 'record',
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canNew',
        },
      ],
    },
    PARTIALLY_SHIPPED: {
      primary: [
        {
          key: 'createDispatch',
          labelKey: 'actionBar.createDispatch',
          icon: Truck,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'convertToInvoice',
          labelKey: 'actionBar.convertToInvoice',
          icon: Receipt,
          section: 'record',
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canNew',
        },
      ],
    },
    FULLY_SHIPPED: {
      primary: [
        {
          key: 'convertToInvoice',
          labelKey: 'actionBar.convertToInvoice',
          icon: Receipt,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canNew',
        },
      ],
      overflow: [],
    },
    PARTIALLY_INVOICED: {
      primary: [
        {
          key: 'convertToInvoice',
          labelKey: 'actionBar.convertToInvoice',
          icon: Receipt,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canNew',
        },
      ],
      overflow: [],
    },
    FULLY_INVOICED: {
      primary: [
        {
          key: 'close',
          labelKey: 'actionBar.close',
          icon: Lock,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [],
    },
  },
};

// ---------------------------------------------------------------------------
// SalesQuote — DRAFT → SENT → ACCEPTED → CONVERTED
// ---------------------------------------------------------------------------
const salesQuoteConfig: EntityActionConfig = {
  entityType: 'salesQuote',
  statusActions: {
    DRAFT: {
      primary: [
        {
          key: 'send',
          labelKey: 'actionBar.send',
          icon: Send,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'saveDraft',
          labelKey: 'actionBar.saveDraft',
          variant: 'outline',
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'delete',
          labelKey: 'actionBar.delete',
          icon: Trash2,
          variant: 'destructive',
          section: 'record',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.deleteTitle',
          confirmDescriptionKey: 'actionBar.confirm.deleteDescription',
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canDelete',
        },
      ],
    },
    SENT: {
      primary: [
        {
          key: 'accept',
          labelKey: 'actionBar.accept',
          icon: Check,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'reject',
          labelKey: 'actionBar.reject',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.rejectTitle',
          confirmDescriptionKey: 'actionBar.confirm.rejectDescription',
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canEdit',
        },
      ],
    },
    ACCEPTED: {
      primary: [
        {
          key: 'convertToOrder',
          labelKey: 'actionBar.convertToOrder',
          icon: ShoppingCart,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'sales.quotes.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [],
    },
  },
};

// ---------------------------------------------------------------------------
// PurchaseOrder — DRAFT → APPROVED → SENT → ...
// ---------------------------------------------------------------------------
const purchaseOrderConfig: EntityActionConfig = {
  entityType: 'purchaseOrder',
  statusActions: {
    DRAFT: {
      primary: [
        {
          key: 'approve',
          labelKey: 'actionBar.approve',
          icon: Check,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'saveDraft',
          labelKey: 'actionBar.saveDraft',
          variant: 'outline',
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'delete',
          labelKey: 'actionBar.delete',
          icon: Trash2,
          variant: 'destructive',
          section: 'record',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.deleteTitle',
          confirmDescriptionKey: 'actionBar.confirm.deleteDescription',
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canDelete',
        },
      ],
    },
    APPROVED: {
      primary: [
        {
          key: 'sendToSupplier',
          labelKey: 'actionBar.sendToSupplier',
          icon: Send,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
    },
    SENT: {
      primary: [
        {
          key: 'receiveGoods',
          labelKey: 'actionBar.receiveGoods',
          icon: Package,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'cancel',
          labelKey: 'actionBar.cancel',
          icon: X,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.cancelTitle',
          confirmDescriptionKey: 'actionBar.confirm.cancelDescription',
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
    },
    PARTIALLY_RECEIVED: {
      primary: [
        {
          key: 'receiveGoods',
          labelKey: 'actionBar.receiveGoods',
          icon: Package,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'createBill',
          labelKey: 'actionBar.createBill',
          icon: ClipboardList,
          section: 'record',
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canNew',
        },
      ],
    },
    FULLY_RECEIVED: {
      primary: [
        {
          key: 'createBill',
          labelKey: 'actionBar.createBill',
          icon: ClipboardList,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canNew',
        },
      ],
      overflow: [],
    },
    PARTIALLY_INVOICED: {
      primary: [
        {
          key: 'createBill',
          labelKey: 'actionBar.createBill',
          icon: ClipboardList,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canNew',
        },
      ],
      overflow: [],
    },
    FULLY_INVOICED: {
      primary: [
        {
          key: 'close',
          labelKey: 'actionBar.close',
          icon: Lock,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'purchasing.orders.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [],
    },
  },
};

// ---------------------------------------------------------------------------
// JournalEntry — DRAFT → POSTED → REVERSED
// ---------------------------------------------------------------------------
const journalEntryConfig: EntityActionConfig = {
  entityType: 'journalEntry',
  statusActions: {
    DRAFT: {
      primary: [
        {
          key: 'post',
          labelKey: 'actionBar.post',
          icon: Check,
          isPrimary: true,
          onAction: noop,
          permissionResource: 'finance.journals.detail',
          permissionAction: 'canEdit',
        },
        {
          key: 'saveDraft',
          labelKey: 'actionBar.saveDraft',
          variant: 'outline',
          onAction: noop,
          permissionResource: 'finance.journals.detail',
          permissionAction: 'canEdit',
        },
      ],
      overflow: [
        {
          key: 'delete',
          labelKey: 'actionBar.delete',
          icon: Trash2,
          variant: 'destructive',
          section: 'record',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.deleteTitle',
          confirmDescriptionKey: 'actionBar.confirm.deleteDescription',
          onAction: noop,
          permissionResource: 'finance.journals.detail',
          permissionAction: 'canDelete',
        },
      ],
    },
    POSTED: {
      primary: [],
      overflow: [
        {
          key: 'reverse',
          labelKey: 'actionBar.reverse',
          icon: Undo2,
          variant: 'destructive',
          section: 'status',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.reverseTitle',
          confirmDescriptionKey: 'actionBar.confirm.reverseDescription',
          onAction: noop,
          permissionResource: 'finance.journals.detail',
          permissionAction: 'canEdit',
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Generic / fallback config for unknown entity types
// ---------------------------------------------------------------------------
const genericConfig: EntityActionConfig = {
  entityType: 'generic',
  statusActions: {
    DRAFT: {
      primary: [
        {
          key: 'save',
          labelKey: 'actionBar.save',
          isPrimary: true,
          onAction: noop,
        },
      ],
      overflow: [
        {
          key: 'delete',
          labelKey: 'actionBar.delete',
          icon: Trash2,
          variant: 'destructive',
          section: 'record',
          requiresConfirmation: true,
          confirmTitleKey: 'actionBar.confirm.deleteTitle',
          confirmDescriptionKey: 'actionBar.confirm.deleteDescription',
          onAction: noop,
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Registry — maps entity type to its action configuration
// ---------------------------------------------------------------------------
const configRegistry: Record<string, EntityActionConfig> = {
  customerInvoice: customerInvoiceConfig,
  salesOrder: salesOrderConfig,
  salesQuote: salesQuoteConfig,
  purchaseOrder: purchaseOrderConfig,
  journalEntry: journalEntryConfig,
};

// ---------------------------------------------------------------------------
// Empty action set — used when no config exists for the status
// ---------------------------------------------------------------------------
const EMPTY_ACTION_SET: Readonly<StatusActionSet> = Object.freeze({
  primary: Object.freeze([]),
  overflow: Object.freeze([]),
}) as unknown as StatusActionSet;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the primary and overflow actions available for the given entity type
 * and current status. Falls back to the generic config if the entity type or
 * status is not explicitly configured.
 */
export function getEntityActionConfig(
  entityType: string,
  status: string,
): StatusActionSet {
  const config = configRegistry[entityType] ?? genericConfig;
  const actionSet = config.statusActions[status];
  if (!actionSet) return EMPTY_ACTION_SET;
  // Return shallow copies so callers can safely replace callbacks
  // without mutating the shared registry objects
  return {
    primary: [...actionSet.primary],
    overflow: [...actionSet.overflow],
  };
}

/**
 * Returns global actions (AI + History) available on all entity detail screens.
 * These are independent of entity status.
 * Returns a stable reference (module-level constant) to avoid invalidating
 * downstream useMemo chains in ActionBar on every render.
 */
export function getGlobalActions(_entityType: string): OverflowAction[] {
  return GLOBAL_ACTIONS;
}
