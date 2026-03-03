# HansaWorld POS Module — Deep-Dive Findings

> **Source**: HAL codebase (`legacy-src/c8520240417/`) and HansaManuals online documentation.
> **Date**: 2026-02-15

---

## 1. Registers (Entities)

### 1.1 IVCashVc — POS Cash Invoice (Primary Sales Transaction)

The core POS transaction register. Each record represents a single POS sale/return.

**Header Fields** (extracted from `IVCashRecAction.hal` and reports):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Auto-generated serial number (primary key) |
| InvDate | Date | Invoice date |
| TransDate | Date | Transaction date |
| TransTime | Time | Transaction time |
| StartTime | Time | When the sale was started |
| CustCode | string | Customer code (defaults to DefCustCode from settings) |
| CustCat | string | Customer category |
| Addr0 | string | Customer name/address line |
| VATNr | string | Customer VAT number |
| SalesMan | string | Salesperson (defaults to current user) |
| CurncyCode | string | Currency code |
| POSCurncyCode | string | POS currency code |
| FrRate / ToRateB1 / ToRateB2 / BaseRate1 / BaseRate2 | val | Exchange rate fields |
| PriceList | string | Price list used |
| PayDeal | string | Payment mode 1 code |
| PayDeal2 | string | Payment mode 2 code |
| CashValue | val | Cash payment amount |
| RecValue | val | Payment received (mode 1 — credit card, gift voucher etc.) |
| RecValue2 | val | Payment received (mode 2 — split payment) |
| RetValue | val | Change returned to customer |
| TendValue | val | Amount tendered |
| CashValueB2 / RetValueB2 / CashValueCur / RetValueCur | val | Multi-currency payment fields |
| Sum0..Sum4 | val | Running totals (Sum3 = excl VAT, Sum4 = incl VAT) |
| BaseSum4 | val | Base currency total |
| TotGP | val | Total gross profit |
| TotQty | val | Total quantity sold |
| TotWeight | val | Total weight |
| TotVolume | val | Total volume |
| InclVAT | Integer | Whether prices include VAT (0/1) |
| NoTAXonVAT | Integer | No tax on VAT flag |
| TotalwoTAX | Integer | Total without tax flag |
| OKFlag | Integer | Finalised flag (0 = open, 1 = confirmed) |
| NLFlag | Integer | Nominal Ledger posted flag |
| Prntdf | Integer | Printed flag |
| Invalid | Integer | Invalidated/voided flag |
| Suspended | Integer | Suspended/parked flag |
| ExportedFlag | Integer | Exported flag |
| UpdStockFlag | Integer | Stock updated flag |
| InvType | Integer | Invoice type: kPOSInvoiceTypeCash=1, kPOSInvoiceTypeCredit=2 |
| ARAcc | string | AR account |
| Objects | string | Object/dimension tags |
| InvComment | string | Invoice comment |
| OurContact | string | Our contact person |
| Location | string | Stock location |
| LangCode | string | Language code |
| LocalMachineCode | string | POS machine identifier |
| DrawerCode | string | Cash drawer identifier |
| TerminalID | string | Terminal ID |
| BranchID | string | Branch ID |
| OfficialSerNr | string | Official/fiscal serial number |
| OfficialSerNr2 | string | Secondary official serial number |
| SauOfficialSerNr | string | Saudi official serial number |
| FiscalDeviceSeqNr | LongInt | Fiscal device sequence number |
| FiscalFlag | Integer | Fiscal device flag |
| AuthorizationCode | string | Payment authorisation code |
| OrderNr | LongInt | Linked order number |
| UUID | UUID | Unique identifier (for sync) |

**Row Fields** (from report rendering logic):

| Field | Type | Purpose |
|-------|------|---------|
| ArtCode | string | Item/article code |
| Spec | string | Description/specification |
| Quant | val | Quantity |
| Price | val | Unit price |
| Sum | val | Line total |
| VATCode | string | VAT code |
| PayMode | string | Payment mode (for payment rows) |
| stp | Integer | Row type (kInvoiceRowTypeNormal, kInvoiceRowTypeCashPayment, kInvoiceRowTypeCreditCardPayment, etc.) |
| ovst | Integer | Void status (0 = active, non-zero = voided) |

### 1.2 POSEventVc — POS Session Events (Open/Close Shift)

Records session open and close events. Critical for session management and cashup workflow.

**Fields** (extracted from RAction and WAction files):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Auto-generated serial number |
| TransDate | Date | Event date (server time) |
| TransTime | Time | Event time (server time) |
| MachineName | string | POS machine code (auto-set to CurMachineName) |
| Drawer | string | Cash drawer code |
| Event | Integer | 1 = Open Session, 2 = Close Session |
| Sign | string | User who performed the action |
| SalesGroup | string | Sales group of the user (auto-populated from UserVc) |
| Members | string | Comma-separated user codes (for multi-user sessions) |

**Indexes**: MachineName (composite with Drawer+Date+Time), TransDate, Drawer, DrawerDate

**Key Logic**:
- `IsSessionOpen()` — walks backwards through events to determine if a session is currently open for a given machine+drawer
- `OpenedPOSSession()` — finds the opening event for the current session
- `MembersBelongToOtherSession()` — prevents users from being in two open sessions simultaneously
- Sessions must be opened before sales can be recorded; closing a session triggers cashup

