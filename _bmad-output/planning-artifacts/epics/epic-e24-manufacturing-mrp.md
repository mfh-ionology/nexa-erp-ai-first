# Epic E24: Manufacturing / MRP

> **Manufacturing module with Bills of Materials (BOM), production orders, operations, shift management, MRP planning, and quality inspection.** Supports multi-level BOMs, work-in-progress accounting, and capacity planning with machine/work centre management.

**Architecture:** §2.23 Manufacturing/MRP
**Models:** 23 models — `BillOfMaterial`, `BomLine`, `ProductionOrder`, `Production`, `ProductionOperation`, `ProductionOperationWorker`, `ProductionMaterialConsumption`, `ProductionFinishedGood`, `ProductionPlan`, `MrpSuggestion`, `RoutingTemplate`, `RoutingStep`, `WorkCentre`, `Machine`, `MachineAvailability`, `ShiftSchedule`, `ShiftAssignment`, `QualityInspection`, `QualityDefect`, `ProductionCostEntry`, plus reference models
**State Machines:** SM:ProductionOrder, SM:Production, SM:ProductionOperation, SM:ProductionPlan
**Events:** `production.order.created`, `production.started`, `production.finished`, `production.discarded`, `mrp.suggestions.generated`
**API:** §2.17 — ~41 endpoints under `/production/*`
**Business Rules:** BR-PRD-001 to BR-PRD-015
**FRs:** FR68–FR73, FR109–FR115
**UX Templates:** T1 (Entity List), T2 (Record Detail), T3 (Header+Lines), T5 (Board/Kanban), T6 (Wizard)

**Dependencies:** E15 (Inventory for stock levels and material consumption), E14 (Finance/GL for WIP accounting), E16 (Sales Orders for demand-driven production)

---

## Story E24.S1: Bills of Materials (BOM)

**User Story:** As a production manager, I want to create and manage Bills of Materials with multi-level component structures so that I can define how products are manufactured from raw materials and sub-assemblies.

**Acceptance Criteria:**

```gherkin
Scenario: Create a single-level BOM
  Given item "Widget A" exists in inventory
  When I create a BOM for "Widget A" with 3 component lines (raw materials)
  Then a BillOfMaterial record is created with 3 BomLine records
  And each line specifies component item, quantity, unit of measure, and scrap percentage

Scenario: Create a multi-level BOM
  Given "Sub-Assembly B" has its own BOM with 2 components
  When I create a BOM for "Widget A" that includes "Sub-Assembly B" as a component
  Then the BOM hierarchy shows Widget A → Sub-Assembly B → raw materials
  And the indented BOM report shows all levels

Scenario: BOM explosion
  Given a BOM for "Widget A" includes "Sub-Assembly B" (qty 2) which includes "Part C" (qty 3 each)
  When I view the exploded BOM
  Then "Part C" shows total quantity of 6 (2 sub-assemblies * 3 parts each)

Scenario: BOM with scrap factor
  Given a BOM line for "Part C" has quantity 10 and scrap factor 5%
  When material requirements are calculated
  Then the required quantity is 10.5 (10 * 1.05)

Scenario: BOM version control
  Given a BOM version 1 exists for "Widget A"
  When I create version 2 with modified quantities
  Then both versions are retained
  And production orders reference the specific BOM version used

Scenario: Recipe/BOM explosion on sales documents
  Given a sales quote includes a BOM item "Widget A"
  When the user triggers recipe explosion
  Then component line items are generated on the quote (FR109)
```

**Key Tasks:**
1. **Create BOM models** — BillOfMaterial: companyId, itemId, version, description, quantity (batch size), isActive
   - BomLine: bomId, lineNumber, componentItemId, quantity, unitOfMeasure, scrapPercentage, isCritical
