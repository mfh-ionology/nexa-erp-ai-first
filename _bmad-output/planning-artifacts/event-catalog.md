# Nexa ERP -- Event Catalog

_Comprehensive reference of all domain events emitted and consumed across the Nexa ERP modular monolith. Every dev agent building a module should consult this catalog to know exactly which events they publish and subscribe to._

**Source:** Extracted from `architecture.md` sections 2.1--8 and `arch-sections/2.13--2.30`.

**Last updated:** 2026-02-19

---

## Overview

Nexa ERP uses an **in-process typed event bus** (implemented as a TypeScript `EventBus` class in `api/src/core/events/event-bus.ts`) for all cross-module communication within the modular monolith. Every business state change emits an event that other modules can subscribe to, enabling loose coupling between domain modules.

Key design properties:

- **In-process for MVP** -- Node.js EventEmitter-based. No external message broker required.
- **Typed via TypeScript** -- All events are defined in `BusinessEvents` interface (`api/src/core/events/event-bus.types.ts`). Type-safe emit and subscribe.
- **Future migration path** -- Replace with Redis Streams or NATS when moving to distributed architecture. Event interface stays the same.
- **BullMQ for async jobs** -- Long-running side effects (email sending, PDF generation, bank feed sync) are dispatched as BullMQ jobs from event handlers, not executed inline.
- **Cross-module rule** -- Modules must NEVER call another module's service directly. All cross-module side effects flow through the event bus.

---

## Event Naming Convention

| Convention | Format | Example |
|-----------|--------|---------|
| Event name | `{entity}.{action}` (lowercase, dot-separated) | `invoice.created`, `invoice.approved`, `payment.received` |
| Action verbs | Past tense (events describe what happened) | `created`, `updated`, `approved`, `posted`, `cancelled`, `voided` |
| Payload | Typed interface, includes entity ID + relevant IDs | `{ invoiceId, customerId, amount, currency }` |

**File locations per module:**
```
api/src/modules/{module}/events/{entity}.events.ts   -- Event handlers (subscribers)
api/src/core/events/event-bus.ts                      -- Event bus implementation
api/src/core/events/event-bus.types.ts                -- BusinessEvents interface (all event types)
```

---

## Module Index

| # | Module | Section | Published Events | Subscribed Events |
|---|--------|---------|-----------------|-------------------|
| 1 | Finance / GL | 2.13 | 5 | 6 |
| 2 | Inventory | 2.14 | 5 | 4 |
| 3 | Accounts Receivable (AR) | 2.15 | 6 | 2 |
| 4 | Sales Orders | 2.16 | 7 | 1 |
| 5 | Purchasing / AP | 2.17 | 7 | 2 |
| 6 | Fixed Assets | 2.18 | 4 | 1 |
| 7 | CRM | 2.21 | 5 | 5 |
| 8 | HR / Payroll | 2.22 | 4 | 1 |
| 9 | Manufacturing / MRP | 2.23 | 5 | 2 |
| 10 | POS | 2.24 | 3 | 1 |
| 11 | Projects / Job Costing | 2.25 | 2 | 2 |
| 12 | Contracts / Agreements | 2.26 | 14 | 1 |
| 13 | Intercompany / Consolidation | 2.28 | 2 | 1 |
| 14 | Communications / Notifications | 2.29 | 2 | ALL |
| 15 | Cross-Cutting (Approval, Audit) | 2.20 | 6 | ALL |
| 16 | System | 2.10 | 2 | 0 |
| 17 | AI Orchestration | 6.x | 1 | ALL |
| 18 | Document Understanding | `document.*` | `api/src/modules/document-processing/` | FR164-FR168 |
| 19 | Platform Admin | 2.31 | 10 | 0 |
| 20 | Access Groups (RBAC) | E2b | 6 | 0 |
| **Total** | | | **~113** | |

---

## 1. Finance / GL Events

**Module path:** `api/src/modules/finance/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `journal.posted` | JournalEntry status transitions from DRAFT to POSTED | `{ journalEntryId: string; entryNumber: string; source: JournalSource; sourceId?: string; sourceReference?: string; transactionDate: Date; periodId: string; totalAmount: Decimal; lineCount: number; createdBy: string }` | Finance (balance recalculation), Audit (log), AI Context (update context) |
| `journal.reversed` | JournalEntry is reversed (creates contra entry) | `{ journalEntryId: string; reversalEntryId: string; originalSource: JournalSource; sourceReference?: string; createdBy: string }` | Finance (balance recalculation), Audit (log) |
| `period.locked` | FinancialPeriod status set to LOCKED | `{ periodId: string; year: number; periodNumber: number; lockedBy: string }` | All financial modules (enforce period lock checks), Audit (log) |
| `period.unlocked` | FinancialPeriod status reverted to OPEN from LOCKED | `{ periodId: string; year: number; periodNumber: number; unlockedBy: string }` | All financial modules, Audit (log) |
| `bank.transactions.imported` | Batch of BankTransaction records created from CSV/OFX/Open Banking | `{ bankAccountId: string; importBatchId: string; importSource: BankImportSource; transactionCount: number; totalAmount: Decimal }` | AI Bank Matcher agent (auto-match), Notifications (alert user) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `invoice.posted` | AR | Creates GL journal entry (DR AR_CONTROL, CR SALES_REVENUE + VAT_OUTPUT) |
| `invoice.voided` | AR | Creates reversal GL journal entry |
| `payment.posted` | AR | Creates GL journal entry (DR Bank, CR AR_CONTROL) |
| `bill.posted` | AP | Creates GL journal entry (DR PURCHASE_EXPENSE + VAT_INPUT, CR AP_CONTROL) |
| `supplier.payment.posted` | AP | Creates GL journal entry (DR AP_CONTROL, CR Bank) |
| `stock.movement.posted` | Inventory | Creates GL journal entry (DR/CR Stock, COGS, Variance per movement type) |

---

## 2. Inventory Events

**Module path:** `api/src/modules/inventory/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `stock.movement.posted` | StockMovement status transitions from DRAFT to POSTED | `{ movementId: string; movementNumber: string; movementType: StockMovementType; itemId: string; warehouseId: string; quantity: Decimal; unitCost: Decimal; totalCost: Decimal; sourceType?: StockMovementSourceType; sourceId?: string }` | Finance (GL posting), AI Context (update stock levels) |
| `stock.movement.reversed` | StockMovement reversed (contra movement created) | `{ movementId: string; reversalMovementId: string; itemId: string; warehouseId: string; quantity: Decimal }` | Finance (reverse GL posting) |
| `stock.balance.updated` | StockBalance record updated (quantity or value changed) | `{ itemId: string; warehouseId: string; quantityOnHand: Decimal; quantityAvailable: Decimal; costValue: Decimal }` | AI Reorder Advisor (check reorder point), Sales Orders (availability checks) |
| `stock.reorder.triggered` | StockBalance.quantityOnHand falls below InventoryItem.reorderPoint | `{ itemId: string; itemCode: string; itemName: string; warehouseId: string; currentQuantity: Decimal; reorderPoint: Decimal; reorderQuantity: Decimal }` | AI Reorder Advisor agent (suggest PO), Notifications (alert purchasing team) |
| `stock.valuation.changed` | Item costing recalculated (WAC update, standard cost change) | `{ itemId: string; costingMethod: CostingMethod; previousCost: Decimal; newCost: Decimal; trigger: string }` | AI Context (flag significant cost changes) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `goods.receipt.posted` | Purchasing | Creates GOODS_RECEIPT stock movements, updates StockBalance, recalculates WAC/lastPurchasePrice |
| `dispatch.shipped` | Sales | Creates GOODS_ISSUE stock movements, updates StockBalance |
| `production.finished` | Manufacturing | Creates PRODUCTION_IN (output) and PRODUCTION_OUT (consumption) stock movements |
| `production.started` | Manufacturing | If autoCreateWip enabled, creates stock reservations for input materials |

---

## 3. Accounts Receivable (AR) Events

**Module path:** `api/src/modules/ar/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `invoice.created` | CustomerInvoice created (status = DRAFT) | `{ invoiceId: string; invoiceNumber: string; customerId: string; amount: Decimal; currencyCode: string; invoiceType: InvoiceType }` | AI Context (update customer context), CRM (auto-create activity if rule configured) |
| `invoice.approved` | CustomerInvoice status transitions from DRAFT to APPROVED | `{ invoiceId: string; invoiceNumber: string; customerId: string; totalAmount: Decimal; journalEntryId?: string }` | Finance (GL posting -- on POSTED, not APPROVED, see below), Audit (log), Notifications (notify accountant), CRM (auto-activity) |
| `invoice.posted` | CustomerInvoice status transitions from APPROVED to POSTED | `{ invoiceId: string; invoiceNumber: string; customerId: string; totalAmount: Decimal; journalEntryId: string; periodId: string }` | Finance (creates GL journal entry), Audit (log), AI Context (update outstanding balance), Communications (queue email to customer if auto-send) |
| `invoice.voided` | CustomerInvoice status transitions from POSTED to VOID | `{ invoiceId: string; invoiceNumber: string; customerId: string; reversalJournalEntryId: string }` | Finance (creates reversal GL journal entry), Audit (log) |
| `invoice.overdue` | Scheduled job detects invoice past due date with outstanding balance > 0 | `{ invoiceId: string; invoiceNumber: string; customerId: string; daysOverdue: number; outstandingAmount: Decimal }` | AI Daily Briefing, Notifications (send reminder if customer.sendReminders = true), CRM (auto-create follow-up activity) |
| `payment.posted` | CustomerPayment status transitions from DRAFT to POSTED | `{ paymentId: string; paymentNumber: string; customerId: string; amount: Decimal; allocations: Array<{ invoiceId: string; amount: Decimal }> }` | Finance (creates GL journal entry -- DR Bank, CR AR_CONTROL), Audit (log), AI Context (update customer balance), CRM (PAYMENT_RECEIVED auto-activity trigger) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `sales.order.invoiced` | Sales | Creates CustomerInvoice from sales order lines, links via salesOrderId |
| `pos.sale.transferred` | POS | Creates CustomerInvoice (type = CASH) from POS sale |

---

## 4. Sales Orders Events

**Module path:** `api/src/modules/sales/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `quote.created` | SalesQuote created (status = DRAFT) | `{ quoteId: string; quoteNumber: string; customerId: string; totalAmount: Decimal }` | CRM (auto-activity if rule configured) |
| `quote.sent` | SalesQuote status transitions to SENT | `{ quoteId: string; quoteNumber: string; customerId: string }` | Communications (email to customer), CRM (auto-activity) |
| `quote.accepted` | SalesQuote status transitions to ACCEPTED | `{ quoteId: string; quoteNumber: string; customerId: string }` | CRM (update opportunity if linked), Notifications |
| `quote.converted` | SalesQuote converted to SalesOrder (status = CONVERTED) | `{ quoteId: string; orderId: string; quoteNumber: string; orderNumber: string; customerId: string }` | CRM (update opportunity.salesOrderId) |
| `order.confirmed` | SalesOrder status transitions from DRAFT to APPROVED | `{ orderId: string; orderNumber: string; customerId: string; lineItems: Array<{ itemId: string; quantity: Decimal; warehouseId?: string }>; totalAmount: Decimal }` | Inventory (stock availability check / reservation), AR (credit limit check), CRM (SALES_ORDER_APPROVED auto-activity), Notifications |
| `dispatch.shipped` | Dispatch status transitions to SHIPPED | `{ dispatchId: string; orderId: string; orderNumber: string; customerId: string; lines: Array<{ itemId: string; quantity: Decimal; warehouseId: string }> }` | Inventory (creates GOODS_ISSUE stock movements), Communications (shipping notification), AI Context |
| `sales.order.invoiced` | Invoice creation triggered from a fully/partially shipped order | `{ orderId: string; orderNumber: string; invoiceId: string; invoiceNumber: string; customerId: string }` | AR (invoice creation), Sales (update quantityInvoiced on order lines) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `quote.expired` | Scheduled job (BullMQ cron) | Updates SalesQuote status to EXPIRED when validUntilDate < today and status = SENT |

