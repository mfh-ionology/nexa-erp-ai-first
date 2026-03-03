# HansaWorld Deep-Dive: Job Costing Module (Reservations + Projects)

> Generated: 2026-02-15
> Source: HAL codebase `legacy-src/c8520240417/`
> HansaManuals reference: https://www.hansamanuals.com/main/english/none/theconf___36/manuals/version___85/hwconvindex.htm

---

## CRITICAL FINDING: Dual-Purpose Architecture

**HansaWorld's "Job Costing" module (`kProductFamilyBooksJobCosting = 25`) conflates TWO fundamentally different domains under a single `JobVc` record:**

1. **Hotel/Reservations System** -- The HAL source code is OVERWHELMINGLY oriented toward hotel reservation management (check-in/check-out, room assignment, guest management, room packages, travel agents, overbooking, folio billing). This is the primary consumer of `JobVc`.

2. **Project Management / Time Billing** -- A separate set of records (`PRVc`, `TBIVVc`, `TBBUVc`, `ActVc`, `PRSOINVc`) implements traditional project cost tracking, budgets, time recording, and project invoicing. These records have minimal overlap with the hotel/reservation `JobVc` system.

**For Nexa ERP, these should be treated as TWO SEPARATE MODULES** -- a "Booking/Reservations" capability and a "Project Costing" capability -- NOT as a single monolithic "Job Costing" module.

---

## 1. Registers (Records)

### 1.1 JobVc -- Reservation / Job Record (PRIMARY)

**Purpose:** Core record for hotel reservations (bookings). Also used as the booking unit in non-hotel job costing contexts.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Unique reservation serial number (auto-generated from number series) |
| `TransDate` | Date | Check-in date / arrival date |
| `EndDate` | Date | Check-out date / departure date |
| `StartTime` | Time | Check-in time |
| `EndTime` | Time | Check-out time |
| `RegDate` | Date | Registration/booking creation date |
| `ConfDate` | Date | Confirmation date |
| `BookDate` | Date | Original booking date |
| `ResCode` | String | Resource/Room code (links to ResVc) |
| `Type` | String | Resource type code (links to ResTypeVc) |
| `ResStatus` | String | Current reservation status (links to ReservationStatusVc) |
| `ResUsage` | String | Room package / usage type (links to ResUsageVc) |
| `ReservationType` | Integer | 0=Normal, 1=Group (enum kReservationType) |
| `Mother` | LongInt | Parent reservation serial number (-1 if no parent, >0 for sub-reservations in groups) |
| `CUCode` | String 20 | Contact/Customer code |
| `CUName` | String 60 | Contact/Customer name |
| `Source` | String 20 | Travel agent / source customer code |
| `SourceName` | String 60 | Travel agent / source name |
| `Persons` | Integer | Number of adult guests (-1 = blank/not set) |
| `Children` | Integer | Number of children (-1 = blank/not set) |
| `ExtraBeds` | Integer | Number of extra beds |
| `Pax` | Integer | Total persons (adults + children in Enterprise) |
| `MaxPersons` | Integer | Maximum persons for the resource type |
| `MaxChildren` | Integer | Maximum children for the resource type |
| `MaxPax` | Integer | Maximum total PAX |
| `NrOfDays` | Integer | Number of stay days (calculated) |
| `PriceList` | String | Price list code |
| `AgreedPrice` | Val | Negotiated/agreed room rate |
| `AgreedDiscount` | String | Agreed discount percentage (e.g. "10%") |
| `PLPrice` | Val | Price list price (before discount) |
| `Sum4` | Val | Total stay value (excl. extras) |
| `TotalSum4` | Val | Total value including package extras |
| `Sum4ExclDisc` | Val | Value before discount |
| `VatSum` | Val | VAT amount on stay |
| `TotalVatSum` | Val | Total VAT including extras |
| `InclVAT` | Integer | VAT mode (0=from settings, 1=excl VAT, 2=incl VAT) |
| `CurncyCode` | String 5 | Currency code |
| `FrRate` | Val | Exchange rate FROM |
| `ToRateB1` | Val | Exchange rate TO base 1 |
| `ToRateB2` | Val | Exchange rate TO base 2 |
| `BaseRate1` | Val | Base rate 1 |
| `BaseRate2` | Val | Base rate 2 |
| `LangCode` | String | Language code |
| `Objects` | String | Tag/Object dimension codes |
| `SalesMan` | String | Salesperson code |
| `SalesGroup` | String | Sales group code |
| `BookOrigin` | String | Booking origin/channel code (links to BookOrgBlock) |
| `VisitPurpose` | String | Visit purpose code |
| `LengthClass` | String | Length-of-stay classification |
| `Comment` | String | Free text comment |
| `RefStr` | String | External reference string |
| `ResName` | String | Reservation name |
| `Resources` | String | Additional resources |
| `ResLoc` | String | Resource location |
| `BranchID` | String | Branch identifier |
| `LTxtCode` | String | Long text code |
| `CustContact` | String | Our contact person |
| `WaitlistPrio` | String | Waitlist priority |
| `RoomChangeFlag` | Integer | Room change indicator |
| `Newspapers` | String | Newspaper preference (from guest) |
| `CreditCard` | String | Credit card information |
| `PreAuthTransactionReference` | String | Pre-authorization reference |
| `AuthorizationCode` | String | Authorization code |
| `PreAuthorized` | Integer | Pre-authorization flag |
| `RequestType` | Integer | Request type |
| `LastTransferDate` | Date | Last charge transfer date |
| `LastTransferTime` | Time | Last charge transfer time |

**Row Fields (Guest rows -- matrix rows in JobVc):**

| Field | Type | Description |
|-------|------|-------------|
| `GuestCode` | String 20 | Guest contact code (links to CUVc with GuestActCode key) |
| `CUCode` | String 20 | Billing customer code for this guest |
| `CUName` | String 60 | Guest name |
| `CClass` | String | Customer classification (for class-based pricing) |
| `Status` | String | Guest-level status |
| `PriceList` | String | Guest-level price list override |
| `CheckInDate` | Date | Guest actual check-in date |
| `CheckInTime` | Time | Guest actual check-in time |
| `CheckOutDate` | Date | Guest actual check-out date |
| `CheckOutTime` | Time | Guest actual check-out time |

**Database Keys:**
- `SerNr` (primary)
- `RegDate` (for journal by registration date)
- `TransDate` (for journal by arrival date)
- `ResStatus` (for status filtering)
- `ResCode` + `Status` = `ResCodeStatus` (for room occupancy checks)
- `Mother:N` (composite key for sub-reservations, where N = mother SerNr)
- `MotherKey` (for looping daughters by Mother field)

---

### 1.2 JobPriceVc -- Daily Price Breakdown

**Purpose:** Stores the per-day price detail for each reservation. Created by the pricing engine when a reservation is saved/updated.

**Header Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Parent reservation serial number |
| `RecType` | Integer | Record type (0 = standard price record) |
| `RowNr` | Integer | Row number |

**Row Fields (per-day price matrix):**

