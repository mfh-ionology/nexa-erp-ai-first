# Nexa ERP -- Business Rules Compendium

## Document Purpose

Single-source reference for all business rules governing entity behaviour, validation constraints, and cross-module interactions across the Nexa ERP platform. This document consolidates explicit `BR-xxx` coded rules and implicit architectural constraints extracted from all 18 architecture section files (sections 2.13 through 2.30).

**Version:** 1.0
**Date:** 2026-02-16
**Source:** Architecture Decision Document (arch-sections 2.13--2.30)

---

## 1. Overview

### Rule Coding Convention

All explicit business rules follow the pattern: **BR-{MODULE}-{NNN}**

| Module Prefix | Module |
|---------------|--------|
| FIN | Finance / GL / Banking |
| INV | Inventory & Stock |
| AR | Accounts Receivable / Sales Ledger |
| SAL / REQ-OR | Sales Orders |
| PUR | Purchasing |
| AP | Accounts Payable |
| FA | Fixed Assets |
| PRC | Pricing |
| CRM | CRM |
| EMP, CTR, APR, SKL, CHK, TRN, LEV, PAY, JP | HR / Payroll |
| PRD | Production / Manufacturing |
| POS | Point of Sale |
| PRJ, TS, EXP, INV (project) | Projects & Job Costing |
| CON | Contracts & Agreements |
| WMS | Warehouse Management |
| IC / BR-1..15 | Intercompany & Consolidation |
| COM | Communications |
| SVO | Service Orders |
| SYS | Cross-Cutting / System |
| RBAC | RBAC / Access Groups / Permissions |
| PLT | Platform Admin (Tenant, Billing, AI Gateway) |

### Enforcement Levels

| Level | Description | Where Enforced |
|-------|-------------|----------------|
| **HARD** | Violation is blocked -- transaction rejected | DB trigger, DB constraint, or service-layer validation with error |
| **SOFT** | Warning issued but user may override with appropriate permission | Service layer with warning response; UI confirmation required |
| **CONFIGURABLE** | Behaviour controlled by a tenant-level `SystemSetting` | Service layer checks setting value; default documented per rule |
| **INFORMATIONAL** | Tracked/calculated but not enforced | Computed fields, dashboard display |

---

## 2. Finance Module Rules (BR-FIN-xxx)

The Finance module does not use explicit BR-FIN-xxx codes in the architecture. The following rules are derived from the GL, banking, and budget specifications in section 2.13.

### Double-Entry Enforcement

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-FIN-001 | **Journal entries must balance.** Sum of debits must equal sum of credits across all `JournalLine` records for a `JournalEntry`. Unbalanced entries are rejected with `UnbalancedEntryError`. | HARD -- Service layer validation in `createGlPosting()` within a database transaction. All sub-module posting follows this same pattern. |
| BR-FIN-002 | **All financial amounts use fixed-point decimal.** `Decimal(19, 4)` is mandated for all monetary fields -- no floating-point arithmetic permitted. | HARD -- Prisma schema `@db.Decimal(19, 4)` on all monetary columns. NFR38. |

### Period Management

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-FIN-003 | **Transactions cannot be posted to locked periods.** If `FinancialPeriod.status !== 'OPEN'`, the `createGlPosting()` function throws `PeriodLockError`. | HARD -- Service layer check. NFR37 (period locks at DB level). |
| BR-FIN-004 | **Financial periods are unique per year+period number.** Unique constraint `uq_financial_periods_year_period` on `[year, periodNumber]`. | HARD -- DB constraint. |

### Chart of Accounts

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-FIN-005 | **Cannot deactivate GL accounts with current-year postings.** Accounts referenced by `JournalLine` records in the current fiscal year cannot be set to `isActive = false`. | HARD -- Service layer validation. |
| BR-FIN-006 | **Cannot delete system accounts.** System-seeded accounts (e.g., AR Control, AP Control, Stock) are protected from deletion. | HARD -- Service layer guard. |

### Account Mapping

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-FIN-007 | **Account mapping is required for GL posting.** If no `AccountMapping` row exists for a required `mappingType`, `MissingAccountMappingError` is thrown. The system falls back from department-scoped mapping to generic mapping before failing. | HARD -- Service layer with fallback chain. |

### Bank Reconciliation

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-FIN-008 | **No duplicate bank transactions.** De-duplication via `externalId` prevents importing the same bank statement line twice. | HARD -- Unique constraint / service layer check. NFR33. |
| BR-FIN-009 | **Reconciliation must reach zero difference.** Statement balance minus ledger balance must equal zero before a `BankReconciliation` can be marked COMPLETED. | HARD -- Service layer validation on completion. |
| BR-FIN-010 | **Auto-match threshold: >= 95% confidence for automatic matching; 60-94% suggested for review; <60% left unmatched.** | CONFIGURABLE -- AI-assisted matching engine. |

### Journal Entry Lifecycle

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-FIN-011 | **Journal entry status transitions: DRAFT -> POSTED. REVERSED is created by posting a reversal entry.** Posted entries are immutable -- corrections require reversal and re-entry. | HARD -- Service layer state machine. |
| BR-FIN-012 | **Journal entry numbers are auto-generated** via the `JOURNAL` NumberSeries. Format: `JE-NNNNN`. | HARD -- NumberSeries service within DB transaction. |

---

## 3. Inventory Module Rules (BR-INV-xxx)

The Inventory module does not use explicit BR-INV-xxx codes. The following rules are derived from section 2.14.

### Stock Movement

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-INV-001 | **Stock movements follow a DRAFT -> POSTED lifecycle.** Posting is atomic -- `StockBalance`, cost layers, serial numbers, and GL journal are all updated within a single database transaction. | HARD -- DB transaction. NFR18 (zero data loss / ACID). |
| BR-INV-002 | **Reversal of posted movements is supported.** Reversal restores `StockBalance`, reverses GL journal entry, and reverts serial number status. | HARD -- Service layer reverse operation. |
| BR-INV-003 | **Validate item exists, warehouse is active, and quantity sign matches movement type** before creating a stock movement. | HARD -- Service layer validation. |
| BR-INV-004 | **Serial-tracked items require serial number validation.** If `InventoryItem.serialNumberRequired = true`, the serial number must exist and be in AVAILABLE status. | HARD -- Service layer validation. |
| BR-INV-005 | **Batch-tracked items require batch number validation.** If `InventoryItem.batchTrackingEnabled = true`, a batch number must be provided. | HARD -- Service layer validation. |

### Stock Balance

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-INV-006 | **StockBalance is a maintained table** updated transactionally. Every posted `StockMovement` updates the corresponding `StockBalance` row atomically within the same database transaction. No on-demand computation from movement history. | HARD -- DB transaction. |
| BR-INV-007 | **Serial number uniqueness per item.** Unique constraint `uq_serial_numbers_serial_item` on `[serialNumber, itemId]`. | HARD -- DB constraint. |

### Costing

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-INV-008 | **Four costing methods supported: FIFO, Weighted Average, Standard Cost, Last Purchase Price.** Costing method is configured per item via `InventoryItem.costingMethod`. | CONFIGURABLE -- per-item setting. |
| BR-INV-009 | **FIFO: Serial-tracked items can operate per serial number** -- each serial carries its own purchase cost. FIFO is scoped per warehouse. | HARD -- Cost layer logic. |
| BR-INV-010 | **Weighted average price is recalculated on receipt.** On goods receipt posting, `InventoryItem.weightedAveragePrice` is updated. | HARD -- Service layer calculation. |

### Item Defaults

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-INV-011 | **ItemGroup carries default GL account codes** (sales, COGS, stock) and VAT codes. Items inherit these defaults but can override them individually. | CONFIGURABLE -- inheritance with override. |

---

## 4. Sales/AR Module Rules (BR-SAL-xxx, BR-AR-xxx)

### Customer Invoice Lifecycle (Section 2.15)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-AR-001 | **Invoice status transitions are strictly ordered: DRAFT -> APPROVED -> POSTED. VOID is available from POSTED. CANCELLED from DRAFT or APPROVED.** | HARD -- Service layer state machine. |
| BR-AR-002 | **Posting creates a balanced JournalEntry.** Debit AR Control, Credit revenue account(s) per line, Credit VAT output per line. Sets `outstandingAmount = totalAmount`. | HARD -- GL posting service. |
| BR-AR-003 | **Voiding creates a reversal JournalEntry** (mirror of original with swapped debits/credits). Sets `outstandingAmount = 0`. Original JE remains for audit trail. | HARD -- Service layer. |
| BR-AR-004 | **At least one invoice line required** for approval. Totals recalculated. Due date set from payment terms if blank. | HARD -- Service layer validation. |
| BR-AR-005 | **Auto-approve threshold.** Invoices with `totalAmount < SystemSetting.invoiceAutoApproveThreshold` can skip manual approval. | CONFIGURABLE -- tenant setting. |
| BR-AR-006 | **Credit notes are modelled as invoices with type CREDIT_NOTE.** Same lifecycle, same allocation logic. | HARD -- Schema design. |

### Credit Management (Section 2.15)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-AR-007 | **Blocked customers reject all transactions.** If `Customer.blocked = true`, no invoices or orders can be created. | HARD -- Service layer guard. |
| BR-AR-008 | **On-hold customers generate a warning.** If `Customer.onHold = true`, a warning is surfaced but transaction may proceed. | SOFT -- Warning with override. |
| BR-AR-009 | **Credit limit check calculates exposure** = outstanding invoices + uninvoiced orders. Compared against `Customer.creditLimit`. Action is configurable via `ar.creditLimitAction` = WARN or BLOCK. | CONFIGURABLE -- tenant setting (default: WARN). |
| BR-AR-010 | **Credit checks run at two points:** invoice approval and sales order confirmation. `CreditCheckService` is a shared service consumed by both AR and Sales modules. | HARD -- Service layer integration. |

### Payment Allocation (Section 2.15)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-AR-011 | **On-account (unallocated) payments are permitted.** Unallocated portion stays as a credit balance on the customer account. | HARD -- Design allows nullable allocation. |
| BR-AR-012 | **Payment reversal creates mirror JournalEntry** (swap DR/CR), restores `invoice.outstandingAmount` and `invoice.paidAmount` on all linked allocations. Allocation records are soft-deleted for audit trail. | HARD -- Service layer. |

### Sales Orders (Section 2.16 -- REQ-OR-xxx rules from legacy)

| Code | Description | Enforcement |
|------|-------------|-------------|
| REQ-OR-001 | **Customer code required** on all sales orders. `customerId` must be present and non-empty. | HARD -- Service layer validation. |
| REQ-OR-002 | **Customer must exist.** FK constraint + service-level lookup. | HARD -- DB FK + service. |
| REQ-OR-003 | **Customer must not be blocked.** Check `Customer.isActive = true`. | HARD -- Service layer guard. |
| REQ-OR-005-008 | **Credit limit check (3 modes).** Compare customer AR balance + order total vs credit limit. | CONFIGURABLE -- per-tenant setting controls mode. |
| REQ-OR-009 | **Order date must be in valid accounting period.** Check against `PeriodLock`. | HARD -- Service layer validation. |
| REQ-OR-013 | **Cannot change shipped rows.** If `quantityShipped > 0`, reject line edits. | HARD -- Service layer guard. |
| REQ-OR-014 | **Quantity cannot go below shipped.** Validate `newQuantity >= quantityShipped`. | HARD -- Service layer validation. |
| REQ-OR-015 | **Negative quantities blocked.** Validate `quantity > 0`. | HARD -- Service layer validation. |
| REQ-OR-016 | **Item must exist and allow sales.** Check `Item.isActive` and `Item.allowSales`. | HARD -- Service layer validation. |
| REQ-OR-018 | **Order class required (if setting enabled).** | CONFIGURABLE -- `SalesModuleSetting`. |
| REQ-OR-019 | **Customer order number required (if setting enabled).** | CONFIGURABLE -- `SalesModuleSetting`. |
| REQ-OR-024 | **Minimum gross profit check.** Compare line GP% against setting threshold. | CONFIGURABLE -- threshold setting. |
| REQ-OR-040 | **OROK permission to approve.** RBAC permission check. | HARD -- RBAC. |
| REQ-OR-041 | **UnOKOR permission to un-approve.** RBAC permission check. | HARD -- RBAC. |
| REQ-OR-050 | **Stock ordered-out update on approve.** Increment `Item.quantityOnOrder`. | HARD -- Side effect on approval. |
| REQ-OR-051 | **Stock reservation on approve.** Create `StockReservation` records. | HARD -- Side effect on approval. |
| REQ-OR-052 | **CRM activity on approve.** Create `CrmActivity` follow-up. | HARD -- Side effect on approval. |
| REQ-OR-053 | **Planned payment on approve.** Create payment schedule entry. | HARD -- Side effect on approval. |
| REQ-OR-060 | **Cannot delete if down-payments exist.** Guard against deletion. | HARD -- Service layer guard. |
| REQ-OR-061 | **Cannot delete if shipped.** `quantityShipped > 0` blocks delete. | HARD -- Service layer guard. |
| REQ-OR-066 | **Delete planned payments on order delete.** Cascade cleanup. | HARD -- Service layer cascade. |