2. **Implement BOM CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/production/boms`
   - Nested line management; version creation
   - BOM explosion endpoint: `GET /api/v1/production/boms/:id/explode`
3. **Implement multi-level BOM explosion** — recursive traversal with quantity multiplication and scrap factor
   - Detect circular references (BR-PRD-001)
4. **Implement recipe explosion for sales docs** — explode BOM on quote/SO/invoice line items (FR109)
5. **Build BOM detail UI** — T3 (Header+Lines) with indented component tree view
6. **Build BOM list UI** — T1 with item name, version, component count
7. **Write unit tests** — explosion calculation, scrap factor, circular reference detection
8. **Write integration tests** — BOM creation, multi-level explosion, recipe explosion on sales doc

**FR/NFR References:** FR68, FR109, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR68, FR109) | BOM management, multi-level structures, recipe explosion |
| Architecture | §2.23 Manufacturing/MRP | BillOfMaterial, BomLine models, explosion algorithm |
| UX Design Specification | T3 (Header+Lines), T1 (Entity List) | BOM detail with tree view, BOM list |
| API Contracts | §2.17 Manufacturing | BOM CRUD, explosion endpoints |
| Data Models | §13 Production | BillOfMaterial, BomLine schemas |
| State Machine Reference | §10 Manufacturing | N/A — BOMs are reference data |
| Event Catalog | §9 Manufacturing | bom.created, bom.updated events |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-001 (circular reference), BR-PRD-002 (scrap) |

---

## Story E24.S2: Production Orders & Operations

**User Story:** As a production manager, I want to create production orders (work orders) with material requirements and routing operations so that I can plan and track manufacturing activities.

**Acceptance Criteria:**

```gherkin
Scenario: Create production order from BOM
  Given a BOM exists for "Widget A"
  When I create a production order for 100 units of "Widget A"
  Then a ProductionOrder record is created with status PLANNED
  And material requirements are calculated from the BOM (quantity * 100 + scrap)
  And a "production.order.created" event is emitted

Scenario: Production order from sales order
  Given a confirmed sales order includes 50 units of "Widget A"
  When I create a production order from the sales order line
  Then the production order is linked to the sales order
  And the quantity is set to 50

Scenario: Define routing operations
  Given a production order exists
  When I add routing operations (Cut, Assemble, Paint, QC) with estimated hours and work centres
  Then ProductionOperation records are created in sequence
  And each operation has estimated setup time and run time

Scenario: Material availability check
  Given a production order requires 100 units of "Part C"
  And only 60 units are in stock
  When I check material availability
  Then a shortage of 40 units is flagged (FR73)
  And the shortage is displayed with suggested resolution (order from supplier)

Scenario: Confirm production order
  Given a production order is PLANNED and materials are available
  When I confirm the order
  Then the status changes to CONFIRMED
  And materials are reserved in inventory
```

**Key Tasks:**
1. **Create production order models** — ProductionOrder: companyId, orderNumber (NumberSeries), bomId, itemId, quantity, status enum, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, salesOrderLineId (optional), priority
   - ProductionOperation: productionOrderId, operationNumber, workCentreId, machineId, setupTimeMinutes, runTimeMinutes, status, actualStart, actualEnd
2. **Implement production order endpoints** — `GET/POST/PUT/DELETE /api/v1/production/orders`
   - Create from BOM with material calculation
   - Create from sales order line
   - Confirm endpoint with material reservation
3. **Implement material availability check** — compare BOM requirements against current stock levels
   - Report shortages with resolution suggestions
4. **Implement routing template application** — apply RoutingTemplate to production order creating operations
5. **Build production order UI** — T3 (Header+Lines) with operations and materials tabs
6. **Build production order list** — T1 with status, item, quantity, planned dates
7. **Write unit tests** — material calculation, availability check, shortage reporting
8. **Write integration tests** — full production order creation and confirmation

**FR/NFR References:** FR69, FR70, FR73, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR69, FR70, FR73) | Work orders, material requirements, availability check |
| Architecture | §2.23 Manufacturing/MRP | ProductionOrder, ProductionOperation models |
| UX Design Specification | T3 (Header+Lines), T1 (Entity List) | Production order layout |
| API Contracts | §2.17 Manufacturing | Production order CRUD, confirm, availability endpoints |
| Data Models | §13 Production | ProductionOrder, ProductionOperation schemas |
| State Machine Reference | §10 Manufacturing | SM:ProductionOrder — PLANNED → CONFIRMED → IN_PROGRESS → COMPLETED |
| Event Catalog | §9 Manufacturing | production.order.created event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-003 to BR-PRD-006 (production order rules) |

---

## Story E24.S3: Production Execution & Material Consumption

**User Story:** As a production worker/supervisor, I want to record production start/finish, material consumption, and finished goods receipt so that actual production progress is tracked against plans.

**Acceptance Criteria:**

```gherkin
Scenario: Start production
  Given a production order is CONFIRMED
  When I start production
  Then the status changes to IN_PROGRESS
  And a "production.started" event is emitted
  And the actual start date is recorded

