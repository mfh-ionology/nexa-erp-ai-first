# Epic E26d: Contracts (Rental, Lease, Service)

> **Contract management for rental, lease, and service agreements with recurring invoice generation, renewal/termination workflows, and loan repayment schedules.**

**Architecture:** §2.26 Contracts
**Models:** 13 models
**State Machines:** SM:Contract, SM:ContractRenewal, SM:LoanAgreement
**Business Rules:** BR-CON-001 to BR-CON-022
**FRs:** FR130–FR134
**API:** §2.22 — ~25 endpoints under `/contracts/*`

---

## Story E26d.S1: Contract Lifecycle Management

**User Story:** As a contracts administrator, I want to create and manage contracts with terms, conditions, and lifecycle workflows (draft, active, renewal, termination) so that agreements are tracked through their full duration.

**Acceptance Criteria:**

```gherkin
Scenario: Create a rental contract
  Given a customer wants a 12-month equipment rental
  When I create a contract with start date, end date, terms, and billing schedule
  Then a Contract record is created with status DRAFT (FR130)

Scenario: Activate contract
  Given a contract is approved
  When I activate it
  Then the status changes to ACTIVE and billing schedule becomes effective

Scenario: Contract renewal workflow
  Given a contract is 30 days from expiry
  When the renewal notification triggers
  Then the contract manager is notified to initiate renewal (FR132)
```

**Key Tasks:**
1. Create Contract, ContractLine, ContractTerm, BillingSchedule models
2. Implement contract lifecycle endpoints
3. Build contract detail UI — T2 with timeline
4. Write tests

**FR/NFR References:** FR130, FR132, FR134, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts (FR130, FR132, FR134) | Contract lifecycle, renewal, pricing |
| Architecture | §2.26 Contracts | Contract models, lifecycle |
| UX Design Specification | T2 (Record Detail) | Contract detail layout |
| API Contracts | §2.22 Contracts | Contract CRUD endpoints |
| Data Models | §16 Contracts | Contract schemas |
| State Machine Reference | §13 Contracts | SM:Contract — DRAFT → ACTIVE → RENEWED / TERMINATED |
| Event Catalog | §12 Contracts | contract.activated, contract.expiring events |
| Business Rules Compendium | §11 Contracts | BR-CON-001 to BR-CON-010 |

---

## Story E26d.S2: Recurring Invoice Generation

**User Story:** As a billing administrator, I want the system to automatically generate recurring invoices from active contracts based on billing schedules.

**Acceptance Criteria:**

```gherkin
Scenario: Generate monthly recurring invoice
  Given a contract has monthly billing of GBP 500
  When the billing run executes for March 2026
  Then a draft invoice for GBP 500 is created linked to the contract (FR131)
```

**Key Tasks:**
1. Implement billing schedule engine — generate invoices per schedule
2. Implement billing run job (BullMQ)
3. Write tests

**FR/NFR References:** FR131, NFR5

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts (FR131) | Recurring invoice generation |
| Architecture | §2.26 Contracts | Billing engine design |
| UX Design Specification | T6 (Wizard) | Billing run wizard |
| API Contracts | §2.22 Contracts | Billing run endpoints |
| Data Models | §16 Contracts | BillingSchedule, invoice link |
| State Machine Reference | §13 Contracts | Billing as side effect of active contracts |
| Event Catalog | §12 Contracts | contract.invoice.generated event |
| Business Rules Compendium | §11 Contracts | BR-CON-011 to BR-CON-015 (billing rules) |

---

## Story E26d.S3: Loan Agreements & Repayment Schedules

**User Story:** As a finance user, I want to manage loan agreements with repayment schedule calculations supporting annuity, linear, and bullet methods.

**Acceptance Criteria:**

```gherkin
Scenario: Create loan with annuity repayment
  Given a loan of GBP 100,000 at 5% for 5 years
  When I create the loan agreement
  Then the system calculates the annuity repayment schedule with monthly amounts (FR133)
```

**Key Tasks:**
1. Create LoanAgreement and RepaymentSchedule models
2. Implement repayment calculation — annuity, linear, bullet methods
3. Build loan management UI
4. Write tests

**FR/NFR References:** FR133, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts (FR133) | Loan agreements, repayment methods |
| Architecture | §2.26 Contracts | Loan calculation engine |
| UX Design Specification | T2 (Record Detail) | Loan detail with schedule |
| API Contracts | §2.22 Contracts | Loan management endpoints |
| Data Models | §16 Contracts | LoanAgreement, RepaymentSchedule |
| State Machine Reference | §13 Contracts | SM:LoanAgreement lifecycle |
| Event Catalog | §12 Contracts | loan.repayment.due event |
| Business Rules Compendium | §11 Contracts | BR-CON-016 to BR-CON-022 (loan rules) |

---

## Story E26d.S4: Mobile Adaptation — Contracts

**User Story:** As a mobile user, I want to view my contracts, their status, and upcoming renewals from my phone.

**Key Tasks:**
1. Create mobile contract list and detail views
2. Implement renewal notification push
3. Write tests

**FR/NFR References:** FR130, FR132, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.16 Contracts | Mobile contract access |
| Architecture | §2.26 Contracts | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.22 Contracts | Same endpoints |
| Data Models | §16 Contracts | Same models |
| State Machine Reference | §13 Contracts | Same state machines |
| Event Catalog | §12 Contracts | Push notification triggers |
| Business Rules Compendium | §11 Contracts | Same rules |

---