### 1.3 POSBalanceVc — POS Balance / Cashup Record

Records the end-of-shift cash balance after a cashup operation.

**Fields** (extracted from RAction, WAction, and Maint files):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Auto-generated serial number |
| TransDate | Date | Balance date |
| TransTime | Time | Balance time |
| MachineName | string | POS machine code |
| Drawer | string | Cash drawer code |
| Bal | val | Calculated cash balance |
| AccSales | val | Accumulated sales total |
| NLTransDone | Integer | Nominal Ledger transaction posted (0 = no, 1 = yes) |
| ReportingDate | Date | Fiscal reporting date |

**Indexes**: MachineName (composite with Drawer+Date+Time)

**Key Logic**:
- Cannot create a balance if a session is still open
- `MakeTransFromPOSBalance()` generates the GL (NL) transaction
- Balance can be un-OK'd (NLTransDone set back to 0) with proper permissions, which deletes the GL transaction
- `GetPOSBalance()` and `GetAccSales()` are remote functions that calculate balances on demand

### 1.4 POSJournalVc — POS Journal / Audit Log

Stores every significant POS action for audit trail and electronic journal compliance.

**Fields** (extracted from report and tool files):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Journal entry serial number |
| TransDate | Date | Date of action |
| TransTime | Time | Time of action |
| FileName | string | Source register ("IVCashVc" or "RestAccVc") |
| TransNr | LongInt | Transaction serial number in source register |
| RowNr | Integer | Row number affected |
| Action | Integer | POS action type (kPOSAction enum) |
| ArtCode | string | Item code involved |
| Price | val | Price at time of action |
| Quant | val | Quantity at time of action |
| UserCode | string | User who performed the action |
| LocalMachineCode | string | Machine code |
| DrawerCode | string | Drawer code |
| OfficialSerNr | string | Official serial number |
| Approver | string | Supervisor who approved (for restricted actions) |

**Indexes**: TransDate, FNTransDate (FileName+TransDate), FileName (FileName+TransNr+RowNr), DrawerCode (DrawerCode+LocalMachineCode+TransDate)

### 1.5 POSButtonsVc — POS Button/Menu Configuration

Defines the touchscreen button layout for POS terminals.

**Header Fields**:

| Field | Type | Purpose |
|-------|------|---------|
| WindowClass | string | Target window class ("NPTSIVCashDClass" for POS, "RestAccDClass" for Restaurant, "IVDClass" for Invoice) |
| Page | Integer | Page number (must be >= 1) |
| POSButtonGroupCode | string | Button group code |
| Comment | string | Page description/label |

**Row Fields**:

| Field | Type | Purpose |
|-------|------|---------|
| ButtonType | Integer | Button type (see kPOSButtonType enum — 162 types) |
| Code | string | Associated code (item code, payment mode, page number, etc.) |
| Label | string | Display label on button |
| colnr | Integer | Button colour |
| AutoFinish | Integer | Auto-finish behaviour (default/yes/no) |

### 1.6 POSSalesVc — POS Sales Statistics

Stores aggregated sales data. Records are marked with a `Synced` flag.

**Fields** (from RAction):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Serial number |
| Synced | Integer | Synchronisation status |

**Key Logic**: Records cannot be modified once synced; records are never deletable (RecordRemoveTest always returns 0).

### 1.7 POSerBlock — POS Serial Number Blocks

Manages serial number ranges for offline POS terminals.

**Row Fields**:

| Field | Type | Purpose |
|-------|------|---------|
| TSerStart | LongInt | Serial range start (must be > 0) |
| TSerEnd | LongInt | Serial range end (must be > 0) |
| StartDate | Date | Valid from date |
| EndDate | Date | Valid to date |

**Key Logic**: Validates that serial number ranges do not overlap.

### 1.8 PosVc — Position / Bin Location (Warehouse)

Note: Despite the similar name, `PosVc` is actually the warehouse bin/position register, not a POS register. It tracks physical stock locations.

**Fields**:

| Field | Type | Purpose |
|-------|------|---------|
| Code | string | Position code (required, unique) |
| Location | string | Stock location (required) |
| LocArea | string | Location area |
| Status | Integer | 0 = active, 1 = in use |
| Closed | Integer | Closed flag |
| PickOrder | Integer | Pick order sequence |

### 1.9 DrawerVc — Cash Drawer Register

Defines cash drawers that can be assigned to POS machines.

**Fields** (inferred from usage):

| Field | Type | Purpose |
|-------|------|---------|
| Code | string | Drawer code (primary key) |

### 1.10 CashVc — Cash In/Out Register

Records cash-in (float), cash-out, and write-off transactions.

**Header Fields** (inferred):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Serial number |
| TransDate | Date | Transaction date |
| TransTime | Time | Transaction time |
| MachineName | string | POS machine |
| Drawer | string | Cash drawer |
| Event | Integer | 0 = Cash Out, 1 = Cash In, 2 = Write-Off |
| Total | val | Total amount |
| OKFlag | Integer | Confirmed flag |
| SkipUpdatTime | Integer | Skip time update |
| CredAcc | string | Credit account |

**Row Fields**:

| Field | Type | Purpose |
|-------|------|---------|
| PMCode | string | Payment mode code |
| Amount | val | Amount per payment mode |