| Field | Type | Description |
|-------|------|-------------|
| `TransDate` | Date | Start date for this price segment |
| `EndDate` | Date | End date for this price segment |
| `StartTime` | Time | Start time |
| `EndTime` | Time | End time |
| `StayDay` | Date | Specific stay day this price applies to |
| `NoOfGuests` | Integer | Number of guests for pricing |
| `Type` | String | Resource type |
| `ResUsage` | String | Room package |
| `PriceList` | String | Price list |
| `CurncyCode` | String | Currency |
| `ArtCode` | String | Item/Article code for the booking item |
| `VATCode` | String | VAT code |
| `vRebate` | Val | Discount percentage |
| `Price` | Val | Calculated unit price |
| `RackRatePrice` | Val | Published rack rate price |
| `Qty` | Val | Quantity |
| `Sum` | Val | Line total |
| `AgreedPrice` | Val | Agreed/negotiated price |
| `AgreedRebate` | Val | Agreed discount |
| `Person` | Integer | Person index |
| `PriceCalc` | Integer | Price calculation method |
| `PriceRules` | String | Price rules applied |
| `CClass` | String | Customer classification used |

---

### 1.3 ShopBaskVc -- Folio / Shopping Basket

**Purpose:** Accumulates all charges against a reservation (room charges, minibar, restaurant, extras). Acts as the intermediate billing register between the reservation and the invoice.

**Key Fields (from usage in code):**

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Basket entry serial number |
| `OwnerSerNr` | LongInt | Owner reservation number |
| `Owner` | Integer | Owner type (0=Customer, 1=Reservation, 2=Resort Event) |
| `OrdNr` | LongInt | Order number |
| `OrdRow` | LongInt | Order row |
| `ItemCode` | String | Item/article code |
| `Comment` | String | Description |
| `Qty` | Val | Quantity |
| `Price` | Val | Unit price (base currency) |
| `PriceInCur` | Val | Unit price in transaction currency |
| `Discount` | Val | Discount percentage |
| `CUCode` | String | Customer code (billing target) |
| `TransDate` | Date | Transaction date |
| `Destination` | Integer | Destination type (0=Order, 1=Invoice, 2=Quote) |
| `DestinationNr` | LongInt | Destination document number (-1 = not yet invoiced) |
| `BaskNo` | Integer | Basket/Folio number within the reservation |
| `CurncyCode` | String | Currency code |
| `FrRate` | Val | Exchange rate |
| `ToRateB1`/`ToRateB2`/`BaseRate1`/`BaseRate2` | Val | Additional exchange rates |
| `DownPayIVSerNr` | LongInt | Linked downpayment invoice number |

**Keys:** `OwnerSerNr` (composite with Owner)

---

### 1.4 ReservationStatusVc -- Reservation Status Register

**Purpose:** Defines the available reservation states and their types.

| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | Status code |
| `StatType` | Integer | Status type (2 = Cancellation) |

**Business Logic:** The system uses `ReserSeqVc` (Reservation Sequence) to define valid status transitions. `CheckedAllowedStatus()` validates that a status change follows the defined sequence.

---

### 1.5 ResVc -- Resource / Room Register

**Purpose:** Physical resources (hotel rooms, conference rooms, equipment).

| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | Resource code |
| `Name` | String | Resource name |
| `ResStatus` | String | Current resource status |
| `InvoiceBy` | Integer | Invoicing method (0=by hour, 1=by day) |
| `Smoking` | Integer | Smoking preference |
| `Blacklist` | Boolean | Blacklisted flag |

---

### 1.6 ResTypeVc -- Resource Type Register

**Purpose:** Categories of resources (room types: single, double, suite, etc.)

| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | Resource type code |
| `Comment` | String | Description |
| `OverbookPrc` | Val | Overbooking percentage allowed |
| `InvoiceBy` | Integer | Invoice method (0=hourly, 1=daily) |
| `MaxPersons` | Integer | Maximum persons |
| `MaxChildren` | Integer | Maximum children |
| `MaxPax` | Integer | Maximum total PAX |

---

### 1.7 ResUsageVc -- Room Package / Usage Register

**Purpose:** Defines room packages (B&B, half-board, full-board, etc.) with associated items.

| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | Package code |
| `Comment` | String | Description |
| `NoAdditionalToInv` | Integer | Don't add extras to invoice |
| `AddItemIncPrice` | Integer | Additional items included in price |
| `MessCkIn` | String | Check-in message/activity type |
| `MessCkOut` | String | Check-out message/activity type |

**Row Fields (Package Items):**

| Field | Type | Description |
|-------|------|-------------|
| `ArtCode` | String | Item code |
| `CodeType` | Integer | Frequency (0=once on first day, 1=daily, 2=once on last day) |
| `AddPer` | Integer | Add per-person (0=once total, 1=per guest) |
| `OBType` | String | Guest observation type to create |
| `MessageToHK` | String | Message to housekeeping |

---

### 1.8 PriceRulesVc -- Pricing Rules Register

**Purpose:** Complex pricing rules for reservations with restriction and charge type modifiers.

| Field | Type | Description |
|-------|------|-------------|
| `ArtCode` | String | Item code |
| `VATCode` | String | VAT code |
| `MinGuests` / `MaxGuests` | Integer | Guest count range |
| `MinStayDays` / `MaxStayDays` | Integer | Stay length range |
| `RestrictionType` | Integer | Who the rule applies to (Adults, Children, Guests) |
| `ChargeType` | Integer | Charging method (Fixed, PerAdult, PerChild, PerGuest) |

---

### 1.9 CClassDVc -- Customer Classification Discount

**Purpose:** Classification-based discount terms for pricing.

| Field | Type | Description |
|-------|------|-------------|
| `CClass` | String | Classification code |
| Discount/pricing fields | Various | Classification-specific pricing overrides |

---

### 1.10 FollowUpVc -- Follow-Up Register

**Purpose:** Tracks follow-up actions and notes against reservations.

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Follow-up serial number |
| `JobNr` | LongInt | Parent reservation number |
| `TransDate` | Date | Follow-up date |
| `NReservationStatus` | String | Status at time of follow-up |
| `MainPersons` | String | Responsible person |
| `OKFlag` | Integer | Completion flag (1 = done) |
| `Comment` | String | Follow-up notes |
| `Amount` | Val | Associated amount |

---

### 1.11 GuestObserVc -- Guest Observation Register

**Purpose:** Guest preferences, notes, and observations.

| Field | Type | Description |
|-------|------|-------------|
| `OBType` | String | Observation type code |
| `Person` | String | Person who recorded it |
| `Comment` | String | Observation text |
| `Type` | String | Category type |
| `StartDate` | Date | Start of validity |
| `EndDate` | Date | End of validity |
| `Guest` | String | Guest code |

---

### 1.12 ExcursionrsVc / ExcursionVc / TransferVc -- Event History

**Purpose:** Tracks excursion and transfer events linked to reservations.

| Field | Type | Description |
|-------|------|-------------|
| `JobNr` | LongInt | Linked reservation number |
| `EventNr` | LongInt | Event serial number |
| `FileName` | String | Record type ("ExcursionVc" or "TransferVc") |
| `TransDate` | Date | Event date |
| `StartTime` | Time | Start time |
| `EndTime` | Time | End time |
| `Comment` | String | Description |

---

### 1.13 ResEventTypeVc -- Reservation Event Type Register

**Purpose:** Event types associated with reservations (arrival events, departure events).

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Reservation serial number |
| `EventType` | String | Event type code (links to ExcurTypeVc) |

**Row structure:** Matrix of event types ordered by sequence (first row = arrival, last row = departure).

---

### 1.14 RepItemsVc -- Repeating Items Register

**Purpose:** Recurring items that are automatically charged to a reservation each day.

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Reservation serial number |

