# Epic E26b: Point of Sale (POS)

> **POS terminal operations with session management, product lookup, multi-payment processing, receipt generation, offline mode, and cash drawer management.**

**Architecture:** §2.24 POS
**Models:** 14 models
**State Machines:** SM:PosSession, SM:PosTransaction, SM:CashDrawer
**Business Rules:** POS-001 to POS-020
**FRs:** FR116–FR122
**API:** §2.20 — ~29 endpoints under `/pos/*`

**Dependencies:** E15 (Inventory), E17 (AR for customer invoicing), E14 (Finance/GL)

---

## Story E26b.S1: POS Session Management

**User Story:** As a cashier, I want to open and close POS sessions with cash float entry and Z-report generation so that cash handling is tracked and reconciled daily.

**Acceptance Criteria:**

```gherkin
Scenario: Open POS session
  Given I am a POS operator
  When I open a session with cash float of GBP 100
  Then a PosSession is created with status OPEN and opening float recorded

Scenario: Close session with Z-report
  Given a session has processed 50 transactions
  When I close the session with cash counted as GBP 850
  Then a Z-report is generated showing total sales by payment method
  And cash variance (expected vs counted) is calculated (FR116)
```

**Key Tasks:**
1. **Create POS session models** — PosSession, PosTransaction, PosTransactionLine, PosPayment, CashDrawerOperation
2. **Implement session open/close endpoints** — float entry, Z-report generation, variance calculation
3. **Build POS session UI** — dedicated POS terminal interface
4. **Write tests** — session lifecycle, Z-report calculation, variance

**FR/NFR References:** FR116, FR122, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR116, FR122) | Session management, Z-reports, cash reconciliation |
| Architecture | §2.24 POS | POS session models and workflow |
| UX Design Specification | Custom POS layout | POS terminal interface |
| API Contracts | §2.20 POS | Session management endpoints |
| Data Models | §14 POS | PosSession, CashDrawerOperation schemas |
| State Machine Reference | §11 POS | SM:PosSession — OPEN → CLOSED |
| Event Catalog | §10 POS | pos.session.opened, pos.session.closed events |
| Business Rules Compendium | §9 POS | POS-001 to POS-005 (session rules) |

---

## Story E26b.S2: Product Lookup & Transaction Processing

**User Story:** As a cashier, I want to look up products by name, code, or barcode and process transactions with line items, discounts, and VAT so that sales are recorded accurately.

**Acceptance Criteria:**

```gherkin
Scenario: Look up product by barcode scan
  Given I scan barcode "5012345678901"
  When the lookup completes
  Then the item name, price, and available stock are displayed (FR117)

Scenario: Process a sale transaction
  Given I add 3 items to the transaction
  When I total the sale
  Then the transaction shows line items, subtotal, VAT, and grand total
  And POS-specific pricing rules and discounts are applied (FR120)
```

**Key Tasks:**
1. **Implement product lookup** — by name search, item code, barcode scan
2. **Implement transaction processing** — add/remove lines, apply discounts, calculate VAT
3. **Implement POS pricing rules** — POS-specific promotions and discounts
4. **Build POS product lookup and transaction UI**
5. **Write tests** — lookup, pricing, VAT calculation

**FR/NFR References:** FR117, FR120, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR117, FR120) | Product lookup, pricing rules |
| Architecture | §2.24 POS | Transaction processing, pricing engine |
| UX Design Specification | Custom POS layout | Product lookup and transaction UI |
| API Contracts | §2.20 POS | Product lookup, transaction endpoints |
| Data Models | §14 POS | PosTransaction, PosTransactionLine schemas |
| State Machine Reference | §11 POS | SM:PosTransaction lifecycle |
| Event Catalog | §10 POS | pos.transaction.completed event |
| Business Rules Compendium | §9 POS | POS-006 to POS-012 (transaction rules) |

---

## Story E26b.S3: Multi-Payment & Receipts

**User Story:** As a cashier, I want to process multiple payment methods per transaction and print or email receipts so that customers can pay flexibly and receive proof of purchase.

**Acceptance Criteria:**

```gherkin
Scenario: Split payment (cash + card)
  Given a transaction total is GBP 50
  When the customer pays GBP 20 cash and GBP 30 card
  Then both payment records are created and the transaction is completed (FR118)

Scenario: Print receipt
  Given a transaction is completed
  When I print the receipt
  Then a formatted receipt is generated with items, payments, and VAT breakdown (FR119)

Scenario: Email receipt
  Given the customer provides their email
  When I send an email receipt
  Then the receipt PDF is emailed to the customer
```

**Key Tasks:**
1. **Implement multi-payment processing** — cash, card, voucher, split payments
2. **Implement receipt generation** — print and email with full transaction details
3. **Build payment UI** — payment method selector, amount entry, change calculation
4. **Write tests** — split payment scenarios, receipt formatting

