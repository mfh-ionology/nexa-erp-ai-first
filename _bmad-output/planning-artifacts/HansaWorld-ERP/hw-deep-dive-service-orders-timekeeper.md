# HansaWorld Service Orders & Timekeeper — Deep-Dive Findings

> **Source**: HAL codebase (`legacy-src/c8520240417/`) + HansaManuals v8.5
> **Date**: 2026-02-15

---

## Part A: Service Orders

The Service Orders module (internally abbreviated **SVO**) manages the complete lifecycle of repair/service jobs. Each repair job is a separate Service Order record that tracks items, warranty status, technician assignment, spare parts, labour, and invoicing.

### 1. Registers and Fields

#### 1.1 SVOVc — Service Order Register

The core register. Defined in `amaster/datadef5.hal` line 566.

**Header Fields:**

| Field | Type | Size | FK/Lookup | Purpose |
|-------|------|------|-----------|---------|
| SerNr | M4Long | - | - | Auto-generated serial number (primary key) |
| TransDate | M4Date | - | - | Transaction/creation date |
| PlanShip | M4Str | 10 | - | Planned delivery (week number or date, per PlanDeliveryBlock.FieldType) |
| PlanShipDate | M4Date | - | - | Planned delivery as proper date |
| CustCode | M4Code | 20 | CUVc | Customer code |
| Addr0..Addr3 | M4Str | 60 | - | Customer address lines |
| ShipAddr0..ShipAddr3 | M4Str | 60 | - | Delivery address lines |
| InvAddr3, InvAddr4 | M4Str | 60 | - | Invoice address lines |
| DelAddr3, DelAddr4 | M4Str | 60 | - | Delivery address (extra) |
| DelAddrCode | M4Code | 20 | - | Delivery address code |
| InvoiceToCode | M4Code | 20 | CUVc | Bill-to customer (if different) |
| OurContact | M4Str | 20 | - | Internal contact person |
| CustContact | M4Str | 60 | - | Customer contact person |
| ExportFlag | M4Int | - | - | VAT zone (domestic/EU/export) |
| PayDeal | M4Code | 3 | - | Payment terms code |
| Objects | M4UStr | 60 | ObjVc | Cost objects / tags |
| ShipMode | M4Code | 5 | - | Shipping mode |
| ShipDeal | M4Code | 5 | - | Shipping terms |
| Sign | M4Code | 10 | UserVc | Record creator signature |
| SalesMan | M4Code | 10 | UserVc | Assigned salesperson/technician |
| SalesGroup | M4Code | 5 | SalesGroupVc | Sales group (auto from SalesMan) |
| LangCode | M4Code | 5 | - | Language code |
| Comment1..Comment4 | M4Str | 100 | - | General comments (4 lines) |
| CustComplaint1..4 | M4Str | 100 | - | Customer complaint description |
| TechComment1..4 | M4Str | 100 | - | Technician comments |
| Note1..Note4 | M4Str | 100 | - | Additional notes |
| TechnicianID | M4Str | 20 | - | Technician identifier |
| OrderClass | M4Code | 5 | - | Service order classification |
| CustOrdNr | M4Str | 60 | - | Customer's own order number |
| InclVAT | M4Int | - | - | Prices include VAT flag |
| TotCost | M4Val | - | - | Total cost value |
| TotPrice | M4Val | - | - | Total sales price |
| CustVATCode | M4Code | 10 | VATCodeBlock | Customer VAT code |
| VATNr | M4Str | 20 | - | VAT registration number |
| Phone | M4PhoneNo | 20 | - | Phone number |
| Fax | M4Str | 20 | - | Fax number |
| DoneMark | M4Mark | - | - | Completed flag (0=open, 1=done) |
| InvFlag | M4Int | - | - | Invoice status flag |
| InvMark | M4Mark | - | - | Invoice created flag |
| WOMark | M4Mark | - | - | Work Order created flag |
| WSMark | M4Mark | - | - | Work Sheet created flag |
| CustCat | M4Code | 5 | - | Customer category |
| PriceList | M4Code | 20 | PLDefVc | Price list |
| RebCode | M4Code | 5 | - | Rebate/discount code |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Currency code |
| FrRate, ToRateB1, ToRateB2, BaseRate1, BaseRate2 | M4Rate | - | - | Exchange rates (multi-currency) |
| QualConSerNr | M4Long | - | QualConVc | Linked quality control record |
| Region | M4Code | 20 | RegionVc | Region |
| BranchID | M4Code | 20 | CUVc | Branch ID |
| ServLocation | M4UStr | 10 | LocationVc | Service location |
| RegDate | M4Date | - | - | Registration date (auto-set on first save) |
| RegTime | M4Time | - | - | Registration time (auto-set on first save) |
| ConfirmationNo | M4Str | 20 | - | Confirmation number |
| SupplierReviewFlag | M4Mark | - | - | Flagged for supplier review |
| InvCountry | M4Code | 5 | - | Invoice country |
| DelCountry | M4Code | 5 | - | Delivery country |
| CustTaxTemplateCode | M4Code | 10 | TaxTemplateVc | Tax template |
| RecipientGLN | M4Str | 20 | - | Recipient GLN (EDI) |
| DelRecipientGLN | M4Str | 20 | - | Delivery recipient GLN |

