# Epic E17: Sales Ledger / Accounts Receivable (AR)

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL)
**FRs:** FR19–FR25
**Module Path:** `api/src/modules/ar/`

---

## Story E17.S1: Customer Management

**User Story:** As an AR clerk, I want to create and manage customer records with multiple addresses, contacts, and bill-to consolidation, so that all customer data is centralised for invoicing and credit management.

**Acceptance Criteria:**
1. GIVEN an AR clerk WHEN they create a Customer with name, customerType (COMPANY/INDIVIDUAL), and required fields THEN the customer is persisted with auto-generated customerNumber from NumberSeries and companyId scoping.
2. GIVEN a customer record WHEN the clerk adds addresses with type BILLING/SHIPPING/REGISTERED/OTHER THEN multiple CustomerAddress records are linked to the customer.
3. GIVEN a customer record WHEN the clerk adds contacts THEN CustomerContact records with name, email, phone, and role are linked to the customer.
4. GIVEN a customer with invoiceToCustomerId set (self-referential bill-to) WHEN invoices are generated THEN they are directed to the bill-to parent customer for consolidated billing.
5. GIVEN a customer WHEN credit terms (creditLimit, paymentTermsId, creditDays) are configured THEN these are used as defaults on new invoices and orders.
6. GIVEN a customer with isActive = false WHEN any user attempts to create an invoice or order for them THEN the system rejects per BR-AR-007 (blocked customers reject all transactions).