---

## 5. Purchasing/AP Module Rules (BR-PUR-xxx)

The Purchasing module does not use explicit BR-PUR-xxx codes. The following rules are derived from section 2.17.

### Purchase Order & Goods Receipt

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PUR-001 | **A PO can have multiple GRNs** (partial deliveries over time). | HARD -- Schema supports multiple GoodsReceipt per PO. |
| BR-PUR-002 | **A GRN can only reference one PO** (but a PO can have many GRNs). | HARD -- FK constraint `purchaseOrderId` on GoodsReceipt. |
| BR-PUR-003 | **PO quantities cannot be over-received without explicit override.** | CONFIGURABLE -- `ap.allowOverReceipt` system setting. |
| BR-PUR-004 | **Bills cannot be posted to a locked fiscal period.** | HARD -- Period lock check in service layer. |
| BR-PUR-005 | **A bill can reference one PO for matching**, but non-PO bills (direct expense) are allowed. `purchaseOrderId` is nullable. | HARD -- Schema design. |
| BR-PUR-006 | **A single payment can be allocated across multiple bills** (batch payment). | HARD -- `SupplierPaymentAllocation` junction model. |
| BR-PUR-007 | **A single bill can be paid by multiple payments** (partial payment). | HARD -- Multiple allocation rows per bill. |

### Three-Way Matching

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PUR-008 | **Three-way matching validates PO vs GRN vs Bill on four dimensions:** quantity ordered/received/invoiced, unit price consistency, item identity, and line-level cross-reference. | HARD -- Matching algorithm in service layer. |
| BR-PUR-009 | **Match status classification:** FULLY_MATCHED (all dimensions within tolerance), PARTIALLY_MATCHED (some lines matched), PRICE_VARIANCE (quantities match but price differs beyond tolerance), QUANTITY_VARIANCE (price matches but quantities differ), MISMATCHED (significant discrepancies). | HARD -- Service layer classification. |
| BR-PUR-010 | **Users with `ap.approve_mismatch` permission can approve bills that fail matching.** All match overrides are recorded in the audit trail with reason. | SOFT -- Permission-gated override with audit. |
| BR-PUR-011 | **`ap.requireMatchBeforePosting` controls whether unmatched bills can be posted.** Default: true. | CONFIGURABLE -- tenant setting. |

### BACS Payment Run

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PUR-012 | **All suppliers in a BACS run must have valid UK bank details** (sort code + account number). Suppliers with IBAN-only banking details are flagged for SEPA/CHAPS. | HARD -- Service layer validation. |
| BR-PUR-013 | **Maximum 999,999 items per BACS file** (BACS limit). | HARD -- Service layer validation. |
| BR-PUR-014 | **Individual payment amounts must not exceed the bank's per-transaction limit.** | HARD -- Service layer validation. |

### FX Handling

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PUR-015 | **Exchange rate differences between bill rate and payment rate are posted to FX Gain/Loss accounts.** When outstanding reaches zero, bill status moves to PAID. | HARD -- GL posting service. |

---

## 6. CRM Module Rules (BR-CRM-xxx)

All rules from section 2.21, explicitly coded.

### Lead Management

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CRM-001 | Lead number is mandatory and auto-generated from the CRM Number Series on creation. Manual override is not permitted. | HARD -- NumberSeries service. |
| BR-CRM-002 | A Lead must have at least `contactFirstName` and `contactLastName` populated. `companyName` is optional (individual leads are permitted). | HARD -- Service layer validation. |
| BR-CRM-003 | Lead rating (COLD/WARM/HOT) can only be set when lifecycle is CONTACTED or QUALIFIED. New leads default to NONE. | HARD -- Service layer guard. |
| BR-CRM-004 | Lead conversion requires lifecycle = QUALIFIED. Leads in NEW, CONTACTED, UNQUALIFIED, or LOST states cannot be converted. | HARD -- Service layer guard. |
| BR-CRM-005 | Lead conversion creates a new Customer record in the AR module (section 2.15). The `CrmLead.convertedCustomerId` is set to the new Customer's ID. The lead record is preserved (not deleted or merged). | HARD -- Cross-module service integration. |
| BR-CRM-006 | A Lead can only be converted once. If `convertedCustomerId` is already set, conversion is blocked. | HARD -- Service layer guard. |
| BR-CRM-017 | Deleting a Lead that has been converted (`convertedCustomerId` is set) is blocked. The lead must be soft-deleted (`isActive = false`) instead. | HARD -- Service layer guard. |

### Campaign Management

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CRM-007 | Campaign activation (DRAFT -> ACTIVE) requires at least one recipient in the `CrmCampaignRecipient` table. | HARD -- Service layer validation. |
| BR-CRM-008 | Campaign recipients must be unique per campaign. The same Lead or Customer cannot appear twice in the same campaign. | HARD -- Unique constraint. |
| BR-CRM-009 | Campaign status transitions are strictly ordered: DRAFT -> ACTIVE -> COMPLETED. CANCELLED can be reached from DRAFT or ACTIVE but not from COMPLETED. | HARD -- Service layer state machine. |
| BR-CRM-020 | Campaign budget tracking is informational only (no hard enforcement). `actualCost` is manually updated; it does not auto-aggregate from linked transactions. | INFORMATIONAL -- No enforcement. |

### Opportunity Management

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CRM-010 | Opportunity creation from a Lead copies `companyName`, `contactFirstName`, `contactLastName`, `email`, `phone`, `currencyCode`, and `salesPersonId` to the new Opportunity. | HARD -- Service layer data copy. |
| BR-CRM-011 | When an Opportunity status changes to WON, `probability` is automatically set to 100.00, `actualCloseDate` is set to today, and `weightedValue` is recalculated. The event `"opportunity.won"` is emitted. | HARD -- Service layer side effects. |
| BR-CRM-012 | When an Opportunity status changes to LOST, `probability` is automatically set to 0.00, `actualCloseDate` is set to today, `weightedValue` is set to 0, and `lossReason` is required. The event `"opportunity.lost"` is emitted. | HARD -- Service layer validation + side effects. |
| BR-CRM-013 | `weightedValue` is computed as `estimatedValue * probability / 100` and stored for efficient pipeline reporting queries. | HARD -- Computed field on save. |
| BR-CRM-014 | Opportunity stage changes are logged in `CrmOpportunityStageLog` with before/after status, before/after probability, reason, and the user who made the change. | HARD -- Audit side effect. |
| BR-CRM-015 | Pipeline drag-and-drop operations validate that the target column's filter criteria are compatible with the entity being dragged. Invalid transitions trigger the standard status-change business rules (BR-CRM-011/012). | HARD -- Service layer validation. |
| BR-CRM-018 | Opportunity approval (when required) uses the cross-cutting approval engine from section 2.20. Opportunities pending approval cannot be converted to Sales Quotes or Orders. | HARD -- Approval engine integration. |

### Activity & Email

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CRM-016 | Activity auto-creation rules (`CrmActivityAutoRule`) are evaluated on the event bus. When a matching trigger fires, the CRM service creates an `Activity` record. If `autoComplete` is true, the activity is created with status = COMPLETED. | HARD -- Event bus handler. |
| BR-CRM-019 | Email-to-customer lookup: when creating an Activity from an inbound email, the system searches `Customer.email` and `CustomerContact.email` to auto-link. If no match, searches `CrmLead.email`. | HARD -- Service layer lookup chain. |

---

## 7. HR/Payroll Module Rules (BR-EMP, BR-CTR, BR-APR, BR-SKL, BR-CHK, BR-TRN, BR-LEV, BR-PAY, BR-JP)

All rules from section 2.22, explicitly coded.

### Employee (BR-EMP)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-EMP-001 | Employee number is mandatory and auto-generated from the HR Number Series on creation. Manual override is not permitted. | HARD -- NumberSeries service. |
| BR-EMP-002 | An Employee must have `firstName`, `lastName`, and `dateOfBirth` populated. NI number format (if provided) must match the pattern `QQ 12 34 56 A`. | HARD -- Service layer validation + regex. |
| BR-EMP-003 | An Employee's status transitions are: ACTIVE -> ON_LEAVE, ACTIVE -> SUSPENDED, ACTIVE -> TERMINATED, ACTIVE -> RETIRED. Terminated/retired employees cannot be reactivated. | HARD -- Service layer state machine. |
| BR-EMP-004 | Bank details (sortCode, accountNumber) are required before an employee can be included in a payroll run. | HARD -- Service layer validation at payroll. |

### Employment Contract (BR-CTR)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CTR-001 | Only one active (APPROVED, non-TERMINATED) employment contract per employee at a time. | HARD -- Service layer validation. |
| BR-CTR-002 | StartDate is mandatory on all contracts. | HARD -- Schema NOT NULL. |
| BR-CTR-003 | Termination requires TerminationReason, EndDate, and TerminationDetails (all mandatory). | HARD -- Service layer validation. |
| BR-CTR-004 | Approved contracts cannot be deleted; they can only be terminated. | HARD -- Service layer guard. |
| BR-CTR-005 | Contract changes can only be created from an APPROVED contract. | HARD -- Service layer guard. |
| BR-CTR-006 | Changes are immutable once approved; they cannot be edited or deleted. | HARD -- Service layer guard. |
| BR-CTR-007 | Termination cascades: close all open training plans for the employee (status -> CLOSED), mark all skills evaluations as TERMINATED, and auto-create an OFFBOARDING checklist. | HARD -- Service layer cascade. |
| BR-CTR-008 | Draft contracts can be freely edited and deleted. | HARD -- Service layer (no guard for DRAFT). |
| BR-CTR-009 | Notice period must comply with UK statutory minimum (1 week per year of service, minimum 1 week, maximum 12 weeks). | SOFT -- Warning if below statutory minimum. |
| BR-CTR-010 | Fixed-term contracts (`contractTypeCode = 'FIXED'`) must have an EndDate. | HARD -- Service layer validation. |

### Performance Appraisal (BR-APR)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-APR-001 | At least one appraisal line (factor + rating) is required when approving a Performance Appraisal. | HARD -- Service layer validation on approval. |
| BR-APR-002 | Both Employee and Reviewer must be valid, active employees. | HARD -- Service layer validation. |
| BR-APR-003 | Employee and Reviewer must be different persons. | HARD -- Service layer validation. |
| BR-APR-004 | Approved appraisals cannot be deleted. | HARD -- Service layer guard. |

