# HansaWorld CRM Module -- Deep-Dive Findings

> Extracted from HAL source code (legacy-src/c8520240417) and HansaManuals documentation.
> Date: 2026-02-15

---

## 1. Registers (Entities)

### 1.1 Lead Register (CULeadVc / CUVc with LeadType flag)

**Key architectural insight**: In HansaWorld, Leads are NOT a separate register. They are Contact/Customer records (CUVc) where `CUType = 0` and `LeadType != 0`. The Lead window (CULeadDClass) is a specialised view of the same Contact record, showing only Lead-relevant fields. When a Lead is "converted" to a Customer, the system simply changes `CUType` from `0` to `1` on the same record.

**Header Fields** (from CULeadVcWAction.hal, LeadTools.hal, LeadListRn.hal):

| Field | Type | Purpose |
|-------|------|---------|
| Code | String (20) | Unique Lead identifier |
| Name | String | Company/Lead name |
| Person | String | Primary contact person |
| InvAddr0..InvAddr4 | String | Invoice/billing address lines (5 lines) |
| DelAddr0..DelAddr4 | String | Delivery address lines (5 lines) |
| Phone | String | Phone number |
| Fax | String | Fax number |
| Mobile | String | Mobile number |
| eMail | String | Email address |
| Status | String (code) | Lead status (lookup to LeadStatusVc) |
| StatusComment | String | Auto-filled from LeadStatusVc.Comment |
| Source | String (code) | Lead source (lookup to LeadSourceVc) |
| SourceComment | String | Auto-filled from LeadSourceVc.Comment |
| Industry | String (code) | Industry classification (lookup to IndustryVc) |
| IndustryComment | String | Auto-filled from IndustryVc.Comment |
| ItemClassification | String (code) | Product interest classification (lookup to DIVc) |
| ItemClassificationName | String | Auto-filled from DIVc.Name |
| Partner | String (code) | Referring partner (lookup to CUVc) |
| PartnerName | String | Auto-filled from partner CUVc.Name |
| Rating | Enum (kLeadRating) | Cold/Warm/Hot rating |
| SalesMan | String | Assigned salesperson |
| CUType | Integer | 0 = Lead, 1 = Customer (controls conversion) |
| LeadType | Integer | Non-zero = treated as Lead in Standard CRM |
| Classification | String | Free-text classification tags |
| Sorting | String | Sort/grouping field |
| Comment | String | General comments |
| WarnText1 | String | Warning text displayed on access |
| CurncyCode | String (5) | Default currency |
| CountryCode | String | Country code |
| TheirCode | String | Customer's own reference |
| CustCat | String | Customer Category (set on conversion) |
| PayDeal | String | Payment terms (set on conversion) |
| Region | String | Sales region (set on conversion) |
| CreditLimit | Val | Credit limit (set on conversion) |
| CreditLimitDays | Integer | Credit limit days (set on conversion) |
| DateCreated | Date | Auto-set on record creation |
| DateChanged | Date | Auto-set on record update |

**Business Rules**:
- Code is mandatory (validation in LeadVcRecordCheck)
- DateCreated is auto-populated on save (LeadVcRecordSave)
- DateChanged is auto-populated on update (LeadVcRecordUpdate)
- When filtering for LeadList report in Standard CRM, only records where `LeadType != 0` are shown

### 1.2 Campaign Register (CampaignVc)

**Header Fields** (from CampaignVcRAction.hal, CampaignVcWAction.hal, CampaignTools.hal):

| Field | Type | Purpose |
|-------|------|---------|
| Code | String | Unique Campaign identifier (mandatory) |
| Status | Enum (kCampaignStatus) | Pending/Started/Finished |
| StatusComment | String | Auto-filled from CampaignStatusVc.Comment |
| MediaType | String (code) | Media type used (lookup to MediaTypeVc) |
| MediaComment | String | Auto-filled from MediaTypeVc.Comment |
| DateCreated | Date | Auto-set on creation |

**Matrix/Row Structure** (row CampaignVc):

| Row Field | Type | Purpose |
|-----------|------|---------|
| CodeType | Enum (kCampaignRowCodeType) | Lead (0) or Customer (1) |
| Code | String | Lead code or Customer code |
| Name | String | Auto-filled from Lead/Customer name |
| Person | String | Auto-filled from Lead/Customer contact |

**Business Rules**:
- Code is mandatory
- DateCreated auto-set on save
- When pasting a Code in the matrix, the system checks CodeType to determine whether to look up from Lead (CULeadSClass) or Customer (CUSClass) paste special
- Can create a Letter (LetVc) from a Campaign, which is record-linked back to the Campaign

### 1.3 Opportunity Register (OYVc)

**Key architectural insight**: The Opportunity in HansaWorld is a full quotation-like document with line items, pricing, tax calculations, currency handling, and approval workflows. It is a sales-process document that can be converted into Quotations, Orders, or Invoices.

