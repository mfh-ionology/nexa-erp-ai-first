# HansaWorld Production & MRP Modules -- Deep-Dive Findings

> **Source**: HAL codebase (`legacy-src/c8520240417/`) and HansaManuals v8.5
> **Date**: 2026-02-15
> **Purpose**: Extract all registers, fields, settings, reports, maintenances, documents, business logic, and workflows for Nexa ERP requirements.

---

## 1. Registers (Entities)

### 1.1 Productions (ProdVc) -- Recipes/BOMs as Executed

The `ProdVc` register represents a **Production record** -- an actual execution of a recipe/BOM that transforms input items into output items. This is the transactional record, not the recipe template.

**Header Fields:**
| Field | Type | Description |
|---|---|---|
| SerNr | LongInt | Auto-generated sequential number |
| ProdDate | Date | Production completion/transaction date |
| StartDate | Date | When production started |
| StartTime | Time | Time production started |
| EndTime | Time | Time production ended |
| BreakTime | Time | Break/idle time during production |
| TotalIdleTime | Time | Total idle time |
| Qty | Val | Quantity being produced |
| TotalProdOrdQty | Val | Total quantity across the production order |
| PRStatusFlag | Integer | Status: 0=Created, 2=Started, 3=Finished, 4=Cancelled, 5=Finished+Discarded |
| DoneFlag | Integer | Visual indicator: 0=open, 18=done, 45=started |
| FinnishedFlag | Integer | 0=not finished, 1=finished |
| Recepy | String | Recipe/BOM code used |
| RecName | String | Recipe name |
| Routing | String | Routing code (if using operations) |
| Location | String | Stock location |
| ProdOrder | LongInt | Link to Production Order (-1 if none) |
| OrderNr | LongInt | Link to Sales Order (-1 if none) |
| Person | String | Responsible person (User code) |
| Inspector | String | Quality inspector (User code) |
| Comment | String | Free text comment |
| Objects | String | Dimension/object tags (comma-separated) |
| StandProblem | String | Standard Problem code (required when status=5/Discarded) |
| Disassemble | Integer | 0=normal production, non-zero=disassembly |
| FixAssCode | String | Machine/Fixed Asset code (links to AT2UnitVc) |
| ProdClass | String | Production Class code |
| RowsHoldActualQty | Integer | 0=row quantities are per-unit (multiply by Qty), 1=row quantities are absolute |
| LocOKNr | Val | Location OK sequence number (assigned on finish) |
| TotWeight | Val | Calculated total input weight |
| TotOutWeight | Val | Calculated total output weight |
| AcumCostPrice | Val | Accumulated cost price (from operations) |
| LangCode | String | Language code |
| AutoCreateOperationsFlag | Boolean | Auto-create operations from routing on save |

**Row Fields (Matrix rows -- material lines):**
| Field | Type | Description |
|---|---|---|
| Item | String | Item code |
| Comment | String | Item description |
| InQty | Val | Input quantity (component consumed) |
| OutQty | Val | Output quantity (finished good produced) |
| ItemCost | Val | Unit cost of the item |
| ExtraCost | Val | Additional cost (labour, overhead) |
| SerialNr | String | Serial/batch number |
| Objects | String | Row-level dimension objects |
| Weight | Val | Item weight |
| Coefficient | Val | Unit conversion coefficient |
| RelVal | Val | Relative value (for multi-output cost allocation) |
| FIFORowVal | Val | FIFO row value |
| OrgProdRow | Integer | Original production row reference (for disassembly) |
| OrgProdFIFORowVal | Val | Original FIFO value (for disassembly variance) |
| PosCode | String | Position code in location |
| UnitXval | Val | Dimension X (for dimensional items) |
| UnitYval | Val | Dimension Y |
| UnitZval | Val | Dimension Z |
| Material | String | Material tag (links row to Std Operation material) |
| BestBefore | Date | Best-before date (calculated from recipe BestBeforeDays) |
| ActualQty | Val | Actual quantity produced (updated by operations) |

### 1.2 Production Orders (ProdOrderVc)

Work orders that plan and track production of a specific item.

**Header Fields:**
| Field | Type | Description |
|---|---|---|
| SerNr | LongInt | Auto-generated sequential number |
| StatusFlag | Integer | 0=Created, 1=Released, 2=Started, 3=Finished, 4=Cancelled |
| DoneFlag | Integer | 0=open, 1=done |
| Recipe | String | Recipe/BOM code |
| RecName | String | Recipe name |
| Machine | String | Machine/work centre code |
| Routing | String | Routing code |
| Location | String | Stock location |
| Qty | Val | Ordered quantity |
| Finished | Val | Quantity finished (from completed Productions) |
| Discarded | Val | Quantity discarded |
| Person | String | Responsible person |
| Objects | String | Dimension objects |
| ProdClass | String | Production class |
| QueuePos | LongInt | Position in machine queue (-1 = not in queue) |
| Reserved | Integer | Whether materials are reserved |
| Comment1 | String | Comment line 1 |
| Comment2 | String | Comment line 2 |
| Instr0..Instr1 | String | Instruction lines |
| StartDate | Date | Actual/planned start date |
| StartTime | Time | Actual/planned start time |
| EndDate | Date | Actual/planned end date |
| EndTime | Time | Actual/planned end time |
| PlannedStartDate | Date | Planned start date (for material reservation) |
| DueDate | Date | Due date (demand date) |
| DurDays | Integer | Duration in days |
| DurTime | Time | Duration time component |
| SetUpTime | Time | Machine setup time |

**Row Fields (Material lines):**
| Field | Type | Description |
|---|---|---|
| Item | String | Item code |
| InQty | Val | Input quantity per unit |
| OutQty | Val | Output quantity per unit |
| Objects | String | Row objects |
| FIFORowVal | Val | FIFO value |

**Key Indexes:**
- `Queue`: Machine + QueuePos (for machine scheduling)
- `OutItemDueAct`: Output item + Due date (for active orders only, status 0 or 1)

### 1.3 Production Plans (ProdPlanVc)

Period-based planning documents covering a date range (weekly or monthly periods).

**Header Fields:**
| Field | Type | Description |
|---|---|---|
| SerNr | LongInt | Auto-generated |
| StartDate | Date | Plan period start (must be 1st of month for monthly, Monday for weekly) |
| EndDate | Date | Plan period end |
| CreateDate | Date | Date the plan was created |
| OKFlag | Integer | 0=draft, 1=approved |
| OKDate | Date | Approval date |
| Closed | Integer | 0=open, non-zero=closed |
| EarliestProdDate | Date | Earliest production start across all rows |

**Row Fields:**
| Field | Type | Description |
|---|---|---|
| ItemCode | String | Item to be produced |
| Recipe | String | Recipe to use |
| SugQty | Val | Suggested quantity (MRP-calculated) |
| Qty | Val | Planned quantity (user-adjusted) |
| ProdStartDate | Date | Planned production start date |
| ProdOrder | LongInt | Link to created Production Order (-1 if none) |
| stp | Integer | Row type: 1=Normal, 2=Subrecipe |

**Key Business Rules:**
- Only one plan per item per overlapping date range (prevents duplicate planning)
- Period type (weekly/monthly) governed by `SFPeriodsBlock.PeriodType`
- Approval requires `ProdPlanOK` user permission
- Approving (OKFlag=1) triggers component explosion via `SaveProdPlanComponents`
- Closing or un-approving deletes component records