Scenario: Record material consumption
  Given production is in progress
  When I record consumption of 95 units of "Part C" (planned 100)
  Then a ProductionMaterialConsumption record is created
  And inventory stock level is decremented by 95 (FR71)

Scenario: Record finished goods
  Given production is in progress for 100 units
  When I record 98 finished goods received into warehouse
  Then a ProductionFinishedGood record is created
  And inventory stock level is incremented by 98 (FR72)
  And the yield is calculated as 98%

Scenario: Complete production
  Given all operations are finished and goods are received
  When I complete the production order
  Then the status changes to COMPLETED
  And a "production.finished" event is emitted
  And variance analysis is available (planned vs actual materials, time)

Scenario: Discard production order
  Given a production order encounters issues
  When I discard it with reason
  Then the status changes to DISCARDED
  And a "production.discarded" event is emitted
  And any reserved materials are released
```

**Key Tasks:**
1. **Create execution models** — ProductionMaterialConsumption: productionOrderId, itemId, quantity, warehouseLocationId, consumedDate, consumedById
   - ProductionFinishedGood: productionOrderId, itemId, quantity, warehouseLocationId, receivedDate, receivedById
2. **Implement execution endpoints** — `POST /api/v1/production/orders/:id/start`, `/complete`, `/discard`
   - Material consumption: `POST /api/v1/production/orders/:id/consume`
   - Finished goods: `POST /api/v1/production/orders/:id/receive`
3. **Implement inventory integration** — decrement stock on consumption, increment on receipt
   - Create StockMovement records for audit trail
4. **Implement variance analysis** — compare planned vs actual for materials, time, and output
5. **Build production execution UI** — T2 with status controls, consumption form, receipt form
6. **Build production board** — T5 (Board/Kanban) showing orders by status
7. **Write unit tests** — stock movements, variance calculation, status transitions
8. **Write integration tests** — full production execution cycle with inventory changes

**FR/NFR References:** FR71, FR72, FR48, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR71, FR72) | Material consumption, finished goods receipt |
| Architecture | §2.23 Manufacturing/MRP | Execution models, inventory integration |
| UX Design Specification | T2 (Record Detail), T5 (Board/Kanban) | Execution controls, production board |
| API Contracts | §2.17 Manufacturing | Start, complete, consume, receive endpoints |
| Data Models | §13 Production | ProductionMaterialConsumption, ProductionFinishedGood |
| State Machine Reference | §10 Manufacturing | SM:Production — IN_PROGRESS → COMPLETED / DISCARDED |
| Event Catalog | §9 Manufacturing | production.started, production.finished, production.discarded |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-007 to BR-PRD-009 (execution rules) |

---

## Story E24.S4: Shift Management & Time Registration

**User Story:** As a production manager, I want to define shift schedules, assign workers to shifts, and register time worked per production operation so that labour costs and productivity are tracked accurately.

**Acceptance Criteria:**

```gherkin
Scenario: Define shift schedule
  Given I am a production MANAGER
  When I create a shift schedule "Morning" (06:00-14:00) and "Afternoon" (14:00-22:00)
  Then ShiftSchedule records are created for the company

Scenario: Assign workers to shifts
  Given shift schedules exist
  When I assign employee "John" to "Morning" shift for the week of 10 March
  Then a ShiftAssignment record is created
  And John's schedule shows the assignment