**Row/Line Fields (Matrix):**

| Field | Type | Size | FK | Purpose |
|-------|------|------|----|---------|
| stp | M4Int | - | - | Row step/sequence |
| ArtCode | M4Code | 20 | INVc | Item/article code |
| Quant | M4UVal | - | - | Quantity |
| Cost | M423Val | - | - | Cost price |
| Price | M4Val | - | - | Sales price |
| SalesAcc | M4Code | 10 | AccVc | Sales account |
| WOSerNr | M4Long | - | - | Linked Work Order serial number (-1 = none) |
| WOEnum | M4Long | - | - | Work Order enum |
| Objects | M4UStr | 60 | ObjVc | Cost objects per line |
| Spec | M4Str | 100 | - | Specification/description |
| VATCode | M4Code | 10 | VATCodeBlock | VAT code |
| SerialNr | M4Str | 60 | - | Serial number of serviced item |
| WOMade | M4UVal | - | - | Work Order quantity made (read-only) |
| Invd | M4UVal | - | - | Invoiced quantity (read-only) |
| MaxCost | M423Val | - | - | Maximum cost allowed |
| ItemType | M4Set | 31 | - | Invoicing type (0=Plain, 1=Invoiceable, 2=Warranty, 3=Contract) |
| PlanShiprw | M4Str | 10 | - | Row-level planned delivery |
| StandProblem | M4Code | 20 | StandProblemVc | Standard problem code |
| MotherNr | M4Str | 30 | - | Parent serial number (for sub-assemblies) |
| ContractNr | M4Long | - | - | Linked contract number |
| ItemKind | M4Set | 457 | - | Item kind (0=Main Item, 1=Sub-item) |
| StdProblemMod | M4Code | 20 | StdProblemModVc | Standard problem modifier |
| DiagnosticCode | M4Str | 100 | - | Diagnostic code |
| TaxTemplateCode | M4UStr | 60 | TaxTemplateVc | Row-level tax template |
| SecondarySerialNr | M4Str | 60 | - | Secondary serial number (e.g., IMEI) |
| AlternateDeviceID | M4Str | 30 | - | Alternate device identifier |
| MotherSecondarySerialNr | M4Str | 60 | - | Parent's secondary serial |
| MotherAlternateDeviceID | M4Str | 30 | - | Parent's alternate device ID |

**Index Keys:** SerNr (primary), CustCode, InvFlag, Name (Addr0), OrderClass, TransDate, CustOrdNr, WOMark, PlanShip, WSMark, SalesMan, PlanShipDate. Each key also supports SalesGroup and SalesMan filtering for access control.

#### 1.2 WOVc — Work Order Register

Defined in `amaster/datadef5.hal` line 766. Instructions to technicians for specific repair tasks.

**Header Fields:**

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | M4Long | Auto-generated serial number |
| SVOSerNr | M4Long | Parent Service Order number |
| CustCode | M4Code(20) | Customer code |
| Addr0 | M4Str(60) | Customer name |
| TransDate | M4Date | Date |
| PlanDate | M4Str(10) | Planned date |
| PlanWork | M4Str(10) | Planned work time |
| OurContact | M4Str(20) | Internal contact |
| CustContact | M4Str(60) | Customer contact |
| Objects | M4UStr(60) | Cost objects |
| Sign | M4Code(10) | Creator |
| CustOrdNr | M4Str(60) | Customer order number |
| Closed | M4Int | Status: 0=Open, 2=In Progress, 3=Closed |
| Done | M4Mark | Completed flag |
| EMCode | M4Code(10) | Assigned employee/technician |
| EMName | M4Str(60) | Employee name |
| Phone, Fax | - | Contact details |
| LangCode | M4Code(5) | Language |
| Comment1..4 | M4Str(100) | Comments |
| VATNr | M4Str(20) | VAT number |
| CustVATCode | M4Code(10) | Customer VAT code |
| InvoiceToCode | M4Code(20) | Bill-to customer |
| Prntdf | M4Int | Print flag |
| SalesGroup | M4Code(5) | Sales group |
| CurncyCode + rates | - | Currency handling |
| RegDate, RegTime | - | Registration timestamp |

**Row Fields:** stp, ArtCode, Quant, Objects, Spec, SerialNr, PlanWork, VARList, MaxCost, ItemType, PlanShiprw, ContractNr, StandProblem, VATCode.