### 1.11 CashupHistVc — Cashup History

Links transactions to cashup periods for reporting.

**Fields** (inferred):

| Field | Type | Purpose |
|-------|------|---------|
| LocalMachineCode | string | Machine |
| DrawerCode | string | Drawer |
| TransDate | Date | Date |
| FileName | string | Source register ("IVCashVc", "CashVc") |
| TransNr | LongInt | Transaction number |

### 1.12 CashierBalVc — Cashier Balance

Tracks cashier-level balances.

**Fields** (inferred):

| Field | Type | Purpose |
|-------|------|---------|
| MachineName | string | Machine |
| Drawer | string | Drawer |
| TransDate | Date | Date |
| TransTime | Time | Time |

### 1.13 RestAccVc — Restaurant Account / Bar Tab

An alternative POS transaction register used in restaurant/bar/hospitality mode. Supports multi-course ordering, kitchen printing, and bar tab management. Fields mirror IVCashVc with additional hospitality features (Paid, Paid2, Paid3, PayDeal, PayDeal2, PayDeal3, CashValue, CUCode, ServCharge, etc.).

---

## 2. Settings

### 2.1 CashierDefBlock — POS/Cashier Settings (Primary)

The main POS configuration block. Key settings extracted from code:

| Setting | Type | Purpose |
|---------|------|---------|
| DefCustCode | string | Default walk-in customer code |
| DefInvoiceField | Integer | Default field to focus when opening invoice |
| CredAcc | string | Default credit account for cash transactions |
| WriteOffAcc | string | Write-off account for cashup differences |
| ARAcc / RestAccARAcc | string | AR accounts for POS and restaurant |
| DiscountItem | string | Item code used for discount lines |
| OrderClass | string | Default order class for POS-to-order transfers |
| POSButtonGroup | string | Default button group |
| SelectRowPage | Integer | Page to navigate to after row selection |
| NewRowInsteadIncreaseQty | Integer | Whether scanning same item creates new row or increments qty |
| RequireOpenSession | Integer | Require open POS session to sell |
| RequireReturnCustomer | Integer | Require customer for returns |
| RequireReturnReason | Integer | Require reason code for returns |
| CheckVATNo | Integer | Validate customer VAT number |
| InclTipInCashup | Integer | Include tips in cashup calculations |
| TipPMCode | string | Payment mode code for tips |
| RestBasePriceInclVAT | Integer | Restaurant base prices include VAT |
| TotalwoTAX | Integer | Show totals without tax |
| InvalIVCashOnPrtErr | Integer | Invalidate invoice if print fails |
| CashSalesToFiscalControlUnit | Integer | Send sales to fiscal control unit |
| MultipleSessionsPerLocalMachine | Integer | Allow multiple sessions per machine (for multi-user) |
| StartFromLastPOSBal | Integer | Cashup starts from last POS Balance (vs last session open) |
| PrintZReportatCashup | Integer | Auto-print Z report during cashup |
| PrintDetNLTrans | Integer | Print detailed NL transactions in cashup |
| EmailIVCash | Integer | Email receipts to customer |
| IVCashAutoFinish | Integer | Auto-finish POS invoice after payment |
| RestAccAutoFinish | Integer | Auto-finish restaurant account after payment |
| RestAccBookedDiscount | Integer | Book discounts for restaurant |
| RestAccDiscountAcc | string | Discount account for restaurant |
| RestAccServiceChargeItem | string | Service charge item code |
| InclOpenInvCashup | Integer | Include open invoices in cashup |
| UpdStockMaint | Integer | Enable auto stock update maintenance |
| UpdStockMaintTime | Time | Interval for stock update |
| RestUpdStockMaint | Integer | Enable restaurant stock update |
| RestUpdStockMaintTime | Time | Restaurant stock update interval |
| CashupMaint | Integer | Enable automatic cashup maintenance |
| CashupMaintInterval | Time | Interval for automatic cashup |
| POSOKSD | Integer | POS OK stock deduction mode |
| RestOKSD | Integer | Restaurant OK stock deduction mode |

### 2.2 LocalMachineBlock / LocalMachineVc — Local Machine Settings

Per-machine configuration:

| Setting | Type | Purpose |
|---------|------|---------|
| LocalMachineCode | string | Machine identifier |
| TerminalID | string | Terminal ID for fiscal compliance |
| DefCustCode | string | Machine-specific default customer |

### 2.3 RestPMBlock — Restaurant Payment Modes

Defines payment modes (cash, credit card, gift voucher, etc.) with per-machine assignments.

Row fields:
- `rowstp` — row type (kInvoiceRowTypeCashPayment, etc.)
- `MachineName` — machine assignment
- `CurncyCode` — currency

### 2.4 PMBlock — Payment Modes (Global)

Global payment mode definitions.

| Field | Purpose |
|-------|---------|
| CheckType | Payment type classification (see kPayModeType enum) |

Payment mode types:
- kPayModeTypeCreditCard
- kPayModeTypeGiftVoucher
- kPayModeTypeCheque
- kPayModeTypeDebitCard
- kPayModeTypeSwish
- kPayModeTypeMPesa
- kPayModeTypeQR

### 2.5 DefCashBlock — Default Cash Settings

| Field | Purpose |
|-------|---------|
| DefCashPayMode | Default payment mode code for cash transactions |