---

## 5. Purchasing / AP Events

**Module path:** `api/src/modules/purchasing/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `purchase.order.approved` | PurchaseOrder status transitions from DRAFT to APPROVED | `{ orderId: string; orderNumber: string; supplierId: string; totalAmount: Decimal }` | Notifications (notify purchasing manager), Audit (log) |
| `purchase.order.sent` | PurchaseOrder sent to supplier (email/PDF) | `{ orderId: string; orderNumber: string; supplierId: string }` | Communications (email to supplier with PO PDF attachment) |
| `goods.receipt.posted` | GoodsReceipt status transitions to POSTED | `{ receiptId: string; receiptNumber: string; orderId: string; supplierId: string; lines: Array<{ itemId: string; quantity: Decimal; unitCost: Decimal; warehouseId: string }> }` | Inventory (creates GOODS_RECEIPT stock movements), Finance (GL: DR Stock, CR GRN Accrual), Purchasing (update PO quantityReceived) |
| `bill.posted` | SupplierBill status transitions from APPROVED to POSTED | `{ billId: string; billNumber: string; supplierId: string; totalAmount: Decimal; journalEntryId: string; periodId: string }` | Finance (creates GL journal entry -- DR Cost + VAT_INPUT, CR AP_CONTROL), Audit (log), AI Context |
| `bill.voided` | SupplierBill voided after posting | `{ billId: string; billNumber: string; supplierId: string; reversalJournalEntryId: string }` | Finance (reversal GL journal entry), Audit (log) |
| `supplier.payment.posted` | SupplierPayment status transitions to COMPLETED | `{ paymentId: string; paymentNumber: string; supplierId: string; amount: Decimal; bankAccountId: string; allocations: Array<{ billId: string; amount: Decimal }> }` | Finance (GL: DR AP_CONTROL, CR Bank), Audit (log), AI Context |
| `bacs.run.submitted` | BacsRun submitted to bank (file generated) | `{ bacsRunId: string; fileReference: string; paymentCount: number; totalAmount: Decimal }` | Notifications (confirm to finance team), Audit (log) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `stock.reorder.triggered` | Inventory | Surfaces reorder suggestion to purchasing team (via AI agent or notification) |
| `intercompany.po.created` | Intercompany | Creates PurchaseOrder in target tenant from intercompany transaction |

---

## 6. Fixed Assets Events

**Module path:** `api/src/modules/fixed-assets/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `asset.acquired` | FixedAsset created/acquired (linked to PO or manual entry) | `{ fixedAssetId: string; assetCode: string; purchaseValue: Decimal; acquiredDate: Date; departmentCode?: string }` | Finance (GL: DR Asset account, CR Bank/AP), Audit (log) |
| `depreciation.run.completed` | Monthly depreciation batch job completes for a period | `{ periodId: string; assetCount: number; totalAmount: Decimal; journalEntryId: string }` | Finance (GL entries already created inline), Audit (log), AI Daily Briefing |
| `depreciation.entry.posted` | Individual asset depreciation entry posted within a run | `{ fixedAssetId: string; assetCode: string; amount: Decimal; periodId: string; newBookValue: Decimal }` | Finance (GL: DR DEPRECIATION_EXPENSE, CR ACCUMULATED_DEPRECIATION) |
| `asset.disposed` | FixedAsset disposed (sold, scrapped, written off, traded in) | `{ fixedAssetId: string; assetCode: string; disposalType: string; proceedsAmount: Decimal; bookValueAtDisposal: Decimal; gainOrLoss: Decimal }` | Finance (GL: DR Bank/loss, CR Asset account + accumulated depreciation, +/- gain/loss), Audit (log) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `goods.receipt.posted` | Purchasing | If PO line references a fixed asset category, creates FixedAsset record from GRN |

---

## 7. CRM Events

**Module path:** `api/src/modules/crm/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `lead.converted` | CrmLead lifecycle transitions to CONVERTED (customer created) | `{ leadId: string; customerId: string; convertedBy: string }` | AR (Customer record already created inline), Audit (log), AI Context |
| `opportunity.won` | CrmOpportunity status changes to WON | `{ opportunityId: string; customerId: string; estimatedValue: Decimal; salesPersonId?: string; salesQuoteId?: string }` | AI Daily Briefing, Notifications (celebrate win), Reporting (pipeline analytics) |
| `opportunity.lost` | CrmOpportunity status changes to LOST | `{ opportunityId: string; customerId: string; lossReason: string; salesPersonId?: string }` | AI Daily Briefing, Reporting (pipeline analytics) |
| `campaign.activated` | CrmCampaign status transitions from DRAFT to ACTIVE | `{ campaignId: string; campaignName: string; recipientCount: number }` | CRM (creates follow-up activities for campaign recipients), Communications (trigger email sends) |
| `activity.created` | Activity record created (manual or auto-created from rule) | `{ activityId: string; activityType: string; entityType: string; entityId: string; assignedToId: string; isAutoCreated: boolean }` | AI Context (update user activity feed) |

### Subscribed Events (via CrmActivityAutoRule)

The CRM module subscribes to the following events via configurable auto-creation rules (`CrmActivityAutoRule`). Each trigger maps to a `CrmActivityAutoTrigger` enum value:

| Event Name | Trigger Enum | Source Module | Handler Action |
|------------|-------------|---------------|----------------|
| `order.confirmed` | `SALES_ORDER_CREATED` / `SALES_ORDER_APPROVED` | Sales | Auto-creates Activity linked to SalesOrder |
| `invoice.posted` | `INVOICE_POSTED` | AR | Auto-creates Activity linked to CustomerInvoice |
| `payment.posted` | `PAYMENT_RECEIVED` | AR | Auto-creates Activity linked to CustomerPayment |
| `opportunity.won` | `OPPORTUNITY_WON` | CRM (self) | Auto-creates Activity linked to CrmOpportunity |
| `opportunity.lost` | `OPPORTUNITY_LOST` | CRM (self) | Auto-creates Activity linked to CrmOpportunity |

Additional triggers defined in enum: `LEAD_CONVERTED`, `EMAIL_SENT`, `EMAIL_RECEIVED`.

---

## 8. HR / Payroll Events

**Module path:** `api/src/modules/hr/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `payroll.run.completed` | PayrollRun finalized and all payslips generated | `{ payrollRunId: string; periodStart: Date; periodEnd: Date; employeeCount: number; grossTotal: Decimal; netTotal: Decimal; taxTotal: Decimal }` | Finance (GL: DR PAYROLL_EXPENSE, CR PAYROLL_LIABILITY + Bank), Communications (generate payslip PDFs), Audit (log) |
| `employee.terminated` | Employment contract terminated | `{ employeeId: string; employeeCode: string; terminationDate: Date; terminationType: string }` | HR (cascade: close training plans, cancel pending leave), Finance (final payroll processing), Notifications (HR manager alert) |
| `leave.approved` | LeaveRequest approved via approval engine | `{ leaveRequestId: string; employeeId: string; leaveType: string; startDate: Date; endDate: Date; daysCount: number }` | HR (update leave balance), Notifications (notify employee + team), AI Context |
| `rti.submitted` | RTI (Real Time Information) submission to HMRC completed | `{ rtiSubmissionId: string; payrollRunId: string; submissionType: string; status: string }` | Audit (log), Notifications (confirm to payroll admin) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `approval.completed` | Cross-Cutting | Process approved leave requests, contract changes, payroll runs |

---

## 9. Manufacturing / MRP Events