**Row Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `Item` | String | Item code |
| `Qty` | Val | Quantity |
| `Price` | Val | Price |
| `CUCode` | String | Customer code for billing |

---

### 1.15 PRVc -- Project Register

**Purpose:** Defines projects for time billing and cost tracking. Separate from hotel reservations.

| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | Project code |
| `Name` | String | Project name |
| `CurncyCode` | String | Project currency |

---

### 1.16 TBIVVc -- Time-Based Invoice (Project Transaction)

**Purpose:** Records project transactions that have been invoiced.

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Transaction serial number |
| `Row` | Integer | Row number |
| `PRCode` | String | Project code |
| `oVc` | Integer | Source register type (1=TimeSheet, 2=Vendor Invoice, 3=Expense, 4=Shipment, 5=Activity, 6=Return, 7=Service Order) |
| `TransDate` | Date | Transaction date |
| `ArtCode` | String | Item code |
| `Sum` | Val | Amount |
| `InvQty` | Val | Invoiced quantity |
| `Invoice` | LongInt | Invoice serial number |
| `EMCode` | String | Employee code |
| `CurncyCode` | String | Currency |

---

### 1.17 TBBUVc -- Time-Based Budget (Project Budget)

**Purpose:** Project budget records with cost category breakdown.

| Field | Type | Description |
|-------|------|-------------|
| `PRCode` | String | Project code |
| `TransDate` | Date | Budget date |
| `BudTime` | Integer | Budget time flag (include time costs) |
| `BudStocked` | Integer | Budget stocked items flag |
| `BudMaterial` | Integer | Budget materials flag |
| `BudOther` | Integer | Budget other costs flag |
| `CurncyCode` | String | Currency |

**Row Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `ArtCode` | String | Item code |
| `BudType` | Integer | Budget type (0=automatic, 2=manual override) |
| `Sum` | Val | Budgeted amount |
| `Qty` | Val | Budgeted quantity |
| `Invoiced` | String | Invoice reference when invoiced |

---

### 1.18 PRSOINVc -- Project Sales Order Invoice (COMMENTED OUT)

**Purpose:** Links project budget items to sales orders. Code is entirely commented out in `ProjSORn.hal`.

| Field | Type | Description |
|-------|------|-------------|
| `Project` | String | Project code |
| `Item` | String | Item code |
| `SOSerNr` | LongInt | Sales order serial number |
| `TransDate` | Date | Transaction date |
| `SOVal` | Val | Sales order value |
| `SOQty` | Val | Sales order quantity |

---

### 1.19 ProjInfoRepVc -- Project Information Report Record

**Purpose:** Configuration record for project information reports.

| Field | Type | Description |
|-------|------|-------------|
| `Signature` | String | Report author (defaults to CurrentUser) |

---

### 1.20 ActVc -- Activity Register (used for Projects)

**Purpose:** Activities that can also serve as project tracking entities when `TodoFlag = kTodoFlagProject (8)`.

**Key Fields (project context):**

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Activity serial number |
| `TransDate` | Date | Activity date |
| `ActType` | String | Activity type code |
| `MainPersons` | String | Responsible person |
| `CUCode` | String | Customer code |
| `CUName` | String | Customer name |
| `Resources` | String | Resource code |
| `Comment` | String | Description |
| `OKFlag` | Integer | Completion flag |
| `TodoFlag` | Integer | 8 = Project type |
| `PrivateFlag` | Integer | Privacy flag |
| `CalTimeFlag` | Integer | Calendar time flag |
| `StartTime` | Time | Start time |
| `EndTime` | Time | End time |
| `Invalid` | Integer | Invalidation flag |

---

### 1.21 HCUDVc -- Hotel Customer Deal

**Purpose:** Customer-specific deal terms for hotel reservations.

| Field | Type | Description |
|-------|------|-------------|
| `DownPayDeal` | String | Downpayment deal code |
| `DownPercent` | Val | Downpayment percentage |

---

### 1.22 ReserSeqVc -- Reservation Status Sequence

**Purpose:** Defines valid status transitions for reservations.

---

### 1.23 CompaniesBlock -- Multi-Company Support

**Purpose:** Used for multi-company reporting in reservation and project reports.

**Row Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `CompCode` | String | Company code |
| `CompName` | String | Company name |

---

## 2. Settings Blocks

### 2.1 HotelBlock -- Hotel Settings (PRIMARY)

The central configuration block for the hotel/reservation system.

| Field | Type | Description |
|-------|------|-------------|
| `DefSt` | String | Default reservation status for new bookings |
| `ChInSt` | String | Checked-in status code |
| `ChOutSt` | String | Checked-out status code |
| `NoshowStatus` | String | No-show status code |
| `FromResStatus` | String | Required resource status for check-in |
| `ToResStatus` | String | Resource status after check-out |
| `ClosedResStatus` | String | Closed resource status |
| `CheckIn` | Time | Default check-in time |
| `CheckOut` | Time | Default check-out time |
| `StartNewDay` | Time | Time when a new hotel day starts |
| `TempBook` | Integer | Temporary booking mode |
| `ChargeSource` | Integer | Charge to source/agent (0=charge to guest, 1=charge to agent) |
| `DiscItem` | String | Discount item code (for agreed price discrepancy) |
| `StoreWithPrice` | Integer | Store charges with pre-calculated prices |
| `JobInvoiceAddRsrvNo` | Integer | Add reservation number to invoice comments |
| `JobInvoiceAddRoomNo` | Integer | Add room number to invoice comments |
| `JobInvoiceAddDateFrom` | Integer | Add date-from to invoice comments |
| `JobInvoiceAddDateTo` | Integer | Add date-to to invoice comments |
| `CheckinMes` | String | Check-in activity type/message |
| `CheckoutMes` | String | Check-out activity type/message |
| `BasePriceInclVAT` | Integer | VAT mode override (0=from AccBlock, 1=excl, 2=incl) |
| `WebDownPayDeal` | String | Web booking downpayment deal |
| `WebDownPercent` | Val | Web booking downpayment percentage |
| `CClassDCType` | String | Customer classification type for adult pricing |
| `CClassDCTypeChild` | String | Customer classification type for child pricing |
| `CheckInDay` | Integer | Check-in day restrictions |

---

### 2.2 HotelDownPayBlock -- Hotel Downpayment Settings

| Field | Type | Description |
|-------|------|-------------|
| `ArtCode` | String | Downpayment item code |
| `VATCode` | String | VAT code for downpayment |
| `PayDeal` | String | Default payment deal |
| `Percentage` | String | Default downpayment percentage |
| `TextA` | String | Custom text for downpayment invoice line |
| `CalcMode` | Integer | Calculation mode (0=simple sum, 1=VAT-aware) |
| `DownForMotherRsrv` | Integer | Include daughter reservation totals in downpayment |
| `DownForMotherRsrvIncDaughDet` | Integer | Include daughter details on downpayment invoice |

---

### 2.3 HotelShiftsBlock -- Shift Configuration

| Field | Type | Description |
|-------|------|-------------|
| `Comment1`..`Comment5` | String | Shift names |
| `FrTime1`..`FrTime5` | Time | Shift start times |
| `ToTime1`..`ToTime5` | Time | Shift end times |

---

### 2.4 BookOrgBlock -- Booking Origin Register

**Row Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | Booking origin code |
| `Objects` | String | Default tag/objects for this booking channel |