### 2.6 LocalLoginBlock — Local Login Configuration

| Field | Purpose |
|-------|---------|
| OnLoginWindow | Window to show on login (POS standalone mode) |

### 2.7 POSButtonGroups Setting (kSetPOSButtonGroups = -13)

System setting for POS button group definitions.

---

## 3. Reports

### 3.1 POSZRn — Z-Report / X-Report

The end-of-day (Z) or interim (X) report. Generates a comprehensive sales summary:

**Content**:
- Company name, date, time, machine, drawer
- **Sold Items**: quantity, net amount, discount/rebate
- **Returns**: quantity, amount
- **Cash in Drawer**: running total
- **VAT Breakdown**: per VAT code (rate, base amount, VAT amount)
- **Net Sales** (excl VAT)
- **Gross Sales** (incl VAT)
- **Payment Breakdown**: cash, credit card, debit card, gift voucher, Swish, M-Pesa, QR
- **Total Payments**
- **Change Given**
- **Invoice Counts**: total, unfinished, printed, copy-printed
- **Cash Drawer Opens**

Has two variants:
- **SWE mode** (Sweden): `POSZReport()` — simpler format
- **NOR mode** (Norway/default): `POSZReportNOR()` — extended with item group breakdown, correction counts, price lookups, Z-report numbering

Logs journal entry (`kPOSActionPrintZReport` or `kPOSActionPrintXReport`) for audit trail.

### 3.2 POSSessionRn — POS Session Report

Displays session open/close details:
- Session start event: serial number, machine, drawer, user (Sign), date, time
- Session end event: same fields
- Two layout modes: receipt printer format and screen format

### 3.3 POSEJournalRn — Electronic Journal Report

Detailed electronic journal showing all transactions:
- Iterates POSJournalVc by date range, machine, drawer
- For each journal entry, prints the relevant detail:
  - **Invoice (IVCashVc or RestAccVc)**: full line items, payment breakdown, totals
  - **Bar Tab Open/Close**: date/time
  - **Cash Drawer Open**: date/time
  - **X-Report / Z-Report**: embedded sub-report
  - **Proforma Invoice / Invoice Copy**: reference details
  - **Price Lookup**: item details
  - **Corrections**: quantity changes, price changes, deletions
  - **Startup/Shutdown**: machine events
  - **Login/Logout**: user events

### 3.4 POSAuditTrailRn — POS Audit Trail Report

Simplified audit view filtered by user, machine, and invoice number range:
- Columns: Official Number, Date, Action, Machine, User, Approver
- Focused on IVCashVc transactions
- Action types mapped via StringFromSet(622, action)

### 3.5 POSBonusRn — POS Bonus/Commission Report

Calculates sales bonuses per user:
- Uses IVCash invoices
- Calculates bonus percentages based on BonusDefVc rules
- Shows per-user and per-customer breakdowns

### 3.6 POStatRn — POS Statistics Report

Item-level sales statistics (Customer/Item Statistics, Item Sales Statistics, Item Turnover History).

---

## 4. Maintenances

### 4.1 CashupMn — Cashup Maintenance (End-of-Day)

The primary end-of-day reconciliation maintenance. Automated or manually triggered.

**Workflow**:
1. Builds machine/drawer combinations to process
2. For each combination:
   a. If session is still open, auto-closes it (creates POSEventVc with Event=2)
   b. Determines period start: either from last POSBalance or last session open
   c. Calls `DoTheCashup2()` to calculate all totals by payment mode
   d. Creates **CashVc Write-Off** records for any differences
   e. Creates **CashVc Cash-Out** records for positive balances
   f. Creates **CashVc Cash-In** records for negative balances
   g. Creates **POSBalanceVc** record with calculated Bal and AccSales
   h. Posts the NL transaction (sets NLTransDone=1)
   i. Optionally triggers Z-Report printing and fiscal printer commands

**Parameters**:
- Machine, Drawer, Payment Mode, Date, Time
- Flags: Detail level, include Restaurant cash, include POS cash, include SL cash, include room tabs, include receipts

### 4.2 CreatePOSButtonsMn — Auto-Create POS Buttons

Generates button layouts from item groups:
- Creates a main page with "Go to Page" buttons for each item group
- Creates a sub-page per item group with item buttons
- Optionally deletes existing buttons first
- Assigns to specified WindowClass and button group

### 4.3 POSUpdStockMn — POS Update Stock Maintenance

Periodic background maintenance to update stock from POS sales (since POS sales do not immediately deduct stock for performance).

---

## 5. Documents / Receipts

### 5.1 DoInvCashForm — POS Cash Receipt

Receipt/invoice form for IVCashVc transactions. Includes:
- Customer details, VAT number
- Line items with item code, description, quantity, price, total
- VAT summary
- Payment breakdown (cash, credit card, gift voucher, etc.)
- Official serial number, fiscal device info
- Barcode/QR code support
- Supports fiscal control unit integration

### 5.2 DoRestAccForm — Restaurant Receipt

Receipt form for RestAccVc transactions. Similar to above with restaurant-specific fields (service charge, tips).

### 5.3 DoGiftReceiptForm — Gift Receipt

Simplified receipt without prices for gift purchases.

---

## 6. Business Logic and Workflows

### 6.1 Terminal / Machine Setup

