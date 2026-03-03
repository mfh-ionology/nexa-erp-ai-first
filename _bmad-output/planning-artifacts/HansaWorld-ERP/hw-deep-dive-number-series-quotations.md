# HansaWorld Number Series & Quotations — Deep-Dive Findings

> **Source**: HansaWorld HAL codebase (`legacy-src/c8520240417/`)
> **Date**: 2026-02-15
> **Purpose**: Extract requirements, business logic, and integration points for Nexa ERP architecture

---

## Part A: Number Series / Serial Numbers

### 1. Registers and Fields

#### 1.1 SerBalVc — Serial Number Balance

Tracks per-item, per-location, per-serial-number stock balance. This is the core inventory ledger for serialised items.

| Field | Type | Purpose |
|-------|------|---------|
| `ArtCode` | Code | Item/article code |
| `Location` | Code | Warehouse location |
| `SerialNr` | String | Serial number or batch number |
| `InQty` | Qty | Running balance quantity |
| `Position` | Code | Position/bin within location |

**Key file**: `hal/Tools/StockToolsSerialNr.hal` — `UpdateSerStock()` is the external function that creates/updates SerBalVc records across all transaction types.

#### 1.2 BatchTextVc — Batch Metadata

Extended batch information beyond the serial number itself.

| Field | Type | Purpose |
|-------|------|---------|
| `SerialNr` | String | Batch/serial number |
| `ArtCode` | Code | Item code |
| `BestBefore` | Date | Best-before/expiry date |
| `Dim1`–`Dim3` | String | Dimensional attributes |
| `ConsigStockFlag` | Integer | Consignment stock indicator |
| `Closed` | Integer | Batch closed flag |

**Key file**: `hal/Tools/SerialNrTool.hal` — `FindBatchBestBeforeDate()` retrieves best-before dates; `PasteBatchSerItems()` allocates serial/batch numbers during delivery creation.

#### 1.3 SerNrTrackBlock — Serial Number Tracking Settings (Global)

Defined in `amaster/datadef11.hal` (lines 753–758).

| Field | Type | Purpose |
|-------|------|---------|
| `GenSerNumber` | M4Int | Generation mode: 0 = manual entry, 2 = auto-generate with date format |
| `SerNrLength` | M4Long | Total length of auto-generated serial numbers |
| `BulkSerialNos` | M4Int | Enable bulk serial number ranges (e.g., "SN001-SN010") |
| `SerNrDateFormat` | M4Str(8) | Date portion format for auto-generation; valid chars: Y, M, D only |

#### 1.4 InternalSerialNrVc / InternalSerialNrConfigVc — Internal Serial Configuration

For internal asset tracking with maintenance schedules.

| Field | Purpose |
|-------|---------|
| `ProgType` | Programme type |
| `ProductCode` | Product code reference |
| `Init` | Initialisation flag |
| `Maint` | Maintenance schedule flag |
| `Months` | Maintenance interval in months |
| `FreeMaintDays` | Free maintenance period (days) |

**Key file**: `hal/Tools/InternalSerialNrTool.hal` — `InternalSerialNrVc_PasteMainItem()` copies configuration from InternalSerialNrConfigVc template to InternalSerialNrVc instance.

#### 1.5 SVOSerVc — Service/Warranty Serial Tracking

Referenced in `StockToolsSerialNr.hal` via external functions:
- `UpdateSVOSerStock()` — Updates service serial stock
- `UpdateSVOSerHist()` — Updates service serial history

Used for warranty period tracking and service order linkage.

#### 1.6 QualConVc — Quality Control Records

Linked to serial/batch numbers for inspection tracking.

| Field | Purpose |
|-------|---------|
| `SerialNr` | Serial/batch number |
| `ArtCode` | Item code |
| `OKFlag` | Inspection status (0 = pending, >0 = passed) |

**Key file**: `hal/Reports/SerNrItemStatusRn.hal` — `FindInspection()` checks for open QualConVc records.

#### 1.7 Item-Level Serial Flag

- `Item.SerNrf` — Boolean flag on the Item register determining whether the item uses serial number tracking
- Referenced throughout `StockToolsSerialNr.hal` as the gating condition for serial number processing