---

### 2.5 JobSerBlockActions -- Job/Reservation Number Series

| Field | Type | Description |
|-------|------|-------------|
| `frNr` / `toNr` | LongInt | Number range |
| `FirstDate` / `LastDate` | Date | Date range validity |
| `DonotGenTrans` | Integer | Do not generate transactions flag |

---

### 2.6 AccBlock -- Accounts Receivable Settings

| Field | Type | Description |
|-------|------|-------------|
| `BasePriceInclVAT` | Integer | Global VAT mode |

---

### 2.7 ItemSettingBlock -- Item Settings

| Field | Type | Description |
|-------|------|-------------|
| `UpdCurPrWithDate` | Integer | Update currency prices with date changes |

---

## 3. Reports

### 3.1 FindJobRn -- Find Reservation Report

**Source:** `hal/Reports/FindJobRn.hal`
**Entry Point:** `FindJobRn(record RcVc RepSpec)`

**Purpose:** Search and list reservations with flexible filtering criteria.

**Filters:**
- `RepSpec.f1` -- Reservation number range
- `RepSpec.FirstAcc` -- Resource code range
- `RepSpec.f2` -- Guest profile range (searches row-level GuestCode)
- `RepSpec.f3` -- Customer code range
- `RepSpec.f4` -- Agent/Source code range
- `RepSpec.LastAcc` -- Exact reservation status
- `RepSpec.ObjStr` -- External reference match
- `RepSpec.flags[0]` -- Filter by check-in date in date range
- `RepSpec.flags[1]` -- Filter by check-out date in date range
- `RepSpec.flags[2]` -- Include sub-reservations
- `RepSpec.sStartDate` / `sEndDate` -- Date range
- `RepSpec.IncDaughter` -- Multi-company mode

**Output Columns:** SerNr, ResCode, TransDate, EndDate, ResStatus, CustomerCode, CustomerName

**Sub-report:** `PrintSubreservations()` -- recursively lists child reservations for group bookings.

---

### 3.2 JobJourRn -- Reservation Journal Report

**Source:** `hal/Reports/JobJourRn.hal`
**Entry Point:** `JobJourRn(record RcVc RepSpec)`

**Purpose:** Comprehensive reservation listing with financial totals and waitlist support.

**Filters:**
- `RepSpec.flags[0]` -- Sort/filter by RegDate (0) or TransDate (1)
- `RepSpec.f1` -- Reservation status filter
- `RepSpec.f2` -- Source/Agent filter
- `RepSpec.f3` -- Customer category filter
- `RepSpec.f4` -- Booking origin filter
- `RepSpec.f5` -- Room package (ResUsage) filter
- `RepSpec.f6` -- Price list filter
- `RepSpec.f7` -- Shift filter (uses HotelShiftsBlock)
- `RepSpec.flags[1]` -- Mother-only filter (exclude sub-reservations)
- `RepSpec.flags[2]` -- Include cancelled reservations
- `RepSpec.flags[4]` -- Time filter mode (0=start time, 1=end time)
- `RepSpec.flags[5]` -- Unassigned rooms only
- `RepSpec.flags[6]` -- Waitlist mode

**Key Feature:** Results are sorted by `WaitlistPrio` using `SortRecordArray()`.

**Output Columns:** SerNr, CUName, Source, SourceName, BookOrigin, Date Range, NrOfDays, ResStatus, Account Balance, ResCode, WaitlistPrio

**Financial:** Uses `GetCustAccount()` and `GetDownGuest()` for balance calculations.

---

### 3.3 JobFollowUpRn -- Reservation Follow-Up Report

**Source:** `hal/Reports/JobFollowUpRn.hal`
**Entry Point:** `JobFollowUpRn(Record RcVc RepSpec)`

**Purpose:** Lists all follow-up records for a specific reservation.

**Input:** `RepSpec.long1` -- Reservation serial number

**Output Columns:** FollowUp SerNr, Date, Status, MainPerson, OKFlag, Comment, Amount, Total

---

### 3.4 JobDietRemarksRn -- Guest Diet Remarks Report

**Source:** `hal/Reports/JobDietRemarksRn.hal`
**Entry Point:** `JobDietRemarksRn(Record RcVc RepSpec)`

**Purpose:** Lists dietary requirements and remarks for all guests in a reservation. Handles both normal and group reservations recursively.

**Input:** `RepSpec.long1` -- Reservation serial number

**Output Columns:** ResCode, GuestCode, GuestName, DietRemarks (from CUVc.DietRemarks)

**Behaviour:** For group reservations, recursively traverses all sub-reservations, skipping cancelled ones.

---

### 3.5 JobShopBaskRn -- Reservation Account / Folio Report

**Source:** `hal/Reports/JobShopBaskRn.hal`
**Entry Point:** `JobShopBaskRn(record RcVc RepSpec)`

**Purpose:** Comprehensive reservation account report showing all charges, invoices, payments, and balance per customer.

**Input:**
- `RepSpec.long1` -- Reservation serial number
- `RepSpec.flags[0]` -- Include agent account
- `RepSpec.f1` -- Filter by specific customer

**Logic:**
1. Shows header info (reservation number, dates, room)
2. For each billing customer (main customer, agent, individual guests):
   - Builds a virtual invoice (`SetupIVFromShopBask2`, `BuildIVFromShopBask2`)
   - Shows line items with item code, date, description, qty, price, discount, total
   - Lists already-paid amounts (`ListAlreadyPaid`)
   - Lists already-invoiced amounts (`ListAlreadyInvoiced`)
   - Calculates and displays balance
   - Shows linked activities (`PrintActivities`)

**Key Functions:**
- `ValidJobAccount()` -- Determines which customer accounts to show
- `PrintReceipts()` -- Shows downpayment receipt details
- `JobRepInvoice()` -- Formats invoice-style line item display

---

### 3.6 ChangeCustJobRn -- Change Customer / Folio Management Report

**Source:** `hal/Reports/ChangeCustJobRn.hal`
**Entry Point:** `ChangeCustJobRn(record RcVc RepSpec)`

**Purpose:** Interactive folio management -- displays current folio entries, allows creating new folios, and moving folio charges between customers/reservations.

**Key Features:**
- `ChangeJobCustMn()` -- Updating procedure that changes ShopBask customer codes
- `BuildFolioLists()` -- Builds folio number lists per customer
- `NewFolios()` / `NewFoliosDetails()` -- Shows available folio splits
- `CurrentFolioEntries()` / `CurrentFolioEntriesDetailes()` -- Lists all ShopBask entries
- `PrintCheckedInRsrvs()` -- Lists checked-in reservations for folio transfer
- Supports both Normal and Group reservations recursively
- Permission: `AllowMovingFoliotoRsrv`

---

### 3.7 EventHistJobRn -- Reservation Event History Report

**Source:** `hal/Reports/EventHistJobRn.hal`
**Entry Point:** `EventHistJobRn(record RcVc RepSpec)`

**Purpose:** Shows excursion and transfer events linked to a reservation.

**Input:** `RepSpec.f1` -- Reservation number range

**Output Columns:** Event number, Date, StartTime, EndTime, Comment (from ExcursionVc or TransferVc)

---

### 3.8 JobActRn -- Guest Activities/Observations Report

**Source:** `hal/Reports/JobActRn.hal`
**Entry Point:** `JobActRn(record RcVc RepSpec)`

**Purpose:** Lists guest observation records for a reservation.