### 1.4 Production Plan Components (ProdPlanCompVc)

Auto-generated child records from an approved Production Plan, representing raw material requirements.

**Fields:**
| Field | Type | Description |
|---|---|---|
| SerNr | LongInt | Auto-generated |
| ProdPlanSer | LongInt | Parent Production Plan SerNr |
| ItemCode | String | Component item code |
| Comment | String | Item name |
| StartDate | Date | Plan start date |
| EndDate | Date | Plan end date |
| NeededDate | Date | Date material is needed |
| SugQty | Val | Suggested quantity |
| Qty | Val | Planned quantity |

### 1.5 Production Operations (ProdOperationVc)

Individual operations within a routed production, each linked to a Production record and a sequence step.

**Header Fields:**
| Field | Type | Description |
|---|---|---|
| SerNr | LongInt | Auto-generated |
| ProdNr | LongInt | Parent Production SerNr |
| ProdOrdNr | LongInt | Parent Production Order SerNr |
| Sequence | LongInt | Operation sequence number |
| SubSequence | LongInt | Sub-sequence (parallel operations) |
| PRStatusFlag | Integer | 0=Created, 2=Started, 3=Finished, 4=Cancelled, 5=Finished+Discarded |
| DoneFlag | Integer | Visual status indicator |
| FinnishedFlag | Integer | Finished flag |
| Qty | Val | Planned quantity |
| ActualQty | Val | Actual quantity completed |
| Machine | String | Machine/work centre |
| MachineGroup | String | Machine group (validated against MachineGroupsBlock) |
| StdOperation | String | Standard Operation code |
| Location | String | Stock location |
| Comment | String | Description |
| StartDate | Date | Start date |
| StartTime | Time | Start time |
| ProdDate | Date | Completion date |
| EndDate | Date | End date |
| EndTime | Time | End time |
| RunTime | Duration | Run time |
| SetupTime | Time | Setup time |
| QueueTime | Time | Queue/idle time |
| MoveTime | Time | Move time between operations |
| BatchTime | Time | Batch processing time |
| DisplayGroup | String | Display grouping |
| LangCode | String | Language code |
| LocOKNr | Val | Location OK number |
| RowsHoldActualQty | Integer | Same as ProdVc |

**Row Fields:**
| Field | Type | Description |
|---|---|---|
| Item | String | Item code |
| Comment | String | Description |
| Material | String | Material tag (links to Std Operation) |
| InQty | Val | Input quantity |
| OutQty | Val | Output quantity |
| ActualInQty | Val | Actual input |
| ActualOutQty | Val | Actual output |
| ItemCost | Val | Unit cost |
| RelVal | Val | Relative value |
| FIFORowVal | Val | FIFO value |
| Coefficient | Val | Unit conversion |
| Objects | String | Objects/dimensions |
| SerialNr | String | Serial/batch number |
| PosCode | String | Position code |
| StandProblem | String | Standard Problem (for discarded rows) |
| Discarded | Integer | 0=normal, 1=discarded output |

**Key Indexes:**
- `ProdNr`: Parent production
- `ProdNrPRStatus`: Parent production + Status
- `Sequence`: Sequence + ProdNr + PRStatus
- `SubSequence`: Sequence + SubSequence + ProdNr + PRStatus

### 1.6 Recipes/BOMs (RecVc)

Template defining the bill of materials and default routing.

**Header Fields:**
| Field | Type | Description |
|---|---|---|
| Code | String | Recipe code (primary key) |
| Closed | Integer | 0=active, non-zero=closed |
| DefaultRouting | String | Default Routing code |

**Row Fields:**
| Field | Type | Description |
|---|---|---|
| Item | String | Item code |
| Comment | String | Description |
| InQty | Val | Input quantity per unit |
| OutQty | Val | Output quantity per unit |
| ItemCost | Val | Standard cost |
| RelVal | Val | Relative value for cost distribution |
| Material | String | Material tag for operation mapping |
| Recipe | Integer | Sub-recipe flag |
| BestBeforeDays | Integer | Days to add to production date for best-before |
| CompUsage | String | Component usage account (override) |

### 1.7 Routings (RoutingVc)

Defines the sequence of operations for producing an item.

**Header Fields:**
| Field | Type | Description |
|---|---|---|
| Code | String | Routing code (primary key) |
| RegDate | Date | Registration date |
| LastChangeDate | Date | Last modification date |

**Row Fields:**
| Field | Type | Description |
|---|---|---|
| Sequence | LongInt | Sequence number (must be > 0) |
| SubSequence | LongInt | Sub-sequence for parallel operations |
| StdOperation | String | Standard Operation code |
| Machine | String | Default machine |
| MachineGroup | String | Machine group (machine must belong to group) |
| Comment | String | Operation description |
| RunTime | Duration | Run time override |
| SetupTime | Time | Setup time override |
| QueueTime | Time | Queue time override |
| MoveTime | Time | Move time override |

### 1.8 Standard Operations (StdOperationVc)

Templates for production operations.

**Fields:**
| Field | Type | Description |
|---|---|---|
| Code | String | Operation code |
| Machine | String | Default machine |
| MachineGroup | String | Default machine group |
| RunTime | Duration | Standard run time |
| SetupTime | Time | Standard setup time |
| QueueTime | Time | Standard queue time |
| MoveTime | Time | Standard move time |
| BatchTime | Time | Batch processing time |
| DurDays | Integer | Duration in days |
| DurTime | Time | Duration time |
| DisplayGroup | String | Display grouping |

**Row Fields (Material associations):**
| Field | Type | Description |
|---|---|---|
| Material | String | Material tag |
| Qty | Val | Standard quantity |

### 1.9 Machines/Equipment (ProdMachineEqVc)

Links machines to equipment records.

**Fields:**
| Field | Type | Description |
|---|---|---|
| Code | String | Machine code (required) |
| ProdEqCode | String | Equipment code (required) |

### 1.10 Production Item Alternatives (ProdItemVc)

Maps items to machines and their default recipes.

**Header Fields:**
| Field | Type | Description |
|---|---|---|
| ItemCode | String | Item code |
| DefMachine | String | Default machine for this item |

**Row Fields:**
| Field | Type | Description |
|---|---|---|
| Machine | String | Alternative machine |
| DefRecipe | String | Default recipe for this machine |

### 1.11 Switch Times (ProdSwitchTimeVc)

Records machine switch/changeover times.

**Fields:**
| Field | Type | Description |
|---|---|---|
| SerNr | LongInt | Auto-generated |
| Machine | String | Machine code (required) |

### 1.12 Auto Productions (AutoProdVc)

Automatic production rules for triggering productions automatically from Stock Movements.

**Fields:**
| Field | Type | Description |
|---|---|---|
| FromItemCode | String | Source item (input to production) |
| ToItemCode | String | Target item (output from production) |
| Default | Integer | 0=normal, 1=default rule (unique per ToItemCode) |
| UnitCoefficient | Val | Conversion factor from source to target item quantity |

**Usage:** When a Stock Movement is saved to a Location with `Type=1` (production location), the system automatically creates finished Productions for each item row that has a matching AutoProdVc rule. The `CreateAutoProduction` procedure groups Stock Movement rows by target item, creates Production records in Finished (3) status, generates GL transactions, and handles FIFO valuation.

### 1.13 Production Classes (ProdClassVc)

Classification for productions and production orders.