- Each POS terminal is identified by `CurMachineName` (LocalMachineVc)
- Terminals are assigned to a cash drawer (`DrawerVc`)
- Serial number blocks (`POSerBlock`) can be pre-assigned for offline terminals
- Button layouts (`POSButtonsVc`) are configured per WindowClass + ButtonGroup + Page
- Three window classes: `NPTSIVCashDClass` (POS/Shop), `RestAccDClass` (Restaurant/Bar), `IVDClass` (Standard Invoice)

### 6.2 Session Management (Open/Close Shift)

**Open Session**:
1. User triggers `OpenPOSSessionsm()`
2. System auto-detects the drawer via `CurDrawerCode(CurMachineName)`
3. If drawer known, validates: no duplicate open events, drawer exists, machine name set
4. Creates `POSEventVc` with Event=1, auto-generates SerNr
5. Updates the IVCash window with drawer code and current time
6. Sends to fiscal printer if applicable

**Close Session**:
1. User triggers `ClosePOSSessionsm()`
2. Creates `POSEventVc` with Event=2
3. Validates: session must be open, same machine, same drawer
4. Updates window with current time

**Multi-User Sessions**:
- When `MultipleSessionsPerLocalMachine` is enabled, the `Members` field tracks which users are in each session
- Users cannot belong to two sessions simultaneously
- Session lookup uses `FindLastPOSEvent()` with member-awareness

### 6.3 Sale Transaction Flow (Scan -> Pay -> Receipt)

1. **New Invoice**: `RecordNew(IVCashr)` initialises all defaults (customer, currency, rates, machine, drawer, fiscal settings)
2. **Add Items**: Each scan/selection adds a row (kInvoiceRowTypeNormal) via button type kPOSButtonTypeItem or barcode scan
   - Same item can either increment quantity or create new row based on `NewRowInsteadIncreaseQty` setting
   - Modifier buttons can adjust items (size, options)
   - Volumetric barcode scanning supported
3. **Price/Qty Adjustments**: Via kPOSButtonTypeAmendLine, requires permissions
4. **Discounts**: Via `DiscountItem` setting, senior citizen discount button, manager override
5. **Payment**: Multiple payment buttons trigger split payment:
   - Cash (kPOSButtonTypeCashPayment)
   - Credit Card (kPOSButtonTypeCreditCardPayment)
   - Debit Card (kPOSButtonTypeDebitCardPayment)
   - Gift Voucher (kPOSButtonTypeGiftVoucherPayment)
   - Loyalty Points (kPOSButtonTypeLoyaltyPointsPayment)
   - On Account (kPOSButtonTypeOnAccountPayment)
   - Swish (kPOSButtonTypeSwishPayment)
   - M-Pesa (kPOSButtonTypeMPesaPayment)
   - QR (kPOSButtonTypeQRPayment)
6. **Finish**: kPOSButtonTypeFinish or kPOSButtonTypeFinishAndPrint completes the sale
   - Sets OKFlag=1
   - Optionally auto-finishes (IVCashAutoFinish setting)
   - Returns change (RetValue)
7. **Receipt**: Prints via DoInvCashForm; can reprint via kPOSButtonTypeReprintReceipt
8. **Journal**: Every action creates a POSJournalVc entry via `StorePOSJournalEntry()`

### 6.4 Payment Methods (Cash, Card, Split)

**Payment Architecture**:
- Payment modes defined in PMBlock with a `CheckType` classifying the tender type
- RestPMBlock assigns payment modes to machines with currency support
- Each IVCashVc supports: CashValue + RecValue (PayDeal) + RecValue2 (PayDeal2) = header-level split
- Row-level payments also supported: rows with stp = kInvoiceRowTypeCashPayment, kInvoiceRowTypeCreditCardPayment, kInvoiceRowTypeGiftVoucherPayment, kInvoiceRowTypeSwishPayment, kInvoiceRowTypeMPesaPayment, kInvoiceRowTypeQRPayment, kInvoiceRowTypeCashWithdrawal

**Payment Button Types**:
- kPOSButtonTypePayment (generic)
- kPOSButtonTypeFullPayment (one-touch full payment)
- kPOSButtonTypePaymentButtonsLayout (payment panel)
- kPOSButtonTypePaymentOneMode (single payment mode)

**Credit Card Integration**:
- kPOSButtonTypeCreditCardPaymentReversal — reversal
- kPOSButtonTypeCreditCardTerminalReports — terminal reports
- kPOSButtonTypeConnectToCCTerminal — connect to terminal
- kPOSButtonTypeReprintLastCCSlip — reprint slip

### 6.5 Returns / Refunds / Voids

**Item-Level**:
- kPOSButtonTypeVoidRow — void a single row (sets ovst flag); optionally requires reason code (StandProblemVc)
- kPOSButtonTypeDeleteItem — delete an item row entirely
- kPOSActionDeleteInvoiceRow / kPOSActionVoidInvoiceRow in journal

**Invoice-Level**:
- kPOSButtonTypeReturn — return/credit note mode
- kPOSButtonTypeReturnInvoiceNo — return against specific invoice number; optionally requires reason code
- kPOSButtonTypeReturnReason — set return reason
- kPOSButtonTypeInvalidateInvoice — void entire invoice (sets Invalid=1)
- kPOSButtonTypeCreateCorrectionInvoice / kPOSButtonTypeCorrectionInvoice — correction invoices
- kPOSButtonTypeCreateCreditNote / kPOSButtonTypeCreditNote — credit notes