### Skills Evaluation (BR-SKL)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-SKL-001 | At least one skill line (skill + rating) is required when approving a Skills Evaluation. | HARD -- Service layer validation on approval. |
| BR-SKL-002 | TerminatedFlag is automatically set when the employee's contract is terminated. | HARD -- Cascade from BR-CTR-007. |
| BR-SKL-003 | Auto-populate from the latest evaluation for the same employee (if one exists) when creating a new evaluation. | HARD -- Service layer auto-populate. |

### Checklist (BR-CHK)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CHK-001 | At least one checklist item is required when approving a Checklist. | HARD -- Service layer validation. |
| BR-CHK-002 | ListType is auto-detected from the employee's contract termination status. If the employee has a terminated contract, the checklist defaults to OFFBOARDING. | HARD -- Service layer auto-detect. |
| BR-CHK-003 | CompletedDate is auto-set to the current date when a checklist item status is changed to COMPLETED. | HARD -- Service layer auto-set. |
| BR-CHK-004 | Duplicating a checklist clears the employee-specific data and resets all item statuses to PENDING. | HARD -- Service layer copy logic. |

### Training (BR-TRN)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-TRN-001 | Employee and Topic are mandatory on training plans. | HARD -- Service layer validation. |
| BR-TRN-002 | Trainer and Employee cannot be the same person. | HARD -- Service layer validation. |
| BR-TRN-003 | EndTime is mandatory if StartTime is set. | HARD -- Service layer validation. |
| BR-TRN-004 | Double-booking detection: the system checks for time conflicts across all training plans for the same person (as trainee or trainer). Overlapping time slots are rejected. | HARD -- Service layer query + validation. |
| BR-TRN-005 | Training plans are auto-closed (status -> CLOSED) when the employee's contract is terminated. | HARD -- Cascade from BR-CTR-007. |

### Leave Management (BR-LEV)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-LEV-001 | UK statutory minimum leave entitlement is 28 days (5.6 weeks) including bank holidays for full-time employees. | HARD -- Entitlement calculation floor. |
| BR-LEV-002 | Pro-rata entitlement for part-time workers is calculated based on the hoursPerWeek ratio. | HARD -- Calculation rule. |
| BR-LEV-003 | Pro-rata entitlement for mid-year joiners is calculated based on remaining months in the leave year. | HARD -- Calculation rule. |
| BR-LEV-004 | Leave request cannot exceed the remaining balance in LeaveBalance. | HARD -- Service layer validation. |
| BR-LEV-005 | Overlapping leave requests for the same employee are rejected. | HARD -- Service layer validation. |
| BR-LEV-006 | A manager cannot approve their own leave requests. Leave approval must be performed by a different user. | HARD -- Service layer guard. |
| BR-LEV-007 | Approved leave requests update LeaveBalance: pendingDays increases, remainingDays decreases. | HARD -- Service layer side effect. |
| BR-LEV-008 | When an approved leave request is marked as TAKEN, LeaveBalance updates: usedDays increases, pendingDays decreases. | HARD -- Service layer side effect. |
| BR-LEV-009 | Carry-forward days are capped at the system setting `hr.leaveCarryForwardMaxDays` (default: 5 days). | CONFIGURABLE -- tenant setting. |

### Payroll (BR-PAY)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PAY-001 | Once a payroll run is APPROVED, it cannot be modified. Corrections must be made via the next payroll run or a supplementary run. | HARD -- Service layer guard. |
| BR-PAY-002 | PAYE is calculated cumulatively (unless the employee has Week1/Month1 tax basis). | HARD -- Payroll calculation engine. |
| BR-PAY-003 | National Insurance is calculated per pay period (not cumulative), except for directors where the annual method applies. | HARD -- Payroll calculation engine. |
| BR-PAY-004 | Directors may use the NI annual method: pro-rata to the period during the year, then true-up at year end. | HARD -- Payroll calculation engine. |
| BR-PAY-005 | Student loan deduction applies when the employee's earnings exceed the plan-specific threshold per period. | HARD -- Payroll calculation engine. |
| BR-PAY-006 | Pension auto-enrolment: eligible jobholders (aged 22+ to state pension age, earning above the trigger) must be enrolled automatically. | HARD -- UK regulatory requirement. |
| BR-PAY-007 | Pension opt-out window is 1 calendar month from the enrolment date. Contributions paid during this window must be refunded if the employee opts out. | HARD -- UK regulatory requirement. |
| BR-PAY-008 | Re-enrolment of opted-out employees is required every 3 years. | HARD -- UK regulatory requirement. |
| BR-PAY-009 | SSP is payable after 3 qualifying days, for up to 28 weeks, only if average weekly earnings (AWE) are at or above the lower earnings limit (LEL). | HARD -- UK statutory rules. |
| BR-PAY-010 | SMP is payable at 90% of AWE for the first 6 weeks (higher rate), then at the statutory rate or 90% of AWE (whichever is lower) for the remaining weeks. | HARD -- UK statutory rules. |
| BR-PAY-011 | FPS (Full Payment Submission) must be submitted to HMRC on or before the payment date. | HARD -- UK regulatory requirement. |
| BR-PAY-012 | EPS (Employer Payment Summary) is due by the 19th of the following tax month. | HARD -- UK regulatory requirement. |
| BR-PAY-013 | Tax code changes from HMRC must be applied from the effective date specified. The system recalculates on the next payroll run. | HARD -- Integration with HMRC. |
| BR-PAY-014 | National Minimum Wage: the system must flag if the calculated hourly rate for any employee falls below the NMW threshold for their age band. | SOFT -- Warning flag. |
| BR-PAY-015 | Salary sacrifice cannot reduce an employee's effective pay below the National Minimum Wage. | HARD -- Service layer validation. |
| BR-PAY-016 | P45 must be generated within 14 days of employment ending. | HARD -- UK regulatory requirement. |
| BR-PAY-017 | Payroll run status transitions are strictly ordered: DRAFT -> CALCULATED -> REVIEWED -> APPROVED -> PAID -> POSTED. CANCELLED can be reached from DRAFT or CALCULATED only. | HARD -- Service layer state machine. |
| BR-PAY-018 | GL posting creates a balanced journal entry (debits = credits). The PayrollRun.journalEntryId is set and the status transitions to POSTED. | HARD -- GL posting service. |

### Job Position (BR-JP)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-JP-001 | Job Position EndDate must be greater than or equal to StartDate. | HARD -- Service layer validation. |
| BR-JP-002 | A position's headcount determines the maximum number of active PositionIncumbent records. | HARD -- Service layer guard. |

---

## 8. Manufacturing Module Rules (BR-PRD-xxx)

The Manufacturing module does not use explicit BR-PRD-xxx codes. The following rules are derived from section 2.23.

### Production Order Lifecycle

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PRD-001 | **CREATED -> RELEASED:** Machine is required (unless routing specified). Validates recipe exists and is not closed, warehouse is active, responsible person is set, and machine-item compatibility. | HARD -- Service layer validation. |
| BR-PRD-002 | **RELEASED -> STARTED:** Auto-sets `startDate`/`startTime`. Order is placed in machine queue. Material reservations are created in Inventory module. | HARD -- Service layer side effects. |
| BR-PRD-003 | **STARTED -> FINISHED:** All child Productions must be complete. Auto-sets `endDate`/`endTime`. Removes order from machine queue. | HARD -- Service layer guard + side effects. |
| BR-PRD-004 | **Any non-FINISHED -> CANCELLED:** Releases all material reservations. Removes from machine queue. Cannot cancel if any child Production has `status = FINISHED`. | HARD -- Service layer guard + cascade. |

### Production Lifecycle

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PRD-005 | **STARTED -> FINISHED:** Requires at least one output row with `outputQty > 0`. Creates GL transaction. Updates serial numbers, item cost prices, and item history. | HARD -- Service layer validation. |
| BR-PRD-006 | **STARTED -> CANCELLED:** If `autoCreateWip`, reverses the WIP transaction. Only allowed if no operations are finished/discarded. | HARD -- Service layer guard. |
| BR-PRD-007 | **STARTED -> FINISHED_DISCARDED:** Requires `discardReasonCode` (Standard Problem). Creates Stock Depreciation record if setting enabled. | HARD -- Service layer validation. |
| BR-PRD-008 | **Un-OK (Reversal):** Status can be reverted from FINISHED/FINISHED_DISCARDED back to CREATED (requires `UnOKAll` permission). Reverses stock movements, serial numbers, cost prices. | HARD -- RBAC + service layer. |

### Operation Sequencing

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PRD-009 | Operations are executed in `sequence` order. The `enforceSequentialOps` setting determines whether all operations in previous sequences must be completed before the next can start. | CONFIGURABLE -- tenant setting. |
| BR-PRD-010 | `actualQty` cannot exceed `plannedQty`. Total `actualQty` across all sub-operations for a sequence cannot exceed the Production's `plannedQty`. | HARD -- Service layer validation. |
| BR-PRD-011 | Cancelling any operation cascades: ALL operations for that production are cancelled, and the parent Production is cancelled. | HARD -- Service layer cascade. |

### Recipe / BOM

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PRD-012 | Sub-recipes (`isSubRecipe = true`) are recursively expanded during production and document explosion. | HARD -- Service layer recursion. |
| BR-PRD-013 | **Maximum producible quantity** is calculated as `min(stock[component] / inputQty[component])` across all stocked components, rounded down. | HARD -- Calculation rule. |
| BR-PRD-014 | **Cross-document explosion:** The same Recipe entity drives BOM explosion in sales invoices, sales orders, quotations, purchase orders, cash invoices, stock depreciations, returns, and budget lines. | HARD -- Shared service. |

### Production Plan / MRP

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PRD-015 | Monthly plans: `startDate` must be 1st of month. Weekly plans: `startDate` must be Monday. Only one plan per item per overlapping period is allowed. | HARD -- Service layer validation. |

---

## 9. POS Module Rules (POS-xxx)

All rules from section 2.24, explicitly coded.

| Code | Description | Enforcement |
|------|-------------|-------------|
| POS-001 | Session must be open before sales can be recorded. Validate `POSSession.status = OPEN` for the terminal. | CONFIGURABLE -- `pos.requireOpenSession` setting. |
| POS-002 | Only one open session per terminal+drawer combination. | HARD -- Unique constraint `uq_pos_sessions_one_open_per_terminal_drawer`. |
| POS-003 | A user cannot belong to two open sessions simultaneously. | HARD -- Application-layer check. |
| POS-004 | Session must be closed before cashup can run. `POSCashup` creation requires `POSSession.status = CLOSED`. | HARD -- Service layer guard. |
| POS-005 | Voiding a completed sale requires supervisor approval. `pos.void_sale` RBAC permission checked. | HARD -- RBAC permission. |
| POS-006 | Returns require a customer when `pos.requireReturnCustomer` is enabled. | CONFIGURABLE -- tenant setting. |
| POS-007 | Returns require a reason code when `pos.requireReturnReason` is enabled. | CONFIGURABLE -- tenant setting. |
| POS-008 | Item scanning behaviour configurable: new row vs. increment quantity. Default: increment existing line quantity. | CONFIGURABLE -- `pos.newRowInsteadOfIncrementQuantity`. |
| POS-009 | Sale total must equal sum of payment amounts minus change. `totalAmount = SUM(POSPayment.amount) - changeGiven`. | HARD -- Service layer validation on completion. |
| POS-010 | Change can only be given for payment methods with `allowsOverTender = true`. | HARD -- Service layer guard. |
| POS-011 | Cashup GL posting creates balanced journal entry. Debit: bank/cash per payment method. Credit: POS clearing account. Variances to write-off account. | HARD -- GL posting service. |
| POS-012 | GL posting is deferred to cashup, not per-sale. Individual POSSale records do not create journal entries. | HARD -- Architecture design. |
| POS-013 | Stock deduction is deferred for performance. Scheduled maintenance job (`POSStockUpdateService`) processes undeducted sales. | CONFIGURABLE -- `pos.stockUpdateInterval` setting. |
| POS-014 | Voided lines do not contribute to sale totals. `POSSaleLine.status = VOIDED` excluded from recalculation. | HARD -- Service layer calculation. |
| POS-015 | Suspended sales can be resumed on any terminal in the same location. | HARD -- Service layer query + reassignment. |
| POS-016 | Z-report resets counters; X-report does not. Z-report increments sequence in `SystemSetting('pos.lastZReportNumber')`. | HARD -- Service layer. |
| POS-017 | Every significant POS action creates an immutable journal entry. `POSJournalEntry` records have no update/delete operations. | HARD -- Append-only table. |
| POS-018 | Offline terminals use pre-allocated serial number blocks. On reconnection, `offlineUuid` prevents duplicates. | HARD -- Idempotency via UUID. |
| POS-019 | Auto-finish configurable per sale. When enabled and total tendered covers sale total, sale auto-completes. | CONFIGURABLE -- `pos.autoFinishAfterPayment`. |
| POS-020 | Transfer to Invoice creates a proper AR invoice. `TransferToInvoice` service creates `CustomerInvoice` (type = CASH) in AR module. | HARD -- Cross-module integration. |