**Fields:**
| Field | Type | Description |
|---|---|---|
| Code | String | Class code |

---

## 2. Settings

### 2.1 Production Settings (ProdSettingsBlock)

| Setting | Type | Description |
|---|---|---|
| AutoCalcCostf | Integer | Auto-calculate cost from machine run/idle times |
| MachineCostItem | String | Item code used for machine cost line in production rows |
| DefaultMachine | String | Default machine for new Productions and Production Orders |
| ProdRowsHoldActualQty | Integer | Default value for RowsHoldActualQty on new records (0=per-unit, 1=absolute) |
| MakeSDFromDiscard | Integer | Create Stock Depreciation (SDVc) from discarded productions |
| AutoCreateWIP | Boolean | Auto-create Work-In-Progress GL transactions when status changes to Started |
| UpdProdInQtyFromStockMov | Integer | Update production input qty from stock movements (also controls auto-production from stock moves) |
| FixedTime | Integer | Include time-based cost items (labour, setup, move, queue) in operations |
| LabourCostItem | String | Item code for labour/run time cost |
| SetupCostItem | String | Item code for setup time cost |
| MoveCostItem | String | Item code for move time cost |
| QueueCostItem | String | Item code for queue time cost |
| CompleteSequence | Integer | Require all previous sequences to be completed before next |
| AddWorkCost | Integer | Add work cost from time-registered activities to production |
| WorkCostPerHour | Val | Cost per hour for work time calculation |
| AddDiscardedCost | Integer | Add discarded production costs to subsequent good productions |
| ActType | String | Default Activity Type for production time registration |
| SetupActType | String | Activity Type for setup time registration |
| AutoGenProd | Integer | 0=generate Productions directly, non-zero=generate Production Orders from Plans |

### 2.2 Production Accounts (ProdAccBlock)

| Setting | Type | Description |
|---|---|---|
| CompUsage | String | Component Usage account |
| ProdControl | String | Production Control account |
| WorkInProg | String | Work-In-Progress account |
| ProdTransaction | Integer | 0=generate GL transaction from Production, 1=from Production Operations |

### 2.3 Transaction Generation (TRGenBlock)

| Setting | Type | Description |
|---|---|---|
| ProdGenTrans | Integer | Generate GL transactions from productions (0=no, 1=yes) |
| ProdStartDate | Date | Do not generate transactions before this date |

### 2.4 Account Settings (AccBlock)

| Setting | Type | Description |
|---|---|---|
| ProdWCostAcc | String | Production Work Cost account (non-stocked items) |
| ProdICostAcc | String | Production Inventory Cost account |
| StockAcc | String | Default Stock account |
| StockGainAcc | String | Stock Gain/Loss account (balancing entry) |
| DiscardedAccount | String | Discarded Production account |
| DisassembleProdVar | String | Disassembly Variance account |
| ConsigStockAcc | String | Consignment Stock account |

### 2.5 Item Group Accounts (ITVc)

Per-item-group overrides for production accounts:
- `CompUsage`: Component Usage account override
- `ProdControl`: Production Control account override
- `ProdWCostAcc`: Production Work Cost override
- `InvAcc`: Inventory account
- `StockAcc`: Stock account (via GetITStockAcc)

### 2.6 Machine Groups (MachineGroupsBlock)

| Field | Type | Description |
|---|---|---|
| Code | String | Group code |
| DefStr | String | Comma-separated list of machines in the group |

Validates that a machine belongs to its declared group.

### 2.7 Sales Forecast Periods (SFPeriodsBlock)

| Setting | Type | Description |
|---|---|---|
| PeriodType | Integer | 0=Months (kForecastPeriodTypeMonths), 1=Weeks (kForecastPeriodTypeWeeks) |

### 2.8 Serial Number Blocks (ProdSerBlock, ProdOrdSerBlock, ProdPlanSerBlock)

Number series configuration for Production, Production Order, and Production Plan serial numbers.

**Row Fields (common across all three):**
| Field | Type | Description |
|---|---|---|
| TSerStart | LongInt | Start of serial number range (must be > 0) |
| TSerEnd | LongInt | End of serial number range (must be > 0) |
| StartDate | Date | Effective start date for this range |
| EndDate | Date | Effective end date for this range |

**Validation:** Ranges must not overlap within the same block (checked by `SerBlockCheckOverlap`).

### 2.9 Machine Shift Configuration (MachineShiftVc)

Used by the Production Plan Tools (scheduling engine) to define working hours per machine/day.

**Row Fields:**
| Field | Type | Description |
|---|---|---|
| StartTime | Time | Shift start time for a given day offset |
| EndTime | Time | Shift end time for a given day offset |
| RepeatCnt | Integer | Number of times to repeat this shift pattern |

The scheduling engine (`GetNextAvailableWTime` in ProdPlanTools) uses this to determine when a machine is available, skipping non-working hours and calculating operation start/end times across shift boundaries.

---

## 3. Reports

### 3.1 Production Reports

| Report File | Report Name | Description |
|---|---|---|
| ProdOrdRn.hal | Production Order List | Lists production orders filtered by status (Created/Released/Started/Finished/Cancelled), machine, recipe, item group. Shows SerNr, DueDate, QueuePos, Machine, Recipe, RecName, Qty, Finished, Discarded, Remaining. Three detail levels: overview (0), with materials (1), with progress (2). |
| ProdOperationsRn.hal | Production Operations | Lists production operations with status, machine, times |
| ProdPlanRn.hal | Production Plan | Production plan report by period |
| ProdQueueRn.hal | Production Queue | Shows machine queue -- displays Production Orders in queue order per machine (status 1-2 only). Filters by machine code. Shows SerNr, Recipe, RecName, remaining qty, Machine, QueuePos. |
| ProdStatRn.hal | Production Statistics | Aggregates finished productions by Recipe. Filters by date range, start time range, recipe, and machine. Shows recipe code, units, recipe name, total quantity, total output weight. |
| ProdStatusRn.hal | Production Status | Status report for a specific production (called from Production window) |
| ProdDefRn.hal | Production Defects / Where-used | For items with recipes, shows component stock levels vs needed quantities and calculates maximum producible quantity and reorder suggestions. Compares Available-Ordered-Needed-Balance-PurchaseOrders-MinLevel-SuggestedOrder per component. Multi-level BOM expansion supported. |
| ProdOrderPlanRn.hal | Production Order Plan | Planning view of production orders |
| ProdOrderQueueRn.hal | Production Order Queue | Order queue by machine |
| ProdOpJournalRn.hal | Production Operation Journal | Journal/log of operation activities |
| ProdOperPlanRn.hal | Production Operation Plan | Planned vs actual operations |
| ProdPlanInfoRn.hal | Production Plan Info | Shows Production Plan rows with linked Production Order or Production numbers. Column header changes based on `AutoGenProd` setting: shows "Production" link if 0, "Production Order" link if non-zero. |
| ProdPlanProdRn.hal | Production Plan Productions | Productions generated from plans |
| ProdSerNoRn.hal | Production Serial Numbers | Serial number tracking in production |
| ProdStatDiscRn.hal | Production Statistics - Discarded | Discarded production analysis |
| MaxprodRn.hal | Maximum Production | Calculates maximum producible quantity for items with recipes based on current stock of components. Handles structured items (type 2) by expanding their recipe structure. Supports item group and item classification filtering, multi-level BOM expansion, and sorting by code or group. Two detail levels. |
| NextProductionRn.hal | Next Production | Upcoming production schedule |
| Prodlist.hal | Production List | General production listing |
| RecipeCostCompareRn.hal | Recipe Cost Comparison | Compare recipe costs across recipes |

