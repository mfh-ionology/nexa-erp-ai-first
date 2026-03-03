# HansaWorld Deep Dive Findings & Architecture Gap Analysis

> **Generated:** 2026-02-15
> **Source:** 8 parallel deep-dive agents analysing `/legacy-src/c8520240417/`
> **Purpose:** Identify all entities, settings, workflows, reports, and maintenance routines from the HansaWorld legacy codebase that need representation in Nexa ERP architecture.

---

## Executive Summary

8 deep-dive agents systematically explored the HansaWorld HAL codebase across:
- 11 `amaster/datadef*.hal` files (data definitions)
- `/hal/RActions/` (record actions / business logic)
- `/hal/Documents/` (forms)
- `/hal/Reports/` (reports)
- `/hal/Maint/` (maintenance routines / batch processes)
- `/hal/Exports/` and `/hal/Tools/` (integrations)

### Key Statistics

| Module | Legacy Registers | Settings Blocks | Reports | Maintenances | Forms | Exports |
|--------|-----------------|-----------------|---------|--------------|-------|---------|
| NL (Finance/GL) | 20+ | 30+ | 15+ | 22 | 4 | 20+ |
| IN (Inventory) | 16+ | 8 | 35+ | 10+ | 13 | 6+ |
| SL (Sales Ledger/AR) | 12+ | 10+ | 5+ | 3+ | 12+ | 4+ |
| SO (Sales Orders) | 6+ | 6+ | 10+ | 6+ | 10+ | 4+ |
| PO+PL (Purchase) | 10+ | 8+ | 10+ | 9+ | 12+ | 2+ |
| FA (Fixed Assets) **NEW** | 12+ | 2 | 6+ | 7 | 6 | — |
| Pricing | 9+ | — | 7+ | 3+ | — | — |
| Cross-cutting | 10+ | 3+ | — | — | — | — |

**Total legacy entities discovered: ~95+**
**Currently in Nexa architecture: ~30 models**
**Gap: ~65+ entities need design**

---

## Module 1: NL (Nominal Ledger / Finance / GL)

### Registers Found

| Legacy Register | Description | In Architecture? | Priority |
|----------------|-------------|-------------------|----------|
| TRVc | GL Transactions (Journal Entries) | Partial (journal_entries concept) | MVP |
| AccVc | Chart of Accounts | YES (ChartOfAccount concept) | MVP |
| AccPeriodVc | Financial Periods | YES (FinancialPeriod concept §2.5) | MVP |
| Bud1Vc | Budget Set 1 | NO | P1 |
| Bud2Vc | Budget Set 2 | NO | P1 |
| BudEntryVc | Budget Entries (transaction-level) | NO | P1 |
| BankVc | Bank Accounts | NO | MVP |
| BankTRVc | Bank Transactions (imported) | NO | MVP |
| BankRecVc | Bank Reconciliation | NO | MVP |
| ERVc | Exchange Rates | YES (ExchangeRate) | MVP |
| BaseERVc | Base Exchange Rates | Merged into ExchangeRate | MVP |
| ForexTRVc | Forex Transactions | NO | P2 |
| CCTRVc | Cost Centre Transactions | NO | P1 |
| PurgeTRVc | Purged/Archived Transactions | NO | P2 |
| AccTransVc | Account Translation/Mapping | NO | P2 |
| TAccVc | Tax/Consolidated Accounts | NO | P2 |
| CuAccVc | Consolidation Account | NO | P3 |
| ConfAccVc | Configuration Account | NO | P2 |
| AccClassVc | Account Classification | NO | P1 |
| ObjVc | Cost Objects/Dimensions | Partial (Tag model, needs expansion) | MVP |

### Critical Settings Blocks