**Header Fields** (from OYVcWAction.hal, OYVcRAction.hal, OYDsm.hal):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Unique serial number (auto-generated from Number Series) |
| OYDate | Date | Opportunity date |
| CustCode | String (20) | Customer/Lead code (must be valid CUVc with CUType=1 or LeadType!=0) |
| Addr0..Addr3 | String | Invoice address (name, street, city, postal) |
| InvAddr3, InvAddr4 | String | Additional invoice address fields |
| ShipAddr0..ShipAddr3 | String | Delivery address fields |
| DelAddr3, DelAddr4 | String | Additional delivery address fields |
| Phone | String | Customer phone |
| Fax | String | Customer fax |
| CustContact | String | Customer contact person |
| SalesMan | String | Assigned salesperson |
| SalesGroup | String | Sales group |
| OurContact | String | Our contact person |
| CurncyCode | String (5) | Currency code |
| FrRate, ToRateB1, ToRateB2 | Val | Exchange rates (from/to base 1/2) |
| BaseRate1, BaseRate2 | Val | Base currency rates |
| PayDeal | String | Payment terms code |
| PriceList | String | Price list code |
| InclVAT | Integer | Prices include VAT flag |
| ExportFlag | Integer | Export/domestic flag |
| CustCat | String | Customer category |
| LangCode | String | Language code for documents |
| QuoteClass | String | Opportunity class/type |
| Rejected | Integer | 0=Open, 1=Rejected/Lost, 2=Won/Accepted |
| RejectDate | Date | Date of rejection/acceptance decision |
| Probability | Val | Win probability percentage |
| Closed | Integer | 0=Open, 1=Closed |
| ValidUntilDate | Date | Validity expiry date |
| MakeContactDate | Date | Next follow-up/contact date |
| Comment | String | General comments |
| Objects | String | Account dimension objects |
| PRCode | String | Project code |
| Location | String | Warehouse/Location |
| BranchID | String | Branch ID |
| DiscPerc | Val | Overall discount percentage |
| DiscSum | Val | Discount amount |
| Sum1 | Val | Subtotal (excl or incl VAT per setting) |
| Sum3 | Val | VAT amount |
| Sum4 | Val | Grand total |
| BaseSum4 | Val | Grand total in base currency |
| TotGP | Val | Total gross profit |
| TotQty | Val | Total quantity |
| TotWeight | Val | Total weight |
| TotVolume | Val | Total volume |
| SumTime | Val | Budget: time cost |
| SumOther | Val | Budget: other cost |
| SumStocked | Val | Budget: stocked items cost |
| SumMaterial | Val | Budget: material cost |
| BudTime | Integer | Budget time flag |
| BudOther | Integer | Budget other flag |
| BudStocked | Integer | Budget stocked flag |
| BudMaterial | Integer | Budget material flag |
| OrderNr | LongInt | Linked sales order number (-1 = none) |
| VATNr | String | Customer VAT number |
| InvoiceToCode | String | Invoice-to customer code |
| RebCode | String | Rebate/discount code |
| Markup | String | Global markup string |
| DaysToDelivery | Integer | Estimated delivery days |
| PlanShip | String | Planned shipment (date or week) |
| PlanShipDate | Date | Planned shipment as proper date |
| ShipDeal | String | Shipping terms |
| ShipMode | String | Shipping mode |
| InvCountry | String | Invoice country code |
| InvCountryName | String | Invoice country name |
| DelCountry | String | Delivery country code |
| DelCountryName | String | Delivery country name |
| DelAddrCode | String | Named delivery address code |
| BankCode | String | Bank/payment operator |
| NoTax1 | Integer | No Tax 1 flag |
| NoTAXonVAT | Integer | No tax on VAT flag |
| TotalwoTAX | Integer | Total without tax flag |
| AcceptanceBy | String | Approval assigned to |
| AcceptanceFYI | String | Approval FYI recipients |
| RegDate | Date | Registration/last-modified date |
| RegTime | Time | Registration time |
| LocalMachineCode | String | Machine that created the record |
| ProformaOfficialSerNr | String | Proforma invoice official number |
| ProformaOfficialSerNrSerie | String | Proforma number series |
| OrgCust | String | Original customer (for invoice-to scenarios) |
| Priority | String | Priority level |

**Matrix/Row Structure** (row OYVc):

| Row Field | Type | Purpose |
|-----------|------|---------|
| stp | Integer (kInvoiceRowType) | Row type (Normal=1, Hidden, Subtotal=9, StructuredComponent, Header=17) |
| ArtCode | String | Item/Article code |
| Spec | String | Item description/specification |
| Quant | Val | Quantity |
| Price | Val | Unit price |
| BasePrice | Val | Cost price (for GP calculation) |
| PriceFactor | Val | Price factor/multiplier |
| vRebate | Val | Row discount percentage |
| Sum | Val | Row total |
| VATCode | String | VAT code |
| TaxTemplateCode | String | Tax template code |
| SalesAcc | String | Sales account |
| Objects | String | Row-level dimension objects |
| Salesmen | String | Row-level salesperson |
| EMCode | String | Employee code (for project items) |
| TimeClass | String | Time class (for project items) |
| Markup | String | Row markup |
| UnitCode | String | Unit of measure |
| UnitFactQuant | Val | Unit factor quantity |
| UnitFactPrice | Val | Unit factor price |
| UnitXval, UnitYval, UnitZval | Val | Dimension values (length/width/height) |
| SerialNr | String | Serial number |
| Invoiced | LongInt | Invoice serial number (-1 = not invoiced) |
| Invd | Val | Invoiced amount |
| InvDate | Date | Invoice date |
| rowGP | Val | Row gross profit |
| MotherArtCode | String | Parent structured item code |
| RecipeQuant | Val | Recipe/BOM quantity |
| Recepy | String | Recipe/BOM code |
| TAX1Reb | Val | Tax 1 discount |
| DiscApprovedBy | String | Discount approved by user |