---

## 4. Maintenances (Batch Operations)

### 4.1 Move Production Order in Queue (MoveProdOrdMn.hal)

**Purpose:** Reorder a Production Order's position in the machine queue.

**Parameters:**
- `long1`: Production Order SerNr
- `long2`: New queue position

**Logic:** Shifts other orders up or down to accommodate the new position. Handles recursive repositioning when moving orders forward in the queue.

### 4.2 Create Production Operations (ProdOperationsMn.hal)

**Purpose:** Auto-generate Production Operation records from a Production's Routing.

**Parameters:**
- `long1`: Production SerNr

**Logic:**
1. Reads the Production's Routing
2. For each routing step, reads the Standard Operation
3. Creates a ProdOperationVc with:
   - Materials mapped from Production rows via Material tags
   - Times (Run, Setup, Queue, Move) from Routing/StdOperation
   - Dates calculated from production start + operation durations
4. Handles phantom items (plain items with recipes) -- recursively creates operations for sub-assemblies
5. Optionally adds time-cost items (LabourCostItem, SetupCostItem, etc.)
6. Creates record links between Operations and Productions

### 4.3 Generate Production Plans (ProdPlanMn.hal)

**Purpose:** MRP calculation -- generates Production Plans based on forecasts, stock levels, and demand.

**Parameters:**
- `d1`: Actual start date
- `sStartDate` / `sEndDate`: Planning horizon
- `f1`, `f3`: Item filters
- `LastAcc`: Location filter
- `flags[3]`: Max stock calculation flag

**Logic:**
1. Closes existing production plans for filtered items
2. Builds forecast arrays from Sales Forecasts
3. Calculates maximum stock levels
4. Builds current stock + forecast projections
5. Combines forecast with max stock to generate required production
6. Appends existing PO Plans and Production Plans
7. Writes the resulting production plan records

### 4.4 Create Production Orders from Plans (ProdPlanProdMn.hal)

**Purpose:** Converts approved Production Plan rows into Production Orders.

**Parameters:**
- `sStartDate` / `sEndDate`: Date range for conversion
- `flags[1]`: Include approved plans
- `flags[2]`: Include unapproved plans

**Logic:**
1. Loops through Production Plans with ProdStartDate in range
2. Skips rows that already have a ProdOrder
3. Calls `CreateProdOrderFromProdPlan` to create each order
4. Updates the plan row with the new ProdOrder reference

### 4.5 Automatic Production from Stock Movements (ProdFromStockMov.hal)

**Purpose:** Automatically creates finished Production records when Stock Movements arrive at production-type locations.

**Trigger:** Stock Movement saved to a Location with `Type=1` (production location), provided `UpdProdInQtyFromStockMov=0` in ProdSettingsBlock.

**Logic:**
1. Iterates Stock Movement rows
2. Looks up `AutoProdVc` for each item (`FromItemCode`)
3. Groups items by target product (`ToItemCode`)
4. Creates Production records in Finished (3) status:
   - Input rows: from stock movement items, qty = movement qty
   - Output row: target item, qty = sum(input qty * UnitCoefficient)
5. Fills FIFO values and generates GL transactions immediately
6. Each distinct target product gets its own Production record

### 4.6 Production Plan Scheduling Engine (ProdPlanTools.hal)

**Purpose:** Provides scheduling logic for production planning, including shift-aware time calculations.

**Key Functions:**
- `RemoveOldTempRecs`: Clears temporary production plan records (`TempProdPlanVc`)
- `GetNextAvailableWTime`: Finds next available working time for a machine based on `MachineShiftVc` configuration
- `AddPlanRow`: Creates scheduled plan row entries with proper start/end date-time calculations that respect shift boundaries

**Scheduling Logic:**
- Operations are scheduled forward from earliest available time
- Respects machine shift schedules (start/end times per day)
- Handles multi-day operations by splitting across shift boundaries
- Tracks arrays of start/end dates-times for multi-day spans
- Uses global start date/time as anchor point

---

## 5. Documents (Forms)

### 5.1 Production Order Forms

| Document File | Description |
|---|---|
| DoProdOrderForm.hal | Production Order print - standard format |
| DoProdOrder2Form.hal | Production Order print - format 2 |
| DoProdOrder3Form.hal | Production Order print - format 3 |
| ProdOrderForm.hal | Production Order form definition |
| ProdOrder2Form.hal | Production Order form 2 definition |
| ProdOrder3Form.hal | Production Order form 3 definition |
| ProdLabelForm.hal | Production label printing |

### 5.2 Production Operation Forms

| Document File | Description |
|---|---|
| DoProdOperation2Form.hal | Production Operation print - format 2 |
| ProdOperation2Form.hal | Production Operation form definition |

### 5.3 Routing Forms

| Document File | Description |
|---|---|
| DoRoutingForm.hal | Routing print - standard format |
| DoRoutingPrForm.hal | Routing print - production format |
| DoRoutingPrOrdForm.hal | Routing print - production order format |
| RoutingPrForm.hal | Routing production form definition |
| RoutingPrOrdForm.hal | Routing production order form definition |

---

## 6. Business Logic and Workflows

### 6.1 Recipe/BOM Creation and Versioning

- Recipes (`RecVc`) define input items (InQty > 0) and output items (OutQty > 0)
- Each item has a default recipe (`INVc.Recepy`)
- Recipes can be closed (`Closed` flag) -- closed recipes cannot be used in new productions
- Recipes support sub-recipes (Material tags linking to Standard Operations)
- `RecipeCostCompareRn` report enables comparison of costs across different recipes
- Default Routing is set on the Recipe for automatic operation generation

### 6.2 Production Order Lifecycle

```
Created (0) --> Released (1) --> Started (2) --> Finished (3)
                                      |              |
                                      +-> Cancelled (4)
```

**Create:** Assigns serial number, default machine from settings, inserts into machine queue.

**Release (1):** Machine is required (unless Routing is specified). Validates recipe, location, person, machine-item compatibility.

**Start (2):** Auto-sets StartDate/StartTime to current date/time.

**Finish (3):** Must have been Released first. Auto-sets EndDate/EndTime. Cannot revert from Finished.

**Queue Management:**
- Orders in status 1 or 2 are placed in machine queue
- QueuePos determines position in queue per machine
- `MoveProdOrdMn` maintenance handles reordering

**Stock Impact:**
- Active orders (status 0-2) create "ordered" quantities:
  - Input items: Reserved/on-order quantity = InQty * (Qty - Finished - Discarded)
  - Output items: Expected quantity = OutQty * (Qty - Finished - Discarded)
- Planned stock updated via `UpdateProdOrderPlanned` using `Fut2ProdOrderInVc` and `Fut2ProdOrderOutVc`

### 6.3 Production (ProdVc) Lifecycle

```
Created (0) --> Started (2) --> Finished (3)
                     |              |
                     +-> Cancelled (4)
                     |
                     +-> Finished & Discarded (5)
```

**Created (0):** Default state. Row quantities set from recipe. No stock impact.