| Block | Key Fields | In Architecture? | Notes |
|-------|-----------|-------------------|-------|
| AccBlock (62+ fields) | ARAcc, APAcc, StockAcc, SalesAcc, PurchAcc, VATAccounts, RateGain/Loss, Production costs | Partial (SubLedgerControl is simplified) | **CRITICAL** — Maps sub-ledger posting accounts. SubLedgerControl needs massive expansion |
| PeriodBlock | Accounting period definitions | YES (§2.5) | OK |
| VATCodeBlock | VAT rates, accounts, EU/Export codes | YES (VatCode model) | Needs EU/Export account mapping |
| DBLockBlock | TRLock, SLLock, PLLock, BudgetLock dates | YES (§2.5 period locks) | OK |
| RoundBlock | Rounding modes per context | Partial (Currency.round*) | May need separate model |
| BaseCurBlock | Base currency definition | YES (CompanyProfile.baseCurrencyCode) | OK |
| BudgetClassBlock | Budget classification codes | NO | P1 |

### Transaction Creation Sources (23 MakeTransFrom* files)

These show every module that posts to the GL:
1. MakeTransFromIP (Cash Receipts → GL)
2. MakeTransFromIV (Sales Invoices → GL)
3. MakeTransFromVI (Purchase Invoices → GL)
4. MakeTransFromPU (Goods Receipt → GL)
5. MakeTransFromSD (Stock Depreciation → GL)
6. MakeTransFromSH (Shipments → GL)
7. MakeTransFromOP (Outward Payments → GL)
8. MakeTransFromRet (Customer Returns → GL)
9. MakeTransFromRetPU (Supplier Returns → GL)
10. MakeTransFromProd (Production → GL)
11. MakeTransFromProdOperation (Production Operation → GL)
12. MakeTransFromCLIn/CLOut (Cash In/Out → GL)
13. MakeTransFromCheck/ChqDep (Cheques → GL)
14. MakeTransFromSR (Stock Revaluation → GL)
15. MakeTransFromLateCost (Late Costs → GL)
16. MakeTransFromResVc (Resource → GL)
17. Plus others

**Architecture Impact:** Each source module needs a defined GL posting template (debit/credit account mapping).

### Key Maintenance Routines

| Routine | Purpose | MVP? |
|---------|---------|------|
| LockNLMn | Lock GL to date (period close) | MVP |
| GenTransMn | Generate GL transactions | MVP |
| GenPerTRMn | Generate periodic GL entries | P1 |
| OKPeriodMn | Mark period as approved | MVP |
| AddObjTRMn | Add cost objects to existing transactions | P1 |
| DelTransMn | Delete/archive transactions | P2 |
| ICTRMn | Intercompany transactions | P3 |

---

## Module 2: IN (Inventory / Stock)

### Registers Found

| Legacy Register | Description | In Architecture? | Priority |
|----------------|-------------|-------------------|----------|
| INVc | Items/Articles (218 fields!) | NO (needs full Item model) | MVP |
| ITVc | Item Types/Groups | NO (ItemGroup model needed) | MVP |
| LocationVc | Warehouse Locations | NO (Warehouse model needed) | MVP |
| StockMovVc | Stock Movements (70+ fields) | NO | MVP |
| StockTakeVc | Physical Stock Counts | NO | P1 |
| ItemHistVc | Item Transaction History | NO | MVP |
| StockReservVc | Stock Reservations | NO | P1 |
| INTransferVc | Internal Stock Transfers | NO | P1 |
| BarcodeVc | Barcode Register | NO | P1 |
| AltINVc | Alternative Items | NO | P2 |
| CrossINVc | Cross-reference Items | NO | P2 |
| SplitINVc | Item Split/Conversion | NO | P2 |
| DfncyStockVc | Deficient Stock | NO | P2 |
| StockPolicyVc | Stock Aging Policies | NO | P2 |

### Critical Settings

| Block | Purpose | MVP? |
|-------|---------|------|
| MainStockBlock | Stock config (default location, FIFO, chronology, allow overreceive/overship) | MVP |
| ItemSettingBlock | Item defaults (default group, barcode settings, serial number required) | MVP |
| MainWHMBlock | Warehouse management (positions, pallet areas, forklift queue, pick areas) | P1 |
| StockReservBlock | Reservation config (auto-reserve, require location) | P1 |

### Key INVc Fields Needing Design

