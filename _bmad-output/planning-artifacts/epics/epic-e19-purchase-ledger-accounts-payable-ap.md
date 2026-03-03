# Epic E19: Purchase Ledger / Accounts Payable (AP)

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL), E18 (Purchase Orders)
**FRs:** FR26–FR32
**Module Path:** `api/src/modules/purchasing/` (Supplier, Bill, Payment, BACS sub-modules)

---

## Story E19.S1: Supplier Management

**User Story:** As an AP clerk, I want to create and manage supplier records with bank details and payment terms, so that supplier data is centralised for billing, payment processing, and BACS runs.

**Acceptance Criteria:**
1. GIVEN an AP clerk WHEN they create a Supplier with name, supplierType (COMPANY/INDIVIDUAL), and status (ACTIVE) THEN the supplier is persisted with auto-generated supplierNumber from NumberSeries and companyId scoping.
2. GIVEN a supplier WHEN bank details (sortCode, accountNumber, IBAN, BIC) are entered THEN they are stored and validated for BACS payment eligibility per BR-PUR-012.
3. GIVEN a supplier without valid UK bank details (sortCode + accountNumber) WHEN included in a BACS run THEN the system rejects per BR-PUR-012 (bank details required for payment).
4. GIVEN a supplier with status BLOCKED or TERMINATED WHEN a user attempts to create a PO or bill for them THEN the system rejects.
5. GIVEN a supplier with status ON_HOLD WHEN a user creates a PO THEN a warning is surfaced but the transaction may proceed.
6. GIVEN a supplier WHEN payment terms, default currency, and preferred payment method are set THEN these serve as defaults on new bills and payments.

