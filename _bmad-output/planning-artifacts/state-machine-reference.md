# Nexa ERP — State Machine Reference

## Document Purpose

Comprehensive reference for all entity lifecycle state machines in Nexa ERP. Each state machine documents valid states, transitions, guards, side effects, and business rules. This document is derived from the architecture sections (2.13 through 2.30) and provides a single authoritative source for developers implementing status transition logic.

## 1. Overview

### State Machine Pattern

All transactional entities in Nexa ERP use status enums to represent their lifecycle state. The pattern originates from the legacy HansaWorld `OKFlag` system, where numeric flag values (0, 1, 2, etc.) controlled document state. Nexa replaces these with named enum values for clarity and type safety.

### Common Patterns

| Pattern | States | Used By |
|---------|--------|---------|
| Draft-Post | DRAFT -> POSTED -> REVERSED | JournalEntry, StockMovement, GoodsReceipt, DepreciationEntry |
| Draft-Approve-Post | DRAFT -> APPROVED -> POSTED | CustomerInvoice, SupplierBill, AssetDisposal, AssetTransfer |
| Draft-Approve-Complete | DRAFT -> APPROVED -> COMPLETED | SupplierPayment (via SENT), BacsRun (via SUBMITTED) |
| Order Fulfillment | DRAFT -> APPROVED -> IN_PROGRESS -> SHIPPED -> INVOICED -> CLOSED | SalesOrder, PurchaseOrder |
| Reference Entity | isActive: true/false | Customer, Supplier, InventoryItem, Warehouse, ChartOfAccount |
| CRM Lifecycle | NEW -> CONTACTED -> QUALIFIED -> CONVERTED | CrmLead |
| Tenant Lifecycle | PROVISIONING -> ACTIVE -> SUSPENDED -> ARCHIVED | Tenant (Platform DB) |
| Billing Enforcement | NONE -> WARNING -> READ_ONLY -> SUSPENDED | TenantBilling.enforcementAction (Platform DB) |

### Soft-Delete Convention

Reference entities (Customer, Supplier, Item, etc.) do not use status enums. They use the `isActive: Boolean` flag for soft-delete. When `isActive = false`, the entity is hidden from default queries but remains for historical referencing.

### Permission Guard Convention (Granular RBAC — E2b)

As of Epic E2b, state machine guards that reference permission or role checks use the **Access Group permission system** rather than the original fixed 5-role hierarchy (`SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER`).

**Key changes:**

1. **Guard syntax:** Where this document shows a permission code in the **Permissions** column (e.g., `sales.approve_order`, `finance.post_journal`, `pos.void_sale`), enforcement uses `createPermissionGuard(resourceCode, action)` middleware. The guard checks the user's assigned **Access Groups** for the matching `AccessGroupPermission` row with `canAccess: true` and the required action flag (`canNew`, `canView`, `canEdit`, `canDelete`).

2. **SUPER_ADMIN bypass:** Users with `SUPER_ADMIN` role bypass the permission matrix entirely — all guards return ALLOW.

3. **Guard notation:** Throughout this document, permission references should be read as:
   - `[permission: resource.code, action]` — e.g., `[permission: sales.orders.detail, delete]`
   - This replaces any legacy `[role >= ADMIN]` or `[role >= MANAGER]` notation.

4. **Legacy permission names:** Permission codes like `OROK`, `UnOKOR`, `UnOKAll` (from HansaWorld) map to specific `resource.code + action` combinations in the Resource table. The exact mapping is defined in the default data file (`packages/db/default-data/company-defaults.json`).

5. **Conflict resolution:** When a user belongs to multiple access groups, the **most permissive** permission wins (OR across all groups).

See the design document: `docs/plans/2026-02-19-granular-rbac-access-groups-design.md` and Epic E2b for full details.

---

## 2. Finance Module State Machines

### 2.1 JournalEntry Lifecycle

**Source:** Section 2.13 (Finance GL)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Entry created but not yet posted to the GL | No | Default on creation |
| POSTED | Entry has been posted; account balances updated | No | Manual post action or auto-post from sub-module |
| REVERSED | Entry has been reversed by a contra-entry | Yes | Reversal action on a POSTED entry |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events | Permissions |
|------|----|---------|--------|--------------|--------|-------------|
| DRAFT | POSTED | Post action | Period must be OPEN; sum of debits must equal sum of credits; all account codes must be valid and postable | Sets `postedAt`, `postedBy`; updates `ChartOfAccount.currentBalance` for each line; emits event | `GL_ENTRY_POSTED` | `finance.post_journal` |
| POSTED | REVERSED | Reversal action | Original entry must be POSTED; period must be OPEN | Creates a new JournalEntry with swapped debits/credits; sets `reversalOfId` on the new entry; links via `reversedBy` relation | `GL_ENTRY_REVERSED` | `finance.reverse_journal` |

**Business Rules:**
- Balanced entry enforcement: sum of all line debits must equal sum of all line credits (enforced by DB trigger per section 2.4)
- Period lock enforcement: cannot post or reverse entries in CLOSED or LOCKED periods
- Auto-generated entries (from sub-modules) are typically created directly in POSTED status

**Diagram:**
```
  DRAFT ──── Post ────► POSTED ──── Reverse ────► REVERSED
                           │
                           └── Creates new reversal JE (POSTED)
```

---

### 2.2 FinancialPeriod Lifecycle

**Source:** Section 2.13 (Finance GL)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| OPEN | Period accepts new journal entries | No | Default on creation |
| CLOSED | Period is soft-closed; authorized users can reopen | No | Manual close action |
| LOCKED | Period is permanently locked; no further modifications | Yes | Manual lock after close |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Permissions |
|------|----|---------|--------|--------------|-------------|
| OPEN | CLOSED | Close action | All reconciliations for the period should be COMPLETED (warning, not hard block) | Prevents further posting | `finance.close_period` |
| CLOSED | OPEN | Reopen action | Must not be LOCKED | Re-enables posting | `finance.reopen_period` |
| CLOSED | LOCKED | Lock action | Period must be CLOSED; bank reconciliation COMPLETED | Sets `lockedAt`, `lockedBy`; permanently prevents modifications | `finance.lock_period` |

**Diagram:**
```
  OPEN ◄──── Reopen ──── CLOSED ──── Lock ────► LOCKED
    │                       ▲
    └──── Close ────────────┘
```

---

### 2.3 BankReconciliation Lifecycle

**Source:** Section 2.13 (Finance GL)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| IN_PROGRESS | Reconciliation is being worked on | No | Default on creation |
| COMPLETED | All items matched; difference is zero | Yes | Finalise action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| IN_PROGRESS | COMPLETED | Finalise action | `difference` must equal zero; all items within the period must be MATCHED or RECONCILED | Sets `completedAt`, `completedBy`; updates `BankAccount.lastReconciledDate` and `lastReconciledBalance`; matched items become RECONCILED |

---

### 2.4 BankTransaction Match Status

**Source:** Section 2.13 (Finance GL)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| UNMATCHED | Imported but not yet matched to a GL entry | No |
| MATCHED | Matched to a JournalLine (auto or manual) | No |
| RECONCILED | Included in a completed BankReconciliation | Yes |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| UNMATCHED | MATCHED | Auto-match (AI confidence >= 95%) or manual match | JournalLine candidate must exist on the bank's GL account | Sets `matchedJournalLineId`, `matchConfidence`, `matchedAt`, `matchedBy` |
| MATCHED | RECONCILED | Bank reconciliation completion | Parent BankReconciliation completes with difference = 0 | Permanent; cannot be unmatched |
| MATCHED | UNMATCHED | Unmatch action | Reconciliation not yet completed | Clears match fields |

---

### 2.5 Budget Lifecycle

**Source:** Section 2.13 (Finance GL)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Budget being prepared | No | Default on creation |
| APPROVED | Budget approved for use in variance reporting | No | Approval action |
| LOCKED | Budget frozen; no further changes | Yes | Lock action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | APPROVED | Approve | At least one BudgetLine exists | Sets `approvedAt`, `approvedBy` |
| APPROVED | LOCKED | Lock | Budget is APPROVED | Prevents any further modifications to budget lines |

---

## 3. Sales Module State Machines

### 3.1 SalesQuote Lifecycle

**Source:** Section 2.16 (Sales Orders)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Quote being prepared | No | Default on creation |
| SENT | Quote emailed/shared with customer | No | Send action |
| ACCEPTED | Customer has accepted the quote | No | Accept action |
| REJECTED | Customer has rejected the quote | Yes | Reject action |
| EXPIRED | Quote validity period has elapsed | Yes | Scheduled job |
| CONVERTED | Quote has been converted to a SalesOrder | Yes | Convert-to-order action |
| CANCELLED | Quote cancelled before acceptance | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | SENT | send() | At least one quote line exists; customer exists | `validUntilDate` tracked | `quote.sent` |
| SENT | ACCEPTED | accept() | Quote not expired | -- | `quote.accepted` |
| SENT | REJECTED | reject() | -- | Sets `rejectionReason` | `quote.rejected` |
| SENT | EXPIRED | Scheduled expiry job | `validUntilDate < today` and status = SENT | Sets `expiryNotified = true` | `quote.expired` |
| ACCEPTED | CONVERTED | convertToOrder() | Quote is ACCEPTED | Creates SalesOrder with lines copied from quote; sets `convertedToOrderId` | `quote.converted` |
| DRAFT/SENT | CANCELLED | cancel() | Not yet ACCEPTED/CONVERTED | -- | `quote.cancelled` |

**Diagram:**
```
  DRAFT ──► SENT ──┬──► ACCEPTED ──► CONVERTED (creates SalesOrder)
    │              │
    │              ├──► REJECTED
    │              │
    │              └──► EXPIRED (scheduled job)
    │
    └──► CANCELLED
```

---

### 3.2 SalesOrder Lifecycle

**Source:** Section 2.16 (Sales Orders)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Order being prepared; editable | No | Default on creation |
| APPROVED | Order locked; stock reservations created | No | Approval action |
| IN_PROGRESS | At least one dispatch created | No | First dispatch created |
| PARTIALLY_SHIPPED | Some lines shipped, not all | No | Computed from line quantities |
| FULLY_SHIPPED | All lines shipped | No | All lines: qtyShipped >= qty |
| PARTIALLY_INVOICED | Some lines invoiced, not all | No | At least one invoice exists |
| FULLY_INVOICED | All lines invoiced | No | All lines: qtyInvoiced >= qty |
| CLOSED | Final immutable state | Yes | Manual or auto-close |
| CANCELLED | Order cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events | Permissions |
|------|----|---------|--------|--------------|--------|-------------|
| DRAFT | APPROVED | approve() | OROK permission; credit limit check (REQ-OR-005-008); customer not blocked; at least 1 line; items valid; payment terms set; period open | Creates StockReservation records; increments `quantityReserved`; creates planned payments; logs CRM activity | `order.approved` | `sales.approve_order` (OROK) |
| DRAFT | CANCELLED | cancel() | No shipments exist | -- | `order.cancelled` | -- |
| APPROVED | IN_PROGRESS | createDispatch() | At least one dispatch created | -- | -- | -- |
| APPROVED | CANCELLED | cancel() | No shipments exist | Releases all stock reservations; deletes planned payments | `order.cancelled` | -- |
| IN_PROGRESS | PARTIALLY_SHIPPED | Dispatch confirmation | `quantityShipped > 0` on at least one line but not all fully shipped | Updates `SalesOrderLine.quantityShipped`; creates `GOODS_ISSUE` stock movements | `order.partially_shipped` | -- |
| IN_PROGRESS/PARTIALLY_SHIPPED | FULLY_SHIPPED | Dispatch confirmation | All non-cancelled lines: `quantityShipped >= quantity` | -- | `order.fully_shipped` | -- |
| FULLY_SHIPPED/PARTIALLY_SHIPPED | PARTIALLY_INVOICED | Invoice creation | At least one line has `quantityInvoiced > 0` | AR module creates CustomerInvoice; updates `quantityInvoiced` | -- | -- |
| PARTIALLY_INVOICED | FULLY_INVOICED | Invoice creation | All non-cancelled lines: `quantityInvoiced >= quantity` | -- | `order.fully_invoiced` | -- |
| FULLY_INVOICED | CLOSED | close() or auto | Manual or automatic when fully invoiced | Immutable | `order.closed` | -- |

**Business Rules:**
- **REQ-OR-013:** Cannot change shipped rows (quantityShipped > 0 blocks line edits)
- **REQ-OR-014:** Quantity cannot go below shipped amount
- **REQ-OR-023:** Over-shipment prevention (unless system setting allows)
- **REQ-OR-040:** OROK permission required for approval
- **REQ-OR-041:** UnOKOR permission required to un-approve
- **REQ-OR-061:** Cannot delete if shipped

