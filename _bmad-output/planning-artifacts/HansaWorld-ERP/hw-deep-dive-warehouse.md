# HansaWorld Warehouse Management -- Deep-Dive Findings

> **Source**: HAL codebase `legacy-src/c8520240417/hal/` -- all `RActions/`, `WActions/`, `Tools/`, `Maint/`, `Reports/`, `Documents/`, `Imports/` related to warehouse management, locations, positions, forklift queue, picking, and withholding tax certificates (WH prefix disambiguation).
>
> **Date**: 2026-02-15

---

## 0. Terminology Disambiguation -- "WH" Prefix

A critical finding: **the "WH" prefix in HansaWorld serves two completely different domains**:

| Prefix Pattern | Domain | Examples |
|---|---|---|
| `WHM*`, `MainWHMBlock` | **Warehouse Management** (physical warehouse) | WHMPickArea, WHMForkLiftSystem, WHMDeliveryArea |
| `WHCertificate*`, `WHCalcForm*`, `WHIT*`, `WHVE*`, `WHTax*` | **Withholding Tax** (finance/AP) | WHCertificateVc, WHITVc (WH Item Tax), WHVEVc (WH Vendor Entry) |

The files `WHCertificateRAction.hal`, `WHITVcRAction.hal`, `WHVEVcRAction.hal`, `WHCalcFormRAction.hal`, `WHTaxBlockWAction.hal`, and their documents are **withholding tax** features, NOT warehouse features. They are covered below in Section 10 for completeness but are primarily AP/Finance module concerns.

---

## 1. Registers

### 1.1 LocationVc -- Warehouse Location Register

**File**: `hal/RActions/LocationVcRAction.hal`

The core register for physical warehouses/stock locations.

**Fields identified from code**:
- `Code` -- unique location identifier (mandatory, validated)
- `Name` -- location name
- `Closed` -- closure flag (0=active; prevents closing if stock exists via `ItemStatusVc`)
- `Group` -- references `LocGrVc` (Location Group)
- `Objects` -- dimension tags for reporting
- `StockAcc` -- GL stock account override per location
- `Contact`, `Phone`, `Fax` -- contact information
- `Addr0..Addr4` -- address fields (with country-specific validation for PRT, LTU localisations)
- `RequirePos` -- flag indicating this location uses Position-based stock tracking
- `BranchID` -- branch identification

**WHM (Warehouse Management) fields stored on LocationVc** (migrated from MainWHMBlock):
- `WHMPalletArea` -- default pallet storage area code (references `LocAreaVc`)
- `WHMPickArea` -- default pick area code
- `WHMDeliveryArea` -- delivery staging area code
- `WHMDefPUPosCode` -- default Purchase/Goods Receipt conveyor position
- `WHMDefProdPosCode` -- default Production conveyor position
- `WHMWraperPosCode` -- wrapping station position
- `WHMDeliveryPosCode` -- delivery conveyor/outbound position
- `WHMForkLiftSystem` -- forklift integration mode (0=none, 1=partial, 2=full confirmation)
- `WHMAutOKStockMovements` -- auto-approve stock movements flag
- `WHMPickOrderPerArea` -- pick ordering strategy per area
- `WHMHighestPosCodeFirst` -- position search direction (0=lowest first, 1=highest first)
- `WHMDefPUVECode` -- default vendor for purchase operations
- `WHMExpressOrderClass` -- express order classification

**Indexes**: ActCode, ActName, ActBranchID, ActGroup, Classification (all exclude Closed records), Code (includes closed)

**Business Rules**:
- Cannot close a location that still has stock (checks `ItemStatusVc.Instock`)
- Cannot remove RequirePos flag if positions already exist (`PISVc` records)
- Some program types limit location count (e.g. `typOffice2` limited to 1 unless Value Pack 3 is active)
- Standard product limited to 2 locations with `HasMultiLocations` feature

### 1.2 PosVc -- Position Register (Bin/Shelf Positions)

**File**: `hal/RActions/PosVcRAction.hal`

Physical shelf/bin positions within a warehouse location.

**Fields**:
- `Code` -- position identifier (mandatory)
- `Location` -- parent location code (mandatory, references `LocationVc`)
- `LocArea` -- location area code (references `LocAreaVc`)
- `Status` -- position status: 0=Free, 1=Occupied/Used, 2=Reserved, 3=Error
- `Closed` -- closure flag
- `Comment` -- description
- `Height` -- maximum height capacity
- `Width` -- maximum width capacity
- `Depth` -- maximum depth capacity
- `PickOrder` -- picking sequence number (propagated to `PISVc` when changed)

**Indexes**: ActMainKey, ActComment, ActLocation, ActLocArea, ActHeight (Status=0, not closed), UsedMainKey, UsedComment, UsedLocation, UsedLocArea, UsedHeight (Status=1, not closed), Status, Location, LocArea, LocAreaStatus, MainKey