---

### 3.9 ProjPLRn -- Project Price List Report

**Source:** `hal/Reports/ProjPLRn.hal`
**Entry Point:** `ProjPLRn(record RcVc RepSpec)`

**Purpose:** Displays item prices for a specific project with project-specific pricing overrides.

**Filters:**
- `RepSpec.f1` -- Project code (REQUIRED)
- `RepSpec.f2` -- Customer range
- `RepSpec.AccStr` -- Time class
- `RepSpec.FirstAcc` -- Item group
- `RepSpec.f3` -- Item range
- `RepSpec.f4` -- Item classification
- `RepSpec.ArtMode` -- Detail level
- `RepSpec.flags[0]` -- Sorting (0=Code, 1=Group, 2=Name)
- `RepSpec.flags[1]` -- Services only

**Logic:** Iterates through items, calls `GetProjectPrice()` with project code, item code, time class, and project currency. Displays price and discount per item.

---

### 3.10 ProjBonusRn -- Project Bonus Report

**Source:** `hal/Reports/ProjBonusRn.hal`
**Entry Point:** `ProjBonusRn(record RcVc RepSpec)`

**Purpose:** Calculates sales bonus on project invoices based on a percentage of invoiced amounts.

**Filters:**
- `RepSpec.sStartDate` / `sEndDate` -- Invoice period
- `RepSpec.vals0` -- Bonus percentage
- `RepSpec.flags[1]` -- Mode (0=invoiced, 1=paid only)
- `RepSpec.f1` -- Exclude item display groups
- `RepSpec.f2` -- Filter by employee code

**Logic:**
1. Loops through IPrsVc (Invoice Posting Summary) records in date range
2. For each invoice, finds linked TBIVVc project transaction records
3. Calculates bonus as `(invoiced_amount / 100) * bonus_percentage`
4. Also processes TBBUVc budget records with item type categorization
5. When "paid only" mode: checks if invoice is fully paid using `FindPaidAmount()` and AR balance checks

**Output Columns:** Project, Customer, Date, Transaction Reference, Invoice, Quantity, Amount, Currency, Bonus

---

### 3.11 ProjSORn -- Project Sales Order Report (COMMENTED OUT)

**Source:** `hal/Reports/ProjSORn.hal` -- ENTIRELY COMMENTED OUT

**Purpose:** Would have shown budget vs. actual comparison using PRSOINVc records linking projects to sales orders.

---

### 3.12 ActProjStatRn -- Activity/Project Statistics Report

**Source:** `hal/Reports/ActProjStatRn.hal`
**Entry Point:** `ActProjStatRn(record RcVc RepSpec)`

**Purpose:** Tracks activity/project state changes, type changes, and person changes over time with duration calculations.

---

## 4. Maintenances

### 4.1 CorrectJobIVMn -- Correct Invoice References

**Source:** `hal/Maint/CorrectJobIVMn.hal`
**Entry Point:** `CorrectJobIVMn(record RcVc RepSpec)` (updating)

**Purpose:** Repairs incorrect invoice references (DestinationNr) in ShopBaskVc records. Scans all shop basket entries and verifies their invoice links.

---

### 4.2 GrJobFromMoJobMn -- Group from Mother Reservation

**Source:** `hal/Maint/GrJobFromMoJobMn.hal`
**Entry Point:** `GrJobFromMoJobMn(record RcVc RepSpec)` (updating)

**Purpose:** Converts "mother" reservations (linked by Mother field) into proper group reservations (ReservationType = kReservationTypeGroup). This is a data migration/correction maintenance.

---

### 4.3 IVFromGroupJobMn -- Invoice from Group Job

**Source:** `hal/Maint/IVFromGroupJobMn.hal`
**Entry Point:** `IVFromGroupJobMn(record RcVc RepSpec)` (updating)

**Purpose:** Generates invoices from shop basket items belonging to group reservations.

---

### 4.4 ChangeJobCustMn -- Change Customer on Folio

**Source:** `hal/Reports/ChangeCustJobRn.hal` (combined with report)
**Entry Point:** `ChangeJobCustMn(Record RcVc RepSpec)` (updating)

**Purpose:** Changes the customer code on all ShopBaskVc entries for a reservation from one customer to another.

---

## 5. Documents

### 5.1 JobForm / Job1Form / Job2Form / Job3Form -- Reservation Confirmation

**Source:** `hal/Documents/DoJobForm.hal`, `hal/Documents/JobForm.hal`
**Entry Point:** `JobForm(record JobVc)` dispatches to `DoJobForm()`, `DoJob1Form()`, etc.

**Purpose:** Prints reservation confirmation documents with comprehensive booking details.

**Form Fields (F_ constants):**

| Constant | Description |
|----------|-------------|
| `F_SERNR` | Reservation serial number |
| `F_CHECKIN` | Check-in date |
| `F_CHECKOUT` | Check-out date |
| `F_RESOURCE` | Room/Resource code |
| `F_RESTYPE` | Resource type |
| `F_PRIS` | Price |
| `F_SUMMA` | Total amount |
| `F_STATUS` | Reservation status |
| `F_COMMENT` | Comment |
| `F_REFSTR` | Reference string |
| `F_PERSONS` | Number of persons |
| `F_CHILDREN` | Number of children |
| `F_CUNAME` | Customer name |
| `F_CUCODE` | Customer code |
| `F_AGENTNAME` | Agent name |
| `F_AGENTCODE` | Agent code |
| `F_NROFDAYS` | Number of days |
| `F_RESUSAGE` | Room package |
| `F_PRICELIST` | Price list |
| `F_BOOKORIGIN` | Booking origin |
| `F_VISITPURPOSE` | Visit purpose |
| `F_CURRENCYCODE` | Currency code |
| `F_TOTALSUM4` | Total including extras |
| `F_VATSUM` | VAT amount |
| `F_AGREEDPRICE` | Agreed price |
| `F_CREDITCARD` | Credit card reference |

**Document Features:**
- Combined booking confirmations for group reservations (lists all sub-reservations)
- Guest detail rows with check-in/out times
- Additional items from shop basket
- Downpayment information
- Multi-language support via LangCode

---

## 6. Business Logic & Workflows

### 6.1 Reservation Lifecycle

```
New Booking -> [DefSt] -> Confirmed -> [ChInSt] Check-In -> [ChOutSt] Check-Out
                 |                          |
                 +-> Cancelled (StatType=2) +-> No-Show [NoshowStatus]
```

**Status Sequence Validation:** `CheckedAllowedStatus(fromStatus, toStatus)` uses `ReserSeqVc` register to enforce valid transitions.

### 6.2 Check-In Process (`DoJobCheckIn` / `JobCheckInsmRemote`)

1. **Pre-validation:**
   - Resource must have status = `HotelBlock.FromResStatus`
   - Resource must not be closed (`ClosedResStatus`)
   - No other reservation checked into same room (`ResCodeStatus` key)
   - Date must be today unless `AllowCheckinBeforePlanned` permission granted
   - Reservation must be in an allowed pre-check-in status

2. **Check-in actions:**
   - Set `ResStatus` = `HotelBlock.ChInSt`
   - Update resource status
   - Set guest row statuses
   - Record check-in date/time on guest rows

3. **Group check-in:** `GroupJobCheckInsmRemote` recursively checks in all daughter reservations, handling nested groups.