**Permissions**: Returns can require a customer (`RequireReturnCustomer`) and/or reason code (`RequireReturnReason`).

### 6.6 Z-Report and End-of-Day Cashup

**X-Report** (interim, non-resetting):
- kPOSButtonTypeXReading
- Generates POSZRn with flag[0]=1 (X mode)
- Logs kPOSActionPrintXReport

**Y-Report**:
- kPOSButtonTypeYReading — intermediate reading

**Z-Report** (end-of-day, resetting):
- kPOSButtonTypeZReading
- Generates POSZRn with flag[0]=0 (Z mode)
- Logs kPOSActionPrintZReport
- Increments Z-report counter (`GetLastZReportNumberFromPOSJ`)

**Cashup Flow**:
1. Close session (if open)
2. Run cashup report (CashupRn) showing all totals
3. Run CashupMn maintenance to:
   - Calculate cash balance per payment mode
   - Create Cash In/Out/Write-Off records
   - Create POSBalance record
   - Post to Nominal Ledger
4. Optionally print Z-Report

### 6.7 Offline / Sync Capability

**Live-Sync Mode**:
- Terminals work offline when disconnected, uploading sales automatically when reconnected
- `POSSalesVcRecordShouldBeSynchronised()` and `POSSalesVcRecordSync()` always return true
- `DrawerVcRecordShouldBeSynchronised()` and `DrawerVcRecordSync()` always return true
- Serial number blocks (POSerBlock) pre-allocate number ranges for offline terminals
- Synced flag on POSSalesVc prevents modification after sync

**Single User Mode**:
- In `SingleUserMode`, serial numbers are generated locally
- Otherwise, serial numbers come from the server via `NextSerNr()`

### 6.8 Button / Menu Configuration

**Structure**: Pages of buttons, organised by:
- WindowClass (which POS variant)
- POSButtonGroupCode (which group)
- Page number (navigation between pages)

**162 Button Types** (kPOSButtonType enum), grouped by function:
- **Item Selection**: Item, ItemGroup, ItemSearch, CustomerSearch, BaggerSearch, SupervisorSearch
- **Payment**: Cash, CreditCard, DebitCard, GiftVoucher, Cheque, Swish, M-Pesa, QR, LoyaltyPoints, OnAccount, FullPayment, PaymentOneMode
- **Transaction Control**: Finish, FinishAndPrint, VoidRow, DeleteItem, AmendLine, Return, ReturnInvoiceNo
- **Navigation**: GotoPage, IncludePage, LevelTop
- **Modifiers**: Modifier (item modifiers), Quantity, SplitItem
- **Hospitality**: SetTable, SetCovers, MergeBarTabs, SplitBarTabs, PrintOrder, PrintFireOrder, NextCourse, CalculateTip, ServiceCharge, OnHotelGuestAccount, HotelGuests
- **Reports**: XReading, YReading, ZReading, CashupReport, CashupMaint, StockListReport, VarietiesEnquiryReport
- **Session**: OpenSession, CloseSession, Login, RegisterClerk, UnregisterClerk
- **Cash Management**: OpenCashDrawer, CreateCashin, CreateCashOut, PutCashFloat, GetCashFloat
- **Transfers**: TransfertoSL (Sales Ledger), TransfertoInvoice, TransfertoOrder, TransfertoQuotation
- **Printing**: PrintInvoice, PrintProformaInvoice, PrintTab, PrintFiscalInvoice, PrintCourtesyReceipt, GiftReceipt, ReprintReceipt, ReprintLastCCSlip, PrintPreview
- **Customer**: CustomerSearch, CustomerSearchFiltered, EditCustomerRecord, ChangeAddress, ChangeVatNo, LoyaltyCard, PreviousSalesPrices
- **Special**: ScanBarcode, ShowQRCode, SendEMail, SendPayLink, OpenCalendar, CreateActivity, NutritionFacts, PauseSales, ResumeSales, SyncNow

### 6.9 POS-to-Invoice Generation

Transfer buttons convert POS transactions to other document types:
- **kPOSButtonTypeTransfertoSL** (Transfer to Sales Ledger) — creates a proper debtor invoice
- **kPOSButtonTypeTransfertoInvoice** — creates a standard invoice (IVVc)
- **kPOSButtonTypeTransfertoOrder** — creates a sales order
- **kPOSButtonTypeTransfertoQuotation** — creates a quotation
- **kPOSButtonTypeSaveInvoice** / **kPOSButtonTypeCreateInvoice** — save/create invoice

Paste operations import from existing documents:
- kPOSButtonTypePasteQuotation
- kPOSButtonTypePasteSalesOrder
- kPOSButtonTypePasteServiceOrder
- kPOSButtonTypePasteDelivery
- kPOSButtonTypePasteHotelReservation

---

## 7. Enums and Constants

### 7.1 kPOSButtonType (162 values, 0-161)

See Section 6.8 above for categorised listing. Full enum defined in `haldefs.h` lines 4580-4742.

### 7.2 kPOSAction (31 values)