**Index Keys:** SerNr (primary), SVOSerNr, CustCode, Name, EMCode, PlanDate, CustOrdNr, Closed, TransDate. Filtered by SalesGroup + EMCode.

#### 1.3 WSVc — Work Sheet Register

Defined in `amaster/datadef5.hal` line 879. Technicians record labour hours and spare parts used.

**Header Fields:** SerNr, WONr (Work Order link), TransDate, EMCode (employee), EMName, CustCode, Addr0, OKFlag (approved), InvFlag (invoiced), CustContact, Sum0..Sum4 (summary values), Objects, Phone, Fax, Sign, InvoiceToCode, Comment1..4, Location, CustCat, PriceList, RebCode, LangCode, ExportFlag, CustVATCode, InclVAT, ArtCode, SerialNr, Spec, MaxCost, PrelOK, SVONr (Service Order link), LocOKNr, SalesGroup, CurncyCode + rates, ACShort, CostAcc, Invalid, InvalidDate, UpdStockFlag, CustTaxTemplateCode, TaxMatrix.

**Row Fields:** stp, ArtCode, Quant, Price, Sum, vRebate, SalesAcc, Objects, BasePrice, Spec, VATCode, Recepy, SerialNr, ovst, Invd, VARList, ItemType, QtyInvbl, MotherNr, FIFO, FIFORowVal, Coefficient.

#### 1.4 WSIVVc — Work Sheet Transaction Register

Defined in `amaster/datadef5.hal` line 2317. Detailed invoicing specifications per service line.

**Fields:** SerNr, TransDate, Type (1=Contract, 2=Invoiceable, 3=Warranty, 4=Other), Row, ArtCode, CUCode, EMCode, UsedQty, Price, Discount, Sum, InvQty, InvNr (linked invoice), Markup, Comment, ItemType, GP (gross profit), CostPrice, MotherNr, WONr, InvoiceTo, SVONr, SerialNr, Coefficient, ContractNr, CurncyCode + rates, RecType (0=WorkSheet, 1=Activity, 2=ReturnGoods), WSNr, RegTime.

#### 1.5 SVOSerVc — Known Serial Number Register

Defined in `amaster/datadef5.hal` line 1276. Tracks serialized items and their warranty status.

**Fields:** SerialNr, ItemCode, ItemName, CustCode, CustName, SalesPrice, CostPrice, SoldDate, WarrantyUntil, MotherNr, VECode (supplier), Contract, ChildCONr, WarrantyStatus, CoverageStartDate, EstimatedPurchaseDate, GlobalWarranty, OnsiteStartDate, OnsiteEndDate, PurchaseCountry, RegistrationDate, ImageURL, ExplodedViewURL, ManualURL, ProductDescription, ConfigDescription, SLAGroupDesc, PowerTrainFlag, TriCareFlag, EcorathFlag, ContractCoverageEndDate, ContractCoverageStartDate, ContractType, LaborCovered, LimitedWarranty, PartCovered, CSCode, CSType, Personalized, LastGSXQuery, WarrantyRefNo, CoverageEndDate, APPAgreementNumber, APPTotalFromOrder, APPCoverageDurationStatement, SecondarySerialNr, AlternateDeviceID.

**Row Fields (Parts):** PartNumber, PartWarranty, CoverageRefNo, PartError, StockPrice, ExchangePrice, EEECode, IsSerialized, LaborTier, PartDescription, PartType, ComponentCode, OriginalPartNumber.

**Index Keys:** MainKey (SerialNr+ItemCode), ItemCode, ItemName, CustCode, CustName, MotherNr, VECode.

#### 1.6 SVOSerHistVc — Serial Number History

Defined in `amaster/datadef5.hal` line 1370. Audit trail per serialized item.

**Fields:** ItemCode, SerialNr, FileName (register name), TransNr, Date, CustCode, VECode.

#### 1.7 SVOTextVc — Serial Number Notes

Defined in `amaster/datadef5.hal` line 1398. Free-text notes attached to serial numbers.

**Fields:** ArtCode, SerialNr, rows of Spec (text lines).

#### 1.8 SVGMVc — Service Stock Transaction Register

Defined in `amaster/datadef5.hal` line 1413. Records movement of repair items in/out of workshops.

**Header Fields:** SerNr, TransDate, EMCode, EMName, CustCode, Addr0, CustContact, SVONr (linked Service Order), OKFlag, SumCostVal, SumSalesVal, SumQuant, Comment1..4, CurncyCode + rates, LangCode.

**Row Fields:** ArtCode, InQuant, OutQuant, VARList, Spec, CostPrice, SalesPrice, SerialNr, PlanShiprw, SoldDate, WarrantyUntil, Location, MotherNr, VECode, Contact.

