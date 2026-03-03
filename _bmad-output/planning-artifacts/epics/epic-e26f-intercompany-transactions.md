# Epic E26f: Intercompany Transactions

> **Automatic intercompany transaction routing (PO in one company creates SO in counterpart), elimination journals, consolidated reporting, and currency translation for foreign subsidiaries.**

**Architecture:** §2.28 Intercompany
**Models:** 11 models
**State Machines:** SM:IntercompanyTransaction
**Business Rules:** BR-1 to BR-15 (intercompany)
**FRs:** FR141–FR144

---

## Story E26f.S1: Intercompany Transaction Routing

**User Story:** As a multi-company user, I want a purchase order in one company to automatically create a corresponding sales order in the counterpart company so that intercompany transactions are seamlessly linked.

**Acceptance Criteria:**

```gherkin
Scenario: PO creates counterpart SO
  Given Company A has an intercompany relationship with Company B
  When Company A creates a PO to Company B
  Then a corresponding draft SO is automatically created in Company B (FR141)
  And both documents are linked via IntercompanyTransaction record
```

**Key Tasks:**
1. Create IntercompanyRelationship and IntercompanyTransaction models
2. Implement automatic SO creation on intercompany PO
3. Build intercompany configuration UI
4. Write tests

**FR/NFR References:** FR141, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany (FR141) | Automatic transaction routing |
| Architecture | §2.28 Intercompany | Routing design, IntercompanyTransaction model |
| UX Design Specification | T7 (Settings) | Intercompany relationship configuration |
| API Contracts | §2.25 Intercompany | Transaction routing endpoints |
| Data Models | §18 Intercompany | IntercompanyRelationship, IntercompanyTransaction |
| State Machine Reference | §16 Intercompany | SM:IntercompanyTransaction lifecycle |
| Event Catalog | §15 Intercompany | intercompany.transaction.created event |
| Business Rules Compendium | §13 Additional (BR-1 to BR-5) | Routing rules |

---

## Story E26f.S2: Elimination Journals

**User Story:** As a finance user, I want the system to generate intercompany elimination journal entries for consolidated financial reporting.

**Acceptance Criteria:**

```gherkin
Scenario: Generate elimination entries
  Given Company A sold GBP 10,000 to Company B in the period
  When elimination journals are generated
  Then matching revenue and cost entries are eliminated (FR142)
```

**Key Tasks:**
1. Implement elimination journal generation engine
2. Build elimination run wizard — T6
3. Write tests

**FR/NFR References:** FR142, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany (FR142) | Elimination journals |
| Architecture | §2.28 Intercompany | Elimination engine design |
| UX Design Specification | T6 (Wizard) | Elimination run wizard |
| API Contracts | §2.25 Intercompany | Elimination endpoints |
| Data Models | §18 Intercompany | EliminationJournal model |
| State Machine Reference | §16 Intercompany | N/A |
| Event Catalog | §15 Intercompany | elimination.completed event |
| Business Rules Compendium | §13 Additional (BR-6 to BR-10) | Elimination rules |

---

## Story E26f.S3: Consolidated Reporting & Currency Translation

**User Story:** As a group finance director, I want consolidated financial reports across multiple companies with currency translation for foreign subsidiaries.

**Acceptance Criteria:**

```gherkin
Scenario: Consolidated P&L
  Given Company A (GBP) and Company B (EUR) have financial data
  When I generate consolidated P&L
  Then both companies' results are translated and combined (FR143, FR144)
  And intercompany transactions are eliminated
```

**Key Tasks:**
1. Implement consolidated report queries — combine across companies
2. Implement currency translation — closing rate and average rate methods (FR144)
3. Build consolidated report UI — T8 (Report)
4. Write tests

**FR/NFR References:** FR143, FR144, NFR3, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany (FR143, FR144) | Consolidated reports, currency translation |
| Architecture | §2.28 Intercompany | Consolidation engine, FX translation |
| UX Design Specification | T8 (Report) | Consolidated report layout |
| API Contracts | §2.25 Intercompany | Consolidation endpoints |
| Data Models | §18 Intercompany | Consolidation models |
| State Machine Reference | §16 Intercompany | N/A |
| Event Catalog | §15 Intercompany | consolidation.completed event |
| Business Rules Compendium | §13 Additional (BR-11 to BR-15) | Translation rules |

---

## Story E26f.S4: Mobile Adaptation — Intercompany

**User Story:** As a mobile user, I want to view intercompany transaction status and consolidated KPIs on my phone.

**Key Tasks:**
1. Create mobile intercompany transaction list
2. Create mobile consolidated KPI cards
3. Write tests

**FR/NFR References:** FR141, FR143, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.18 Intercompany | Mobile access |
| Architecture | §2.28 Intercompany | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.25 Intercompany | Same endpoints |
| Data Models | §18 Intercompany | Same models |
| State Machine Reference | §16 Intercompany | Same state machines |
| Event Catalog | §15 Intercompany | Same events |
| Business Rules Compendium | §13 Additional | Same rules |

---