---

## 10. Projects Module Rules (PRJ-xxx, TS-xxx, EXP-xxx, INV-xxx)

All rules from section 2.25, explicitly coded.

### Project Rules (PRJ)

| Code | Description | Enforcement |
|------|-------------|-------------|
| PRJ-001 | Project number required and unique. Enforced by `@unique` constraint and NumberSeries auto-generation. | HARD -- DB constraint + NumberSeries. |
| PRJ-002 | Customer required for billable projects. If `billingMethod != NON_BILLABLE` then `customerId` must be set. | HARD -- Service layer validation. |
| PRJ-003 | End date must be after start date. Validate: `endDate > startDate` (when both set). | HARD -- Service layer validation. |
| PRJ-004 | Only ACTIVE projects accept time/expense entries. Guard: check `project.status = ACTIVE`. | HARD -- Service layer guard. |
| PRJ-005 | Budget amount must be positive. Validate: `budgetAmount >= 0`. | HARD -- Service layer validation. |
| PRJ-006 | Cannot delete project with transactions. Guard: if `ProjectTransaction.count > 0`, reject deletion. | HARD -- Service layer guard. |
| PRJ-007 | Cannot complete project with uninvoiced billable transactions. Warn (not block): if `uninvoicedAmount > 0` when status -> COMPLETED. | SOFT -- Warning only. |
| PRJ-008 | Only one active budget per project. When setting `ProjectBudget.isActive = true`, deactivate all others for same project. | HARD -- Service layer toggle. |

### Timesheet Rules (TS)

| Code | Description | Enforcement |
|------|-------------|-------------|
| TS-001 | Timesheet period cannot overlap with existing timesheet for same employee. Enforced by `@@unique([employeeId, periodStartDate])`. | HARD -- DB unique constraint. |
| TS-002 | Entry date must fall within timesheet period. Validate: `periodStartDate <= entryDate <= periodEndDate`. | HARD -- Service layer validation. |
| TS-003 | Hours must be positive and <= 24. Validate: `0 < hours <= 24`. | HARD -- Service layer validation. |
| TS-004 | Cannot edit SUBMITTED or APPROVED timesheet. Guard: reject edits if `status IN (SUBMITTED, APPROVED)`. | HARD -- Service layer guard. |
| TS-005 | Rejection returns timesheet to DRAFT. Transition: SUBMITTED -> REJECTED resets status to DRAFT. | HARD -- Service layer state machine. |
| TS-006 | Approval creates ProjectTransactions. Side effect: for each entry, create ProjectTransaction with sourceType = TIMESHEET. | HARD -- Service layer side effect. |
| TS-007 | Project must be ACTIVE for time entry. Validate: referenced project must have `status = ACTIVE`. | HARD -- Service layer validation. |
| TS-008 | Billable rate resolved from rate card. Service: lookup ProjectRateCard entries by employee/role/item, fall back to PriceList. | HARD -- Waterfall resolution. |

### Expense Rules (EXP)

| Code | Description | Enforcement |
|------|-------------|-------------|
| EXP-001 | Expense must reference an ACTIVE project. Validate: `project.status = ACTIVE`. | HARD -- Service layer validation. |
| EXP-002 | Approval creates ProjectTransaction. Side effect: create ProjectTransaction with sourceType = EXPENSE. | HARD -- Service layer side effect. |
| EXP-003 | Total amount = quantity x unitPrice. Computed field, validated on save. | HARD -- Computed validation. |
| EXP-004 | Base amount calculated from exchange rate. Computed: `baseAmount = totalAmount * exchangeRate`. | HARD -- Computed field. |
| EXP-005 | Billable amount includes markup. Computed: `billableAmount = totalAmount * (1 + markupPercent / 100)`. | HARD -- Computed field. |

### Project Invoicing Rules (INV)

| Code | Description | Enforcement |
|------|-------------|-------------|
| INV-001 | T&M invoice includes only APPROVED, uninvoiced transactions. Filter: `status = APPROVED AND invoiceId IS NULL AND isBillable = true`. | HARD -- Service layer filter. |
| INV-002 | Fixed-price invoice follows milestone schedule. Invoice amount from `ProjectInvoiceSchedule.amount`, not from transaction totals. | HARD -- Service layer logic. |
| INV-003 | Invoicing updates Project.invoicedAmount and uninvoicedAmount. Atomic counter updates within invoice creation transaction. | HARD -- DB transaction. |
| INV-004 | Cannot invoice transactions from ON_HOLD project. Guard: project must be ACTIVE or COMPLETED. | HARD -- Service layer guard. |
| INV-005 | Multi-currency: invoice in project currency. Invoice created in `project.currencyCode`, with exchange rate at invoice date. | HARD -- Service layer. |

---

## 11. Contracts Module Rules (BR-CON-xxx)

Rules derived from section 2.26. No explicit BR-CON-xxx codes used; rules are documented via lifecycle tables.

### Agreement (Rental) Lifecycle

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CON-001 | **DRAFT -> ACTIVE (approve):** Validates customer exists and is not blocked, at least 1 line, startDate set. Sets isApproved=true. | HARD -- Service layer validation. |
| BR-CON-002 | **ACTIVE -> CLOSED:** Validates all items off-hired/returned. Final charges generated if needed. | HARD -- Service layer guard. |
| BR-CON-003 | **ACTIVE -> CANCELLED:** Validates no uninvoiced charges pending (must invoice or void first). | HARD -- Service layer guard. |
| BR-CON-004 | **Fields editable when ACTIVE/approved:** Only `endDate`, `cancelDate`, `salesPersonId`, `clientContact`, `invoiceComment`, `startDate`. All other fields are protected. | HARD -- Service layer field-level guard. |

### Agreement Charging Logic

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CON-005 | **Charge period calculation:** Start = MAX(lastChargeDate, startInvoicing, agreement.startDate); End = MIN(batchChargeDate, endInvoicing, agreement.endDate). | HARD -- Service layer calculation. |
| BR-CON-006 | **Minimum charge enforcement** from `AgreementType.minimumChargeQuantity`. | HARD -- Service layer. |
| BR-CON-007 | **Bank holiday exclusion** configurable per AgreementType for daily-rated agreements. | CONFIGURABLE -- AgreementType setting. |

### Agreement Invoice Generation

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CON-008 | **Invoice grouping modes:** PER_AGREEMENT (one invoice per agreement), PER_CUSTOMER (merge charges across agreements for same customer), SPLIT_BY_SITE (separate per site). | CONFIGURABLE -- Per-agreement setting. |
| BR-CON-009 | **Invoice base modes:** PER_CHARGE (each charge = one invoice line), PER_LINE (charges grouped by agreement line), PER_AGREEMENT (all charges summed into one line). | CONFIGURABLE -- Per-agreement setting. |
| BR-CON-010 | **VAT code resolution cascade:** Item VAT code -> Customer default VAT code -> System default. | HARD -- Waterfall resolution. |

### Standard Contract Lifecycle

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CON-011 | **DRAFT -> ACTIVE (approve):** Validates customer, at least 1 line, startDate/endDate, periodLength set. | HARD -- Service layer validation. |
| BR-CON-012 | **ACTIVE -> RENEWED (renew):** Creates new Contract record (copy lines, advance dates by periodLength). Sets cross-references. | HARD -- Service layer. |
| BR-CON-013 | **ACTIVE -> EXPIRED:** Triggered by scheduled job when endDate < today and no renewal. | HARD -- Background job. |
| BR-CON-014 | **ACTIVE -> CANCELLED (cancel):** Validates no uninvoiced periods pending. | HARD -- Service layer guard. |

### Loan Agreement Lifecycle

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-CON-015 | **NEW -> APPROVED:** Validates customer, principalAmount > 0, interestRate set, months > 0, scheduleType set. | HARD -- Service layer validation. |
| BR-CON-016 | **APPROVED -> SIGNED:** Generates repayment schedule (LoanScheduleRow records). | HARD -- Service layer schedule generation. |
| BR-CON-017 | **SIGNED -> ACTIVE:** Creates GL Transaction: Debit loanAssetAccountCode, Credit arAccountCode for principalAmount. | HARD -- GL posting service. |
| BR-CON-018 | **DISBURSED -> FINISHED:** Auto-triggered when all LoanScheduleRow records have invoiceId set. | HARD -- Service layer auto-transition. |
| BR-CON-019 | **NEW/APPROVED only states that can be CANCELLED.** No financial impact in these states. | HARD -- Service layer guard. |
| BR-CON-020 | **ACTIVE -> DISBURSED (disburse):** Creates Purchase Invoice via AP to disburse funds. Sets disbursementDate. | HARD -- GL posting service. |
| BR-CON-021 | **DISBURSED -> PAUSED (pause):** Suspends scheduled invoicing. No financial impact. | HARD -- Service layer. |
| BR-CON-022 | **PAUSED -> DISBURSED (resume):** Resumes scheduled invoicing from next due date. | HARD -- Service layer. |

---

## 12. Cross-Cutting Rules (BR-SYS-xxx)

Rules derived from section 2.20, plus system-wide patterns.

### Approval Workflow

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-SYS-001 | **Approval rules are configurable per entity type.** `ApprovalRule.entityType` determines which entities require approval. Rules support multi-level escalation with `ApprovalRuleLevel` records ordered by `levelOrder`. | CONFIGURABLE -- Admin configuration. |
| BR-SYS-002 | **Approval requests follow a strict status lifecycle:** PENDING -> APPROVED/REJECTED/ESCALATED/FORWARDED/CANCELLED. | HARD -- Service layer state machine. |
| BR-SYS-003 | **Amount thresholds trigger escalation.** `ApprovalRuleLevel.amountThreshold` determines which level is needed based on the entity's monetary value. | HARD -- Service layer routing. |
| BR-SYS-004 | **Auto-escalation on timeout.** If `autoEscalate = true` and `timeoutHours` is set, pending requests automatically escalate to the next level. | HARD -- Background job. |
| BR-SYS-005 | **Approval scope can be PER_RECORD or PER_LINE.** PER_RECORD requires one approval for the entire document; PER_LINE requires approval for each line item. | CONFIGURABLE -- Per-rule setting. |