**Key Tasks:**
- [ ] Create Prisma model for Supplier (AC: #1)
  - [ ] Fields: id, supplierNumber (unique, NumberSeries), name, legalName, supplierType SupplierType enum, status SupplierStatus enum (4 values: ACTIVE/ON_HOLD/BLOCKED/TERMINATED), sortCode, accountNumber, iban, bic, bankName, paymentTermsId FK, defaultCurrencyCode, preferredPaymentMethod, vatNumber, isActive, companyId
- [ ] Implement CRUD service with NumberSeries, companyId scoping, and status guards (AC: #1, #4, #5)
- [ ] Implement bank detail validation for BACS eligibility (AC: #2, #3)
- [ ] Register routes: CRUD `/ap/suppliers`, GET `/:id/purchase-history`, GET `/:id/balance` (AC: #1–#6)
- [ ] Write unit tests for status guards and bank detail validation (AC: #3–#5)

**FR/NFR:** FR26; NFR41 (TypeScript strict), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | Supplier model, bank details, status lifecycle |
| API Contracts | §2.10 | CRUD `/ap/suppliers`, GET `/:id/purchase-history`, GET `/:id/balance` |
| Data Models | §3.6 | Supplier (supplierType enum, status 4-value enum: ACTIVE/ON_HOLD/BLOCKED/TERMINATED, bank detail fields) |
| State Machines | §1 | Reference entity pattern with SupplierStatus enum (not isActive soft-delete — uses explicit status) |
| Event Catalog | N/A — supplier CRUD does not emit events in MVP |
| Business Rules | §5 | BR-PUR-012 (valid UK bank details required for BACS) |
| UX Design Spec | §T1, §T2 | T1 for supplier list, T2 for supplier detail with tabs |
| Project Context | §1 | companyId scoping on all tables |

---

## Story E19.S2: Supplier Bills

**User Story:** As an AP clerk, I want to create, approve, and post supplier bills with GL journal entry generation and PO reference linking, so that expenses are accurately recorded and the AP control account is maintained.

**Acceptance Criteria:**
1. GIVEN an AP clerk WHEN they create a SupplierBill with supplierId, optional purchaseOrderId, and bill lines THEN the bill is persisted in DRAFT status with auto-generated billNumber.
2. GIVEN a DRAFT bill with at least one line WHEN approved THEN 3-way match validation runs (if PO linked), status transitions to APPROVED, and `bill.approved` event is emitted.
3. GIVEN an APPROVED bill WHEN posted THEN a JournalEntry is created (DR PURCHASE_EXPENSE + VAT_INPUT per line, CR AP_CONTROL for total), status transitions to POSTED, PurchaseOrderLine.quantityInvoiced is updated, and `bill.posted` event is emitted per BR-PUR-004 (period lock check).
4. GIVEN a bill of type credit note (negative amounts) WHEN processed THEN it follows the same lifecycle reducing the supplier balance.
5. GIVEN a DRAFT or APPROVED bill WHEN cancelled THEN status transitions to CANCELLED with no GL impact.
6. GIVEN a non-PO bill (direct expense) WHEN created THEN purchaseOrderId is null and no matching validation is required per BR-PUR-005.

**Key Tasks:**
- [ ] Create Prisma models for SupplierBill and SupplierBillLine (AC: #1)
  - [ ] SupplierBill: id, billNumber (NumberSeries), supplierId FK, purchaseOrderId FK (nullable), status SupplierBillStatus enum (6 values), matchStatus MatchStatus enum (3 values), billDate, dueDate, subtotal, vatAmount, totalAmount, outstandingAmount, paidAmount, currencyCode, exchangeRate, journalEntryId, companyId
  - [ ] SupplierBillLine: id, billId FK (cascade), purchaseOrderLineId FK (nullable), itemId, description, quantity, unitPrice, vatCodeId, lineTotal, accountCode
- [ ] Implement bill state machine: DRAFT→APPROVED→POSTED→PARTIALLY_PAID→PAID, DRAFT/APPROVED→CANCELLED (AC: #2–#5)
- [ ] Implement GL posting via createGlPosting() (DR PURCHASE_EXPENSE + VAT_INPUT, CR AP_CONTROL) (AC: #3)
- [ ] Implement period lock check before posting (AC: #3)
- [ ] Integrate 3-way match on approval (placeholder for E19.S3) (AC: #2)
- [ ] Emit events: `bill.approved`, `bill.posted`, `bill.cancelled` (AC: #2, #3, #5)
- [ ] Register routes: CRUD `/ap/supplier-bills`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/void` (AC: #1–#6)
- [ ] Write unit tests for each state transition and GL posting (AC: #2–#5)

**FR/NFR:** FR27; NFR36 (double-entry), NFR37 (period locks), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | SupplierBill/Line models, GL posting (DR Expense + VAT, CR AP_CONTROL), PO linking |
| API Contracts | §2.10 | CRUD `/ap/supplier-bills`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/void`, GET `/:id/matching` |
| Data Models | §3.6 | SupplierBill (status 6-value enum, matchStatus 3-value enum, purchaseOrderId nullable), SupplierBillLine |
| State Machines | §4.4 | SupplierBill: DRAFT→APPROVED→POSTED→PARTIALLY_PAID→PAID; match status parallel state |
| Event Catalog | §5 | `bill.posted` — subscribers: Finance (GL journal), Audit; `bill.voided` for reversal |
| Business Rules | §5 | BR-PUR-004 (locked period check), BR-PUR-005 (non-PO bills allowed) |
| UX Design Spec | §T3 | T3 Header+Lines for bill form with PO reference and match status indicator |
| Project Context | §15 | XM-006 (unified GL posting), XM-004 (3-way matching) |

---

## Story E19.S3: Three-Way Matching

**User Story:** As an AP manager, I want the system to automatically validate supplier bills against purchase orders and goods receipts on four dimensions, so that pricing and quantity discrepancies are caught before payment.

**Acceptance Criteria:**
1. GIVEN a bill linked to a PO WHEN matching runs THEN the engine validates on four dimensions: quantity ordered vs received vs invoiced, unit price consistency between PO and bill, item identity matching, and line-level cross-reference per BR-PUR-008.
2. GIVEN all dimensions match within tolerance WHEN the match result is classified THEN matchStatus is set to FULLY_MATCHED per BR-PUR-009.
3. GIVEN a price discrepancy beyond tolerance WHEN classified THEN matchStatus is set to PRICE_VARIANCE per BR-PUR-009.
4. GIVEN a quantity discrepancy WHEN classified THEN matchStatus is set to QUANTITY_VARIANCE per BR-PUR-009.
5. GIVEN a user with `ap.approve_mismatch` permission WHEN a bill fails matching THEN they can approve the bill with an override reason recorded in the audit trail per BR-PUR-010.
6. GIVEN `ap.requireMatchBeforePosting = true` (default) WHEN an unmatched/mismatched bill is submitted for posting THEN the system rejects unless a mismatch override has been applied per BR-PUR-011.

**Key Tasks:**
- [ ] Implement 3-way match engine comparing PO lines → GRN lines → Bill lines on 4 dimensions (AC: #1)
- [ ] Implement match status classification: FULLY_MATCHED, PARTIALLY_MATCHED, PRICE_VARIANCE, QUANTITY_VARIANCE, MISMATCHED (AC: #2–#4)
- [ ] Implement mismatch override with permission check and audit logging (AC: #5)
- [ ] Implement `ap.requireMatchBeforePosting` system setting check on bill posting (AC: #6)
- [ ] Register route: GET `/ap/supplier-bills/:id/matching` returning match details per dimension (AC: #1–#4)
- [ ] Write unit tests for each match status scenario and override flow (AC: #1–#6)

**FR/NFR:** FR31; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | Three-way matching engine, 4-dimension validation, match status classification |
| API Contracts | §2.10 | GET `/ap/supplier-bills/:id/matching` |
| Data Models | §3.6 | SupplierBill.matchStatus (MatchStatus enum: UNMATCHED/PARTIALLY_MATCHED/FULLY_MATCHED), cross-references to PO and GRN lines |
| State Machines | §4.4 | MatchStatus as parallel state on SupplierBill |
| Event Catalog | N/A — matching is synchronous validation, not event-driven |
| Business Rules | §5 | BR-PUR-008 (4-dimension validation), BR-PUR-009 (status classification), BR-PUR-010 (mismatch override with permission), BR-PUR-011 (requireMatchBeforePosting setting) |
| UX Design Spec | §T3 | Match result display within bill form showing per-dimension status |
| Project Context | §15 | XM-004 (3-way matching PO→GRN→Bill) |

---

## Story E19.S4: Supplier Payments

**User Story:** As a finance clerk, I want to create supplier payments with allocation against bills and support for multiple payment methods, so that AP balances are accurately tracked and suppliers are paid correctly.

**Acceptance Criteria:**
1. GIVEN a finance clerk WHEN they create a SupplierPayment with supplierId, amount, paymentMethod (BACS/BANK_TRANSFER/CHEQUE/DIRECT_DEBIT/CARD), and bankAccountId THEN the payment is persisted in DRAFT status.
2. GIVEN a DRAFT payment WHEN approved THEN the bank account is validated, amount > 0, at least one allocation exists, and status transitions to APPROVED.
3. GIVEN an APPROVED payment WHEN sent/submitted THEN status transitions to SENT with the payment transmitted to the bank.
4. GIVEN a SENT payment WHEN bank confirms processing THEN status transitions to COMPLETED, a JournalEntry is created (DR AP_CONTROL, CR Bank), supplier bill paidAmount/outstandingAmount are updated for all allocations, and `supplier.payment.posted` event is emitted.
5. GIVEN a single payment allocated across multiple bills WHEN posted THEN each SupplierPaymentAllocation updates its respective bill per BR-PUR-006.
6. GIVEN a multi-currency payment WHEN posted at a different rate than the bill THEN FX differences are posted to EXCHANGE_GAIN/EXCHANGE_LOSS accounts per BR-PUR-015.

**Key Tasks:**
- [ ] Create Prisma models for SupplierPayment and SupplierPaymentAllocation (AC: #1, #5)
  - [ ] SupplierPayment: id, paymentNumber (NumberSeries), supplierId FK, bacsRunId FK (nullable), status SupplierPaymentStatus enum (5 values), paymentMethod PaymentMethod(AP) enum, amount Decimal(19,4), bankAccountId FK, currencyCode, exchangeRate, companyId
  - [ ] SupplierPaymentAllocation: id, paymentId FK, billId FK, amount Decimal(19,4)
- [ ] Implement payment state machine: DRAFT→APPROVED→SENT→COMPLETED, DRAFT/APPROVED→CANCELLED (AC: #2–#4)
- [ ] Implement GL posting on completion (DR AP_CONTROL, CR Bank +/- FX) (AC: #4)
- [ ] Implement multi-bill allocation with bill balance updates (AC: #5)
- [ ] Implement FX difference handling (AC: #6)
- [ ] Emit `supplier.payment.posted` event on completion (AC: #4)
- [ ] Register routes: CRUD `/ap/supplier-payments`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/allocate`, POST `/:id/void` (AC: #1–#6)
- [ ] Write unit tests for allocation, FX handling, and bill balance updates (AC: #4–#6)

**FR/NFR:** FR28; NFR36 (double-entry), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | SupplierPayment model, allocation pattern, GL posting (DR AP_CONTROL, CR Bank) |
| API Contracts | §2.10 | CRUD `/ap/supplier-payments`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/allocate`, POST `/:id/void` |
| Data Models | §3.6 | SupplierPayment (status 5-value enum, paymentMethod BACS/BANK_TRANSFER/CHEQUE/DIRECT_DEBIT/CARD, bacsRunId), SupplierPaymentAllocation |
| State Machines | §4.5 | SupplierPayment: DRAFT→APPROVED→SENT→COMPLETED; side effects for GL posting and bill updates |
| Event Catalog | §5 | `supplier.payment.posted` — subscribers: Finance (GL: DR AP_CONTROL, CR Bank), Audit |
| Business Rules | §5 | BR-PUR-006 (single payment across multiple bills), BR-PUR-007 (single bill paid by multiple payments), BR-PUR-015 (FX differences) |
| UX Design Spec | §T3 | T3 form for payment entry with bill allocation grid |
| Project Context | §15 | XM-006 (unified GL posting) |

---

## Story E19.S5: BACS Payment Run

**User Story:** As a finance manager, I want to create BACS payment runs that batch multiple supplier payments into a single file for bank submission, so that bulk payments are processed efficiently with proper approval controls.

**Acceptance Criteria:**
1. GIVEN a finance manager WHEN they create a BacsRun and select outstanding bills for payment THEN SupplierPayment records are created for each supplier/bill combination and linked to the BacsRun in DRAFT status.
2. GIVEN a DRAFT BACS run WHEN approved THEN all suppliers are validated for UK bank details (sortCode + accountNumber), amounts are within bank limits, and status transitions to APPROVED per BR-PUR-012/BR-PUR-014.
3. GIVEN an APPROVED BACS run WHEN the file is generated THEN a BACS-formatted file is created with all payment details, a download URL is provided, fileReference and submittedAt are set, and `bacs.run.submitted` event is emitted.
4. GIVEN a SUBMITTED BACS run WHEN bank confirms processing (T+2 typical) THEN status transitions to COMPLETED, all SupplierPayments in the run move to COMPLETED, GL journal entries are posted for each payment.
5. GIVEN a SUBMITTED BACS run WHEN the bank rejects the file THEN status transitions to FAILED and payments remain unprocessed for manual resolution.
6. GIVEN the BACS file WHEN generated THEN the maximum of 999,999 items per file is enforced per BR-PUR-013.

**Key Tasks:**
- [ ] Create Prisma model for BacsRun (id, status BacsRunStatus enum 5 values, fileReference, submittedAt, totalAmount, paymentCount, companyId) (AC: #1)
- [ ] Implement BacsRun creation with bill selection and SupplierPayment auto-creation (AC: #1)
- [ ] Implement approval with bank detail validation and amount limit checks (AC: #2)
- [ ] Implement BACS file generation service (AC: #3)
- [ ] Implement completion flow cascading to all SupplierPayments (AC: #4)
- [ ] Implement failure handling with manual resolution path (AC: #5)
- [ ] Implement 999,999 item limit validation (AC: #6)
- [ ] Emit `bacs.run.submitted` event (AC: #3)
- [ ] Register routes: CRUD `/ap/bacs-runs`, POST `/:id/approve`, POST `/:id/generate-file`, POST `/:id/submit`, POST `/:id/complete` (AC: #1–#6)
- [ ] Write unit tests for bank detail validation, file generation, and completion cascade (AC: #2–#4)

**FR/NFR:** FR29; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | BacsRun model, BACS file generation, payment cascade on completion |
| API Contracts | §2.10, §3.4 | CRUD `/ap/bacs-runs`, POST `/:id/approve`, POST `/:id/generate-file` (BacsFileResult schema), POST `/:id/submit`, POST `/:id/complete` |
| Data Models | §3.6 | BacsRun (status 5-value enum: DRAFT/APPROVED/SUBMITTED/COMPLETED/FAILED, fileReference, paymentCount, totalAmount) |
| State Machines | §4.6 | BacsRun: DRAFT→APPROVED→SUBMITTED→COMPLETED/FAILED; side effects cascading to SupplierPayments |
| Event Catalog | §5 | `bacs.run.submitted` — subscribers: Notifications (confirm to finance), Audit |
| Business Rules | §5 | BR-PUR-012 (UK bank details required), BR-PUR-013 (999,999 max items), BR-PUR-014 (per-transaction amount limit) |
| UX Design Spec | §T6 | T6 Wizard template for BACS run creation flow |
| Project Context | §11 | BACS is UK-specific payment processing |

---

## Story E19.S6: Aged Creditors

**User Story:** As a finance manager, I want to view aged creditors reports and payment forecasts, so that I can plan cash outflows and identify overdue supplier payments.

**Acceptance Criteria:**
1. GIVEN the aged creditors report endpoint WHEN a user runs it THEN outstanding bills are categorised into aging buckets: Current, 30 days, 60 days, 90+ days, with totals per supplier and grand totals.
2. GIVEN the payment forecast endpoint WHEN a user runs it THEN upcoming payment obligations are projected based on bill due dates and approved POs.
3. GIVEN the aged creditors report WHEN a user drills down on a supplier THEN individual outstanding bills for that supplier are listed with amounts and due dates.
4. GIVEN both reports WHEN generated THEN all amounts use Decimal(19,4) precision and are formatted in the user's locale currency format.

**Key Tasks:**
- [ ] Implement aged creditors report with configurable aging buckets (current/30/60/90+) (AC: #1)
- [ ] Implement payment forecast report from bill due dates and approved PO commitments (AC: #2)
- [ ] Implement drill-down to supplier-level bill detail (AC: #3)
- [ ] Ensure Decimal precision and locale-based formatting (AC: #4)
- [ ] Register routes: GET `/ap/reports/aging`, GET `/ap/reports/overdue`, GET `/ap/reports/payment-forecast` (AC: #1–#4)
- [ ] Write unit tests for aging bucket calculation accuracy (AC: #1)

**FR/NFR:** FR30; NFR3 (reports < 5s), NFR38 (Decimal precision)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | Aged creditors reporting, payment forecast |
| API Contracts | §2.10 | GET `/ap/reports/aging`, GET `/ap/reports/overdue`, GET `/ap/reports/payment-forecast`, GET `/ap/reports/purchase-journal` |
| Data Models | §3.6 | SupplierBill (outstandingAmount, dueDate for aging), SupplierPayment |
| State Machines | N/A — reports are read-only aggregations |
| Event Catalog | N/A — reports do not emit events |
| Business Rules | §5 | BR-PUR-004 (period context for reporting) |
| UX Design Spec | §T8 | T8 Report template for aged creditors with drill-down |
| Project Context | §3 | Locale-based formatting via Intl API |

---

## Story E19.S7: AP Screens

**User Story:** As an AP user, I want standardised list views, detail views, and form screens for suppliers, bills, payments, and BACS runs, so that I can manage the full AP lifecycle using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN an AP user WHEN they navigate to Suppliers THEN a T1 Entity List displays suppliers with columns for number, name, type, status, and balance, with filters for status.
2. GIVEN an AP user WHEN they click a supplier THEN a T2 Record Detail displays with tabs: Primary (name, type, bank details), Financial (balance, payment terms), Bills, Payments, Purchase History, and Activity.
3. GIVEN an AP user WHEN they navigate to Bills THEN a T1 list shows bills with number, supplier, date, total, outstanding, status, and match status.
4. GIVEN an AP user WHEN they open a bill THEN a T3 Header+Lines form displays with match status indicator, PO reference, and ActionBar showing Approve (DRAFT), Post (APPROVED).
5. GIVEN an AP user WHEN they navigate to Payments THEN a T1 list shows payments with number, supplier, amount, method, and status.
6. GIVEN an AP user WHEN they view the aged creditors report THEN a T8 Report screen shows the aging analysis with drill-down.

**Key Tasks:**
- [ ] Build T1 Entity List for Suppliers with status/balance indicators (AC: #1)
- [ ] Build T2 Record Detail for Supplier with tabbed layout including bank details (AC: #2)
- [ ] Build T1 Entity List for Bills with match status column (AC: #3)
- [ ] Build T3 Header+Lines form for Bill with 3-way match display and ActionBar (AC: #4)
- [ ] Build T1 Entity List for Payments (AC: #5)
- [ ] Build T8 Report for Aged Creditors with drill-down (AC: #6)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#6)

**FR/NFR:** FR26–FR32; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | All AP entities and relationships |
| API Contracts | §2.10 | All AP endpoints consumed by frontend |
| Data Models | §3.6 | All AP models for form field mapping |
| State Machines | §4.4–§4.6 | SupplierBill, SupplierPayment, BacsRun status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §5 | All BR-PUR rules inform validation displays and match status indicators |
| UX Design Spec | §T1, §T2, §T3, §T8, §Action Bar | T1 for lists, T2 for supplier detail, T3 for bill/payment forms, T8 for aged creditors |
| Project Context | §3 | All strings use translation keys |

---

## Story E19.S8: Mobile Adaptation

**User Story:** As a finance manager on mobile, I want to approve supplier bills and check payment status from my phone, so that AP workflows are not blocked when I am away from my desk.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they view pending approvals THEN bills awaiting approval are listed with supplier, amount, due date, and match status.
2. GIVEN a mobile user WHEN they tap a bill for approval THEN they see a summary (supplier, amount, PO reference, match result) with Approve/Reject buttons.
3. GIVEN a mobile user WHEN they approve a bill THEN the bill status transitions to APPROVED and they receive confirmation.
4. GIVEN a mobile user WHEN they check payment status THEN they see recent BACS runs and individual payments with current status.
5. GIVEN all mobile AP screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column optimised.

**Key Tasks:**
- [ ] Build mobile bill approval list with match status indicators (AC: #1)
- [ ] Build mobile bill approval detail with Approve/Reject actions (AC: #2, #3)
- [ ] Build mobile payment/BACS status view (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR27, FR29; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native) |
| API Contracts | §2.10 | AP endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | §4.4 | SupplierBill approval transition from DRAFT→APPROVED on mobile |
| Event Catalog | N/A — mobile receives push for approval requests |
| Business Rules | N/A — validation enforced server-side; match display is read-only |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets |
| Project Context | §8 | Mobile as end-of-epic story; bill approval is key mobile AP use case |