**Business Rules**:
- Position Code + Location must be unique
- Position Code + LocArea must be unique
- If LocArea demands pick order (`DemandPickOrder`), PickOrder must be >= 0
- Cannot remove a position if Status != 0 (i.e. occupied or reserved)
- Changing PickOrder propagates to all `PISVc` records at that position
- On duplicate: Code cleared, Status and Closed reset to 0

### 1.3 LocAreaVc -- Location Area Register

**File**: `hal/RActions/LocAreaVcRAction.hal`

Defines areas/zones within a warehouse (e.g. pick area, pallet area, delivery area).

**Fields**:
- `Code` -- area code (mandatory)
- `DemandPickOrder` -- flag requiring positions in this area to have a defined pick order

### 1.4 LocGrVc -- Location Group Register

**File**: `hal/RActions/LocGrVcRAction.hal`

Groups of locations for reporting/filtering purposes.

**Fields**:
- `Code` -- group code (mandatory)

**Business Rules**:
- Cannot remove a group if any Location references it

### 1.5 PISVc -- Position In Stock (Item-at-Position Ledger)

**Referenced extensively across**: `PositionTools.hal`, `MoveToPickAreaMn.hal`, `MoveEmptyPalletsMn.hal`, `INPosRn.hal`, `StockMovVcRAction.hal`, `SHVcRAction.hal`

Tracks stock quantities per item per position per location.

**Fields** (from usage):
- `ArtCode` -- item code
- `Position` -- position code
- `Location` -- location code
- `LocArea` -- location area
- `LeftQty` -- remaining quantity at position
- `Instock` -- current in-stock quantity
- `InStockMov` -- quantity in active stock movements
- `Variety` -- variety/variant code
- `PickOrder` -- picking sequence (synchronised from PosVc)

**Indexes**: Position, ArtCode, Location, LocPosition, LeftItem, LeftItemLoc, InstockItemLoc

### 1.6 ForkLiftVc -- Forklift Register

**File**: `hal/RActions/ForkLiftVcRAction.hal`

Physical forklift truck records.

**Fields**:
- `Code` -- forklift identifier (mandatory)
- `Comment` -- description
- `Closed` -- active/inactive flag
- `Mode` -- current operating mode (0=default, other values for picking mode)

**Indexes**: ActCode, ActComment, ActMode (all exclude Closed)

### 1.7 ForkLiftQueVc -- Forklift Queue Register

**File**: `hal/RActions/ForkLiftQueVcRAction.hal`, `hal/Tools/ForkLiftTool.hal`

The work queue for forklift operations -- the heart of automated warehouse operations.

**Fields**:
- `SerNr` -- auto-generated serial number
- `StockMovNr` -- linked stock movement number (-1 for manual entries)
- `SHNr` -- linked delivery/shipment number (-1 for non-delivery tasks)
- `QueType` -- 0=Manual/Picking, 1=Deliveries, 2=Stock movements (GR, Production, empty pallets)
- `Status` -- 0=Pending, 1=Sent to forklift, 2=In progress/Accepted, 3=Error, 10=Waiting for conveyor
- `Done` -- completion flag
- `Attempts` -- retry counter
- `QuePriority` -- priority level (1=default, 3=express, 5=express delivery)
- `FrLocation` -- from location
- `FrPosCode` -- from position
- `ToLocation` -- to location
- `ToPosCode` -- to position
- `ArtCode` -- item code
- `Quant` -- quantity
- `LocArea` -- location area
- `FullPallet` -- full pallet flag (1=full pallet)
- `ForkLift` -- assigned forklift code
- `ForkLiftSystemID` -- external system identifier (e.g. "NT7000")
- `Comment` -- description

**Indexes**: StockMovNr, Status, StatusQueType, QueTypeStatusSH, FrPosTypeStatus, SHNr, ForkLiftSystemID, ForkLift

### 1.8 ItemStatusVc -- Stock Status per Item per Location

Referenced across many files as the summary of stock levels per item per location.

**Key Fields** (from usage):
- `Location` -- location code
- `ArtCode` -- item code
- `Instock` -- quantity in stock
- `OrddOut` -- quantity ordered out (on sales orders)
- `POUnOKQty` -- un-approved PO quantity
- `Variety` -- variant

### 1.9 NT7000ConnVc -- Forklift System Connection Settings

**File**: `hal/WActions/NT7000Block.hal`

Configuration for the external forklift management system (NT7000).

**Fields**:
- `Location` -- warehouse location
- `NT7000ServerIP` -- server IP address
- `NT7000ServerPort` -- server port
- `MaxForkLiftForPickMode` -- maximum forklifts allowed in picking mode simultaneously

### 1.10 NT7000NumbersVc -- Forklift System Order Counter

**File**: `hal/RActions/ForkLiftQueVcRAction.hal`

Tracks orders sent to the NT7000 forklift system per location.

**Fields**:
- `Location` -- location code
- `OrdSentToNT7000` -- running count of orders sent

### 1.11 NT7000PickModeBlock -- Picking Mode State

**File**: `hal/WActions/ForkLiftOrders.hal`