#### 1.8 Number Series Assignment

- `NextSerNr()` — External function generating the next sequential number for any register (Orders, Invoices, Quotations, etc.)
- `NextSerialNumber()` — External function generating the next serial number within a defined range
- `FirstInRange()` — External function extracting the starting serial from a bulk range string (e.g., "SN001" from "SN001-SN010")

### 2. Settings

#### 2.1 SerNrTrackBlock Validation Rules

From `hal/RActions/SerNrTrackBlockActions.hal`:

1. **When GenSerNumber = 2** (auto-generate):
   - `SerNrDateFormat` is **required** (error 1058 if blank)
   - `SerNrDateFormat` must contain only Y, M, D characters (error 43390)
   - `SerNrLength` must be >= length of `SerNrDateFormat` (error 43391)

2. **When GenSerNumber = 0** (manual): No additional validation

#### 2.2 Feature Flags

From `hal/Tools/sets_nts.hal`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `HasNumberSeries` | 26 | Enables Number Series module |
| `HasSerialNumbers` | 32 | Enables Serial Number tracking |

#### 2.3 Bulk Serial Numbers

When `SerNrTrackBlock.BulkSerialNos` is enabled:
- Users enter serial ranges like "SN001-SN010" on purchase receipt rows
- System expands the range via `FirstInRange()` and `NextSerialNumber()`
- Each serial in the range creates a separate `SerBalVc` record with quantity 1
- Implemented in `PurUpdateSerialNr()` (purchase receipts) — the primary entry point for bulk serials

### 3. Reports

#### 3.1 Serial Number History Report — `SerialNrHistRn()`

**File**: `hal/Reports/SerialNr.hal`

Comprehensive transaction history per item/serial number. Shows:
- Running balance (`totinq`) and forward quantity
- Date, transaction type, document number, customer, location, serial, quantity

**Transaction types searched** (in order):
1. `StockMovVc` — Stock movements
2. `ProdVc` — Production orders
3. `PUVc` — Purchase receipts
4. `RetVc` — Sales returns
5. `RetPUVc` — Purchase returns
6. `IVVc` — Invoices
7. `IVCashVc` — Cash invoices
8. `SHVc` — Shipments/deliveries
9. `SDVc` — Stock depreciation
10. `OffHireVc` — Rental off-hire
11. `InternMovVc` — Internal movements
12. `INTransferVc` — Inventory transfers
13. `DispatchVc` — Dispatches
14. `EasyRentDispVc` — Rental dispatches
15. `QualConVc` — Quality control
16. `WSVc` — Work sheets

**Filter parameters**: Item code range, serial number range, date range, location.

#### 3.2 Serial Item Rental Status Report — `SerialItemRentalStatusRn()`

**File**: `hal/Reports/SerNrItemStatusRn.hal`

Shows status of each rental serial item:

| Status | Condition | USetStr |
|--------|-----------|---------|
| On Hire | Active RentResVc with Done=0, within date range | 13027 |
| In Inspection | Open QualConVc with OKFlag=0 | 13031 |
| In Transit | Open InternMovVc with OKFlag=0 | 13028 |
| Available | None of the above | 13029 |
| Under Repair | RentINStatus = 1 | 13030 |

**Excluded items**: Blank serial numbers, terminated items (`Terminated != 0`), items with `RentINStatus = 2`.

### 4. Business Logic

#### 4.1 Serial Stock Update Procedures

All in `hal/Tools/StockToolsSerialNr.hal`. Each procedure follows this pattern:
1. Check `Item.SerNrf` flag — skip if item not serial-tracked
2. Read/create `SerBalVc` record for item + location + serial
3. Update quantity (positive for inbound, negative for outbound)
4. Optionally update best-before dates, batch status, service records