The Item entity in HansaWorld has **218 fields**. Key field groups for Nexa:
- **Basic:** Code, Name, Description, UnitOfMeasure, Barcode, AlternativeCode
- **Pricing:** InPrice (cost), UPrice1-3 (selling prices), LastPurchPrice, WeighedAvPrice
- **Stock:** MinLevel, MaxLevel, ReorderPoint, ReorderQty, DefaultLocation
- **Classification:** Group (ITVc), ItemType, Brand, Classification
- **Physical:** Weight, Volume, Length, Width, Height, Density
- **Tax:** VATCode, ReverseVATCode, HSCode
- **Costing:** CostModel (FIFO/WA/Standard), FIFOPerSerialNr, FIFOPerLocation, WAPerLocation
- **Sales/Purchase:** SalesAccount, CostAccount, NotForSales, Discontinued
- **Serial/Batch:** SerialNumberRequired, BatchTracking, BestBeforeTracking
- **Custom:** UserStr1-5, UserVal1-3, UserDate1-3

### Costing Models Discovered

- **FIFO** (First In First Out) — per serial number OR per location
- **Weighted Average** — per location
- **Standard Cost** — fixed cost updated periodically
- **Last Purchase Price** — auto-updated on GRN
- **Cost Per Location** — separate cost tracking per warehouse

---

## Module 3: SL (Sales Ledger / Accounts Receivable)

### Registers Found

| Legacy Register | Description | In Architecture? | Priority |
|----------------|-------------|-------------------|----------|
| IVVc | Sales Invoices (100+ fields) | Partial (CustomerInvoice) | MVP |
| CUVc | Customers (90+ fields) | Partial (Customer model) | MVP |
| ARVc | AR Detail (aging records) | NO | MVP |
| ARPayVc | AR Payments Received | NO | MVP |
| ARPayHistVc | AR Payment History | NO | MVP |
| ARInstallVc | AR Installment Plans | NO | P1 |
| ARInstallHistVc | AR Installment History | NO | P1 |
| PlannedPaymentVc | Expected Payments | NO | P2 |
| IntIVVc | Interest Invoices | NO | P2 |
| LetVc | Dunning Letters | NO | P1 |
| LTxtVc | Letter Templates | NO | P1 |
| DelAddrVc | Delivery Addresses | NO | MVP |
| ContactVc | Customer Contacts | NO | MVP |
| CreditCardVc | Credit Cards | NO | P2 |

### Critical IVVc (Invoice) Fields

- **Header:** SerNr, InvDate, TransDate, CustCode, PayDate, OKFlag
- **Types:** InvType (1=Normal, 2=Cash, 3=Credit, 4=Interest, 5=DebitNote)
- **Financial:** Sum0-4 (totals), VAT sums, Discount, GrossProfit
- **Currency:** CurncyCode, multiple exchange rate fields
- **Status:** OKFlag, ExportedFlag, DisputedFlag, FiscalFlag
- **Addresses:** InvAddr0-4, ShipAddr0-4, DelCountry, InvCountry
- **Control:** NoInterestFlag, NoRemndrFlag, NoCollectionFlag, NoEInvoice
- **Approval:** AcceptanceStatus, AcceptanceBy, AcceptanceFYI

### Critical CUVc (Customer) Fields

- **Basic:** Code, Name, CustType (Company/Person), CustCategory
- **Contact:** Phone, Fax, Mobile, Email, Website
- **Addresses:** InvAddr0-4, DelAddr0-4, InvoiceToCode (bill-to customer)
- **Terms:** PayDeal, ShipDeal, ShipMode, FreightCode
- **Credit:** CreditLimit, CreditLimitDays, OnAccount, OnHoldFlag, BlockedFlag
- **AR:** InterestFlag, RemndrFlag, CollectionFlag
- **Sales:** SalesMan, SalesGroup, PriceListCode, RebateCode, Region
- **VAT:** VATCode, VATNumber, CountryCode
- **Custom:** UserStr1-5, UserVal1-3, UserDate1-3

### Key Business Logic Flows

1. **Invoice → AR → GL posting** (MakeTransFromIV)
2. **Payment Reception → AR allocation → GL reversal** (MakeTransFromIP)
3. **Installment management** (split invoice into scheduled payments)
4. **Interest calculation** on overdue (IntIVVc creation)
5. **Dunning process** (LetVc generation → email)
6. **Credit management** (CreditLimit enforcement on order/invoice save)

### Settings