### Attachment Rules

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-SYS-006 | **File size within configured maximum** (default 50 MB). | CONFIGURABLE -- System setting. |
| BR-SYS-007 | **MIME type must be in allowlist** (no executables). | HARD -- Service layer validation. |
| BR-SYS-008 | **Pre-signed URL upload pattern.** Files are never streamed through the application server. Browser uploads directly to S3/MinIO. | HARD -- Architecture design. |
| BR-SYS-009 | **Entity validation before attachment creation.** The service layer validates that the referenced entity exists before creating an Attachment record. | HARD -- Service layer validation. |
| BR-SYS-010 | **Cascade-aware deletion.** When an entity is deleted, its cross-cutting records (attachments, notes, links) are cleaned up via the event bus. | HARD -- Event bus handler. |

### Number Series

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-SYS-011 | **Number generation is atomic.** The `nextNumber()` function generates the next sequential number within a database transaction to prevent duplicates under concurrent creation. | HARD -- DB transaction. |
| BR-SYS-012 | **Number series support date-range-based sub-ranges** with overlap validation. | HARD -- Service layer validation. |

### Polymorphic Entity Pattern

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-SYS-013 | **Application-layer validation compensates for lack of DB FK** on polymorphic `entityId`. The service layer validates that the referenced entity exists before creating cross-cutting records. | HARD -- Service layer. |
| BR-SYS-014 | **Enum-like constraint on entityType.** The application maintains a registry of valid entity type strings. | HARD -- Service layer. |

---

## 12b. RBAC & Access Group Rules (BR-RBAC-xxx)

Rules governing the granular RBAC system introduced in E2b. See full design: `docs/plans/2026-02-19-granular-rbac-access-groups-design.md`.

### Permission Resolution

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-RBAC-001 | **Permission resolution uses most-permissive-wins across all user access groups.** When a user belongs to multiple access groups, permissions for the same resource are merged by OR-ing each flag: `canAccess = OR(all), canNew = OR(all), canView = OR(all), canEdit = OR(all), canDelete = OR(all)`. Field visibility merges similarly: `VISIBLE > READ_ONLY > HIDDEN` (most permissive wins). | HARD -- Permission resolution algorithm in `createPermissionGuard()`. |
| BR-RBAC-002 | **SUPER_ADMIN bypasses the permission matrix entirely.** Users with `SUPER_ADMIN` in `UserCompanyRole` skip all access group checks and are granted full access to every resource and action. | HARD -- Permission guard short-circuit. |
| BR-RBAC-005 | **Field visibility defaults to VISIBLE when no override exists.** If no `AccessGroupFieldOverride` row exists for a given access group + resource + field combination, the field is treated as fully visible and editable. | HARD -- Permission resolution default. |

### Access Group Management

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-RBAC-003 | **System access groups (`isSystem = true`) cannot be deleted, only modified or cloned.** Pre-built access groups shipped in the default data file are protected from deletion. Admins may change their permissions and field overrides, or clone them to create custom variants. | HARD -- Service layer guard on delete. |
| BR-RBAC-004 | **Company creator is automatically assigned the FULL_ACCESS group.** When a new company is created, the creating user is assigned the `FULL_ACCESS` system access group for that company, ensuring they have full permissions from the start. | HARD -- Company creation service side effect. |
| BR-RBAC-008 | **Non-ADMIN users cannot manage access groups or assign them to other users.** Only users with `ADMIN` or `SUPER_ADMIN` in `UserCompanyRole` can create, modify, or delete access groups, and assign or remove access group memberships. | HARD -- Permission guard on access group management endpoints. |

### Module Navigation & Default Data

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-RBAC-006 | **Module access is derived from access group permissions.** If any resource in a module has `canAccess = true` for the user (after merging all their access groups), the module navigation item is shown. The `enabledModules` field on User is removed; module visibility is fully driven by the permission matrix. | HARD -- Navigation rendering + route guard. |
| BR-RBAC-007 | **Default data file is imported on company creation when provided.** The JSON file at `packages/db/default-data/company-defaults.json` is imported during company creation, seeding resources, access groups with permissions and field overrides, VAT codes, payment terms, number series, and currencies. This file is editable without code changes and supports industry variants. | HARD -- Company creation service. |

---

## 13. Additional Module Rules

### Fixed Assets Rules (Section 2.18)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-FA-001 | **Depreciation never reduces currentBookValue below salvageValue.** Floor rule applied across all depreciation methods. | HARD -- Calculation engine. |
| BR-FA-002 | **Depreciation does not run for assets with status FULLY_DEPRECIATED, DISPOSED, or WRITTEN_OFF.** | HARD -- Service layer filter. |
| BR-FA-003 | **Depreciation does not run for assets with status UNDER_CONSTRUCTION** (not yet capitalised). | HARD -- Service layer filter. |
| BR-FA-004 | **If remaining depreciable amount for a period is less than the calculated amount, the charge is capped at the remaining amount.** | HARD -- Calculation engine. |
| BR-FA-005 | **Depreciation run validates:** period exists, period is not locked, period not already fully run. | HARD -- Service layer validation. |
| BR-FA-006 | **No existing DepreciationEntry for this asset + period** (unique constraint prevents double-running). | HARD -- DB unique constraint. |
| BR-FA-007 | **All depreciation calculations use Decimal(19, 4)** -- no floating-point arithmetic. | HARD -- Schema + calculation code. |
| BR-FA-008 | **Dual-basis depreciation supported.** Book depreciation (management accounts via FRS 102) and fiscal depreciation (HMRC capital allowances) run independently on the same asset. | HARD -- Dual calculation paths. |
| BR-FA-009 | **Asset disposal runs remaining depreciation up to disposal date (pro-rata)** before calculating gain/loss. | HARD -- Disposal workflow. |
| BR-FA-010 | **Disposal creates balanced GL journal entry.** Debit bank/AR (proceeds) + accumulated depreciation; Credit asset account + disposal gain (or debit disposal loss). | HARD -- GL posting service. |
| BR-FA-011 | **Disposed assets set status = DISPOSED, endDate = disposalDate, isActive = false.** | HARD -- Service layer side effects. |
| BR-FA-012 | **Asset transaction records are append-only** (no `updatedAt`/`updatedBy` fields). | HARD -- Schema design. |

### Pricing Rules (Section 2.19)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PRC-001 | **Price resolution follows a most-specific-wins waterfall:** Level 1: Customer + Item specific -> Level 2: Quantity break within customer entry -> Level 3: Item in generic price list -> Level 3b: Formula-derived price -> Level 3c: Replacement (fallback) price list -> Level 4: Vendor purchase price (last purchase) -> Level 5: Item base price (`salesPrice`). | HARD -- Resolution algorithm. |
| BR-PRC-002 | **`noOtherPricing` flag is a hard stop.** If a `PriceListEntry` has `noOtherPricing = true`, the resolution engine returns immediately -- no further levels are checked. Used for contracted prices. | HARD -- Resolution algorithm short-circuit. |
| BR-PRC-003 | **Price list validity is date-checked.** `startDate` and `endDate` on both `PriceList` and `PriceListEntry` are validated against the transaction date. Entries outside their validity window are skipped. | HARD -- Service layer filter. |
| BR-PRC-004 | **Unique constraint on `[priceListId, itemId, customerId]`.** One entry per item per customer (or null for generic) per price list. | HARD -- DB unique constraint. |
| BR-PRC-005 | **Quantity breaks refine within a given entry.** When `fromQuantity <= requestedQty <= toQuantity`, the break price or discount percentage applies. | HARD -- Service layer. |
| BR-PRC-006 | **Replacement (fallback) price list chain.** If a price list has `replacementPriceListId` set and no entry is found, the resolver recurses into the replacement list. Prevents falling to item base price. | HARD -- Recursive resolution. |
| BR-PRC-007 | **Formula pricing computes from a configurable base source** (COST_PRICE, SALES_PRICE_1/2/3, LAST_PURCHASE_PRICE, WEIGHTED_AVERAGE, BASE_PRICE_LIST) with markup percent, additions, and rounding. | HARD -- Calculation engine. |

### Warehouse Management Rules (BR-WMS-xxx) (Section 2.27)

All rules from section 2.27, explicitly coded.

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-WMS-001 | **Position tracking is opt-in per warehouse.** Controlled by `WarehouseWmsConfig.positionTrackingEnabled`. Disabling is only permitted if no `PositionStock` records with non-zero quantities exist. | CONFIGURABLE + HARD guard. |
| BR-WMS-002 | **Bin position status lifecycle:** FREE -> OCCUPIED (on stock placement) -> RESERVED (on allocation) -> ERROR (on discrepancy). ERROR requires manual resolution before returning to FREE. Special positions are exempt from automatic status changes. | HARD -- Service layer state machine. |
| BR-WMS-003 | **Dimension checking before placement.** Item pallet width/height/depth must not exceed position max width/height/depth. Cumulative dimensions of existing items at the position are considered. Null dimension fields skip the check (permissive default). | HARD -- Service layer validation. |
| BR-WMS-004 | **Find free position algorithm.** Priority: specified target zone -> any zone -> fallback. `highestPositionFirst` flag controls sort direction. Positions with pending tasks excluded. | HARD -- Service layer algorithm. |
| BR-WMS-005 | **Pick order propagation.** When `BinPosition.pickOrder` changes, all `PositionStock.pickOrder` values at that position are updated (denormalised for query speed). | HARD -- Service layer cascade. |
| BR-WMS-006 | **Pick area replenishment automation.** Iterates `PositionStock`, identifies items below threshold in pick zone, limits pallets per item via `maxPalletsInPickArea`, and creates stock movements with `forkliftQueued = true`. | HARD -- Background job / on-demand. |
| BR-WMS-007 | **Forklift task queue priority.** EXPRESS before DEFAULT, then FIFO. Concurrent forklifts limited by `maxForkliftsPickMode`. Conveyor conflict detection (WAITING_CONVEYOR status). | HARD -- Service layer dispatch. |
| BR-WMS-008 | **Warehouse cannot be deactivated if any PositionStock records have non-zero quantityOnHand.** | HARD -- Service layer guard. |
| BR-WMS-009 | **BinPosition can only be deleted if status = FREE and no PositionStock records reference it.** | HARD -- Service layer guard. |
| BR-WMS-010 | **Picking list generation from delivery.** Full pallet = search pick zone first; partial = pick zone preferentially. Excludes special positions. Assigns pickSequence from pickOrder. | HARD -- Service layer algorithm. |
| BR-WMS-011 | **Stock movement position tracking integration.** fromBinPositionId/toBinPositionId must reference valid, non-closed positions. PositionStock updates are atomic with StockBalance updates. Source position -> FREE transition when quantity reaches zero. | HARD -- DB transaction. |
| BR-WMS-012 | **Forklift task full confirmation mode.** Each task must be explicitly confirmed before next dispatch. Operator must enter pallet ID, confirm source/destination. Discrepancies trigger ERROR status on the position. | HARD -- Service layer (when mode = FULL_CONFIRMATION). |

### Intercompany & Consolidation Rules (BR-1 through BR-15) (Section 2.28)