| Procedure | Transaction | Direction | Special Logic |
|-----------|------------|-----------|---------------|
| `PurUpdateSerialNr()` | Purchase receipt (PUVc) | Inbound (+) | Bulk serial expansion, best-before dates, position/bin, batch status, consignment stock |
| `SHUpdateSerialNr()` | Shipment/delivery (SHVc) | Outbound (−) | Position update, SVO service history |
| `IVUpdateSerialNr()` | Invoice (IVVc) | Outbound (−) | Credit note reversal (positive qty for credits), position update |
| `IVCashUpdateSerialNr()` | Cash invoice (IVCashVc) | Outbound (−) | Similar to IVUpdateSerialNr |
| `SDUpdateSerialNr()` | Stock depreciation (SDVc) | Outbound (−) | Batch status update |
| `RetUpdateSerialNr()` | Sales return (RetVc) | Inbound (+) | Batch status update |
| `RetPUUpdateSerialNr()` | Purchase return (RetPUVc) | Outbound (−) | Position update |
| `StockMovUpdateSerialNr()` | Stock movement (StockMovVc) | In/Out/Through | Multi-row: in-rows positive, out-rows negative; position tracking |
| `WSUpdateSerialNr()` | Work sheet (WSVc) | Outbound (−) | Service context |
| `ProdUpdateSerialNr()` | Production order (ProdVc) | Both | Input rows negative, output rows positive |
| `ProdOperationUpdateSerialNr()` | Production operation | Both | Operation-level serial tracking |

#### 4.2 Batch Best-Before Date Allocation

From `hal/Tools/SerialNrTool.hal`:

1. `FindBatchBestBeforeDate()` — Queries BatchTextVc by item + serial to retrieve `BestBefore` date
2. `PasteBatchSerItems()` — During shipment creation from orders:
   - Finds all SerBalVc records for the item at the specified location
   - Sorts by best-before date (FEFO — First Expired, First Out)
   - Allocates quantity from batches with earliest expiry first
   - Creates separate delivery rows per batch/serial number
3. `PasteBatchSerItems2()` — Variant for different contexts
4. `PasteBatchSerItems_DemandPosition()` — Position-aware allocation

#### 4.3 Rental Serial Number Lifecycle

From `hal/Reports/SerNrItemStatusRn.hal`:

1. **FindOnHire()** — Checks RentResVc records:
   - `Done == 0` (not completed)
   - `EndDate >= CurrentDate` or blank (still active)
   - `TransDate <= CurrentDate` (started)
   - Returns customer code + agreement number

2. **FindInspection()** — Checks QualConVc records:
   - `OKFlag == 0` (inspection not passed)
   - Loops by serial number key

3. **FindInTransit()** — Checks InternMovVc records:
   - `OKFlag == 0` (movement not completed)
   - Scans all rows for matching item + serial

#### 4.4 Consignment Stock

`UpdateBatchTextConsigStock()` in `StockToolsSerialNr.hal`:
- When a purchase receipt has `ConsigStockFlag` set on its rows
- Updates the corresponding `BatchTextVc.ConsigStockFlag`
- Allows tracking of stock owned by suppliers but held in the company's warehouse

### 5. Enums and Constants

From `amaster/haldefs.h`:

| Constant | Value | Context |
|----------|-------|---------|
| `F_SERIALNR` | 559 | Field ID for serial number on header |
| `F_ROWSERIALNR` | 1297 | Field ID for serial number on row |
| `F_SUPPSERIALNR` | 1672 | Supplier's serial number field |
| `kCostModelPerSerialNr` | 20 | Cost model: track cost per individual serial number |
| `PMsgVar_SerialNr` | — | Parameter message variable for serial number |

---

## Part B: Quotations

### 1. Registers and Fields

#### 1.1 QTVc — Quotation Register (Header)

Inferred from `hal/RActions/QTVcRAction.hal`, `hal/WActions/QTVcWAction.hal`, and `hal/Tools/QTVcWActionTool.hal`:

| Field | Type | Purpose |
|-------|------|---------|
| `SerNr` | Long | Quotation serial number (auto-assigned via NextSerNr) |
| `CustCode` | Code | Customer code |
| `Addr0`–`Addr3` | String | Customer address lines |
| `CustName` | String | Customer name |
| `QTDate` | Date | Quotation date |
| `ValidUntilDate` | Date | Expiry/validity date |
| `Rejected` | Integer | Status: 0=Open, 1=Rejected, 2=Accepted |
| `Closed` | Integer | Closed flag (0/1) |
| `OrderNr` | Long | Linked order number (−1 if none) |
| `PRCode` | Code | Project code |
| `CurncyCode` | Code | Currency code |
| `ExchRate` | Rate | Exchange rate |
| `ExchRate2` | Rate | Secondary exchange rate (dual base currency) |
| `SalesMan` | Code | Salesman code |
| `SalesGroup` | Code | Sales group |
| `Location` | Code | Warehouse location |
| `PriceList` | Code | Price list code |
| `PayDeal` | Code | Payment terms code |
| `Objects` | String | Dimension/object tags (e.g., cost centres) |
| `OurContact` | Code | Internal contact |
| `CustContact` | String | Customer contact person |
| `Probability` | Integer | Win probability (0–100) |
| `QTClass` | Code | Quotation classification |
| `ApprovalStatus` | Integer | Approval workflow status |
| `Region` | Code | Region code |
| `Language` | Code | Language code |
| `VATNr` | String | Customer VAT number |
| `FreightCode` | Code | Freight/shipping method |
| `RejectDate` | Date | Date of rejection/acceptance |
| `Comment` | Text | Internal comment |
| `ExternalComment` | Text | Comment visible on printed quotation |
| `ProformaOfficialSerNrSerie` | Code | Official numbering series for proforma |
| `Weight` | Decimal | Total weight (recalculated on save) |
| `RebatePerc` | Decimal | Overall rebate percentage |

#### 1.2 QTVc — Quotation Register (Row Fields)

| Field | Type | Purpose |
|-------|------|---------|
| `ArtCode` | Code | Item/article code |
| `Quant` | Quantity | Quoted quantity |
| `Price` | Decimal | Unit price |
| `BasePrice` | Decimal | Base (list) price before discounts |
| `vRebate` | Decimal | Row discount percentage |
| `Sum` | Decimal | Row total (Quant * Price * (1 − vRebate/100)) |
| `GP` | Decimal | Gross profit |
| `CostPrice` | Decimal | Cost price for GP calculation |
| `VATCode` | Code | VAT/tax code |
| `VATPerc` | Decimal | VAT percentage |
| `SerialNr` | String | Serial number (for serialised items) |
| `Objects` | String | Row-level dimension tags |
| `Spec` | Text | Row description/specification |
| `Unit` | Code | Unit of measure |
| `UnitFactor` | Decimal | Conversion factor for alternate units |
| `TaxTempl` | Code | Tax template code |
| `Recipe` | Code | Recipe/BOM code |
| `RecipeQty` | Quantity | Recipe output quantity |
| `Width`, `Height`, `Depth` | Decimal | Dimensional fields |
| `Weight` | Decimal | Row weight |
| `ItemGroup` | Code | Item group |
| `SupplCode` | Code | Supplier code |
| `DeliveryDate` | Date | Promised delivery date per row |

#### 1.3 QTSettBlock — Quotation Settings

Defined in `amaster/datadef4.hal` (lines 963–969).

| Field | Type | Purpose |
|-------|------|---------|
| `DefaultValidDays` | M4Long | Default validity period in days from QTDate |
| `ReqQTClass` | M4Int | Require quotation classification (mandatory) |
| `DisallowInvoicemorethanQuoted` | M4Int | Prevent invoicing more than quoted quantity |
| `ReqRejectDate` | M4Int | Require rejection/acceptance date |
| `RemoveRowswithZeroQuantity` | M4Int | Auto-remove rows with zero quantity on save |

#### 1.4 QuoteClassBlock — Quotation Classification

Defined in `amaster/datadef4.hal` (lines 1367–1373).

Matrix register with rows:

| Field | Type | Purpose |
|-------|------|---------|
| `Code` | M4Code(5) | Classification code |
| `Comment` | M4Str(60) | Description |

Used to categorise quotations (e.g., by product line, urgency, or source channel).

### 2. Settings

#### 2.1 Default Values on New Quotation

From `QTVcRecordDefaults()` in `QTVcRAction.hal`:

1. `SerNr = -1` (auto-assigned on save)
2. `OrderNr = -1` (no linked order)
3. `QTDate = CurrentDate`
4. `ValidUntilDate = CurrentDate + DefaultValidDays` (from QTSettBlock)
5. User defaults applied: `Objects`, `OurContact`, `Location`, `SalesMan`, `SalesGroup`
6. Currency exchange rates loaded from current settings
7. `ProformaOfficialSerNrSerie` set from user's default series