- SLAccBlock (AR accounts matrix)
- SalesCodeBlock (sales codes → GL accounts)
- DownPayBlock (down payment/deposit settings)
- CreditLimitBlock (enforcement triggers)
- CustomerSettingBlock (default values for new customers)

---

## Module 4: SO (Sales Orders)

### Registers Found

| Legacy Register | Description | In Architecture? | Priority |
|----------------|-------------|-------------------|----------|
| ORVc | Sales Orders (171 fields!) | NO | MVP |
| QTVc | Quotations (100+ fields) | NO | MVP |
| RetVc | Customer Returns (50+ fields) | NO | P1 |
| PreQTVc | Pre-Quotations | NO | P2 |
| ORProgVc | Blanket/Standing Orders | NO | P2 |
| DispatchVc | Dispatch/Shipment | NO | MVP |
| EDIORVc | EDI Sales Orders | NO | P3 |

### Key ORVc (Sales Order) Fields

- **Header:** SerNr, OrdDate, CustCode, DeliveryDate, DespatchDate
- **Status:** OrderStatus, OKFlag, InvFlag (invoiced), ShipFlag (shipped), Closed
- **Financial:** Sum0-4, CurncyCode, DiscPerc, DiscSum, TotGP, Commission
- **Addresses:** InvAddr, ShipAddr, DelAddrCode
- **Sales:** SalesMan, SalesGroup, PriceList, Region, OrderClass
- **Approval:** AcceptanceStatus, AcceptanceBy, AcceptanceFYI
- **Line Items:** ArtCode, Quant, Price, Sum, Shipped1, Shipped2, Invoiced, VATCode, Location

### Quote → Order → Ship → Invoice Lifecycle

```
PreQuotation (PreQTVc) → Optional early inquiry
    ↓
Quotation (QTVc) → Formal quote with validity, rejection tracking
    ↓ (accepted)
Sales Order (ORVc) → QuoteNr references source QTVc
    ↓ (fulfilled)
Dispatch/Shipment (DispatchVc) → Physical shipment record
    ↓ (invoiced)
Sales Invoice (IVVc) → Financial document, posts to GL
```

### Settings

- QTSettBlock (quote validity days, require classification, prevent overbilling)
- SalesCodeBlock (sales department → GL account mapping)
- SalesTimeBlock (time-based selling configuration)
- DispatchDefBlock (dispatch defaults)

---

## Module 5: PO + PL (Purchase Orders + Purchase Ledger / AP)

### Purchase Order Registers

| Legacy Register | Description | In Architecture? | Priority |
|----------------|-------------|-------------------|----------|
| POVc | Purchase Orders (80+ fields) | NO | MVP |
| POQTVc | Purchase Quotations | NO | P1 |
| POCOVc | Purchase Contracts/Blankets | NO | P2 |
| POPlanVc | Purchase Planning | NO | P1 |
| IPVc | Goods Receipt (Inward Purchase) | NO | MVP |

### Purchase Ledger Registers

| Legacy Register | Description | In Architecture? | Priority |
|----------------|-------------|-------------------|----------|
| PUVc | Purchase Invoices/Bills (80+ fields) | NO | MVP |
| VEVc | Vendors/Suppliers (60+ fields) | NO | MVP |
| OPVc | Outward Payments (60+ fields) | NO | MVP |
| RetPUVc | Returns to Supplier (70+ fields) | NO | P1 |

### Key VEVc (Vendor) Fields

- **Basic:** Code, Name, SearchKey, Group, LangCode
- **Contact:** Phone, Fax, Email, Person (contact)
- **Address:** Addr0-4, CountryCode
- **Terms:** PayDeal, ShipDeal, ShipMode, CurncyCode
- **Financial:** BankAcc, BankName, SWIFT/SortCode
- **AP:** AccAP (AP account), AccCost (default cost account), CreditLimit
- **Tax:** VATCode, VATNumber, VATNotDeductible
- **Control:** TerminatedFlag, BlockedFlag, OnAccount

### PO → GRN → Invoice → Payment Flow