4. **Post-check-in:** Display `CheckinMes` activity message (configurable per room package via `ResUsageVc.MessCkIn`).

### 6.3 Check-Out Process (`DoJobCheckOut` / `JobCheckOutsmRemote`)

1. **Pre-validation:**
   - Must be in allowed status for check-out
   - Account must have open charges (IsAccountOK check)
   - All charges must be invoiced (`AllowCheckout` checks for uninvoiced ShopBask entries)
   - Date must be today unless `AllowCheckoutBeforePlanned` permission granted

2. **Check-out actions:**
   - Set `ResStatus` = `HotelBlock.ChOutSt`
   - Update resource status to `HotelBlock.ToResStatus`
   - Update loyalty miles (`UpdateMiles`)
   - Transfer telephone calls (`TelCallsJobLoop`)
   - Load final-day extra items (frequency type 2)
   - Update guest row statuses
   - Cascade to sub-reservations (`StateChangeDaughters`)

3. **Group check-out:** Recursive, same pattern as check-in.

### 6.4 Charge Stay Process (`ChargeJob` / `JobToShopBask`)

**Purpose:** Transfer room charges from the reservation into the shop basket (folio).

1. **Calculate charge period:**
   - From: `LastTransferDate`/`LastTransferTime` (or TransDate/StartTime if first charge)
   - To: Current date/time (or EndDate for full-stay charge)

2. **Price Resolution (two paths):**
   - **With JobPriceVc:** If daily prices exist, use pre-calculated per-day prices from `JobPriceVc` rows. Each day becomes a separate shop basket entry.
   - **Without JobPriceVc:** Calculate using `FillFullJobPriceArray()` for bulk pricing with price rules.

3. **Discount handling:**
   - If `AgreedPrice` is set and differs from calculated price, and `HotelBlock.DiscItem` is configured, a separate discount line is created.
   - Alternatively, `AgreedDiscount` percentage is applied.

4. **Extra items:**
   - `LoadExtraItems()` processes `ResUsageVc` (room package) rows by frequency:
     - Type 0: Once on first day
     - Type 1: Every day
     - Type 2: Once on last day
   - Quantities are per-person or per-reservation based on `AddPer` flag
   - Guest observations can be auto-created from package items

5. **Repeating items:** `LoadRepItems()` charges items from `RepItemsVc`.

6. **Update tracking:** `LastTransferDate`/`LastTransferTime` are updated to prevent double-charging.

### 6.5 Invoicing Process (`InvoiceJob` from DSM)

1. Build virtual invoice from shop basket: `SetupIVFromShopBask2()` + `BuildIVFromShopBask2()`
2. Present invoice for review/approval
3. Create IVVc (Invoice) record
4. Update ShopBask `DestinationNr` to point to invoice
5. Link invoice to reservation via record links

### 6.6 Downpayment Process (`SetupJobDownPayInv2`)

1. **Determine downpayment terms:** Check customer deal (`HCUDVc`), then agent deal, then hotel defaults (`HotelDownPayBlock`).
2. **Calculate amount:** Percentage of `TotalSum4` (optionally including daughter reservation totals).
3. **Deduct existing downpayments:** Check shop basket for existing downpayment items.
4. **Create downpayment invoice:** Type = `kInvoiceTypeDownpayment`, with reservation details as description lines.
5. **Link to reservation:** Create bidirectional record links.

### 6.7 Group Reservation Management

**Group Structure:**
- Parent reservation: `ReservationType = kReservationTypeGroup`, `Mother = -1`
- Child reservations: `ReservationType = kReservationTypeNormal`, `Mother = parent.SerNr`
- Nested groups allowed: Child can also be `kReservationTypeGroup`

**Operations:**
- `GroupCreateSubJobRemote` -- Create new empty sub-reservation under a group
- `GroupDuplicateSubJobRemote` -- Duplicate an existing reservation as a sub-reservation
- `GroupMoveSubJobRemote` -- Move sub-reservations between groups
- `GroupAddSubJobRemote` -- Add existing reservations to a group
- `AssignGroupJobRemote` -- Assign reservations to a group
- `SplitResRemote` -- Split a reservation (creates new linked reservation)
- `UpdateJobChilds` -- Cascades parent changes to children (dates, prices, status, customer, objects, etc.)

**Validation:** `ValidateSubJobs()` checks each sub-job with `JobVcRecordCheck2()` before batch operations.

### 6.8 Pricing Engine (`CreateJobPrices` / `JobSumup`)

**`JobSumup` calculates:**
1. `Sum4ExclDisc` = Stay value before discount (via `ValueStayJob` with `allowDiscount=true`)
2. `Sum4` = Stay value after discount (via `ValueStayJob` with `allowDiscount=false`)
3. `PLPrice` = Price list price
4. `VatSum` = VAT on stay
5. `TotalSum4` = Sum4 + package extra items (via `AddUsageItems`)
6. `TotalVatSum` = VatSum + extra item VAT
7. `NrOfDays` = Calculated from dates
8. `Pax` = Persons + Children (in Enterprise)

**`CreateJobPrices` (in JobPricesVcRActions) builds JobPriceVc:**
1. Calls `CreateJobPricesFromPriceRules()` if `PriceRulesVc` records exist
2. Applies per-day pricing with customer classification discounts (`CClassDVc`)
3. Handles restriction types (Adults, Children, Guests) and charge types (Fixed, PerAdult, PerChild, PerGuest)

### 6.9 Customer/Guest Paste Logic

**`PasteCUCodeToJob2` (customer assignment):**
- Sets PriceList from customer, then from customer category
- Sets CUName, LangCode
- Applies BookOrigin from customer (with object management)
- Applies rebate/discount code
- Sets currency and exchange rates
- Optionally adds guest row (for StandardHotel product or GuestType customers)

**`PasteSourceToJob` (agent assignment):**
- Sets SourceName, PriceList, LangCode
- Applies BookOrigin from agent
- Adds agent objects to reservation objects

**`JobVc_PasteGuestCode` (guest row assignment):**
- Validates guest exists (via GuestActCode key)
- Checks blacklist
- Sets guest name, customer code, language, newspaper preference
- Sets guest status to hotel default
- Applies guest price list and customer classification for pricing

### 6.10 Overbooking Logic

`CheckOverbookings()` (in JobVcRecAction2):
- For each resource type, counts existing reservations in the date range
- Compares against type capacity with `OverbookPrc` tolerance
- Warns but does not block if overbooking detected

### 6.11 Room Collision Detection

`PasteDefaultRoomForAgent()` (in JobVcRecAction2):
- When an agent is assigned, auto-assigns a room if no room conflicts exist
- Checks for existing reservations on the same room for the same dates

### 6.12 Permission Checks

The system uses `UserCanAction()` for fine-grained access control:

| Permission | Description |
|------------|-------------|
| `JobChargeStay` | Allow charging stay to folio |
| `JobCheckIn` | Allow check-in operation |
| `JobCheckOut` | Allow check-out operation |
| `ChangePrices` | Allow modifying price details |
| `AllowCheckinBeforePlanned` | Allow early check-in |
| `AllowCheckoutBeforePlanned` | Allow early check-out |
| `AllowMovingFoliotoRsrv` | Allow transferring folios between reservations |

### 6.13 Multi-Company Support

Both `FindJobRn` and `JobJourRn` support `RepSpec.IncDaughter` mode for multi-company reporting:
- Loads `CompaniesBlock` to get all companies
- Iterates through each company with `SetCompanyCode()`
- Runs report for each company
- Resets with `ResetCompany()`