Scenario: Register time on production operation
  Given a production operation is in progress
  When worker "John" registers 4 hours worked on operation "Assembly"
  Then a ProductionOperationWorker record is created with start/stop times
  And the operation's actual time is updated (FR111)

Scenario: Multiple workers on one operation
  Given operation "Assembly" requires 3 workers
  When John registers 4h, Jane registers 3.5h, and Bob registers 4h
  Then all three time entries are recorded
  And total labour hours for the operation is 11.5 hours

Scenario: Time registration posts labour cost
  Given worker time is registered at GBP 15/hour
  When the operation completes
  Then labour cost of GBP 172.50 (11.5h * 15) is calculated
  And a ProductionCostEntry is created for GL posting (FR112)
```

**Key Tasks:**
1. **Create shift models** — ShiftSchedule: companyId, name, startTime, endTime, breakMinutes
   - ShiftAssignment: shiftScheduleId, employeeId, date, status
2. **Create time registration model** — ProductionOperationWorker: operationId, employeeId, startTime, endTime, durationMinutes
3. **Implement shift management endpoints** — CRUD for schedules and assignments
4. **Implement time registration endpoints** — `POST /api/v1/production/operations/:id/time`
   - Start/stop tracking or manual entry
5. **Implement labour cost calculation** — hours * rate per worker; aggregate per operation and order
6. **Build shift management UI** — T7 (Settings) for schedule config, calendar view for assignments
7. **Build time registration UI** — clock-in/clock-out buttons or manual time entry form
8. **Write unit tests** — labour cost calculation, shift overlap detection
9. **Write integration tests** — time registration → cost calculation → GL posting flow

**FR/NFR References:** FR110, FR111, FR112, NFR2, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR110, FR111, FR112) | Shifts, time registration, cost posting |
| Architecture | §2.23 Manufacturing/MRP | ShiftSchedule, time registration, cost models |
| UX Design Specification | T7 (Settings), T2 (Record Detail) | Shift config, time registration UI |
| API Contracts | §2.17 Manufacturing | Shift, assignment, time registration endpoints |
| Data Models | §13 Production | ShiftSchedule, ShiftAssignment, ProductionOperationWorker |
| State Machine Reference | §10 Manufacturing | ProductionOperation lifecycle with time tracking |
| Event Catalog | §9 Manufacturing | production.time.registered event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-010 (shift rules), BR-PRD-011 (cost posting) |

---

## Story E24.S5: MRP (Material Requirements Planning)

**User Story:** As a production planner, I want the system to run MRP calculations based on demand, stock levels, lead times, and open orders so that I receive suggestions for purchase orders and production orders to meet demand.

**Acceptance Criteria:**

```gherkin
Scenario: Run MRP calculation
  Given sales orders, stock levels, open POs, and open production orders exist
  When I trigger an MRP run
  Then the system calculates net requirements per item
  And generates MrpSuggestion records for items with shortages
  And a "mrp.suggestions.generated" event is emitted

Scenario: MRP suggests purchase order
  Given item "Part C" has demand of 500, stock of 200, open PO for 100
  When MRP runs
  Then a suggestion is generated: "Purchase 200 units of Part C" with suggested order date based on lead time

Scenario: MRP suggests production order
  Given finished good "Widget A" has demand of 100, stock of 20, no open production orders
  When MRP runs
  Then a suggestion is generated: "Produce 80 units of Widget A"
  And sub-component requirements are calculated from BOM explosion

Scenario: Convert MRP suggestion to order
  Given an MRP suggestion exists for purchasing "Part C"
  When I approve and convert the suggestion
  Then a draft Purchase Order is created with the suggested item and quantity
  And the suggestion is marked as CONVERTED

Scenario: MRP respects safety stock
  Given item "Part C" has safety stock of 50 units
  When MRP calculates requirements
  Then the safety stock buffer is included in the net requirement calculation

Scenario: MRP considers lead times
  Given "Part C" has a supplier lead time of 10 working days
  And the demand date is 20 March 2026
  When MRP calculates the order date
  Then the suggested order date is 6 March 2026 (20 March minus 10 working days)
