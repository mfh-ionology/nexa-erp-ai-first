# Epic E14: Finance / NL (General Ledger)

**Tier:** 2 — First Business Module
**Dependencies:** E3 (Event Bus + Audit), E4 (i18n), E6 (Web Frontend Shell), E8 (Attachments + Notes + Record Links)
**FRs:** FR11–FR18
**Module Path:** `api/src/modules/finance/`

---

## Story E14.S1: Chart of Accounts

**User Story:** As a finance administrator, I want to create and manage a hierarchical chart of accounts with standard UK GAAP account types, so that all financial transactions can be categorised and reported correctly.

**Acceptance Criteria:**
1. GIVEN a finance administrator is logged in WHEN they create a new GL account with code, name, accountType (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), and normalBalance (DEBIT/CREDIT) THEN the account is persisted with companyId scoping and a success toast is displayed.
2. GIVEN an existing GL account WHEN the administrator sets a parentCode referencing another account THEN the account appears as a child node in the hierarchical tree view via GET `/finance/chart-of-accounts/tree`.
3. GIVEN a GL account has JournalLine records in the current fiscal year WHEN the administrator attempts to deactivate it THEN the system rejects the request with an error message referencing BR-FIN-005.
4. GIVEN a system-seeded account (e.g., AR_CONTROL, AP_CONTROL) WHEN any user attempts to delete it THEN the system rejects the request with a protection error per BR-FIN-006.
5. GIVEN the account list endpoint WHEN a VIEWER-role user requests the tree THEN only accounts within their companyId scope are returned, with cursor-based pagination and optional isActive filter.