| Value | Name | Description |
|-------|------|-------------|
| 0 | kPOSActionNone | No action |
| 1 | kPOSActionAddInvoiceRow | Add item to invoice |
| 2 | kPOSActionVoidInvoiceRow | Void a row |
| 3 | kPOSActionChangeInvoiceRowPrice | Price change |
| 4 | kPOSActionDeleteInvoiceRow | Delete a row |
| 5 | kPOSActionPrintInvoice | Print invoice |
| 6 | kPOSActionPrintInvoiceCopy | Print invoice copy |
| 7 | kPOSActionPrintProformaInvoice | Print proforma |
| 8 | kPOSActionPrintProformaInvoiceCopy | Print proforma copy |
| 9 | kPOSActionPayInvoiceCash | Cash payment |
| 10 | kPOSActionPayInvoiceCC | Credit card payment |
| 11 | kPOSActionPayInvoiceGV | Gift voucher payment |
| 12 | kPOSActionPrintXReport | X-Report |
| 13 | kPOSActionPrintZReport | Z-Report |
| 14 | kPOSActionOpenDrawer | Open cash drawer |
| 15 | kPOSActionOpenBarTab | Open bar tab |
| 16 | kPOSActionCloseBarTab | Close bar tab |
| 17 | kPOSActionFinishInvoice | Finish invoice |
| 18 | kPOSActionInvalidateInvoice | Void invoice |
| 19 | kPOSActionReturnInvoice | Return against invoice |
| 20 | kPOSActionReturnItem | Return item |
| 21 | kPOSActionTransferToSL | Transfer to Sales Ledger |
| 22 | kPOSActionTransferToIV | Transfer to Invoice |
| 23 | kPOSActionTransferToQT | Transfer to Quotation |
| 24 | kPOSActionTransferToOR | Transfer to Order |
| 25 | kPOSActionStartup | Terminal startup |
| 26 | kPOSActionShutdown | Terminal shutdown |
| 27 | kPOSActionLogin | User login |
| 28 | kPOSActionLogout | User logout |
| 29 | kPOSActionPriceLookup | Price lookup |
| 30 | kPOSActionChangeInvoiceRowQty | Quantity change |
| 31 | kPOSActionCreateRentQT | Create rental quotation |

### 7.3 kPOSEventType (15 values)

| Value | Name | Description |
|-------|------|-------------|
| 0 | NewRecord | |
| 1 | CancelRecord | |
| 2 | SaveRecord | |
| 3 | UpdateRecord | |
| 4 | OKRecord | |
| 5 | DeleteRecord | |
| 6 | OpenWindow | |
| 7 | CloseWindow | |
| 8 | AddRow | |
| 9 | DeleteRow | |
| 10 | VoidRow | |
| 11 | ModifyRow | |
| 12 | ButtonClick | |
| 13 | FiscalFunction | |
| 14 | Command | |

### 7.4 kPOSCommandsType (30 values)

Keyboard command types for POS input:

| Value | Name |
|-------|------|
| 1 | QuantityAndItem |
| 2 | Cash |
| 4 | Finish |
| 5 | CreditCardNr |
| 6 | CreditCardSum |
| 9 | Rebate |
| 18 | DeleteRow |
| 19 | QuantityAddOne |
| 20 | QuantitySubOne |
| 21 | Quantity |
| 22 | VoidRow |
| 23 | SerialNr |
| 24 | VolumetricBarCodeScan |
| 25 | LoyaltyCard |
| 26 | LoyaltyPointsPayment |
| 27 | LoyaltyPointsBonus |
| 28 | SalesAssistant |
| 29 | SeniorCitizenDiscount |
| 30 | ReprintReceipt |

### 7.5 kPOSInvoiceType

| Value | Name |
|-------|------|
| 1 | Cash (standard sale) |
| 2 | Credit (return/credit note) |

### 7.6 Other POS Enums

- **kPOSPanelSize**: Large(0), Small(1), Medium(2)
- **kPOSButtonsPosition**: Left(0), Right(1)
- **kPOSItemPicture**: Default(0), On(1), Off(2)
- **kPOSCommandsData**: BeforeData(0), AfterDate(1)
- **kPOSButtonAutoFinish**: Default(0), Yes(1), No(2)

---

## 8. Cross-Module Integration

### 8.1 Sales Ledger (AR)
- POS invoices (IVCashVc) post to AR accounts
- Transfer to Sales Ledger (kPOSActionTransferToSL) creates proper debtor invoices
- AR account configurable per settings (ARAcc, RestAccARAcc)

### 8.2 Nominal Ledger (Finance/GL)
- POSBalance creates NL transactions via `MakeTransFromPOSBalance()`
- Cash In/Out records create NL postings
- NLTransDone flag tracks posting status
- Un-OK feature allows reversing GL postings with proper permissions

### 8.3 Inventory / Stock
- POS sales do NOT immediately update stock (for performance)
- `POSUpdStockMn` periodically synchronises stock levels
- UpdStockFlag on IVCashVc tracks whether stock has been deducted
- Item lookup via INVc (item register)

### 8.4 CRM / Customer
- Customer search/lookup from POS
- Default walk-in customer code
- Loyalty card support (kPOSButtonTypeLoyaltyCard)
- Loyalty points payment and bonus
- Customer editing from POS (kPOSButtonTypeEditCustomerRecord)
- Customer-filtered search