**Module path:** `api/src/modules/manufacturing/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `production.order.created` | ProductionOrder created from MRP or manual entry | `{ productionOrderId: string; orderNumber: string; recipeId: string; itemId: string; plannedQuantity: Decimal }` | Inventory (check material availability), AI Context |
| `production.started` | Production (execution record) status transitions from CREATED to STARTED | `{ productionId: string; productionOrderId: string; itemId: string }` | Inventory (stock reservations for input materials), Finance (WIP GL entry if autoCreateWip enabled) |
| `production.finished` | Production status transitions from STARTED to FINISHED | `{ productionId: string; productionOrderId: string; itemId: string; outputQuantity: Decimal; inputMaterials: Array<{ itemId: string; quantity: Decimal }> }` | Inventory (PRODUCTION_IN for output, PRODUCTION_OUT for consumption), Finance (GL: reverse WIP if applicable, post COGS) |
| `production.discarded` | Production status transitions to FINISHED_DISCARDED | `{ productionId: string; productionOrderId: string; discardReasonCode: string; itemId: string }` | Inventory (stock adjustments), Finance (depreciation/scrap GL posting) |
| `mrp.suggestions.generated` | MRP planning run completes with suggestions | `{ runId: string; suggestedPurchaseOrders: number; suggestedProductionOrders: number; planningHorizonDays: number }` | AI Context (surface in daily briefing), Notifications (alert production planner) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `sales.order.invoiced` | Sales | Triggers demand signal for MRP planning |
| `stock.balance.updated` | Inventory | Triggers re-evaluation of production schedules if below safety stock |

---

## 10. POS Events

**Module path:** `api/src/modules/pos/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `pos.sale.completed` | POSSale status transitions to COMPLETED (fully paid) | `{ saleId: string; saleNumber: string; terminalId: string; sessionId: string; totalAmount: Decimal; paymentMethods: Array<{ method: string; amount: Decimal }> }` | Finance (GL posting for cash/card receipts), Inventory (stock movements for sold items), Audit (POS journal entry) |
| `pos.sale.transferred` | POSSale transferred to AR invoice (TransferToInvoice) | `{ saleId: string; invoiceId: string; customerId: string }` | AR (creates CustomerInvoice type = CASH) |
| `pos.session.closed` | POSSession closed with cashup/Z-report | `{ sessionId: string; terminalId: string; cashierId: string; openedAt: Date; closedAt: Date; expectedCash: Decimal; actualCash: Decimal; variance: Decimal }` | Finance (cashup GL posting), Notifications (alert if variance exceeds threshold), Audit (log) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `stock.balance.updated` | Inventory | Updates real-time item availability display on POS terminal |

---

## 11. Projects / Job Costing Events

**Module path:** `api/src/modules/projects/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `timesheet.approved` | Timesheet approved via approval engine (status SUBMITTED to APPROVED) | `{ timesheetId: string; employeeId: string; projectId: string; totalHours: Decimal; entries: Array<{ taskId: string; hours: Decimal; billableRate?: Decimal }> }` | Projects (create ProjectTransaction records, update actualHours/actualCost), Finance (GL posting for labour costs) |
| `project.invoice.created` | Project invoice generated (T&M or fixed-price milestone) | `{ projectId: string; invoiceId: string; invoiceType: string; amount: Decimal }` | AR (creates CustomerInvoice), Projects (update invoicedAmount / uninvoicedAmount) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `approval.completed` | Cross-Cutting | Process approved timesheets and expense claims |
| `invoice.posted` | AR | Updates project invoice tracking (marks ProjectTransactions as invoiced) |

---

## 12. Contracts / Agreements Events

**Module path:** `api/src/modules/contracts/`

### Published Events -- Rental Agreements

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `agreement.approved` | Agreement status DRAFT to ACTIVE | `{ agreementId: string; customerId: string; startDate: Date }` | Audit (log), Notifications |
| `agreement.charged` | Periodic charge generation run for rental agreement | `{ agreementId: string; chargeCount: number; totalAmount: Decimal }` | AI Context (briefing), Audit (log) |
| `agreement.invoiced` | Invoice created from agreement charges | `{ agreementId: string; invoiceId: string; totalAmount: Decimal }` | AR (CustomerInvoice created inline), Audit (log) |
| `agreement.closed` | Agreement fully closed (all items returned) | `{ agreementId: string; customerId: string }` | Audit (log), Notifications |
| `agreement.cancelled` | Agreement cancelled | `{ agreementId: string; customerId: string; cancelDate: Date }` | Audit (log), Notifications |

### Published Events -- Service Contracts

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `contract.approved` | Contract status DRAFT to ACTIVE | `{ contractId: string; customerId: string; startDate: Date; endDate: Date }` | Audit (log), Notifications |
| `contract.invoiced` | Periodic invoice generated from contract | `{ contractId: string; invoiceId: string; totalAmount: Decimal }` | AR (CustomerInvoice created inline), Audit (log), AI Context |
| `contract.renewed` | Contract renewed (new contract record created, old linked) | `{ contractId: string; newContractId: string; customerId: string }` | Notifications (renewal confirmation), Audit (log) |
| `contract.expired` | Scheduled job detects contract past endDate with no renewal | `{ contractId: string; customerId: string; endDate: Date }` | Notifications (alert account manager), AI Daily Briefing |
| `contract.cancelled` | Contract cancelled before expiry | `{ contractId: string; customerId: string }` | Audit (log), Notifications |

### Published Events -- Loan Agreements

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `loan.approved` | LoanAgreement status NEW to APPROVED | `{ loanAgreementId: string; customerId: string; principalAmount: Decimal }` | Audit (log) |
| `loan.signed` | LoanAgreement APPROVED to SIGNED (repayment schedule generated) | `{ loanAgreementId: string; scheduleRowCount: number }` | Audit (log) |
| `loan.activated` | LoanAgreement SIGNED to ACTIVE (GL transaction created) | `{ loanAgreementId: string; journalEntryId: string; principalAmount: Decimal }` | Finance (GL: DR loan asset, CR AR), AI Context, Audit (log) |
| `loan.disbursed` | LoanAgreement ACTIVE to DISBURSED (funds disbursed via AP) | `{ loanAgreementId: string; purchaseInvoiceId: string }` | AP (purchase invoice created inline), Audit (log) |
| `loan.invoiced` | Scheduled repayment invoice generated | `{ loanAgreementId: string; scheduleRowNumber: number; invoiceId: string }` | AR (CustomerInvoice created inline), Audit (log) |
| `loan.paused` | Loan invoicing suspended | `{ loanAgreementId: string }` | Audit (log) |
| `loan.resumed` | Loan invoicing resumed | `{ loanAgreementId: string }` | Audit (log) |
| `loan.finished` | All schedule rows invoiced | `{ loanAgreementId: string }` | AI Daily Briefing, Audit (log), Notifications |
| `loan.cancelled` | Loan cancelled (no GL impact if pre-activation) | `{ loanAgreementId: string }` | Audit (log) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `payment.posted` | AR | Updates loan schedule row payment tracking |

---

## 13. Intercompany / Consolidation Events

**Module path:** `api/src/modules/intercompany/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `intercompany.transaction.created` | Cross-tenant transaction initiated (PO-to-SO or journal mirror) | `{ correlationId: string; sourceTenantId: string; targetTenantId: string; transactionType: string; amount: Decimal }` | Target tenant event handler (creates mirror transaction), Audit (log) |
| `intercompany.po.created` | PO created in source tenant, SO to be created in target | `{ correlationId: string; sourceTenantId: string; targetTenantId: string; purchaseOrderId: string }` | Purchasing (target tenant creates Sales Order via saga) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `journal.posted` | Finance | If intercompany rules match, initiates mirror transaction in target tenant |

---

## 14. Communications / Notifications Events

**Module path:** `api/src/modules/communications/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `notification.sent` | Notification dispatched to user via any channel | `{ notificationId: string; userId: string; channel: string; templateEventName: string }` | Audit (log) |
| `email.sent` | Email message sent via SMTP/transactional email service | `{ emailMessageId: string; recipientEmail: string; subject: string; documentType?: string }` | CRM (EMAIL_SENT auto-activity trigger), Audit (log) |

### Subscribed Events

The Communications module subscribes to **ALL business events** via the `NotificationTemplate` system. Each `NotificationTemplate` record has an `eventName` field (e.g., `"invoice.approved"`, `"order.shipped"`, `"approval.requested"`) that binds it to a specific event bus event. When the event fires, the notification routing engine:

1. Looks up `NotificationTemplate` WHERE `eventName` matches the fired event
2. Resolves target users (from template rules or entity ownership)
3. Applies user `NotificationPreference` (channel, quiet hours, do-not-disturb)
4. Dispatches via appropriate channel (in-app, email, push, WebSocket)

**Common notification-triggering events:**

| Event Name | Template Purpose |
|------------|-----------------|
| `invoice.approved` | Notify accountant of approved invoice |
| `approval.requested` | Notify approver of pending approval |
| `approval.completed` | Notify requester that approval is complete |
| `approval.rejected` | Notify requester that approval was rejected |
| `order.confirmed` | Notify warehouse of new order to fulfil |
| `dispatch.shipped` | Notify customer of shipment |
| `stock.reorder.triggered` | Notify purchasing team of low stock |
| `payment.posted` | Notify finance of received payment |
| `contract.expired` | Notify account manager of expired contract |
| `pos.session.closed` | Notify manager if cash variance detected |
| `user.accessGroups.assigned` | Notify user of permission change |
| `user.accessGroups.revoked` | Notify user of permission change |
| `accessGroup.deleted` | Notify affected users that group was deactivated |

---

## 15. Cross-Cutting Events (Approvals, Audit, Links)

**Module path:** `api/src/core/` and `api/src/modules/system/`

### Published Events -- Approval Workflow Engine

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `approval.requested` | ApprovalRequest created (entity submitted for approval) | `{ requestId: string; entityType: string; entityId: string; currentAssigneeId: string; ruleId: string; levelOrder: number }` | Notifications (notify assignee), CRM (create Activity) |
| `approval.completed` | Final approval level passed (entity fully approved) | `{ requestId: string; entityType: string; entityId: string; approvedBy: string }` | Source module (trigger entity-specific post-approval actions), CRM (create Activity), Notifications |
| `approval.rejected` | Approver rejects the request | `{ requestId: string; entityType: string; entityId: string; rejectedBy: string; rejectionReason: string }` | Source module (handle rejection), Notifications (notify requester), CRM (create Activity) |
| `approval.escalated` | Approval escalated to next level (multi-level approval) | `{ requestId: string; entityType: string; entityId: string; fromLevel: number; toLevel: number; newAssigneeId: string }` | Notifications (notify new assignee) |
| `approval.forwarded` | Approver forwards to another user at same level | `{ requestId: string; entityType: string; entityId: string; forwardedTo: string; forwardedBy: string }` | Notifications (notify new assignee) |
| `approval.cancelled` | Original requester cancels the approval request | `{ requestId: string; entityType: string; entityId: string; cancelledBy: string }` | Notifications (notify assignee), CRM (create Activity) |
| `approval.auto_escalated` | Scheduled job auto-escalates stale pending requests (timeout exceeded) | `{ requestId: string; entityType: string; entityId: string; timeoutHours: number }` | Notifications (notify new assignee) |

### Published Events -- Audit Trail

The audit trail does not publish events -- it is a **subscriber** to all business events. Every event handler writes to the `audit_log` table. The audit service creates immutable records with:
- `entityType`, `entityId`, `action` (CREATE/UPDATE/DELETE/APPROVE/POST)
- `beforeData` (JSONB), `afterData` (JSONB)
- `userId`, `isAiAction`, `aiConfidence`, `timestamp`, `correlationId`

---

## 16. System Events

**Module path:** `api/src/modules/system/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `user.login` | User successfully authenticates | `{ userId: string; loginMethod: string; ipAddress?: string }` | BullMQ login hooks (P1: refresh dashboard, check alerts), Audit (log) |
| `user.mfa.setup` | User initiates MFA TOTP setup | `{ userId: string }` | Audit (log) |
| `user.mfa.enabled` | User completes MFA verification and enables MFA | `{ userId: string }` | Audit (log) |
| `user.mfa.reset` | Admin resets a user's MFA configuration | `{ targetUserId: string; resetByUserId: string }` | Audit (log) |
| `settings.updated` | SystemSetting key-value pair changed | `{ key: string; oldValue: string; newValue: string; updatedBy: string }` | Affected modules (clear caches), Audit (log) |