```

**Key Tasks:**
1. **Create MRP models** — MrpSuggestion: companyId, itemId, suggestionType (PURCHASE, PRODUCE), quantity, demandDate, suggestedOrderDate, sourceEntityType, sourceEntityId, status (PENDING, CONVERTED, IGNORED)
   - ProductionPlan: companyId, planDate, status, generatedSuggestionCount
2. **Implement MRP calculation engine** — `POST /api/v1/production/mrp/run`
   - Gather demand (sales orders, production orders)
   - Gather supply (stock, open POs, open production orders)
   - Calculate net requirements per item (demand - supply - stock + safety stock)
   - Explode BOMs for production items to get sub-component requirements
   - Apply lead times to calculate suggested order dates
3. **Implement suggestion management endpoints** — list, convert, ignore
   - Convert to PO: create draft Purchase Order
   - Convert to production order: create draft Production Order
4. **Build MRP run wizard** — T6 with parameter selection (date range, items/categories), progress, results
5. **Build suggestion list** — T1 with action buttons (convert, ignore)
6. **Implement capacity consideration** — check work centre availability when suggesting production
7. **Write unit tests** — net requirement calculation, lead time calculation, BOM explosion for MRP
8. **Write integration tests** — full MRP cycle from demand to suggestion to order conversion

**FR/NFR References:** FR113, FR44, FR73, NFR5

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR113) | MRP calculations, demand/supply analysis |
| Architecture | §2.23 Manufacturing/MRP | MRP engine design, suggestion model |
| UX Design Specification | T6 (Wizard), T1 (Entity List) | MRP run wizard, suggestion list |
| API Contracts | §2.17 Manufacturing | MRP run, suggestion management endpoints |
| Data Models | §13 Production | MrpSuggestion, ProductionPlan schemas |
| State Machine Reference | §10 Manufacturing | SM:ProductionPlan — RUNNING → COMPLETED |
| Event Catalog | §9 Manufacturing | mrp.suggestions.generated event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-012 to BR-PRD-014 (MRP rules) |

---

## Story E24.S6: Work Centre & Machine Capacity

**User Story:** As a production manager, I want to manage machine and work centre capacity with availability calendars and utilisation tracking so that I can plan production within capacity constraints.

**Acceptance Criteria:**

```gherkin
Scenario: Define work centre
  Given I am a production MANAGER
  When I create a work centre "Assembly Line 1" with hourly rate and capacity (8 hours/day)
  Then a WorkCentre record is created with capacity configuration

Scenario: Define machine within work centre
  Given work centre "Assembly Line 1" exists
  When I add machine "Drill Press A" with availability schedule
  Then a Machine record is created linked to the work centre
  And MachineAvailability records define operating hours

Scenario: View capacity utilisation
  Given machines have production operations scheduled
  When I view the capacity dashboard
  Then I see utilisation percentage per work centre and machine
  And overloaded time slots are highlighted in red

Scenario: Capacity check during scheduling
  Given "Assembly Line 1" is at 90% utilisation for the week
  When I schedule a new operation requiring 8 hours
  Then the system warns about capacity overload
  And suggests alternative dates or work centres

Scenario: Machine maintenance window
  Given machine "Drill Press A" has scheduled maintenance on 15 March
  When production scheduling checks availability
  Then the maintenance window is excluded from available capacity