#### 2.2 Validation Rules on Save

From `QTVcRecordCheck()` in `QTVcRAction.hal`:

**Header-level checks**:
- Serial number uniqueness (kCheck_SerNr)
- Customer exists and is not blocked
- `ValidUntilDate >= QTDate`
- Currency code matches customer's currency (warning if mismatch)
- Location exists
- VAT number mask validation
- Salesman exists
- Objects/dimensions valid
- Project code exists (if specified)
- Credit management check (may warn/block)
- Quotation class required (if `ReqQTClass` enabled)
- Rejection date required (if `ReqRejectDate` enabled and Rejected != 0)

**Row-level checks**:
- Item code exists
- Quantity is valid
- VAT code exists and is valid
- Tax template exists (if specified)
- Recipe exists and is not closed (if specified)
- Minimum markup warning (if configured)

### 3. Reports

Quotation reports are referenced indirectly through the forms system. The main output is:

- **QTForm** — Quotation printout/PDF form, referenced in `CreateMailFromQTD()` for email attachment generation

Additional reporting is available through:
- Pipeline reports (via `kPipelineItemTypeQuotation = 2`)
- Open quotation indices (filtered by `Rejected != 0 or Closed != 0`)

### 4. Documents

#### 4.1 Quotation Form (QTForm)

Generated as PDF for:
- Printing
- Email attachment (via `CreateMailFromQTD()`)
- Customer-facing quotation document

#### 4.2 Email Generation

From `QTVcWActionTool.hal` — `CreateMailFromQTD()`:
- Creates a mail record (`MailVc`) linked to the quotation
- Attaches PDF form (QTForm)
- Uses `kMailQuotation = 5` mail type
- Opens mail window for review before sending

### 5. Business Logic

#### 5.1 Quotation Lifecycle

```
  [New] ──► [Open] (Rejected=0)
               │
               ├──► [Accepted] (Rejected=2, Probability=100)
               │        │
               │        ├──► [Convert to Order]
               │        ├──► [Convert to Invoice]
               │        ├──► [Convert to Budget]
               │        └──► [Convert to Production Order]
               │
               ├──► [Rejected] (Rejected=1, Probability=0)
               │
               └──► [Closed] (Closed=1)
```

**Status transitions** (from `QTDClassRejectedButtonAfter()` in `QTVcWAction.hal`):
- Accepting: Sets `Rejected = 2`, `Probability = 100`, `RejectDate = CurrentDate`
- Rejecting: Sets `Rejected = 1`, `Probability = 0`, `RejectDate = CurrentDate`

**Save-time actions** (from `QTVcRecordSave()` / `QTVcRecordSaveAfter()`):
- Weight recalculation across all rows
- Zero-quantity row removal (if `RemoveRowswithZeroQuantity` enabled)
- VAR items update
- SMS notification on acceptance (if configured)
- Planned payment creation on acceptance

#### 5.2 Quotation to Order Conversion

From `hal/WActions/QTDsm.hal` — `ORFromQTDsm()`:

**Pre-conditions**:
1. `Closed == 0`
2. `Rejected == 0` (open) or `Rejected == 2` (accepted)
3. `OrderNr <= 0` (no existing linked order)
4. Approval status passed (if approval workflow enabled)
5. Permission: `UserCanAction("QTToOrd")`

**Process**:
1. Calls `RecordAction_raPasteQTInOrder()` — copies header + rows to new ORVc
2. Creates record link between QTVc and ORVc
3. Sets `QTVc.OrderNr = ORVc.SerNr`
4. Opens the new order window

**List view variant**: `ORFromQTLsm()` — same logic, operates from list view.

#### 5.3 Quotation to Invoice Conversion

From `hal/WActions/QTDsm.hal` — `IVFromQTDsm()`:

**Pre-conditions**:
1. `Closed == 0`
2. `Rejected == 0` or `Rejected == 2`
3. Permission: `UserCanAction("QTToIV")`
4. `DisallowInvoicemorethanQuoted` setting enforced

**Process**: Creates IVVc from quotation header and rows.

#### 5.4 Quotation to Budget Conversion