**Started (2):**
- Auto-sets StartDate/StartTime
- If `AutoCreateWIP` is enabled: creates WIP GL transaction, debiting WIP and crediting Stock
- Updates parent Production Order to Started status
- Creates stock reservations for materials

**Finished (3):**
- Auto-sets EndTime if blank
- Creates GL transaction (Stock debit, Stock Gain credit, Component Usage entries)
- Updates serial numbers
- Updates item cost prices
- Records item history
- Updates Production Order finished quantity
- Requires at least one output row with OutQty > 0
- Validates: all items exist, serial number availability, stock levels (if `dontAllowOvership`)

**Cancelled (4):**
- If `AutoCreateWIP`: reverses the WIP transaction
- Only allowed if no operations are finished/discarded

**Finished & Discarded (5):**
- Requires `StandProblem` (reason code)
- Creates Stock Depreciation record (SDVc) if `MakeSDFromDiscard` setting is enabled
- Posts to `DiscardedAccount` instead of `StockGainAcc`
- Still updates stock (output removed, inputs consumed)

**Un-OK (Reversing):**
- Status can be reverted from Finished/Discarded back to Created (0)
- Reverses stock movements, serial numbers, cost prices
- Deletes associated GL transaction
- Flags `RecalcStockNeeded` for background recalculation

### 6.4 Material Consumption (Issue/Backflush)

**Direct Issue (no Routing):**
- Materials are consumed when Production reaches Finished/Discarded status
- Row `InQty` represents quantity consumed per unit (or absolute if `RowsHoldActualQty=1`)
- Actual stock deduction = InQty * Qty (or InQty if absolute)

**With Routing (Operations-based):**
- Materials are consumed per-operation when each Production Operation finishes
- Each operation has its own material rows mapped via Material tags
- The Production itself does not directly consume stock -- operations do
- `ProdBackflush_OKOperations` can batch-finish all remaining operations

**Stock Movement Creation:**
- `StockMovFromPRDsm` creates a Stock Movement from a Production (for inter-location transfers)
- Validates user permission `PRToStockMov`

### 6.5 Operation Tracking and Machine Scheduling

**Operation Creation:**
1. User assigns a Routing to a Production
2. `ProdOperationMn` (or auto-create flag) generates operations
3. Each Routing row becomes a ProdOperationVc with:
   - Sequence/SubSequence from routing
   - Machine/MachineGroup from routing row or Standard Operation
   - Materials matched by Material tag to Production rows
   - Time estimates from Routing or Standard Operation (with overrides)

**Sequence Enforcement:**
- Operations must be completed in sequence order
- `PrevOperationInSequenceOKed` validates no previous sequence operations are still pending
- `CompleteSequence` setting enforces strict sequential processing
- SubSequences allow parallel operations within a sequence step

**Partial Completion:**
- When an operation processes fewer items than planned (`ActualQty < Qty`), a child operation is created for the remainder (`ChildProdOperation`)
- ActualQty cannot exceed Qty
- Total ActualQty across all sub-operations for a sequence cannot exceed Production Qty

**Cancellation Cascade:**
- Cancelling an operation cancels ALL operations for that production
- Also cancels the parent Production record

**Machine Validation:**
- Machine must belong to declared MachineGroup (validated against `MachineGroupsBlock`)

### 6.6 Production Plan and MRP Logic

**Production Plan Workflow:**
1. **Demand Input:** Sales Forecasts provide demand data
2. **MRP Calculation (`ProdPlanMn`):**
   - Gathers forecast data for planning horizon
   - Calculates maximum stock levels
   - Projects current stock forward
   - Nets demand against stock + existing plans
   - Generates Production Plan rows with SugQty and Qty
3. **Plan Approval:** User reviews, adjusts quantities, approves (OKFlag=1)
4. **Component Explosion:** On approval, `SaveProdPlanComponents` creates ProdPlanCompVc records
   - Recursively expands sub-recipes
   - Aggregates quantities by item and needed date
5. **Production Order Generation (`ProdPlanProdMn`):**
   - Converts approved plan rows into Production Orders
   - Filters by date range
   - Links ProdOrder back to plan row

**Period Types:**
- Monthly: StartDate must be 1st of month, EndDate last day of month
- Weekly: StartDate must be Monday, EndDate following Sunday

**Unique Plan Constraint:** Only one plan per item per overlapping period (checked by `CheckIfProdPlanExists`).

### 6.7 Time Registration and Activity-Based Production (ProdOrderTools3.hal)

A major alternative production workflow using Activities (ActVc) for time tracking on the shop floor.

**Time Registration Workflow (`RegTimeProduction`):**
1. Worker scans Production Order barcode
2. System checks if worker has existing open Production for this order:
   - **Found existing:** Returns production reference (worker is continuing work)
   - **Not found:** Checks if another person has already started work on same order
3. If no open production exists:
   - Creates a new Production (ProdVc) from Production Order with status=Started(2)
   - Creates an Activity (ActVc) to track work time (OKFlag=0 = open)
   - Sets ProdOrder status to Started(2)
4. When worker finishes (scans again):
   - System finds open Activity, sets EndTime, calculates CostTime, marks OK
   - Returns production for qty recording

**Quantity Recording (`RecordProdQtys`):**
- Records good qty and discarded qty for a production
- Discarded items create a separate Production with status=5 (Finished+Discarded)
- Good items update the main Production to status=3 (Finished)
- Handles `AddDiscardedCost`: costs from discarded productions are rolled into subsequent good production costs
- Supports closing Production Order if fully produced (`flags[0]`)
- Registers setup time as separate Activity records

**Work Cost Calculation (`OKAndAddWorkCost`):**
- Collects all open Activities for the production
- Calculates total work time and setup time
- Converts to cost: `ExtraCost += (workTime * WorkCostPerHour) / Qty`
- Adds cost from other workers on the same production
- Handles both `RowsHoldActualQty` modes

**Multi-Worker Support:**
- Multiple workers can work on the same Production Order simultaneously
- `SomeoneElseStartedWrkOnProductionOrder`: checks for other workers' open productions
- `SomeoneElseWorkignOnProductionOrder`: checks for other workers' open activities
- `LinkAllOpenActivities`: creates record links between concurrent activities
- `RedistribueTime`: redistributes overlapping work times equally when multiple activities are linked

**Production Creation from Order (`NewProductionFromProdOrder`):**
- Creates ProdVc from ProdOrderVc with full field mapping
- Copies rows from order, applying recipe costs (ItemCost, RelVal, ExtraCost)
- Sets ProdOrder.StatusFlag to Started(2) after successful production creation
- Handles `RowsHoldActualQty` mode differences when copying quantities

### 6.8 Recipe Explosion in Sales/Purchase Documents (ProdRowTools.hal)

Recipes are not only used in production -- they drive component explosion in Invoices, Sales Orders, Quotations, Purchase Orders, Cash Invoices, Budget lines, Stock Depreciations, and Returns.