**Key Tasks:**
- [ ] Create Prisma model for Customer (~80+ fields) (AC: #1)
  - [ ] Fields: id, customerNumber (unique, NumberSeries), name, legalName, customerType enum, invoiceToCustomerId (self-ref FK), creditLimit Decimal(19,4), paymentTermsId FK, blocked Boolean, onHold Boolean, isActive, vatNumber, companyId, createdBy, updatedBy, createdAt, updatedAt
- [ ] Create Prisma models for CustomerAddress and CustomerContact (AC: #2, #3)
  - [ ] CustomerAddress: id, customerId FK, addressType enum (4 values), line1/line2/city/county/postcode/countryCode
  - [ ] CustomerContact: id, customerId FK, firstName, lastName, email, phone, jobTitle, isPrimary
- [ ] Implement CRUD service with companyId scoping and NumberSeries integration (AC: #1)
- [ ] Implement bill-to consolidation via invoiceToCustomerId self-referential relation (AC: #4)
- [ ] Implement blocked/on-hold guards per BR-AR-007 and BR-AR-008 (AC: #6)
- [ ] Register routes: CRUD `/ar/customers`, GET/POST `/:id/addresses`, PATCH `/:id/addresses/:addrId`, GET/POST `/:id/contacts`, GET `/:id/balance`, GET `/:id/credit-check`, GET `/:id/statement`, GET `/:id/transaction-history` (AC: #1–#6)
- [ ] Write unit tests for customer creation, blocked guard, and bill-to resolution (AC: #1, #4, #6)

**FR/NFR:** FR19, FR25; NFR41 (TypeScript strict), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | Customer model (~80+ fields), self-ref bill-to, address/contact sub-entities |
| API Contracts | §2.9 | CRUD `/ar/customers`, addresses, contacts, balance, credit-check, statement, transaction-history |
| Data Models | §3.4 | Customer (customerNumber, customerType, invoiceToCustomerId self-ref, creditLimit), CustomerAddress (addressType 4-value enum), CustomerContact |
| State Machines | §1 | Reference entity: isActive soft-delete pattern |
| Event Catalog | N/A — customer CRUD does not emit events (lead.converted creates customer via CRM) |
| Business Rules | §4 | BR-AR-007 (blocked customers reject transactions), BR-AR-008 (on-hold warning), BR-AR-009 (credit limit calculation) |
| UX Design Spec | §T1, §T2 | T1 for customer list, T2 for customer detail with tabs (Primary, Addresses, Contacts, Financial, History) |
| Project Context | §1 | companyId scoping, RegisterSharingRule for shared customers |

---

## Story E17.S2: Customer Invoices

**User Story:** As a finance manager, I want to create, approve, post, and void customer invoices with GL journal entry generation, so that revenue is accurately recorded and the AR control account is maintained.

**Acceptance Criteria:**
1. GIVEN an AR clerk WHEN they create a CustomerInvoice with customerId, invoiceType (STANDARD/CASH/CREDIT_NOTE/DEBIT_NOTE/PROFORMA), and at least one line THEN the invoice is persisted in DRAFT status with auto-generated invoiceNumber.
2. GIVEN a DRAFT invoice with at least one line WHEN approved (or auto-approved if totalAmount < invoiceAutoApproveThreshold per BR-AR-005) THEN the status transitions to APPROVED, totals are recalculated, dueDate is set from payment terms, and `invoice.approved` event is emitted per BR-AR-004.
3. GIVEN an APPROVED invoice WHEN posted THEN the status transitions to POSTED, a balanced JournalEntry is created (DR AR_CONTROL for totalAmount, CR SALES_REVENUE per line, CR VAT_OUTPUT per VAT code), outstandingAmount is set to totalAmount, journalEntryId is set, and `invoice.posted` event is emitted per BR-AR-002.
4. GIVEN a POSTED invoice WHEN voided THEN the status transitions to VOID, a reversal JournalEntry is created with swapped debits/credits, outstandingAmount is set to zero, and `invoice.voided` event is emitted per BR-AR-003.
5. GIVEN an invoice of type CREDIT_NOTE WHEN processed THEN it follows the same lifecycle as a standard invoice per BR-AR-006.
6. GIVEN a DRAFT or APPROVED invoice WHEN cancelled THEN the status transitions to CANCELLED with no GL impact per BR-AR-001.

**Key Tasks:**
- [ ] Create Prisma models for CustomerInvoice and CustomerInvoiceLine (AC: #1)
  - [ ] CustomerInvoice: id, invoiceNumber (unique, NumberSeries), customerId FK, invoiceType InvoiceType enum (5 values), status InvoiceStatus enum (5 values), invoiceDate, dueDate, subtotal, vatAmount, totalAmount, outstandingAmount, paidAmount, currencyCode, exchangeRate, journalEntryId, companyId
  - [ ] CustomerInvoiceLine: id, invoiceId FK (cascade), lineNumber, itemId, description, quantity, unitPrice, discountPercent, lineTotal, vatCodeId, vatAmount, accountCode
- [ ] Implement invoice state machine: DRAFT→APPROVED→POSTED, DRAFT/APPROVED→CANCELLED, POSTED→VOID (AC: #2–#6)
- [ ] Implement auto-approve threshold check from SystemSetting (AC: #2)
- [ ] Implement GL posting via createGlPosting() with AccountMapping (AR_CONTROL, SALES_REVENUE, VAT_OUTPUT) (AC: #3)
- [ ] Implement voiding with reversal JE creation (AC: #4)
- [ ] Emit events: `invoice.created`, `invoice.approved`, `invoice.posted`, `invoice.voided`, `invoice.cancelled` (AC: #2–#6)
- [ ] Register routes: CRUD `/ar/invoices`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/post`, POST `/:id/void`, POST `/:id/credit`, POST `/:id/email` (AC: #1–#6)
- [ ] Write unit tests for each state transition, GL posting, and void reversal (AC: #2–#4)

**FR/NFR:** FR20, FR23; NFR36 (double-entry), NFR37 (period locks), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | CustomerInvoice/Line models, GL posting pattern (DR AR_CONTROL, CR Revenue + VAT) |
| API Contracts | §2.9, §3.3 | CRUD `/ar/invoices`, POST `/:id/post` (CustomerInvoice response schema), POST `/:id/void` |
| Data Models | §3.4 | CustomerInvoice (invoiceType 5-value enum, status 5-value enum, outstandingAmount, paidAmount, journalEntryId), CustomerInvoiceLine |
| State Machines | §5.1 | CustomerInvoice: DRAFT→APPROVED→POSTED; POSTED→VOID; DRAFT/APPROVED→CANCELLED; GL posting pattern |
| Event Catalog | §3 | `invoice.created`, `invoice.approved`, `invoice.posted`, `invoice.voided` — subscribers: Finance (GL), Audit, CRM, Communications |
| Business Rules | §4 | BR-AR-001 (status transitions), BR-AR-002 (posting creates balanced JE), BR-AR-003 (voiding creates reversal JE), BR-AR-004 (min 1 line), BR-AR-005 (auto-approve threshold), BR-AR-006 (credit notes as invoices) |
| UX Design Spec | §T1, §T3 | T1 for invoice list, T3 for invoice form with header+lines, ActionBar with Approve/Post/Void |
| Project Context | §15 | XM-006 (unified GL posting via createGlPosting()) |

---

## Story E17.S3: Customer Payments

**User Story:** As a finance clerk, I want to record customer payments, allocate them against invoices, and handle on-account payments, so that AR balances are accurately tracked and customer accounts are up to date.

**Acceptance Criteria:**
1. GIVEN a finance clerk WHEN they create a CustomerPayment with customerId, amount, paymentMethod (BANK_TRANSFER/CARD/CASH/CHEQUE/DIRECT_DEBIT), and bankAccountId THEN the payment is persisted in DRAFT status.
2. GIVEN a DRAFT payment WHEN posted THEN the status transitions to POSTED, a JournalEntry is created (DR Bank, CR AR_CONTROL), and `payment.posted` event is emitted.
3. GIVEN a POSTED payment WHEN allocated against one or more invoices THEN PaymentAllocation records are created, each invoice's paidAmount increases and outstandingAmount decreases accordingly.
4. GIVEN a payment amount exceeding the allocated total WHEN allocation is saved THEN the unallocated portion remains as an on-account credit balance on the customer per BR-AR-011.
5. GIVEN a POSTED payment WHEN cancelled/reversed THEN a mirror JournalEntry is created (swapped DR/CR), all linked invoice outstandingAmount and paidAmount values are restored, and allocation records are soft-deleted per BR-AR-012.
6. GIVEN a multi-currency payment WHEN posted at a different exchange rate than the invoice THEN FX differences are posted to EXCHANGE_GAIN or EXCHANGE_LOSS accounts.

**Key Tasks:**
- [ ] Create Prisma models for CustomerPayment and PaymentAllocation (AC: #1, #3)
  - [ ] CustomerPayment: id, paymentNumber (NumberSeries), customerId FK, paymentMethod PaymentMethod enum, status PaymentStatus enum, amount Decimal(19,4), bankAccountId FK, currencyCode, exchangeRate, companyId
  - [ ] PaymentAllocation: id, paymentId FK, invoiceId FK, amount Decimal(19,4), discountAmount, isActive (soft-delete)
- [ ] Implement payment state machine: DRAFT→POSTED→CANCELLED (AC: #2, #5)
- [ ] Implement GL posting via createGlPosting() (DR Bank, CR AR_CONTROL) (AC: #2)
- [ ] Implement allocation service: create PaymentAllocation records, update invoice paidAmount/outstandingAmount (AC: #3)
- [ ] Implement on-account handling for unallocated portions (AC: #4)
- [ ] Implement payment reversal with mirror JE and invoice restoration (AC: #5)
- [ ] Implement FX difference calculation on multi-currency payments (AC: #6)
- [ ] Register routes: CRUD `/ar/payments`, POST `/:id/post`, POST `/:id/allocate`, POST `/:id/void` (AC: #1–#6)
- [ ] Write unit tests for allocation, on-account, reversal, and FX handling (AC: #3–#6)

**FR/NFR:** FR21; NFR36 (double-entry), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | CustomerPayment model, PaymentAllocation, GL posting (DR Bank, CR AR_CONTROL) |
| API Contracts | §2.9, §3.3 | CRUD `/ar/payments`, POST `/:id/post`, POST `/:id/allocate` (PaymentAllocationRequest/Result schemas), POST `/:id/void` |
| Data Models | §3.4 | CustomerPayment (paymentMethod 5-value enum, status 3-value enum), PaymentAllocation (paymentId, invoiceId, amount) |
| State Machines | §5.2 | CustomerPayment: DRAFT→POSTED→CANCELLED; side effects for GL posting and allocation restoration |
| Event Catalog | §3 | `payment.posted` — subscribers: Finance (GL: DR Bank, CR AR_CONTROL), Audit, CRM (PAYMENT_RECEIVED auto-activity) |
| Business Rules | §4 | BR-AR-011 (on-account payments permitted), BR-AR-012 (reversal creates mirror JE, restores invoice balances) |
| UX Design Spec | §T3 | T3 form for payment entry with allocation grid |
| Project Context | §15 | XM-006 (unified GL posting) |

---

## Story E17.S4: Credit Management

**User Story:** As a finance manager, I want to set credit limits per customer and have the system check exposure at invoice approval and order confirmation, so that credit risk is controlled with configurable warn/block behaviour.

**Acceptance Criteria:**
1. GIVEN a customer with creditLimit set WHEN the CreditCheckService calculates exposure THEN exposure = outstanding posted invoices + uninvoiced approved orders per BR-AR-009/XM-001.
2. GIVEN exposure exceeds creditLimit WHEN the system setting ar.creditLimitAction = WARN THEN a warning is surfaced but the transaction may proceed per BR-AR-009.
3. GIVEN exposure exceeds creditLimit WHEN the system setting ar.creditLimitAction = BLOCK THEN the transaction is rejected per BR-AR-009.
4. GIVEN credit checks run at invoice approval WHEN the approval endpoint is called THEN the CreditCheckService is invoked per BR-AR-010.
5. GIVEN credit checks run at sales order confirmation WHEN the order approval endpoint is called THEN the same CreditCheckService is invoked per BR-AR-010.
6. GIVEN a customer with blocked = true WHEN any transaction is attempted THEN it is rejected regardless of credit limit per BR-AR-007.

**Key Tasks:**
- [ ] Implement CreditCheckService as shared service in AR module consumed by both AR and Sales (AC: #1, #4, #5)
  - [ ] Calculate exposure: sum outstanding invoices + sum uninvoiced order totals
  - [ ] Compare against customer.creditLimit
  - [ ] Return warning or error based on ar.creditLimitAction setting
- [ ] Integrate CreditCheckService into invoice approval flow (AC: #4)
- [ ] Integrate CreditCheckService into sales order approval flow (AC: #5)
- [ ] Implement blocked customer guard at service layer (AC: #6)
- [ ] Add SystemSetting `ar.creditLimitAction` with values WARN/BLOCK (default: WARN) (AC: #2, #3)
- [ ] Register route: GET `/ar/customers/:id/credit-check` for manual credit exposure check (AC: #1)
- [ ] Write unit tests for exposure calculation, warn vs block modes, and blocked guard (AC: #1–#6)

**FR/NFR:** FR19; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | CreditCheckService shared service, credit limit on Customer model |
| API Contracts | §2.9 | GET `/ar/customers/:id/credit-check` |
| Data Models | §3.4 | Customer.creditLimit, Customer.blocked, Customer.onHold |
| State Machines | N/A — credit check is a validation, not a lifecycle |
| Event Catalog | N/A — credit checks do not emit events |
| Business Rules | §4 | BR-AR-007 (blocked rejects all), BR-AR-008 (on-hold warns), BR-AR-009 (credit limit calculation, configurable action), BR-AR-010 (checks at invoice approval + order confirmation) |
| UX Design Spec | §T2 | T2 Record Detail for customer with credit exposure display |
| Project Context | §15 | XM-001 (credit limit checks cross AR and Sales) |

---

## Story E17.S5: Statements & Aged Debtors

**User Story:** As a finance manager, I want to generate customer statements and aged debtors reports, so that I can chase overdue payments and monitor overall AR health.

**Acceptance Criteria:**
1. GIVEN a customer with posted invoices and payments WHEN the user requests a statement via GET `/ar/customers/:id/statement` THEN a customer statement is generated showing all transactions in date order with running balance.
2. GIVEN the statement data WHEN the user generates PDF THEN the Document Templates system creates a formatted PDF statement per the customer statement template.
3. GIVEN the aged debtors report endpoint WHEN a user runs it THEN outstanding invoices are categorised into aging buckets: Current, 30 days, 60 days, 90+ days, with totals per customer and grand totals.
4. GIVEN multiple customers with outstanding balances WHEN the user runs batch statement generation THEN statements are generated for all qualifying customers.
5. GIVEN an overdue invoice WHEN the scheduled job runs THEN an `invoice.overdue` event is emitted for notification and AI briefing integration.

**Key Tasks:**
- [ ] Implement customer statement generation service (AC: #1)
- [ ] Integrate with Document Templates for PDF statement generation (AC: #2)
- [ ] Implement aged debtors report with configurable aging buckets (current/30/60/90+) (AC: #3)
- [ ] Implement batch statement generation endpoint (AC: #4)
- [ ] Implement BullMQ scheduled job for overdue invoice detection and event emission (AC: #5)
- [ ] Register routes: GET `/ar/customers/:id/statement`, GET `/ar/reports/aging`, GET `/ar/reports/overdue`, POST `/ar/reports/statements/batch` (AC: #1–#5)
- [ ] Write unit tests for aging bucket calculation and statement balance accuracy (AC: #1, #3)

**FR/NFR:** FR22, FR24; NFR3 (reports < 5s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | Statement generation, aging report, overdue detection |
| API Contracts | §2.9 | GET `/ar/customers/:id/statement`, GET `/ar/reports/aging`, GET `/ar/reports/overdue`, POST `/ar/reports/statements/batch`, GET `/ar/reports/cash-receipts`, GET `/ar/reports/sales-by-customer` |
| Data Models | §3.4 | CustomerInvoice (outstandingAmount, dueDate for aging), CustomerPayment (for statement) |
| State Machines | N/A — reports are read-only aggregations |
| Event Catalog | §3 | `invoice.overdue` — subscribers: AI Daily Briefing, Notifications, CRM (follow-up activity) |
| Business Rules | §4 | BR-AR-009 (credit limit informs aged debtors context) |
| UX Design Spec | §T8 | T8 Report template for aged debtors report |
| Project Context | §7 | Printer Management for PDF statement generation |

---

## Story E17.S6: AR Screens

**User Story:** As an AR user, I want standardised list views, detail views, and form screens for customers, invoices, and payments, so that I can manage the full AR lifecycle using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN an AR user WHEN they navigate to Customers THEN a T1 Entity List displays customers with columns for number, name, type, balance, credit limit, and status, with search and filters.
2. GIVEN an AR user WHEN they click a customer THEN a T2 Record Detail displays with tabs: Primary (name, type, terms), Addresses, Contacts, Financial (balance, credit exposure), Invoices, Payments, and Activity History.
3. GIVEN an AR user WHEN they navigate to Invoices THEN a T1 list shows invoices with number, customer, date, total, outstanding, and status, with filters for status, type, and date range.
4. GIVEN an AR user WHEN they open an invoice THEN a T3 Header+Lines form displays with ActionBar showing Approve (DRAFT), Post (APPROVED), Void (POSTED), Email (POSTED).
5. GIVEN an AR user WHEN they navigate to Payments THEN a T1 list shows payments with number, customer, amount, method, and status.
6. GIVEN an AR user WHEN they view the aged debtors report THEN a T8 Report screen shows the aging analysis with drill-down to individual invoices.

**Key Tasks:**
- [ ] Build T1 Entity List for Customers with balance and credit indicators (AC: #1)
- [ ] Build T2 Record Detail for Customer with tabbed layout (AC: #2)
- [ ] Build T1 Entity List for Invoices with status/type/date filters (AC: #3)
- [ ] Build T3 Header+Lines form for Invoice with status-driven ActionBar (AC: #4)
- [ ] Build T1 Entity List for Payments (AC: #5)
- [ ] Build T8 Report for Aged Debtors with drill-down (AC: #6)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#6)

**FR/NFR:** FR19–FR25; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.15 | All AR entities and relationships |
| API Contracts | §2.9 | All AR endpoints consumed by frontend |
| Data Models | §3.4 | All AR models for form field mapping |
| State Machines | §5.1, §5.2 | CustomerInvoice and CustomerPayment status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §4 | All BR-AR rules inform validation displays |
| UX Design Spec | §T1, §T2, §T3, §T8, §Action Bar | T1 for lists, T2 for customer detail, T3 for invoice form, T8 for aged debtors |
| Project Context | §3 | All strings use translation keys |

---

## Story E17.S7: Mobile Adaptation

**User Story:** As a business owner on mobile, I want to look up customer details, view outstanding balances, and record payment receipts, so that I can manage AR on the go.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they search for a customer THEN they can find customers by name, number, or contact details with results showing balance and status.
2. GIVEN a mobile user WHEN they view a customer THEN they see a summary card with name, outstanding balance, credit limit usage, and recent invoices.
3. GIVEN a mobile user WHEN they view outstanding balances THEN a simplified aged debtors view shows top customers by amount overdue.
4. GIVEN a mobile user WHEN they record a payment receipt THEN a simplified form captures customer, amount, payment method, and saves as DRAFT for desktop posting.
5. GIVEN all mobile AR screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column optimised.

**Key Tasks:**
- [ ] Implement mobile customer search with balance display (AC: #1)
- [ ] Build mobile customer summary card component (AC: #2)
- [ ] Build simplified mobile aged debtors view (AC: #3)
- [ ] Build simplified mobile payment receipt form (AC: #4)
- [ ] Ensure 44x44px touch targets and responsive layout (AC: #5)

**FR/NFR:** FR19, FR21, FR24; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native) |
| API Contracts | §2.9 | AR endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status only |
| Event Catalog | N/A — mobile receives push notifications for payment events |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets |
| Project Context | §8 | Mobile as end-of-epic story |

---