All rules from section 2.28, explicitly coded.

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-1 | **Circular reference prevention.** A tenant cannot be both parent and child of the same tenant within a consolidation group. Chain walk validation before adding a member. | HARD -- `ConsolidationGroupService.addMember()`. |
| BR-2 | **Ownership percentage time-series.** Applicable percentage for a given report date is the most recent `OwnershipPercentage` record where `effectiveDate <= reportDate`. Default: 100%. | HARD -- Service layer lookup. |
| BR-3 | **Member date range filtering.** A member is included only if `startDate <= reportDate` and (`endDate IS NULL` or `endDate >= reportDate`). | HARD -- Service layer filter. |
| BR-4 | **Account type determines exchange rate.** Balance Sheet accounts use `balanceSheetRate` (closing rate). P&L accounts use `profitAndLossRate` (average rate). | HARD -- Service layer mapping. |
| BR-5 | **Elimination must span full months.** Date ranges must start on 1st of month and end on last day of month. | HARD -- Validation error on violation. |
| BR-6 | **Transaction lock date respected.** Intercompany NL transactions cannot be created if target transaction date falls on or before the target tenant's lock date. | HARD -- Cross-tenant validation. |
| BR-7 | **Debit/credit reversal in target.** When mirroring to target tenant, amounts are REVERSED: source debit becomes target credit and vice versa. | HARD -- Mirroring service. |
| BR-8 | **Double-entry in target.** Each intercompany rule match produces exactly TWO rows in the target journal: mirror row (reversed) + contra row (original direction). Target journal must balance. | HARD -- Service layer validation. |
| BR-9 | **Object matching hierarchy.** Rules WITH `sourceObjects` are matched first. Only if no object-specific rule matches are catch-all rules (null sourceObjects) considered. | HARD -- Two-pass matching algorithm. |
| BR-10 | **VAT number matching for PO-to-SO.** Customer in target tenant looked up by matching originating tenant's VAT registration number. Saga fails if no match. | HARD -- Cross-tenant lookup. |
| BR-11 | **Saga idempotency.** Unique `correlationId` per IntercompanyTransaction. Duplicate submission returns existing transaction. | HARD -- Idempotency check. |
| BR-12 | **Consolidation account mapping required.** Only accounts with `ConsolidationAccountMap` rows are included. Unmapped accounts silently excluded. | HARD -- Service layer filter. |
| BR-13 | **Cross-currency consolidation.** When source and target base currencies differ, amounts are converted using exchange rate valid on transaction date. | HARD -- Currency conversion service. |
| BR-14 | **Elimination output modes: JOURNAL (real GL entry) and SIMULATION (draft/what-if).** Configured per template. | CONFIGURABLE -- Per-template setting. |
| BR-15 | **Self-company exclusion.** The `motherTenantId` cannot also appear as a ConsolidationMember in the same group. Prevents double-counting. | HARD -- Service layer validation. |

### Communications Rules (BR-COM-xxx) (Section 2.29)

All rules from section 2.29, explicitly coded.

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-COM-001 | Email recipient address must be valid. Internal userId must exist; external address must pass RFC 5322 format check. | HARD -- Service layer validation. |
| BR-COM-002 | Duplicate recipients not allowed per message. Unique constraint on (emailMessageId, emailAddress, recipientType). | HARD -- Service layer / DB constraint. |
| BR-COM-003 | Cannot un-send a queued/sent email. Guard: if status IN (PROCESSING, SENT), reject status change back to DRAFT. | HARD -- Service layer guard. |
| BR-COM-004 | Auto-reply must not loop. Check isAutoGenerated, isBounce, isMailingList flags before sending auto-reply. | HARD -- Service layer guard. |
| BR-COM-005 | Auto-reply rate limited to 3 per sender per day. Redis counter with TTL per (userId, senderEmail, date). | HARD -- Rate limiter. |
| BR-COM-006 | Conference name must be unique. Unique constraint on ConferenceRoom.name. | HARD -- DB constraint. |
| BR-COM-007 | Conference access inherits from parent. Child access cannot exceed parent access level (chain walk). | HARD -- Service layer validation. |
| BR-COM-008 | Closed conference rejects new posts. Guard: check `ConferenceRoom.isClosed`. | HARD -- Service layer guard. |
| BR-COM-009 | Email signature appended once. Service tracks insertion; prevents double-append on re-queue. | HARD -- Service layer logic. |
| BR-COM-010 | Document-to-email requires valid template. Validate EmailTemplate exists for documentType; fall back to system default. | HARD -- Service layer with fallback. |
| BR-COM-011 | Mass mail requires explicit user confirmation. Campaign status: DRAFT -> SCHEDULED -> RUNNING; no auto-start. | HARD -- Service layer state machine. |
| BR-COM-012 | Chat messages are soft-deleted. Content retained for audit but hidden from UI. | HARD -- Schema design. |
| BR-COM-013 | AI chatbot actions require user confirmation. AI Engine must surface proposed action before executing create/modify/delete operations. | HARD -- AI guardrail (NFR16). |
| BR-COM-014 | Notification preferences cascade from template defaults. If user has no preference, use template's defaultChannels. | HARD -- Cascade logic. |
| BR-COM-015 | Email attachments use S3 presign flow. All file attachments go through the Attachment upload pipeline (section 2.20), never stored inline. | HARD -- Architecture design. |
| BR-COM-016 | Mail acceptance requires explicit action. When `requiresAcceptance = true`, system cannot auto-accept. | HARD -- Service layer guard. |
| BR-COM-017 | Conference retention policy enforced by scheduled job. Background job purges messages exceeding maxMessages or maxAgeDays per ConferenceRoom. | HARD -- Background cron job (BullMQ). |

### Service Orders & Timekeeper Rules (Section 2.30)

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-SVO-001 | **Service order status transitions:** DRAFT -> OPEN -> IN_PROGRESS -> COMPLETED -> INVOICED. CANCELLED only from DRAFT/OPEN. ON_HOLD reachable from IN_PROGRESS via putOnHold(); returns to IN_PROGRESS via resume(). | HARD -- Service layer state machine. |
| BR-SVO-002 | **COMPLETED requires:** All work orders closed, all open work sheets approved, `CompletingServiceOrders` permission. | HARD -- Service layer guard + RBAC. |
| BR-SVO-003 | **CANCELLED blocked if linked WO/WS/invoices exist.** | HARD -- Service layer guard. |
| BR-SVO-004 | **Service order cannot be deleted if any linked records exist** (work orders, work sheets, invoices, activities). Error lists blocking records. | HARD -- Service layer guard. |
| BR-SVO-005 | **Warranty auto-classification on serial number entry.** System looks up KnownSerialNumber and sets itemType (WARRANTY/CONTRACT/INVOICEABLE/PLAIN) based on warranty dates and contract validity. | HARD -- Service layer auto-classification. |
| BR-SVO-006 | **Sub-item lines inherit itemType from parent main-item line.** | HARD -- Service layer inheritance. |
| BR-SVO-007 | **Service-to-invoice collects only INVOICEABLE work sheet lines.** WARRANTY and CONTRACT lines are excluded from customer invoicing. | HARD -- Service layer filter. |
| BR-SVO-008 | **DisallowWSFromSVO permission** (inverted logic): if set, work sheet creation from service order is blocked. | HARD -- RBAC permission. |
| BR-SVO-009 | **DisallowInvoiceMoreThanQuoted setting enforced** when creating invoice from quoted service order. | CONFIGURABLE -- System setting. |

### Timekeeper Rules

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-TK-001 | **Cannot clock in if already clocked in.** Check for existing open WORK_HOURS Activity for user today (status = IN_PROGRESS). | HARD -- Service layer guard. |
| BR-TK-002 | **Cannot clock out if not clocked in.** Must have an open WORK_HOURS Activity. | HARD -- Service layer guard. |
| BR-TK-003 | **Automatic clock-out on logout.** If user has Timekeeper role with mandatory clock-in enforcement, system triggers clock-out on session expiry. | HARD -- Session hook. |
| BR-TK-004 | **Overnight shift handling.** If endDate > startDate, duration = (midnight - startTime) + endTime. | HARD -- Calculation logic. |
| BR-TK-005 | **Break is modelled as clock-out + immediate clock-in**, producing two Activity records with an implicit gap. | HARD -- Service layer pattern. |

---

## 14b. Platform Admin Rules (BR-PLT-xxx)

Rules governing tenant lifecycle, billing enforcement, AI quota management, and platform operations. Enforced in the Platform API (separate from ERP tenant databases). Source: Architecture §2.31, FR193-FR222, NFR46-NFR51.

### Tenant Lifecycle

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PLT-001 | **Tenant status transitions follow strict state machine.** PROVISIONING→ACTIVE→SUSPENDED→ARCHIVED. Only ACTIVE tenants can be suspended. Only SUSPENDED tenants can be reactivated to ACTIVE. Only SUSPENDED tenants can be archived. No hard-delete in the UI. | HARD -- Service layer state machine. |
| BR-PLT-002 | **Tenant suspension takes effect within 30 seconds.** Platform pushes `tenant.suspended` event via webhook to bust ERP entitlement cache. ERP blocks login and write operations for suspended tenants. | HARD -- Webhook + cache invalidation. NFR51. |
| BR-PLT-003 | **Archived tenants are irrecoverable from the UI.** Database remains for regulatory retention but tenant cannot be reactivated. Only manual DB intervention (by engineering) can restore. | HARD -- Service layer guard. |

### Billing Enforcement

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PLT-004 | **Billing enforcement escalation: NONE→WARNING→READ_ONLY→SUSPENDED.** Each level is triggered by configurable dunning rules (grace period expiry, payment failure count). | CONFIGURABLE -- Per-tenant grace period and dunning thresholds. |
| BR-PLT-005 | **READ_ONLY enforcement blocks all write operations in the ERP.** Tenant users can still log in and view data but cannot create, update, or delete any records. Billing notice displayed on every page. | HARD -- ERP checks `enforcementAction` from cached entitlements before every write operation. |
| BR-PLT-006 | **Plan change takes immediate effect.** When a tenant is assigned a new plan, the `tenant.plan_changed` event is pushed to the ERP webhook, busting the entitlement cache. New module entitlements and user limits apply on next page load. | HARD -- Webhook + cache invalidation. |

### AI Quota Enforcement

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PLT-007 | **All AI calls must route through the AI Gateway.** No ERP module may call the Claude API or any LLM provider directly. The AI Gateway is the single enforcement point. | HARD -- Architecture constraint. packages/ai-gateway is the only dependency with LLM SDK credentials. |
| BR-PLT-008 | **AI Gateway checks quota before every call.** If `plan.aiHardLimit = true` and usage >= hard limit, the call is blocked with `AI_QUOTA_EXCEEDED`. If `aiHardLimit = false`, overage is allowed with logging. | CONFIGURABLE -- Per-plan hard limit flag. Default true. |
| BR-PLT-009 | **AI usage records are durable.** Every billable AI call produces a `TenantAiUsage` record with traceId, tokens, cost snapshot, and feature key. If Platform API is unreachable, records are queued locally and synced later. Zero-loss guarantee. | HARD -- Local queue + retry. NFR50. |
| BR-PLT-010 | **Quota alerts at configurable thresholds.** Default: 50%, 80%, 100%. Each threshold triggers `tenant.quota_warning` event. Platform admin receives notification. ERP shows warning banner to tenant users at soft limit. | CONFIGURABLE -- Per-tenant soft/hard limit percentages. |
| BR-PLT-011 | **Unusual AI usage spikes are flagged.** If a tenant's daily usage exceeds 3x their rolling 7-day average, an alert is raised for platform admin investigation. | INFORMATIONAL -- Background job analysis. |

### Impersonation Safeguards

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PLT-012 | **Impersonation requires mandatory reason.** Platform admin must provide a text justification before starting an impersonation session. Empty reason is rejected. | HARD -- Service layer validation. |
| BR-PLT-013 | **Impersonation is time-limited.** Maximum session duration is configurable (default 60 minutes). Session auto-terminates at expiry. | HARD -- Service layer + background job. |
| BR-PLT-014 | **Impersonation is always bannered.** During impersonation, the ERP displays a permanent, non-dismissable banner: "You are impersonating [tenant name] — session expires in X minutes". | HARD -- Frontend middleware. |
| BR-PLT-015 | **Every impersonation action is audit-logged.** All actions performed during impersonation are recorded in both the platform audit log and the tenant's own audit log (with `impersonatedBy` metadata). | HARD -- Audit service. FR200. |