From `hal/Tools/QTVcWActionTool.hal` — `CreateTBBUFromQTD()`:

- Creates a `TBBUVc` (project budget) record from quotation rows
- Sets `Rejected = 2` (accepted) on the quotation
- Links quotation to the project budget

#### 5.5 Quotation to Production Order

From `hal/Tools/QTVcWActionTool.hal` — `ProdOrderFromQT()`:

- Creates production orders for quoted items that have recipes/BOMs
- `DoUpdCstFromProdOrd()` — Reverse update: copies production order cost back to quotation cost price for GP accuracy

#### 5.6 Customer Paste Logic

From `PasteCustInQT()` in `QTVcWActionTool.hal`:

When a customer code is entered/changed on a quotation:
1. Copies customer address (Addr0–Addr3), name, contact
2. Sets payment terms (`PayDeal`) from customer record
3. Sets price list from customer's assigned price list
4. Sets currency from customer's currency
5. Sets VAT number from customer
6. Sets delivery address from customer's default delivery address
7. Sets freight code from customer
8. Sets salesman from customer's assigned salesman
9. Sets objects/dimensions from customer
10. Recalculates all row prices (`QTDUpdatePrices()`) if price list or currency changed

#### 5.7 Item Paste Logic

From `QTVc_PasteArtCode()` in `QTVcWActionTool.hal`:

When an item code is entered on a quotation row:
1. Looks up price from the quotation's price list, customer-specific pricing, and currency
2. Applies discount percentage
3. Sets VAT code from item or customer default
4. Sets tax template
5. Explodes recipe/BOM if item has a recipe
6. Applies project-specific pricing (if PRCode set)
7. Sets unit and unit factor
8. Sets cost price for gross profit calculation
9. Sets item group, supplier code, weight

#### 5.8 Serial Number on Quotation Rows

From `QTVc_PasteSerialNr()` in `QTVcWActionTool.hal`:

When a serial number is entered on a quotation row:
- Sets dimensions (Dim1–Dim3) from the batch record
- Sets cost price from serial-specific cost (for GP calculation)
- Validates serial number exists and is available

#### 5.9 Price Recalculation

From `QTDUpdatePrices()` in `QTVcWActionTool.hal`:

Triggered when customer, price list, or currency changes:
- Iterates all rows
- Re-looks up prices from the new price list
- Recalculates discounts
- Recalculates row sums and totals

#### 5.10 Duplicate Quotation

From `QTVcRecordDuplicate()` in `QTVcRAction.hal`:

- Resets: `SerNr = -1`, `OrderNr = -1`, `Rejected = 0`, `Closed = 0`
- Clears: `PRCode` (project)
- Refreshes: Currency exchange rates to current
- Recalculates: All row base prices at current rates

#### 5.11 Remove Quotation

From `QTVcRecordRemove()` in `QTVcRAction.hal`:

- Unlinks any associated order: sets `ORVc.QuoteNr = ""` for the linked order
- Deletes planned payment records associated with the quotation

#### 5.12 Planned Payments

On acceptance (`Rejected = 2`) during save:
- System creates planned payment records based on payment terms
- On removal or status change, planned payments are deleted/updated

#### 5.13 Approval Workflow

- `ApprovalStatus` field on QTVc header
- Checked during Quote-to-Order conversion (must be approved before conversion)
- Integrated with HansaWorld's general approval framework

#### 5.14 Open Quotation Index

From `QTVcRecordInIndex()`:
- Quotations excluded from the "OpenQuoteClass" index if `Rejected != 0` or `Closed != 0`
- This index drives the open quotations view and pipeline reports

### 6. Enums and Constants

From `amaster/haldefs.h`:

| Constant | Value | Context |
|----------|-------|---------|
| `ToolQuotations` | 2999 | Tool group identifier for quotations module |
| `kShopBaskDestinationQuote` | 2 | POS: Shopping basket destination = Quotation |
| `kPOSButtonTypeTransfertoQuotation` | 107 | POS button: Transfer to quotation |
| `kPOSButtonTypePasteQuotation` | 120 | POS button: Paste from quotation |
| `kMailQuotation` | 5 | Mail type for quotation emails |
| `kPipelineItemTypeQuotation` | 2 | Pipeline/CRM item type for quotations |
| `HasModQT` | 50 | Feature flag: Quotations module enabled |