**FR/NFR References:** FR118, FR119, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR118, FR119) | Multi-payment, receipts |
| Architecture | §2.24 POS | Payment processing, receipt generation |
| UX Design Specification | Custom POS layout | Payment and receipt UI |
| API Contracts | §2.20 POS | Payment and receipt endpoints |
| Data Models | §14 POS | PosPayment schema |
| State Machine Reference | §11 POS | Transaction completion with payment |
| Event Catalog | §10 POS | pos.payment.processed event |
| Business Rules Compendium | §9 POS | POS-013 to POS-016 (payment rules) |

---

## Story E26b.S4: Offline Mode & Sync

**User Story:** As a POS operator, I want the terminal to continue operating when the network is down and automatically sync transactions when connectivity restores so that sales are never lost.

**Acceptance Criteria:**

```gherkin
Scenario: Process sale offline
  Given the network connection is lost
  When I process a cash sale
  Then the transaction is stored locally on the device (FR121)

Scenario: Automatic sync on reconnection
  Given 10 offline transactions are queued
  When the network connection restores
  Then all transactions are synced to the server automatically
  And inventory levels and GL are updated
```

**Key Tasks:**
1. **Implement offline transaction storage** — IndexedDB/SQLite local storage
2. **Implement sync engine** — queue-based sync with conflict resolution
3. **Implement connectivity detection** — auto-switch between online/offline modes
4. **Write tests** — offline processing, sync ordering, conflict resolution

**FR/NFR References:** FR121, NFR21, NFR22

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR121) | Offline mode and sync |
| Architecture | §2.24 POS | Offline architecture, sync engine |
| UX Design Specification | Custom POS layout | Offline indicator |
| API Contracts | §2.20 POS | Sync endpoints |
| Data Models | §14 POS | Local storage schema |
| State Machine Reference | §11 POS | Offline transaction lifecycle |
| Event Catalog | §10 POS | pos.sync.completed event |
| Business Rules Compendium | §9 POS | POS-017 to POS-018 (offline rules) |

---

## Story E26b.S5: Cash Drawer & Till Reconciliation

**User Story:** As a supervisor, I want to manage cash drawer operations with till reconciliation and variance reporting.

**Acceptance Criteria:**

```gherkin
Scenario: Till reconciliation
  Given a POS session is being closed
  When the cashier counts denominations
  Then the expected vs actual cash is calculated
  And variance is recorded and reported (FR122)
```

**Key Tasks:**
1. **Implement cash drawer operations** — open/close, denomination counting
2. **Implement till reconciliation** — expected vs actual, variance calculation
3. **Build reconciliation UI**
4. **Write tests** — denomination counting, variance calculation

**FR/NFR References:** FR122, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS (FR122) | Cash drawer, till reconciliation |
| Architecture | §2.24 POS | Cash management models |
| UX Design Specification | Custom POS layout | Reconciliation interface |
| API Contracts | §2.20 POS | Cash drawer endpoints |
| Data Models | §14 POS | CashDrawerOperation schema |
| State Machine Reference | §11 POS | SM:CashDrawer lifecycle |
| Event Catalog | §10 POS | pos.drawer events |
| Business Rules Compendium | §9 POS | POS-019 to POS-020 (cash rules) |

---

## Story E26b.S6: POS GL Integration & Reporting

**User Story:** As a finance user, I want POS transactions to post to the GL and I want daily POS reports so that retail operations are reflected in financial statements.

**Key Tasks:**
1. Implement POS-to-GL posting (sales revenue, VAT, payment method accounts)
2. Implement daily POS summary report
3. Write tests

**FR/NFR References:** FR116, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS | GL integration |
| Architecture | §2.24 POS | GL posting design |
| UX Design Specification | T8 (Report) | POS reports |
| API Contracts | §2.20 POS | Reporting endpoints |
| Data Models | §14 POS, §3 Finance | POS-to-GL mapping |
| State Machine Reference | §11 POS | Post-completion GL posting |
| Event Catalog | §10 POS | pos.gl.posted event |
| Business Rules Compendium | §9 POS | GL posting rules |

---

## Story E26b.S7: Mobile Adaptation — POS

**User Story:** As a POS operator, I want a tablet-optimised POS interface with barcode scanning for use on mobile devices.

**Key Tasks:**
1. Create tablet-optimised POS layout (Expo)
2. Implement barcode scanning via camera
3. Implement offline mode on mobile
4. Write tests

**FR/NFR References:** FR117, FR121, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.14 POS | Mobile POS |
| Architecture | §2.24 POS | Mobile POS design |
| UX Design Specification | Mobile strategy section | Tablet POS patterns |
| API Contracts | §2.20 POS | Same endpoints |
| Data Models | §14 POS | Same models |
| State Machine Reference | §11 POS | Same state machines |
| Event Catalog | §10 POS | Same events |
| Business Rules Compendium | §9 POS | Same rules |

---