Session state for an active picking session.

**Fields**:
- `ActiveSHNr` -- currently active shipment number
- `ActiveForkLiftQueNr` -- currently active queue entry number
- `PalletCnt` -- pallet counter for label printing
- `ForkLift` -- assigned forklift code

---

## 2. Settings

### 2.1 MainWHMBlock -- Warehouse Management Settings (per Location)

**File**: `hal/RActions/MainWHMBlockActions.hal`, `hal/WActions/MainWHMBlock.hal`

The central warehouse management configuration block. Fields are now stored on `LocationVc` (migrated via `LocationVcRecordImport`).

**Fields validated**:
- `Location` -- must reference valid `LocationVc`
- `PalletArea` -- must reference valid `LocAreaVc`
- `PickArea` -- must reference valid `LocAreaVc`
- `DeliveryArea` -- must reference valid `LocAreaVc`
- `DefPUPosCode` -- default goods receipt position (must exist and not be closed)
- `DefProdPosCode` -- default production position (must exist and not be closed)
- `WraperPosCode` -- wrapping station position (must exist and not be closed)
- `DeliveryPosCode` -- delivery output position (must exist and not be closed)

**ForkLift System toggle** (`WHMForkLiftSystem`):
- 0 = No forklift system
- 1 = Semi-automated (full pallets handled differently)
- 2 = Full confirmation mode (each operation must be confirmed before next)

### 2.2 MainStockBlock -- General Stock Settings

Referenced for `MainStock` (main/default location) configuration.

### 2.3 ConvLocationBlock -- Location Code Conversion

**File**: `hal/RActions/ConvLocationBlockActions.hal`

Used during multi-location conversion to rename location codes.

**Fields (row-based)**:
- `NewCode` -- new location code (mandatory, must not have existing history)

### 2.4 LocalMachineBlock -- Machine-Level Defaults

Referenced for `DefLocation` -- each client machine's default warehouse location.

### 2.5 Item-Level Warehouse Fields (on INVc)

Items carry warehouse-relevant fields used extensively:
- `LocArea` -- preferred storage area for the item
- `PickArea` -- preferred picking area
- `QtyonPallet` -- standard pallet quantity
- `PalletWidth`, `PalletHeight`, `PalletDepth` -- pallet dimensions
- `PalletsInPickArea` -- maximum pallets of this item in pick area
- `UnitCoefficient` -- unit conversion factor
- `SerNrf` -- serial number tracking flag

---

## 3. Reports

### 3.1 PickingListRn -- Picking List Report

**File**: `hal/Reports/PickingListRn.hal`

Generates a picking list for a specific delivery (shipment).

**Parameters**: Delivery number (f1)

**Logic**:
- Loops through `StockMovVc` records linked to the delivery (`FileName="SHVc"`)
- Filters out already-OK'd stock movements (`OKFlag==1`)
- Prints header with customer address, ship date, comment, ship mode, payment terms, freight number
- For each stock movement row: ArtCode, description, quantity, from-position (FrPosCode)
- Also finds items of type "Normal" from the delivery (SHVc rows without PosCode)
- Shows totals and signature lines for packages and actual weight

### 3.2 PositionsForSHRn -- Positions for Shipment Report

**File**: `hal/Reports/PositionsForSHRn.hal`

Shows all position assignments for shipments/deliveries.

**Parameters**: Shipment number range (f1), Order number range (f2), flags for OK'd/un-OK'd

**Logic**:
- Links through `StockMovVc` by FileName="SHVc"
- Shows Order number, Delivery number, position (ToPosCode), article code, and quantity

### 3.3 INPosRn -- Items at Positions Report

**File**: `hal/Reports/INPosRn.hal`

Lists items stored at specific positions.

**Parameters**: Item range (f1), Position range (f2), Location (f3), LocArea (f4), Item Group (f5), Item Classification (f6), Position status filter (flags[0]: 0=Free, 1=Occupied, 2=Reserved, 3=Error, 4=All)

**Output per row**: Position, Location, Item code + Variety, Serial number, Item name, InStockMov quantity, Instock quantity. Also shows serial number breakdown if item has serial tracking.

### 3.4 PositionHistRn -- Position History Report

**File**: `hal/Reports/PositionHistRn.hal`

Shows the history of goods receipt and stock movements for specific positions.

**Parameters**: Position range (f1), flags for PU history and StockMov history

**Logic**:
- For Purchase receipts (`PUVc`): scans by `ToPosCodeSerNr` index
- For Stock Movements (`StockMovVc`): scans by `FrPosCodeSerNr` index
- Also prints current items at position

### 3.5 PositionErrRn -- Position Error Report

**File**: `hal/Reports/PositionErrRn.hal`

Lists positions in Error status (Status=3).

**Parameters**: Position range (f1), LocArea (f2), Location (f3)

**Output**: Position code, LocArea, Comment, Height, plus items currently at the position

### 3.6 ForkLiftQueErrRn -- Forklift Queue Error Report