---

## 17. AI Orchestration Events

**Module path:** `api/src/ai/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `ai.action.executed` | AI agent executes a tool call (creates/modifies data) | `{ agentId: string; toolName: string; entityType: string; entityId: string; userId: string; confidence: Decimal }` | Audit (log with isAiAction = true, aiConfidence), AI Context (update session) |

### Subscribed Events

The AI Context Engine subscribes to **ALL business events** to maintain the real-time user context stored in Redis (`{tenantId}:context:{userId}`). Key subscriptions:

| Event Category | Handler Action |
|---------------|----------------|
| All `*.created`, `*.posted`, `*.approved` events | Update entity counts and recent activity feed in user context |
| `invoice.overdue`, `stock.reorder.triggered` | Flag as alerts for Daily Briefing generation |
| `payment.posted`, `invoice.posted` | Update customer outstanding balance in context |
| `stock.balance.updated` | Update inventory availability in context |

The AI Context is refreshed incrementally on each event and fully refreshed via background job every 15 minutes.

---

## 17b. AI Memory & Skills Events (E5b)

**Module path:** `api/src/ai/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `ai.memory.created` | A new memory is stored (explicit or implicit) | `{ memoryId: string; userId: string; companyId: string; category: string; source: 'EXPLICIT' \| 'IMPLICIT'; content: string }` | AI Context (refresh user context) |
| `ai.memory.deleted` | A memory is permanently deleted | `{ memoryId: string; userId: string; companyId: string }` | AI Context (refresh user context) |
| `ai.memory.allDeleted` | User executes "Forget Everything" | `{ userId: string; companyId: string; count: number }` | AI Context (clear user context cache) |
| `ai.conversation.summarised` | A conversation is compressed into a summary on session end | `{ conversationId: string; userId: string; companyId: string; summaryLength: number }` | — |
| `ai.skill.activated` | A skill is selected by L1→L2 routing | `{ skillKey: string; moduleKey: string; userId: string; confidence: number }` | AI Observability (track skill usage), Learning Signals (increment query count) |
| `ai.skill.packLoaded` | L1 module pack is loaded for routing | `{ moduleKey: string; skillCount: number; userId: string }` | AI Observability (track module routing) |
| `ai.tool.queryExecuted` | A READ tool is executed by QueryExecutor | `{ toolName: string; moduleKey: string; userId: string; companyId: string; resultRowCount: number; latencyMs: number }` | AI Observability, Usage (track tool usage) |
| `ai.entityMention.resolved` | An inline entity mention is resolved in chat | `{ entityType: string; entityId: string; userId: string; triggerWord: string }` | AI Context (entity awareness) |

---

## 17c. AI Automation Events (E5c)

**Module path:** `api/src/ai/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `ai.automation.triggered` | An automation is triggered (schedule, event, chain, or manual) | `{ automationId: string; companyId: string; triggerType: string; triggeredBy: string; runId: string }` | AI Observability (track automation runs) |
| `ai.automation.completed` | An automation run completes successfully | `{ automationId: string; companyId: string; runId: string; totalTokens: number; totalCost: number; durationMs: number }` | Notifications (if notificationConfig set), Chain (trigger chainNextId) |
| `ai.automation.failed` | An automation run fails | `{ automationId: string; companyId: string; runId: string; error: string; stepOrder: number }` | Notifications (alert admins), Circuit Breaker (check consecutive failure count) |
| `ai.automation.paused` | Circuit breaker pauses automation after 3 consecutive failures | `{ automationId: string; companyId: string; consecutiveFailures: number }` | Notifications (urgent alert to admins) |

---

## 17d. AI Knowledge & Learning Events (E5d)

**Module path:** `api/src/ai/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `ai.knowledge.articleCreated` | A knowledge article is created (admin upload, AI-generated, or platform-suggested) | `{ articleId: string; companyId: string; category: string; source: string; confidenceScore: number }` | RAG Pipeline (re-index), AI Context (refresh knowledge cache) |
| `ai.knowledge.articleUsed` | A knowledge article is retrieved by RAG and injected into AI context | `{ articleId: string; companyId: string; conversationId: string }` | Learning Signals (track retrieval rate) |
| `ai.correction.logged` | A user corrects an AI response | `{ correctionId: string; companyId: string; userId: string; skillKey: string \| null; correctionType: string }` | Pattern Detection (check if 3+ corrections on same topic → draft article), Learning Signals (increment correction count) |
| `ai.correction.autoArticleGenerated` | Pattern detection auto-generates a knowledge article from corrections | `{ articleId: string; companyId: string; correctionCount: number; topic: string }` | Notifications (alert admin: review auto-generated knowledge) |
| `ai.learning.signalAggregated` | Daily learning signal aggregation completes for a skill | `{ companyId: string; skillKey: string; successRate: number; correctionRate: number }` | — |
| `ai.platform.patternAggregated` | Nightly cross-tenant aggregation completes | `{ patternDate: string; tenantCount: number; totalPatterns: number }` | Platform Intelligence (trigger insight generation) |

---

## 18. Document Understanding Events

**Module path:** `api/src/modules/document-processing/`

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `document.processing.started` | DocumentIngestion status transitions from PENDING to PROCESSING | `{ ingestionId: string; tenantId: string; sourceType: string; originalFileName: string; mimeType: string }` | AI Observability (track processing time) |
| `document.extraction.completed` | AI extraction completes successfully | `{ ingestionId: string; tenantId: string; documentType: string; overallConfidence: number; fieldCount: number; lineItemCount: number }` | Matching service (trigger supplier/PO matching) |
| `document.extraction.failed` | AI extraction fails (unreadable, corrupt, unsupported) | `{ ingestionId: string; tenantId: string; errorCode: string; errorMessage: string }` | Notifications (alert user of failure) |
| `document.matching.completed` | Supplier/PO matching completes, draft record created | `{ ingestionId: string; tenantId: string; matchedSupplierId: string | null; matchedPoId: string | null; createdRecordType: string; createdRecordId: string; overallConfidence: number }` | AP module (draft SupplierBill created), Notifications (alert user for review) |
| `document.review.required` | Document auto-flagged for review (low confidence, new supplier, amount variance) | `{ ingestionId: string; tenantId: string; reason: string; overallConfidence: number }` | Notifications (alert user: document needs review), Daily Briefing (include in briefing) |
| `document.approved` | User approves extracted document, ERP record posted | `{ ingestionId: string; tenantId: string; createdRecordType: string; createdRecordId: string; supplierId: string; totalAmount: string; correctionsApplied: boolean }` | AP module (post SupplierBill), Finance (GL posting via bill post), AI Learning (update SupplierExtractionProfile if corrections) |
| `document.rejected` | User rejects an extraction | `{ ingestionId: string; tenantId: string; reason: string }` | AI Learning (track rejection patterns) |

### Subscribed Events

| Event Name | Source Module | Handler Action |
|------------|-------------|----------------|
| `email.received` | Communications | Checks for invoice/receipt attachments; if found, creates DocumentIngestion in PENDING status |
| `supplier.created` | AP | Updates matching index -- new supplier available for future document matching |
| `supplier.updated` | AP | Updates matching index with new supplier details (name, VAT number, bank details) |

---

## 20. Access Groups (RBAC) Events

**Module path:** `api/src/modules/system/`

**Design reference:** `docs/plans/2026-02-19-granular-rbac-access-groups-design.md` (Epic E2b)

These events support the granular RBAC system introduced in E2b. Access groups replace the fixed role hierarchy for page/action/field-level permission control. The `Resource` table is the single source of truth for all controllable pages, reports, settings, and maintenances. Users are assigned 1+ access groups per company; conflict resolution uses most-permissive-wins.

### Published Events

| Event Name | Trigger Condition | Payload Schema | Subscribers |
|------------|------------------|----------------|-------------|
| `accessGroup.created` | New AccessGroup record created (admin or default data import) | `{ groupId: string; companyId: string; code: string; name: string; createdBy: string }` | Audit (log), AI Context (update admin context) |
| `accessGroup.updated` | AccessGroup permissions or field overrides modified | `{ groupId: string; companyId: string; changedBy: string }` | Audit (log), Permission Cache (invalidate all users in group), AI Context (update admin context) |
| `accessGroup.deleted` | AccessGroup soft-deleted (isActive set to false) | `{ groupId: string; companyId: string; deletedBy: string }` | Audit (log), Permission Cache (invalidate all users in group), Notifications (alert affected users) |
| `user.accessGroups.assigned` | Access groups assigned to a user for a company | `{ userId: string; companyId: string; groupIds: string[]; assignedBy: string }` | Audit (log), Permission Cache (invalidate `permissions:{userId}:{companyId}`), Notifications (notify user of permission change) |
| `user.accessGroups.revoked` | Access groups removed from a user for a company | `{ userId: string; companyId: string; groupIds: string[]; revokedBy: string }` | Audit (log), Permission Cache (invalidate `permissions:{userId}:{companyId}`), Notifications (notify user of permission change) |
| `company.defaultData.imported` | Default data file imported into company (resources, access groups, VAT codes, etc.) | `{ companyId: string; importedBy: string; version: string }` | Audit (log), Permission Cache (invalidate all company users), Notifications (confirm import to admin) |