### 8.5 Sales Orders / Quotations
- Transfer from POS to Order/Quotation
- Paste from existing orders, quotations, service orders, deliveries
- Rental quotation creation

### 8.6 Hotel / Hospitality
- Post to hotel guest account (kPOSButtonTypeOnHotelGuestAccount)
- Guest search (kPOSButtonTypeHotelGuests)
- Paste from hotel reservations
- RestAccVc for restaurant operations with service charges, tips, bar tabs

### 8.7 Fiscal Compliance
- Fiscal printer integration (receipt printers, fiscal control units)
- Official serial numbers (OfficialSerNr, FiscalDeviceSeqNr)
- Country-specific localizations: Sweden (SWE), Norway (NOR), Saudi Arabia
- Z-Report numbering for fiscal compliance
- Fiscal device sequence numbers
- Planet Tax Refund support (kPOSButtonTypeSendPlanetTaxRefund)

### 8.8 Payment / Banking
- Credit card terminal integration (connect, reports, reversal, reprint slip)
- Multiple payment processors per payment type
- Multi-currency support with exchange rates

---

## 9. Nexa ERP Implications

### 9.1 Core POS Entities to Implement

For Nexa ERP's POS module, the following entities are essential:

1. **POSTerminal** — Machine/terminal configuration (replaces LocalMachineVc)
2. **CashDrawer** — Cash drawer register (replaces DrawerVc)
3. **POSSession** — Session open/close events (replaces POSEventVc)
4. **POSSale** — The main POS transaction (replaces IVCashVc), with line items
5. **POSPayment** — Payment details per sale (normalize from IVCash's CashValue/RecValue/RecValue2)
6. **POSBalance** — End-of-shift balance (replaces POSBalanceVc)
7. **POSJournal** — Audit trail of all POS actions (replaces POSJournalVc)
8. **POSButtonLayout** — Button/menu configuration (replaces POSButtonsVc)
9. **CashMovement** — Cash in/out/float/write-off (replaces CashVc)
10. **PaymentMethod** — Payment mode definitions (replaces PMBlock/RestPMBlock)

### 9.2 Key Design Decisions for Nexa

1. **Session-Based Architecture**: HansaWorld's session model (open -> sell -> close -> cashup) is sound and should be preserved. Sessions tie together all transactions for a shift.

2. **Deferred Stock Updates**: HansaWorld defers stock deductions from POS for performance. Nexa should evaluate whether real-time stock updates are feasible with modern hardware/databases, or if a similar deferred model is needed.

3. **Deferred GL Posting**: NL transactions are created at cashup, not per-sale. This is standard POS practice and should be maintained.

4. **Payment Normalization**: HansaWorld stores payments across multiple fields (CashValue, RecValue, RecValue2, plus payment rows). Nexa should normalize this into a proper POSPayment join table supporting unlimited split payments.

5. **Button System vs Modern UI**: The 162 button types represent every possible POS action. Nexa should implement these as configurable action types but with a modern responsive UI rather than fixed grids.

6. **Offline Support**: HansaWorld supports offline terminals with serial number pre-allocation and sync. Nexa should plan for Progressive Web App (PWA) offline capability with conflict resolution.

7. **Fiscal Compliance**: Multiple country-specific fiscal requirements are embedded. Nexa should abstract fiscal compliance into a pluggable adapter pattern.

8. **Restaurant Mode**: HansaWorld has a parallel register (RestAccVc) for restaurant/bar operations with features like bar tabs, table management, kitchen printing, and service charges. Nexa should determine if restaurant POS is in scope for MVP.

9. **Multi-Currency**: HansaWorld tracks base currency, POS currency, and multiple exchange rates. Important for UK SMEs that may accept foreign currency.

10. **Audit Trail**: The POSJournal is comprehensive and captures every action. This is a regulatory requirement in many jurisdictions and must be implemented from day one.

### 9.3 MVP Scope Recommendations

**Must Have** (MVP):
- Terminal and drawer setup
- Session management (open/close shift)
- Basic sale flow: scan/add items -> payment -> receipt
- Cash, card, and split payments
- Returns and voids with reason codes
- Z-Report / cashup
- GL posting at cashup
- Audit journal
- Basic button configuration

**Should Have** (Post-MVP):
- Offline support with sync
- Customer lookup and loyalty
- Price lookups and discount matrices
- Multiple payment modes (gift voucher, on-account)
- Proforma invoices
- Transfer to Sales Order/Quotation/Invoice
- Auto-cashup maintenance

**Could Have** (Future):
- Restaurant/bar tab mode
- Kitchen printing
- Hotel integration
- Fiscal device integration
- Barcode scanning (volumetric)
- Rental quotation creation
- Planet Tax Refund

### 9.4 Settings to Replicate

The CashierDefBlock contains ~40 settings that control POS behaviour. The most critical for Nexa MVP:

1. DefCustCode — walk-in customer
2. RequireOpenSession — enforce sessions
3. NewRowInsteadIncreaseQty — scan behaviour
4. RequireReturnCustomer — return controls
5. RequireReturnReason — return controls
6. StartFromLastPOSBal — cashup period calculation
7. IVCashAutoFinish — auto-finish after payment
8. DefInvoiceField — initial cursor position
9. InclVAT (BasePriceInclVAT) — pricing model

These should be implemented as POS Settings in the System module, configurable per tenant.