**File**: `hal/Reports/ForkLiftQueErrRn.hal`

Lists forklift queue entries in Error status (Status=3).

**Output**: SerNr, FrPosCode, ToPosCode, ForkLift assigned, ForkLiftSystemID

### 3.7 OrdersToForkLiftRn -- Orders to Forklift Report

**File**: `hal/Reports/OrdersToForkLiftRn.hal`

Shows current forklift queue for a specific forklift.

**Parameters**: Forklift number (f1), Location (f2)

**Uses**: `ForkLiftQueueArray` to build the array of pending queue entries

### 3.8 LocationRn -- Location List Report

**File**: `hal/Reports/Location.hal`

Simple list of warehouse locations with contact details.

**Parameters**: Location code range (f1), flags[0] to include closed

### 3.9 ItemLocationStatusRn -- Item Location Status Report

**File**: `hal/Reports/ItemLocationStatusRn.hal`

Detailed item stock status across locations with optional sales turnover history.

**Parameters**: Item range (f1), Location range (f2), months of sales history (long1), various flags for columns

**Output per item per location**: In stock, Min level, Monthly sales breakdown (up to N months), Average, Total sales, On order, PO quantity, Free stock, Unit price

### 3.10 IVPerLocRn -- Invoice Valuation per Location Report

**File**: `hal/Reports/IVPerLocRn.hal`

Detailed invoice analysis broken down by location. Complex multi-column report with customer, date, salesman, classification filters.

---

## 4. Maintenances

### 4.1 MoveToPickAreaMn -- Move Stock to Pick Area

**File**: `hal/Maint/MoveToPickAreaMn.hal`

Automatically creates stock movements to replenish pick areas.

**Parameters**: Item range (f1), Position (f2), Location (f3)

**Logic**:
1. Iterates through `PISVc` (items at positions) for the location
2. For each item, determines pick area (item's PickArea or location's WHMPickArea)
3. Skips items already in pick area, delivery area, pallet area, or on conveyors
4. Skips items without pallet dimensions
5. Checks if item already exists in the pick area (`FindItemAtPickArea`)
6. Limits pallets per item using `PalletsInPickArea`
7. Finds free position in pick area (`FindFreePositionInPickArea`) checking dimensions
8. Creates `StockMovVc` with `ToForkLiftQue=1` (auto-queue to forklift)
9. Handles serial numbers at positions

### 4.2 MoveEmptyPalletsMn -- Move Empty Pallets to Pallet Area

**File**: `hal/Maint/MoveEmptyPalletsMn.hal`

Consolidates empty pallets (single-item positions) to the designated pallet storage area.

**Parameters**: Position (f1), Location (f2)

**Logic**:
1. Requires a Pallet Area to be configured on the location
2. Finds positions with exactly 1 item and LeftQty=1 (empty pallet)
3. Verifies actual in-stock minus in-movement equals 1
4. Finds free position in pallet area respecting dimensions
5. Creates stock movements with `ToForkLiftQue=1`

### 4.3 MoveToPosMn -- Move Purchase Receipt Items to Positions

**File**: `hal/Maint/MoveToPosMn.hal`

Assigns items from a specific conveyor/intake position to free positions.

**Parameters**: PU number range (f1), Date range, Position (FirstAcc)

**Logic**:
1. Finds all PU (Purchase receipt) rows with matching PosCode
2. For each, finds a free position (Status=0, no existing PISVc records)
3. Creates stock movement from source position to free position

### 4.4 PositionCloseMn -- Mass Close/Open Positions

**File**: `hal/Maint/PositionCloseMn.hal`

Bulk open or close positions by range.

**Parameters**: Position range (f1), LocArea (f2), Location (f3), flags[0] (0=close, 1=open)

### 4.5 ConvToMultiLocationMn -- Convert to Multi-Location

**File**: `hal/Maint/ConvToMultiLocationMn.hal`

Converts a single-location system to multi-location. Creates weighted average price records per location.

### 4.6 RebuildStockMn / RecalcStockMn -- Stock Recalculation

Referenced across the codebase. Rebuilds `ItemStatusVc` records and updates positions (`UpdatePosition`).

### 4.7 STCompMn -- Stock Take Comparison

**File**: `hal/Maint/STCompMn.hal`

References `FindStockValueAtPosition` for position-level stock take comparisons. Handles serial numbers at positions.

---

## 5. Documents

### 5.1 PalletLabForm -- Pallet Label Document

**File**: `hal/Documents/PalletLabForm.hal`

Prints pallet labels for stock movements.

**Fields printed**:
- Barcode (Code39, EAN, EAN13) of stock movement number
- Item code and name
- Quantity on pallet
- Destination position (`ToPosCode`)
- Position height
- Stock area (`LocArea`)
- Supports label grids (1x1, 2x8, 3x8 layouts)

Also supports **delivery labels**: Order number, customer name/address, pallet count, items from forklift queue.

### 5.2 DoStockMovForm / DoStockMovInvForm -- Stock Movement Documents