**Cross-Document Recipe Explosion Functions:**
| Function | Document Type | Context |
|---|---|---|
| `IVVc_ExplodeRecepy` | Invoice (IVVc) | Structured item component rows with pricing |
| `ORVc_ExplodeRecepy` | Sales Order (ORVc) | Order component rows with pricing |
| `QTVc_ExplodeRecepy` | Quotation (QTVc) | Quote component rows with pricing |
| `OYVc_ExplodeRecepy` | Orders to Ship (OYVc) | Ship order component rows |
| `WSVc_ExplodeRecepy` | Work Sheet/Service (WSVc) | Service worksheet components |
| `PUVc_ExplodeRecepy` | Purchase Order (PUVc) | Purchase component rows |
| `IVCashVc_ExplodeRecepy` | Cash Invoice (IVCashVc) | POS receipt components |
| `SDVc_ExplodeRecepy` | Stock Depreciation (SDVc) | Depreciation components |
| `RetVc_ExplodeRecepy` | Return (RetVc) | Return components |
| `TBBUVc_ExplodeRecepy` | Budget (TBBUVc) | Budget line components |
| `Do_InvoiceRecepy` | Invoice (IVVc) | Output-based invoice recipe |

**Common Explosion Logic (`ExpandProdRows`):**
1. Reads the Recipe for the given item
2. Finds output multiplier (mulfact2) from the recipe's output row
3. For each input row in recipe:
   - If multi-level and item has its own recipe: recursively expand
   - Otherwise: add to component array with calculated quantities
4. Handles variety items (variant suffixes propagated to components)

**Quantity Change Propagation:**
- `IVVc_ChangeQuantityRecepy`, `ORVc_ChangeQuantityRecepy`, etc.
- When parent item quantity changes, component quantities are recalculated using `RecipeQuant * newQty`
- Components are identified by `stp == kInvoiceRowTypeStructuredItemComponent`

**Maximum Production Calculation (`ExpandProduction`):**
- Uses same `ExpandProdRows` but calculates max producible quantity based on component stock levels
- `maxp = min(stock[i] / inqty[i])` across all stocked components
- Rounds down to integer

### 6.9 Operation-Level GL Transactions (MakeTransFromProdOperation.hal)

When `ProdAccBlock.ProdTransaction=1`, GL transactions are generated per Production Operation rather than from the Production header.

**Entry Point:** `MakeTransFromProdOperation` -- creates a GL transaction for a finished or discarded Production Operation.

**Key Logic (`ProductionOperationTransaction`):**
1. For each input row: posts to Stock Account (debit) and optionally Component Usage + Production Control accounts
2. For each output row: posts to Stock Account (credit)
3. For discarded output rows: posts to Discarded Account instead of Stock Account
4. Handles stocked vs non-stocked items separately (non-stocked use Production Work Cost account)
5. Supports `RowsHoldActualQty` mode: quantity = ItemCost (absolute) or ItemCost * ActualQty (per-unit)

**Accumulated Cost Handling (`AcumCost_PreviousProdOperations`):**
- For multi-sequence operations, accumulates costs from ALL previous sequences' finished operations
- Distributes accumulated cost to output rows using RelVal (relative value)
- Handles both status 3 (Finished) and status 5 (Finished+Discarded) previous operations

**WIP Handling for Non-Final Operations:**
- If an operation has no output rows (intermediate step), it posts to WIP account
- Final operation (determined by `ProdOperationForFinalProduct`) resolves WIP to Stock/Stock Gain
- For discarded final operations: resolves WIP to WIP account (reversing entries per row)

**Transaction Metadata:**
- IntYc = ProdOperationYc (not ProdYc)
- Number = Operation SerNr
- TransDate = Operation ProdDate
- Validates fiscal period and checks for existing transactions

### 6.10 Cost Roll-ups and Variance Tracking

**Cost Calculation (ProdCalcItemCost):**
1. Sums up InQty * (ItemCost + ExtraCost) for all input rows
2. If `AutoCalcCostf` and `MachineCostItem` are set:
   - Reads machine cost from AT2UnitVc (IdleCost, RunCost)
   - Calculates: IdleCost = (IdleCost/60) * (idleMinutes / TotalProdOrdQty)
   - Calculates: RunCost = (RunCost * runMinutes) / 60
   - Adds machine cost as a row with MachineCostItem
3. Sets output row ItemCost = total input cost / output quantity
4. Updates FIFO values

**Operation Cost Calculation (ProdOperCalcItemCost):**
- Same logic as ProdCalcItemCost but per-operation
- Uses operation-level Machine, times, and quantities

**Disassembly Variance:**
- When `Disassemble` flag is set, the original FIFO value is compared to current cost
- Variance = OrgProdFIFORowVal - calculated cost
- Posted to `DisassembleProdVar` account

### 6.11 GL Transaction Generation

**Standard Production Transaction (MakeTransFromProd):**

Triggered when Production status reaches Finished or Finished+Discarded.

For each material row:
- **Stocked input items:** Debit Stock account, Credit Component Usage + Production Control (if configured)
- **Stocked output items:** Credit Stock account
- **Non-stocked items:** Debit/Credit Production Work Cost account
- **Extra costs:** Posted to Production Work Cost account
- **Balancing entry:** Stock Gain account (or Discarded Account for status 5)

**WIP Transaction (MakeTransFromProd2):**

When `AutoCreateWIP` is enabled, two transactions are created:
1. **On Start:** Debit WIP account, Credit Stock account (for material consumption)
2. **On Finish:** Debit Stock account (output), Credit WIP account (reversal)

**Operation Transaction (MakeTransFromProdOperation):**
- When `ProdTransaction=1` in ProdAccBlock, GL transactions come from individual operations rather than the Production header
- Each finished operation generates its own GL entries

**Account Resolution Priority:**
1. Item Group account (ITVc) if `ItemGroupAccounts` is enabled
2. Location stock account (LocationVc.StockAcc)
3. Default accounts from AccBlock

**Consignment Stock:** Special handling when items are on consignment -- uses `ConsigStockAcc`.

### 6.12 UI/Client-Side Behaviours (WAction files)

**Production Order (ProdOrderVcWAction.hal):**
- **Recipe paste:** When recipe field changes, `PasteRecInProdOrder` loads recipe rows into order
- **Machine paste:** When machine changes, `UpdateProdOrderWithNewMachine` validates and updates dependent fields
- **Quantity change:** Triggers `CalcProdDuration` to recalculate planned duration
- **Item paste:** `ProdOrderVc_PasteItem` validates item and populates description
- **Status button:** StatusFlag > 2 disables the OK button; StatusFlag > 0 locks SerNr
- **Update test:** Orders with StatusFlag > 2 (except 5) are read-only
- **Move in Queue action (`MoveProdOrdDsm`):** Opens queue position editor; passes current SerNr and QueuePos
- **Create Production (`ProdOrdFinishBatchDsm`):** Creates ProdVc from ProdOrderVc for orders in status 1-2
- **Print batch:** Supports multi-selection printing from browse window
- **Status report:** Opens ProdOrdRn with all status flags enabled
- **Next Production:** Opens NextProductionRn for the current order

**Production Operation (ProdOperationWAction.hal):**
- **Item paste:** Populates item details via `ProdOperationVc_PasteItem`
- **InQty/OutQty change:** Recalculates `FIFORowVal = InQty * ItemCost` (rounded)
- **Qty change:** For `RowsHoldActualQty=1`, adjusts all row quantities proportionally
- **ActualQty change:** Pastes actual qty across related rows
- **SerialNr paste:** Validates serial status, calculates batch qty, auto-splits rows
- **Status button:** PRStatusFlag > 2 requires UnOKAll permission
- **Batch time button:** Disabled for finished operations
- **Create Activity:** `CreateActFromProdOperation` creates Activity from operation
- **Add Labour:** `LabourProdOperationDsm` adds labour cost rows (for status 0 or 2)
- **Quality Control:** `QualConFromProdOperationDsm` creates QC record from operation
- **Generate Serial Numbers:** `GenSerialNosProdOperDsm` auto-fills serial numbers (for status < 3)
- **Row switch:** Shows item statistics (cost, stock info) when row is selected