**Sub-Windows/Cards**:
- Currency card (OYCurrencyDClass): FrRate, ToRateB1, ToRateB2, BaseRate1, BaseRate2, CurncyCode
- Delivery Terms card (OYDelTermsDClass): Location, DelAddrCode, VATCode
- Price List card (OYPriceListDClass): PriceList
- Invoice Address card (OYInvAddressDClass): address fields
- Delivery Address card (OYDelAddressDClass): delivery address fields, DelAddrCode, VATCode

### 1.4 Activity Register (ActVc)

Activities are the core CRM interaction-tracking entity. Not a separate CRM-only register but central to CRM workflows.

**Key Fields** (from CRMTools.hal, PipelineOverviewWAction.hal):

| Field | Type | Purpose |
|-------|------|---------|
| SerNr | LongInt | Unique serial number |
| TransDate | Date | Activity date |
| EndDate | Date | End date |
| StartTime | Time | Start time |
| CUCode | String | Customer/Lead code |
| CUName | String | Customer name |
| Contact | String | Contact person |
| Phone | String | Phone number |
| ActType | String | Activity type code |
| ActState | String | Activity state |
| TodoFlag | Enum (kTodoFlag) | Calendar/Todo/Project/etc. |
| OKFlag | Integer | Done/Completed flag |
| Comment | String | Description |
| MainPersons | String | Assigned person(s) |
| CCPersons | String | CC'd person(s) |
| Supervisor | String | Supervisor |
| ItemCode | String | Related item code |
| CalTimeFlag | Integer | Calendar time flag (from ActTypeGroup) |
| FromFileName | String | Originating register name |
| FromSerNr | LongInt | Originating record serial number |

### 1.5 Pipeline Overview Configuration

**PipelinOverviewBlock** (system-level setting):

| Row Field | Type | Purpose |
|-----------|------|---------|
| ViewName | String | Pipeline view/tab name |
| ColumnName | String | Column display name |
| Register | String | Source register (ActVc, QTVc, ORVc, OYVc, CULeadVc, etc.) |
| RegisterFilter | String | Primary filter (e.g., Activity Type, Order Class, Lead Status) |
| RegisterFilter2 | String | Secondary filter (e.g., Activity State, Lead Rating) |
| Amounts | String | Amount display mode |
| colnr | Integer (kButtonColour) | Column colour |

**UserPipelinOverviewVc** (per-user pipeline config):

| Field | Type | Purpose |
|-------|------|---------|
| UserCode | String | User code |
| UserName | String | User name (auto-filled) |
| DefaultViewName | String | Default view to show |

Rows mirror PipelinOverviewBlock structure.

### 1.6 Supporting Lookup/Setting Registers

| Register | Internal Name | Purpose |
|----------|--------------|---------|
| Lead Status | LeadStatusVc | Configurable lead lifecycle stages (Code + Comment) |
| Lead Source | LeadSourceVc | Where leads come from (Code + Comment) |
| Lead Rating | kLeadRating enum | Cold(0), Warm(1), Hot(2) -- hardcoded enum |
| Industry | IndustryVc | Industry/sector classification (Code + Comment) |
| Campaign Status | CampaignStatusVc / kCampaignStatus | Pending(0), Started(1), Finished(2) |
| Media Type | MediaTypeVc | Campaign media channels (Code + Comment) |
| Activity Type | ActTypeVc | Activity categorisation with linked settings |
| Activity Type Group | ActTypeGrVc | Grouping of activity types with defaults |
| Activity State | ActStateSClass | Pipeline states for activities |
| Opportunity Class | OYClassSClass | Opportunity categorisation |
| Quotation Class | QuoteClassSClass | Quotation categorisation |
| Order Class | OrderClassSClass | Sales order categorisation |
| Item Classification | DIVc | Product/service interest classification |
| Contact Relations | ContactRelVc | Links between contact persons and companies |
| User Activity Subsystem Types | UserASTVc | Per-user auto-activity creation settings |
| Acceptance Rules | AcceptanceRulesVc | Approval workflow rules |

---

## 2. Settings

### 2.1 CRM Settings (from HansaManuals)

| Setting | Purpose |
|---------|---------|
| CRM Settings | General CRM module configuration |
| Global CRM Settings | System-wide CRM parameters (cross-company) |
| Contact Settings | Contact record defaults and behaviour |
| Contact Classifications | Classification scheme definitions |
| Customer Categories | Customer grouping and defaults |

### 2.2 Activity Settings

| Setting | Purpose |
|---------|---------|
| Activity Types | Define activity categories (calls, meetings, tasks, etc.) |
| Activity Types, Subsystems (ASTBlock / UserASTVc) | Configure auto-activity creation from subsystems |
| Activity Classes | Activity categorisation |
| Activity Consequences | What happens after an activity |
| Activity Priorities | Priority levels |
| Default Activity Text Codes | Pre-configured activity text templates |
| Favourite Activity Types | Per-user favourites |