```

**Key Tasks:**
1. **Create capacity models** — WorkCentre: companyId, name, hourlyRate, dailyCapacityHours, overheadRate
   - Machine: workCentreId, name, type, status
   - MachineAvailability: machineId, dayOfWeek, startTime, endTime, isAvailable
2. **Implement capacity endpoints** — CRUD for work centres, machines, availability
   - Utilisation report: `GET /api/v1/production/capacity/utilisation`
3. **Implement capacity check** — compare scheduled operations against available capacity
4. **Build capacity dashboard** — Gantt-style or calendar view showing utilisation
5. **Build work centre/machine management** — T7 (Settings) with availability calendar
6. **Write unit tests** — utilisation calculation, capacity check, maintenance window exclusion
7. **Write integration tests** — scheduling with capacity constraints

**FR/NFR References:** FR114, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR114) | Machine/work centre capacity, utilisation |
| Architecture | §2.23 Manufacturing/MRP | WorkCentre, Machine, capacity models |
| UX Design Specification | T7 (Settings) | Capacity configuration, utilisation dashboard |
| API Contracts | §2.17 Manufacturing | Capacity management and utilisation endpoints |
| Data Models | §13 Production | WorkCentre, Machine, MachineAvailability schemas |
| State Machine Reference | §10 Manufacturing | N/A — capacity is reference data |
| Event Catalog | §9 Manufacturing | capacity.overload.warning event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-015 (capacity rules) |

---

## Story E24.S7: Quality Inspection

**User Story:** As a quality controller, I want to perform quality inspections at the production operation level with pass/fail recording and defect tracking so that product quality is monitored and defects are documented.

**Acceptance Criteria:**

```gherkin
Scenario: Record quality inspection pass
  Given a production operation "Assembly" is in progress
  When I perform a quality inspection and record PASS with inspection notes
  Then a QualityInspection record is created with result PASS
  And the operation can proceed to the next step

Scenario: Record quality inspection fail
  Given a production operation is in progress
  When I record a quality inspection FAIL with defect description
  Then a QualityInspection and QualityDefect record are created
  And the operation is flagged for rework or scrap decision

Scenario: Defect tracking with categorisation
  Given a quality inspection found defects
  When I record defect type "Surface scratch", quantity 5, severity "Minor"
  Then a QualityDefect record captures the details
  And defect statistics are available for trend analysis

Scenario: Inspection required gate
  Given an operation is configured to require quality inspection
  When I attempt to complete the operation without inspection
  Then the system prevents completion with "quality.error.inspection_required"
```

**Key Tasks:**
1. **Create quality models** — QualityInspection: operationId, inspectedById, inspectionDate, result (PASS/FAIL/CONDITIONAL), notes
   - QualityDefect: inspectionId, defectType, description, quantity, severity (MINOR/MAJOR/CRITICAL), resolution
2. **Implement quality endpoints** — `POST /api/v1/production/operations/:id/inspect`
   - Defect recording: `POST /api/v1/production/inspections/:id/defects`
3. **Implement inspection gate** — configurable per operation; prevent completion without inspection
4. **Build inspection UI** — form on operation detail with pass/fail, defect list
5. **Implement defect analytics** — defect rates by type, severity, work centre
6. **Write unit tests** — inspection gate, defect categorisation
7. **Write integration tests** — inspection flow within production execution

**FR/NFR References:** FR115, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR115) | Quality inspections, pass/fail, defect tracking |
| Architecture | §2.23 Manufacturing/MRP | QualityInspection, QualityDefect models |
| UX Design Specification | T2 (Record Detail) | Inspection form within operation detail |
| API Contracts | §2.17 Manufacturing | Inspection and defect endpoints |
| Data Models | §13 Production | QualityInspection, QualityDefect schemas |
| State Machine Reference | §10 Manufacturing | Inspection as gate in operation lifecycle |
| Event Catalog | §9 Manufacturing | quality.inspection.completed event |
| Business Rules Compendium | §8 Manufacturing | Quality inspection rules |

---

## Story E24.S8: WIP Accounting & Production Costing

**User Story:** As a finance user, I want production costs (materials, labour, overhead) posted to GL with work-in-progress accounting so that manufacturing costs are accurately reflected in financial statements.

**Acceptance Criteria:**

```gherkin
Scenario: Material cost posting
  Given materials worth GBP 5,000 are consumed in production
  When cost posting runs
  Then GL journal: Debit WIP account GBP 5,000, Credit Raw Materials account GBP 5,000

Scenario: Labour cost posting
  Given 100 labour hours at GBP 15/hour are recorded
  When cost posting runs
  Then GL journal: Debit WIP account GBP 1,500, Credit Payroll Clearing GBP 1,500