```
Purchase Order (POVc) → Approved order to supplier
    ↓
Goods Receipt (IPVc) → Physical receipt of goods
    ↓
Purchase Invoice (PUVc) → Supplier's bill (3-way match: PO↔GRN↔Invoice)
    ↓
Outward Payment (OPVc) → Payment to supplier (BACS/bank transfer)
```

### Settings

- POSettingBlock (13 fields: PU from PO rules, default supplier warnings)
- APAccBlock (40+ fields: AP/credit/VAT/rate gain-loss accounts)
- OPTBlock (payment defaults: bank fees, SEPA, batch booking)
- VITBlock (vendor invoice settings: VAT auto-calc, rate handling)

---

## Module 6: FA (Fixed Assets) — **COMPLETELY NEW MODULE**

> **This module is NOT in the current Nexa architecture at all.**

### Registers Found (12+)

| Legacy Register | Description | Priority |
|----------------|-------------|----------|
| AT2Vc | Asset Master (classes/types) | MVP |
| AT2UnitVc | Individual Asset Units (40+ fields) | MVP |
| AT2DprVc | Depreciation Records (25+ fields) | MVP |
| AT2PUVc | Asset Purchase/Acquisition | MVP |
| AT2MovVc | Asset Movement (dept transfer) | P1 |
| AT2RespVc | Responsibility Transfer | P1 |
| AT2WrofVc | Asset Write-off/Disposal | MVP |
| AT2TakeVc | Asset Stocktake/Verification | P1 |
| AT2RevVc | Asset Revaluation | P2 |
| AT2RevListVc | Revaluation Detail | P2 |
| DprModVc | Depreciation Methods | MVP |
| AT2ClassVc | Asset Classes | MVP |
| AT2GroupVc | Asset Groups (hierarchical) | MVP |
| AT2TransVc | Asset Transaction Log | MVP |
| InvBalVc | Asset Quantity Balance | MVP |
| ATCoeffVc | Inflation Coefficients | P2 |

### Key AT2UnitVc Fields

- **Identity:** InventoryNr, Description, SerialNr, WarrantyNr, ContractNr
- **Classification:** AT2Code (class), AT2Class, Objects
- **Ownership:** DepCode (department), RespPerson, VECode (vendor)
- **Financial:** PurchVal, ResVal (salvage), InsuranceVal, LandVal, FiscalVal
- **Depreciation:** StartingDate1/2, Model1/2, MinDprVal, InitDeprVal1/2
- **Lifecycle:** PurchaseDate, ProdDate, EndDate, UsedFromDate, Activef
- **Dual-basis:** PurchVal (book) vs PurchVal2 (fiscal) — supports book AND tax depreciation

### GL Account Mappings (AC2Block)

For each asset class code:
- Asset Account (book & fiscal)
- Accumulated Depreciation Account
- Depreciation Expense Account
- Revaluation Loss Account
- Capital Investment/WIP Account

### Key Workflows

1. **Asset Acquisition:** PO → AT2PUVc → AT2UnitVc creation → Capitalization (AT2PutinMn)
2. **Monthly Depreciation Run:** AT2GenTRMn → AT2DprVc records → GL journals (Dr Depr Expense, Cr Accum Depr)
3. **Asset Disposal:** AT2WrofVc → Calculate gain/loss → GL journals
4. **Asset Transfer:** AT2MovVc → Update department/cost centre
5. **Revaluation:** AT2RevVc → Apply coefficients → GL adjustment
6. **Physical Verification:** AT2TakeVc → Count → Reconcile discrepancies

### Depreciation Methods Supported

- Straight-line
- Declining balance
- Units of production
- Dual-basis (book vs tax)
- Partial-period (mid-month acquisition)

---

## Module 7: Pricing

### Registers Found

| Legacy Register | Description | In Architecture? | Priority |
|----------------|-------------|-------------------|----------|
| PLDefVc | Price List Definitions | NO | MVP |
| PLVc | Price List Entries (item prices) | NO | MVP |
| PLQVc | Quantity Break Prices | NO | MVP |
| RebVc | Rebates/Discounts (tiered) | NO | P1 |
| MultiBuyRebVc | Multi-Buy Deals (Buy X Get Y) | NO | P2 |
| PromotionVc | Promotions/Campaigns | NO | P2 |
| CouponVc | Coupons/Gift Cards | NO | P3 |
| PriceRulesVc | Pricing Rule Engine | NO | P2 |
| AdvPriceTemplVc | Advanced Price Templates | NO | P3 |