**Diagram:**
```
  DRAFT ──► APPROVED ──► IN_PROGRESS ──► PARTIALLY_SHIPPED ──► FULLY_SHIPPED
    │           │                                                     │
    │           │                                              PARTIALLY_INVOICED
    │           │                                                     │
    └─► CANCELLED                                             FULLY_INVOICED
                                                                      │
                                                                   CLOSED
```

---

### 3.3 SalesOrderLine Status

**Source:** Section 2.16 (Sales Orders)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| OPEN | quantityShipped = 0 | No |
| PARTIALLY_FULFILLED | 0 < quantityShipped < quantity | No |
| FULFILLED | quantityShipped >= quantity | Yes |
| CANCELLED | Manually cancelled | Yes |

**Derivation:** Computed from `quantityShipped` vs `quantity`. Not directly set by user.

---

### 3.4 Dispatch Lifecycle

**Source:** Section 2.16 (Sales Orders)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Dispatch being prepared | No | Default on creation |
| PICKED | Items picked from warehouse | No | Pick confirmation |
| PACKED | Items packed for shipping | No | Pack confirmation |
| SHIPPED | Items handed to carrier | No | Ship confirmation |
| DELIVERED | Delivery confirmed | Yes | Delivery confirmation |
| CANCELLED | Dispatch cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | PICKED | pick() | All dispatch lines have items available | -- |
| PICKED | PACKED | pack() | -- | -- |
| PACKED | SHIPPED | ship() | -- | Updates `SalesOrderLine.quantityShipped`; creates `GOODS_ISSUE` stock movements in Inventory module |
| SHIPPED | DELIVERED | deliver() | -- | Sets `actualDelivery` date |
| DRAFT/PICKED/PACKED | CANCELLED | cancel() | Not yet SHIPPED | Releases any reserved quantities |

**Diagram:**
```
  DRAFT ──► PICKED ──► PACKED ──► SHIPPED ──► DELIVERED
    │          │          │
    └──────────┴──────────┴──► CANCELLED
```

---

## 4. Purchasing & AP Module State Machines

### 4.1 PurchaseOrder Lifecycle