**Production Plan (ProdPlanVcWaction.hal):**
- **ItemCode paste:** `ProdPlanDClassItemCodeRemote` validates item and populates defaults
- **StartDate change:** Auto-calculates EndDate based on period type (monthly: last day of month, weekly: following Sunday)
- **SugQty/Qty change:** Triggers quantity recalculation
- **ProdDays change:** Recalculates ProdStartDate via `RecalcProdStart`
- **OKFlag button:** Approved plans require UnOKAll permission to unapprove
- **Field locking:** Once approved, Recipe, ProdPlanRow, AboveRecipeRow, SugQty, NeededDate are read-only
- **Row insert/delete:** Blocked for approved or closed plans
- **Create Production Order (`ProdOrderFromProdPlanDsm`):** Creates orders from plan rows; requires plan to be open
- **Plan Info:** Opens ProdPlanInfoRn report

**Routing (RoutingVcWAction.hal):**
- **StdOperation paste:** Auto-fills Comment, SetupTime, QueueTime, MoveTime, RunTime, MachineGroup from Standard Operation record; triggers `RoutingSumup`

**Machine Equipment (ProdMachineEqVcWAction.hal):**
- **Code paste:** Looks up AT2UnitVc (Fixed Asset) by InventoryNr and fills Name
- **ProdEqCode paste:** Same lookup for equipment; warns if Code == ProdEqCode (self-reference)

---

## 7. Enums and Constants

### 7.1 Production Status (kPRStatus)
```
kPRStatusCreated           = 0   // Draft/New
kPRStatusStarted           = 2   // In Progress (note: 1 is skipped)
kPRStatusFinished          = 3   // Completed Successfully
kPRStatusCancelled         = 4   // Cancelled
kPRStatusFinishedandDiscarded = 5   // Completed but output discarded
```

### 7.2 Item Types (kItemType)
```
kItemTypePlain     = 0   // Non-stocked (also "phantom" if has recipe)
kItemTypeStocked   = 1   // Stocked item
kItemTypeStructured = 2  // Structured/BOM item (cannot be in Production rows)
kItemTypeService   = 3   // Service item (cannot be output)
```

### 7.3 Stock Item Types (kStockItemType)
```
kStockItemTypeNotDefined   = 0
kStockItemTypeMerchandise  = 1
kStockItemTypeRawMaterials = 2
kStockItemTypePartOf       = 3
kStockItemTypeScrap        = 4
kStockItemTypeWIP          = 5
```

### 7.4 Production Plan Row Types (kProdPlanRowType)
```
kProdPlanRowTypeNormal    = 1
kProdPlanRowTypeSubrecipe = 2
```

### 7.5 Transaction Year Codes
```
ProdYc              // Standard Production transaction
ProdOperationYc     // Production Operation transaction
StartedProdYc       // Started Production WIP transaction
```

### 7.6 Production Order Status (StatusFlag on ProdOrderVc)
```
0 = Created
1 = Released
2 = Started
3 = Finished
4 = Cancelled
```

### 7.7 DoneFlag Values (visual indicators)
```
0  = Open/Created
18 = Done (Finished/Cancelled/Discarded)
45 = Started/In Progress
```

### 7.8 Resource Types
```
kResourceTypeMachineGroupProdOrder = 2
kResourceProdOrderVc = 3
kResourceMonthProdOrder = 13
```

### 7.9 Invoice/Document Row Types
```
kInvoiceRowTypeNormal                    = 0   // Standard row
kInvoiceRowTypeStructuredItemComponent   = (varies)  // Component from recipe explosion
```

### 7.10 Location Types
```
Location.Type = 0   // Normal stock location
Location.Type = 1   // Production location (triggers auto-production from stock movements)
```

### 7.11 Window/Record States
```
Rs_normal  = 0   // Viewing mode
Rs_insert  = 1   // New record being created
Rs_update  = 2   // Existing record being edited
```

---

## 8. Cross-Module Integration Points

### 8.1 Inventory/Stock Module
- Productions consume and produce stocked items (UpdateInstock)
- Stock position updated (UpdatePosition) for location tracking
- Serial number availability checks (SerialNrAvail, SerialNrAvail2)
- FIFO valuation (ProdFillFIFO)
- Stock chronology enforcement
- Planned/future stock quantities (UpdatePlanned with Fut2ProdInVc, Fut2ProdOutVc, Fut2ProdOrderInVc, Fut2ProdOrderOutVc)
- Don't Allow Over-ship setting prevents consuming more than available
- Stock Movements can be created from Productions (StockMovFromPRDsm)
- Batch/Serial tracking (BatchTextVc) including consignment stock

### 8.2 General Ledger / Finance Module
- Automatic GL transaction generation (MakeTransFromProd, MakeTransFromProd2, MakeTransFromProdOperation)
- Multiple account configurations: Stock, WIP, Component Usage, Production Control, Stock Gain, Discarded
- Per-item-group account overrides
- Base currency conversion support
- Transaction row types (kTransactionRowTypeStock)
- Auto-transaction rows (AddTransAutoTransRows)

### 8.3 Fixed Assets Module
- Machine = Fixed Asset (AT2UnitVc.InventoryNr)
- Machine cost rates: IdleCost, RunCost (per hour)
- Machine objects (ProdObjects) inherited to production

### 8.4 Sales Module
- Production Order linked to Sales Order
- Production Plan driven by Sales Forecasts
- Output item cost price updated from production
- **Recipe explosion in Sales Documents**: Recipes are expanded into component rows in Invoices (`IVVc_ExplodeRecepy`), Sales Orders (`ORVc_ExplodeRecepy`), Quotations (`QTVc_ExplodeRecepy`), and Cash Invoices (`IVCashVc_ExplodeRecepy`)
- Component rows use `kInvoiceRowTypeStructuredItemComponent` row type
- `MotherArtCode` tracks parent item; `RecipeQuant` stores per-unit recipe quantity
- Quantity changes on parent item automatically propagate to component rows

### 8.5 Purchasing Module
- MRP generates Purchase Order Plans alongside Production Plans
- Purchase Item register provides lead times for component procurement
- **Recipe explosion in Purchase Orders**: `PUVc_ExplodeRecepy` / `PUVc_ExplodeRecepy2` expands recipes into PO rows
- Used in "Update stock from POS" workflow for automatic reordering

### 8.6 Quality Control
- `QualConFromProdDsm` creates Quality Control records from Productions
- `QualConFromProdOperationDsm` creates QC records from individual Production Operations
- `CreateQualConFromProd` function (commented out from auto-save but available as manual action)
- Standard Problems register used for discarded production reasons

### 8.7 Activities/CRM
- `CreateActFromProd` creates Activity records from Productions
- `CreateActFromProdOperation` creates Activity records from Production Operations
- Activities linked to productions via `ProdSerNr` field
- Production time registration through activities (`RegTimeProduction`, `RegTimeActivity`)
- **Multi-worker tracking**: Multiple Activities linked via RecordLinks; `RedistribueTime` equalizes concurrent work periods
- **Setup time registration**: Separate Activity Type for setup time (`SetupActType`)
- **Work cost calculation**: `OKAndAddWorkCost` converts Activity time into production cost via `WorkCostPerHour`
- `CalculateActivityCostTime` handles cross-day time calculation