### 2.3 Activity Subsystem Types (UserASTVc) -- Detail

This is a crucial CRM setting that controls automatic Activity creation from business events. Each user can have per-type configuration:

| Parameter | Fields | Purpose |
|-----------|--------|---------|
| Letters | Letters, GenLetters, LettersDone | Auto-create activity when letter created |
| InMails (Internal) | Mails, GenMails, MailDone | Auto-create activity for internal mails |
| ExMails (External) | ExMails, GenExMails, ExMailDone | Auto-create activity for external emails |
| GenSalesOrd | GenSalesOrd, GenOrder, OrderDone | Auto-create activity when sales order created |
| GenSalesInv | GenSalesInv, GenSInv, SInvDone | Auto-create activity when invoice created |
| PInv (Purchase Invoice) | PInv, GenPInv, PInvDone | Auto-create activity for purchase invoices |
| Contract | Contract, GenContract, ContractDone | Auto-create activity for contracts |
| GenPurchOrd | GenPurchOrd, GenPurchOrder, PurchOrderDone | Auto-create activity for purchase orders |
| AsteriskCalls | AsteriskCalls, AsteriskCallsDone | Phone system integration |
| MissedAsteriskCalls | MissedAsteriskCalls, MissedAsteriskCallsDone | Missed calls tracking |
| SkypeCalls | SkypeCalls, SkypeCallsDone | Skype call integration |
| CourseEvent | CourseEvent, GenCourseEvent, CourseEventDone | Training/course events |
| SMS | SMS, SMSDone | SMS tracking |
| KitchenOrder | KitchenOrder, GenKitchenOrder | Restaurant module integration |
| Production | Production, ProductiondDone | Manufacturing integration |
| ProdOperaration | ProdOperaration, ProdOperarationDone | Production operations |
| GenServOrder | GenServOrder, SVODone | Service orders |
| GenWorkOrd | GenWorkOrd, WorkOrdDone | Work orders |
| GenWorkSheet | GenWorkSheet, WorkSheetDone | Worksheets |
| PerformanceAppraisal | PerformanceAppraisal, PerformanceAppraisalDone | HR integration |
| Receipts | Receipts, ReceiptsDone | POS receipts |
| ClockInOut | ClockInOut | Time attendance |
| RentQT | RentQT, RentQTDone | Rental quotations |
| RsrtEvent | RsrtEvent, RsrtEventDone | Resort events |
| SVOSer | SVOSer, SVOSerDone | Service order serial tracking |

Each has: `Enable` flag, `ActivityType` code, `GenFlag` (auto-generate), `DoneFlag` (mark done on create).

### 2.4 Lead Management Settings

| Setting | Purpose |
|---------|---------|
| Lead Sources | Lookup table for lead origin tracking |
| Lead Status | Configurable lead lifecycle stages |
| Industries | Sector/industry classification for leads |

### 2.5 Opportunity Settings

| Setting | Purpose |
|---------|---------|
| Opportunity Classes | Categorisation of opportunities |
| Number Series - Opportunities | Serial number allocation |
| Quotation Settings (QTSettBlock) | Shared with Quotation; DefaultValidDays controls Opportunity validity period |

### 2.6 Pipeline/Workflow Settings

| Setting | Purpose |
|---------|---------|
| Company Workflow Overview (PipelinOverviewBlock) | System-level pipeline column configuration |
| User Workflow Overview (UserPipelinOverviewVc) | Per-user pipeline column configuration overrides |

### 2.7 Other CRM Settings

| Setting | Purpose |
|---------|---------|
| Classification Types | Custom classification schemes |
| Courtesy Titles | Salutation options |
| Job Titles | Position designations |
| Normalized Phone Numbers | Phone number standardisation |
| Telephony Settings | PBX/phone system integration |
| Map Setting | Geographic mapping configuration |
| Additional Email Recipients | Auto-CC/BCC settings |
| Text Types | Template text categories |
| User Defined Fields - Activities | Custom fields on activities |
| User Defined Fields - Contacts | Custom fields on contacts |
| Number Series - Activities | Activity number allocation |
| Number Series - Customer Letters | Letter number allocation |

---

## 3. Reports

### 3.1 Lead List Report (LeadListRn)

**Source**: `hal/Reports/LeadListRn.hal`

**Parameters**:
| Parameter | Field | Purpose |
|-----------|-------|---------|
| Customer Range | f1 | First:Last lead code range |
| Salesman | AccStr | Filter by salesperson |
| Country | FirstAcc | Filter by country |
| Industry | f2 | Filter by industry |
| Source | f3 | Filter by lead source |
| Partner | f4 | Filter by referring partner |
| Item Classification | f5 | Filter by product interest |
| Display Mode | ArtMode | 0=Detailed, 1=Phone, 2=Fax, 3=Email |
| Sort Order | flags[1] | 0=Code, 1=Name, 2=Phone, 3=Country |
| Overview Mode | flags[0] | Sorting sub-option |

**Output**: Lists leads with address details, phone/fax/email, sorting, classification, comments, and warning text. In Standard CRM mode, only records with `LeadType != 0` are included.

### 3.2 Quotation Pipeline Report (QTPipelineRn)