---

## 7. Enums & Constants

### 7.1 Core Enums from haldefs.h

```c
enum kReservationType {
  kReservationTypeNormal = 0,
  kReservationTypeGroup = 1
};

enum kShopBaskOwnerType {
  kShopBaskOwnerCustomer = 0,
  kShopBaskOwnerReservation = 1,
  kShopBaskOwnerRsrtEvent = 2
};

enum kShopBaskDestinationType {
  kShopBaskDestinationOrder = 0,
  kShopBaskDestinationInvoice = 1,
  kShopBaskDestinationQuote = 2
};

enum kInvoiceType {
  kInvoiceTypeNormal = 1,
  kInvoiceTypeCash = 2,
  kInvoiceTypeCredit = 3,
  kInvoiceTypeInterest = 4,
  kInvoiceTypeDebit = 5,
  kInvoiceTypeDownpayment = 6,
  kInvoiceTypePrepayment = 7,
  kInvoiceTypeNormalSpecialSales = 8,
  kInvoiceTypeCreditSpecialSales = 9,
  kInvoiceTypeCashInvoiceReceiptPRT = 10,
  kInvoiceTypeEmployee = 11,
  kInvoiceTypeCreditCard = 12,
  kInvoiceTypeMobilePayment = 13
};

enum kInvoiceRowType {
  kInvoiceRowTypeNormal = 1,
  kInvoiceRowTypeDownpayment = 5,
  kInvoiceRowTypeStructuredItemComponent = 32,
  // ... (30+ row types)
};

enum kItemType {
  kItemTypePlain = 0,
  kItemTypeStocked = 1,
  kItemTypeStructured = 2,
  kItemTypeService = 3
};

enum kIPrsTransType {
  kIPrsTransTypeInvoice = 0,
  kIPrsTransTypeReceipt = 1,
  kIPrsTransTypeNLTransaction = 2,
  kIPrsTransTypePurgeNLTransaction = 7
};

// Product family identification
kProductFamilyBooksJobCosting = 25;
kJobVc = 2;               // Register type ID
kTodoFlagProject = 8;     // Activity record flag for projects
kResourceTypeProject = 3; // Resource type for projects
kResourcePRVc = 4;        // Resource register for projects
typStdProjects = 52;      // Standard product type
```

### 7.2 Reservation Status Types (from ReservationStatusVc.StatType)

| Value | Meaning |
|-------|---------|
| 0 | Normal/Active status |
| 1 | (Reserved for other uses) |
| 2 | Cancellation status |

### 7.3 ResUsage Row CodeType (Package Item Frequency)

| Value | Meaning |
|-------|---------|
| 0 | Once on first day of stay |
| 1 | Every day during stay |
| 2 | Once on last day of stay |

### 7.4 PriceRules Restriction Types

| Type | Meaning |
|------|---------|
| Adults | Applies to adult guests only |
| Children | Applies to child guests only |
| Guests | Applies to all guests |

### 7.5 PriceRules Charge Types

| Type | Meaning |
|------|---------|
| Fixed | Fixed amount per stay |
| PerAdult | Amount per adult per night |
| PerChild | Amount per child per night |
| PerGuest | Amount per guest per night |

### 7.6 TBIVVc.oVc -- Project Transaction Source Types

| Value | Source Register |
|-------|----------------|
| 1 | TimeSheet (TSVc) |
| 2 | Vendor Invoice (VIVc) |
| 3 | Expense (ExpVc) |
| 4 | Shipment (SHVc) |
| 5 | Activity (ActVc) |
| 6 | Return (RetVc) |
| 7 | Service Order (SDVc) |

### 7.7 TBBUVc.BudType -- Budget Entry Types

| Value | Meaning |
|-------|---------|
| 0 | Automatic (system-generated) |
| 2 | Manual override |

---

## 8. Cross-Module Integration

### 8.1 Accounts Receivable (AR)

- **Invoice generation:** Reservations create invoices (IVVc) via `InvoiceJob` and `SetupIVFromShopBask`
- **Downpayment invoices:** `kInvoiceTypeDownpayment` invoices linked to reservations
- **AR balance:** `ARRnGetInvBalance()` checks outstanding amounts
- **Payment tracking:** `IPVc` (payment records) linked via `CUPNr` = reservation SerNr
- **Pre-payments:** `ARPayHistVc` tracks prepayment history against reservations
- **Credit notes:** `ListCreditNotes()` handles credit invoice processing

### 8.2 Customer / Contact (CU)

- **Guest register:** CUVc with `GuestActCode` key for guest-specific lookup
- **Blacklist:** `CUVc.Blacklist` checked during guest assignment
- **Diet remarks:** `CUVc.DietRemarks` for dietary reporting
- **Customer classification:** `CUVc.Classification` and `CUVc.CustCat` for pricing
- **Rebate codes:** `CUVc.RebCode` links to `RebVc` for discount terms
- **Agent handling:** Source field links to agent-type customers
- **Guest type:** `CUVc.GuestType` / `CUVc.CUType` determines if customer is a guest

### 8.3 Item / Product (IN)

- **Booking items:** Resource types map to items for charging
- **Package items:** ResUsageVc rows reference items
- **Discount items:** `HotelBlock.DiscItem` for agreed-price discrepancies
- **Downpayment items:** `HotelDownPayBlock.ArtCode`
- **Pricing:** `GetItemPriceDiscount3()` for complex price resolution with multiple factors
- **Item types:** Service items (type 3) for time billing, Stocked (type 1) for materials, Plain (type 0) for other costs

### 8.4 Activity (Act)

- `MakeActFromJob` / `MakeActFromRes` creates activities from reservations
- Activities linked to reservations via CUCode and Resources fields
- Project activities use `TodoFlag = kTodoFlagProject`
- Check-in/out messages configured as activity types

### 8.5 Nominal Ledger / General Ledger

- Tag/Object accounting via `Objects` field on all records
- Sales accounts determined by `GetItemSalesAcc()`
- VAT handling via `MulVATIV()` with multiple VAT modes
- Cost center tracking through objects

### 8.6 Sales (SO/IV)

- Shop basket entries can target orders or invoices
- Invoice types: Normal, Cash, Downpayment, Credit, Special Sales
- Record links between reservations and invoices (bidirectional)
- `UpdateJobFromIV()` updates reservation from invoice changes

### 8.7 Projects Module

- `PRVc` for project definitions with currency
- `TBIVVc` accumulates project transactions from 7 source registers
- `TBBUVc` manages project budgets by cost category
- `GetProjectPrice()` for project-specific pricing
- `GetTimeClassPrice()` for time-class-based pricing
- `GetTIPrice()` for time invoice pricing
- Bonus calculation across project transactions
- Integration with Activities for project time tracking

### 8.8 Multi-Currency

- Full multi-currency support with 5 exchange rate fields
- `GetFullCurncyRate()` / `GetFullCurncyRateDate()` for rate lookup
- `MulRateToBase1()` / `Base1ToOther()` for currency conversion
- Currency inherited from customer, or set at reservation level
- Group reservations propagate currency to sub-reservations

### 8.9 SMS/Notifications

- `JobVcRecActionClient` references SMS notification capabilities
- Triggered by reservation status changes

### 8.10 Excursions/Transfers