Referenced in `hal/Documents/` -- prints stock movement details including From/To positions.

### 5.3 DoShpForm -- Shipment Form

**File**: `hal/Documents/DoShpForm.hal`

References PickingArea and picking order concepts for shipment documentation.

---

## 6. Business Logic and Workflows

### 6.1 Position Management Lifecycle

**File**: `hal/Tools/PositionTools.hal`

Position status transitions:
```
0 (Free) --> 1 (Occupied) --> 2 (Reserved) --> 3 (Error)
                          --> 0 (Free) [when emptied]
```

**SetPositionStatus** logic:
- Will NOT change status for special positions (PalletArea buffer, WraperPosCode, DeliveryPosCode, DefPUPosCode, DefProdPosCode)
- Setting to 0 (Free) only succeeds if `NothingLeftAtPosition` returns true (all PISVc.LeftQty = 0)
- Updates PosVc record with new status

**CheckPosition** -- validates if an item can be placed at a position:
1. Position must exist
2. Checks pallet Width vs position Width capacity
3. Checks pallet Height vs position Height capacity
4. Checks pallet Depth vs position Depth capacity
5. Adds existing items' dimensions at position (from PISVc + INVc.QtyonPallet) to check cumulative fit

### 6.2 Find Free Position Algorithm

**FindFreePositionInLocArea** priority:
1. First try: positions in the specified LocArea, Status=0, not closed, dimensions fit, skip special positions
2. Second try: any position with Status=0 across the location (excluding delivery area)
3. Fallback: if looking in delivery area, return the DeliveryPosCode

**FindFreePositionInLocArea_ExcludePositionFromArray** -- enhanced version:
- Excludes positions already assigned (Array of skip positions)
- Supports `HighestPosCodeFirst` toggle for search direction
- Excludes production and purchase conveyor positions
- Optional height filtering (`defposheight`)

### 6.3 Find Position With Item Algorithm

**FindPositionWithItem** -- locates where an item is stored:
1. If quantity equals full pallet (`QtyonPallet`), search in item's PickArea first, then elsewhere
2. If partial quantity, search PickArea first with exact quantity match
3. Then search elsewhere with exact quantity
4. Then search for not-full pallets in pick area
5. Then search for not-full pallets in item's LocArea
6. Excludes: DefPUPosCode, DefProdPosCode, WraperPosCode, delivery area positions

### 6.4 Forklift Queue Workflow

**File**: `hal/Tools/ForkLiftTool.hal`

**UpdateForkLiftQueue** -- triggered when stock movement is created:
1. If `ToForkLiftQue` is 0 or 100 (no-pallet items), skip
2. Require the destination location to have `RequirePos` enabled
3. Require both FrPosCode and ToPosCode to be set
4. Set QueType: 1 for deliveries (SHVc), 2 for other stock movements, 0 for manual picks
5. Check if source is a conveyor (DefPUPosCode or DefProdPosCode)
   - If other items already pending from same conveyor, set Status=10 (waiting)
   - Otherwise set Status=0 (ready)
6. Set priority: 1=default, 3=express
7. Determine FullPallet flag from item's QtyonPallet
8. Store in `ForkLiftQueVc`

**Queue Priority System**:
- Express (priority 3) entries processed first
- Within each priority: Manual picks (QueType=0) -> Deliveries (1) -> Stock movements (2)
- `MaxForkLiftForPickMode` limits concurrent picking operations

**FindNextToSendToForkLiftQue** flow:
1. Check if max forklifts in pick mode reached
2. Try Express queue (priority 3, Manual then Deliveries)
3. Try Other queue (Manual then Deliveries then Stock movements)

### 6.5 Picking Process (NT7000 Integration)

**File**: `hal/WActions/ForkLiftOrders.hal`

The picking process is driven through the `ForkLiftDriverWClass` window:

1. **Session Start**: `ForkLiftDriverWClassOnOpenWindow`
   - Determines active shipment via `FindSHNrForkLiftQueueArray`
   - Loads queue entries via `ForkLiftQueueArray` (up to 5 displayed at once)
   - Shows items with labels showing position codes, article codes, quantities

2. **Pick Order Selection**: `NT7000PickingOrder0..4`
   - Driver selects a queue entry
   - Must confirm previous entry before moving to next (in mode 2)
   - Updates `NT7000PickModeBlock` with active entry

3. **Quantity Confirmation**: `NT7000PickingConfirm`
   - Driver enters picked quantity
   - Remote call `NT7000PickingConfirmRemote` processes confirmation
   - Error codes: 1=invalid qty, 2=mismatch, 3=serial error, 4=position error

4. **Pallet Actions**:
   - `NT7000PickingTakePallet` -- take full pallet from position
   - `NT7000PickingGotoWraper` -- send pallet to wrapping station
   - `NT7000PickingGoOut` -- send to delivery area
   - `NT7000PickingPrintLabel` -- print pallet label, increment counter