**Source**: `hal/Reports/QTPipelineRn.hal`, `hal/Reports/QTPipelineRn.S61.hal`

**Parameters**:
| Parameter | Field | Purpose |
|-----------|-------|---------|
| Salesman | f2 | Filter by salesperson |
| Quote Classes | f4 | Comma-separated list of quote classes |
| Min Probability | vals2 | Minimum probability % filter |
| Show by Salesman | flags[0] | Group output by salesperson |
| Show Estimates | flags[1] | Show probability-weighted amounts |
| Sales Group | ObjStr | Filter by sales group |
| Expected Close Before | d1 | Decision date cutoff |
| Close Rate | vals0 | Expected close rate for calculations |

**Output**:
- Lists open (not rejected, not closed, no order linked) quotations
- Groups by month of decision date
- Shows: Serial Nr, Customer, Salesman, Probability, Decision Date, Amount, Estimated (probability-weighted) Amount
- Summary statistics: Total, Count, Average, Highest, Lowest, Estimated Total, Total Probability, Average Probability

### 3.3 Salesman Activity Report (SalesmanActRn)

Referenced in PipelineOverviewWAction.hal. Accessible from Pipeline view. Shows activity history by salesperson over date ranges with period-over-period comparison.

### 3.4 Salesman Results Report (SalesmanResRn)

Referenced in PipelineOverviewWAction.hal. Shows sales results by salesperson.

### 3.5 Opportunity Status Report (OYStatusRn)

Referenced in OYDsm.hal. Shows detailed status of a specific opportunity including all rows and financial summary.

### 3.6 Customer Status Report (CustPS2Rn)

Referenced in OYDsm.hal. Shows customer-level status and history. Accessible from Opportunity window.

### 3.7 Item Last Sale Price Report (INLastSPriceRn)

Referenced in OYDsm.hal. Shows last sale prices for items, accessible from Opportunity row context.

---

## 4. Maintenances (Batch Operations)

No dedicated CRM maintenance routines were found in the analysed source files. CRM maintenance is handled through:

- **Lead conversion** (one-at-a-time via `CreateCustomerFromLead`)
- **Pipeline Overview recalculation** (auto-refreshes via `FillPipelineOverview`)
- **Opportunity Update Prices** (`OYDUpdatePrices` -- recalculates all row prices from current price lists)
- **Opportunity Recalculate Weight/Volume** (`RecalculetWeightVolumeOYVc`)
- **Opportunity Recalculate Discounts** (`RecalcDiscountOYD`)
- **Opportunity Subtotal insertion** (`RecalcOYSubtotal`)

---

## 5. Documents (Forms/Printouts)

### 5.1 Opportunity Form (OYForm)

**Source**: `hal/Documents/OYForm.hal`, `hal/Documents/DoOYForm.hal`

- Prints opportunity documents (proposals/proformas)
- Supports range printing (from:to serial numbers)
- Checks approval status before printing (blocks unapproved opportunities)
- Uses RecordActionOY_Print for actual document generation
- Supports email sending via CreateMailFromOYD (generates HTML attachment)

### 5.2 Campaign Letters

Campaigns can generate Letters (LetVc) linked to the campaign. Created via `CreateLetFromCampaign` which sets CampaignCode on the letter and creates record links.

---

## 6. Business Logic and Workflows

### 6.1 Lead Lifecycle

```
[New Lead] --> Create CUVc record with CUType=0, LeadType!=0
    |
    v
[Qualify] --> Set Status (LeadStatusVc), Rating (Cold/Warm/Hot),
              Source (LeadSourceVc), Industry (IndustryVc),
              Partner, ItemClassification
    |
    v
[Engage] --> Create Mail from Lead (CreateMailFromLead)
         --> Create Opportunity from Lead (CreateOpportunityFromLead)
         --> Add to Campaign
    |
    v
[Convert to Customer] --> CUFromLeadDsm calls CreateCustomerFromLead:
    - Changes CUType from 0 to 1
    - Applies Customer defaults from CustomerSettingBlock:
      - Default CustCat, PayDeal, Region, CreditLimit, CreditLimitDays
      - NoLetterPosting, NoMailPosting, OnAccount, AllowLogin flags
    - Reopens record in Customer window (CUDClass)
    - SAME record, different window/view
```

### 6.2 Campaign Management Workflow

```
[Create Campaign] --> Set Code, Status=Pending
    |
    v
[Add Recipients] --> Matrix rows with CodeType (Lead or Customer) + Code
    - Auto-fills Name and Person from Lead/Customer record
    |
    v
[Execute] --> Change Status to Started
          --> Create Letters from Campaign (CreateLetFromCampaign)
          --> Letters are record-linked back to Campaign
    |
    v
[Complete] --> Change Status to Finished
```

### 6.3 Opportunity Management Workflow