### Platform Audit

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PLT-016 | **Platform audit log is immutable.** No update or delete operations on `PlatformAuditLog` records. Append-only by design. | HARD -- Schema + service layer (no update/delete endpoints). NFR49. |
| BR-PLT-017 | **Every state-changing platform admin action is logged.** Tenant lifecycle changes, plan changes, quota changes, user resets, impersonation sessions, data access events — all produce audit log entries with actor, timestamp, IP, and details. | HARD -- Service layer middleware. |
| BR-PLT-018 | **Platform admin MFA is mandatory for PLATFORM_ADMIN role.** Login without MFA verification is blocked for PLATFORM_ADMIN accounts. PLATFORM_VIEWER accounts may have MFA optional (configurable). | HARD -- Auth middleware. NFR48. |

### ERP Integration

| Code | Description | Enforcement |
|------|-------------|-------------|
| BR-PLT-019 | **ERP must check entitlements at login.** Every tenant login calls `GET /platform/tenants/:id/entitlements` (or serves from cache). Login is blocked if tenant status is SUSPENDED or ARCHIVED. | HARD -- ERP auth middleware. FR219. |
| BR-PLT-020 | **ERP degrades gracefully if Platform API is unreachable.** Circuit breaker serves last-cached entitlements with `degraded: true` flag. AI usage records are queued locally. ERP never crashes due to Platform outage. | HARD -- Platform Client SDK circuit breaker. FR222. |
| BR-PLT-021 | **Module access requires both plan entitlement and user permission.** The ERP checks plan-level `enabledModules` from cached Platform entitlements AND user-level access group permissions (if any resource in a module has `canAccess = true`). A module is shown only if the plan includes it AND the user has at least one accessible resource in it. Disabled modules are hidden from navigation and blocked at the API layer. | HARD -- Platform entitlement check + permission guard. FR220. |

---

## 14. Implicit Rules (Extracted from Architecture)

These rules are not explicitly coded as BR-xxx but are enforced by the architecture and represent fundamental system constraints.

### Data Integrity

| Rule | Description | Source | Enforcement |
|------|-------------|--------|-------------|
| IMP-001 | **Database-per-tenant isolation.** No `tenant_id` columns in ERP tables. Connection routing at infrastructure level. | Architecture section 1, NFR9 | HARD -- Infrastructure. |
| IMP-002 | **All monetary fields use Decimal(19, 4).** No floating-point arithmetic for financial calculations. | NFR38, all schema files | HARD -- Prisma schema. |
| IMP-003 | **Immutable audit trail.** Append-only `AuditLog` records. No update or delete operations on audit data. 6-year retention. | NFR14, NFR39, NFR40 | HARD -- Schema + service layer. |
| IMP-004 | **Single base currency per tenant with FX support.** Not dual-base like legacy. All multi-currency amounts converted via ExchangeRate at transaction time. | Architecture constraint | HARD -- Schema design. |

### AI Guardrails

| Rule | Description | Source | Enforcement |
|------|-------------|--------|-------------|
| IMP-005 | **AI never auto-executes financial transactions.** AI can propose but not execute create/modify/delete on financial records without explicit user confirmation. | NFR16 | HARD -- AI orchestration layer. |
| IMP-006 | **AI layer degradation must not break traditional UI.** If AI services fail, all CRUD operations continue to function normally through the traditional form-based UI. | NFR21 | HARD -- Architecture design (graceful degradation). |

### Security & Access

| Rule | Description | Source | Enforcement |
|------|-------------|--------|-------------|
| IMP-007 | **Granular RBAC via access groups + resource permission matrix.** All sensitive operations gated by `createPermissionGuard(resourceCode, action)`. Users are assigned 1+ access groups per company; permissions merge with most-permissive-wins resolution. SUPER_ADMIN bypasses the matrix entirely. Module-specific permission names (e.g., OROK, UnOKOR, CompletingServiceOrders) map to resource + action checks. See BR-RBAC-001 through BR-RBAC-008 and design doc `docs/plans/2026-02-19-granular-rbac-access-groups-design.md`. | FR80-88 | HARD -- Permission guard middleware (E2b). |
| IMP-008 | **MFA support.** Multi-factor authentication available for all users. | NFR10 | HARD -- Auth service. |

### Performance & Scalability

| Rule | Description | Source | Enforcement |
|------|-------------|--------|-------------|
| IMP-009 | **CRUD operations complete within 500ms.** | NFR2 | HARD -- Performance target. |
| IMP-010 | **AI responses within 3 seconds.** | NFR1 | HARD -- Performance target. |
| IMP-011 | **Reports within 5 seconds.** | NFR3 | HARD -- Performance target. |
| IMP-012 | **50 concurrent users per tenant.** | NFR7 | HARD -- Scalability target. |
| IMP-013 | **Tenant provisioning within 60 seconds.** | NFR26 | HARD -- Infrastructure target. |

### Integration Patterns

| Rule | Description | Source | Enforcement |
|------|-------------|--------|-------------|
| IMP-014 | **Retry with exponential backoff** for all external API integrations. | NFR31 | HARD -- Integration adapters. |
| IMP-015 | **HMRC timeout compliance** for MTD and RTI submissions. | NFR32 | HARD -- Integration adapters. |
| IMP-016 | **External payroll API dependency.** UK payroll calculations delegated to Staffology/PayRun.io. Architecture handles API-dependent critical path. | PRD constraint | HARD -- Integration architecture. |

### Code Quality

| Rule | Description | Source | Enforcement |
|------|-------------|--------|-------------|
| IMP-017 | **TypeScript strict mode.** Full-stack type safety with shared types between client/server. | NFR41 | HARD -- TSConfig. |
| IMP-018 | **All code via Claude Opus 4.6.** No other models for implementation. | NFR42 | Process rule. |
| IMP-019 | **80% test coverage for business logic.** | NFR43 | SOFT -- CI/CD enforcement. |
| IMP-020 | **Versioned database migrations.** Per-tenant migration orchestration without downtime. | NFR44, NFR25 | HARD -- Prisma migration tooling. |
| IMP-021 | **OpenAPI documentation.** All API endpoints documented. | NFR45 | HARD -- Fastify OpenAPI plugin. |

---

## 15. Cross-Module Interaction Rules

These rules span multiple modules and define how they interact.

| Rule | Modules Involved | Description | Enforcement |
|------|------------------|-------------|-------------|
| XM-001 | AR + Sales | **Credit limit checks cross AR and Sales.** `CreditCheckService` is a shared service in the AR module consumed by Sales during order confirmation and by AR during invoice approval. | HARD -- Shared service. |
| XM-002 | Sales + Inventory | **Stock availability check during order entry.** Sales orders query Inventory `StockBalance` for ATP (Available to Promise) calculations. | HARD -- Cross-module service call. |
| XM-003 | Sales + Inventory | **Stock reservation on order approval.** Approving a sales order creates `StockReservation` records and increments `quantityOnOrder` in Inventory. | HARD -- Cross-module side effect. |
| XM-004 | Purchasing + Inventory + AP | **Three-way matching: PO -> GRN -> Bill.** Purchasing creates POs, Inventory creates GRNs on receipt, AP creates bills with 3-way match validation. | HARD -- Cross-module validation. |
| XM-005 | CRM + AR | **Lead conversion creates Customer.** CRM lead conversion calls AR Customer creation service, setting `convertedCustomerId`. | HARD -- Cross-module integration. |
| XM-006 | All modules + Finance GL | **Unified GL posting pattern.** Every sub-module creates financial transactions via `createGlPosting()`, looking up `AccountMapping` rows to determine GL accounts. | HARD -- Shared GL posting service. |
| XM-007 | Manufacturing + Inventory | **Production stock movements.** PRODUCTION_IN / PRODUCTION_OUT stock movements. StockBalance updates. Serial/batch tracking. Planned quantities from active orders. | HARD -- Cross-module integration. |
| XM-008 | Manufacturing + Finance GL | **Production GL posting.** Standard, WIP, and operation-level GL entries via AccountMapping. | HARD -- GL posting service. |
| XM-009 | HR/Payroll + Finance GL | **Payroll GL posting.** Approved payroll runs create balanced journal entries. PayrollRun.journalEntryId links to GL. | HARD -- GL posting service. |
| XM-010 | POS + AR | **POS transfer to invoice.** `TransferToInvoice` creates `CustomerInvoice` (type = CASH) in AR module from POS sale. | HARD -- Cross-module service call. |
| XM-011 | POS + Inventory | **Deferred stock deduction.** POS stock movements are batched via `POSStockUpdateService` for performance. | HARD -- Background job. |
| XM-012 | Projects + AR | **Project invoice generation.** Creates `CustomerInvoice` from approved project transactions (T&M or fixed-price milestones). | HARD -- Cross-module service call. |
| XM-013 | Contracts + AR | **Agreement/contract invoice generation.** Batch operations create `CustomerInvoice` records from charges/periods. | HARD -- Cross-module batch service. |
| XM-014 | Service Orders + AR | **SVO-to-invoice generation.** Completed service orders with INVOICEABLE work sheet lines generate CustomerInvoice in AR. | HARD -- Cross-module service call. |
| XM-015 | Fixed Assets + Finance GL | **Depreciation and disposal GL posting.** Monthly depreciation runs and asset disposals create balanced journal entries. | HARD -- GL posting service. |
| XM-016 | All modules + Cross-Cutting | **Polymorphic attachments, notes, and links.** Any entity can have attachments, notes, and record links via the cross-cutting infrastructure. Entity deletion cascades via event bus. | HARD -- Event bus cascade. |
| XM-017 | Intercompany + Finance GL | **Intercompany mirroring creates journal entries in target tenant.** Debit/credit reversal with double-entry in target. Transaction lock date respected across tenants. | HARD -- Cross-tenant saga. |
| XM-018 | All modules + System | **Number series generation.** All transactional entities use the shared NumberSeries service for auto-numbering within DB transactions. | HARD -- Shared service. |

---

## Appendix A: Rule Count Summary

| Module | Explicit BR-xxx Rules | Implicit/Derived Rules | Total |
|--------|----------------------|----------------------|-------|
| Finance (GL/Banking) | 0 | 12 (BR-FIN-001 to 012) | 12 |
| Inventory | 0 | 11 (BR-INV-001 to 011) | 11 |
| AR / Sales Ledger | 0 | 12 (BR-AR-001 to 012) | 12 |
| Sales Orders | 21 (REQ-OR-xxx legacy) | 0 | 21 |
| Purchasing / AP | 0 | 15 (BR-PUR-001 to 015) | 15 |
| CRM | 20 (BR-CRM-001 to 020) | 0 | 20 |
| HR / Payroll | 59 (BR-EMP/CTR/APR/SKL/CHK/TRN/LEV/PAY/JP) | 0 | 59 |
| Manufacturing | 0 | 15 (BR-PRD-001 to 015) | 15 |
| POS | 20 (POS-001 to 020) | 0 | 20 |
| Projects | 26 (PRJ/TS/EXP/INV-xxx) | 0 | 26 |
| Contracts & Agreements | 0 | 22 (BR-CON-001 to 022) | 22 |
| Warehouse Management | 12 (BR-WMS-001 to 012) | 0 | 12 |
| Intercompany | 15 (BR-1 to BR-15) | 0 | 15 |
| Communications | 17 (BR-COM-001 to 017) | 0 | 17 |
| Service Orders / Timekeeper | 0 | 14 (BR-SVO/TK-xxx) | 14 |
| Fixed Assets | 0 | 12 (BR-FA-001 to 012) | 12 |
| Pricing | 0 | 7 (BR-PRC-001 to 007) | 7 |
| Cross-Cutting / System | 0 | 14 (BR-SYS-001 to 014) | 14 |
| RBAC / Access Groups | 8 (BR-RBAC-001 to 008) | 0 | 8 |
| Implicit Architecture | 0 | 21 (IMP-001 to 021) | 21 |
| Cross-Module Interactions | 0 | 18 (XM-001 to 018) | 18 |
| **TOTAL** | **198** | **173** | **371** |

---