- `ExcursionVc` / `TransferVc` linked to reservations via `ExcursionrsVc`
- Event history report shows all linked events

---

## 9. Nexa ERP Implications

### 9.1 Module Architecture Decision

**CRITICAL: Split into two separate concerns:**

1. **Booking/Reservation Module** (if needed for service-based UK SMEs):
   - Resource scheduling and availability
   - Booking lifecycle (create, confirm, check-in, check-out, cancel)
   - Customer/guest management with multi-folio billing
   - Package/bundle pricing
   - Group bookings with hierarchical structure
   - Integration with invoicing

2. **Project Costing Module** (more relevant for UK SME ERP):
   - Project register with budgets
   - Time recording and billing
   - Multi-source cost accumulation (time, materials, expenses, shipments, activities, service orders)
   - Budget vs. actual tracking
   - Project-specific pricing
   - Bonus/commission calculation
   - Integration with invoicing

### 9.2 Relevant Features for Nexa ERP (UK SME Focus)

**From Reservations (adapt for service booking):**
- Status-sequence-driven workflow engine (configurable valid transitions)
- Multi-level group/hierarchical structure pattern
- Shop basket / folio pattern for charge accumulation before invoicing
- Downpayment/deposit processing with configurable percentages
- Multi-currency with full exchange rate management
- Permission-based access control on key operations
- Multi-company reporting

**From Project Costing (directly applicable):**
- Project register with budget categories (Time, Materials, Stocked, Other)
- Time billing integration
- Multi-source cost accumulation from 7 transaction types
- Project-specific pricing overrides
- Bonus/commission calculation on invoiced or paid amounts
- Budget vs. actual comparison (even though ProjSORn is commented out, the data model supports it)

### 9.3 Data Model Patterns to Adopt

1. **Charge Accumulation Pattern (ShopBaskVc):**
   - Intermediate register between service delivery and invoicing
   - Allows review, modification, and customer assignment before invoicing
   - Supports multiple billing targets per booking
   - Tracks invoicing status via DestinationNr

2. **Hierarchical Booking Pattern:**
   - Mother/Child relationship via Mother field
   - Recursive operations (check-in, check-out, charge, report)
   - Parent propagation of shared attributes (dates, customer, currency)
   - Individual child customization (room, guests, pricing)

3. **Status Sequence Pattern (ReserSeqVc):**
   - Configurable status codes with types (active, cancelled)
   - Valid transition matrix
   - Status-dependent field editability
   - Status-dependent operation availability

4. **Pricing Rule Pattern:**
   - Multi-level pricing: item price -> customer price -> customer classification -> agreed price -> discount
   - Per-day price records for variable pricing
   - Restriction types and charge types for complex per-person pricing
   - Package items with frequency-based loading

### 9.4 Features to OMIT for UK SME ERP

- Hotel-specific: Room overbooking percentage, smoking preferences, newspaper preferences
- Resort-specific: Excursions, transfers, event history
- Guest observation system (too hotel-specific)
- Waitlist priority management
- Hotel shift-based filtering
- Credit card pre-authorization handling
- Room switch / split reservation (unless adapting for general resource management)

### 9.5 Database Considerations

- **Number series:** Job number series with date ranges and DonotGenTrans flag -- adapt for document numbering
- **Record linking:** Bidirectional record links between reservations and invoices -- implement as a generic linking mechanism
- **Matrix rows:** Guest rows within JobVc -- implement as a proper child table (e.g. `booking_guests`)
- **Composite keys:** `Mother:N` pattern for parent-child lookups -- use standard foreign keys in PostgreSQL
- **Multi-company:** CompaniesBlock iteration pattern -- handled by database-per-tenant in Nexa

### 9.6 Exports Identified

- **JobJourEn** (`hal/Exports/JobJourEn.hal`): Export reservation journal data (SerNr, CUName, BookOrigin, Source, dates, status, amounts)
- **JobflowEn** (`hal/Exports/JobflowEn.hal`): Export reservation flow data by date periods (sums, persons, person-nights)

These should inform the Reporting module's export API design.

---

## Appendix: Source Files Analysed

### Record Actions (RActions)
- `hal/RActions/JobVcRecAction.hal` -- Core reservation record validation, save, update, remove, defaults
- `hal/RActions/JobVcRecAction2.hal` -- Overbooking checks, agent room collision
- `hal/RActions/JobVcRecActionClient.hal` -- Client-side record actions, similar reservation warning, SMS
- `hal/RActions/JobPricesVcRActions.hal` -- Daily price engine, price rules processing
- `hal/RActions/JobPriceVcRActionClient.hal` -- Client-side price update triggers
- `hal/RActions/JobSerBlockActions.hal` -- Number series validation
- `hal/RActions/ProjInfoRepVcRAction.hal` -- Project info report defaults

### Window Actions (WActions)
- `hal/WActions/JobVcWAction.hal` -- Field edit handlers, after-edit logic
- `hal/WActions/JobPriceVcWactions.hal` -- Price detail window handlers
- `hal/WActions/JobDsm.hal` -- Menu commands (charge, check-in/out, invoice, group operations)
- `hal/WActions/JobDsm2.hal` -- Group date change, group invoice
- `hal/WActions/JobDsmTools.hal` -- Status sequence validation, activity creation

### Documents
- `hal/Documents/DoJobForm.hal` -- Reservation confirmation document
- `hal/Documents/JobForm.hal` -- Document dispatcher

### Maintenances
- `hal/Maint/CorrectJobIVMn.hal` -- Invoice reference repair
- `hal/Maint/GrJobFromMoJobMn.hal` -- Mother-to-group conversion
- `hal/Maint/IVFromGroupJobMn.hal` -- Group invoice generation

### Reports
- `hal/Reports/FindJobRn.hal` -- Find reservation search
- `hal/Reports/JobJourRn.hal` -- Reservation journal
- `hal/Reports/JobFollowUpRn.hal` -- Follow-up listing
- `hal/Reports/JobDietRemarksRn.hal` -- Guest dietary remarks
- `hal/Reports/JobShopBaskRn.hal` -- Reservation account/folio
- `hal/Reports/ChangeCustJobRn.hal` -- Customer/folio management
- `hal/Reports/EventHistJobRn.hal` -- Event history
- `hal/Reports/JobActRn.hal` -- Guest observations
- `hal/Reports/ProjPLRn.hal` -- Project price list
- `hal/Reports/ProjBonusRn.hal` -- Project bonus calculation
- `hal/Reports/ProjSORn.hal` -- Project sales order (COMMENTED OUT)
- `hal/Reports/ActProjStatRn.hal` -- Activity/project statistics

### Exports
- `hal/Exports/JobJourEn.hal` -- Reservation journal export
- `hal/Exports/JobflowEn.hal` -- Reservation flow export

### Tools
- `hal/Tools/JobVcWActionTools.hal` -- Core operational tools (pricing, charging, check-in/out, group management, customer paste, shop basket building)
- `hal/Tools/JobVcWActionTools2.hal` -- Remote operation tools (check-in/out, charge, group CRUD, split, currency)
- `hal/Tools/JobReportsTools.hal` -- Report helper tools (invoice listing, payment listing, cancellation detection, person/room counting, group child updates, event retrieval)
- `hal/Tools/InvJobDownP.hal` -- Downpayment invoice creation and receipt setup

### Header Definitions
- `amaster/haldefs.h` -- Enum definitions for reservation types, shop basket types, invoice types, item types, product families