```
[Create Opportunity] --> Auto-defaults:
    - SerNr from Number Series
    - OYDate = today
    - ValidUntilDate = today + DefaultValidDays (from QTSettBlock)
    - SalesMan = current user
    - SalesGroup from user record
    - OurContact from user record
    - Location from user record
    - Currency rates from system
    - Budget flags from ProjectBlock
    |
    v
[From Lead] --> CreateOpportunityFromLead copies:
    - CustCode, Address fields, Phone, Fax, Person, Currency
    |
    v
[Add Items] --> Matrix rows with ArtCode, Quant, Price, Discount, VAT
    - Auto-price lookup from PriceList
    - GP calculation (BasePrice vs selling price)
    - Tax matrix calculation
    - Structured item explosion
    |
    v
[Track Progress] --> Probability (0-100%), MakeContactDate, Priority
                 --> Create Activities from Opportunity (MakeActFromOY)
    |
    v
[Approval Workflow] --> RequestApproval_OYVc
    - Manual or automatic approver selection
    - AcceptanceBy / AcceptanceFYI fields
    - Status: NotRequired/NotStarted/NotRequested/Pending/Approved/Rejected
    - Cannot print/convert while pending approval
    |
    v
[Win/Lose Decision] --> Rejected field: 0=Open, 1=Lost, 2=Won
    - When Won (Rejected=2): Probability set to 100%, RejectDate=today
    - When Lost (Rejected=1): Probability set to 0%, RejectDate=today
    - Can trigger SMS notification (SMSWhenOY)
    |
    v
[Convert] --> Create Quotation (CreateQTFromOYD)
          --> Create Sales Order (CreateORFromOYD)
          --> Create Invoice (CreateIVFromOYD)
          --> Create Budget (CreateTBBUFromOYD) -- requires PRCode
    |
    v
[Close] --> Closed flag = 1 (prevents further editing)
```

### 6.4 Activity Logging

Activities are auto-created from many subsystems via `CRMTools.hal`:

- **From Sales Orders**: MakeActFromSubSys_ORVc
- **From Sales Invoices**: MakeActFromSubSys_IVVc / MakeActFromIV
- **From Purchase Invoices**: MakeActFromSubSys_VIVc
- **From Letters**: MakeActFromSubSys_LetVc
- **From Emails**: MakeActFromSubSys_MailVc / CreateActivityforCustomer_Mail
- **From Contracts**: CreateActFromCOVc / MakeActFromSubSys_COVc
- **From Kitchen Orders**: MakeActFromSubSys_KitchenOrderVc
- **From Opportunities**: MakeActFromOY (via OYDsm)

All auto-created activities:
1. Set TodoFlag = kTodoFlagTodo (1)
2. Use ActivityType from UserASTVc settings
3. Copy customer details (CUCode, CUName, Contact, Phone)
4. Create bidirectional record links (Activity <-> Source record)
5. Respect per-user Enable/Auto-generate/Done flags

### 6.5 Pipeline Overview Workflow

The Pipeline Overview is a Kanban-style board showing work items across configurable columns:

```
[Configure] --> PipelinOverviewBlock (system) or UserPipelinOverviewVc (per-user)
    - Define Views (tabs)
    - Define Columns per view (name, register, filters, colour)
    - Supported registers: ActVc, IntProjManActVc, CleanActVc, MaintActVc,
      ORVc, QTVc, OYVc, KitchenOrderVc, PRVc, MailVc, CULeadVc, SVOVc
    |
    v
[View] --> PipelineWClass window
    - User filter (f1), View filter (f3), Period filter
    - Async data loading (FillPipelineOverviewClientThread)
    - Sorting by: Icon(0), Value(1), Caption(2), Date(3), Customer(4)
    |
    v
[Interact] --> Double-click opens record (Activities or Quotations)
           --> Drag-and-drop between columns changes state/class
           --> "New" buttons: Activity, Quotation, Order, Mail, Project Activity
    |
    v
[Navigate] --> Open Task Manager (ToDoWClass)
           --> Run Salesman Activity Report
           --> Run Salesman Results Report
```

**Drag-and-drop support** (ColumnGridDraggedCell):
- Activities: changes ActType/ActState, or converts to Order/Quotation
- Kitchen Orders: changes status
- Orders: changes class
- Quotations: changes class
- Opportunities: changes class
- Leads: changes status/rating
- Mails: changes category/assignment

### 6.6 Customer Linkage

- Leads and Customers share the same CUVc register
- Contact Relations (ContactRelVc) link contact persons to companies
- Email-based customer lookup: `CUr.eMail` key for finding customer from email address
- Multi-company support: Activities created in user's "main CRM company" regardless of current company

---

## 7. Enums and Constants

### 7.1 kLeadRating

```
enum kLeadRating begin
  kLeadRatingCold = 0,
  kLeadRatingWarm = 1,
  kLeadRatingHot = 2
end;
```

### 7.2 kCampaignStatus

```
enum kCampaignStatus begin
  kCampaignStatusPending = 0,
  kCampaignStatusStarted = 1,
  kCampaignStatusFinished = 2
end;
```

### 7.3 kCampaignRowCodeType

```
enum kCampaignRowCodeType begin
  kCampaignRowCodeTypeLead = 0,
  kCampaignRowCodeTypeCU = 1
end;
```

### 7.4 kPipelineItemType

```
enum kPipelineItemType begin
  kPipelineItemTypeUndefined = 0,
  kPipelineItemTypeActivity = 1,
  kPipelineItemTypeQuotation = 2,
  kPipelineItemTypeRecordId = 3,
  kPipelineItemTypeRecordIdWin = 4
end;
```

### 7.5 kTodoFlag (Activity types)