*End of Business Rules Compendium v1.1 (updated 2026-02-19: added BR-RBAC-001 through BR-RBAC-008 for granular RBAC)*

---

## Validation Report

**Validation Date:** 2026-02-16
**Validator:** Claude Opus 4.6 (automated cross-check)
**Sources Checked:** All 18 arch-section files (2.13 through 2.30)

### Verdict: PASS WITH WARNINGS

### Scope

- **Rules checked (explicit):** 182/182 explicit rules verified against arch-section source files
- **Rules spot-checked (accuracy):** 14 rules from 10 different modules verified for description, enforcement level, and mechanism accuracy
- **Implicit rules spot-checked:** 6 implicit rules (IMP-001, IMP-002, IMP-005, IMP-006, IMP-016, IMP-018) verified as legitimate architectural constraints
- **Cross-module rules checked:** All 18 XM-xxx rules verified against inter-module references in arch-sections
- **Module coverage:** All 18 architecture sections (2.13-2.30) have rules represented

### Critical Issues

**C1. Rule Count Discrepancy in Appendix A -- Sales Orders**
- Appendix A claims 18 REQ-OR-xxx rules. Actual count in the document body: 21 table rows.
- The 21 matches the arch-section source (2.16-sales-orders.md, lines 646-666) exactly.
- **Fix:** Update Appendix A Sales Orders row to "21 (REQ-OR-xxx legacy) | 0 | 21".

**C2. Rule Count Discrepancy in Appendix A -- Projects**
- Appendix A claims 21 PRJ/TS/EXP/INV-xxx rules. Actual count: 26 (PRJ=8, TS=8, EXP=5, INV=5).
- Source (2.25-projects-job-costing.md, lines 932-957) confirms 26 rules.
- **Fix:** Update Appendix A Projects row to "26 (PRJ/TS/EXP/INV-xxx) | 0 | 26".

**C3. Total Rule Count Incorrect**
- Appendix A claims 352 total rules (182 explicit + 170 implicit).
- Actual count of unique rule entries in the document body: 360.
- Corrected breakdown: 190 explicit + 170 implicit = 360 (explicit count was understated by 8 due to C1+C2).
- **Fix:** Update totals row to "190 | 170 | 360".

**C4. Missing Loan Agreement Lifecycle Transitions (Section 11, BR-CON-xxx)**
- Three loan agreement status transitions from arch-section 2.26 (lines 991-996) are missing:
  - ACTIVE -> DISBURSED (disburse): Creates Purchase Invoice via AP to disburse funds to customer.
  - DISBURSED -> PAUSED (pause): Suspends scheduled invoicing.
  - PAUSED -> DISBURSED (resume): Resumes scheduled invoicing.
- **Fix:** Add BR-CON-020, BR-CON-021, BR-CON-022 for these transitions.

### Warnings

**W1. BR-SVO-001 Omits ON_HOLD State**
- The compendium states: "DRAFT -> OPEN -> IN_PROGRESS -> COMPLETED -> INVOICED. CANCELLED only from DRAFT/OPEN."
- The arch-section (2.30, lines 609-616) includes an ON_HOLD state: IN_PROGRESS -> ON_HOLD (putOnHold()) and ON_HOLD -> IN_PROGRESS (resume()), for awaiting parts or customer response.
- **Recommendation:** Amend BR-SVO-001 description to include: "ON_HOLD reachable from IN_PROGRESS via putOnHold(); returns to IN_PROGRESS via resume()."

**W2. BR-CRM-015 Minor Wording Difference**
- Compendium says: "Invalid transitions trigger the standard status-change business rules."
- Source (2.21, line 903) says: "Invalid transitions (e.g., dragging a LOST opportunity to WON) are permitted but trigger the standard status-change business rules."
- The source explicitly notes these transitions "are permitted" -- the compendium's wording could be read as "invalid transitions are blocked," which is not the intent.
- **Recommendation:** Add "are permitted but" before "trigger" to match source precision.

**W3. Appendix A Explicit vs Implicit Classification**
- The summary table classifies Finance (BR-FIN), Inventory (BR-INV), AR (BR-AR), Purchasing (BR-PUR), Manufacturing (BR-PRD), Fixed Assets (BR-FA), Pricing (BR-PRC), Contracts (BR-CON), and Service Orders (BR-SVO/TK) as having 0 explicit rules and all implicit/derived rules.
- While technically correct (these modules do not have explicit BR-xxx codes in the arch-section source files), the "Explicit BR-xxx Rules" column header is misleading since Sales Orders (REQ-OR-xxx) uses a different prefix scheme yet is counted as "explicit."
- **Recommendation:** Add a footnote clarifying that "explicit" means the rule ID appears verbatim in the arch-section source, regardless of prefix convention.

**W4. BR-SVO-001 CANCELLED Guard Incomplete**
- Compendium says: "CANCELLED only from DRAFT/OPEN."
- Source (2.30 lifecycle diagram, line 630-631) says: "At any pre-completed state: cancel() -> CANCELLED."
- Source table (line 643) says: "Only from DRAFT/OPEN. Blocked if linked WO/WS/invoices exist."
- There is ambiguity in the source itself. The lifecycle diagram suggests any pre-completed state can cancel, but the transition table restricts to DRAFT/OPEN. The compendium follows the transition table, which is the more authoritative source.
- **Recommendation:** No change needed, but note the source ambiguity for future clarification.

### Info (Suggestions for Improvement)

**I1. REQ-OR-023 (Over-shipment Prevention) Not in Formal Table**
- REQ-OR-023 is referenced in the narrative text of 2.16-sales-orders.md (line 573) but does not appear in the formal business rules table (lines 646-666). The compendium correctly follows the formal table.
- **Suggestion:** Consider adding REQ-OR-023 to the compendium as a derived rule, since the arch-section describes it as a specific validation rule with clear enforcement.

**I2. Consider Adding REQ-OR-004 Gap Note**
- The Sales Orders rules jump from REQ-OR-003 to REQ-OR-005-008. REQ-OR-004 is not present in the source. A note explaining the gap (likely a legacy numbering artifact) would aid comprehension.

**I3. Module Prefix Consistency**
- The intercompany rules use bare `BR-1` through `BR-15` (no module prefix), unlike all other modules which use `BR-{MODULE}-NNN`. Consider renaming to `BR-IC-001` through `BR-IC-015` for consistency. This is a cosmetic suggestion and does not affect correctness -- the current naming matches the arch-section source.

**I4. Enforcement Level for Side-Effect Rules**
- Several rules describing side effects on state transitions (e.g., REQ-OR-050 "Stock ordered-out update on approve", REQ-OR-052 "CRM activity on approve") are classified as HARD. While the side effect is mandatory, the enforcement level could be debated -- the transaction succeeds but triggers additional operations. The HARD classification is defensible (the side effect is non-optional) but could benefit from a note distinguishing "validation HARD" from "side-effect HARD."

### Module Coverage Summary

| Arch-Section | File | Rules in Compendium | Coverage |
|--------------|------|---------------------|----------|
| 2.13 Finance GL | 2.13-finance-gl.md | 12 (BR-FIN-001 to 012) | Complete |
| 2.14 Inventory | 2.14-inventory.md | 11 (BR-INV-001 to 011) | Complete |
| 2.15 Sales Ledger / AR | 2.15-sales-ledger-ar.md | 12 (BR-AR-001 to 012) | Complete |
| 2.16 Sales Orders | 2.16-sales-orders.md | 21 (REQ-OR-xxx) | Complete |
| 2.17 Purchasing / AP | 2.17-purchasing-ap.md | 15 (BR-PUR-001 to 015) | Complete |
| 2.18 Fixed Assets | 2.18-fixed-assets.md | 12 (BR-FA-001 to 012) | Complete |
| 2.19 Pricing | 2.19-pricing.md | 7 (BR-PRC-001 to 007) | Complete |
| 2.20 Cross-Cutting | 2.20-cross-cutting.md | 14 (BR-SYS-001 to 014) | Complete |
| 2.21 CRM | 2.21-crm.md | 20 (BR-CRM-001 to 020) | Complete |
| 2.22 HR / Payroll | 2.22-hr-payroll.md | 59 (BR-EMP/CTR/APR/SKL/CHK/TRN/LEV/PAY/JP) | Complete |
| 2.23 Production / MRP | 2.23-production-mrp.md | 15 (BR-PRD-001 to 015) | Complete |
| 2.24 POS | 2.24-pos.md | 20 (POS-001 to 020) | Complete |
| 2.25 Projects | 2.25-projects-job-costing.md | 26 (PRJ/TS/EXP/INV) | Complete |
| 2.26 Contracts | 2.26-contracts-agreements.md | 19 (BR-CON-001 to 019) | 3 loan transitions missing |
| 2.27 Warehouse | 2.27-warehouse-management.md | 12 (BR-WMS-001 to 012) | Complete |
| 2.28 Intercompany | 2.28-intercompany-consolidation.md | 15 (BR-1 to BR-15) | Complete |
| 2.29 Communications | 2.29-communications.md | 17 (BR-COM-001 to 017) | Complete |
| 2.30 Service Orders | 2.30-service-orders-timekeeper.md | 14 (BR-SVO/TK) | ON_HOLD state omitted |

### Spot-Check Detail

| Rule | Module | Description Match | Enforcement Match | Mechanism Match | Result |
|------|--------|-------------------|-------------------|-----------------|--------|
| BR-AR-001 | AR | Yes | HARD - correct | State machine - correct | PASS |
| BR-AR-005 | AR | Yes | CONFIGURABLE - correct | Tenant setting - correct | PASS |
| BR-CRM-004 | CRM | Yes (verbatim) | HARD - correct | Service guard - correct | PASS |
| BR-CTR-009 | HR | Yes | SOFT - correct | Warning - correct | PASS |
| BR-WMS-001 | WMS | Yes | CONFIGURABLE+HARD - correct | Config + guard - correct | PASS |
| BR-WMS-002 | WMS | Yes (summarized) | HARD - correct | State machine - correct | PASS |
| BR-PRD-009 | Mfg | Yes (verbatim) | CONFIGURABLE - correct | Tenant setting - correct | PASS |
| POS-013 | POS | Yes | CONFIGURABLE - correct | Background job - correct | PASS |
| BR-CON-017 | Contracts | Yes (minor omission of activationJournalEntryId) | HARD - correct | GL posting - correct | PASS |
| BR-FA-008 | FA | Yes | HARD - correct | Dual calc paths - correct | PASS |
| BR-FIN-010 | Finance | Yes (thresholds verified) | CONFIGURABLE - correct | AI matching - correct | PASS |
| BR-CRM-015 | CRM | Minor wording difference (see W2) | HARD - correct | Validation - correct | PASS with note |
| BR-PRC-001 | Pricing | Yes (waterfall verified) | HARD - correct | Resolution algorithm - correct | PASS |
| BR-SVO-001 | SVO | ON_HOLD omitted (see W1) | HARD - correct | State machine - correct | PASS with note |

### Implicit Rule Spot-Check

| Rule | Constraint | Verified Against | Valid? |
|------|-----------|-----------------|--------|
| IMP-001 | Database-per-tenant | Architecture core design, CLAUDE.md | Yes |
| IMP-019 | All AI calls via AI Gateway | Architecture §2.31, FR205 | Yes |
| IMP-020 | Platform audit log immutable | Architecture §2.31, NFR49 | Yes |
| IMP-002 | Decimal(19,4) for money | Schema files across all modules | Yes |
| IMP-005 | AI no auto-execute | NFR16, BR-COM-013 | Yes |
| IMP-006 | AI degradation graceful | NFR21, architecture design | Yes |
| IMP-016 | External payroll API | PRD constraint, 2.22 section | Yes |
| IMP-018 | All code via Opus 4.6 | CLAUDE.md, project rules | Yes |