### Price Resolution Hierarchy (Most Specific → General)

1. **Customer + Item specific** (PLVc with CustCode) — if NoOtherPricing=1, STOP
2. **Quantity breaks** (PLQVc with QtyLimit matching)
3. **Item in price list** (PLVc without customer)
4. **Vendor purchase price** (PIVc default)
5. **Item base price** (INVc.InPrice)
6. **Rebate applied** (RebVc based on category/qty tier)

### Formula-Based Pricing (PriceFormCalc)

Supports 6 base price sources:
- Item InPrice (cost)
- User Price 1/2/3
- Last Purchase Price
- Weighted Average
- Base Price List

Formula: `price = baseprice × (percent/100) + Add1Val [rounded] + Add2Val`

### Key PLDefVc Fields

- Code, Comment, CurncyCode, InclVAT
- StartDate, EndDate (validity period)
- StartTime, EndTime (time-based pricing)
- DepPrice (0=Fixed, 1=QtyBreaks, 2=Customer-specific)
- PLReplCode (replacement price list — seasonal transitions)

---

## Module 8: Cross-Cutting Features

### Attachments (Attach2Vc)

| Field | Description |
|-------|-------------|
| SerNr | Primary key |
| FileName | File name (200 chars) |
| FileSize | Size in bytes |
| Type | Attachment type code |
| Storage | Set (SerNr-based or UUID-based) |
| ContentId | Content identifier |

**Architecture Impact:** Need an `Attachment` model with polymorphic linking to any entity.

### Record Links (RLinkVc)

| Field | Description |
|-------|-------------|
| FromRecidStr | Source record identifier |
| ToRecidStr | Target record identifier |
| Comment | Link description |
| LinkType | Relationship type |

**Architecture Impact:** Need a `RecordLink` model for cross-module navigation.

### Activities/Calendar (ActVc — 80+ fields)

Key field groups:
- **Core:** SerNr, TransDate, EndDate, StartTime, EndTime, Comment
- **Participants:** MainPersons, CCPersons, Supervisor, NextApprovers
- **Contact:** CUCode, CUName, Contact, Phone
- **Classification:** ActType, ActResult, TimeClass, PrioLevel
- **Status:** OKFlag, TodoFlag, PrivateFlag, Invalid
- **Linked Records:** PRCode (project), ItemCode, SVOSerNr (service order), ProdSerNr
- **Recurring:** RecurringType, RecurringWeekDay, RecurringMonthDay, Mother
- **Alarms:** AlarmType, AlarmWhen, AlarmUnits
- **External:** ExternalType, ExternalID (for calendar sync)
- **Custom:** UserStr1-5, UserVal1-3, UserDate1-3

**Architecture Impact:** CrmActivity model needs significant expansion for recurring events, alarms, and calendar sync.

### Approval Workflows (AcceptanceRulesVc)

| Field | Description |
|-------|-------------|
| Register | Which entity needs approval |
| Type | Per-record or per-row |
| OKApproved | Must mark OK after approval |
| Matrix rows | Limit (amount threshold), AcceptanceType, AcceptanceBy, NextLevel (escalation) |
| Activity types | For each workflow state (requested, rejected, accepted, cancelled, forwarded, absent) |

**Architecture Impact:** Need an `ApprovalRule` model with multi-level threshold-based routing.

### Notes (NotepadVc)

| Field | Description |
|-------|-------------|
| SerNr | Primary key |
| FromRecidStr | Record the note is attached to (M4RLink) |
| Classification | Note category |
| NoteType | Note type |
| Math | Rich text content |

**Architecture Impact:** Need a `Note` model with polymorphic linking.

### Record History/Audit (RHistVc)

Already covered by §2.6 (Immutable Audit Trail) but needs:
- `accode` (action code: insert/update/delete)
- `RecidStr` (which record changed)
- `Math` (change details blob)

### Multi-Company (CompaniesBlock, DaughterCompBlock)