#### 1.9 StandProblemVc — Standard Problems Register

Defined in `amaster/datadef5.hal` line 1254. Predefined common service issues.

**Fields:** Code, ShortDesc, Comment1..3, Classification (list field for categorisation).

#### 1.10 StdProblemModVc — Standard Problem Modifiers

Defined in `amaster/datadef11.hal` line 1908. Modifiers that refine standard problem classifications.

**Fields:** Code, Comment.

### 2. Settings

#### 2.1 SVOAccBlock — Account Usage Service Orders

Defined in `amaster/datadef5.hal` line 2891.

| Setting | Type | Purpose |
|---------|------|---------|
| SalesAcc | M4Code(10) | Default sales account |
| StockAcc | M4Code(10) | Default stock account |
| ServiceAcc | M4Code(10) | Default service account |
| SVOText | M4Int | Control serial number text handling |
| InvoiceSVO | M4Int | Invoice mode for service orders |
| WSHeaderObjectOnSVOIV | M4Int | Copy WS header objects to SVO invoices |
| WSUpdStockFlag | M4Int | Auto-update stock on WS approval |
| AllowOneMainItem | M4Int | Restrict to one main item per SVO |

#### 2.2 GSXSettingsBlock — Apple GSX Integration

Defined in `amaster/datadef11.hal` line 392. For Apple Authorized Service Providers.

**Fields:** AppleID, Password, AccountNo, SessionID, InstanceID, SessionCreatedDate/Time, LiveFlag, ShipToAccount, RegionCType, PartsAutoUpdate, AppleItemCode, AutoEnrollmentInterval, GroupInvoicing, POCDeliveryPreference.

#### 2.3 Other Settings (from documentation)

- **Number Series** (separate for Service Orders, Service Stock Transactions, Work Orders, Work Sheets)
- **Order Classes** — categorise service orders
- **Standard Problems** + **Standard Problem Modifiers** — predefined fault codes
- **Replaced Items** — track substitutions
- **Serial Number Text** — label conventions
- **Planned Delivery** — schedule configuration with FieldType (0=text, 1=date, 2=week nn, 3=week yynn)
- **Batch Quality Settings / Classification Types** — quality control integration
- **Locations** — service workshop locations
- **Payment Terms** — payment conditions
- **Stock Settings** — inventory configuration
- **Info in Customer Status Report** — report configuration

### 3. Reports

From HAL source files and documentation:

| Report | HAL File | Purpose |
|--------|----------|---------|
| Service Order Status | `SVOStaRn.hal` | Comprehensive SVO status showing WO, WS, activities, invoices, POs, dispatches, off-hires, and WSIV transactions per SVO |
| Service Order List | `SVOList.hal` | List of service orders with filtering by status, WO status, standard problems |
| Service Stock Item History | `SVOItemR.hal` | Item-level history across service stock transactions |
| Service Order Employee Statistics | `EmpSVOStat.hal` | Employee performance metrics from work sheets and time sheets |
| Service Stock Report | `SVOStock.hal` | Detailed SVO data including contacts, comments, objects, VAT info |
| Outstanding Service Orders | (via SVOList filters) | Open/incomplete orders |
| Serial Number History | `SERSerialRn` (referenced) | History of a specific serial number across all registers |
| Work Order Journal | (in WO module) | Work order transactions |
| Work Sheet Journal | (in WS module) | Work sheet records |
| Work Sheet Transactions | (WSIV reporting) | Detailed transaction-level data |
| Customer Status (CustPS2Rn) | Referenced from SVO | Customer purchase/service statistics |
| Batch Quality Control Results/Tests/Reclamations | (QualCon integration) | Quality control outcomes |

### 4. Documents

| Document | HAL File | Purpose |
|----------|----------|---------|
| Service Order Form | `SVOForm.hal` + `DoSVOForm.hal` | Printable service order document. Loops through SVOVc records by serial range and calls `RecordActionSVO_Print` |

### 5. Business Logic

#### 5.1 Service Order Lifecycle

1. **Creation**: `SVOVcRecordDefaults` sets TransDate=today, SerNr=-1 (auto), copies current user's SalesMan/Objects/OurContact/ServLocation, loads currency rates, initialises all status flags to 0/false.

2. **Customer Paste**: `PasteCUInSVO` copies customer data (address, VAT, payment terms, price list) when CustCode is entered. Supports BranchID and InvoiceToCode relationships.

3. **Item Entry**: `SVOVc_PasteArtCode` fills item details, pricing. `SVOVc_PasteQuant` recalculates. Serial numbers trigger `SVO_PasterSerialNr` which looks up `SVOSerVc` for warranty data.

