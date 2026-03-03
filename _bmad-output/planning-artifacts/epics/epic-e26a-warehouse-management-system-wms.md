# Epic E26a: Warehouse Management System (WMS)

> **Advanced warehouse management with bin-level tracking, pick lists, goods receipt positioning, internal transfers, cycle counting, and packing/dispatch operations.**

**Architecture:** §2.27 Warehouse Management
**Models:** 9 models — `WarehousePosition`, `PickList`, `PickListLine`, `ReceivingOrder`, `InternalTransferOrder`, `CycleCount`, `CycleCountLine`, `PackingOrder`, `ShipmentTracking`
**State Machines:** SM:PickList, SM:InternalTransferOrder, SM:CycleCount
**Events:** `picklist.generated`, `picklist.completed`, `goods.received`, `transfer.completed`, `cyclecount.completed`, `dispatch.shipped`
**API:** §2.23 — ~17 endpoints under `/warehouse/*`
**Business Rules:** BR-WMS-001 to BR-WMS-012
**FRs:** FR135–FR140

**Dependencies:** E15 (Inventory), E16 (Sales Orders for pick list generation), E18 (Purchase Orders for goods receipt)

---

## Story E26a.S1: Warehouse Position Management

**User Story:** As a warehouse manager, I want to define warehouse positions and bin locations with capacity and zone classification so that stock can be tracked at bin level.

**Acceptance Criteria:**

```gherkin
Scenario: Create warehouse position
  Given I am a warehouse MANAGER
  When I create a position "A-01-03" (Aisle A, Rack 01, Shelf 03) in zone "Picking"
  Then a WarehousePosition record is created with zone, type, and capacity fields

Scenario: Position hierarchy
  Given positions are structured as Zone → Aisle → Rack → Shelf → Bin
  When I view the warehouse layout
  Then positions display in a hierarchical tree view

Scenario: Capacity tracking
  Given position "A-01-03" has max capacity of 100 units
  And currently holds 85 units
  When I attempt to receive 20 more units
  Then the system warns about capacity overflow
```

**Key Tasks:**
1. **Create WarehousePosition model** — companyId, code, name, warehouseId, zone, aisle, rack, shelf, bin, type, maxCapacity, currentOccupancy
2. **Implement position CRUD endpoints** — with hierarchy navigation
3. **Build position management UI** — T1 list with tree view, capacity indicators
4. **Write tests** — hierarchy queries, capacity validation

**FR/NFR References:** FR135, FR49, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR135) | Position and bin location management |
| Architecture | §2.27 Warehouse Management | WarehousePosition model |
| UX Design Specification | T1 (Entity List) | Position list with tree view |
| API Contracts | §2.23 Warehouse | Position CRUD endpoints |
| Data Models | §17 Warehouse | WarehousePosition schema |
| State Machine Reference | §14 Warehouse | N/A for positions |
| Event Catalog | §13 Warehouse | position.created event |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-001 to BR-WMS-003 (position rules) |

---

## Story E26a.S2: Pick List Generation & Processing

**User Story:** As a warehouse picker, I want pick lists generated from sales orders with optimised pick routes so that I can efficiently pick items for shipment.

**Acceptance Criteria:**

```gherkin
Scenario: Generate pick list from sales order
  Given a confirmed sales order has 5 line items with stock available
  When I generate a pick list
  Then a PickList record is created with PickListLines for each item
  And each line shows the source position and quantity to pick

Scenario: Complete picking
  Given a pick list is assigned to me
  When I pick all items and confirm quantities
  Then the pick list status changes to COMPLETED
  And stock is decremented from the source positions
```

**Key Tasks:**
1. **Create PickList model** — companyId, salesOrderId, status, assignedToId, generatedAt, completedAt
   - PickListLine: pickListId, itemId, sourcePositionId, requestedQty, pickedQty
2. **Implement pick list generation** — allocate stock from positions using FIFO/FEFO strategy
3. **Implement pick completion** — validate quantities, update stock levels
4. **Build pick list UI** — mobile-optimised list with scan-to-confirm
5. **Write tests** — allocation strategy, completion validation

**FR/NFR References:** FR136, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR136) | Pick list generation and management |
| Architecture | §2.27 Warehouse Management | PickList model, allocation strategy |
| UX Design Specification | T1 (Entity List) | Pick list interface |
| API Contracts | §2.23 Warehouse | Pick list endpoints |
| Data Models | §17 Warehouse | PickList, PickListLine schemas |
| State Machine Reference | §14 Warehouse | SM:PickList — GENERATED → ASSIGNED → IN_PROGRESS → COMPLETED |
| Event Catalog | §13 Warehouse | picklist.generated, picklist.completed events |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-004 to BR-WMS-006 (pick rules) |

---

## Story E26a.S3: Goods Receipt & Internal Transfers

**User Story:** As a warehouse worker, I want to receive goods into specific warehouse positions and create internal transfer orders to move stock between positions so that inventory location tracking is accurate.

**Acceptance Criteria:**