5. **Session End**: `NT7000PickingFinish` -- marks picking as complete, resets state
6. **Cancel**: `NT7000PickingCancel` -- cancels active picking session

### 6.6 Barcode Scanning Integration

**File**: `hal/WActions/ForkLiftOrders.hal`

Two scanning interfaces:
- `ScanPalletBarCodePUWClass` -- scan pallets from purchase receipts
- `ScanPalletBarCodeProdWClass` -- scan pallets from production

Both call `ScanPalletBarCodeWClassStockMov` which:
1. Reads the stock movement by serial number
2. Validates it is un-OK'd and not yet queued
3. Sets `ToForkLiftQue=1` to trigger the forklift queue
4. Calls `MovePurchaseConveyour` or `MoveProductionConveyour` to physically trigger conveyor

### 6.7 Forklift Queue Status Tracking

**File**: `hal/RActions/ForkLiftQueVcRAction.hal`

`UpdateNT7000NumbBlock` maintains order counters:
- Status change 0->1 or 0->2: increment `OrdSentToNT7000`
- Status change 2->3 (error): decrement
- Status change 1->0 (cancel): decrement
- In ForkLiftSystem mode 2, QueType 0 (manual) entries are excluded from counter

### 6.8 Stock Movement Position Tracking

Stock movements (`StockMovVc`) carry position information per row:
- `FrPosCode` -- source position
- `ToPosCode` -- destination position
- `ToForkLiftQue` -- forklift queue flag (0=no, 1=queued, 3=express, 100=no-pallet)
- `ManualPick` -- manual picking flag
- `OKFlag` -- approval flag

**AssignDestPositionOnStockMov** -- auto-assigns destination positions to un-OK'd stock movements using `FindFreePositionInLocArea`.

**ForkLift_OKStockMovement** -- approves a stock movement from the forklift system, triggering actual stock updates.

### 6.9 Delivery-to-Position Flow

From `hal/Maint/CreateSHsFromSOsMn.hal` and `hal/RActions/SHVcRAction.hal`:
1. Sales Order generates Delivery (SHVc)
2. Delivery creates Stock Movements with position references
3. Stock Movements enter the Forklift Queue
4. Forklift operators pick items from positions
5. Items move through wrapping to delivery area
6. Delivery is confirmed (OKFlag set)

### 6.10 Stock Take with Positions

From `hal/RActions/StockTakeVcRAction.hal`:
- Stock take can be done at position level using `FindStockValueAtPosition`
- Compares PISVc quantities with counted quantities
- Handles serial numbers at positions

---

## 7. Enums and Constants

**File**: `amaster/haldefs.h`

### Picking List Picking Order
```
enum kPickingListPickingOrder:
  kPickingListPickingOrderDefault = 0
  kPickingListPickingOrderShelfCode = 1
```

### Withholding Tax Calculation (WH Tax -- Finance, not warehouse)
```
enum kWHTaxCalc:
  kWHTaxCalcMonthly = 0
  kWHTaxCalcPerPayment = 1
  kWHTaxCalcPerInvoice = 2
  kWHTaxCalcOnPurchaseInvoice = 3
  kWHTaxCalcYearly = 4
```

### ForkLift Queue Types (from code analysis)
```
QueType:
  0 = Manual/Picking
  1 = Deliveries (from SHVc)
  2 = Stock Movements (GR, Production, empty pallets)
```

### ForkLift Queue Status (from code analysis)
```
Status:
  0 = Pending (ready to send)
  1 = Sent to forklift system
  2 = In progress / Accepted by operator
  3 = Error
  10 = Waiting for conveyor clearance
```

### ForkLift Queue Priority (from code analysis)
```
QuePriority:
  1 = Default
  3 = Express
  5 = Express delivery (not clearly used)
```

### Position Status (from code analysis)
```
PosVc.Status:
  0 = Free (available)
  1 = Occupied/Used
  2 = Reserved (destination assigned)
  3 = Error
```

### ForkLift System Mode (from code analysis)
```
LocationVc.WHMForkLiftSystem:
  0 = No forklift system integration
  1 = Semi-automated (full pallets not shown in pick queue)
  2 = Full confirmation mode (must confirm each pick before next)
```

### ToForkLiftQue Flag on StockMovVc (from code analysis)
```
StockMovVc.ToForkLiftQue:
  0 = Not queued
  1 = Queued to forklift
  3 = Express queued
  100 = No-pallet item (skip automatic queue)
```

---

## 8. Cross-Module Integration

### 8.1 Sales/Delivery Module (SHVc)
- Deliveries generate Stock Movements with position codes
- `PositionsForSHRn` report links deliveries to positions
- Picking lists show positions for warehouse operators
- Forklift queue entries reference delivery number (SHNr)
- `CreateSHsFromSOsMn` generates deliveries with position assignments

### 8.2 Purchase/Goods Receipt Module (PUVc)
- Purchase receipts assign items to positions (PosCode on row level, ToPosCode)
- Barcode scanning at goods receipt triggers conveyor movement
- `MoveToPosMn` redistributes received items from intake position
- `PurLocMn`, `PurLocRn` -- purchase-per-location maintenance and reporting