4. **Validation** (`SVOVcRecordCheck`):
   - Requires CustCode to exist
   - Validates PayDeal (no credit/employee types allowed)
   - Validates Objects (cost objects)
   - Checks currency rates
   - Validates all row ArtCodes exist and are not structured items (ItemType==2)
   - Validates ContractNr per row matches customer
   - Validates SerialNr is not blank for main items (ItemKind==0)
   - If AllowOneMainItem setting is on, enforces single main item
   - Validates TaxTemplateCodes per row
   - Checks that DoneMark can only be set if all linked WOs are closed (`IsSVORowsDone`)
   - Checks for open WS and Activity transactions before completing
   - **Access control**: `UserCanAction("CompletingServiceOrders")` required to mark done

5. **Save**: `SVOVcRecordSave` calls `SetSVOFlags` (updates WOMark, WSMark, InvMark based on linked records), auto-sets RegDate/RegTime on first save.

6. **Completion**: Setting DoneMark=1 triggers `SVOInspection` which creates quality inspection records if QualConSerNr is set.

7. **Deletion Protection**: `SVOVcRecordRemoveTest` prevents deletion if linked Activities, Work Orders, Work Sheets, or WSIV transactions exist, or if any row has WOSerNr set.

#### 5.2 Operations (from SVOVcWAction.hal)

From Service Order record, users can:

| Operation | Access Right | Target Register | Description |
|-----------|-------------|-----------------|-------------|
| Create Work Order | - | WOVc | `WorkOrderSVODsm` — opens Work Order maintenance with SVO reference |
| Create Work Sheet | DisallowWSFromSVO (inverted) | WSVc | `WorkSheetSVODsm` — `RecordAction_raPasteSVOInWS` |
| Create Invoice | SVOToInv | IVVc | `IVFromSVODsm` — `RecordAction_raPasteSVOInInv` |
| Create Cash Invoice | SVOToIVCash | IVCashVc | `IVCashFromSVOsm` — `RecordAction_raPasteSVOnIVCash` |
| Create Activity | - | ActVc | `ActFromSVODsm` — `MakeActFromSVO` |
| Create Quotation | - | QTVc | `QTFromSVODsm` — `RecordAction_raPasteSVOInQT` |
| Create Service Stock Txn | SVOToSVGM | SVGMVc | `SVGMFromSVODsm` — `RecordAction_raPasteSVOInSVGM` |
| Create Purchase Order | SVOToPO | POVc | `POFromSVODsm` — `RecordAction_raPasteSVOInPO` |
| Create Return | SVOToRet | RetVc | `RetFromSVODsm` — `PasteSVOInRet` |
| Create Dispatch (Items Out) | SVOToDispatch | DispatchVc | `DispatchFromSVODsm` |
| Create Off-Hire (Items In) | SVOToOffHire | OffHireVc | `OffHireFromSVODsm` |
| Warranty Status (GSX) | - | SVOSerVc | `WarrantyStatusSVODsm` — queries Apple GSX for warranty |
| Send to Apple (GSX) | - | - | `SendToAppleSVODsm` — creates GSX carry-in repair |
| SVO Status Report | - | Report | `SVOStaDsm` |
| Customer Status | - | Report | `SVOCustStatDsm` |

#### 5.3 Warranty and Repair Tracking

- **Automatic warranty detection**: When a serial number is entered on an SVO row, the system looks up `SVOSerVc` and checks `WarrantyUntil` against the current date. If under warranty, `ItemType` is set to 2 (Warranty); otherwise 1 (Invoiceable).
- **GSX Integration**: Apple Authorized Service Providers can query GSX for real-time warranty status, auto-create carry-in repairs, and look up parts. This updates SVOSerVc with warranty dates, coverage details, and part lists.
- **MotherNr**: Supports hierarchical serial numbers (e.g., a RAM module inside a laptop).
- **SecondarySerialNr / AlternateDeviceID**: IMEI or alternate identifiers.

#### 5.4 iBrain Integration

`IBrainSVOMn.hal` provides automatic Service Order creation from an external iBrain API system. It polls for new orders, creates customers if needed, and auto-populates SVO records from JSON payloads containing client info, device details, serial numbers, and problem descriptions.

#### 5.5 Recalculate Invoiced Maintenance

`RecSVOMn.hal` provides the "Recalculate Invoiced" maintenance function. It iterates WSIV transactions by SVONr, checks if the linked invoice still exists, and if deleted, resets InvNr and updates the SVO's invoiced quantities and flags.

#### 5.6 Access Control Rights

| Right | Purpose |
|-------|---------|
| CompletingServiceOrders | Required to set DoneMark |
| SVOToInv | Create invoice from SVO |
| SVOToIVCash | Create cash invoice from SVO |
| SVOToSVGM | Create service stock transaction |
| SVOToPO | Create purchase order |
| SVOToRet | Create returned goods |
| SVOToOffHire | Create items-in |
| SVOToDispatch | Create items-out |
| DisallowWSFromSVO | Block work sheet creation (inverted logic) |
| UnOKAll | Override completed status |