```
enum kTodoFlag begin
  kTodoFlagCalendar = 0,
  kTodoFlagTodo = 1,
  kTodoFlagTimedTodo = 2,
  kTodoFlagBanner = 3,
  kTodoFlagWorkHours = 4,
  kTodoFlagOther = 5,
  kTodoFlagApproval = 6,
  kTodoFlagRecurring = 7,
  kTodoFlagProject = 8,
  kTodoFlagCleanTask = 9,
  kTodoFlagRoomMaintenance = 10
end;
```

### 7.6 kMailRowType

```
enum kMailRowType begin
  kMailRowTypeTo = 0,
  kMailRowTypeFrom = 1,
  kMailRowTypeFile = 2,
  kMailRowTypeCC = 3,
  kMailRowTypeBCC = 4
end;
```

### 7.7 kAcceptanceState (Approval workflow)

```
enum kAcceptanceState begin
  kAcceptanceStateNotRequired = 0,
  kAcceptanceStateNotStarted = 1,
  kAcceptanceStateNotRequested = 2,
  kAcceptanceStatePending = 3,
  kAcceptanceStateApproved = 4,
  kAcceptanceStateRejected = 5
end;
```

### 7.8 Opportunity Rejected States

Not a formal enum but used as:
- `Rejected = 0`: Open/Active
- `Rejected = 1`: Rejected/Lost (Probability set to 0)
- `Rejected = 2`: Won/Accepted (Probability set to 100)

### 7.9 kButtonColour (Pipeline column colours)

```
enum kButtonColour begin
  kButtonColourDefault = -1,
  kButtonColourBlack = 0,
  kButtonColourRed = 1,
  kButtonColourGreen = 2,
  kButtonColourDeepBlue = 3,
  kButtonColourYellow = 4,
  kButtonColourCyan = 5,
  kButtonColourPink = 6,
  kButtonColourStrawberry = 7,
  kButtonColourLime = 8,
  kButtonColourSkyBlue = 9,
  kButtonColourBlue = 10,
  kButtonColourDeepPurple = 11,
  kButtonColourGold = 12,
  kButtonColourCoffee = 13,
  kButtonColourChocolate = 14,
  kButtonColourOrange = 15,
  kButtonColourPlum = 16,
  kButtonColourNightShade = 17,
  kButtonColourDeepForest = 18,
  kButtonColourFlamingo = 19,
  kButtonColourGray = 20,
  kButtonColourWhite = 21,
  kButtonColourSilver = 22,
  kButtonColourMagentaPink = 23,
  kButtonColourDeepPink = 24,
  kButtonColourRazzmatazz = 25,
  kButtonColourLightPink = 26,
  kButtonColourSalmonPink = 27,
  kButtonColourLilac = 28
end;
```

### 7.10 Pipeline Tool Identifiers

```
ToolPipeline          (tool index 3009)
ToolPipelineProjectIssues  (tool index 3038)
```

---

## 8. Cross-Module Integration Points

### 8.1 CRM to Sales

| From | To | Mechanism |
|------|----|-----------|
| Lead | Opportunity | CreateOpportunityFromLead: copies address, phone, fax, contact, currency |
| Opportunity | Quotation | CreateQTFromOYD: copies all header and row data |
| Opportunity | Sales Order | CreateORFromOYD: copies all header and row data |
| Opportunity | Invoice | CreateIVFromOYD: direct opportunity-to-invoice |
| Pipeline drag | Quotation/Order | ColumnGridDraggedActivity creates QT or OR from Activity |

### 8.2 CRM to Finance

| Integration | Detail |
|-------------|--------|
| Opportunity GP tracking | BasePrice (cost) vs Price (selling) per row, TotGP field |
| Currency handling | Full multi-currency with dual base, exchange rates |
| VAT/Tax | Per-row VATCode or TaxTemplateCode, tax matrix support |
| Account Objects | Header and row-level dimension/object support |

### 8.3 CRM to Contact Management

| Integration | Detail |
|-------------|--------|
| Lead as Contact | Leads ARE contacts (CUVc) -- same record |
| Contact Relations | ContactRelVc links contact persons to parent companies |
| Email lookup | Activities auto-link to customers via email address matching |
| Campaign recipients | Can target both Leads and Customers |

### 8.4 CRM to Email/Communications

| Integration | Detail |
|-------------|--------|
| Mail from Lead | CreateMailFromLead: pre-fills recipient from Lead.eMail |
| Mail from Opportunity | CreateMailFromOYD: generates HTML proposal email |
| Mail to Activity | MakeActFromSubSys_MailVc: auto-creates activity from sent/received mail |
| Campaign Letters | CreateLetFromCampaign: generates linked letters |
| SMS notifications | SMSWhenOY: sends SMS on Opportunity win |

### 8.5 CRM to Project Management

| Integration | Detail |
|-------------|--------|
| Opportunity to Project | PRCode links opportunity to project; budget fields (BudTime, BudOther, etc.) |
| Opportunity to Budget | CreateTBBUFromOYD: creates project budget from opportunity |
| Pipeline views | IntProjManActVc, IntProjManToDoActVc in pipeline columns |
| Project Activities | PipelineWClassNewProjAct creates project activities |

### 8.6 CRM to Inventory