**Rejected field enum** (inferred from code):

| Value | Meaning |
|-------|---------|
| 0 | Open |
| 1 | Rejected |
| 2 | Accepted |

---

## Cross-Module Integration

### Number Series / Serial Numbers — Cross-Module Touchpoints

| Module | Integration | Detail |
|--------|-------------|--------|
| **Purchasing** | PUVc (Purchase Receipts) | Serial numbers assigned at goods receipt; bulk serial expansion; best-before dates; consignment stock |
| **Sales** | SHVc (Shipments) | Serial allocated FEFO at delivery; SVO service history updated |
| **Sales** | IVVc / IVCashVc (Invoices) | Serial decremented; credit notes reverse the serial movement |
| **Inventory** | StockMovVc | Serial tracked for stock movements between locations; position/bin tracking |
| **Inventory** | SDVc (Stock Depreciation) | Serial decremented for write-offs |
| **Inventory** | SerBalVc | Core balance register per item/location/serial |
| **Manufacturing** | ProdVc | Input components' serials consumed; output product serial created |
| **Service/Rental** | RentResVc, RentINVc | Rental serial status (on hire, available, in transit, inspection) |
| **Service** | SVOSerVc | Warranty tracking, service history per serial |
| **Quality** | QualConVc | Inspection records per serial/batch; blocks availability until passed |
| **Returns** | RetVc / RetPUVc | Serial reinstated (sales return) or removed (purchase return) |
| **Quotations** | QTVc rows | Serial number on quotation rows sets dimensions and cost price for GP |
| **Cost Accounting** | kCostModelPerSerialNr=20 | Per-serial-number costing model |

### Quotations — Cross-Module Touchpoints

| Module | Integration | Detail |
|--------|-------------|--------|
| **Sales Orders** | ORVc | Quote-to-Order conversion; `QTVc.OrderNr` linked; `ORVc.QuoteNr` back-reference; record links created |
| **Sales Invoices** | IVVc | Quote-to-Invoice conversion; `DisallowInvoicemorethanQuoted` enforcement |
| **CRM/Pipeline** | Pipeline | `kPipelineItemTypeQuotation=2`; probability tracking; open quotation index |
| **Projects** | TBBUVc (Budget) | Quote-to-Budget conversion for project costing |
| **Manufacturing** | ProdVc | Quote-to-Production-Order for items with recipes; cost feedback to quotation |
| **POS** | Shopping Basket | Transfer basket to quotation (`kPOSButtonTypeTransfertoQuotation=107`); paste quotation into POS (`kPOSButtonTypePasteQuotation=120`) |
| **Email/Comms** | MailVc | PDF quotation emailed to customer (`kMailQuotation=5`) |
| **Finance** | Planned Payments | Created on acceptance; deleted on removal |
| **Pricing** | PriceList, Customer Prices | Multi-level price lookup: price list > customer-specific > base price; currency conversion |
| **Approval** | Approval Framework | Approval status gates conversion to order |
| **Serial Numbers** | SerBalVc, BatchTextVc | Serial on quotation rows for dimensions and cost price |
| **Credit Mgmt** | Customer Credit | Credit check during quotation validation |

---

## Nexa ERP Implications

### Number Series / Serial Numbers

1. **Core Serial Tracking Model**: Nexa must implement a `serial_balance` table equivalent to `SerBalVc` tracking quantity per item + location + serial. This is the single source of truth for serial/batch stock.

2. **Batch Metadata**: A `batch_metadata` table (equivalent to `BatchTextVc`) should store best-before dates, dimensional attributes, and consignment flags. FEFO allocation logic is essential for food/pharma verticals.

3. **Serial Number Generation**: Support both manual entry and auto-generation with configurable formats. The date-based prefix pattern (Y/M/D) with sequential suffix is common in UK manufacturing.

4. **Bulk Serial Ranges**: The ability to enter ranges (e.g., "SN001-SN010") and have them expanded automatically is a key usability feature for receiving goods. This should be a day-one feature.