### 6. Enums

#### 6.1 SVO Row ItemType (Invoicing Type)

From `amaster/datadef5.hal` field definition `M4Set,31`:
- **0** — Plain (not yet classified)
- **1** — Invoiceable (chargeable to customer)
- **2** — Warranty (covered under warranty, no charge)
- **3** — Contract (covered under service contract)

#### 6.2 SVO Row ItemKind

- **0** — Main Item (the primary item being serviced)
- **1** — Sub-item / Accessory (inherits ItemType from Main Item)

#### 6.3 kItemType (Global Item Types)

```
kItemTypePlain = 0
kItemTypeStocked = 1
kItemTypeStructured = 2
kItemTypeService = 3
```

#### 6.4 WOVc.Closed (Work Order Status)

- **0** — Open
- **2** — In Progress
- **3** — Closed/Done

#### 6.5 kWSIVRecType (Work Sheet Transaction Record Type)

```
kWSIVRecTypeWorkSheet = 0
kWSIVRecTypeActivity = 1
kWSIVRecTypeReturnGoods = 2
```

#### 6.6 WSIVVc.Type (Work Sheet Transaction Invoicing Type)

- **1** — Contract
- **2** — Invoiceable
- **3** — Warranty
- **4** — Other

#### 6.7 kServiceUsageStatus

```
kServiceUsageStatusCreated = 1
kServiceUsageStatusSent = 2
kServiceUsageStatusInvoiced = 3
kServiceUsageStatusPickedByLookup = 4
```

#### 6.8 kServiceBaseOn

```
kServiceBaseOnRegistration = 0
kServiceBaseOnVAT = 1
```

---

## Part B: Timekeeper

The Timekeeper module is a **lightweight time-and-attendance subsystem** built on top of the Activity (CRM) register. It does not have its own register; instead, it uses a special user type (`kTypeOfUserTimekeeper = 3`) and creates Activity records with `TodoFlag = kTodoFlagWorkHours (4)` to track clock-in/clock-out events.

### 1. Registers and Fields

The Timekeeper module does **not** define its own registers. It uses:

#### 1.1 ActVc — Activity Register (Clock-In/Out Records)

Clock-in/out events are stored as Activity records with these specific field values:

| Field | Value/Purpose |
|-------|---------------|
| TodoFlag | `kTodoFlagWorkHours (4)` — identifies this as a work hours record |
| CalTimeFlag | `kCalTimeFlagTime (1)` — time-based calendar entry |
| TransDate | Clock-in date |
| StartTime | Clock-in time |
| EndTime | Clock-out time (blank until clocked out) |
| EndDate | Clock-out date (for overnight shifts) |
| CostTime | Calculated duration (EndTime - StartTime) |
| MainPersons | User code of the employee |
| Comment | Auto-populated with localised clock-in/out text (USetStr 22172-22175) |
| ActType | From `ASTBlock.ClockInOut` setting |
| OKFlag | Set to 1 on clock-out (marks activity as approved) |
| SerNr | Auto-generated |

#### 1.2 TargTimeVc — Target Time Register

Defined in `amaster/datadef3.hal` line 3001. Defines expected working hours per employee per period.

| Field | Type | Purpose |
|-------|------|---------|
| Person | M4Code(10) | Employee (UserVc lookup) |
| StartDate | M4Date | Period start date |
| Name | M4Str(60) | Description |
| Total | M4Val | Total target hours |
| **Row Fields:** | | |
| ActType | M4Code(5) | Activity type for this target |
| Text | M4Str(60) | Description |
| Days | M4Long | Number of days |
| WorkDays | M4Long | Number of working days |
| Hours | M4UVal | Target hours |

#### 1.3 ASTBlock / UserASTVc — Activity Type Settings

Global (`ASTBlock`, `amaster/datadef4.hal` line 1703) and per-user (`UserASTVc`, `amaster/datadef11.hal` line 9151) settings for auto-generating activities.

**Key Timekeeper Fields:**
- `ClockInOut` (M4Code, 5) — Activity Type code used for clock-in/out records
- `ClockInOutEnable` (M4Int) — Enable per-user override (in UserASTVc)
- `GenServOrder`, `GenWS`, `GenWO`, `GenSVO` — Control auto-activity generation for service-related events

### 2. Settings

#### 2.1 Configuration

- **Verticals Card**: Enable the Timekeeper feature in System module Configuration.
- **Activity Types, Subsystems** (CRM module): Assign the clock-in Activity Type.
- **Timekeeper Activity Type** (Timekeeper module): Abbreviated assignment of clock-in Activity Type.