Already covered by database-per-tenant but consolidation features need:
- ConsERVc (consolidation exchange rates)
- ShareVcSetBlock (shared registers across companies)
- DaughterCompBlock (subsidiary relationships)

### OKFlag Pattern (437 occurrences across all modules)

Universal approval mechanism. Every transactional register has:
- `OKFlag` (approval status)
- Indexes on OKFlag for filtering pending items
- Business logic triggered on OKFlag change (GL posting, stock updates, etc.)

**Architecture Impact:** This maps to the `status` enum pattern already in architecture (DRAFT→APPROVED→POSTED). Confirm all transaction entities implement this.

---

## Gap Summary by Priority

### MVP Gaps (Must Add to Architecture)

1. **BankAccount model** — Bank details, SWIFT, sort code
2. **BankTransaction model** — Imported bank statement lines
3. **BankReconciliation model** — Matching bank lines to GL entries
4. **InventoryItem model** — Full 50+ field item master
5. **ItemGroup model** — Item classification
6. **Warehouse model** — Location with full address, WHM fields
7. **StockMovement model** — Stock in/out/transfer
8. **ItemHistory model** — Stock transaction audit trail
9. **SalesOrder model** — Full order with line items
10. **Quotation model** — Quote lifecycle
11. **Dispatch model** — Shipment/delivery note
12. **PurchaseOrder model** — Full PO with line items
13. **GoodsReceipt model** — Receiving against PO
14. **Supplier model** — Full vendor entity (60+ fields)
15. **SupplierBill model** — Purchase invoice
16. **SupplierPayment model** — Outward payment
17. **ARDetail model** — Aging record per invoice
18. **CustomerPayment model** — Incoming payment with allocation
19. **DeliveryAddress model** — Multiple ship-to per customer
20. **CustomerContact model** — Multiple contacts per customer
21. **PriceList model** — Price list header
22. **PriceListEntry model** — Item prices per list
23. **PriceListQtyBreak model** — Volume discount tiers
24. **FixedAssetClass model** — Asset type definitions
25. **FixedAssetUnit model** — Individual asset records
26. **DepreciationMethod model** — SL, DB, UoP
27. **DepreciationRun model** — Period depreciation records
28. **AssetDisposal model** — Write-off/sale records
29. **SubLedgerControl expansion** — AccBlock's 62+ account mappings
30. **Attachment model** — Cross-module file attachments
31. **RecordLink model** — Cross-module navigation links

### P1 Gaps

32. Budget models (BudgetEntry, BudgetPeriod, BudgetClass)
33. Installment plans (ARInstallment)
34. Dunning/Reminder letters
35. Customer Returns
36. Supplier Returns
37. Purchase Planning
38. Purchase Quotations
39. Stock Reservations
40. Stock Take (physical counts)
41. Internal Transfers
42. Barcodes
43. Rebate/Discount engine
44. Approval Rules
45. Asset Movement
46. Asset Responsibility Transfer
47. Asset Stocktake
48. Account Classification groups
49. Cost Centre Transactions

### P2+ Gaps

50. Forex transactions
51. Transaction archiving
52. Pre-quotations
53. Blanket orders (Sales & Purchase)
54. Multi-buy promotions
55. Coupons/gift cards
56. Interest invoices
57. Planned payments
58. Credit card records
59. Advanced price templates
60. Asset revaluation
61. Inflation coefficients
62. Consolidation exchange rates
63. Shared registers across companies

---

## Recommended Next Steps

1. **Expand SubLedgerControl** into a comprehensive `AccountMapping` system that covers AccBlock's 62+ account mappings
2. **Design core transaction models** (Invoice, Bill, Payment, JournalEntry line items) with the full field sets discovered
3. **Design inventory stack** (Item, Warehouse, StockMovement, ItemHistory)
4. **Design sales pipeline** (Quote, Order, Dispatch)
5. **Design purchase pipeline** (PO, GRN, Bill, Payment)
6. **Design Fixed Assets module** from scratch (new §2.13)
7. **Design Pricing engine** (PriceList, entries, qty breaks, rebates)
8. **Design cross-cutting infrastructure** (Attachment, Note, RecordLink, ApprovalRule)
9. **Update build sequence** to reflect new models and dependencies