**Source:** Section 2.17 (Purchasing & AP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | PO being prepared | No | Default on creation |
| APPROVED | PO approved by authorized user | No | Approval action |
| SENT | PO transmitted to supplier | No | Send action |
| PARTIALLY_RECEIVED | Some lines received via GRN | No | Computed from line quantities |
| FULLY_RECEIVED | All lines received | No | All lines: qtyReceived >= qty |
| PARTIALLY_INVOICED | Some lines invoiced via SupplierBill | No | Computed from line quantities |
| FULLY_INVOICED | All lines invoiced | No | All lines: qtyInvoiced >= qty |
| CLOSED | PO completed; final state | Yes | Manual close |
| CANCELLED | PO cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Permissions |
|------|----|---------|--------|--------------|-------------|
| DRAFT | APPROVED | approve() | Supplier exists and not blocked; at least 1 line; amounts valid | Sets `approvedBy`, `approvedAt` | `purchasing.approve_po` |
| APPROVED | SENT | send() | PO is APPROVED | PO transmitted to supplier (email/PDF) | -- |
| SENT/APPROVED | PARTIALLY_RECEIVED | GRN posting | GRN posted against this PO; some lines have partial receipts | `PurchaseOrderLine.quantityReceived` incremented | -- |
| PARTIALLY_RECEIVED | FULLY_RECEIVED | GRN posting | All lines: `quantityReceived >= quantity` | -- | -- |
| Any received state | PARTIALLY_INVOICED | Bill posting | At least one SupplierBill line linked to a PO line | `PurchaseOrderLine.quantityInvoiced` incremented | -- |
| PARTIALLY_INVOICED | FULLY_INVOICED | Bill posting | All lines: `quantityInvoiced >= quantity` | -- | -- |
| FULLY_INVOICED | CLOSED | close() | All lines fully invoiced | Immutable | -- |
| DRAFT/APPROVED | CANCELLED | cancel() | No GRNs received | -- | -- |

---

### 4.2 PurchaseOrderLine Status

**Source:** Section 2.17 (Purchasing & AP)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| OPEN | quantityReceived = 0 | No |
| PARTIALLY_RECEIVED | 0 < quantityReceived < quantity | No |
| RECEIVED | quantityReceived >= quantity | Yes |
| CANCELLED | Manually cancelled | Yes |

---

### 4.3 GoodsReceipt Lifecycle

**Source:** Section 2.17 (Purchasing & AP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Receipt being prepared | No | Default on creation |
| POSTED | Receipt posted; stock updated | No | Post action |
| CANCELLED | Receipt cancelled (reversal) | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | POSTED | post() | Warehouse is active; items exist; quantities valid | Creates `GOODS_RECEIPT` StockMovement(s); creates JournalEntry (Dr Stock, Cr GRN Accrual); updates `PurchaseOrderLine.quantityReceived`; updates `InventoryItem.lastPurchasePrice`; updates `StockBalance` | `grn.posted` |
| POSTED | CANCELLED | cancel() | Reversal is allowed | Creates reversal StockMovement(s); creates reversal JournalEntry; decrements `PurchaseOrderLine.quantityReceived`; reverses `StockBalance` updates | `grn.cancelled` |

---

### 4.4 SupplierBill Lifecycle

**Source:** Section 2.17 (Purchasing & AP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Bill being entered | No | Default on creation |
| APPROVED | Bill approved; ready for posting | No | Approval action |
| POSTED | Bill posted to GL; AP balance created | No | Post action |
| PARTIALLY_PAID | Some payment allocated | No | Computed from paidAmount |
| PAID | Fully paid (outstandingAmount = 0) | Yes | Full payment allocation |
| CANCELLED | Bill cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | APPROVED | approve() | At least 1 line; totals valid; supplier exists | Three-way match validation (if PO linked) | `bill.approved` |
| APPROVED | POSTED | post() | Period is OPEN; match status acceptable (configurable) | Creates JournalEntry (Dr Cost/Expense + VAT Input, Cr AP Control); sets `journalEntryId`; updates `PurchaseOrderLine.quantityInvoiced` | `bill.posted` |
| POSTED | PARTIALLY_PAID | Payment allocation | Payment allocated but `outstandingAmount > 0` | Updates `paidAmount`, `outstandingAmount` | -- |
| POSTED/PARTIALLY_PAID | PAID | Payment allocation | `outstandingAmount = 0` | -- | `bill.paid` |
| DRAFT/APPROVED | CANCELLED | cancel() | Not yet POSTED | No GL impact | `bill.cancelled` |

**Match Status (parallel state):**

| Status | Description |
|--------|-------------|
| UNMATCHED | No PO reference or lines not yet linked |
| PARTIALLY_MATCHED | Some bill lines matched against PO/GRN |
| FULLY_MATCHED | All bill lines pass quantity and price checks |

---

### 4.5 SupplierPayment Lifecycle

**Source:** Section 2.17 (Purchasing & AP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Payment being prepared | No | Default on creation |
| APPROVED | Payment approved | No | Approval action |
| SENT | Payment transmitted to bank | No | Send/submit action |
| COMPLETED | Bank confirms payment processed | Yes | Completion confirmation |
| CANCELLED | Payment cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | APPROVED | approve() | Bank account set; amount > 0; at least 1 allocation | -- | `payment.approved` |
| APPROVED | SENT | send() | -- | Payment transmitted (BACS file or manual) | `payment.sent` |
| SENT | COMPLETED | complete() | Bank confirms processing | Creates JournalEntry (Dr AP Control, Cr Bank +/- FX Gain/Loss); updates `SupplierBill.paidAmount` and `outstandingAmount` for all allocations | `payment.completed` |
| DRAFT/APPROVED | CANCELLED | cancel() | Not yet SENT | -- | `payment.cancelled` |

---

### 4.6 BacsRun Lifecycle

**Source:** Section 2.17 (Purchasing & AP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Run being assembled | No | Default on creation |
| APPROVED | Manager approved the run | No | Approval action |
| SUBMITTED | BACS file uploaded to bank | No | Submit action |
| COMPLETED | Bank confirms processing (T+2) | Yes | Completion confirmation |
| FAILED | Bank rejected the file | Yes | Bank rejection |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | APPROVED | approve() | All suppliers have valid UK bank details; amounts within bank limits | -- |
| APPROVED | SUBMITTED | Generate + submit BACS file | Valid BACS file generated | Sets `fileReference`, `submittedAt` |
| SUBMITTED | COMPLETED | Bank confirmation | -- | All SupplierPayments in run move to COMPLETED; GL journal entries posted |
| SUBMITTED | FAILED | Bank rejection | -- | Payments remain unprocessed; manual resolution required |

---

## 5. AR Module State Machines

### 5.1 CustomerInvoice Lifecycle

**Source:** Section 2.15 (Sales Ledger / AR)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Invoice being prepared | No | Default on creation |
| APPROVED | Invoice validated and approved | No | Approval or auto-approve |
| POSTED | Invoice posted to GL; AR balance created | No | Post action |
| CANCELLED | Invoice cancelled (pre-post only) | Yes | Cancel action |
| VOID | Posted invoice reversed | Yes | Void action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | APPROVED | approve() or auto-approve | At least 1 line; totals recalculated; due date set from payment terms; auto-approve if `totalAmount < SystemSetting.invoiceAutoApproveThreshold` | Validates all amounts | `invoice.approved` |
| DRAFT | CANCELLED | cancel() | -- | None (no GL impact) | `invoice.cancelled` |
| APPROVED | POSTED | post() | Period is OPEN | Creates JournalEntry (Dr AR Control, Cr Revenue + Cr VAT Output); sets `outstandingAmount = totalAmount`; sets `journalEntryId` | `invoice.posted` |
| APPROVED | CANCELLED | cancel() | Not yet posted | None (no GL reversal needed) | `invoice.cancelled` |
| POSTED | VOID | void() | -- | Creates reversal JournalEntry (swapped debits/credits); sets `outstandingAmount = 0`; original JE remains for audit | `invoice.voided` |

**Payment tracking (not a status change):** When payments are allocated to a POSTED invoice, `paidAmount` and `outstandingAmount` are updated. The invoice remains in POSTED status. Full payment is indicated by `paidAmount = totalAmount` and `outstandingAmount = 0`.

**GL Posting Pattern:**
```
Dr  1100 Accounts Receivable (AR Control)     totalAmount
Cr  4000 Sales Revenue (per line accountCode) subtotal
Cr  2200 VAT Output (per VatCode)             vatAmount
```

**Diagram:**
```
  DRAFT ──┬── Approve ──► APPROVED ──── Post ──► POSTED
          │                   │                     │
          └── Cancel ──► CANCELLED           Void ──► VOID
                              │
                              └── Cancel ──► CANCELLED
```

---

### 5.2 CustomerPayment Lifecycle

**Source:** Section 2.15 (Sales Ledger / AR)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Payment being entered | No | Default on creation |
| POSTED | Payment posted to GL | No | Post action |
| CANCELLED | Payment reversed | Yes | Cancel/reversal action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | POSTED | post() | Amount > 0; bank account set; at least partial allocation | Creates JournalEntry (Dr Bank, Cr AR Control); for each allocation: updates `CustomerInvoice.paidAmount` and `outstandingAmount`; handles FX differences via exchange gain/loss accounts | `payment.posted` |
| POSTED | CANCELLED | cancel() | -- | Creates mirror JournalEntry (swap Dr/Cr); restores `CustomerInvoice.outstandingAmount` and `paidAmount` on all linked allocations; allocation records soft-deleted | `payment.cancelled` |

---

## 6. Inventory Module State Machines

### 6.1 StockMovement Lifecycle

**Source:** Section 2.14 (Inventory)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Movement created but not yet applied | No | Default on creation |
| POSTED | Movement applied; stock balances updated | No | Post action |
| REVERSED | Movement reversed by a contra-movement | Yes | Reversal action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | POSTED | post() | Item exists; warehouse active; quantity sign matches type; serial/batch valid (if tracked) | Calculates `unitCost` based on costing method; updates `StockBalance.quantityOnHand` and `costValue` atomically; updates `StockBalance.lastMovementDate`; if WA costing: recalculates `InventoryItem.weightedAveragePrice`; if last-purchase + receipt: updates `InventoryItem.lastPurchasePrice`; if serial-tracked: updates `SerialNumber.status` and `warehouseId`; generates GL journal entry | `stock_movement.posted` |
| POSTED | REVERSED | reverse() | -- | Creates new contra-movement (opposite quantity, same cost); links via `reversedById`; reverses all `StockBalance` updates; reverses GL journal entry; if serial-tracked: reverts `SerialNumber.status` | `stock_movement.reversed` |

**Inter-warehouse transfers** create two linked movements: `TRANSFER_OUT` (negative, source warehouse) and `TRANSFER_IN` (positive, destination warehouse), posted atomically in a single transaction.

**Diagram:**
```
  DRAFT ──── Post ────► POSTED ──── Reverse ────► REVERSED
                           │
                           └── Creates contra-movement (POSTED)
```

---

### 6.2 SerialNumber Status

**Source:** Section 2.14 (Inventory)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| AVAILABLE | Serial number is in stock and available | No |
| RESERVED | Reserved against a sales order | No |
| SOLD | Sold to a customer (goods issued) | No |
| RETURNED | Returned from a customer | No |
| QUARANTINE | Held for inspection | No |

**Transitions:** Driven by stock movements and order processing. Status changes are side effects of StockMovement posting, SalesOrder reservation, and return processing.

---

## 7. Fixed Assets Module State Machines

### 7.1 FixedAsset Status

**Source:** Section 2.18 (Fixed Assets)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| ACTIVE | Asset in service; depreciation running | No | Acquisition or commissioning |
| FULLY_DEPRECIATED | Book value has reached salvage value | No | Auto-set when `currentBookValue <= salvageValue` |
| DISPOSED | Asset sold or transferred | Yes | AssetDisposal posted (type: SALE, TRADE_IN) |
| WRITTEN_OFF | Asset scrapped or written off | Yes | AssetDisposal posted (type: SCRAP, WRITE_OFF) |
| UNDER_CONSTRUCTION | Asset not yet commissioned (WIP) | No | Initial state for assets being built |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| UNDER_CONSTRUCTION | ACTIVE | Commission/capitalise | `inServiceDate` set; `depreciationStartDate` set | Starts depreciation calculations; creates AssetTransaction (ACQUISITION) |
| ACTIVE | FULLY_DEPRECIATED | Monthly depreciation run | `currentBookValue <= salvageValue` | Depreciation stops; asset remains on register |
| ACTIVE/FULLY_DEPRECIATED | DISPOSED | AssetDisposal posted (SALE/TRADE_IN) | Disposal approved and posted | GL entries: removes asset cost, accumulated depreciation, records gain/loss; sets `endDate`; sets `isActive = false`; emits `asset.disposed` |
| ACTIVE/FULLY_DEPRECIATED | WRITTEN_OFF | AssetDisposal posted (SCRAP/WRITE_OFF) | Disposal approved and posted | GL entries: removes asset cost and accumulated depreciation; sets `endDate`; sets `isActive = false`; emits `asset.disposed` |

---

### 7.2 DepreciationEntry Lifecycle

**Source:** Section 2.18 (Fixed Assets)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Calculated but not yet posted | No | Default from batch run |
| POSTED | Posted to GL | Yes | Approval/post action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | POSTED | Batch post | User approves the depreciation run | Creates JournalEntry (Dr Depreciation Expense, Cr Accumulated Depreciation per AssetClass GL codes); updates `FixedAsset.accumulatedDepreciation` and `currentBookValue`; if fully depreciated, sets asset status to `FULLY_DEPRECIATED`; emits `depreciation.entry.posted` |

---

### 7.3 AssetDisposal Lifecycle

**Source:** Section 2.18 (Fixed Assets)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Disposal being prepared | No | Default on creation |
| APPROVED | Disposal approved | No | Approval action |
| POSTED | Disposal posted to GL; asset retired | Yes | Post action |
| CANCELLED | Disposal cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | APPROVED | approve() | Asset exists; disposal date valid; gain/loss calculated | Runs final pro-rata depreciation up to disposal date |
| APPROVED | POSTED | post() | Period is OPEN | Creates JournalEntry for disposal; updates FixedAsset status to DISPOSED or WRITTEN_OFF; sets `endDate`; creates AssetTransaction (DISPOSAL); emits `asset.disposed` |
| DRAFT/APPROVED | CANCELLED | cancel() | Not yet POSTED | -- |

---

### 7.4 AssetTransfer Lifecycle

**Source:** Section 2.18 (Fixed Assets)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Transfer being prepared | No | Default on creation |
| APPROVED | Transfer approved | No | Approval action |
| POSTED | Transfer executed | Yes | Post action |
| CANCELLED | Transfer cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | APPROVED | approve() | From/to departments valid and different | Sets `approvedBy`, `approvedAt` |
| APPROVED | POSTED | post() | -- | Updates `FixedAsset.departmentId` and `location`; creates AssetTransaction (TRANSFER) |
| DRAFT/APPROVED | CANCELLED | cancel() | Not yet POSTED | -- |

---

## 8. CRM Module State Machines

### 8.1 CrmLead Lifecycle

**Source:** Section 2.21 (CRM)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| NEW | Lead captured (web form, import, manual) | No | Default on creation |
| CONTACTED | First outreach made | No | Salesperson records contact |
| QUALIFIED | Lead is a viable prospect | No | Qualification assessment |
| UNQUALIFIED | Lead is not a fit | Yes | Disqualification |
| CONVERTED | Lead converted to Customer | Yes | Conversion action |
| LOST | Lead went cold or chose competitor | Yes | Loss recorded |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| NEW | CONTACTED | Contact recorded | -- | Rating can now be set (BR-CRM-003) | `lead.contacted` |
| CONTACTED | QUALIFIED | Qualification | Rating set to COLD/WARM/HOT | -- | `lead.qualified` |
| CONTACTED | UNQUALIFIED | Disqualification | -- | -- | `lead.unqualified` |
| QUALIFIED | CONVERTED | convertToCustomer() | lifecycle = QUALIFIED (BR-CRM-004); not already converted (BR-CRM-006) | Creates Customer record in AR module; copies address, contact, financial defaults; sets `convertedCustomerId`, `convertedAt`, `convertedBy` | `lead.converted` |
| NEW/CONTACTED/QUALIFIED | LOST | Loss recorded | -- | -- | `lead.lost` |

**Business Rules:**
- **BR-CRM-003:** Rating (COLD/WARM/HOT) can only be set when lifecycle is CONTACTED or QUALIFIED
- **BR-CRM-004:** Conversion requires lifecycle = QUALIFIED
- **BR-CRM-005:** Conversion creates a new Customer in AR module
- **BR-CRM-006:** Lead can only be converted once
- **BR-CRM-017:** Converted leads cannot be deleted (soft-delete only)

**Diagram:**
```
  NEW ──► CONTACTED ──┬──► QUALIFIED ──┬──► CONVERTED (creates Customer)
                      │                │
                      │                └──► LOST
                      │
                      └──► UNQUALIFIED
```

---

### 8.2 CrmCampaign Lifecycle

**Source:** Section 2.21 (CRM)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Campaign being prepared; recipients added | No | Default on creation |
| ACTIVE | Campaign is running; contacts being made | No | Activation |
| COMPLETED | Campaign finished; metrics finalized | Yes | Completion |
| CANCELLED | Campaign cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | ACTIVE | activate() | At least 1 recipient (BR-CRM-007) | Activities auto-created per CrmActivityAutoRule | `campaign.activated` |
| ACTIVE | COMPLETED | complete() | -- | Final metrics calculated (contact rate, response rate, conversion count) | `campaign.completed` |
| DRAFT/ACTIVE | CANCELLED | cancel() | Not COMPLETED (BR-CRM-009) | -- | `campaign.cancelled` |

**Business Rules:**
- **BR-CRM-007:** Activation requires at least one recipient
- **BR-CRM-008:** Recipients must be unique per campaign
- **BR-CRM-009:** Status transitions are strictly ordered: DRAFT -> ACTIVE -> COMPLETED

---

### 8.3 CrmOpportunity Lifecycle

**Source:** Section 2.21 (CRM)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| OPEN | Opportunity active in pipeline | No | Default on creation |
| WON | Deal closed successfully | Yes | Win action |
| LOST | Deal lost to competitor or abandoned | Yes | Loss action |
| CANCELLED | Opportunity abandoned (no win/loss) | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| OPEN | WON | win() | -- | Sets `probability = 100.00`; sets `actualCloseDate = today`; recalculates `weightedValue`; optionally creates SalesOrder | `opportunity.won` |
| OPEN | LOST | lose() | `lossReason` required (BR-CRM-012) | Sets `probability = 0.00`; sets `actualCloseDate = today`; sets `weightedValue = 0` | `opportunity.lost` |
| OPEN | CANCELLED | cancel() | -- | No win/loss attribution | `opportunity.cancelled` |

**Business Rules:**
- **BR-CRM-011:** WON sets probability to 100, actualCloseDate to today
- **BR-CRM-012:** LOST requires lossReason, sets probability to 0
- **BR-CRM-013:** `weightedValue = estimatedValue * probability / 100` (stored for reporting)
- **BR-CRM-014:** All stage changes logged in `CrmOpportunityStageLog`
- **BR-CRM-018:** Approval via cross-cutting engine blocks conversion until approved

---

## 9. HR/Payroll Module State Machines

### 9.1 Employee Status

**Source:** Section 2.22 (HR & Payroll)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| ACTIVE | Employee is currently employed | No | Default on creation |
| ON_LEAVE | Employee on extended leave | No | Leave initiated |
| SUSPENDED | Employee suspended from duties | No | Suspension action |
| TERMINATED | Employment ended | Yes | Termination action |
| RETIRED | Employee has retired | Yes | Retirement action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| ACTIVE | ON_LEAVE | Leave initiation | Leave request approved | -- |
| ON_LEAVE | ACTIVE | Return from leave | -- | -- |
| ACTIVE | SUSPENDED | Suspension | HR action | -- |
| SUSPENDED | ACTIVE | Reinstatement | HR action | -- |
| ACTIVE | TERMINATED | Termination | Contract terminated (BR-CTR-003) | Sets `terminationDate`; generates P45 (BR-PAY-016); cancels pending training plans |
| ACTIVE | RETIRED | Retirement | -- | Sets `terminationDate` |

**Business Rules:**
- **BR-EMP-003:** Terminated/retired employees cannot be reactivated
- **BR-EMP-004:** Bank details required before inclusion in payroll run

---

### 9.2 EmploymentContract Lifecycle

**Source:** Section 2.22 (HR & Payroll)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Contract being prepared | No | Default on creation |
| APPROVED | Contract approved; immutable | No | Approval action |
| TERMINATED | Contract ended | Yes | Termination action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | APPROVED | approve() | `startDate` set (BR-CTR-002); only one active contract per employee (BR-CTR-001) | Sets `approvedAt`, `approvedBy`; contract becomes immutable (all changes go through ContractChange records) |
| APPROVED | TERMINATED | terminate() | `terminationReason`, `endDate`, `terminationDetails` required (BR-CTR-003) | -- |

**Business Rules:**
- **BR-CTR-001:** Only one active (APPROVED, non-TERMINATED) contract per employee at a time
- **BR-CTR-002:** StartDate is mandatory
- **BR-CTR-003:** Termination requires reason, end date, and details
- **BR-CTR-004:** Approved contracts cannot be deleted; only terminated
- Changes to approved contracts create immutable `ContractChange` records that overlay the original

**Diagram:**
```
  DRAFT ──── Approve ────► APPROVED ──── Terminate ────► TERMINATED
    │                          │
    │                          └── Changes create ContractChange records
    └── Delete (removed)           (immutable overlay pattern)
```

---

### 9.3 PayrollRun Lifecycle

**Source:** Section 2.22 (HR & Payroll)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Run being prepared | No | Default on creation |
| CALCULATED | Payroll engine has run calculations | No | Calculate action |
| REVIEWED | Manager has reviewed results | No | Review completion |
| APPROVED | Authorized for payment | No | Approval action |
| PAID | BACS/payments sent | No | Payment confirmation |
| POSTED | GL journal entries created | Yes | GL posting |
| CANCELLED | Run cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | CALCULATED | calculate() | All employees have valid tax codes and bank details (BR-EMP-004) | Runs PAYE, NI, student loan, pension calculations for each employee; generates PayrollLine records |
| CALCULATED | REVIEWED | review() | Manager reviews all PayrollLine records | -- |
| REVIEWED | APPROVED | approve() | Authorized approver | -- |
| APPROVED | PAID | pay() | BACS file generated or manual payment confirmed | Payment sent to employees |
| PAID | POSTED | post() | Period is OPEN | Creates balanced JournalEntry (Dr Payroll Expense, Cr Payroll Liability + Bank); sets `journalEntryId` |
| DRAFT/CALCULATED | CANCELLED | cancel() | Not yet REVIEWED (BR-PAY-017) | -- |

**Business Rules:**
- **BR-PAY-017:** Status transitions are strictly ordered: DRAFT -> CALCULATED -> REVIEWED -> APPROVED -> PAID -> POSTED. CANCELLED only from DRAFT or CALCULATED.
- **BR-PAY-018:** GL posting creates a balanced journal entry

---

### 9.4 LeaveRequest Lifecycle

**Source:** Section 2.22 (HR & Payroll)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| PENDING | Request submitted; awaiting approval | No | Default on creation |
| APPROVED | Request approved | No | Approval action |
| REJECTED | Request rejected | Yes | Rejection action |
| CANCELLED | Request cancelled by employee | Yes | Cancel action |
| TAKEN | Leave has been taken | Yes | Leave period elapsed |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| PENDING | APPROVED | approve() | Sufficient leave balance; no conflicting approved leave | Deducts from `LeaveBalance`; updates `LeaveEntitlement` |
| PENDING | REJECTED | reject() | -- | Reason recorded |
| PENDING/APPROVED | CANCELLED | cancel() | Leave period not yet started (or partially elapsed) | Restores `LeaveBalance` if was APPROVED |
| APPROVED | TAKEN | Leave period elapses | Dates pass | -- |

---

### 9.5 HMRCSubmission Lifecycle

**Source:** Section 2.22 (HR & Payroll)

HMRC submissions track the lifecycle of Real Time Information (RTI) filings to HMRC, including Full Payment Submissions (FPS), Employer Payment Summaries (EPS), P45 leaver notifications, and P46 new starter forms. This state machine has regulatory significance: FPS must be submitted on or before the payment date (BR-PAY-011), EPS is due by the 19th of the following tax month (BR-PAY-012), and P45 must be generated within 14 days of employment ending (BR-PAY-016).

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Submission record created; XML not yet generated | No | Default on creation |
| GENERATED | RTI XML payload has been generated and is ready for submission | No | Generate action |
| SUBMITTED | XML submitted to HMRC Gateway; awaiting response | No | Submit action |
| ACCEPTED | HMRC has accepted the submission | Yes | HMRC acceptance response |
| REJECTED | HMRC has rejected the submission | No | HMRC rejection response |
| ERROR | Technical error during submission or processing | No | Transmission or processing failure |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | GENERATED | generate() | PayrollRun must be in PAID or POSTED status (for FPS); employee data valid | Generates RTI XML payload; sets `xmlPayload` |
| GENERATED | SUBMITTED | submit() | Valid XML payload exists | Submits to HMRC Gateway; sets `submittedAt`; receives `hmrcCorrelationId` |
| SUBMITTED | ACCEPTED | HMRC response | HMRC returns acceptance | Sets `responseCode`, `responseMessage` |
| SUBMITTED | REJECTED | HMRC response | HMRC returns rejection with error details | Sets `responseCode`, `responseMessage`, `errorDetails`; requires correction and resubmission |
| SUBMITTED | ERROR | Transmission failure | Network or gateway error | Sets `errorDetails`; can be retried |
| REJECTED | DRAFT | Correction | User corrects the underlying data | Clears previous XML; allows regeneration |
| ERROR | GENERATED | Retry preparation | Error resolved | Ready for resubmission |

**Business Rules:**
- **BR-PAY-011:** FPS must be submitted to HMRC on or before the payment date
- **BR-PAY-012:** EPS is due by the 19th of the following tax month
- **BR-PAY-016:** P45 must be generated within 14 days of employment ending

**Diagram:**
```
  DRAFT ──► GENERATED ──► SUBMITTED ──┬──► ACCEPTED
                                      │
                                      ├──► REJECTED ──► DRAFT (correct & retry)
                                      │
                                      └──► ERROR ──► GENERATED (retry)
```

---

## 10. Manufacturing Module State Machines

### 10.1 ProductionOrder Lifecycle

**Source:** Section 2.23 (Production & MRP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| CREATED | Order created | No | Default on creation |
| RELEASED | Order released for production | No | Release action |
| STARTED | Production has begun | No | Start action |
| FINISHED | All production complete | Yes | Finish action |
| CANCELLED | Order cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| CREATED | RELEASED | release() | Machine required (unless routing specified); recipe exists and not closed; warehouse active; responsible person set; machine-item compatibility via MachineItemDefault | -- |
| RELEASED | STARTED | start() | -- | Auto-sets `startDate`/`startTime`; places order in machine queue (`queuePosition`); creates material reservations in Inventory |
| STARTED | FINISHED | finish() | All child Productions must be complete | Auto-sets `endDate`/`endTime`; removes from machine queue |
| Any non-FINISHED | CANCELLED | cancel() | No child Production has `status = FINISHED` | Releases all material reservations; removes from machine queue |

**Stock Impact:** Active orders (CREATED through STARTED) generate planned stock quantities: input items are reserved/on-order, output items contribute to expected supply.

**Diagram:**
```
  CREATED ──► RELEASED ──► STARTED ──► FINISHED
                               │
                               └──► CANCELLED
```

---

### 10.2 Production Lifecycle

**Source:** Section 2.23 (Production & MRP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| CREATED | Row quantities set from recipe | No | Default on creation |
| STARTED | Production in progress | No | Start action |
| FINISHED | Production complete; outputs received | Yes | Finish action |
| CANCELLED | Production cancelled | Yes | Cancel action |
| FINISHED_DISCARDED | Finished but output discarded | Yes | Discard action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| CREATED | STARTED | start() | -- | Auto-sets `startDate`/`startTime`; if `autoCreateWip` enabled, creates WIP GL transaction (Dr WIP, Cr Stock for inputs); updates parent ProductionOrder to STARTED; creates stock reservations |
| STARTED | FINISHED | finish() | At least one output row with `outputQty > 0` | Creates GL transaction (Dr Stock output, Cr Component Usage inputs, Stock Gain balancing); updates serial numbers, item cost prices, item history; updates parent ProductionOrder `finishedQty` |
| STARTED | CANCELLED | cancel() | No operations are finished/discarded | If `autoCreateWip`, reverses WIP transaction |
| STARTED | FINISHED_DISCARDED | discard() | `discardReasonCode` required | Creates Stock Depreciation record if `createStockDepOnDiscard` enabled; posts to Discarded Account; still updates stock (output removed, inputs consumed) |

**Reversal (Un-OK):** Status can be reverted from FINISHED/FINISHED_DISCARDED back to CREATED (requires `UnOKAll` permission). Reverses stock movements, serial numbers, cost prices. Deletes associated GL transaction.

---

### 10.3 ProductionOperation Lifecycle

**Source:** Section 2.23 (Production & MRP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| CREATED | Operation created from routing step | No | Default on creation |
| STARTED | Operation in progress on machine | No | Start action |
| FINISHED | Operation complete | Yes | Finish action |
| CANCELLED | Operation cancelled | Yes | Cancel action |
| FINISHED_DISCARDED | Finished but output discarded | Yes | Discard action |

**Transitions follow the same pattern as Production:** CREATED -> STARTED -> FINISHED, with CANCELLED and FINISHED_DISCARDED as alternatives from STARTED. Operations support partial completion and cascade cancel (cancelling a production cancels all its operations).

---

### 10.4 ProductionPlan Lifecycle

**Source:** Section 2.23 (Production & MRP)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Plan being prepared | No | Default on creation |
| APPROVED | Plan approved; generates production orders or direct productions | No | Approval action |
| CLOSED | Plan completed | Yes | Close action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | APPROVED | approve() | At least one plan line with quantity > 0 | Generates ProductionPlanComponent records (auto-generated material requirements); depending on `generationMode`, creates ProductionOrder records (VIA_PRODUCTION_ORDER) or Production records (DIRECT_PRODUCTION) |
| APPROVED | CLOSED | close() | All generated orders/productions are complete or cancelled | -- |

---

## 11. POS Module State Machines

### 11.1 POSSession Lifecycle

**Source:** Section 2.24 (POS)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| OPEN | Session is active; sales can be recorded | No | Session opened |
| CLOSED | Session closed; ready for cashup | Yes | Close action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| (none) | OPEN | openSession() | Only one OPEN session per terminal+drawer (POS-002); user not in another open session (POS-003) | Sets `openedAt`, `openedBy`, `openingFloat` |
| OPEN | CLOSED | closeSession() | -- | Sets `closedAt`, `closedBy`, `closingFloat`; triggers cashup workflow |

**Business Rules:**
- **POS-001:** Session must be OPEN before sales can be recorded
- **POS-002:** Only one open session per terminal+drawer combination
- **POS-003:** A user cannot belong to two open sessions simultaneously
- **POS-004:** Session must be CLOSED before cashup can run

---

### 11.2 POSSale Lifecycle

**Source:** Section 2.24 (POS)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| IN_PROGRESS | Sale being built (items scanned/added) | No | Default on creation |
| SUSPENDED | Sale parked for later retrieval | No | Suspend action |
| COMPLETED | Paid and finished | Yes | Payment covers total |
| VOIDED | Entire sale invalidated after completion | Yes | Void action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| IN_PROGRESS | COMPLETED | addPayment() | Payment(s) cover totalAmount | Receipt generated; GL journal created; stock movements created (if not deferred) |
| IN_PROGRESS | SUSPENDED | suspend() | -- | Sale parked; can be resumed later |
| SUSPENDED | IN_PROGRESS | resume() | -- | Sale restored for completion |
| COMPLETED | VOIDED | voidSale() | Supervisor approval required (POS-005); RBAC permission `pos.void_sale` | Reversal GL journal entry; stock movements reversed |

**Business Rules:**
- **POS-005:** Voiding a completed sale requires supervisor approval

---

### 11.3 POSCashup Lifecycle

**Source:** Section 2.24 (POS)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Cashup in progress; counts being entered | No | Default on creation |
| COMPLETED | Cashup finalized | No | Finalize action |
| POSTED | GL transaction created for variances | Yes | Post action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | COMPLETED | finaliseCashup() | Session is CLOSED | Calculates expected vs actual totals; determines variance |
| COMPLETED | POSTED | post() | -- | Creates JournalEntry for cash variances (write-off); sets `journalEntryId` |

---

## 12. Projects Module State Machines

### 12.1 Project Lifecycle

**Source:** Section 2.25 (Projects & Job Costing)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Project created; budget prepared | No | Default on creation |
| ACTIVE | Time/expenses can be recorded; invoices generated | No | Activation |
| ON_HOLD | Temporarily paused | No | Hold action |
| COMPLETED | All work finished; final invoice generated | No | Completion |
| CANCELLED | Project cancelled; uninvoiced costs written off | Yes | Cancel action |
| ARCHIVED | Historical record only | Yes | Archive action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | ACTIVE | activate() | Customer required if billable (PRJ-002); start/end dates set | Time/expense recording enabled |
| ACTIVE | ON_HOLD | hold() | -- | Time/expense recording paused; invoicing blocked (INV-004) |
| ON_HOLD | ACTIVE | resume() | -- | Resumes recording and invoicing |
| ACTIVE | COMPLETED | complete() | Warning (not block) if uninvoiced billable transactions exist (PRJ-007) | Final P&L report finalized |
| COMPLETED | ARCHIVED | archive() | -- | Historical record only |
| Any pre-completed | CANCELLED | cancel() | -- | Writes off uninvoiced amounts |

**Business Rules:**
- **PRJ-004:** Only ACTIVE projects accept time/expense entries
- **PRJ-006:** Cannot delete project with transactions
- **PRJ-007:** Warning if uninvoiced amounts exist on completion

**Diagram:**
```
  DRAFT ──► ACTIVE ──┬──► ON_HOLD ──► ACTIVE (resume)
                     │
                     ├──► COMPLETED ──► ARCHIVED
                     │
                     └──► CANCELLED
```

---

### 12.2 Timesheet Lifecycle

**Source:** Section 2.25 (Projects & Job Costing)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Employee entering time daily | No | Default on creation |
| SUBMITTED | Submitted for approval | No | Submit action |
| APPROVED | Approved by manager | Yes | Approval action |
| REJECTED | Rejected; returns to DRAFT | No | Rejection action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| DRAFT | SUBMITTED | submit() | At least one entry; all entries have valid project references (TS-007) | Sets `submittedAt` |
| SUBMITTED | APPROVED | approve() | -- | Sets `approvedAt`, `approvedBy`; creates ProjectTransaction records for each entry with `sourceType = TIMESHEET` (TS-006); resolves billable rates from ProjectRateCard (TS-008) |
| SUBMITTED | REJECTED | reject() | -- | Returns to DRAFT with rejection reason (TS-005) |

**Business Rules:**
- **TS-004:** Cannot edit SUBMITTED or APPROVED timesheets
- **TS-005:** Rejection returns timesheet to DRAFT
- **TS-006:** Approval creates ProjectTransactions

---

### 12.3 ProjectExpense Status

**Source:** Section 2.25 (Projects & Job Costing)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Expense being entered | No | Default on creation |
| SUBMITTED | Submitted for approval | No | Submit action |
| APPROVED | Approved | No | Approval action |
| REJECTED | Rejected | No | Rejection action |
| INVOICED | Billed to customer | Yes | Invoice creation |

**Transitions follow the same DRAFT -> SUBMITTED -> APPROVED pattern as Timesheets.** Approval creates a ProjectTransaction with `sourceType = EXPENSE`. APPROVED expenses can then be included in customer invoices, transitioning to INVOICED.

---

## 13. Contracts & Agreements Module State Machines

### 13.1 Agreement (Rental) Lifecycle

**Source:** Section 2.26 (Contracts & Agreements)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Agreement being prepared | No | Default on creation |
| ACTIVE | Agreement approved and running | No | Approval action |
| CLOSED | All items returned; agreement complete | Yes | Close action |
| CANCELLED | Agreement cancelled | Yes | Cancel action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | ACTIVE | approve() | Customer exists and not blocked; at least 1 line; `startDate` set | Sets `isApproved = true`; optionally triggers auto-dispatch | `agreement.approved` |
| DRAFT | CANCELLED | cancel() | -- | None (no financial impact) | -- |
| ACTIVE | CLOSED | close() | All items off-hired/returned; final charges generated | Sets status = CLOSED | `agreement.closed` |
| ACTIVE | CANCELLED | cancel() | No uninvoiced charges pending | Sets `cancelDate` | `agreement.cancelled` |

**Recurring Operations (while ACTIVE):**
1. Charge Agreement (batch) -- creates AgreementCharge records per billing period
2. Invoice from Agreement -- generates CustomerInvoice from uninvoiced charges
3. Off-Hire -- records item returns via OffHire entity

---

### 13.2 Contract (Subscription) Lifecycle

**Source:** Section 2.26 (Contracts & Agreements)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Contract being prepared | No | Default on creation |
| ACTIVE | Contract approved and running | No | Approval action |
| RENEWED | Contract replaced by a successor | Yes | Renewal action |
| CANCELLED | Contract cancelled | Yes | Cancel action |
| EXPIRED | Contract end date reached without renewal | Yes | Scheduled job |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| DRAFT | ACTIVE | approve() | Customer valid; at least 1 line; startDate/endDate/periodLength set | Sets `isApproved = true` | `contract.approved` |
| DRAFT | CANCELLED | cancel() | -- | None | -- |
| ACTIVE | RENEWED | renew() | -- | Creates new Contract record (copies lines, advances dates by periodLength); sets `renewedToContractId` on old, `renewedFromContractId` on new | `contract.renewed` |
| ACTIVE | EXPIRED | Scheduled expiry job | `endDate < today` and no renewal exists | -- | `contract.expired` |
| ACTIVE | CANCELLED | cancel() | No uninvoiced periods pending | -- | `contract.cancelled` |

**Batch Operations (while ACTIVE):**
1. Create Invoices -- generates CustomerInvoice per period
2. Renew Contracts -- extends with new Contract record
3. Update Contracts -- batch price/field changes

---

### 13.3 LoanAgreement Lifecycle

**Source:** Section 2.26 (Contracts & Agreements)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| NEW | Loan agreement created | No | Default on creation |
| APPROVED | Loan terms approved | No | Approval action |
| SIGNED | Contract signed; schedule generated | No | Sign action |
| ACTIVE | GL transaction created; loan is live | No | Activation |
| DISBURSED | Funds disbursed to borrower | No | Disbursement |
| PAUSED | Scheduled invoicing suspended | No | Pause action |
| CANCELLED | Loan cancelled (pre-activation only) | Yes | Cancel action |
| FINISHED | All schedule rows invoiced | Yes | Auto-complete |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| NEW | APPROVED | approve() | Customer set; `principalAmount > 0`; `interestRate` set; months > 0; `scheduleType` set | -- | `loan.approved` |
| APPROVED | SIGNED | sign() | -- | Generates repayment schedule (LoanScheduleRow records); algorithm based on `scheduleType` (annuity, linear, bullet, interest-only) | `loan.signed` |
| SIGNED | ACTIVE | activate() | -- | Creates GL Transaction (Dr loanAssetAccountCode, Cr arAccountCode for principalAmount); sets `activationJournalEntryId` | `loan.activated` |
| ACTIVE | DISBURSED | disburse() | -- | Creates Purchase Invoice (via AP) to disburse funds; creates Supplier record if needed | `loan.disbursed` |
| DISBURSED | PAUSED | pause() | -- | Suspends scheduled invoicing | `loan.paused` |
| PAUSED | DISBURSED | resume() | -- | Resumes scheduled invoicing | `loan.resumed` |
| DISBURSED | FINISHED | Auto (all rows invoiced) | All LoanScheduleRow records have `invoiceId` set | -- | `loan.finished` |
| NEW/APPROVED | CANCELLED | cancel() | No GL entries exist yet | -- | `loan.cancelled` |

**Diagram:**
```
  NEW ──► APPROVED ──► SIGNED ──► ACTIVE ──► DISBURSED ──┬──► FINISHED
    │         │                                           │
    └─► CANCELLED                                   PAUSED ◄──┘
                                                      │
                                                      └──► DISBURSED (resume)
```

---

## 14. Cross-Cutting State Machines

### 14.1 ApprovalRequest Lifecycle

**Source:** Section 2.20 (Cross-Cutting)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| PENDING | Awaiting approver decision | No | Default on creation |
| APPROVED | Approved by assignee | Yes (or escalates) | Approval action |
| REJECTED | Rejected by assignee | Yes | Rejection action |
| CANCELLED | Cancelled by original requester | Yes | Cancel action |
| ESCALATED | Escalated to higher level | Yes (creates new request) | Escalation action |
| FORWARDED | Forwarded to different approver | Yes (creates new request) | Forward action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events |
|------|----|---------|--------|--------------|--------|
| PENDING | APPROVED | Approver approves | Approver is the current assignee | If higher levels remain: creates new ApprovalRequest at next level (ESCALATED pattern). If no higher levels: marks entity as approved; emits completion | `approval.completed` or `approval.escalated` |
| PENDING | REJECTED | Approver rejects | `rejectionReason` provided | Stores rejection reason; notifies original requester | `approval.rejected` |
| PENDING | FORWARDED | Approver forwards | New assignee specified | Creates new ApprovalRequest at same level with new assignee | `approval.forwarded` |
| PENDING | CANCELLED | Original requester cancels | Only the requester can cancel | -- | `approval.cancelled` |
| PENDING | ESCALATED | Auto-escalation timeout | `autoEscalate = true` and request pending > `timeoutHours` | Escalates to next level (or times out if no further levels) | `approval.auto_escalated` |

---

### 14.2 Activity Status

**Source:** Section 2.20 (Cross-Cutting)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| PLANNED | Activity scheduled | No |
| IN_PROGRESS | Activity underway | No |
| COMPLETED | Activity finished | Yes |
| CANCELLED | Activity cancelled | Yes |

---

## 15. Service Orders Module State Machines

### 15.1 ServiceOrder Lifecycle

**Source:** Section 2.30 (Service Orders & Timekeeper)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| DRAFT | Service order being prepared | No | Default on creation |
| OPEN | Order open for work | No | Open action |
| IN_PROGRESS | Work underway | No | Work started |
| ON_HOLD | Temporarily paused | No | Hold action |
| COMPLETED | Work finished | No | Completion |
| INVOICED | Billed to customer | Yes | Invoice created |
| CANCELLED | Order cancelled | Yes | Cancel action |

---

### 15.2 WorkSheet Lifecycle

**Source:** Section 2.30 (Service Orders & Timekeeper)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| DRAFT | Being prepared | No |
| SUBMITTED | Submitted for approval | No |
| APPROVED | Approved | No |
| INVOICED | Billed | Yes |
| REJECTED | Rejected | No |

---

### 15.3 WorkOrder Lifecycle

**Source:** Section 2.30 (Service Orders & Timekeeper)

Work orders represent technician instructions linked to a service order. Each work order tracks the assignment and completion of specific repair or service tasks.

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| OPEN | Work order created; assigned to technician | No | Default on creation |
| IN_PROGRESS | Work underway; work sheets being recorded | No | Work started |
| CLOSED | Work complete | Yes | Close action |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| OPEN | IN_PROGRESS | Work started (e.g., first WorkSheet created against this WO) | -- | -- |
| IN_PROGRESS | CLOSED | close() | All linked WorkSheets must be APPROVED or INVOICED | Contributes to parent ServiceOrder completion check |

**Diagram:**
```
  OPEN ──► IN_PROGRESS ──► CLOSED
```

---

## 16. Warehouse Management Module State Machines

### 16.1 PickingList Lifecycle

**Source:** Section 2.27 (Warehouse Management)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| DRAFT | Picking list created | No |
| IN_PROGRESS | Items being picked | No |
| COMPLETED | All items picked | Yes |
| CANCELLED | Picking cancelled | Yes |

---

### 16.2 ForkliftTask Status

**Source:** Section 2.27 (Warehouse Management)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| PENDING | Task queued | No |
| SENT | Sent to forklift terminal | No |
| IN_PROGRESS | Being executed | No |
| COMPLETED | Task done | Yes |
| ERROR | Task failed | Yes |
| WAITING_CONVEYOR | Task from a conveyor position is held because another task is already pending from the same source (per BR-WMS-012) | No |

**Transitions (WAITING_CONVEYOR):**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| (new task) | WAITING_CONVEYOR | Task created from conveyor position | Another task is already PENDING from the same conveyor source (BR-WMS-007 rule 4) | Task is queued but not dispatched |
| WAITING_CONVEYOR | PENDING | Conflicting task completes or is cleared | No other PENDING task from the same conveyor source | Task enters normal dispatch queue |

---

### 16.3 BinPosition Lifecycle

**Source:** Section 2.27 (Warehouse Management), BR-WMS-002

Bin positions represent physical shelf/bin locations within a warehouse. Their status is driven by stock movements and forklift operations, reflecting whether the position currently holds stock.

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| FREE | Position is empty and available for stock placement | No | Default on creation; or all PositionStock quantities reach zero |
| OCCUPIED | Position holds stock (at least one PositionStock record with non-zero quantity) | No | First PositionStock created with non-zero quantity |
| RESERVED | Position assigned as destination of a pending stock movement or forklift task; goods not yet arrived | No | Pending movement/task targets this position |
| ERROR | Discrepancy detected (stock count mismatch, failed forklift operation) | No | Mismatch or failure event |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| FREE | OCCUPIED | Stock placed at position | PositionStock record created with non-zero quantity | Updates PositionStock |
| FREE | RESERVED | Position assigned as destination of pending stock movement or forklift task | Position is FREE and not closed | -- |
| RESERVED | OCCUPIED | Goods arrive at reserved position | Stock movement posted to this position | Updates PositionStock |
| OCCUPIED | FREE | Position fully emptied | All PositionStock.quantityRemaining at this position sum to zero | -- |
| Any | ERROR | Discrepancy detected | Stock count mismatch, serial number error, or failed forklift operation | Requires manual resolution |
| ERROR | FREE | Manual resolution | Operator resolves the discrepancy | Position cleared and available |

**Business Rules:**
- **BR-WMS-002:** Defines the strict status lifecycle for bin positions
- **BR-WMS-009:** A BinPosition can only be deleted if status = FREE and no PositionStock records reference it
- Special positions (goods receipt, production, wrapping, delivery) configured on WarehouseWmsConfig are exempt from automatic status changes

**Diagram:**
```
  FREE ──┬──► OCCUPIED ──► FREE (when fully emptied)
         │
         └──► RESERVED ──► OCCUPIED (goods arrive)

  Any state ──► ERROR ──► FREE (manual resolution only)
```

---

## 17. Communications Module State Machines

### 17.1 EmailMessage Status

**Source:** Section 2.29 (Communications)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| DRAFT | Email being composed | No |
| QUEUED | In send queue | No |
| SENT | Successfully sent | Yes |
| FAILED | Send failed | Yes |
| BOUNCED | Delivery bounced | Yes |

---

### 17.2 Notification Status

**Source:** Section 2.29 (Communications)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| PENDING | Not yet delivered | No |
| DELIVERED | Delivered to user | No |
| READ | User has read | Yes |
| DISMISSED | User dismissed | Yes |
| FAILED | Delivery failed | Yes |

---

## 18. Intercompany Module State Machines

### 18.1 IntercompanyTransaction Status

**Source:** Section 2.28 (Intercompany & Consolidation)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| INITIATED | Saga started; source journal posted | No |
| TARGET_PENDING | Awaiting target tenant processing | No |
| TARGET_POSTED | Target journal successfully posted | No |
| COMPLETED | Both sides confirmed | Yes |
| FAILED | Target posting failed; compensation needed | Yes |
| COMPENSATED | Source journal reversed after failure | Yes |
| CANCELLED | Manually cancelled by user | Yes |

**Transitions (CANCELLED):**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| INITIATED / TARGET_PENDING | CANCELLED | Manual cancellation by user | Transaction not yet COMPLETED | Reverses source journal if posted; cleans up pending target processing |

---

### 18.2 ConsolidationRun Status

**Source:** Section 2.28 (Intercompany & Consolidation)

**States:**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| IN_PROGRESS | Consolidation running | No |
| COMPLETED | Successfully completed | Yes |
| FAILED | Consolidation failed | Yes |

---

## 19. Document Understanding State Machines

### 19.1 DocumentIngestion Lifecycle

**Source:** Section 6.10 (AI Infrastructure — Document Understanding Pipeline)

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| PENDING | Document received, queued for processing | No | Default on creation (upload/email/camera) |
| PROCESSING | AI extraction in progress | No | Worker picks up from queue |
| EXTRACTED | Fields extracted, awaiting supplier/PO matching | No | Extraction completed successfully |
| MATCHED | Matched to supplier and/or PO, draft record created | No | Matching completed with sufficient confidence |
| REVIEW | Requires user review (low confidence, new supplier, or amount variance) | No | Auto-flagged by business rules or extraction confidence < 70% |
| APPROVED | User approved, ERP record created and posted | Yes | User approves extraction result |
| REJECTED | User rejected the extraction | Yes | User explicitly rejects |
| FAILED | Processing failed (unreadable, corrupt, unsupported) | Yes | Extraction service returns error |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events | Permissions |
|------|----|---------|--------|--------------|--------|-------------|
| PENDING | PROCESSING | Worker pickup | Queue not full; file passes virus scan | Sets `processingStartedAt` | `document.processing.started` | System |
| PROCESSING | EXTRACTED | Extraction complete | AI returns valid extraction result | Stores extraction result JSON with field-level confidence scores | `document.extraction.completed` | System |
| PROCESSING | FAILED | Extraction error | Document unreadable, corrupt, or unsupported format | Stores error details | `document.extraction.failed` | System |
| EXTRACTED | MATCHED | Matching complete | Supplier matched with confidence >= 70%; overall confidence >= 70% | Links to Supplier record; creates draft SupplierBill or Expense; links original as Attachment | `document.matching.completed` | System |
| EXTRACTED | REVIEW | Auto-flag | Confidence < 70% OR new supplier OR PO amount variance > 5% | Flags reason for review | `document.review.required` | System |
| MATCHED | APPROVED | User approval | User confirms extracted/matched data | Creates and posts SupplierBill or Expense; updates SupplierExtractionProfile if corrections made | `document.approved` | `ap.approve_bill` |
| MATCHED | REVIEW | User requests review | User wants to inspect/correct before approval | None | None | `ap.view_bill` |
| REVIEW | APPROVED | User approval with corrections | User corrects fields and approves | Creates ERP record; stores corrections; updates SupplierExtractionProfile for learning | `document.approved` | `ap.approve_bill` |
| REVIEW | REJECTED | User rejection | User determines document is invalid/duplicate | Stores rejection reason | `document.rejected` | `ap.view_bill` |
| FAILED | PENDING | Retry | User requests reprocessing (e.g., after re-upload) | Resets extraction result | `document.reprocessing` | `ap.create_bill` |

**Business Rules:**
- Documents with overall confidence < 70% are automatically routed to REVIEW
- New suppliers (no existing Supplier match) always route to REVIEW regardless of confidence
- PO-matched invoices with total amount variance > 5% from PO value route to REVIEW
- User corrections in REVIEW state update the SupplierExtractionProfile to improve future extractions
- Maximum file size: 10MB; supported formats: PDF, JPEG, PNG, TIFF
- Original document always stored as immutable Attachment — never modified or deleted after ingestion
- APPROVED creates exactly one ERP record (SupplierBill or Expense) — never both

**Diagram:**
```
  PENDING ──► PROCESSING ──┬──► EXTRACTED ──┬──► MATCHED ──┬──► APPROVED
                           │                │              │
                           └──► FAILED ◄────┘   ┌──► REVIEW ──┬──► APPROVED
                                │               │             │
                                └── Retry ──────┘             └──► REJECTED
```

---

## 20. Cross-Module Transition Dependencies

The following table documents which transitions in one module trigger transitions or side effects in another module.

| Source Module | Source Transition | Target Module | Target Effect |
|--------------|-------------------|---------------|---------------|
| **Sales Orders** | SalesOrder DRAFT -> APPROVED | **Inventory** | Creates StockReservation records; increments `quantityReserved` |
| **Sales Orders** | SalesOrder -> CANCELLED | **Inventory** | Releases StockReservation records; decrements `quantityReserved` |
| **Sales Orders** | Dispatch -> SHIPPED | **Inventory** | Creates `GOODS_ISSUE` StockMovement(s); decrements `quantityOnHand` |
| **Sales Orders** | Dispatch -> SHIPPED | **Finance** | Creates JournalEntry (Dr COGS, Cr Stock) via StockMovement GL posting |
| **Sales Orders** | SalesOrder FULLY_INVOICED | **AR** | CustomerInvoice created; updates `quantityInvoiced` on order lines |
| **Sales Quote** | Quote -> CONVERTED | **Sales Orders** | Creates SalesOrder with lines copied from quote |
| **Purchasing** | GRN -> POSTED | **Inventory** | Creates `GOODS_RECEIPT` StockMovement(s); increments `quantityOnHand`; updates costing |
| **Purchasing** | GRN -> POSTED | **Finance** | Creates JournalEntry (Dr Stock, Cr GRN Accrual) |
| **Purchasing** | SupplierBill -> POSTED | **Finance** | Creates JournalEntry (Dr Cost/Expense + VAT Input, Cr AP Control) |
| **Purchasing** | SupplierPayment -> COMPLETED | **Finance** | Creates JournalEntry (Dr AP Control, Cr Bank +/- FX) |
| **Purchasing** | SupplierPayment -> COMPLETED | **Purchasing** | Updates SupplierBill `paidAmount`/`outstandingAmount`; bill -> PAID if fully settled |
| **AR** | CustomerInvoice -> POSTED | **Finance** | Creates JournalEntry (Dr AR Control, Cr Revenue + VAT Output) |
| **AR** | CustomerPayment -> POSTED | **Finance** | Creates JournalEntry (Dr Bank, Cr AR Control) |
| **AR** | CustomerPayment -> POSTED | **AR** | Updates CustomerInvoice `paidAmount`/`outstandingAmount` |
| **Fixed Assets** | DepreciationEntry -> POSTED | **Finance** | Creates JournalEntry (Dr Depreciation Expense, Cr Accumulated Depreciation) |
| **Fixed Assets** | AssetDisposal -> POSTED | **Finance** | Creates JournalEntry for disposal gain/loss |
| **Fixed Assets** | AssetDisposal -> POSTED | **Fixed Assets** | Updates FixedAsset status to DISPOSED/WRITTEN_OFF |
| **Manufacturing** | Production -> STARTED (WIP) | **Finance** | Creates WIP JournalEntry (Dr WIP, Cr Stock) |
| **Manufacturing** | Production -> FINISHED | **Inventory** | Creates `PRODUCTION_OUT` and `PRODUCTION_IN` StockMovements |
| **Manufacturing** | Production -> FINISHED | **Finance** | Creates GL transaction (Dr Stock output, Cr Component Usage) |
| **CRM** | Lead -> CONVERTED | **AR** | Creates Customer record with data from lead |
| **CRM** | Opportunity -> WON | **Sales Orders** | Optionally creates SalesOrder |
| **CRM** | Opportunity -> WON/LOST | **CRM** | Creates CrmOpportunityStageLog entry |
| **Contracts** | LoanAgreement -> ACTIVE | **Finance** | Creates JournalEntry (Dr Loan Asset, Cr AR) |
| **Contracts** | Agreement -> ACTIVE | **Sales** | Optionally triggers auto-dispatch |
| **POS** | POSSale -> COMPLETED | **Finance** | Creates JournalEntry for the sale |
| **POS** | POSSale -> COMPLETED | **Inventory** | Creates stock movements (immediate or deferred) |
| **POS** | POSCashup -> POSTED | **Finance** | Creates JournalEntry for cash variances |
| **POS** | POSSale transfer | **AR** | Creates CustomerInvoice (type: CASH) with immediate payment |
| **HR/Payroll** | PayrollRun -> POSTED | **Finance** | Creates JournalEntry (Dr Payroll Expense, Cr Payroll Liability + Bank) |
| **HR/Payroll** | Employee -> TERMINATED | **HR** | Generates P45; cancels pending training plans |
| **Projects** | Timesheet -> APPROVED | **Projects** | Creates ProjectTransaction records |
| **Cross-Cutting** | ApprovalRequest -> APPROVED (final) | **Any Module** | Transitions the target entity to its approved state |
| **Service Orders** | WorkSheet APPROVED -> INVOICED | **AR** | Creates CustomerInvoice from approved worksheet lines (INVOICEABLE items only) |
| **Cross-Cutting** | Entity deletion | **Cross-Cutting** | Cascade cleanup of Attachments, Notes, RecordLinks, pending ApprovalRequests |
| **Document Understanding** | DocumentIngestion -> APPROVED | **Purchasing** | Creates SupplierBill (DRAFT, auto-created) or Expense record |
| **Document Understanding** | DocumentIngestion -> APPROVED | **Cross-Cutting** | Creates Attachment linked to created record |
| **Document Understanding** | DocumentIngestion -> APPROVED | **Document Understanding** | Updates SupplierExtractionProfile (learning from corrections) |

---

## Validation Report

**Validation Date:** 2026-02-16
**Validated By:** Claude Opus 4.6 (automated validation)
**Source Documents:** 18 arch-section files (2.13 through 2.30)

### 1. Enum Completeness

All `enum.*Status` patterns from the 18 arch-section files were compared against the state machine reference document. Results:

**DOCUMENTED (37 status enums covered):**
- JournalStatus (2.13) -- Section 2.1
- PeriodStatus (2.13) -- Section 2.2
- ReconciliationStatus (2.13) -- Section 2.3
- ReconciliationMatchStatus (2.13) -- Section 2.4
- BudgetStatus (2.13) -- Section 2.5
- SalesQuoteStatus (2.16) -- Section 3.1
- SalesOrderStatus (2.16) -- Section 3.2
- SalesOrderLineStatus (2.16) -- Section 3.3
- DispatchStatus (2.16) -- Section 3.4
- PurchaseOrderStatus (2.17) -- Section 4.1
- PurchaseOrderLineStatus (2.17) -- Section 4.2
- GoodsReceiptStatus (2.17) -- Section 4.3
- SupplierBillStatus (2.17) -- Section 4.4
- MatchStatus (2.17) -- Section 4.4 (parallel state)
- SupplierPaymentStatus (2.17) -- Section 4.5
- BacsRunStatus (2.17) -- Section 4.6
- InvoiceStatus (2.15) -- Section 5.1
- PaymentStatus (2.15) -- Section 5.2
- StockMovementStatus (2.14) -- Section 6.1
- SerialNumberStatus (2.14) -- Section 6.2
- FixedAssetStatus (2.18) -- Section 7.1
- DepreciationEntryStatus (2.18) -- Section 7.2
- AssetDisposalStatus (2.18) -- Section 7.3
- AssetTransferStatus (2.18) -- Section 7.4
- CrmLeadLifecycle (2.21) -- Section 8.1 (documented as CrmLead lifecycle)
- CrmCampaignStatus (2.21) -- Section 8.2
- CrmOpportunityStatus (2.21) -- Section 8.3
- EmployeeStatus (2.22) -- Section 9.1
- ContractStatus (2.22) -- Section 9.2
- PayrollRunStatus (2.22) -- Section 9.3
- LeaveRequestStatus (2.22) -- Section 9.4
- HMRCSubmissionStatus (2.22) -- Section 9.5
- ProductionOrderStatus (2.23) -- Section 10.1
- ProductionStatus (2.23) -- Section 10.2
- ProductionOperationStatus (2.23) -- Section 10.3
- ProductionPlanStatus (2.23) -- Section 10.4
- POSSessionStatus (2.24) -- Section 11.1
- POSSaleStatus (2.24) -- Section 11.2
- POSCashupStatus (2.24) -- Section 11.3
- ProjectStatus (2.25) -- Section 12.1
- TimesheetStatus (2.25) -- Section 12.2
- ProjectExpenseStatus (2.25) -- Section 12.3
- AgreementStatus (2.26) -- Section 13.1
- ContractStatus (2.26) -- Section 13.2
- LoanAgreementStatus (2.26) -- Section 13.3
- ApprovalStatus (2.20) -- Section 14.1
- ActivityStatus (2.20) -- Section 14.2
- ServiceOrderStatus (2.30) -- Section 15.1
- WorkSheetStatus (2.30) -- Section 15.2
- WorkOrderStatus (2.30) -- Section 15.3
- PickingListStatus (2.27) -- Section 16.1
- ForkliftTaskStatus (2.27) -- Section 16.2
- BinPositionStatus (2.27) -- Section 16.3
- EmailMessageStatus (2.29) -- Section 17.1
- NotificationStatus (2.29) -- Section 17.2
- IntercompanyTransactionStatus (2.28) -- Section 18.1
- ConsolidationRunStatus (2.28) -- Section 18.2

**REMAINING (formerly MISSING -- 3 MEDIUM items resolved, 12 LOW/NONE items remaining):**

| Enum | Source | Severity | Notes |
|------|--------|----------|-------|
| SupplierStatus | 2.17 | LOW | Reference entity; uses isActive + status flags (ACTIVE/ON_HOLD/BLOCKED/TERMINATED). Could be added to Section 1 soft-delete table or given its own lifecycle section. |
| POSTerminalStatus | 2.24 | LOW | Reference entity (ACTIVE/INACTIVE/MAINTENANCE). No transactional lifecycle. |
| POSSaleLineStatus | 2.24 | LOW | Simple active/voided flag (ACTIVE/VOIDED). Not a true lifecycle. |
| WorkOrderStatus | 2.30 | MEDIUM | Transactional lifecycle (OPEN/IN_PROGRESS/CLOSED). **RESOLVED: Added as Section 15.3.** |
| WarrantyStatus | 2.30 | LOW | Classification enum (UNKNOWN/UNDER_WARRANTY/OUT_OF_WARRANTY/EXPIRED/CONTRACT_COVERED), not a transition-based lifecycle. |
| BinPositionStatus | 2.27 | MEDIUM | Lifecycle (FREE/OCCUPIED/RESERVED/ERROR) driven by stock movements per BR-WMS-002. **RESOLVED: Added as Section 16.3.** |
| PickingLineStatus | 2.27 | LOW | Simple status (PENDING/PICKED/SHORT_PICKED/CANCELLED). Could be added alongside PickingList. |
| ConsolidationMemberStatus | 2.28 | LOW | Reference status (ACTIVE/SUSPENDED/REMOVED). Not a transactional lifecycle. |
| MaritalStatus | 2.22 | NONE | Classification enum, not a state machine. |
| JobPositionStatus | 2.22 | LOW | Reference lifecycle (OPENING/VACANT/FILLED/CANCELLED). |
| ChecklistItemStatus | 2.22 | LOW | Simple task tracking (PENDING/IN_PROGRESS/COMPLETED/NOT_APPLICABLE). |
| AppraisalStatus | 2.22 | LOW | Simple DRAFT/APPROVED lifecycle. |
| SkillsEvalStatus | 2.22 | LOW | Simple DRAFT/APPROVED/TERMINATED lifecycle. |
| TrainingStatus | 2.22 | LOW | Simple lifecycle (SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED/CLOSED). |
| HMRCSubmissionStatus | 2.22 | MEDIUM | Submission lifecycle (DRAFT/GENERATED/SUBMITTED/ACCEPTED/REJECTED/ERROR). Has regulatory significance. **RESOLVED: Added as Section 9.5.** |
| PensionEnrolmentStatus | 2.22 | LOW | Assessment classification, not a strict lifecycle. |
| EmailRecipientStatus | 2.29 | LOW | Per-recipient read tracking (UNREAD/READ/DELETED/ARCHIVED). |
| EmailQueueStatus | 2.29 | LOW | Queue processing states (PENDING/PROCESSING/SENT/FAILED/RETRYING). |
| ProjectTransactionStatus | 2.25 | LOW | Simple lifecycle (PENDING/APPROVED/INVOICED/WRITTEN_OFF). |
| ProjectInvoiceScheduleStatus | 2.25 | LOW | Simple lifecycle (PENDING/INVOICED/CANCELLED). |
| ProjectTaskStatus | 2.25 | LOW | Task tracking (NOT_STARTED/IN_PROGRESS/COMPLETED/CANCELLED). |
| AgreementChargeStatus | 2.26 | LOW | Simple flag (UNINVOICED/INVOICED). |
| OffHireStatus | 2.26 | LOW | Simple lifecycle (DRAFT/CONFIRMED/CANCELLED). |

**Assessment:** The document covers all major transactional state machines. The three former MEDIUM-severity omissions (WorkOrderStatus, BinPositionStatus, HMRCSubmissionStatus) have been resolved and added as Sections 15.3, 16.3, and 9.5 respectively. The remaining undocumented enums are predominantly reference entity statuses, classification enums, or simple two/three-state flags that do not require full state machine documentation.

### 2. Transition Accuracy (Spot Checks)

**8 state machines spot-checked against source arch-sections:**

**2.1 JournalEntry (vs 2.13-finance-gl.md):** PASS
- States DRAFT/POSTED/REVERSED match `JournalStatus` enum exactly.
- Transitions and guards match architecture (balanced entry, period lock).
- Side effects (currentBalance update, reversalOfId linking) accurately documented.

**2.2 FinancialPeriod (vs 2.13-finance-gl.md):** PASS
- States OPEN/CLOSED/LOCKED match `PeriodStatus` enum exactly.
- Bidirectional OPEN<->CLOSED correctly documented.
- LOCKED as terminal state correctly documented.

**3.2 SalesOrder (vs 2.16-sales-orders.md):** PASS
- All 9 states match `SalesOrderStatus` enum exactly.
- Complex multi-step transitions (DRAFT -> APPROVED -> IN_PROGRESS -> PARTIALLY_SHIPPED -> FULLY_SHIPPED -> PARTIALLY_INVOICED -> FULLY_INVOICED -> CLOSED) accurately trace the architecture.
- REQ-OR references correctly documented.
- Credit limit check (REQ-OR-005-008) correctly referenced in guards.

**4.3 GoodsReceipt (vs 2.17-purchasing-ap.md):** PASS
- States DRAFT/POSTED/CANCELLED match `GoodsReceiptStatus` enum exactly.
- GL posting pattern (Dr Stock, Cr GRN Accrual) correctly documented.
- Side effects (StockMovement creation, PO line quantity update, lastPurchasePrice update, StockBalance update) accurately captured.

**5.1 CustomerInvoice (vs 2.15-sales-ledger-ar.md):** PASS
- States DRAFT/APPROVED/POSTED/CANCELLED/VOID match `InvoiceStatus` enum exactly.
- Auto-approve threshold guard correctly documented.
- GL posting pattern (Dr AR Control, Cr Revenue + VAT Output) correctly documented.
- VOID creates reversal JE correctly documented.
- Payment tracking clarification (not a status change) correctly noted.

**8.1 CrmLead (vs 2.21-crm.md):** PASS WITH NOTE
- States NEW/CONTACTED/QUALIFIED/UNQUALIFIED/CONVERTED/LOST match `CrmLeadLifecycle` enum exactly.
- NOTE: The architecture uses `CrmLeadLifecycle` as the enum name (not `CrmLeadStatus`). The state machine reference correctly documents the states but developers should be aware of the enum naming.
- Business rules BR-CRM-003 through BR-CRM-006, BR-CRM-017 correctly documented.
- Conversion side effects (create Customer in AR, set convertedCustomerId) accurately captured.

**10.2 Production (vs 2.23-production-mrp.md):** PASS
- States CREATED/STARTED/FINISHED/CANCELLED/FINISHED_DISCARDED match `ProductionStatus` enum exactly.
- WIP GL posting on STARTED correctly documented (conditional on autoCreateWip).
- FINISHED side effects (stock movements, serial numbers, cost price updates) accurately captured.
- FINISHED_DISCARDED stock depreciation logic correctly documented.
- Un-OK (reversal) pattern correctly documented with UnOKAll permission requirement.

**13.3 LoanAgreement (vs 2.26-contracts-agreements.md):** PASS
- All 8 states (NEW/APPROVED/SIGNED/ACTIVE/DISBURSED/PAUSED/CANCELLED/FINISHED) match `LoanAgreementStatus` enum exactly.
- Schedule generation on SIGNED correctly documented.
- GL transaction on ACTIVE correctly documented.
- DISBURSED->PAUSED->DISBURSED bidirectional flow correctly documented.
- Auto-finish on all schedule rows invoiced correctly documented.

**Assessment:** All 8 spot-checked state machines accurately reflect the architecture. No state mismatches, no incorrect transitions, and side effects are faithfully documented.

### 3. Business Rule Coverage

All `BR-` prefixed rules from arch-section files were checked for state-transition relevance.

**State-transition BRs correctly documented:**
- BR-CRM-003, BR-CRM-004, BR-CRM-005, BR-CRM-006, BR-CRM-007, BR-CRM-008, BR-CRM-009, BR-CRM-011, BR-CRM-012, BR-CRM-013, BR-CRM-014, BR-CRM-017, BR-CRM-018 -- All present in Sections 8.1-8.3.
- BR-EMP-003, BR-EMP-004 -- Present in Section 9.1.
- BR-CTR-001, BR-CTR-002, BR-CTR-003, BR-CTR-004 -- Present in Section 9.2.
- BR-PAY-017, BR-PAY-018 -- Present in Section 9.3.
- BR-PAY-016 -- Referenced in Section 9.1 (Employee TERMINATED side effects).
- POS-001 through POS-005 -- Present in Sections 11.1-11.2.
- PRJ-002, PRJ-004, PRJ-006, PRJ-007 -- Present in Section 12.1.
- TS-004, TS-005, TS-006, TS-007, TS-008 -- Present in Section 12.2.
- INV-004 -- Referenced in Section 12.1 (ON_HOLD blocks invoicing).

**State-transition BRs NOT documented (potential gaps):**
| BR | Source | Description | Impact |
|----|--------|-------------|--------|
| BR-CTR-005 | 2.22 | Contract changes only from APPROVED | LOW -- implied by immutable overlay pattern mentioned |
| BR-CTR-007 | 2.22 | Termination cascades: close training plans, mark skills TERMINATED, auto-create OFFBOARDING checklist | MEDIUM -- cascade side effects not fully documented in Employee TERMINATED transition |
| BR-LEV-004 | 2.22 | Leave request cannot exceed remaining balance | LOW -- covered implicitly in LeaveRequest guards |
| BR-LEV-005 | 2.22 | Overlapping leave requests rejected | LOW -- guard condition not explicitly listed |
| BR-LEV-007/008 | 2.22 | Leave balance updates on approval/taken | LOW -- covered implicitly in side effects |
| BR-WMS-002 | 2.27 | BinPosition status lifecycle (FREE->OCCUPIED->RESERVED->ERROR) | MEDIUM -- BinPositionStatus not documented as a state machine |
| BR-COM-003 | 2.29 | Cannot un-send a queued/sent email | LOW -- EmailMessageStatus lifecycle is minimal |

**Assessment:** Coverage is good. The document captures the critical state-transition business rules. The few gaps are mostly cascade side effects (BR-CTR-007) and validation guards that are implied but not explicitly stated.

### 4. Cross-Module Dependencies (Section 19)

Verified against key end-to-end flows:

**Order-to-Cash flow:** PASS
- SalesOrder APPROVED -> Inventory (StockReservation) -- documented
- Dispatch SHIPPED -> Inventory (GOODS_ISSUE StockMovement) -- documented
- Dispatch SHIPPED -> Finance (COGS/Stock JE) -- documented
- SalesOrder FULLY_INVOICED -> AR (CustomerInvoice) -- documented
- CustomerInvoice POSTED -> Finance (AR Control/Revenue JE) -- documented
- CustomerPayment POSTED -> Finance (Bank/AR Control JE) -- documented
- CustomerPayment POSTED -> AR (Invoice paidAmount update) -- documented
- Quote CONVERTED -> SalesOrders (creates SalesOrder) -- documented

**Procure-to-Pay flow:** PASS
- GRN POSTED -> Inventory (GOODS_RECEIPT StockMovement) -- documented
- GRN POSTED -> Finance (Stock/GRN Accrual JE) -- documented
- SupplierBill POSTED -> Finance (Cost+VAT/AP Control JE) -- documented
- SupplierPayment COMPLETED -> Finance (AP Control/Bank JE) -- documented
- SupplierPayment COMPLETED -> Purchasing (Bill paidAmount update) -- documented

**Manufacturing flow:** PASS
- Production STARTED (WIP) -> Finance (WIP JE) -- documented
- Production FINISHED -> Inventory (PRODUCTION_OUT/IN StockMovements) -- documented
- Production FINISHED -> Finance (Stock output/Component Usage JE) -- documented

**CRM flow:** PASS
- Lead CONVERTED -> AR (creates Customer) -- documented
- Opportunity WON -> Sales Orders (optionally creates SalesOrder) -- documented

**HR/Payroll flow:** PASS
- PayrollRun POSTED -> Finance (Payroll Expense/Liability JE) -- documented
- Employee TERMINATED -> HR (P45, training plan cancellation) -- documented

**Missing cross-module dependencies:**
| Source | Transition | Target | Effect | Severity |
|--------|-----------|--------|--------|----------|
| Contracts | Contract ACTIVE | AR | Creates periodic CustomerInvoices (batch operation) | LOW -- documented as "Batch Operations" in Section 13.2, not in Section 19 table |
| Service Orders | WorkSheet APPROVED -> INVOICED | AR | Creates CustomerInvoice from approved worksheets | MEDIUM -- **RESOLVED: Added to Section 19** |
| Projects | ProjectExpense APPROVED -> INVOICED | AR | Creates CustomerInvoice from approved expenses | LOW -- implied by Section 12.3 text |

**Assessment:** The cross-module dependency table is comprehensive and accurate. Two minor omissions noted (Service Orders -> AR invoicing, Contract batch invoicing in Section 19 table).

### 5. Section Coverage

All 18 arch-section files checked for corresponding sections:

| Arch Section | File | State Machine Reference Section | Covered? |
|-------------|------|-------------------------------|----------|
| 2.13 | finance-gl.md | Section 2 (Finance) | YES |
| 2.14 | inventory.md | Section 6 (Inventory) | YES |
| 2.15 | sales-ledger-ar.md | Section 5 (AR) | YES |
| 2.16 | sales-orders.md | Section 3 (Sales) | YES |
| 2.17 | purchasing-ap.md | Section 4 (Purchasing & AP) | YES |
| 2.18 | fixed-assets.md | Section 7 (Fixed Assets) | YES |
| 2.19 | pricing.md | N/A | CORRECT -- No status enums; reference-only module |
| 2.20 | cross-cutting.md | Section 14 (Cross-Cutting) | YES |
| 2.21 | crm.md | Section 8 (CRM) | YES |
| 2.22 | hr-payroll.md | Section 9 (HR/Payroll) | YES |
| 2.23 | production-mrp.md | Section 10 (Manufacturing) | YES |
| 2.24 | pos.md | Section 11 (POS) | YES |
| 2.25 | projects-job-costing.md | Section 12 (Projects) | YES |
| 2.26 | contracts-agreements.md | Section 13 (Contracts & Agreements) | YES |
| 2.27 | warehouse-management.md | Section 16 (Warehouse Management) | YES |
| 2.28 | intercompany-consolidation.md | Section 18 (Intercompany) | YES |
| 2.29 | communications.md | Section 17 (Communications) | YES |
| 2.30 | service-orders-timekeeper.md | Section 15 (Service Orders) | YES |

**Assessment:** Full coverage. All 18 arch-section files have corresponding sections. Section 2.19 (Pricing) correctly has no state machine section as it contains no status enums.

### 6. Additional Findings

**6.1 ForkliftTaskStatus discrepancy:** The architecture (2.27) defines 6 states: PENDING, SENT, IN_PROGRESS, COMPLETED, ERROR, WAITING_CONVEYOR. The state machine reference (Section 16.2) originally documented only 5 states. **RESOLVED: WAITING_CONVEYOR has been added to Section 16.2 with transition details per BR-WMS-007 and BR-WMS-012.**

**6.2 IntercompanyTransactionStatus discrepancy:** The architecture (2.28) defines 7 states including CANCELLED. The state machine reference (Section 18.1) originally documented only 6 states. **RESOLVED: CANCELLED has been added to Section 18.1 as a terminal state with manual cancellation transition.**

**6.3 CrmLeadLifecycle vs "Status" naming:** The architecture uses `CrmLeadLifecycle` as the Prisma enum name and `lifecycle` as the field name (not `status`). The document correctly documents the lifecycle values but developers should note the enum/field naming distinction from the pattern used by other entities.

**6.4 Diagram completeness:** The document includes ASCII diagrams for all major state machines. Minor observation: the SalesOrder diagram (Section 3.2) shows a simplified linear flow and does not show the CANCELLED state as reachable from APPROVED, which is documented in the transition table. The transition table is authoritative and correct.

---

### Overall Assessment: **PASS WITH WARNINGS**

**Summary:**
- **Enum completeness:** 37 of 56 total status enums documented (up from 34 after adding WorkOrderStatus, BinPositionStatus, HMRCSubmissionStatus). All major transactional lifecycles covered. 3 former MEDIUM-severity omissions now resolved.
- **Transition accuracy:** 8/8 spot-checked state machines are accurate. States, transitions, guards, side effects, and events all match the architecture.
- **Business rule coverage:** All critical state-transition BRs documented. One MEDIUM gap (BR-CTR-007 termination cascade side effects).
- **Cross-module dependencies:** Comprehensive and accurate. Service Orders -> AR dependency added. 1 minor omission remaining (Contract batch -> AR in dependency table).
- **Section coverage:** 18/18 arch-section files represented. Full coverage.
- **Former discrepancies resolved:** WAITING_CONVEYOR added to ForkliftTaskStatus, CANCELLED added to IntercompanyTransactionStatus.

**Recommended actions before implementation (status):**
1. ~~Add WorkOrderStatus (2.30) as a state machine section~~ -- **DONE: Added as Section 15.3.**
2. ~~Add BinPositionStatus (2.27) as a state machine section~~ -- **DONE: Added as Section 16.3.**
3. ~~Add WAITING_CONVEYOR to ForkliftTaskStatus states in Section 16.2~~ -- **DONE.**
4. ~~Add CANCELLED to IntercompanyTransactionStatus states in Section 18.1~~ -- **DONE.**
5. Document BR-CTR-007 termination cascade side effects in Section 9.1 (Employee TERMINATED). -- OPEN (low priority)
6. ~~Add Service Orders WorkSheet -> AR (CustomerInvoice creation) to Section 19 cross-module dependency table~~ -- **DONE.**
7. ~~Add HMRCSubmissionStatus (2.22) as a state machine section~~ -- **DONE: Added as Section 9.5.**

---

## 20. Platform Admin State Machines (Section 2.31)

> These state machines operate in the **Platform database**, NOT in tenant ERP databases. They govern tenant lifecycle, billing enforcement, and AI quota management.

### 20.1 Tenant Lifecycle

**Source:** Architecture §2.31, BR-PLT-001 through BR-PLT-003

**States:**

| Status | Description | Terminal? | Entry Conditions |
|--------|-------------|-----------|------------------|
| PROVISIONING | Database being created and seeded | No | Tenant creation initiated |
| ACTIVE | Tenant fully operational | No | Provisioning complete, or reactivated from SUSPENDED |
| SUSPENDED | Tenant access blocked (manual or billing enforcement) | No | Manual suspension or billing enforcement escalation |
| READ_ONLY | Tenant can view data but not write (billing enforcement) | No | Billing enforcement action |
| ARCHIVED | Soft-deleted, irrecoverable from UI | Yes | Archived from SUSPENDED state |

**Transitions:**

| From | To | Trigger | Guards | Side Effects | Events | Permissions |
|------|----|---------|--------|--------------|--------|-------------|
| PROVISIONING | ACTIVE | Provisioning complete | DB created, migrations applied, seed data loaded | Sets `lastActivityAt` | `tenant.created` | System (automated) |
| ACTIVE | SUSPENDED | Manual suspend or billing enforcement | Must be ACTIVE | Pushes `tenant.suspended` webhook to ERP (cache bust). Blocks all ERP login/write. | `tenant.suspended` | PLATFORM_ADMIN |
| ACTIVE | READ_ONLY | Billing enforcement (grace expired) | Must be ACTIVE, billing dunning level >= threshold | Pushes `billing.enforcement_changed` webhook. ERP blocks writes, shows billing notice. | `billing.enforcement_changed` | System (automated) or PLATFORM_ADMIN |
| READ_ONLY | ACTIVE | Payment received or manual override | Payment confirmed or admin action | Pushes webhook, clears enforcement. | `tenant.reactivated` | PLATFORM_ADMIN or System |
| READ_ONLY | SUSPENDED | Further billing escalation or manual | Dunning level >= hard threshold | Pushes `tenant.suspended` webhook. | `tenant.suspended` | System or PLATFORM_ADMIN |
| SUSPENDED | ACTIVE | Reactivate | Must be SUSPENDED, billing resolved or admin override | Pushes `tenant.reactivated` webhook. Clears enforcement. | `tenant.reactivated` | PLATFORM_ADMIN |
| SUSPENDED | ARCHIVED | Archive | Must be SUSPENDED | Data retained for regulatory compliance. No UI recovery. | `tenant.archived` | PLATFORM_ADMIN |

**Diagram:**
```
  PROVISIONING ──► ACTIVE ◄──── Reactivate ──── SUSPENDED ──── Archive ──► ARCHIVED
                     │  ▲                            ▲
                     │  │                            │
                     │  └── Payment/Override ──┐     │
                     │                         │     │
                     └── Billing ──► READ_ONLY ─┴─── Escalate
```

### 20.2 Billing Enforcement Lifecycle

**Source:** Architecture §2.31, BR-PLT-004 through BR-PLT-006

**States (EnforcementAction on TenantBilling):**

| Status | Description | ERP Impact |
|--------|-------------|------------|
| NONE | Normal operation, billing current | No restrictions |
| WARNING | Payment overdue, grace period active | Warning banner in ERP |
| READ_ONLY | Grace period expired, writes blocked | All create/update/delete blocked. View-only. Billing notice on every page. |
| SUSPENDED | Hard stop, full access revoked | Login blocked. Data inaccessible. |

**Transitions:**

| From | To | Trigger | Guards | Side Effects |
|------|----|---------|--------|--------------|
| NONE | WARNING | Payment fails or becomes overdue | dunningLevel >= 1 | ERP webhook: show warning banner |
| WARNING | NONE | Payment received | Payment confirmed | ERP webhook: clear warning |
| WARNING | READ_ONLY | Grace period expires | gracePeriodDays exceeded | ERP webhook: block writes, show billing notice |
| READ_ONLY | WARNING | Partial payment or admin override | Admin action | ERP webhook: allow writes, show warning |
| READ_ONLY | NONE | Full payment received | All outstanding cleared | ERP webhook: clear all restrictions |
| READ_ONLY | SUSPENDED | Further non-payment or admin action | dunningLevel >= hardThreshold | ERP webhook + tenant status change to SUSPENDED |
| SUSPENDED | NONE | Full payment + admin reactivation | Payment confirmed + admin approval | Tenant reactivated, all restrictions cleared |

**Diagram:**
```
  NONE ◄── Payment ── WARNING ◄── Override ── READ_ONLY ◄── Payment ── SUSPENDED
    │                    │                        │                        │
    └── Overdue ────────►└── Grace expired ──────►└── Escalation ─────────►│
```

### 20.3 AI Quota State (Runtime)

**Source:** Architecture §2.31, BR-PLT-007 through BR-PLT-011

This is not a persisted state machine but a runtime calculation based on `tokensUsed / tokenAllowance` percentage:

| Threshold | State | ERP Behaviour |
|-----------|-------|---------------|
| 0-49% | NORMAL | AI calls proceed normally |
| 50% (configurable) | ALERT_50 | Platform admin notified. No tenant impact. |
| 80% (configurable, softLimitPct) | SOFT_LIMIT | `tenant.quota_warning` event. ERP shows "Approaching AI limit" banner to tenant admin. |
| 100% (configurable, hardLimitPct) | HARD_LIMIT | If `aiHardLimit = true`: AI calls blocked with `AI_QUOTA_EXCEEDED`. If false: overage logged, calls continue. |
| >100% + spike detection | ANOMALY | If daily usage > 3x rolling 7-day average: platform admin alert for investigation. |

---

*End of State Machine Reference*