### Subscribed Events

This module does not subscribe to events from other modules. Permission checks are performed synchronously via the `createPermissionGuard()` middleware and `filterFieldsByPermission()` response hook.

### Cache Invalidation

All access group and user assignment changes invalidate the Redis permission cache:
- **Cache key:** `permissions:{userId}:{companyId}`
- **TTL:** 60 seconds
- **Invalidation triggers:** `accessGroup.updated`, `accessGroup.deleted`, `user.accessGroups.assigned`, `user.accessGroups.revoked`, `company.defaultData.imported`

---

## Cross-Module Event Flow Diagrams

### Order-to-Cash Flow

```
SalesQuote.created
  |
  v
quote.sent --> Communications (email quote PDF to customer)
  |
  v
quote.accepted
  |
  v
quote.converted --> CRM (update opportunity)
  |
  v
order.confirmed
  |-- --> Inventory (stock availability check)
  |-- --> AR (credit limit check)
  |-- --> CRM (auto-create activity: SALES_ORDER_APPROVED)
  |
  v
dispatch.shipped
  |-- --> Inventory (stock.movement.posted: GOODS_ISSUE)
  |       |-- --> Finance (journal.posted: DR COGS, CR Stock)
  |-- --> Communications (shipping notification to customer)
  |
  v
sales.order.invoiced
  |-- --> AR (invoice.created)
          |
          v
        invoice.approved
          |
          v
        invoice.posted
          |-- --> Finance (journal.posted: DR AR_CONTROL, CR Revenue + VAT)
          |-- --> Communications (email invoice PDF to customer)
          |-- --> CRM (auto-create activity: INVOICE_POSTED)
          |
          v
        payment.posted (when customer pays)
          |-- --> Finance (journal.posted: DR Bank, CR AR_CONTROL)
          |-- --> CRM (auto-create activity: PAYMENT_RECEIVED)
          |-- --> AI Context (update customer balance)
```

### Document-to-Pay Flow

```
Email with invoice attachment
  │
  ▼
email.received ──► Document Processing: create DocumentIngestion (PENDING)
  │
  ▼
document.processing.started ──► AI Extraction (Claude Vision)
  │
  ├── Success ──► document.extraction.completed
  │                  │
  │                  ▼
  │              Matching Service: supplier lookup, PO matching
  │                  │
  │                  ├── High confidence ──► document.matching.completed
  │                  │                          │
  │                  │                          ▼
  │                  │                      Draft SupplierBill created
  │                  │                          │
  │                  │                          ▼
  │                  │                      User approves ──► document.approved
  │                  │                          │
  │                  │                          ▼
  │                  │                      SupplierBill POSTED ──► GL entry
  │                  │
  │                  └── Low confidence ──► document.review.required
  │                                            │
  │                                            ▼
  │                                        User reviews + corrects ──► document.approved
  │                                            │
  │                                            ▼
  │                                        SupplierExtractionProfile updated (learning)
  │
  └── Failure ──► document.extraction.failed ──► User notified
```

---

### Procure-to-Pay Flow

```
stock.reorder.triggered (or AI Reorder Advisor)
  |-- --> Notifications (alert purchasing team)
  |-- --> AI agent (suggests PO creation)
  |
  v
purchase.order.approved
  |-- --> Communications (email PO PDF to supplier)
  |-- --> Notifications (notify purchasing manager)
  |
  v
goods.receipt.posted
  |-- --> Inventory (stock.movement.posted: GOODS_RECEIPT)
  |       |-- --> Finance (journal.posted: DR Stock, CR GRN Accrual)
  |       |-- --> Inventory (update WAC / lastPurchasePrice)
  |-- --> Purchasing (update PO quantityReceived)
  |
  v
bill.posted (supplier invoice received and matched)
  |-- --> Finance (journal.posted: DR Cost + VAT_INPUT, CR AP_CONTROL)
  |-- --> Purchasing (update PO quantityInvoiced, 3-way match validation)
  |
  v
supplier.payment.posted (BACS run or manual payment)
  |-- --> Finance (journal.posted: DR AP_CONTROL, CR Bank)
  |-- --> Communications (remittance advice to supplier)
```

### Payroll Processing Flow

```
payroll.run.completed
  |-- --> Finance (journal.posted: DR PAYROLL_EXPENSE, CR PAYROLL_LIABILITY + Bank)
  |-- --> Communications (generate payslip PDFs, queue email to employees)
  |-- --> HR (update YTD figures)
  |
  v
rti.submitted (HMRC Real Time Information)
  |-- --> Notifications (confirm to payroll admin)
  |-- --> Audit (log HMRC submission)
```

### Month-End Close Flow

```
depreciation.run.completed
  |-- --> Finance (journal.posted: DR DEPRECIATION_EXPENSE, CR ACCUMULATED_DEPRECIATION)
  |-- --> AI Daily Briefing (report depreciation totals)
  |
  v
[Bank Reconciliation completed manually]
  |
  v
period.locked
  |-- --> All financial modules (enforce period lock on all future transactions)
  |-- --> Audit (log period lock with user attribution)
  |-- --> AI Context (flag period as closed in briefings)
```

### Manufacturing Flow

```
production.order.created
  |-- --> Inventory (check material availability)
  |
  v
production.started
  |-- --> Inventory (stock reservations for input materials)
  |-- --> Finance (if autoCreateWip: GL DR WIP, CR Stock)
  |
  v
production.finished
  |-- --> Inventory (PRODUCTION_IN: finished goods, PRODUCTION_OUT: consumed materials)
  |       |-- --> Finance (GL: DR Stock [output], CR Component Usage)
  |-- --> Finance (if WIP: reverse WIP entry)
```

### Lead-to-Customer Flow (CRM)

```
lead.converted (lifecycle QUALIFIED -> CONVERTED)
  |-- --> AR (Customer record created)
  |-- --> CRM (auto-create activity: LEAD_CONVERTED)
  |-- --> AI Context (new customer context)
  |
  v
opportunity.won
  |-- --> CRM (auto-create activity: OPPORTUNITY_WON)
  |-- --> Notifications (celebrate win to sales team)
  |-- --> AI Daily Briefing (highlight in briefing)
  |
  v
[Quote created from opportunity, then order, then dispatch/invoice -- see Order-to-Cash flow]
```

---

## Event Payload Reference

All event payloads are defined in the `BusinessEvents` interface. Below is the consolidated TypeScript definition that should live in `api/src/core/events/event-bus.types.ts`:

```typescript
import { Decimal } from '@prisma/client/runtime/library';

// ─── Core Event Bus Types ───────────────────────────────

export interface BusinessEvents {
  // ── Finance / GL ──
  'journal.posted': {
    journalEntryId: string;
    entryNumber: string;
    source: string;       // JournalSource enum value
    sourceId?: string;
    sourceReference?: string;
    transactionDate: Date;
    periodId: string;
    totalAmount: Decimal;
    lineCount: number;
    createdBy: string;
  };
  'journal.reversed': {
    journalEntryId: string;
    reversalEntryId: string;
    originalSource: string;
    sourceReference?: string;
    createdBy: string;
  };
  'period.locked': {
    periodId: string;
    year: number;
    periodNumber: number;
    lockedBy: string;
  };
  'period.unlocked': {
    periodId: string;
    year: number;
    periodNumber: number;
    unlockedBy: string;
  };
  'bank.transactions.imported': {
    bankAccountId: string;
    importBatchId: string;
    importSource: string;
    transactionCount: number;
    totalAmount: Decimal;
  };

  // ── Inventory ──
  'stock.movement.posted': {
    movementId: string;
    movementNumber: string;
    movementType: string;    // StockMovementType enum
    itemId: string;
    warehouseId: string;
    quantity: Decimal;
    unitCost: Decimal;
    totalCost: Decimal;
    sourceType?: string;
    sourceId?: string;
  };
  'stock.movement.reversed': {
    movementId: string;
    reversalMovementId: string;
    itemId: string;
    warehouseId: string;
    quantity: Decimal;
  };
  'stock.balance.updated': {
    itemId: string;
    warehouseId: string;
    quantityOnHand: Decimal;
    quantityAvailable: Decimal;
    costValue: Decimal;
  };
  'stock.reorder.triggered': {
    itemId: string;
    itemCode: string;
    itemName: string;
    warehouseId: string;
    currentQuantity: Decimal;
    reorderPoint: Decimal;
    reorderQuantity: Decimal;
  };
  'stock.valuation.changed': {
    itemId: string;
    costingMethod: string;
    previousCost: Decimal;
    newCost: Decimal;
    trigger: string;
  };

  // ── Accounts Receivable ──
  'invoice.created': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    amount: Decimal;
    currencyCode: string;
    invoiceType: string;
  };
  'invoice.approved': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    totalAmount: Decimal;
    journalEntryId?: string;
  };
  'invoice.posted': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    totalAmount: Decimal;
    journalEntryId: string;
    periodId: string;
  };
  'invoice.voided': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    reversalJournalEntryId: string;
  };
  'invoice.overdue': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    daysOverdue: number;
    outstandingAmount: Decimal;
  };
  'payment.posted': {
    paymentId: string;
    paymentNumber: string;
    customerId: string;
    amount: Decimal;
    allocations: Array<{ invoiceId: string; amount: Decimal }>;
  };

  // ── Sales Orders ──
  'quote.created': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
    totalAmount: Decimal;
  };
  'quote.sent': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
  };
  'quote.accepted': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
  };
  'quote.converted': {
    quoteId: string;
    orderId: string;
    quoteNumber: string;
    orderNumber: string;
    customerId: string;
  };
  'quote.expired': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
    validUntilDate: Date;
  };
  'order.confirmed': {
    orderId: string;
    orderNumber: string;
    customerId: string;
    lineItems: Array<{ itemId: string; quantity: Decimal; warehouseId?: string }>;
    totalAmount: Decimal;
  };
  'dispatch.shipped': {
    dispatchId: string;
    orderId: string;
    orderNumber: string;
    customerId: string;
    lines: Array<{ itemId: string; quantity: Decimal; warehouseId: string }>;
  };
  'sales.order.invoiced': {
    orderId: string;
    orderNumber: string;
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
  };

  // ── Purchasing / AP ──
  'purchase.order.approved': {
    orderId: string;
    orderNumber: string;
    supplierId: string;
    totalAmount: Decimal;
  };
  'purchase.order.sent': {
    orderId: string;
    orderNumber: string;
    supplierId: string;
  };
  'goods.receipt.posted': {
    receiptId: string;
    receiptNumber: string;
    orderId: string;
    supplierId: string;
    lines: Array<{ itemId: string; quantity: Decimal; unitCost: Decimal; warehouseId: string }>;
  };
  'bill.posted': {
    billId: string;
    billNumber: string;
    supplierId: string;
    totalAmount: Decimal;
    journalEntryId: string;
    periodId: string;
  };
  'bill.voided': {
    billId: string;
    billNumber: string;
    supplierId: string;
    reversalJournalEntryId: string;
  };
  'supplier.payment.posted': {
    paymentId: string;
    paymentNumber: string;
    supplierId: string;
    amount: Decimal;
    bankAccountId: string;
    allocations: Array<{ billId: string; amount: Decimal }>;
  };
  'bacs.run.submitted': {
    bacsRunId: string;
    fileReference: string;
    paymentCount: number;
    totalAmount: Decimal;
  };

  // ── Fixed Assets ──
  'asset.acquired': {
    fixedAssetId: string;
    assetCode: string;
    purchaseValue: Decimal;
    acquiredDate: Date;
    departmentCode?: string;
  };
  'depreciation.run.completed': {
    periodId: string;
    assetCount: number;
    totalAmount: Decimal;
    journalEntryId: string;
  };
  'depreciation.entry.posted': {
    fixedAssetId: string;
    assetCode: string;
    amount: Decimal;
    periodId: string;
    newBookValue: Decimal;
  };
  'asset.disposed': {
    fixedAssetId: string;
    assetCode: string;
    disposalType: string;
    proceedsAmount: Decimal;
    bookValueAtDisposal: Decimal;
    gainOrLoss: Decimal;
  };

  // ── CRM ──
  'lead.converted': {
    leadId: string;
    customerId: string;
    convertedBy: string;
  };
  'opportunity.won': {
    opportunityId: string;
    customerId: string;
    estimatedValue: Decimal;
    salesPersonId?: string;
    salesQuoteId?: string;
  };
  'opportunity.lost': {
    opportunityId: string;
    customerId: string;
    lossReason: string;
    salesPersonId?: string;
  };
  'campaign.activated': {
    campaignId: string;
    campaignName: string;
    recipientCount: number;
  };
  'activity.created': {
    activityId: string;
    activityType: string;
    entityType: string;
    entityId: string;
    assignedToId: string;
    isAutoCreated: boolean;
  };

  // ── HR / Payroll ──
  'payroll.run.completed': {
    payrollRunId: string;
    periodStart: Date;
    periodEnd: Date;
    employeeCount: number;
    grossTotal: Decimal;
    netTotal: Decimal;
    taxTotal: Decimal;
  };
  'employee.terminated': {
    employeeId: string;
    employeeCode: string;
    terminationDate: Date;
    terminationType: string;
  };
  'leave.approved': {
    leaveRequestId: string;
    employeeId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    daysCount: number;
  };
  'rti.submitted': {
    rtiSubmissionId: string;
    payrollRunId: string;
    submissionType: string;
    status: string;
  };

  // ── Manufacturing / MRP ──
  'production.order.created': {
    productionOrderId: string;
    orderNumber: string;
    recipeId: string;
    itemId: string;
    plannedQuantity: Decimal;
  };
  'production.started': {
    productionId: string;
    productionOrderId: string;
    itemId: string;
  };
  'production.finished': {
    productionId: string;
    productionOrderId: string;
    itemId: string;
    outputQuantity: Decimal;
    inputMaterials: Array<{ itemId: string; quantity: Decimal }>;
  };
  'production.discarded': {
    productionId: string;
    productionOrderId: string;
    discardReasonCode: string;
    itemId: string;
  };
  'mrp.suggestions.generated': {
    runId: string;
    suggestedPurchaseOrders: number;
    suggestedProductionOrders: number;
    planningHorizonDays: number;
  };

  // ── POS ──
  'pos.sale.completed': {
    saleId: string;
    saleNumber: string;
    terminalId: string;
    sessionId: string;
    totalAmount: Decimal;
    paymentMethods: Array<{ method: string; amount: Decimal }>;
  };
  'pos.sale.transferred': {
    saleId: string;
    invoiceId: string;
    customerId: string;
  };
  'pos.session.closed': {
    sessionId: string;
    terminalId: string;
    cashierId: string;
    openedAt: Date;
    closedAt: Date;
    expectedCash: Decimal;
    actualCash: Decimal;
    variance: Decimal;
  };

  // ── Projects / Job Costing ──
  'timesheet.approved': {
    timesheetId: string;
    employeeId: string;
    projectId: string;
    totalHours: Decimal;
    entries: Array<{ taskId: string; hours: Decimal; billableRate?: Decimal }>;
  };
  'project.invoice.created': {
    projectId: string;
    invoiceId: string;
    invoiceType: string;
    amount: Decimal;
  };

  // ── Contracts / Agreements ──
  'agreement.approved': { agreementId: string; customerId: string; startDate: Date };
  'agreement.charged': { agreementId: string; chargeCount: number; totalAmount: Decimal };
  'agreement.invoiced': { agreementId: string; invoiceId: string; totalAmount: Decimal };
  'agreement.closed': { agreementId: string; customerId: string };
  'agreement.cancelled': { agreementId: string; customerId: string; cancelDate: Date };
  'contract.approved': { contractId: string; customerId: string; startDate: Date; endDate: Date };
  'contract.invoiced': { contractId: string; invoiceId: string; totalAmount: Decimal };
  'contract.renewed': { contractId: string; newContractId: string; customerId: string };
  'contract.expired': { contractId: string; customerId: string; endDate: Date };
  'contract.cancelled': { contractId: string; customerId: string };
  'loan.approved': { loanAgreementId: string; customerId: string; principalAmount: Decimal };
  'loan.signed': { loanAgreementId: string; scheduleRowCount: number };
  'loan.activated': { loanAgreementId: string; journalEntryId: string; principalAmount: Decimal };
  'loan.disbursed': { loanAgreementId: string; purchaseInvoiceId: string };
  'loan.invoiced': { loanAgreementId: string; scheduleRowNumber: number; invoiceId: string };
  'loan.paused': { loanAgreementId: string };
  'loan.resumed': { loanAgreementId: string };
  'loan.finished': { loanAgreementId: string };
  'loan.cancelled': { loanAgreementId: string };

  // ── Intercompany ──
  'intercompany.transaction.created': {
    correlationId: string;
    sourceTenantId: string;
    targetTenantId: string;
    transactionType: string;
    amount: Decimal;
  };
  'intercompany.po.created': {
    correlationId: string;
    sourceTenantId: string;
    targetTenantId: string;
    purchaseOrderId: string;
  };

  // ── Approvals (Cross-Cutting) ──
  'approval.requested': {
    requestId: string;
    entityType: string;
    entityId: string;
    currentAssigneeId: string;
    ruleId: string;
    levelOrder: number;
  };
  'approval.completed': {
    requestId: string;
    entityType: string;
    entityId: string;
    approvedBy: string;
  };
  'approval.rejected': {
    requestId: string;
    entityType: string;
    entityId: string;
    rejectedBy: string;
    rejectionReason: string;
  };
  'approval.escalated': {
    requestId: string;
    entityType: string;
    entityId: string;
    fromLevel: number;
    toLevel: number;
    newAssigneeId: string;
  };
  'approval.forwarded': {
    requestId: string;
    entityType: string;
    entityId: string;
    forwardedTo: string;
    forwardedBy: string;
  };
  'approval.cancelled': {
    requestId: string;
    entityType: string;
    entityId: string;
    cancelledBy: string;
  };
  'approval.auto_escalated': {
    requestId: string;
    entityType: string;
    entityId: string;
    timeoutHours: number;
  };

  // ── System ──
  'user.login': {
    userId: string;
    loginMethod: string;
    ipAddress?: string;
  };
  'settings.updated': {
    key: string;
    oldValue: string;
    newValue: string;
    updatedBy: string;
  };

  // ── Access Groups (RBAC) ──
  'accessGroup.created': {
    groupId: string;
    companyId: string;
    code: string;
    name: string;
    createdBy: string;
  };
  'accessGroup.updated': {
    groupId: string;
    companyId: string;
    changedBy: string;
  };
  'accessGroup.deleted': {
    groupId: string;
    companyId: string;
    deletedBy: string;
  };
  'user.accessGroups.assigned': {
    userId: string;
    companyId: string;
    groupIds: string[];
    assignedBy: string;
  };
  'user.accessGroups.revoked': {
    userId: string;
    companyId: string;
    groupIds: string[];
    revokedBy: string;
  };
  'company.defaultData.imported': {
    companyId: string;
    importedBy: string;
    version: string;
  };

  // ── AI ──
  'ai.action.executed': {
    agentId: string;
    toolName: string;
    entityType: string;
    entityId: string;
    userId: string;
    confidence: Decimal;
  };

  // ── Document Understanding ──
  'document.processing.started': {
    ingestionId: string;
    tenantId: string;
    sourceType: string;      // DocumentSourceType enum
    originalFileName: string;
    mimeType: string;
  };
  'document.extraction.completed': {
    ingestionId: string;
    tenantId: string;
    documentType: string;    // DocumentType enum
    overallConfidence: number;
    fieldCount: number;
    lineItemCount: number;
  };
  'document.extraction.failed': {
    ingestionId: string;
    tenantId: string;
    errorCode: string;
    errorMessage: string;
  };
  'document.matching.completed': {
    ingestionId: string;
    tenantId: string;
    matchedSupplierId: string | null;
    matchedPoId: string | null;
    createdRecordType: string;
    createdRecordId: string;
    overallConfidence: number;
  };
  'document.review.required': {
    ingestionId: string;
    tenantId: string;
    reason: string;
    overallConfidence: number;
  };
  'document.approved': {
    ingestionId: string;
    tenantId: string;
    createdRecordType: string;
    createdRecordId: string;
    supplierId: string;
    totalAmount: string;     // Decimal as string
    correctionsApplied: boolean;
  };
  'document.rejected': {
    ingestionId: string;
    tenantId: string;
    reason: string;
  };

  // ── Communications ──
  'notification.sent': {
    notificationId: string;
    userId: string;
    channel: string;
    templateEventName: string;
  };
  'email.sent': {
    emailMessageId: string;
    recipientEmail: string;
    subject: string;
    documentType?: string;
  };
}

// ─── Type-Safe Event Bus ────────────────────────────────

export class EventBus {
  emit<K extends keyof BusinessEvents>(event: K, data: BusinessEvents[K]): void;
  on<K extends keyof BusinessEvents>(event: K, handler: (data: BusinessEvents[K]) => void): void;
}
```