### 8.3 Production Module (ProdVc, ProdOperationVc)
- Production output assigned to default production position
- Barcode scanning triggers production conveyor
- Production-origin stock movements enter forklift queue as QueType=2
- `ProdOperationVcRAction.hal` references `FindStockValue` by location

### 8.4 Stock Take Module (STVc)
- Position-level stock taking via `FindStockValueAtPosition`
- STCompMn handles comparison with serial numbers at positions
- Supports rebuilding stock from position data

### 8.5 Internal Transfers (INTransferVc)
- Inter-location transfers track positions at source and destination
- `INTransferRAction.hal` references LocationVc extensively

### 8.6 Returns (RetVc, RetPUVc)
- Customer returns assigned to positions
- Returns to supplier from positions
- Position codes on return document rows

### 8.7 Nominal Ledger
- Location-specific stock accounts (`LocationVc.StockAcc`)
- Stock valuation per location via `ItemStatusVc`

### 8.8 Item Register (INVc)
- Items carry warehouse config: LocArea, PickArea, QtyonPallet, pallet dimensions
- `PalletsInPickArea` controls pick area replenishment depth
- Item width/height/depth used for position fit checking

### 8.9 Serial Number Tracking (ItemHistVc)
- Serial numbers tracked at position level via `ItemHistVc.Position` index
- `FindSerialNrAtPosition` locates serial numbers in specific positions
- Position history includes serial number breakdown

---

## 9. Nexa ERP Implications

### 9.1 Must-Have for MVP (Inventory Module)

1. **Multi-Location Support**: LocationVc equivalent with code, name, address, contact, GL account override, closure flag, and location groups (`LocGrVc`).

2. **Position/Bin Management**: PosVc equivalent with code, location, area, status lifecycle (Free/Occupied/Reserved/Error), dimensional capacity (W x H x D), pick order, and closure. This is an advanced feature that many UK SMEs may not need day one but is essential for warehouse-heavy businesses.

3. **Location Areas/Zones**: LocAreaVc concept -- simple zone definitions within a location (pick area, pallet area, delivery area, etc.).

4. **Position-in-Stock Tracking (PISVc)**: Real-time tracking of which items are at which positions with quantities. This is the bridge between inventory and physical warehouse layout.

5. **Stock Movement with Position Tracking**: Stock movements must carry From-Position and To-Position per row, enabling full audit trail of item movement within a warehouse.

### 9.2 Should-Have (Phase 2 or Configurable)

6. **Pick Area Replenishment**: Automated logic to move stock from bulk storage to pick areas (`MoveToPickAreaMn`), respecting item pick area preferences and maximum pallets per item.

7. **Empty Pallet Management**: Consolidation of empty pallets to designated storage area.

8. **Picking Lists**: Delivery-driven picking lists with position references and quantity verification.

9. **Position History and Error Reporting**: Audit trail of goods receipt and stock movements per position. Error position reporting.

10. **Item Location Status Report**: Cross-location stock analysis with sales history, min levels, free stock, and purchase order quantities.

### 9.3 Nice-to-Have (Phase 3 or Premium Feature)

11. **Forklift Queue System**: The entire `ForkLiftQueVc` system with priority-based queue, status tracking, conveyor integration, and multi-forklift management. This is highly specialised and would be a premium warehouse management feature.

12. **External Forklift System Integration (NT7000)**: The NT7000 connection for automated forklift dispatch. Could be generalised as an API for warehouse automation systems.

13. **Barcode Scanning at Goods Receipt/Production**: Pallet barcode scanning to trigger conveyor movements and forklift queue entries.

14. **Pallet Label Printing**: Multi-format pallet labels with barcodes (Code39, EAN, EAN13), position assignments, and item details.

15. **Position Dimension Checking**: Automatic validation that items (by pallet dimensions) fit in a position, including cumulative checking of existing items.

### 9.4 Architecture Decisions for Nexa

- **Position tracking should be opt-in per location** (equivalent to `RequirePos` flag). Many UK SMEs have simple warehouses where position tracking adds unnecessary complexity.
- **The LocArea concept is lightweight and useful** -- it groups positions into functional zones without complex setup. Recommend implementing as a simple lookup.
- **Forklift queue is a separate bounded context** -- it should be an optional module or plugin, not core inventory. The queue system is essentially a task management system for warehouse operators.
- **PISVc is the critical data structure** -- it must be designed carefully as it is read/written on every stock transaction when positions are enabled. Consider denormalisation for read performance.
- **Pick order is important** -- warehouse operators need deterministic picking sequences. The `PickOrder` field on positions propagating to PISVc is an elegant approach.
- **Serial number tracking at positions** adds significant complexity. Consider whether this is needed for MVP or can be a later enhancement.

### 9.5 Key Differences from HansaWorld