5. **Per-Transaction-Type Update**: Every stock-affecting transaction (purchase receipt, shipment, invoice, return, stock movement, production, depreciation) must call a serial stock update routine. This suggests a **serial stock update service** that all transaction modules invoke.

6. **Quality Control Integration**: Serial/batch numbers must link to quality inspection records. Stock should be quarantined (unavailable for allocation) until inspection passes.

7. **Service/Warranty Tracking**: For UK SMEs selling equipment, serial-based warranty tracking (`SVOSerVc` equivalent) is valuable. Link serials to service orders and warranty periods.

8. **Cost Per Serial**: The `kCostModelPerSerialNr=20` cost model indicates Nexa should support per-serial costing as an option, useful for high-value items.

9. **Position/Bin Tracking**: Serial balance includes position within warehouse. This feeds into the broader warehouse management capability.

### Quotations

1. **Quotation Lifecycle**: Implement the Open/Accepted/Rejected/Closed state machine. The `Rejected` field with values 0/1/2 maps cleanly to an enum. Add `probability` for pipeline/CRM integration.

2. **Validity Period**: Auto-calculate `valid_until` from configurable `default_valid_days`. This is a simple but frequently used feature.

3. **Multi-Conversion Paths**: Quotations must convert to:
   - Sales Orders (primary path)
   - Sales Invoices (for simple sales without order stage)
   - Project Budgets (for project-based businesses)
   - Production Orders (for make-to-order items)

   Each conversion should create audit-trail links between documents.

4. **Prevent Over-Invoicing**: The `DisallowInvoicemorethanQuoted` setting protects against billing more than agreed. This is a key control for UK SMEs.

5. **Classification System**: Quotation classes enable reporting by category (product line, source channel, urgency). Nexa should support configurable classification taxonomies.

6. **Approval Workflow**: Gate conversions behind approval. This is particularly important for larger quotations or specific customer types.

7. **Customer Paste / Cascade**: When selecting a customer, cascade: address, payment terms, price list, currency, VAT, delivery address, freight, salesman, dimensions. This is standard ERP UX but must be comprehensive.

8. **Price Recalculation**: When customer, price list, or currency changes, all row prices must be recalculated. This is a common source of bugs — ensure atomic recalculation.

9. **POS Integration**: The POS-to-quotation and quotation-to-POS paths indicate Nexa should support retail quotation workflows (e.g., customer asks for a quote in-store, returns later to purchase).

10. **Pipeline/CRM Link**: Quotations feed the sales pipeline with `kPipelineItemTypeQuotation=2`. Nexa's CRM module should treat quotations as pipeline items with probability-weighted forecasting.

11. **Email with PDF**: One-click email of quotation PDF to customer is essential UX. Nexa should generate PDF from template and attach to email.

12. **Planned Payments**: On acceptance, create expected payment schedule from payment terms. This feeds cash flow forecasting.

13. **Duplicate with Reset**: Duplicate quotation must reset status fields (serial number, order link, rejected/closed flags) and refresh currency rates. This is a common workflow for repeat quotations.

### Shared Architectural Patterns

1. **Number Series Service**: Both serial numbers and document numbers (quotation SerNr, order number, invoice number) use the same `NextSerNr()` pattern. Nexa should implement a centralised **number series service** supporting:
   - Per-register-type sequences
   - Per-series sequences (official numbering series)
   - Configurable formats with date prefixes
   - Gap-free sequences (required for invoices in many jurisdictions)

2. **Record Linking**: HansaWorld uses record links between quotations, orders, invoices, and other documents. Nexa should implement a generic **document linking service** that maintains audit trails across document conversions.

3. **Feature Flags**: Both modules are gated by feature flags (`HasNumberSeries=26`, `HasSerialNumbers=32`, `HasModQT=50`). Nexa's modular architecture should support enabling/disabling modules per tenant.

4. **Permission Checks**: Conversion actions are gated by `UserCanAction()` checks (e.g., "QTToOrd", "QTToIV"). Nexa's RBAC must include action-level permissions, not just CRUD.

5. **Settings Blocks**: Both modules use dedicated settings blocks (`SerNrTrackBlock`, `QTSettBlock`) for module-level configuration. Nexa should implement per-module settings as part of the system configuration service.