---

## Implementation Notes

1. **Event handlers must be idempotent.** If the same event is delivered twice (e.g., during retry), the handler should not produce duplicate side effects. Use `sourceId` / `correlationId` for deduplication.

2. **Event handlers must not throw.** Failures in event handlers should be caught, logged, and optionally retried via BullMQ dead-letter queue. A failed audit log write must not prevent the business operation from succeeding.

3. **GL posting events are the most critical.** The `journal.posted` event and its source events (`invoice.posted`, `bill.posted`, `stock.movement.posted`, etc.) form the financial integrity backbone. These handlers create balanced journal entries within database transactions.

4. **Audit trail is a universal subscriber.** Every event emitted by any module is logged to the immutable `audit_log` table by the audit service subscriber. This is the foundation for regulatory compliance (NFR14, NFR39).

5. **AI Context Engine is a universal subscriber.** The AI layer maintains per-user context in Redis by subscribing to all business events. This enables the Daily Briefing and conversational AI to have real-time awareness of what happened in the business.

6. **Notification Templates are configurable.** The Communications module does not hardcode which events trigger notifications. Instead, `NotificationTemplate` records bind event names to notification templates, and `NotificationPreference` records control per-user channel preferences. This makes the notification system fully extensible without code changes.

7. **CRM Activity Auto-Creation is configurable.** The `CrmActivityAutoRule` model and `CrmActivityAutoTrigger` enum define which business events create CRM activities. New triggers can be added by extending the enum and creating matching rules in the database.

8. **Story 3 is the event bus foundation.** The event bus implementation (`api/src/core/events/event-bus.ts`) is built in Story 3 of the build sequence. All subsequent modules depend on it for cross-module communication.

---

## Validation Report

**Validated:** 2026-02-16
**Validator:** Automated validation agent (Claude Opus 4.6)
**Source material:** `arch-sections/2.13` through `arch-sections/2.30` (18 files)

### Summary

| Metric | Value |
|--------|-------|
| Events in `BusinessEvents` interface | **93** |
| Events described in per-module sections (1--20) | **~96** (published + subscribed references) |
| Events referenced in architecture source files | **~91** (extracted via grep of arch-sections + E2b design doc) |
| Architecture sections reviewed | **18 / 18** + E2b design doc |
| Sections with no event activity | 3 (2.19-Pricing, 2.27-Warehouse, 2.30-Service Orders) |

### Check 1: Completeness -- Architecture Events vs. Catalog

All events explicitly emitted in the architecture source files were cross-referenced against the event catalog.

**Events found in architecture and present in catalog:**

| Arch Section | Events Found | All Present in Catalog? |
|-------------|-------------|------------------------|
| 2.13 Finance GL | `GL_ENTRY_POSTED` (code sample), `journal.posted` (implied) | Yes -- see Warning W-01 below |
| 2.15 AR | `invoice.posted`, `invoice.voided`, `payment.posted`, `invoice.overdue` | Yes |
| 2.17 Purchasing/AP | No explicit event emit statements found (events implied by architecture patterns) | Yes (covered by module section 5) |
| 2.18 Fixed Assets | `depreciation.run.completed`, `depreciation.entry.posted`, `asset.disposed`, `asset.acquired` | Yes |
| 2.20 Cross-Cutting | `approval.requested`, `approval.completed`, `approval.rejected`, `approval.escalated`, `approval.forwarded`, `approval.cancelled`, `approval.auto_escalated` | Yes |
| 2.21 CRM | `lead.converted`, `opportunity.won`, `opportunity.lost`, `campaign.activated` | Yes |
| 2.22 HR/Payroll | Event bus reference (termination cascade) -- no explicit event names | Yes (covered by module section 8) |
| 2.23 Manufacturing | No explicit event emit statements | Yes (covered by module section 9) |
| 2.24 POS | No explicit event emit statements | Yes (covered by module section 10) |
| 2.25 Projects | `timesheet.approved` | Yes |
| 2.26 Contracts | `agreement.approved`, `agreement.closed`, `agreement.cancelled`, `agreement.charged`, `agreement.invoiced`, `contract.approved`, `contract.renewed`, `contract.expired`, `contract.cancelled`, `contract.invoiced`, `loan.approved`, `loan.signed`, `loan.activated`, `loan.disbursed`, `loan.paused`, `loan.resumed`, `loan.finished`, `loan.cancelled`, `loan.invoiced` | Yes |
| 2.28 Intercompany | Event-driven saga pattern referenced | Yes (covered by module section 13) |
| 2.29 Communications | `invoice.approved` (example in notification flow) | Yes |
| 2.19 Pricing | No events | N/A -- correctly excluded |
| 2.27 Warehouse | No events | N/A -- correctly excluded |
| 2.30 Service Orders | No events | N/A -- correctly excluded |
| 2.16 Sales Orders | No explicit event emit statements | Yes (covered by module section 4) |
| 2.14 Inventory | No explicit event emit statements | Yes (covered by module section 2) |

**Result: PASS** -- No missing events detected. All events referenced in the architecture source files are present in the catalog.

### Check 2: Naming Convention Consistency

Convention stated: `{entity}.{action}` (lowercase, dot-separated, past tense action verbs).

| Severity | Issue ID | Event Name | Issue |
|----------|---------|------------|-------|
| Warning | W-01 | `GL_ENTRY_POSTED` | Architecture section 2.13 line 683 uses `GL_ENTRY_POSTED` (SCREAMING_SNAKE_CASE) in a code sample, but the catalog normalises this to `journal.posted`. This is an acceptable design decision (the catalog defines the canonical name), but the arch-section code sample is inconsistent. |
| Info | I-01 | `bank.transactions.imported` | Three-segment name (`bank.transactions.imported`) deviates from the two-segment `{entity}.{action}` pattern. Acceptable because `bank.transactions` is treated as a compound entity name. |
| Info | I-02 | `stock.movement.posted`, `stock.movement.reversed`, `stock.balance.updated`, `stock.reorder.triggered`, `stock.valuation.changed` | All use three-segment names. Consistent within the Inventory module; `stock.{sub-entity}` is the pattern. |
| Info | I-03 | `purchase.order.approved`, `purchase.order.sent`, `goods.receipt.posted`, `supplier.payment.posted`, `bacs.run.submitted` | Three-segment names in Purchasing/AP module. Consistent within module. |
| Info | I-04 | `sales.order.invoiced`, `pos.sale.completed`, `pos.sale.transferred`, `pos.session.closed`, `production.order.created`, `mrp.suggestions.generated`, `intercompany.transaction.created`, `intercompany.po.created`, `project.invoice.created`, `depreciation.run.completed`, `depreciation.entry.posted` | Additional three-segment names. All follow the `{module/entity}.{sub-entity}.{action}` pattern consistently. |
| Info | I-05 | `approval.auto_escalated` | Uses underscore in action verb (`auto_escalated`). Only event with an underscore. Minor inconsistency -- could be `approval.autoEscalated` or `approval.auto-escalated`, but the underscore is explicitly documented in the arch-section (2.20 line 514). |
| Info | I-06 | `ai.action.executed` | Three-segment name in AI module. Consistent with other compound-entity patterns. |

**Result: PASS WITH MINOR NOTES** -- The naming is internally consistent within each module. The two-segment vs. three-segment pattern is a pragmatic choice for compound entities. The `GL_ENTRY_POSTED` discrepancy in the architecture source is cosmetic (the catalog correctly uses `journal.posted`).

### Check 3: Payload Completeness

Key validation: events that trigger GL journal entries must include `journalEntryId` where the journal is created inline.

| Severity | Issue ID | Event Name | Finding |
|----------|---------|------------|---------|
| Pass | -- | `invoice.posted` | Includes `journalEntryId` and `periodId`. Correct. |
| Pass | -- | `invoice.voided` | Includes `reversalJournalEntryId`. Correct. |
| Pass | -- | `bill.posted` | Includes `journalEntryId` and `periodId`. Correct. |
| Pass | -- | `bill.voided` | Includes `reversalJournalEntryId`. Correct. |
| Pass | -- | `depreciation.run.completed` | Includes `journalEntryId`. Correct. |
| Pass | -- | `loan.activated` | Includes `journalEntryId`. Correct. |
| Pass | -- | `supplier.payment.posted` | Includes `bankAccountId` and allocations. No `journalEntryId` -- correct because GL posting is a subscriber action (Finance module creates the JE in response to this event). |
| Pass | -- | `payment.posted` | No `journalEntryId` -- correct because GL posting is a subscriber action. |
| Pass | -- | `stock.movement.posted` | No `journalEntryId` -- correct because GL posting is a subscriber action. |
| Warning | W-02 | `invoice.approved` | Payload includes `journalEntryId?: string` (optional). The architecture (2.15 line 511) states that GL posting happens on the POSTED transition, not APPROVED. The catalog correctly makes this optional and documents the distinction in section 3 (line 128). This is correct but could confuse implementers -- the `journalEntryId` field on `invoice.approved` will always be undefined/null at the APPROVED stage. |
| Info | I-07 | `quote.expired` | Present in the `BusinessEvents` interface (line 802) and listed as a subscribed event in section 4. It is described as triggered by a scheduled BullMQ cron job. It does not appear in the "Published Events" table for any module, which is slightly inconsistent -- it should either be listed as a published event from the System/Scheduler or noted that the scheduled job is the publisher. |