### 8.8 Stock Depreciation (SDVc)
- Discarded productions (status 5) auto-create Stock Depreciation records
- SD records contain the discarded items with their cost
- Links created between Production and SD records

### 8.9 Item History
- `ProdUpdateItemHistory` records production events in item history
- Used for cost price tracking and audit trail

### 8.10 Budget Module (TBBUVc)
- `TBBUVc_ExplodeRecepy` explodes recipes into budget line components
- Categorises components by item type: Stocked (`BudStocked`), Service/Time (`BudTime`), Material (`BudMaterial`), Other (`BudOther`)
- Components tracked with `MotherArtCode` and `RecipeQuant`

### 8.11 Stock Movements and Auto-Production
- `CreateAutoProduction` (ProdFromStockMov.hal) automatically creates finished Productions when Stock Movements arrive at production-type locations (Location.Type=1)
- Uses `AutoProdVc` register to map source items to target items
- Handles multiple source items producing the same target product
- Only triggers when `ProdSettingsBlock.UpdProdInQtyFromStockMov=0`

### 8.12 Returns Module (RetVc)
- `RetVc_ExplodeRecepy` expands recipes into return document component rows
- Assigns purchase cost price from item InPrice

---

## 9. Nexa ERP Implications

### 9.1 Core Entities to Implement

1. **Recipe/BOM** -- Template entity with header + material rows (input/output). Support closing, versioning via LastChangeDate, sub-recipes, material tags, best-before calculations.

2. **Production Order** -- Work order entity with lifecycle (Created -> Released -> Started -> Finished/Cancelled). Machine queue management. Material reservations. Planned vs actual quantities.

3. **Production** -- Execution record. Support both simple (no routing) and routed production. Status lifecycle with auto-timestamping. Disassembly mode. Weight tracking.

4. **Production Operation** -- Per-step execution within routed production. Sequence/sub-sequence. Partial completion with child operation creation. Cascade cancellation.

5. **Routing** -- Sequence of operations template. Standard Operations. Machine/Machine Group validation.

6. **Production Plan** -- Period-based planning with MRP calculation. Component explosion. Approval workflow. Conversion to Production Orders.

7. **Production Plan Component** -- Auto-generated material requirements from approved plans.

### 9.2 Key Business Rules to Preserve

- **Status transitions are one-directional** (except Un-OK which requires special permission and reverses all effects)
- **RowsHoldActualQty** toggle: critical for how quantities are calculated -- per-unit vs absolute
- **Material tag mapping**: Links recipe rows to operation materials for routed production
- **Phantom items**: Plain items with recipes trigger recursive BOM explosion
- **Machine-item compatibility**: Validated through ProdItemVc register
- **Serial number enforcement**: Unique serial checking, batch splitting on serial entry
- **Cost roll-up**: Automatic machine cost calculation from run/idle times
- **Multi-output recipes**: RelVal (relative value) distributes cost across multiple outputs
- **Consignment stock**: Special account handling for consigned materials
- **Multi-worker concurrent production**: Multiple workers can work on same Production Order, tracked via Activity records
- **Work cost addition**: Activity time-tracking integrates with production cost via WorkCostPerHour
- **Discarded cost roll-up**: Costs from discarded productions are added to subsequent good productions
- **Recipe explosion in documents**: BOMs are used not just for production but also for Invoice/Order/Quote component explosion
- **Auto-production from stock movements**: Automatic production creation when materials arrive at production locations
- **Shift-aware scheduling**: Machine scheduling respects configured shift patterns
- **Setup time separate tracking**: Setup time tracked as separate Activity Type from production work time

### 9.3 Simplification Opportunities for Nexa

1. **Replace HAL status codes with named enums** -- e.g., `CREATED`, `STARTED`, `FINISHED`, `CANCELLED`, `DISCARDED` instead of 0, 2, 3, 4, 5 (note gap at 1)
2. **Modernise MRP** -- Replace array-based batch calculation with real-time demand netting using database queries
3. **Simplify queue management** -- Use a priority/sequence field rather than recursive position swapping
4. **Event-driven GL posting** -- Use event/webhook patterns instead of procedural transaction creation
5. **API-first operations** -- Expose production status changes, backflush, and plan creation as REST endpoints
6. **Drop DoneFlag/FinnishedFlag redundancy** -- HansaWorld maintains both `PRStatusFlag`, `DoneFlag`, and `FinnishedFlag` for backward compatibility. Nexa needs only a single status field.
7. **Dimensional items** -- UnitXval/UnitYval/UnitZval can be simplified or made optional
8. **UK-specific defaults** -- Default period type to monthly, integrate with UK working day calendars for scheduling

### 9.4 Features NOT to Carry Forward

- **Consignment stock in production** -- Complex edge case, defer to post-MVP
- **Base1ToBase2 currency conversion** -- Use modern multi-currency approach
- **ResourceMonitor integration** -- Build modern dashboard instead
- **WebNG production interfaces** -- N/A, Nexa has its own web UI

### 9.5 Additional Features to Consider

- **Real-time WIP tracking** -- HansaWorld's AutoCreateWIP is a good pattern to keep
- **Production dashboards** -- Machine utilisation, queue depth, throughput
- **Mobile-friendly operation recording** -- Shop floor workers marking operations complete via barcode scanning (the `RegTimeProduction` pattern)
- **AI-assisted planning** -- Demand forecasting, optimal batch sizing, scheduling optimisation
- **Audit trail** -- HansaWorld's UnOK history pattern (StoreUnOKHistory) should be preserved as immutable audit events
- **Recipe explosion in sales/purchase documents** -- BOM explosion in Invoices, Orders, Quotes is a valuable feature for UK SME manufacturers selling assembled goods
- **Work cost tracking** -- Activity-based time tracking with cost roll-up to production cost is essential for job costing
- **Maximum producible quantity calculation** -- The "MaxProd" pattern (calculating max qty from component stock) is useful for availability promises
- **Shift-aware scheduling** -- Production planning that respects machine working hours/shifts
- **Multi-worker support** -- Essential for factory floors where multiple workers share production tasks
- **Discarded cost allocation** -- Rolling scrap costs into good production costs for accurate unit costing

### 9.6 Production Plan Configuration Decision

HansaWorld supports two Production Plan modes (controlled by `AutoGenProd` setting):
- **Mode 0:** Plan generates Productions directly (simpler workflow)
- **Mode 1:** Plan generates Production Orders, which then generate Productions (more controlled workflow)

Nexa should implement Mode 1 (Plan -> Order -> Production) as the standard workflow, as it provides better traceability and approval gates. Mode 0 can be offered as a simplified option for smaller operations.

### 9.7 Recipe/BOM Scope Beyond Manufacturing

Recipes in HansaWorld serve multiple purposes beyond production:
1. **Manufacturing BOMs** -- input/output material definitions for production
2. **Structured item components** -- exploded into sales/purchase document rows
3. **Invoice recipes** -- separate recipes for invoicing (INVc.InvRecepy) that produce output items
4. **Stock Depreciation explosion** -- breaking down depreciated items into components
5. **Budget line explosion** -- expanding budget items into component-level budget rows

Nexa should consider this multi-purpose nature when designing the Recipe/BOM entity, ensuring it can serve both manufacturing and document explosion use cases.