Scenario: Overhead allocation
  Given work centre "Assembly Line 1" has overhead rate GBP 5/hour
  And 100 hours were used in production
  When overhead is allocated
  Then GL journal: Debit WIP account GBP 500, Credit Overhead Applied GBP 500

Scenario: Finished goods receipt clears WIP
  Given WIP balance is GBP 7,000 for the production order
  When finished goods are received
  Then GL journal: Debit Finished Goods Inventory GBP 7,000, Credit WIP GBP 7,000

Scenario: Production variance posting
  Given standard cost is GBP 70/unit and actual cost is GBP 72/unit for 100 units
  When variances are calculated
  Then material, labour, and overhead variances are posted to variance accounts
```

**Key Tasks:**
1. **Create cost models** — ProductionCostEntry: productionOrderId, costType (MATERIAL, LABOUR, OVERHEAD), amount, glAccountId, journalEntryId
2. **Implement material cost posting** — triggered on material consumption events
3. **Implement labour cost posting** — triggered on time registration
4. **Implement overhead allocation** — based on work centre rates and actual hours
5. **Implement WIP clearance** — on finished goods receipt, move costs from WIP to inventory
6. **Implement variance analysis** — standard vs actual cost comparison
7. **Build cost summary UI** — cost breakdown on production order detail
8. **Write unit tests** — each cost posting type, variance calculation
9. **Write integration tests** — full production costing cycle with GL verification

**FR/NFR References:** FR112, FR12, NFR36, NFR38

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR112) | Operation-level cost posting, WIP accounting |
| Architecture | §2.23 Manufacturing/MRP | Production costing model, GL integration |
| UX Design Specification | T2 (Record Detail) | Cost breakdown on production order |
| API Contracts | §2.17 Manufacturing | Cost posting and variance endpoints |
| Data Models | §13 Production | ProductionCostEntry schema |
| State Machine Reference | §10 Manufacturing | Cost posting as side effect of execution |
| Event Catalog | §9 Manufacturing | production.cost.posted event |
| Business Rules Compendium | §8 Manufacturing | BR-PRD-011 (cost posting rules) |

---

## Story E24.S9: Mobile Adaptation — Manufacturing

**User Story:** As a production floor worker, I want to use my phone or tablet to scan materials, register time, record output, and log quality inspections so that production data is captured in real time on the shop floor.

**Acceptance Criteria:**

```gherkin
Scenario: Scan material barcode for consumption
  Given a production order is in progress
  When I scan a material item barcode on mobile
  Then the item is identified and I can enter the consumed quantity
  And the consumption is recorded immediately

Scenario: Clock in/out on production operation
  Given an operation is assigned to me
  When I tap "Start" on my mobile device
  Then my time registration begins
  And when I tap "Stop", the elapsed time is recorded

Scenario: Record output quantity from mobile
  Given I am on the production floor
  When I enter the quantity of finished goods produced
  Then the finished goods receipt is recorded and inventory updated

Scenario: Quick quality inspection from mobile
  Given an operation requires inspection
  When I perform inspection and record PASS/FAIL on mobile
  Then the inspection result is recorded with timestamp
```

**Key Tasks:**
1. **Create mobile production dashboard** — list of assigned operations with status
2. **Implement barcode scanning for materials** — scan and consume workflow
3. **Implement mobile time clock** — start/stop buttons per operation
4. **Implement mobile output recording** — quantity entry with confirmation
5. **Implement mobile quality inspection** — simple pass/fail with notes
6. **Write unit tests** — mobile data entry validation
7. **Write integration tests** — mobile production capture flow

**FR/NFR References:** FR71, FR72, FR111, FR115, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.8 Manufacturing (FR71, FR72, FR111, FR115) | Production execution features |
| Architecture | §2.23 Manufacturing/MRP | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile patterns for production |
| API Contracts | §2.17 Manufacturing | Same endpoints for mobile |
| Data Models | §13 Production | Same models |
| State Machine Reference | §10 Manufacturing | Same state machines |
| Event Catalog | §9 Manufacturing | Same events |
| Business Rules Compendium | §8 Manufacturing | Same rules |

---
