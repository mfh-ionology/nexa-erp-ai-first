# Epic E26c: Projects & Job Costing

> **Project management with budgets, phases, milestones, time entries, expenses, billing rate resolution, and WIP/revenue recognition.**

**Architecture:** §2.25 Projects
**Models:** 11 models — `Project`, `ProjectPhase`, `ProjectMilestone`, `TimeEntry`, `ProjectExpense`, `BillingRate`, `ProjectBudget`, `ProjectBudgetLine`, `ProjectCostEntry`, `WipCalculation`, `ProjectInvoice`
**State Machines:** SM:Project, SM:TimeEntry, SM:ProjectExpense
**Business Rules:** PRJ/TS/EXP/INV rules
**FRs:** FR123–FR129
**API:** §2.21 — ~23 endpoints under `/projects/*`

**Dependencies:** E14 (Finance/GL), E23 (HR for employees/billing rates)

---

## Story E26c.S1: Project Setup & Budgeting

**User Story:** As a project manager, I want to create projects with budgets, phases, and milestones so that I can plan and track project costs and timelines.

**Acceptance Criteria:**

```gherkin
Scenario: Create project with budget
  Given I am a MANAGER or higher
  When I create a project with name, customer, budget, phases, and milestones
  Then a Project record is created with budget lines per cost category (FR123)

Scenario: Phase and milestone tracking
  Given a project has 3 phases with milestones
  When I update milestone status to COMPLETED
  Then progress percentage is recalculated
```

**Key Tasks:**
1. Create Project, ProjectPhase, ProjectMilestone, ProjectBudget, ProjectBudgetLine models
2. Implement project CRUD with budget management
3. Build project detail UI — T2 with Gantt/timeline view
4. Write tests

**FR/NFR References:** FR123, FR126, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR123, FR126) | Project setup, budgets, milestones |
| Architecture | §2.25 Projects | Project models, budget design |
| UX Design Specification | T2 (Record Detail) | Project detail with timeline |
| API Contracts | §2.21 Projects | Project CRUD endpoints |
| Data Models | §15 Projects | Project, Budget schemas |
| State Machine Reference | §12 Projects | SM:Project lifecycle |
| Event Catalog | §11 Projects | project.created event |
| Business Rules Compendium | §10 Projects | PRJ budget rules |

---

## Story E26c.S2: Time Entries & Expense Tracking

**User Story:** As a team member, I want to record time entries and expenses against projects so that labour and costs are tracked for billing and reporting.

**Acceptance Criteria:**

```gherkin
Scenario: Record time entry
  Given I am assigned to project "Website Redesign"
  When I log 4 hours of billable time with description
  Then a TimeEntry record is created linked to the project and phase (FR124)

Scenario: Submit expense with receipt
  Given I incurred a GBP 50 travel expense for a project
  When I submit the expense with receipt attachment
  Then a ProjectExpense record is created pending approval (FR125)
```

**Key Tasks:**
1. Create TimeEntry and ProjectExpense models
2. Implement time and expense CRUD with approval workflows
3. Build timesheet and expense UIs
4. Write tests

**FR/NFR References:** FR124, FR125, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR124, FR125) | Time entries, expenses, approval |
| Architecture | §2.25 Projects | TimeEntry, ProjectExpense models |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Timesheet, expense form |
| API Contracts | §2.21 Projects | Time and expense endpoints |
| Data Models | §15 Projects | TimeEntry, ProjectExpense schemas |
| State Machine Reference | §12 Projects | SM:TimeEntry, SM:ProjectExpense lifecycles |
| Event Catalog | §11 Projects | time.entered, expense.submitted events |
| Business Rules Compendium | §10 Projects | TS/EXP rules |

---

## Story E26c.S3: Billing Rate Resolution & Project Invoicing

**User Story:** As a finance user, I want billing rates resolved using a priority hierarchy (project > customer > employee > default) and the ability to generate project invoices.

**Acceptance Criteria:**

```gherkin
Scenario: Billing rate resolution
  Given employee "Jane" has project rate GBP 150/hr and default rate GBP 100/hr
  When billing for project "Website Redesign"
  Then the project rate GBP 150/hr is used (FR127)

Scenario: Generate project invoice
  Given unbilled time and expenses exist
  When I generate an invoice for the project
  Then a draft invoice is created with time and expense line items
```

**Key Tasks:**
1. Create BillingRate model with priority hierarchy
2. Implement rate resolution service
3. Implement project invoicing — generate draft invoices from unbilled entries
4. Write tests

**FR/NFR References:** FR127, FR128, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR127, FR128) | Billing rate hierarchy, job cost posting |
| Architecture | §2.25 Projects | BillingRate model, invoicing design |
| UX Design Specification | T3 (Header+Lines) | Project invoice layout |
| API Contracts | §2.21 Projects | Billing rate and invoicing endpoints |
| Data Models | §15 Projects | BillingRate, ProjectInvoice schemas |
| State Machine Reference | §12 Projects | Invoice generation workflow |
| Event Catalog | §11 Projects | project.invoice.generated event |
| Business Rules Compendium | §10 Projects | INV billing rules |

---

## Story E26c.S4: WIP & Revenue Recognition

**User Story:** As a finance user, I want WIP calculations and revenue recognition for long-running projects so that revenue is correctly matched to the period in which work is performed.

**Acceptance Criteria:**

```gherkin
Scenario: Calculate WIP value
  Given project costs of GBP 50,000 and billed amount of GBP 30,000
  When WIP is calculated
  Then WIP value is GBP 20,000 (costs incurred less billed) (FR129)
```

**Key Tasks:**
1. Implement WIP calculation service — percentage of completion method
2. Implement revenue recognition posting
3. Build WIP report
4. Write tests

**FR/NFR References:** FR129, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR129) | WIP, revenue recognition |
| Architecture | §2.25 Projects | WIP calculation, revenue recognition |
| UX Design Specification | T8 (Report) | WIP report |
| API Contracts | §2.21 Projects | WIP and recognition endpoints |
| Data Models | §15 Projects | WipCalculation schema |
| State Machine Reference | §12 Projects | N/A |
| Event Catalog | §11 Projects | wip.calculated event |
| Business Rules Compendium | §10 Projects | PRJ WIP rules |

---

## Story E26c.S5: Budget vs Actual Reports

**User Story:** As a project manager, I want budget vs actual reports with variance analysis by phase and cost category.

**Key Tasks:**
1. Implement budget vs actual comparison endpoint
2. Build report with phase-level and category-level breakdown
3. Write tests

**FR/NFR References:** FR126, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects (FR126) | Budget vs actual |
| Architecture | §2.25 Projects | Report design |
| UX Design Specification | T8 (Report) | Budget report layout |
| API Contracts | §2.21 Projects | Report endpoints |
| Data Models | §15 Projects | Budget and cost models |
| State Machine Reference | §12 Projects | N/A |
| Event Catalog | §11 Projects | N/A |
| Business Rules Compendium | §10 Projects | Budget rules |

---

## Story E26c.S6: Mobile Adaptation — Projects

**User Story:** As a mobile user, I want to log time entries and submit expenses from my phone.

**Key Tasks:**
1. Create mobile timesheet entry form
2. Create mobile expense submission with camera for receipts
3. Write tests

**FR/NFR References:** FR124, FR125, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.15 Projects | Time and expense on mobile |
| Architecture | §2.25 Projects | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.21 Projects | Same endpoints |
| Data Models | §15 Projects | Same models |
| State Machine Reference | §12 Projects | Same state machines |
| Event Catalog | §11 Projects | Same events |
| Business Rules Compendium | §10 Projects | Same rules |

---