#### 2.2 Access Group Rights

| Right | Level | Effect |
|-------|-------|--------|
| AllowNoClockInOut | None | Users must clock in at login; auto-clock out at logout |
| AllowNoClockInOut | Full | Users can work without clocking in; manual clock in/out |

#### 2.3 User Type

When a user is assigned `kTypeOfUserTimekeeper (3)`:
- They receive a simplified "TimekeeperMasterWClass" interface instead of the full master window
- Clock-in/out is enforced regardless of AllowNoClockInOut setting
- Limited access to full ERP functions

#### 2.4 Shift Management

Shifts are defined as Activity records with:
- **Task Type**: "Work Hours" (`kTodoFlagWorkHours`)
- **Calendar Type**: "Profile" (`kCalTimeFlagProfile`)
- **Start Time / End Time / Start Date**: Define the shift window
- **Persons**: Assigned employees

### 3. Reports

| Report | Purpose |
|--------|---------|
| Hours Worked Analysis | Compares actual clocked hours against target hours per employee |
| Employee Time Report (`EMTimeRn.hal`) | Detailed breakdown of employee time with target comparison, sorted by activity type and objects |
| Activities, Persons (CRM) | Shows work hours activities when filtered by Work Hours option |

### 4. Business Logic

#### 4.1 Clock-In Process

From `OnLoginTool.hal` (`CreateClockInActivity`, `ClockInWClassDoRemote`):

1. System checks `AllowNoClockInOut` access right and `TypeOfUser == kTypeOfUserTimekeeper`
2. If clock-in required, `ClockinActivityExists` searches for existing open work-hours activity for the user on today's date
3. If no open activity exists, `CreateClockInActivity` creates a new ActVc record:
   - TransDate = current date
   - StartTime = current time
   - EndTime = blank
   - TodoFlag = kTodoFlagWorkHours
   - CalTimeFlag = kCalTimeFlagTime
   - MainPersons = current user
   - ActType = ASTBlock.ClockInOut
   - Comment = localised "Clocked In" text
4. If an open activity already exists, returns error 22170 (already clocked in)

#### 4.2 Clock-Out Process

From `OnLoginTool.hal` (`ClockOutWClassDoRemote`):

1. Finds existing open clock-in activity via `ClockinActivityExists`
2. If no open activity, returns error 22171 (not clocked in)
3. Sets EndTime = current time, EndDate = current date
4. Calculates CostTime = TimeDiff(StartTime, EndTime)
5. Handles overnight shifts: if EndDate != TransDate, calculates full duration across days
6. Sets OKFlag = 1 (approved)
7. Updates the activity record
8. Optionally creates a new clock-in activity immediately (for break handling)

#### 4.3 Automatic Clock-Out on Logout

From `OnLogin.hal` line 742:
- If user type is Timekeeper AND AllowNoClockInOut is "None", automatic clock-out is triggered before logout
- The `ClockOutWClassDo(true, false)` call handles this automatically

#### 4.4 Break Handling

The `ClockOutWClassAccept` procedure calls `ClockOutWClassDo(false, true)` which:
1. Clocks out the current session
2. Immediately creates a new clock-in activity (`createclockinf = true`)
This supports lunch breaks where the employee clocks out for break and immediately clocks back in.

#### 4.5 Per-User Activity Type Override

`GetUserDefActTypes` in `CRMTools.hal` checks `UserASTVc.ClockInOutEnable` to determine if a per-user clock-in Activity Type should override the global `ASTBlock.ClockInOut` setting.

### 5. Enums

#### 5.1 kTypeOfUser (User Types)

```
kTypeOfUserNamed = 0
kTypeOfUserConcurrent = 1
kTypeOfUserBusinessCommunicator = 2
kTypeOfUserTimekeeper = 3
kTypeOfUserPOS = 4
kTypeOfUserAccbureaux = 5
kTypeOfUserConsultant = 6
```

#### 5.2 kTodoFlag (Activity Task Types)

```
kTodoFlagCalendar = 0
kTodoFlagTodo = 1
kTodoFlagTimedTodo = 2
kTodoFlagBanner = 3
kTodoFlagWorkHours = 4        ← Used by Timekeeper
kTodoFlagOther = 5
kTodoFlagApproval = 6
kTodoFlagRecurring = 7
kTodoFlagProject = 8
kTodoFlagCleanTask = 9
kTodoFlagRoomMaintenance = 10
```

#### 5.3 kCalTimeFlag (Calendar Time Types)

```
kCalTimeFlagNoshow = 0
kCalTimeFlagTime = 1           ← Used for clock-in records
kCalTimeFlagProfile = 2        ← Used for shift definitions
```

---

## Cross-Module Integration

### Service Orders integrates with:

| Module | Integration Point |
|--------|-------------------|
| **Sales (AR)** | Create Invoices (IVVc) and Cash Invoices (IVCashVc) from SVO |
| **Purchasing (AP)** | Create Purchase Orders (POVc) for spare parts from SVO |
| **Inventory** | Stock transactions via SVGMVc, Dispatch (items out), Off-Hire (items in), Returns |
| **CRM** | Activities (ActVc) created from SVO; Activities link back via SVOSerNr |
| **Contracts** | Service contracts (COVc) link to SVO rows via ContractNr; ItemType=3 requires contract |
| **Quality Control** | QualConVc integration; inspections auto-created on SVO completion |
| **Quotations** | Create Quotations (QTVc) from SVO |
| **Apple GSX** | External API for warranty lookup and carry-in repair creation |
| **iBrain** | External API for automatic SVO creation from third-party systems |

### Timekeeper integrates with:

| Module | Integration Point |
|--------|-------------------|
| **CRM** | Clock-in/out creates Activity records; uses Activity Types and Subsystems settings |
| **System** | User type (kTypeOfUserTimekeeper) controls UI and access; Access Groups control enforcement |
| **HR** | Target Time (TargTimeVc) defines expected hours; EMTimeRn reports compare actual vs target |

---

## Nexa ERP Implications

### Service Orders

1. **Core Register Design**: The SVOVc register is well-structured with header + matrix rows. Nexa should replicate this pattern: header with customer/pricing/status fields, rows with item/serial/cost/type per service line.

2. **Status Model**: HansaWorld uses boolean flags (DoneMark, WOMark, WSMark, InvMark, InvFlag) set by `SetSVOFlags`. Nexa should adopt a richer status enum (Draft, Open, InProgress, Completed, Invoiced, Cancelled) instead of multiple flags.

3. **Warranty Tracking**: The SVOSerVc (Known Serial Numbers) register with automatic warranty determination is essential. Nexa should build a `serial_number_registry` table with warranty dates, coverage details, and automatic warranty/invoiceable classification.

4. **Service Line Types**: The ItemType enum (Plain/Invoiceable/Warranty/Contract) is critical for correct invoicing. Nexa should maintain this concept, auto-classifying based on warranty dates and contract lookups.

5. **Work Order / Work Sheet Pattern**: HansaWorld's three-level hierarchy (SVO -> WO -> WS) with WSIV as invoicing detail is comprehensive. Nexa could simplify to SVO -> Service Task (combining WO+WS concepts) with separate invoicing transactions.

6. **Standard Problems**: The StandProblemVc with modifiers and classifications provides structured fault coding. Nexa should implement a `problem_codes` lookup with categories and modifiers.

7. **Multi-Currency**: All SVO registers carry full currency rate fields. Nexa must support this in the service module.

8. **Operations Menu**: The rich set of create-from operations (Invoice, PO, Quotation, Activity, Return, Dispatch, Off-Hire, Stock Transaction) shows the extensive integration required. Nexa should implement these as workflow actions.

9. **Access Control**: Fine-grained rights per operation (SVOToInv, SVOToPO, etc.) and per completion step. Nexa's RBAC system must support these.

10. **Apple GSX**: This is vendor-specific and NOT needed for Nexa. However, the pattern of external API integration for warranty lookup is relevant for future extensibility.

### Timekeeper

1. **Lightweight Approach**: HansaWorld cleverly reuses the Activity register rather than creating separate attendance tables. Nexa can consider a similar approach: use the existing activity/task system with a "Work Hours" type, or create a dedicated `attendance_records` table.

2. **User Type Model**: The Timekeeper user type provides a simplified interface. Nexa should support a "Timekeeper" role with limited access that only sees clock-in/out and basic schedule information.

3. **Clock-In/Out Logic**: The core logic is straightforward: create an Activity on clock-in with StartTime, update with EndTime on clock-out. Nexa should implement:
   - POST `/api/attendance/clock-in` — creates record with start time
   - PUT `/api/attendance/clock-out` — updates with end time and duration
   - Validation: prevent double clock-in, require clock-in before clock-out

4. **Break Handling**: The "clock out and immediately clock back in" pattern for breaks is practical. Nexa should support break logging as separate attendance segments within a shift.

5. **Shift Definitions**: HansaWorld defines shifts as profile Activities. Nexa should have a `shift_templates` table and `employee_shifts` assignment.

6. **Target Hours**: TargTimeVc provides budget/target hours per employee per period. Nexa should include this for variance reporting (actual vs. planned hours).

7. **Auto-Enforcement**: The access right controlling whether clock-in is mandatory is important. Nexa should support configurable enforcement per role/department.

8. **Overnight Shifts**: HansaWorld handles EndDate != TransDate for overnight work. Nexa must support this with proper duration calculation across midnight boundaries.