| Integration | Detail |
|-------------|--------|
| Opportunity items | ArtCode references INVc (Items register) |
| Location tracking | Opportunity.Location field for warehouse |
| Serial numbers | Per-row SerialNr for serial-tracked items |
| Structured items | Automatic BOM/recipe explosion on opportunities |
| Weight/Volume | Auto-calculated from item master data |

### 8.7 CRM to Approvals

| Integration | Detail |
|-------------|--------|
| Opportunity approval | AcceptanceRulesVc-based workflow |
| Manual/Automatic approver | kAcceptanceApproverSelectionManual option |
| Approval activities | Creates kTodoFlagApproval activities |
| Print/Convert blocking | Cannot print or convert unapproved opportunities |

---

## 9. Nexa ERP Implications

### 9.1 Entities Needed for Nexa CRM Module

Based on the HansaWorld analysis, Nexa ERP needs these CRM entities:

1. **Lead** -- SEPARATE entity (unlike HansaWorld where leads are contacts with a flag). Nexa should have a dedicated `leads` table with proper lifecycle management. Fields: code, name, contact_person, company, email, phone, mobile, address, status, source, industry, rating (cold/warm/hot), partner_ref, item_interest, salesperson_id, notes, converted_customer_id, conversion_date.

2. **Opportunity** -- Full sales opportunity with line items. Fields mirror quotation structure: serial_number, date, customer_id (or lead_id), contact, salesperson, probability, status (open/won/lost), close_date, valid_until, follow_up_date, currency, items[], totals, approval_status, priority, linked_quotation_id, linked_order_id.

3. **Campaign** -- Marketing campaign management. Fields: code, name, status (draft/active/completed), media_type, start_date, end_date, target_recipients[] (leads + customers), linked_activities.

4. **Activity** -- CRM interaction log. Fields: serial_number, date, type, customer_id, contact, description, assigned_to, cc_persons, status (done/pending), todo_type, linked_record (polymorphic to any source).

5. **Pipeline View Configuration** -- Kanban board setup. System-level + per-user overrides. Columns map to register + filter combinations.

6. **Supporting lookup tables**: Lead Status, Lead Source, Industry, Campaign Status, Media Type, Activity Type, Activity Type Group, Opportunity Class.

### 9.2 Key Design Decisions for Nexa

1. **Lead-Customer Separation**: Unlike HansaWorld's "same record, different view" approach, Nexa should use separate `leads` and `customers` tables. Conversion creates a new customer record and updates the lead with a reference. This is cleaner for database-per-tenant architecture and avoids the CUType flag complexity.

2. **Opportunity vs Quotation**: HansaWorld's OYVc is essentially a Quotation with CRM fields. Nexa should decide whether Opportunity is:
   - (a) A separate lightweight entity that links to Quotations (recommended -- cleaner separation of concerns), or
   - (b) A Quotation with CRM metadata (HansaWorld approach -- less duplication but muddles sales/CRM boundary)

3. **Activity Auto-Creation**: The UserASTVc pattern (per-user, per-event-type activity auto-creation) is powerful. Nexa should implement a similar event-driven activity creation system but using an event bus/webhook pattern rather than hardcoded subsystem calls.

4. **Pipeline Overview**: The configurable Kanban board is a key CRM feature. Nexa should implement this as a React component with:
   - System-level column configurations
   - Per-user overrides
   - Drag-and-drop state changes
   - Support for multiple entity types (activities, opportunities, orders, leads)

5. **Multi-Currency on Opportunities**: Full dual-base currency support with exchange rates. Nexa should leverage the existing currency infrastructure from the Finance module.

6. **Approval Workflows**: The AcceptanceRulesVc pattern with manual/automatic approver selection should be generalised into Nexa's workflow engine (not CRM-specific).

### 9.3 Features in HansaWorld NOT in Old_Spec (to verify)

- Campaign-to-Letter generation
- Pipeline Kanban drag-and-drop state changes
- Opportunity-to-Invoice direct conversion (skipping order)
- Per-user Activity Subsystem configuration (30+ subsystem types)
- Telephony integration (Asterisk, Skype)
- SMS notifications on Opportunity win
- Opportunity approval workflows
- Multi-company CRM (main CRM company concept)
- Budget creation from Opportunity (TBBU)
- Restaurant/Kitchen Order activity tracking

### 9.4 Recommended MVP Scope for Nexa CRM

**Must Have (MVP)**:
- Lead register with full lifecycle (create, qualify, convert to customer)
- Lead Status, Lead Source, Industry, Rating lookups
- Activity register with manual + auto-creation from key events
- Activity Types and Activity Type Groups
- Basic Pipeline/Kanban view (configurable columns)
- Basic Campaign register (status tracking, recipient list)
- Customer link to activities and opportunities

**Should Have (MVP+)**:
- Opportunity register with line items (or link to Quotation module)
- Opportunity win/loss tracking with probability
- Pipeline drag-and-drop
- Email-to-Activity auto-linking
- Activity auto-creation from Sales Orders and Invoices

**Could Have (Post-MVP)**:
- Opportunity approval workflows
- Campaign-to-Letter/Email batch generation
- Full multi-currency Opportunity pricing
- Per-user pipeline view customisation
- SMS/notification integration
- Salesman Activity and Results reports
- Quotation Pipeline report with probability-weighted forecasting