- HansaWorld's forklift system is tightly coupled to a specific hardware vendor (NT7000). Nexa should define a **generic warehouse automation API** instead.
- The conveyor concepts (purchase conveyor, production conveyor, delivery conveyor, wrapper) are physical hardware integrations. Nexa should model these as configurable **workflow stages** rather than hardcoded conveyor types.
- HansaWorld stores WHM settings both in a block and on the LocationVc record (with migration logic). Nexa should use a clean **LocationWarehouseConfig** table or embed fields directly on Location.
- The `FullPallet` concept is important for warehouse efficiency. Nexa should support pallet-level vs piece-level operations as a first-class concept.

---

## 10. Withholding Tax Registers (WH Prefix -- Finance/AP Module)

**Included for completeness as these files were in the investigation scope. These belong to the AP/Finance module, NOT warehouse management.**

### 10.1 WHCertificateVc -- Withholding Tax Certificate

**Files**: `hal/RActions/WHCertificateRAction.hal`, `hal/WActions/WHCertificateVcWAction.hal`, `hal/Documents/DoWHCertificateForm.hal`, `hal/Documents/WHCertificateForm.hal`, `hal/Documents/WHCertificatePerForm.hal`

Certificate issued to vendors for tax withheld on payments.

**Fields**: SerNr (auto-generated), VECode (vendor), VEName, OPNr (outgoing payment number), OPRow, OPTransDate, OPRefStr, OPComment, CalcForm (calculation formula), CalcBase, TaxPrc (tax percentage), Amount, WHTax, WHTaxSerNr, WHTaxComment, PayMode, BankCurncy, Sign (user), UserName, Comment, LangCode, DocName

**Security**: Creation requires `CreatingWithholdingCertificates` permission. Editing requires `EditingWithholdingCertificates` permission.

**Documents**: Individual certificates and periodic summary certificates (quarterly) with monthly base breakdowns.

### 10.2 WHITVc -- Withholding Tax per Item (Tax Code)

**File**: `hal/RActions/WHITVcRAction.hal`, `hal/WActions/WHITVcWAction.hal`

Date-range-based tax rules per item/tax code.

**Fields**: ITCode (item tax code), StartDate (mandatory), EndDate, Closed, Comment

**Business Rules**: Date ranges cannot overlap for the same ITCode. Validates ITCode exists. Active index excludes closed records.

### 10.3 WHVEVc -- Withholding Tax per Vendor

**File**: `hal/RActions/WHVEVcRAction.hal`, `hal/WActions/WHVEVcWAction.hal`

Date-range-based tax rules per vendor with regional withholding support.

**Fields**: VECode (vendor code, mandatory), StartDate (mandatory), EndDate, Closed, Comment. Matrix rows with Region and WHTax fields.

**Business Rules**: Date ranges cannot overlap. Validates vendor exists. When `APAccBlock.PMControlWithTax=1`, validates regional withholding tax codes and payment modes.

### 10.4 WHCalcFormVc -- Withholding Tax Calculation Formula

**File**: `hal/RActions/WHCalcFormRAction.hal`

Defines calculation formulas for withholding tax.

**Fields**: PayCode (mandatory), Comment

### 10.5 WHTaxBlock -- Withholding Tax Settings

**File**: `hal/WActions/WHTaxBlockWAction.hal`

System-level withholding tax configuration with remote validation. Row-based with TaxCode, PayMode fields.

---

## 11. Import Specifications

### 11.1 ImportPosIn -- Position Import

**File**: `hal/Imports/ImportPosIn.hal`

Simple position import with 4 fields per row:
1. Position code
2. Location area
3. Height (string, converted to val)
4. Dummy/unused field

Hardcodes Location to "WHS". Processes 4 columns then advances to next line.

---

## 12. Summary of Key Records and Their Relationships

```
LocationVc (Warehouse)
  |-- LocGrVc (Group)
  |-- LocAreaVc (Area/Zone) [PalletArea, PickArea, DeliveryArea]
  |-- PosVc (Position/Bin)
  |     |-- PISVc (Position-in-Stock: Item x Position x Location)
  |     |     |-- ItemHistVc (Serial Number tracking at position)
  |     |-- Width, Height, Depth (capacity)
  |     |-- PickOrder (picking sequence)
  |-- ItemStatusVc (Item x Location stock summary)
  |-- ForkLiftVc (Forklift trucks)
  |-- ForkLiftQueVc (Work queue)
  |     |-- Links to StockMovVc, SHVc
  |     |-- Status lifecycle: Pending -> Sent -> InProgress -> Done/Error
  |-- NT7000ConnVc (Forklift system connection)
  |-- NT7000NumbersVc (Order counters)

INVc (Item)
  |-- LocArea (preferred storage area)
  |-- PickArea (preferred pick area)
  |-- QtyonPallet, PalletWidth/Height/Depth
  |-- PalletsInPickArea

StockMovVc (Stock Movement rows)
  |-- FrPosCode, ToPosCode per row
  |-- ToForkLiftQue flag
  |-- ManualPick flag
```