```gherkin
Scenario: Receive goods into position
  Given a purchase order delivery arrives
  When I receive items and assign them to position "B-02-01"
  Then stock is incremented at the specified position (FR137)
  And a goods receipt record is created with position reference

Scenario: Create internal transfer
  Given item "Widget A" has 50 units at position "A-01-03"
  When I create a transfer order to move 20 units to "C-03-02"
  Then an InternalTransferOrder is created with status PENDING
  And on completion, stock moves between positions (FR138)
```

**Key Tasks:**
1. **Implement goods receipt with positioning** — assign received items to warehouse positions
2. **Create InternalTransferOrder model** — from/to positions, item, quantity, status
3. **Implement transfer completion** — validate stock at source, move to destination
4. **Build receipt and transfer UIs** — forms with position selection, barcode scanning
5. **Write tests** — stock movement accuracy, position validation

**FR/NFR References:** FR137, FR138, FR43, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR137, FR138) | Goods receipt positioning, internal transfers |
| Architecture | §2.27 Warehouse Management | Receipt and transfer models |
| UX Design Specification | T2 (Record Detail) | Receipt and transfer forms |
| API Contracts | §2.23 Warehouse | Receipt and transfer endpoints |
| Data Models | §17 Warehouse | ReceivingOrder, InternalTransferOrder |
| State Machine Reference | §14 Warehouse | SM:InternalTransferOrder lifecycle |
| Event Catalog | §13 Warehouse | goods.received, transfer.completed events |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-007 to BR-WMS-009 |

---

## Story E26a.S4: Cycle Counting & Packing/Dispatch

**User Story:** As a warehouse manager, I want to perform cycle counts by position with variance reporting and manage packing/dispatch operations with shipment tracking so that inventory accuracy and order fulfilment are maintained.

**Acceptance Criteria:**

```gherkin
Scenario: Cycle count by position
  Given positions in Zone "Picking" are selected for counting
  When I record actual quantities per position
  Then variances between system and actual counts are calculated (FR139)
  And adjustments are posted with audit trail

Scenario: Packing and dispatch
  Given a pick list is completed
  When I pack items and record carrier/tracking details
  Then a PackingOrder is created with shipment tracking number (FR140)
  And the sales order status is updated to SHIPPED
```

**Key Tasks:**
1. **Create CycleCount model** — positions, expected vs actual quantities, variance, adjustment posting
2. **Create PackingOrder model** — pick list reference, carrier, tracking number, dispatch date
3. **Implement cycle count workflow** — count, variance, adjustment, GL posting
4. **Implement packing/dispatch** — pack, assign carrier, track shipment
5. **Build cycle count and dispatch UIs**
6. **Write tests** — variance calculation, adjustment posting

**FR/NFR References:** FR139, FR140, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR139, FR140) | Cycle counting, packing, dispatch |
| Architecture | §2.27 Warehouse Management | CycleCount, PackingOrder models |
| UX Design Specification | T6 (Wizard) | Cycle count wizard, dispatch workflow |
| API Contracts | §2.23 Warehouse | Cycle count and dispatch endpoints |
| Data Models | §17 Warehouse | CycleCount, PackingOrder schemas |
| State Machine Reference | §14 Warehouse | SM:CycleCount lifecycle |
| Event Catalog | §13 Warehouse | cyclecount.completed, dispatch.shipped events |
| Business Rules Compendium | §13 Additional (BR-WMS) | BR-WMS-010 to BR-WMS-012 |

---

## Story E26a.S5: Mobile Adaptation — Warehouse

**User Story:** As a warehouse worker, I want to perform all warehouse operations (pick, receive, count, pack) from a mobile device with barcode scanning so that I can work efficiently on the warehouse floor.

**Acceptance Criteria:**

```gherkin
Scenario: Mobile picking with barcode scan
  Given I have a pick list assigned on mobile
  When I scan item barcodes and position barcodes
  Then picked quantities are confirmed and stock updated in real-time

Scenario: Mobile goods receipt
  Given a delivery arrives
  When I scan items and assign to positions on mobile
  Then receipt is recorded with position-level accuracy

Scenario: Mobile cycle counting
  Given a count list is assigned to me
  When I scan positions and enter counts on mobile
  Then variances are calculated and displayed immediately
```

**Key Tasks:**
1. **Create mobile picking interface** — scan-to-pick workflow
2. **Create mobile receipt interface** — scan and assign positions
3. **Create mobile counting interface** — position scan and count entry
4. **Implement offline capability** — queue operations for sync
5. **Write tests** — mobile workflow validation

**FR/NFR References:** FR136, FR137, FR139, FR154, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.13 Warehouse (FR136-FR140, FR154) | Warehouse operations, barcode scanning |
| Architecture | §2.27 Warehouse Management | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile warehouse patterns |
| API Contracts | §2.23 Warehouse | Same endpoints for mobile |
| Data Models | §17 Warehouse | Same models |
| State Machine Reference | §14 Warehouse | Same state machines |
| Event Catalog | §13 Warehouse | Same events |
| Business Rules Compendium | §13 Additional (BR-WMS) | Same rules |

---