**Result: PASS** -- All GL-triggering events carry the necessary `journalEntryId` or correctly delegate GL creation to subscriber handlers.

### Check 4: Cross-Module Coverage

All 18 architecture section files (2.13--2.30) were reviewed.

| Arch Section | Module | Represented in Catalog? |
|-------------|--------|------------------------|
| 2.13 | Finance / GL | Yes (Section 1) |
| 2.14 | Inventory | Yes (Section 2) |
| 2.15 | AR / Sales Ledger | Yes (Section 3) |
| 2.16 | Sales Orders | Yes (Section 4) |
| 2.17 | Purchasing / AP | Yes (Section 5) |
| 2.18 | Fixed Assets | Yes (Section 6) |
| 2.19 | Pricing | No events defined in arch-section -- correctly excluded |
| 2.20 | Cross-Cutting | Yes (Section 15) |
| 2.21 | CRM | Yes (Section 7) |
| 2.22 | HR / Payroll | Yes (Section 8) |
| 2.23 | Manufacturing / MRP | Yes (Section 9) |
| 2.24 | POS | Yes (Section 10) |
| 2.25 | Projects / Job Costing | Yes (Section 11) |
| 2.26 | Contracts / Agreements | Yes (Section 12) |
| 2.27 | Warehouse Management | No events defined in arch-section -- correctly excluded |
| 2.28 | Intercompany / Consolidation | Yes (Section 13) |
| 2.29 | Communications / Notifications | Yes (Section 14) |
| 2.30 | Service Orders / Timekeeper | No events defined in arch-section -- correctly excluded |

**Result: PASS** -- All 18 sections reviewed. 15 modules with events are covered. 3 modules with no events are correctly excluded.

### Check 5: TypeScript `BusinessEvents` Interface Validity

The `BusinessEvents` interface (lines 648--1167) was reviewed for:

1. **Type correctness:** All properties use valid TypeScript types (`string`, `number`, `boolean`, `Date`, `Decimal`, `Array<T>`). No syntax errors detected.
2. **Completeness:** 93 event types defined. Cross-referenced against the 20 per-module sections:
   - All published events from sections 1--17 have corresponding entries in the interface.
   - The `quote.expired` event is in the interface but is only referenced as a subscribed/scheduled event (not a "published" event in the module tables). This is acceptable since it still needs a typed payload.
3. **Consistency:** Payload shapes in the interface match the inline payload schemas in the per-module tables. Spot-checked 15 events -- all matched.
4. **EventBus class:** The `emit` and `on` methods are correctly typed with generic constraints on `keyof BusinessEvents`. The class signature is valid.

| Severity | Issue ID | Finding |
|----------|---------|---------|
| Info | I-08 | Several enum types are represented as `string` in the interface (e.g., `source: string` for `JournalSource`, `movementType: string` for `StockMovementType`). This is noted in comments. For full type safety at implementation time, these should reference the actual enum types, but using `string` is acceptable at the catalog/planning stage. |

**Result: PASS** -- Interface is syntactically valid and complete.

### Check 6: Flow Diagram Accuracy

Four flow diagrams were reviewed against the arch-section lifecycle descriptions:

1. **Order-to-Cash** (lines 496--538): Matches the Sales Orders (2.16) and AR (2.15) lifecycle. The flow correctly shows: quote -> order -> dispatch -> invoice -> payment, with correct subscriber actions at each stage.
2. **Procure-to-Pay** (lines 542--568): Matches the Purchasing/AP (2.17) lifecycle. Flow correctly shows: reorder trigger -> PO -> goods receipt -> bill -> payment.
3. **Payroll Processing** (lines 572--582): Matches the HR/Payroll (2.22) description. Correctly shows payroll run -> RTI submission.
4. **Month-End Close** (lines 586--598): Matches the Fixed Assets (2.18) and Finance (2.13) descriptions. Correctly shows depreciation -> period lock.
5. **Manufacturing** (lines 602--617): Matches the Manufacturing (2.23) description. Correctly shows production order -> started -> finished with inventory and finance effects.
6. **Lead-to-Customer** (lines 621--634): Matches the CRM (2.21) description. Correctly shows lead conversion -> opportunity won -> order flow.

**Result: PASS** -- All flow diagrams are accurate representations of the architecture lifecycle descriptions.

---

## 19. Platform Admin Events

**Module path:** `apps/platform-api/src/events/` (Platform API, NOT ERP tenant codebase)

> These events are emitted by the Platform API and consumed by ERP tenants via webhooks or by the Platform Admin portal for real-time updates. They flow on a **separate event bus** from the ERP in-process event bus.

### Published Events

| Event Name | Trigger Condition | Payload Schema | Consumers |
|------------|------------------|----------------|-----------|
| `tenant.created` | New tenant provisioned via Platform Admin | `{ tenantId: string; code: string; planCode: string; region: string; createdBy: string }` | Platform Audit Log, Monitoring |
| `tenant.suspended` | Tenant status changed to SUSPENDED (manual or billing enforcement) | `{ tenantId: string; reason: string; suspendedBy: string; enforcementAction: EnforcementAction }` | **ERP webhook** (bust entitlement cache), Platform Audit Log |
| `tenant.reactivated` | Tenant status changed from SUSPENDED to ACTIVE | `{ tenantId: string; reactivatedBy: string }` | **ERP webhook** (bust entitlement cache), Platform Audit Log |
| `tenant.archived` | Tenant soft-deleted/archived | `{ tenantId: string; archivedBy: string }` | **ERP webhook** (block all access), Platform Audit Log |
| `tenant.plan_changed` | Tenant assigned to a different plan | `{ tenantId: string; oldPlanCode: string; newPlanCode: string; changedBy: string; enabledModules: string[] }` | **ERP webhook** (bust entitlement cache, update module visibility), Platform Audit Log |
| `tenant.modules_changed` | Per-tenant module override added/changed | `{ tenantId: string; moduleKey: string; enabled: boolean; changedBy: string }` | **ERP webhook** (bust module cache), Platform Audit Log |
| `tenant.quota_warning` | Tenant AI usage crosses soft limit threshold | `{ tenantId: string; quotaPct: number; tokensUsed: bigint; tokenAllowance: bigint; threshold: number }` | **ERP webhook** (show warning banner), Platform Admin notification |
| `tenant.quota_exceeded` | Tenant AI usage crosses hard limit | `{ tenantId: string; quotaPct: number; tokensUsed: bigint; tokenAllowance: bigint }` | **ERP webhook** (block AI calls), Platform Admin alert |
| `billing.payment_received` | Payment confirmed (Stripe webhook or manual) | `{ tenantId: string; amount: Decimal; currency: string; paymentMethod: string }` | Billing status update, Platform Audit Log |
| `billing.payment_failed` | Payment attempt failed | `{ tenantId: string; failureReason: string; dunningLevel: number; nextAction: string }` | Billing enforcement engine, Platform Admin alert |
| `billing.enforcement_changed` | Enforcement action changed (none→warning→read_only→suspended) | `{ tenantId: string; oldAction: EnforcementAction; newAction: EnforcementAction; reason: string }` | **ERP webhook** (update enforcement state), Platform Audit Log |
| `platform.impersonation_started` | Platform admin begins impersonation session | `{ sessionId: string; platformUserId: string; tenantId: string; reason: string; expiresAt: DateTime }` | Platform Audit Log (mandatory) |
| `platform.impersonation_ended` | Impersonation session ended (manual or timeout) | `{ sessionId: string; platformUserId: string; tenantId: string; duration: number; actionsCount: number }` | Platform Audit Log (mandatory) |

### Subscribed Events (from ERP tenants)

The Platform does NOT subscribe to ERP tenant events directly. Instead, the **AI Gateway** writes usage records to the Platform database, and the **Platform Client SDK** sends periodic heartbeats.

### ERP Webhook Delivery

Platform events that affect ERP runtime are delivered to each tenant's webhook endpoint:

```
POST https://{tenant-slug}.nexa-erp.com/webhooks/platform
Authorization: Bearer {internal-service-token}
Content-Type: application/json

{
  "event": "tenant.plan_changed",
  "timestamp": "2026-02-17T10:30:00Z",
  "payload": { ... }
}
```

The ERP's Platform Client SDK listens on this endpoint and invalidates the entitlement cache immediately, ensuring enforcement actions take effect within seconds.

---

### Issues Summary

| ID | Severity | Description | Recommendation |
|----|----------|-------------|----------------|
| W-01 | Warning | Architecture 2.13 line 683 uses `GL_ENTRY_POSTED` but catalog uses `journal.posted` | Update the arch-section code sample to use `journal.posted` for consistency when the arch-section is next revised. No catalog change needed. |
| W-02 | Warning | `invoice.approved` payload includes optional `journalEntryId?` which will always be null at the APPROVED stage | Add a comment in the payload schema noting this field is populated only at the POSTED stage. Or remove it from the `invoice.approved` payload to avoid confusion. |
| I-01 | Info | Three-segment event names used alongside two-segment names | Document in the naming convention section that compound entities use `{module}.{entity}.{action}` while simple entities use `{entity}.{action}`. |
| I-05 | Info | `approval.auto_escalated` uses underscore instead of camelCase or kebab-case | Minor. Consider standardising to `approval.autoEscalated` for consistency, or document the underscore as acceptable for compound action verbs. |
| I-07 | Info | `quote.expired` in BusinessEvents interface but not listed as a "Published Event" in any module section | Add `quote.expired` to the Sales Orders published events table (publisher: BullMQ scheduled job), or add a note that scheduled jobs are implicit publishers. |
| I-08 | Info | Enum types represented as `string` in the interface | At implementation time, replace `string` with actual enum type references for full type safety. |

### Overall Assessment

## **PASS WITH WARNINGS**

The event catalog is comprehensive, well-structured, and accurately reflects the architecture source material. All 87 events are properly defined with typed payloads. The 6 flow diagrams are accurate. Cross-module coverage is complete across all 18 architecture sections. The two warnings are minor documentation-level issues that do not affect correctness. The informational items are style/consistency notes for the implementation phase.