**Key Tasks:**
- [ ] Create Prisma model for ChartOfAccount with self-referential parent/children relation (AC: #2)
  - [ ] Add fields: id, code (unique), name, accountType enum, normalBalance enum, parentCode (nullable self-ref FK), classificationId (nullable FK), isActive, companyId, createdAt, updatedAt
  - [ ] Add @@map("chart_of_accounts") and indexes on [companyId, code], [companyId, isActive]
- [ ] Implement CRUD service layer with companyId scoping (AC: #1, #5)
  - [ ] Create validation: unique code per company, valid accountType, valid parentCode if provided
  - [ ] Deactivation guard: query JournalLine for current fiscal year references (AC: #3)
  - [ ] Deletion guard: check system account protection list (AC: #4)
- [ ] Implement GET `/finance/chart-of-accounts/tree` endpoint returning nested hierarchy (AC: #2)
- [ ] Register CRUD routes on `/finance/chart-of-accounts` with RBAC (MANAGER for CUD, VIEWER for R) (AC: #5)
- [ ] Seed default UK GAAP (FRS 102) chart of accounts template on company creation (AC: #4)
- [ ] Add translation keys for all account types, error messages, and UI labels (AC: #1)
- [ ] Write unit tests for hierarchy building, deactivation guard, and deletion guard (AC: #3, #4)

**FR/NFR:** FR11; NFR38 (Decimal precision), NFR41 (TypeScript strict), NFR43 (80% test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | ChartOfAccount model, self-referential hierarchy, system account seeding |
| API Contracts | §2.7 | CRUD `/finance/chart-of-accounts`, GET `/finance/chart-of-accounts/tree` |
| Data Models | §3.2 | ChartOfAccount fields: code, name, accountType, normalBalance, parentCode, classificationId, isActive |
| State Machines | §1 | Reference entity pattern: isActive true/false (soft-delete) |
| Event Catalog | N/A — CoA changes do not emit domain events in MVP |
| Business Rules | §2 | BR-FIN-005 (deactivation guard), BR-FIN-006 (system account protection) |
| UX Design Spec | §T1, §T7 | T1 Entity List for CoA list, T7 Settings for CoA setup |
| Project Context | §1 | companyId on every table, query scoping pattern |

---

## Story E14.S2: Account Classifications & Mappings

**User Story:** As a finance administrator, I want to configure account classifications and GL account mappings for all 28 posting types, so that sub-modules can automatically determine the correct GL accounts when creating journal entries.

**Acceptance Criteria:**
1. GIVEN the administrator creates an AccountClassification with a unique code and name WHEN saved THEN it appears in the classification list and can be assigned to ChartOfAccount records.
2. GIVEN the administrator creates an AccountMapping with mappingType AR_CONTROL and a valid accountCode WHEN a sub-module calls createGlPosting() for an AR invoice THEN the mapping is resolved and the correct account is used.
3. GIVEN an AccountMapping with a departmentId scope WHEN the GL posting service resolves a mapping for that department THEN the department-specific mapping takes priority; if none found, the generic (null department) mapping is used as fallback per BR-FIN-007.
4. GIVEN no AccountMapping exists for a required mappingType WHEN createGlPosting() is called THEN a MissingAccountMappingError is thrown.
5. GIVEN the 28 AccountMappingType enum values WHEN the administrator views the mapping configuration screen THEN all 28 types are listed with their current account assignments and department overrides.

**Key Tasks:**
- [ ] Create Prisma model for AccountClassification (id, code, name, companyId) (AC: #1)
- [ ] Create Prisma model for AccountMapping (id, mappingType enum, accountCode FK, departmentId nullable FK, companyId) (AC: #2)
  - [ ] Add AccountMappingType enum with all 28 values: AR_CONTROL, AP_CONTROL, STOCK, STOCK_COST, STOCK_VARIANCE, SALES_REVENUE, PURCHASE_EXPENSE, VAT_OUTPUT, VAT_INPUT, EXCHANGE_GAIN, EXCHANGE_LOSS, ROUNDING, BANK_CHARGES, DISCOUNT_GIVEN, DISCOUNT_RECEIVED, INTEREST_INCOME, INTEREST_EXPENSE, DEPRECIATION_EXPENSE, ACCUMULATED_DEPRECIATION, ASSET_DISPOSAL_GAIN, ASSET_DISPOSAL_LOSS, WIP, PRODUCTION_OVERHEAD, PAYROLL_EXPENSE, PAYROLL_LIABILITY, RETENTION, CASH_IN_TRANSIT, POS_CLEARING
- [ ] Implement resolveAccountMapping(mappingType, departmentId?) service with fallback chain (AC: #3, #4)
- [ ] Register CRUD routes for `/finance/account-classifications` (ADMIN) and `/finance/account-mappings` (ADMIN) (AC: #5)
- [ ] Write unit tests for mapping resolution fallback chain and MissingAccountMappingError (AC: #3, #4)

**FR/NFR:** FR11; NFR41 (TypeScript strict)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | AccountMapping model, 28 mapping types, department fallback chain |
| API Contracts | §2.7 | CRUD `/finance/account-classifications`, CRUD `/finance/account-mappings` |
| Data Models | §3.2 | AccountClassification, AccountMapping with AccountMappingType enum (28 values) |
| State Machines | N/A — reference entities use isActive pattern |
| Event Catalog | N/A — classification/mapping changes do not emit events |
| Business Rules | §2 | BR-FIN-007 (mapping required for GL posting, department→generic fallback) |
| UX Design Spec | §T7 | T7 Settings template for mapping configuration |
| Project Context | §1 | companyId scoping, §11 development rules |

---

## Story E14.S3: Financial Periods

**User Story:** As a finance administrator, I want to manage financial periods with open/closed/locked lifecycle states, so that I can control when transactions can be posted and permanently seal completed periods.

**Acceptance Criteria:**
1. GIVEN an administrator WHEN they call POST `/finance/financial-periods/generate` with a fiscal year THEN 12 monthly periods are auto-generated with sequential periodNumber, correct start/end dates, status OPEN, and unique constraint on [year, periodNumber] per BR-FIN-004.
2. GIVEN a period in OPEN status WHEN the administrator closes it THEN the status transitions to CLOSED and a warning is surfaced if any reconciliations for the period are not COMPLETED.
3. GIVEN a period in CLOSED status WHEN the administrator locks it THEN the status transitions to LOCKED, lockedAt and lockedBy are set, and a `period.locked` event is emitted.
4. GIVEN a period in CLOSED status WHEN the administrator reopens it THEN the status reverts to OPEN and posting is re-enabled.
5. GIVEN a period in LOCKED status WHEN any user attempts to post a journal entry to it THEN the system rejects with PeriodLockError per BR-FIN-003.
6. GIVEN a period in LOCKED status WHEN any user attempts to reopen it THEN the system rejects the request (LOCKED is a terminal state).

**Key Tasks:**
- [ ] Create Prisma model for FinancialPeriod (id, name, code, startDate, endDate, status PeriodStatus enum, fiscalYear, periodNumber, lockedAt, lockedBy, companyId) (AC: #1)
  - [ ] Add unique constraint on [companyId, fiscalYear, periodNumber]
- [ ] Implement period generation service for auto-creating 12 monthly periods (AC: #1)
- [ ] Implement state machine: OPEN→CLOSED, CLOSED→OPEN, CLOSED→LOCKED with guards (AC: #2, #3, #4, #6)
- [ ] Emit `period.locked` and `period.unlocked` events on transitions (AC: #3)
- [ ] Implement period lock check utility used by all GL posting operations (AC: #5)
- [ ] Register routes: CRUD `/finance/financial-periods`, POST `/:id/lock`, POST `/:id/unlock`, POST `/generate` (ADMIN role) (AC: #1–#6)
- [ ] Write unit tests for state transitions, guards, and period lock enforcement (AC: #2–#6)

**FR/NFR:** FR14; NFR37 (period locks at DB level), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | FinancialPeriod model, period lifecycle, year-end close |
| API Contracts | §2.7 | CRUD `/finance/financial-periods`, POST `/:id/lock`, POST `/:id/unlock`, POST `/generate` |
| Data Models | §3.2 | FinancialPeriod: name, code, startDate, endDate, status (PeriodStatus), fiscalYear, periodNumber |
| State Machines | §2.2 | FinancialPeriod: OPEN→CLOSED→LOCKED, CLOSED→OPEN reopen |
| Event Catalog | §1 | `period.locked`, `period.unlocked` — subscribed by all financial modules |
| Business Rules | §2 | BR-FIN-003 (no posting to locked periods), BR-FIN-004 (unique year+period) |
| UX Design Spec | §T7 | T7 Settings for period management |
| Project Context | §11 | Every state change emits a typed event |

---

## Story E14.S4: Journal Entries

**User Story:** As a finance manager, I want to create, post, and reverse manual journal entries with double-entry balance enforcement, so that all financial transactions are accurately recorded in the general ledger.

**Acceptance Criteria:**
1. GIVEN a finance manager creates a journal entry with lines WHEN the sum of debit amounts does not equal the sum of credit amounts THEN the system rejects the save with UnbalancedEntryError per BR-FIN-001.
2. GIVEN a DRAFT journal entry with balanced lines WHEN the manager posts it THEN the status transitions to POSTED, postedAt/postedBy are set, ChartOfAccount.currentBalance is updated for each line, the entry number is auto-generated from the JOURNAL NumberSeries (format JE-NNNNN per BR-FIN-012), and a `journal.posted` event is emitted.
3. GIVEN a POSTED journal entry WHEN the manager reverses it THEN a new JournalEntry is created with swapped debits/credits, status POSTED, reversalOfId set to the original, and a `journal.reversed` event is emitted.
4. GIVEN the target financial period is CLOSED or LOCKED WHEN a user attempts to post or reverse a journal entry THEN the system rejects with PeriodLockError per BR-FIN-003.
5. GIVEN a journal entry with source = MANUAL WHEN a user views its lines THEN all JournalLine records show accountCode, debitAmount, creditAmount, description, and optional departmentCode/tagCode.
6. GIVEN all monetary fields WHEN any calculation occurs THEN Decimal(19,4) precision is used per BR-FIN-002.

**Key Tasks:**
- [ ] Create Prisma models for JournalEntry and JournalLine (AC: #1, #5)
  - [ ] JournalEntry: id, entryNumber, entryDate, source (JournalSource enum with 21 values), status (JournalStatus), periodId FK, totalDebit, totalCredit, reversalOfId (self-ref), companyId, postedAt, postedBy, createdBy, updatedBy
  - [ ] JournalLine: id, journalEntryId FK (cascade), lineNumber, accountCode FK, debitAmount Decimal(19,4), creditAmount Decimal(19,4), description, departmentCode, tagCode, currencyCode, foreignAmount, exchangeRate
- [ ] Implement balanced entry validation in service layer (AC: #1, #6)
- [ ] Implement post action with period check, balance update, NumberSeries integration, and event emission (AC: #2, #4)
- [ ] Implement reversal action creating contra-entry with swapped amounts (AC: #3)
- [ ] Implement createGlPosting() shared service for sub-module use (AC: #2)
- [ ] Register routes: CRUD `/finance/journal-entries`, POST `/:id/post`, POST `/:id/reverse`, GET `/:id/lines` (AC: #2, #3, #5)
- [ ] Write unit tests for balance validation, posting, reversal, and period lock enforcement (AC: #1–#4)

**FR/NFR:** FR12; NFR36 (double-entry at DB level), NFR37 (period locks), NFR38 (Decimal 19,4), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | JournalEntry/JournalLine models, createGlPosting() pattern, auto-generated entries |
| API Contracts | §2.7, §3.2 | CRUD `/finance/journal-entries`, POST `/:id/post`, POST `/:id/reverse`; response schema for JournalEntry + JournalLine |
| Data Models | §3.2 | JournalEntry (source: 21-value JournalSource enum), JournalLine (Decimal 19,4 amounts) |
| State Machines | §2.1 | JournalEntry: DRAFT→POSTED→REVERSED; guards, side effects |
| Event Catalog | §1 | `journal.posted`, `journal.reversed` — subscribers: Finance (balance recalc), Audit, AI Context |
| Business Rules | §2 | BR-FIN-001 (balanced entries), BR-FIN-002 (Decimal 19,4), BR-FIN-003 (period lock), BR-FIN-011 (lifecycle), BR-FIN-012 (auto-numbering JE-NNNNN) |
| UX Design Spec | §T3 | T3 Header+Lines template for journal entry form |
| Project Context | §11 | Every state change emits typed event, NumberSeries integration |

---

## Story E14.S5: Multi-Currency & Exchange Rates

**User Story:** As a finance manager, I want to manage currencies and exchange rates with automatic FX gain/loss calculation, so that multi-currency transactions are accurately valued in the base currency.

**Acceptance Criteria:**
1. GIVEN the system module provides Currency and ExchangeRate CRUD WHEN the finance module processes a foreign-currency journal entry THEN the entry stores currencyCode, foreignAmount, and exchangeRate per line, converting to base currency for GL posting.
2. GIVEN an exchange rate exists for a currency on a specific date WHEN a journal line is posted with that currency THEN the system uses the most recent rate on or before the transaction date.
3. GIVEN a payment is received in a foreign currency at a different rate than the original invoice WHEN the payment is posted THEN the FX difference is posted to the EXCHANGE_GAIN or EXCHANGE_LOSS account mapping.
4. GIVEN the exchange rate endpoints WHEN a manager imports rates THEN duplicate date+currency combinations are rejected and only the latest rate per date is stored.

**Key Tasks:**
- [ ] Implement exchange rate lookup service: most recent rate on or before transaction date (AC: #2)
- [ ] Add multi-currency fields to JournalLine (currencyCode, foreignAmount Decimal(19,4), exchangeRate Decimal(18,8)) (AC: #1)
- [ ] Implement FX gain/loss calculation in GL posting service using EXCHANGE_GAIN/EXCHANGE_LOSS account mappings (AC: #3)
- [ ] Register routes for `/system/exchange-rates` CRUD with date+currency uniqueness enforcement (AC: #4)
- [ ] Write unit tests for rate lookup, FX calculation, and rounding (AC: #1–#3)

**FR/NFR:** FR15; NFR38 (Decimal precision for rates: 18,8)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | Multi-currency pattern, exchange rate lookup, FX gain/loss accounts |
| API Contracts | §2.2, §2.7 | System currency/exchange-rate endpoints; finance endpoints consuming rates |
| Data Models | §3.1, §3.2 | Currency (code PK, minorUnit, rounding rules), ExchangeRate (currencyCode, rateDate, rate Decimal(18,8)), JournalLine multi-currency fields |
| State Machines | N/A — currencies and rates are reference data |
| Event Catalog | N/A — exchange rate updates do not emit events in MVP |
| Business Rules | §2 | BR-FIN-002 (Decimal 19,4 for amounts, 18,8 for rates) |
| UX Design Spec | §T7 | T7 Settings for currency/rate management |
| Project Context | §6.7 | Multi-currency pattern: foreignAmount, exchangeRate, base-currency conversion |

---

## Story E14.S6: Bank Accounts & Transaction Import

**User Story:** As a finance manager, I want to manage bank accounts and import transactions from CSV, OFX, or QIF files, so that bank activity is recorded in the system for reconciliation.

**Acceptance Criteria:**
1. GIVEN an administrator WHEN they create a BankAccount with glAccountCode (FK to ChartOfAccount), sortCode, accountNumber, IBAN, BIC, and currencyCode THEN the bank account is persisted and linked to the GL.
2. GIVEN a bank account WHEN the manager imports a CSV/OFX/QIF bank statement THEN BankTransaction records are created with transactionDate, amount, description, importSource, and matchStatus = UNMATCHED.
3. GIVEN a previously imported transaction with the same externalId WHEN the same file is re-imported THEN the duplicate is rejected per BR-FIN-008 (no duplicate bank transactions).
4. GIVEN a successful import WHEN transactions are created THEN a `bank.transactions.imported` event is emitted with bankAccountId, importBatchId, transactionCount, and totalAmount.
5. GIVEN a bank account WHEN a user manually creates a transaction THEN the importSource is set to MANUAL.

**Key Tasks:**
- [ ] Create Prisma model for BankAccount (id, glAccountCode FK, bankName, sortCode, accountNumber, iban, bic, currencyCode, isActive, companyId) (AC: #1)
- [ ] Create Prisma model for BankTransaction (id, bankAccountId FK, transactionDate, amount Decimal(19,4), description, reference, externalId, importSource BankImportSource enum, matchStatus ReconciliationMatchStatus enum, companyId) (AC: #2)
  - [ ] Add unique constraint on [companyId, bankAccountId, externalId] for de-duplication
- [ ] Implement CSV/OFX/QIF parser services for bank statement import (AC: #2)
- [ ] Implement de-duplication via externalId check (AC: #3)
- [ ] Emit `bank.transactions.imported` event after successful import batch (AC: #4)
- [ ] Register routes: CRUD `/finance/bank-accounts`, GET `/:id/transactions`, POST `/:id/import` (AC: #1, #2, #5)
- [ ] Write unit tests for each parser format and de-duplication logic (AC: #2, #3)

**FR/NFR:** FR16; NFR33 (no duplicate bank transactions)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | BankAccount, BankTransaction models, import sources (CSV/OFX/QIF/OPEN_BANKING/MANUAL) |
| API Contracts | §2.7 | CRUD `/finance/bank-accounts`, GET `/:id/transactions`, POST `/:id/import`, POST `/:id/feed/sync` |
| Data Models | §3.2 | BankAccount (glAccountCode, sortCode, accountNumber, iban, bic), BankTransaction (externalId, matchStatus, importSource) |
| State Machines | §2.4 | BankTransaction match status: UNMATCHED→MATCHED→RECONCILED |
| Event Catalog | §1 | `bank.transactions.imported` — subscribers: AI Bank Matcher, Notifications |
| Business Rules | §2 | BR-FIN-008 (no duplicate transactions via externalId) |
| UX Design Spec | §T1, §T6 | T1 Entity List for transactions, T6 Wizard for bank import flow |
| Project Context | §1 | companyId scoping on all tables |

---

## Story E14.S7: Bank Reconciliation

**User Story:** As a finance manager, I want to reconcile bank transactions against GL entries using auto-matching with configurable confidence thresholds, so that bank balances are verified and discrepancies identified.

**Acceptance Criteria:**
1. GIVEN a bank account with imported transactions WHEN the manager creates a BankReconciliation THEN it starts in IN_PROGRESS status with the statement balance entered.
2. GIVEN a reconciliation in progress WHEN the manager triggers auto-match THEN transactions with >= 95% confidence are automatically matched, 60-94% are flagged as SUGGESTED for review, and < 60% remain UNMATCHED per BR-FIN-010.
3. GIVEN a suggested or unmatched transaction WHEN the manager manually matches it to a JournalLine THEN the matchStatus transitions to MATCHED with matchedJournalLineId set.
4. GIVEN a matched transaction WHEN the manager unmatches it (before reconciliation completion) THEN the matchStatus reverts to UNMATCHED and match fields are cleared.
5. GIVEN all items are matched and the difference (statement balance minus reconciled balance) equals zero WHEN the manager completes the reconciliation THEN status transitions to COMPLETED, completedAt/completedBy are set, matched items become RECONCILED, and `bank_reconciliation.completed` is emitted.
6. GIVEN the difference does not equal zero WHEN the manager attempts to complete THEN the system rejects with a zero-difference validation error per BR-FIN-009.

**Key Tasks:**
- [ ] Create Prisma models for BankReconciliation and BankReconciliationLine (AC: #1)
  - [ ] BankReconciliation: id, bankAccountId FK, statementDate, statementBalance, reconciledBalance, difference, status ReconciliationStatus enum, completedAt, completedBy, companyId
  - [ ] BankReconciliationLine: id, reconciliationId FK (cascade), bankTransactionId FK, matchedJournalLineId FK (nullable), matchConfidence
- [ ] Implement auto-match endpoint with configurable thresholds (AC: #2)
- [ ] Implement manual match/unmatch endpoints (AC: #3, #4)
- [ ] Implement completion with zero-difference guard (AC: #5, #6)
- [ ] Register routes: POST `/finance/bank-reconciliations`, PATCH `/:id`, POST `/:id/complete`, POST `/:id/auto-match`, POST `/finance/bank-transactions/:id/match`, POST `/:id/unmatch` (AC: #1–#6)
- [ ] Write unit tests for auto-match thresholds, manual matching, and completion guard (AC: #2, #5, #6)

**FR/NFR:** FR16, FR17, FR18; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | BankReconciliation/Line models, auto-match thresholds, zero-difference rule |
| API Contracts | §2.7, §3.2 | POST `/finance/bank-reconciliations`, POST `/:id/auto-match` (AutoMatchResult schema), POST `/:id/complete` |
| Data Models | §3.2 | BankReconciliation (statementBalance, reconciledBalance, status), BankReconciliationLine (matchedJournalLineId, matchConfidence) |
| State Machines | §2.3 | BankReconciliation: IN_PROGRESS→COMPLETED (zero-difference guard) |
| Event Catalog | §1 | `bank_reconciliation.completed` (implicit from architecture) |
| Business Rules | §2 | BR-FIN-009 (zero-difference for completion), BR-FIN-010 (auto-match thresholds: >=95% auto, 60-94% review, <60% unmatched) |
| UX Design Spec | §T3 | T3 Header+Lines template for reconciliation workspace |
| Project Context | §11 | Every state change emits typed event |

---

## Story E14.S8: Budgets

**User Story:** As a finance manager, I want to create budgets with lines allocated by account and period, approve them, and track variance against actuals, so that the business can plan and monitor financial performance.

**Acceptance Criteria:**
1. GIVEN a finance manager WHEN they create a Budget with name, budgetType (REVENUE/EXPENSE/CAPITAL/FULL), and status DRAFT THEN the budget is persisted with companyId scoping.
2. GIVEN a DRAFT budget WHEN the manager adds BudgetLines via batch upsert (account + period + amount) THEN lines are created/updated with Decimal(19,4) amounts.
3. GIVEN a DRAFT budget with at least one BudgetLine WHEN the manager approves it THEN status transitions to APPROVED, approvedAt/approvedBy are set, and a `budget.approved` event is emitted.
4. GIVEN an APPROVED budget WHEN the manager locks it THEN status transitions to LOCKED and no further modifications to budget lines are permitted.
5. GIVEN an approved budget WHEN a user views the budget-vs-actual report THEN actuals are computed from posted JournalEntry lines for each account+period combination and variance (budget minus actual) is displayed.

**Key Tasks:**
- [ ] Create Prisma models for Budget and BudgetLine (AC: #1, #2)
  - [ ] Budget: id, name, budgetType BudgetType enum, status BudgetStatus enum, fiscalYear, approvedAt, approvedBy, companyId
  - [ ] BudgetLine: id, budgetId FK (cascade), accountCode FK, periodId FK, amount Decimal(19,4)
- [ ] Implement budget approval with at-least-one-line guard (AC: #3)
- [ ] Implement budget lock preventing further line modifications (AC: #4)
- [ ] Implement budget-vs-actual variance report endpoint (AC: #5)
- [ ] Register routes: CRUD `/finance/budgets`, POST `/:id/approve`, GET `/:id/lines`, POST `/:id/lines/batch`, GET `/finance/reports/budget-vs-actual` (AC: #1–#5)
- [ ] Write unit tests for approval guard, lock enforcement, and variance calculation (AC: #3, #4, #5)

**FR/NFR:** FR13; NFR38 (Decimal precision), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | Budget/BudgetLine models, approval workflow, variance reporting |
| API Contracts | §2.7 | CRUD `/finance/budgets`, POST `/:id/approve`, GET `/:id/lines`, POST `/:id/lines/batch`, GET `/finance/reports/budget-vs-actual` |
| Data Models | §3.2 | Budget (budgetType enum: REVENUE/EXPENSE/CAPITAL/FULL, status: DRAFT/APPROVED/LOCKED), BudgetLine (accountCode, periodId, amount) |
| State Machines | §2.5 | Budget: DRAFT→APPROVED (requires >=1 line)→LOCKED |
| Event Catalog | §1 | `budget.approved` (implicit from architecture) |
| Business Rules | §2 | BR-FIN-002 (Decimal 19,4 for amounts) |
| UX Design Spec | §T3, §T8 | T3 for budget entry form, T8 for budget-vs-actual report |
| Project Context | §11 | Every state change emits typed event |

---

## Story E14.S9: Finance Screens

**User Story:** As a finance user, I want standardised list views, detail views, entry forms, and report screens for all finance entities, so that I can efficiently navigate and manage financial data using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN a finance user WHEN they navigate to the Chart of Accounts section THEN a T1 Entity List displays accounts with columns for code, name, type, balance, and status, with search, filter by type/status, and saved views.
2. GIVEN a finance user WHEN they navigate to the Journals section THEN a T1 Entity List displays journal entries with columns for entry number, date, source, total, status, with filters for period, source, and status.
3. GIVEN a finance user WHEN they click a journal entry THEN a T3 Header+Lines form displays the header (date, description, period, source) and lines (account, debit, credit, description) with the ActionBar showing status-driven actions (Post for DRAFT, Reverse for POSTED).
4. GIVEN a finance user WHEN they navigate to Bank Accounts THEN a T1 list shows bank accounts with last reconciled date and balance; clicking through shows transactions.
5. GIVEN a finance user WHEN they navigate to Finance Settings THEN a T7 Settings screen shows sections for financial periods, account mappings, and bank account configuration.
6. GIVEN a finance user WHEN they run the Trial Balance report THEN a T8 Report screen shows account balances for a selected period range with debit/credit columns and totals.

**Key Tasks:**
- [ ] Build T1 Entity List for Chart of Accounts with hierarchy toggle (flat/tree view) (AC: #1)
- [ ] Build T1 Entity List for Journal Entries with period/source/status filters (AC: #2)
- [ ] Build T3 Header+Lines form for Journal Entry with balanced validation indicator (AC: #3)
  - [ ] Implement ActionBar with status-driven primary actions (Post, Reverse)
  - [ ] Implement line-item editor with account lookup, debit/credit fields
- [ ] Build T1 Entity List for Bank Accounts with balance and reconciliation status (AC: #4)
- [ ] Build T7 Settings screens for Finance module configuration (AC: #5)
- [ ] Build T8 Report screens for Trial Balance, P&L preview, Balance Sheet (AC: #6)
- [ ] Ensure all text uses translation keys via t() function (AC: #1–#6)
- [ ] Integrate Co-Pilot Dock with finance-contextual preset prompts (AC: #1–#6)

**FR/NFR:** FR11–FR18; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.13 | All finance entities and their relationships |
| API Contracts | §2.7 | All finance endpoints consumed by frontend |
| Data Models | §3.2 | All finance models for form field mapping |
| State Machines | §2.1–§2.5 | Status-driven ActionBar visibility rules for all finance entities |
| Event Catalog | N/A — frontend subscribes via WebSocket for real-time updates |
| Business Rules | §2 | All BR-FIN rules inform validation displays and error messages |
| UX Design Spec | §T1, §T2, §T3, §T7, §T8, §Action Bar | T1 for lists, T3 for journal entry, T7 for settings, T8 for reports, ActionBar rules |
| Project Context | §3 | All strings use translation keys via t() |

---

## Story E14.S10: Mobile Adaptation

**User Story:** As a business owner on mobile, I want read-only access to key financial data including journal list, bank balances, and budget variance, so that I can monitor financial health on the go.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they open the Finance section THEN they see a summary card showing total bank balance across all accounts and current period status.
2. GIVEN a mobile user WHEN they view the journal list THEN a read-only T1 list displays recent journal entries with entry number, date, total, and status, optimised for mobile viewport (375px+).
3. GIVEN a mobile user WHEN they tap a journal entry THEN a read-only detail view shows the header and lines without edit capability.
4. GIVEN a mobile user WHEN they view bank accounts THEN each account shows current balance and last reconciled date with touch-friendly 44x44px tap targets.
5. GIVEN a mobile user WHEN they view budget variance THEN a simplified T8 report shows budget vs actual by account with colour-coded variance indicators (green = under budget, red = over budget).

**Key Tasks:**
- [ ] Design mobile finance summary card component (AC: #1)
- [ ] Implement responsive T1 list for journals with column prioritisation for mobile (AC: #2)
- [ ] Implement read-only journal detail view for mobile (AC: #3)
- [ ] Implement bank account balance cards for mobile (AC: #4)
- [ ] Implement simplified budget variance view for mobile (AC: #5)
- [ ] Ensure 44x44px minimum touch targets and WCAG 2.1 AA compliance (AC: #4)

**FR/NFR:** FR11–FR18; NFR27 (WCAG 2.1 AA accessibility), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Frontend architecture, mobile scaffold (Expo/React Native) |
| API Contracts | §2.7 | Same finance endpoints, consumed by mobile client |
| Data Models | N/A — mobile consumes API responses, no direct model access |
| State Machines | N/A — mobile displays status badges only (read-only) |
| Event Catalog | N/A — mobile receives push notifications for finance events |
| Business Rules | N/A — business rules enforced server-side; mobile is read-only |
| UX Design Spec | §Responsive, §Breakpoint Behaviour Matrix | 375px+ breakpoint, 44x44px touch targets, column prioritisation |
| Project Context | §8 | Mobile as end-of-epic story, web screens drive design, mobile adapts |

---
