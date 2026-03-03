# Epic E26e: Service Orders

> **Service order management for field service with technician assignment, scheduling, service item tracking, and invoice generation from completed service work.**

**Architecture:** §2.30 Service Orders
**Models:** 11 models
**State Machines:** SM:ServiceOrder, SM:ServiceVisit, SM:ServiceItem
**Business Rules:** BR-SVO/BR-TK rules
**FRs:** FR149–FR152
**API:** §2.26 — ~21 endpoints under `/service/*`

---

## Story E26e.S1: Service Order Management

**User Story:** As a service coordinator, I want to create and manage service orders with assignment to service personnel and status tracking.

**Acceptance Criteria:**

```gherkin
Scenario: Create service order
  Given a customer reports equipment issue
  When I create a service order with description, priority, and assigned technician
  Then a ServiceOrder record is created with status OPEN (FR149)

Scenario: Complete service order
  Given a technician has completed the work
  When I mark the service order as completed with work details
  Then the status changes to COMPLETED with completion notes
```

**Key Tasks:**
1. Create ServiceOrder, ServiceOrderLine, ServiceAssignment models
2. Implement service order CRUD with assignment
3. Build service order UI — T1 list, T2 detail
4. Write tests

**FR/NFR References:** FR149, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR149) | Service order lifecycle |
| Architecture | §2.30 Service Orders | ServiceOrder models |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Service order layouts |
| API Contracts | §2.26 Service Orders | Service order CRUD endpoints |
| Data Models | §19 Service Orders | ServiceOrder schemas |
| State Machine Reference | §18 Service Orders | SM:ServiceOrder — OPEN → ASSIGNED → IN_PROGRESS → COMPLETED |
| Event Catalog | §17 Service Orders | service.order.created, service.order.completed events |
| Business Rules Compendium | §13 Additional (BR-SVO) | Service order rules |

---

## Story E26e.S2: Service Item Tracking & History

**User Story:** As a service manager, I want to track service items (equipment) with service history and warranty information.

**Acceptance Criteria:**

```gherkin
Scenario: Register service item
  Given a customer has equipment under service contract
  When I register the item with serial number, warranty dates, and contract reference
  Then a ServiceItem record tracks the equipment (FR150)

Scenario: View service history
  Given a service item has had 5 service visits
  When I view the item's history
  Then all visits are listed with dates, issues, and resolutions
```

**Key Tasks:**
1. Create ServiceItem model with warranty tracking
2. Implement service item CRUD with history view
3. Write tests

**FR/NFR References:** FR150, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR150) | Service item tracking, warranty |
| Architecture | §2.30 Service Orders | ServiceItem model |
| UX Design Specification | T2 (Record Detail) | Service item detail with history |
| API Contracts | §2.26 Service Orders | Service item endpoints |
| Data Models | §19 Service Orders | ServiceItem schema |
| State Machine Reference | §18 Service Orders | SM:ServiceItem lifecycle |
| Event Catalog | §17 Service Orders | service.item.registered event |
| Business Rules Compendium | §13 Additional (BR-TK) | Service item rules |

---

## Story E26e.S3: Field Service Scheduling

**User Story:** As a dispatcher, I want to schedule field service visits with calendar integration and technician availability checking.

**Acceptance Criteria:**

```gherkin
Scenario: Schedule service visit
  Given a service order requires on-site visit
  When I schedule a visit checking technician availability
  Then a ServiceVisit record is created with date, time, and technician (FR151)
```

**Key Tasks:**
1. Create ServiceVisit model with scheduling
2. Implement availability checking against technician calendars
3. Build scheduling calendar UI
4. Write tests

**FR/NFR References:** FR151, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR151) | Field service scheduling |
| Architecture | §2.30 Service Orders | Scheduling design |
| UX Design Specification | T5 (Board/Kanban) | Scheduling board/calendar |
| API Contracts | §2.26 Service Orders | Scheduling endpoints |
| Data Models | §19 Service Orders | ServiceVisit schema |
| State Machine Reference | §18 Service Orders | SM:ServiceVisit lifecycle |
| Event Catalog | §17 Service Orders | service.visit.scheduled event |
| Business Rules Compendium | §13 Additional (BR-SVO) | Scheduling rules |

---

## Story E26e.S4: Service Order to Invoice Conversion

**User Story:** As a service administrator, I want to convert completed service orders to invoices with automatic line item generation from service activities and parts used.

**Acceptance Criteria:**

```gherkin
Scenario: Generate invoice from service order
  Given a service order is completed with labour (3 hours) and parts (2 items)
  When I generate an invoice
  Then a draft invoice is created with labour and parts line items (FR152)
```

**Key Tasks:**
1. Implement service-to-invoice conversion
2. Generate line items from service activities and parts
3. Write tests

**FR/NFR References:** FR152, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders (FR152) | Service to invoice conversion |
| Architecture | §2.30 Service Orders | Invoice generation from service |
| UX Design Specification | T3 (Header+Lines) | Generated invoice layout |
| API Contracts | §2.26 Service Orders | Invoice conversion endpoint |
| Data Models | §19 Service Orders, §5 AR | Service-to-invoice mapping |
| State Machine Reference | §18 Service Orders | Conversion as side effect of completion |
| Event Catalog | §17 Service Orders | service.invoice.generated event |
| Business Rules Compendium | §13 Additional (BR-SVO) | Conversion rules |

---

## Story E26e.S5: Mobile Adaptation — Service Orders

**User Story:** As a field technician, I want to view assigned service orders, update status, log work details, and capture signatures from my mobile device.

**Key Tasks:**
1. Create mobile service order list (assigned to me)
2. Implement mobile work logging and status updates
3. Implement signature capture
4. Write tests

**FR/NFR References:** FR149, FR151, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.17 Service Orders | Mobile field service |
| Architecture | §2.30 Service Orders | Mobile adaptation |
| UX Design Specification | Mobile strategy section | Mobile patterns |
| API Contracts | §2.26 Service Orders | Same endpoints |
| Data Models | §19 Service Orders | Same models |
| State Machine Reference | §18 Service Orders | Same state machines |
| Event Catalog | §17 Service Orders | Same events |
| Business Rules Compendium | §13 Additional | Same rules |

---
