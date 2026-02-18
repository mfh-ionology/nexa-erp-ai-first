# DATA_MODEL — HansaWorld Legacy ERP Entity & Schema Extraction

> **Generated:** 2026-02-15
> **Source:** `legacy-src/c8520240417/amaster/datadef1.hal` through `datadef11.hal`
> **Status:** COMPLETE
> **Total Entities:** 1,055 unique registers (54 core registers fully extracted)
> **Comprehensive Extraction:** `/tmp/hansaworld_hal_data_model_extraction.txt` (4,391 lines)

---

## 0. Extraction Summary Statistics

| Metric | Value |
|--------|-------|
| Core registers extracted | 54 (of 1,055 total in codebase) |
| Header fields | 2,452 |
| Array/matrix fields | 718 |
| **Total fields** | **3,170** |
| Foreign key relationships | 565 |
| Module areas covered | 13 |
| Source files parsed | datadef1.hal through datadef11.hal |

---

## 1. HAL Data Model Overview

HansaWorld's database uses a proprietary record-based storage engine (not SQL). Schema is defined in HAL using:

| HAL Construct | SQL Equivalent | Description |
|---------------|----------------|-------------|
| `RecordBegin(Name, -, "key")` | `CREATE TABLE` | Defines a register (entity/table) |
| `RecordField(Name, Type, Size, Link)` | Column definition | Defines a field; Link parameter = FK reference |
| `ArrayBegin` / `ArrayField` / `EndArray` | Child table / line items | Defines repeating row structures within a record |
| `MainKeyBegin` / `KeySegment` | `PRIMARY KEY` | Primary key definition |
| `SubsetKeyBegin2` / `KeyBegin` | `CREATE INDEX` | Secondary indexes |
| `SerialNoBlock` | `SERIAL` / `SEQUENCE` | Auto-increment serial number |

### HAL Type System

| HAL Type | SQL Equivalent | Description |
|----------|---------------|-------------|
| M4Str | VARCHAR | String, size specified |
| M4UStr | VARCHAR | Unicode string |
| M4Code | VARCHAR (indexed) | Code/key field, used for lookups/FK |
| M4Int | INTEGER | Integer |
| M4Long | BIGINT | Long integer |
| M4Val | DECIMAL | Decimal value (monetary) |
| M4Date | DATE | Date |
| M4DateTime | TIMESTAMP | Date and time |
| M4Time | TIME | Time only |
| M4Bool | BOOLEAN | Boolean |
| M4Mark | BOOLEAN | Checkbox/mark |
| M4Rate | DECIMAL | Exchange rate |
| M4Qty | DECIMAL | Quantity |
| M4Set | INTEGER (enum) | Set/enum value |
| M4Matrix | — | Matrix/sub-table marker |
| M4PackedMatrix | — | Compressed matrix |
| M4Pict | BLOB | Image |
| M4Blob | BLOB | Binary data |
| M4TextField | TEXT | Long text |
| M4PhoneNo | VARCHAR | Phone number |
| M4UVal | DECIMAL | Unsigned value |
| M41Val | DECIMAL | 1-decimal value |
| M45Val | DECIMAL | 5-decimal precision value |
| M423Val | DECIMAL | 23-digit precision value |
| M4PrcStr | VARCHAR | Percentage string |
| M4List | VARCHAR | List of codes |
| M4StrSet | INTEGER (enum) | String-indexed set |

---

## 2. Register-by-Register Summary Table

All 54 extracted core registers with field counts and source information.

| Register | Persist Key | Fields | Array Fields | Links | Source File |
|----------|-------------|--------|-------------|-------|-------------|
| **FINANCE/GL** | | | | | |
| AccVc | konto5 | 22 | 2 | 7 | datadef1.hal |
| AccTransVc | — | 7 | 4 | 4 | datadef4.hal |
| AccHistVc | — | 6 | 0 | 1 | datadef11.hal |
| AccPeriodVc | — | 5 | 4 | 0 | datadef4.hal |
| AccClassVc | — | 4 | 0 | 1 | datadef11.hal |
| AccClassTypeVc | — | 2 | 0 | 0 | datadef11.hal |
| **AR (INVOICES/RECEIVABLES)** | | | | | |
| IVVc | IVVc4 | 31 | 100 | 27 | datadef2.hal |
| IVCashVc | ivcash2 | 141 | 79 | 44 | datadef6.hal |
| CUVc | cu5 | 313 | 0 | 32 | datadef1.hal |
| ARVc | — | 11 | 0 | 2 | datadef1.hal |
| ARPayVc | — | 15 | 0 | 4 | datadef1.hal |
| ARInstallVc | — | 7 | 0 | 2 | datadef1.hal |
| **AP (PURCHASE INVOICES/PAYABLES)** | | | | | |
| PUVc | purchase2 | 73 | 84 | 25 | datadef1.hal |
| VEVc | ve2 | 50 | 0 | 9 | datadef1.hal |
| APVc | — | 12 | 0 | 2 | datadef1.hal |
| APPayVc | — | 7 | 0 | 2 | datadef1.hal |
| **INVENTORY** | | | | | |
| INVc | artikel5 | 211 | 2 | 44 | datadef3.hal |
| ITVc | ITVc2 | 67 | 2 | 45 | datadef1.hal |
| StockMovVc | stockmov1 | 110 | 26 | 13 | datadef3.hal |
| StockReservVc | — | 17 | 0 | 4 | datadef9.hal |
| LocationVc | location2 | 55 | 0 | 10 | datadef2.hal |
| StockTakeVc | — | 11 | 19 | 5 | datadef1.hal |
| **SALES ORDERS** | | | | | |
| ORVc | ORVc3 | 165 | 66 | 41 | datadef2.hal |
| QTVc | — | 148 | 57 | 42 | datadef3.hal |
| COVc | co1 | 102 | 44 | 28 | datadef3.hal |
| **PURCHASE ORDERS** | | | | | |
| POVc | POVc2 | 96 | 50 | 27 | datadef2.hal |
| **CRM** | | | | | |
| ContactVc | contact1 | 32 | 0 | 2 | datadef3.hal |
| ActVc | ActVc3 | 89 | 2 | 18 | datadef3.hal |
| LeadVc | — | 39 | 0 | 10 | datadef11.hal |
| CampaignVc | — | 16 | 4 | 5 | datadef11.hal |
| **HR/PAYROLL** | | | | | |
| HRMPAVc | — | 10 | 5 | 4 | datadef11.hal |
| HRMPayrollVc | — | 13 | 3 | 3 | datadef11.hal |
| HRMCOVc | HRMCOVc2 | 36 | 9 | 4 | datadef11.hal |
| HRMPymtTypeVc | — | 4 | 0 | 1 | datadef11.hal |
| StaffVc | staff2 | 12 | 0 | 0 | datadef2.hal |
| **FIXED ASSETS** | | | | | |
| AT2Vc | — | 17 | 2 | 1 | datadef6.hal |
| AT2DprVc | — | 27 | 0 | 2 | datadef6.hal |
| AT2MovVc | — | 8 | 3 | 1 | datadef6.hal |
| **POS** | | | | | |
| POSSalesVc | — | 29 | 13 | 6 | datadef9.hal |
| CashVc | CashVc2 | 15 | 6 | 5 | datadef8.hal |
| DrawerVc | DrawerVc2 | 2 | 0 | 0 | datadef8.hal |
| **VAT/TAX** | | | | | |
| VATDeclVc | — | 19 | 6 | 2 | datadef11.hal |
| TaxTemplateVc | TaxTemplateVc2 | 5 | 4 | 1 | datadef11.hal |
| VATClassVc | — | 2 | 0 | 0 | datadef11.hal |
| **BANKING** | | | | | |
| BankVc | bank2 | 35 | 0 | 1 | datadef3.hal |
| BankRecVc | — | 23 | 18 | 10 | datadef5.hal |
| BankTRVc | — | 35 | 0 | 2 | datadef9.hal |
| **SERVICE/CONTRACTS** | | | | | |
| SVOVc | — | 84 | 28 | 21 | datadef5.hal |
| AgreementVc | — | 69 | 0 | 10 | datadef7.hal |
| ServiceUsageVc | — | 16 | 0 | 1 | datadef9.hal |
| **MANUFACTURING** | | | | | |
| ProdVc | — | 45 | 40 | 12 | datadef2.hal |
| ProdOrderVc | — | 40 | 15 | 6 | datadef2.hal |
| ProdOperationVc | — | 35 | 17 | 10 | datadef9.hal |
| ProdItemVc | — | 7 | 4 | 6 | datadef2.hal |
| | | **2,452** | **718** | **565** | |

---

## 3. Core ERP Entities — Detailed Schema

### 3.1 Customer — CUVc (313 header fields, 32 relationships)

**Source:** `datadef1.hal` — `RecordBegin(CUVc,-,"cu5")`
**Persistence Key:** `cu5`

This is the **largest register** in the extraction. CUVc serves as a unified entity for customers, suppliers (via dual-purpose fields), contacts, guests, employees, and leads.

#### Key Header Fields (Top 60)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| Code | M4Code | 20 | CUVc (self) | Customer code (PK) |
| Name | M4Str | 200 | — | Customer/company name |
| FirstName | M4Str | 255 | — | First name (person) |
| Person | M4Str | 60 | — | Contact person |
| InvAddr0 | M4Str | 60 | — | Invoice address line 0 |
| InvAddr1 | M4Str | 60 | — | Invoice address line 1 |
| InvAddr2 | M4Str | 60 | — | Invoice address line 2 |
| InvAddr3 | M4Str | 60 | — | Invoice address line 3 |
| InvAddr4 | M4Str | 60 | — | Invoice address line 4 |
| DelAddr0 | M4Str | 60 | — | Delivery address line 0 |
| DelAddr1 | M4Str | 60 | — | Delivery address line 1 |
| DelAddr2 | M4Str | 60 | — | Delivery address line 2 |
| DelAddr3 | M4Str | 60 | — | Delivery address line 3 |
| DelAddr4 | M4Str | 60 | — | Delivery address line 4 |
| Phone | M4PhoneNo | 20 | — | Primary phone |
| AltPhone | M4PhoneNo | 20 | — | Alternate phone |
| Mobile | M4PhoneNo | 20 | — | Mobile phone |
| Fax | M4Str | 20 | — | Fax number |
| eMail | M4Str | 100 | — | Email address |
| wwwAddr | M4Str | 60 | — | Website URL |
| VATNr | M4Str | 20 | — | VAT registration number |
| CountryCode | M4Code | 5 | — | Country code |
| CustCat | M4Code | 5 | CCatVc | Customer category |
| CustType | M4Int | — | — | Customer type |
| PayDeal | M4Code | 3 | — | Payment terms code |
| ExportFlag | M4Int | — | — | Export/domestic flag |
| CreditLimit | M4Val | — | — | Credit limit amount |
| CreditLimitDays | M4Long | — | — | Credit limit in days |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Default currency |
| SalesMan | M4Code | 10 | UserVc | Assigned salesperson |
| PLCode | M4Code | 20 | PLDefVc | Price list code |
| Objects | M4UStr | 60 | ObjVc | Default cost centre/dimensions |
| VATCode | M4Code | 10 | VATCodeBlock | Default VAT code |
| Classification | M4List | 200 | CClassVc | Customer classifications |
| Region | M4Code | 20 | RegionVc | Sales region |
| SalesGroup | M4Code | 5 | SalesGroupVc | Sales group |
| LangCode | M4Code | 5 | — | Language code |
| SearchKey | M4UStr | 10 | — | Search/sort key |
| InvoiceToCode | M4Code | 20 | CUVc | Bill-to customer (FK self) |
| LocationCode | M4Code | 10 | LocationVc | Default warehouse |
| blockedFlag | M4Int | — | — | Blocked/inactive flag |
| OnHoldFlag | M4Int | — | — | On-hold flag |
| InterestFlag | M4Int | — | — | Charge interest flag |
| RemndrFlag | M4Int | — | — | Send reminders flag |
| DateCreated | M4Date | — | — | Creation date |
| DateChanged | M4Date | — | — | Last modified date |
| Closed | M4Mark | — | — | Closed/archived flag |
| AccAP | M4Code | 10 | AccVc | AP control account |
| AccCost | M4Code | 10 | AccVc | Cost account |
| OnAccAccAP | M4Code | 10 | AccVc | On-account AP account |
| PurchAcc | M4Code | 10 | AccVc | Purchase account |
| BankAccount | M4Str | 60 | — | Bank account number |
| IBANCode | M4UStr | 60 | — | IBAN code |
| SWIFT | M4Str | 60 | — | SWIFT/BIC code |
| TaxTemplateCode | M4Code | 10 | TaxTemplateVc | Tax template (domestic) |
| VETaxTemplateCode | M4Code | 10 | TaxTemplateVc | Tax template (as supplier) |
| Sign | M4Code | 10 | UserVc | Created by user |
| ModifiedSign | M4Code | 10 | UserVc | Modified by user |
| Status | M4Code | 10 | LeadStatusVc | Lead/customer status |
| BusinessNature | M4Code | 20 | BNVc | Business nature code |

#### Supplier-Role Fields (CUVc dual-purpose as VEVc)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| VEType | M4Int | — | — | Supplier type |
| CUType | M4Int | — | — | CU type (Customer/Supplier/Both) |
| VEPayDeal | M4Code | 3 | — | Supplier payment terms |
| VEShipDeal | M4Code | 5 | — | Supplier shipping terms |
| VEShipMode | M4Code | 5 | — | Supplier shipping mode |
| VECreditLimit | M4Val | — | — | Supplier credit limit |
| VEObjects | M4UStr | 60 | ObjVc | Supplier cost centre |
| VEFactoring | M4Code | 20 | CUVc | Supplier factoring party |
| VECurncyCode | M4Code | 5 | CurncyCodeVc | Supplier currency |
| VEVATCode | M4Code | 10 | VATCodeBlock | Supplier VAT code |
| VECat | M4Code | 5 | VGVc | Supplier category |
| VECustID | M4Str | 20 | — | Our code at supplier |

#### Guest/Hotel Fields

| Field | Type | Size | Description |
|-------|------|------|-------------|
| GuestType | M4Int | — | Guest type |
| PassportNr | M4Str | 20 | Passport number |
| Nationality | M4Str | 20 | Nationality |
| BirthDate | M4Date | — | Date of birth |
| Gender | M4Int | — | Gender |
| Smoking | M4Int | — | Smoking preference |
| Blacklist | M4Int | — | Blacklisted flag |

#### Employee/HR Fields

| Field | Type | Size | Description |
|-------|------|------|-------------|
| EmployeeType | M4Int | — | Employee type |
| Ethnicity | M4Str | 100 | Ethnicity |
| BirthPlace | M4Str | 100 | Place of birth |
| IDNr | M4Str | 60 | ID number |
| SocialSecurityNr | M4Str | 100 | Social security number |
| DisabledStatus | M4Int | — | Disability status |
| EducationalDegree | M4Str | 60 | Education degree |
| PreviousEmployer | M4Str | 60 | Previous employer |

#### Lead/CRM Fields

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| LeadType | M4Int | — | — | Lead type |
| Rating | M4Int | — | — | Lead rating |
| Partner | M4Code | 20 | CUVc | Partner reference |
| Source | M4Code | 10 | LeadSourceVc | Lead source |
| Industry | M4Code | 10 | IndustryVc | Industry code |
| Value | M4Val | — | — | Lead value |

#### User-Defined Fields

| Field | Type | Size | Description |
|-------|------|------|-------------|
| UserStr1-5 | M4Str | 255 | Custom string fields 1-5 |
| UserVal1-3 | M4UVal | — | Custom numeric fields 1-3 |
| UserDate1-3 | M4Date | — | Custom date fields 1-3 |

**Relationships (32 targets):**
AccVc, AcceptGroupVc, BNVc, CCatVc, CClassVc, CurncyCodeVc, DIVc, IndustryVc, LeadSourceVc, LeadStatusVc, LocationVc, OTVc, ObjVc, PLDefVc, PMBlock, RegionVc, SalesGroupVc, TaxExemptionsBlock, TaxTemplateVc, UserVc, VATCodeBlock, VGVc, WebDisplayVc + self-references (InvoiceToCode, TourOperator, Agent, Partner, MainPartner, VEFactoring, VEInvoiceToCode)

---

### 3.2 Item/Article — INVc (211 header fields + 2 array fields, 44 relationships)

**Source:** `datadef3.hal` — `RecordBegin(INVc,-,"artikel5")`
**Persistence Key:** `artikel5`

#### Key Header Fields (Top 60)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| Code | M4Code | 20 | INVc (self) | Item code (PK) |
| Name | M4Str | 100 | — | Item description |
| Unittext | M4Str | 10 | — | Primary unit of measure |
| Unittext2 | M4Str | 10 | — | Secondary unit of measure |
| UnitCoefficient | M45Val | — | — | Unit conversion factor |
| ItemType | M4Int | — | — | Item type (Stock/Non-stock/Service) |
| Group | M4Code | 5 | ITVc | Item group (FK) |
| BarCode | M4Code | 20 | — | Barcode/EAN |
| GTINNumber | M4Str | 255 | — | GTIN number |
| Brand | M4Str | 60 | — | Brand name |
| BrandType | M4Str | 60 | — | Brand type |
| SortCode | M4Str | 5 | — | Sort code |
| Reference | M4Str | 60 | — | Reference/cross-ref |
| AlternativeCode | M4Str | 40 | — | Alternative item code |
| InPrice | M45Val | — | — | Cost/purchase price |
| InPriceB2 | M45Val | — | — | Cost price (base 2) |
| UPrice1 | M423Val | — | — | Sales price 1 |
| WeighedAvPrice | M45Val | — | — | Weighted average cost |
| WeighedAvPriceB2 | M45Val | — | — | Weighted avg (base 2) |
| LastPurchPrice | M45Val | — | — | Last purchase price |
| LastPurchCurncyCode | M4Code | 5 | CurncyCodeVc | Last purchase currency |
| InCurncyCode | M4Code | 5 | CurncyCodeVc | Cost price currency |
| Markup | M4Qty | — | — | Default markup % |
| CostPerc | M4Val | — | — | Cost percentage |
| PriceFactor | M45Val | — | — | Price factor |
| CalcPrice | M4Code | 5 | — | Price calculation method |
| LastPriceChange | M4Date | — | — | Last price change date |
| LastBasePriceChange | M4Date | — | — | Last base price change |
| SalesAcc | M4Code | 10 | AccVc | Domestic sales GL account |
| EUSalesAcc | M4Code | 10 | AccVc | EU sales account |
| ExpSalesAcc | M4Code | 10 | AccVc | Export sales account |
| CostAcc | M4Code | 10 | AccVc | Cost of goods account |
| EUCostAcc | M4Code | 10 | AccVc | EU cost account |
| ExpCostAcc | M4Code | 10 | AccVc | Export cost account |
| CredSalesAcc | M4Code | 10 | AccVc | Credit note sales account |
| CredEUSalesAcc | M4Code | 10 | AccVc | Credit note EU sales account |
| CredExpSalesAcc | M4Code | 10 | AccVc | Credit note export sales account |
| CompUsage | M4Code | 10 | AccVc | Component usage account |
| ProjMaterialsUsageAcc | M4Code | 10 | AccVc | Project materials account |
| VATCode | M4Code | 10 | VATCodeBlock | Domestic VAT code |
| VATCodeEU | M4Code | 10 | VATCodeBlock | EU VAT code |
| VATCodeExp | M4Code | 10 | VATCodeBlock | Export VAT code |
| CredVATCode | M4Code | 10 | VATCodeBlock | Credit note domestic VAT |
| CredVATCodeEU | M4Code | 10 | VATCodeBlock | Credit note EU VAT |
| CredVATCodeExp | M4Code | 10 | VATCodeBlock | Credit note export VAT |
| RvrsVATCode | M4Code | 10 | VATCodeBlock | Reverse charge VAT code |
| Objects | M4UStr | 60 | ObjVc | Default dimensions |
| MinLevel | M4Qty | — | — | Minimum/reorder level |
| MaxLevel | M4Qty | — | — | Maximum stock level |
| Weight | M45Val | — | — | Gross weight |
| NetWeight | M45Val | — | — | Net weight |
| Volume | M45Val | — | — | Volume |
| Width | M4UVal | — | — | Width |
| Height | M4UVal | — | — | Height |
| Depth | M4UVal | — | — | Depth |
| DefLocation | M4Code | 10 | LocationVc | Default warehouse |
| Recepy | M4Code | 20 | RecVc | Production recipe/BOM |
| InvRecepy | M4Code | 20 | RecVc | Inventory recipe |
| ContractItem | M4Code | 20 | INVc | Contract item (self-ref) |
| RentalItem | M4Code | 20 | INVc | Rental item (self-ref) |
| DefPalletItem | M4Code | 20 | INVc | Default pallet item (self-ref) |
| Terminated | M4Int | — | — | Terminated/discontinued |
| SerNrf | M4Int | — | — | Serial number tracking |
| VARList | M4UStr | 30 | — | Variant list |
| VARMask | M4UStr | 60 | — | Variant mask |

#### Costing Model Fields

| Field | Type | Description |
|-------|------|-------------|
| PrimaryCostModel | M4Int | Primary cost model (FIFO/WA/Standard) |
| QueuedCostModel | M4Int | Queued cost model |
| FIFOPerSerialNr | M4Int | FIFO per serial number |
| FIFOPerLocation | M4Int | FIFO per location |
| WAPerLocation | M4Int | Weighted average per location |
| CostPricePerLocation | M4Int | Cost price per location |

#### Tax/Fiscal Fields

| Field | Type | FK Link | Description |
|-------|------|---------|-------------|
| TaxTemplateCode | M4Code | TaxTemplateVc | Tax template (domestic) |
| TaxTemplateCodeEU | M4Code | TaxTemplateVc | Tax template (EU) |
| TaxTemplateCodeExp | M4Code | TaxTemplateVc | Tax template (export) |
| VATGroup | M4Code | VATGroupVc | VAT group |
| ChemicalTaxCode | M4Code | ChemicalTaxCodeBlock | Chemical tax code |
| HSCode | M4Str | — | Harmonized system code |

#### Array: Math (2 fields — Language translations)

| Field | Type | Size | Description |
|-------|------|------|-------------|
| LangCode | M4Code | 5 | Language code |
| Text | M4Str | 100 | Translated item name |

**Relationships (44 target references):**
AccVc (20 fields!), ChemicalTaxCodeBlock, CurncyCodeVc, DIVc, FiscalDepVc, HazLevVc, ITVc, LocationVc, NobbModuleVc, ObjVc, RecVc, TaxTemplateVc, VATCodeBlock (7 fields), VATGroupVc + self-references (ContractItem, RentalItem, DefPalletItem)

---

### 3.3 Sales Invoice — IVVc (31 header fields + 100 array fields, 27 relationships)

**Source:** `datadef2.hal` — `RecordBegin(IVVc,-,"IVVc4")`
**Persistence Key:** `IVVc4`

#### Header Fields (31)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| SerNr | M4Long | — | — | Serial number (PK, auto-increment) |
| InvDate | M4Date | — | — | Invoice date |
| CustCode | M4Code | 20 | CUVc | Customer code (FK) |
| PayDate | M4Date | — | — | Payment due date |
| Addr0 | M4Str | 200 | — | Customer name (on invoice) |
| Addr1-3 | M4Str | 60 | — | Address lines 1-3 |
| OurContact | M4Str | 20 | — | Our contact person |
| ClientContact | M4Str | 60 | — | Client contact person |
| ExportFlag | M4Int | — | — | Export/domestic flag |
| PayDeal | M4Code | 3 | — | Payment terms code |
| OrderNr | M4Long | — | — | Linked order number (FK to ORVc) |
| OKFlag | M4Mark | — | — | Approved/posted flag |
| pdays | M4Long | — | — | Payment days |
| InvType | M4Int | — | — | Invoice type |
| PriceList | M4Code | 20 | PLDefVc | Price list used |
| Objects | M4UStr | 60 | ObjVc | Cost centre/dimensions |
| InclVAT | M4Int | — | — | Prices include VAT flag |
| ARAcc | M4Code | 10 | AccVc | AR control account |
| InvComment | M4Str | 200 | — | Invoice comment/notes |
| CredInv | M4Long | — | — | Credit note reference |
| SalesMan | M4UStr | 60 | UserVc | Salesperson |
| CustCat | M4Code | 5 | — | Customer category |
| Prntdf | M4Int | — | — | Print format |
| pdvrebt | M4Qty | — | — | Payment discount percent |
| pdrdays | M4Long | — | — | Payment discount days |
| pdComment | M4Str | 60 | — | Payment deal comment |
| xStatFlag | M4Int | — | — | Statistics flag |
| CredMark | M4Str | 1 | — | Credit mark |
| Math | M4Matrix | — | — | Line items array |

#### Line Item Fields — Array: Math (100 fields per row)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| stp | M4Int | — | — | Row type indicator |
| ArtCode | M4Code | 20 | INVc | Item/article code (FK) |
| Quant | M4UVal | — | — | Quantity |
| Price | M423Val | — | — | Unit price |
| Sum | M4Val | — | — | Row total |
| vRebate | M41Val | — | — | Rebate/discount |
| SalesAcc | M4Code | 10 | AccVc | Revenue GL account |
| Objects | M4UStr | 60 | ObjVc | Cost centre/dimensions |
| BasePrice | M4Val | — | — | Base price (before discount) |
| rowGP | M4Val | — | — | Row gross profit |
| FIFO | M45Val | — | — | FIFO cost value |
| Spec | M4Str | 100 | — | Description/specification |
| VATCode | M4Code | 10 | VATCodeBlock | VAT code per line |
| Recepy | M4Code | 20 | RecVc | Recipe reference |
| SerialNr | M4Str | 60 | — | Serial number |
| VARList | M4UStr | 30 | — | Variant list |
| UnitCode | M4Code | 5 | — | Unit of measure |
| UnitFactQuant | M4UVal | — | — | Unit conversion (qty) |
| UnitFactPrice | M423Val | — | — | Unit conversion (price) |
| VECode | M4Code | 20 | VEVc | Supplier code (drop-ship) |
| CreditCard | M4UStr | 20 | CreditCardVc | Credit card reference |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Row currency code |
| Location | M4Code | 10 | LocationVc | Warehouse per line |
| Comment | M4Str | 100 | — | Line comment |
| DiscApprovedBy | M4Code | 10 | UserVc | Discount approver |
| TaxMatrix | M4PackedMatrix | — | TaxMatrixVc | Line-level tax data |
| TaxTemplateCode | M4UStr | 60 | TaxTemplateVc | Tax template |
| OrdNr | M4Long | — | — | Source order number |
| MotherArtCode | M4Code | 20 | INVc | Mother/parent item |
| CustArtCode | M4Code | 20 | CUINVc | Customer article code |
| Salesmen | M4UStr | 60 | UserVc | Multiple salespeople |
| CountryOfOrg | M4Code | 5 | CountryVc | Country of origin |
| RvrsVATCode | M4Code | 10 | VATCodeBlock | Reverse charge VAT |

**Relationships (27):** AccVc, CUINVc, CUVc, CountryVc, CreditCardVc, CurncyCodeVc, INVc, LocationVc, MultiBuyRebVc, ObjVc, PLDefVc, RecVc, ResUsageVc, TaxMatrixVc, TaxTemplateVc, UserVc, VATCodeBlock, VEVc

---

### 3.4 Sales Order — ORVc (165 header fields + 66 array fields, 41 relationships)

**Source:** `datadef2.hal` — `RecordBegin(ORVc,-,"ORVc3")`
**Persistence Key:** `ORVc3`

#### Key Header Fields

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| SerNr | M4Long | — | — | Serial number (PK) |
| OrdDate | M4Date | — | — | Order date |
| CustCode | M4Code | 20 | CUVc | Customer code |
| InvoiceToCode | M4Code | 20 | CUVc | Bill-to customer |
| BranchID | M4Code | 20 | CUVc | Branch ID |
| Addr0-3 | M4Str | 60 | — | Invoice address |
| ShipAddr0-3 | M4Str | 60 | — | Delivery address |
| OurContact | M4Str | 20 | — | Our contact |
| CustContact | M4Str | 60 | — | Customer contact |
| CustOrdNr | M4Str | 60 | — | Customer order reference |
| SalesMan | M4UStr | 60 | UserVc | Salesperson |
| Sign | M4Code | 10 | UserVc | Created by user |
| PayDeal | M4Code | 3 | — | Payment terms |
| ShipMode | M4Code | 5 | — | Shipping method |
| ShipDeal | M4Code | 5 | — | Shipping terms |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Currency |
| PriceList | M4Code | 20 | PLDefVc | Price list |
| InclVAT | M4Int | — | — | Prices include VAT |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| Location | M4Code | 10 | LocationVc | Warehouse |
| PRCode | M4Code | 20 | PRVc | Project code |
| OrderStatus | M4Int | — | — | Order status |
| OrderType | M4Set | 433 | — | Order type set |
| OrderClass | M4Code | 5 | — | Order class |
| Closed | M4Mark | — | — | Closed flag |
| OKFlag | M4Mark | — | — | Approved flag |
| InvFlag | M4Int | — | — | Invoiced flag |
| ShipFlag | M4Int | — | — | Shipped flag |
| InvMark | M4Mark | — | — | Invoice mark |
| ShipMark | M4Mark | — | — | Shipment mark |
| Sum0-4 | M4Val | — | — | Summary amounts |
| BaseSum4 | M4Val | — | — | Base currency total |
| DiscPerc | M4Qty | — | — | Discount % |
| DiscSum | M4Val | — | — | Discount amount |
| TotGP | M4Val | — | — | Total gross profit |
| Probability | M41Val | — | — | Win probability |
| DespatchDate | M4Date | — | — | Despatch date |
| PlanShipDate | M4Date | — | — | Planned ship date |
| SalesGroup | M4UStr | 30 | SalesGroupVc | Sales group |
| Region | M4Code | 20 | RegionVc | Region |
| BankCode | M4Code | 12 | BankVc | Bank code |
| CreditCard | M4UStr | 20 | CreditCardVc | Credit card |
| CustVATCode | M4Code | 10 | VATCodeBlock | Customer VAT code |
| TaxMatrix | M4PackedMatrix | — | TaxMatrixVc | Tax matrix |
| AcceptanceStatus | M4Int | — | — | Approval status |
| AcceptanceBy | M4List | 200 | UserVc | Approved by |
| AcceptanceFYI | M4List | 200 | UserVc | FYI users |

#### Key Array Fields — Math (66 fields per row)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| stp | M4Int | — | — | Row type |
| ArtCode | M4Code | 20 | INVc | Item code |
| Quant | M4UVal | — | — | Quantity |
| Price | M423Val | — | — | Unit price |
| Sum | M4Val | — | — | Row total |
| vRebate | M41Val | — | — | Rebate/discount |
| SalesAcc | M4Code | 10 | AccVc | Sales GL account |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| Shipd1 | M4UVal | — | — | Shipped qty (partial 1) |
| Shipd2 | M4UVal | — | — | Shipped qty (partial 2) |
| Invd | M4UVal | — | — | Invoiced quantity |
| BasePrice | M423Val | — | — | Base price |
| rowGP | M4Val | — | — | Row gross profit |
| Spec | M4Str | 100 | — | Description |
| VATCode | M4Code | 10 | VATCodeBlock | VAT code |
| SerialNr | M4Str | 60 | — | Serial number |
| Location | M4Code | 10 | LocationVc | Warehouse |
| VECode | M4Code | 20 | VEVc | Supplier (drop-ship) |
| Production | M4Code | 20 | ProdVc | Production order |
| Source | M4Code | 10 | SourceVc | Order source |
| MotherArtCode | M4Code | 20 | INVc | Parent item |
| CustArtCode | M4Code | 20 | CUINVc | Customer article code |
| Salesmen | M4UStr | 60 | UserVc | Multiple salespeople |
| DiscApprovedBy | M4Code | 10 | UserVc | Discount approver |
| TaxTemplateCode | M4UStr | 60 | TaxTemplateVc | Tax template |
| TaxMatrix | M4PackedMatrix | — | TaxMatrixVc | Line tax |
| Region | M4Code | 20 | RegionVc | Row region |
| RvrsVATCode | M4Code | 10 | VATCodeBlock | Reverse charge VAT |

**Relationships (41):** AccVc, BankVc, CUINVc, CUVc (3 refs), CreditCardVc, CurncyCodeVc, INVc (3 refs), LocationVc, OYVc, ObjVc (3 refs), PLDefVc, PRVc, ProdVc, RecVc, RegionVc, SalesGroupVc, SourceVc, TaxMatrixVc, TaxTemplateVc, UserVc (6 refs), VATCodeBlock (4 refs), VEVc

---

### 3.5 Purchase Order — POVc (96 header fields + 50 array fields, 27 relationships)

**Source:** `datadef2.hal` — `RecordBegin(POVc,-,"POVc2")`
**Persistence Key:** `POVc2`

#### Key Header Fields

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| SerNr | M4Long | — | — | Serial number (PK) |
| VECode | M4Code | 20 | VEVc | Supplier code |
| TransDate | M4Date | — | — | Order date |
| PayDeal | M4Code | 3 | — | Payment terms |
| OKFlag | M4Mark | — | — | Approved flag |
| Addr0-3 | M4Str | 60 | — | Supplier address |
| ShipAddr0-3 | M4Str | 60 | — | Delivery address |
| OurContact | M4Str | 20 | — | Our contact |
| VEContact | M4Str | 60 | — | Supplier contact |
| ShipMode | M4Code | 5 | — | Shipping method |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Currency |
| Sign | M4Code | 10 | UserVc | Created by user |
| SalesMan | M4Code | 10 | UserVc | Buyer/purchaser |
| LangCode | M4Code | 5 | — | Language code |
| Closed | M4Int | — | — | Closed flag |
| Sum0-4 | M4Val | — | — | Summary amounts |
| PRCode | M4Code | 20 | PRVc | Project code |
| Location | M4Code | 10 | LocationVc | Warehouse |
| VEFactoring | M4Code | 20 | VEVc | Factoring supplier |
| InvoiceToCode | M4Code | 20 | VEVc | Invoice-to supplier |
| BranchID | M4Code | 20 | VEVc | Branch ID |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| Comment | M4Str | 60 | — | Comment |
| InclVAT | M4Int | — | — | Prices include VAT |
| VEVATCode | M4Code | 10 | VATCodeBlock | Supplier VAT code |
| OrderType | M4Set | 433 | — | Order type |
| AcceptanceStatus | M4Int | — | — | Approval status |
| SalesGroup | M4Code | 5 | SalesGroupVc | Sales group |
| Region | M4Code | 20 | RegionVc | Region |
| xAcceptanceGroup | M4Code | 20 | AcceptGroupVc | Acceptance group |

#### Key Array Fields — Math (50 fields per row)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| stp | M4Int | — | — | Row type |
| ArtCode | M4Code | 20 | INVc | Item code |
| VEArtCode | M4Str | 20 | PIVc | Supplier item code |
| Quant | M4UVal | — | — | Quantity |
| Price | M45Val | — | — | Unit price |
| Sum | M45Val | — | — | Row total |
| vRebate | M41Val | — | — | Rebate/discount |
| Spec | M4Str | 100 | — | Description |
| VATCode | M4Code | 10 | VATCodeBlock | VAT code |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| Shipd1 | M4UVal | — | — | Received qty (partial 1) |
| Shipd2 | M4UVal | — | — | Received qty (partial 2) |
| Invd | M4UVal | — | — | Invoiced quantity |
| CostAcc | M4UStr | 10 | AccVc | Cost GL account |
| PRCode | M4Code | 20 | PRVc | Project per line |
| Location | — | — | — | *(not in array, on header)* |
| Comment | M4Str | 100 | — | Line comment |
| TaxTemplateCode | M4UStr | 60 | TaxTemplateVc | Tax template |
| TaxMatrix | M4PackedMatrix | — | TaxMatrixVc | Line tax |
| TAX2Acc | M4Code | 10 | AccVc | Tax 2 account |

**Relationships (27):** AccVc, AcceptGroupVc, CurncyCodeVc, INVc, LocationVc, ObjVc, PIVc, PRVc (2 refs), RegionVc, SalesGroupVc, TaxMatrixVc, TaxTemplateVc, UserVc (4 refs), VATCodeBlock, VEVc (4 refs)

---

### 3.6 Purchase Invoice — PUVc (73 header fields + 84 array fields, 25 relationships)

**Source:** `datadef1.hal` — `RecordBegin(PUVc,-,"purchase2")`
**Persistence Key:** `purchase2`

#### Key Header Fields

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| SerNr | M4Long | — | — | Serial number (PK) |
| RegDate | M4Date | — | — | Registration date |
| TransDate | M4Date | — | — | Transaction date |
| VECode | M4Code | 20 | VEVc | Supplier code |
| VEName | M4Str | 60 | — | Supplier name |
| PONr | M4Long | — | POVc | Purchase order ref |
| Location | M4Code | 10 | LocationVc | Warehouse |
| OKFlag | M4Mark | — | — | Approved/posted flag |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Currency |
| InclVAT | M4Int | — | — | Prices include VAT |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| VEVATCode | M4Code | 10 | VATCodeBlock | Supplier VAT code |
| BranchID | M4Code | 20 | VEVc | Branch ID |
| Comment | M4Str | 60 | — | Comment |
| ShipCost | M4UVal | — | — | Shipping cost |
| CustomsCost | M4UVal | — | — | Customs cost |
| ExtraCost | M4UVal | — | — | Extra costs |
| Cost1-5 | M4UVal | — | — | Additional cost fields |
| VATVal | M4Val | — | — | VAT total |
| SubTotal | M4Val | — | — | Subtotal |
| PayVal | M4Val | — | — | Payment value |
| Invalid | M4Int | — | — | Voided flag |
| AcceptanceStatus | M4Set | 443 | — | Approval status |
| VETaxTemplateCode | M4Code | 10 | TaxTemplateVc | Tax template |
| Sign | M4Code | 10 | UserVc | Created by user |
| AcceptanceBy | M4List | 200 | UserVc | Approved by |
| SalesGroup | M4Code | 5 | SalesGroupVc | Sales group |

#### Key Array Fields — Math (84 fields per row)

Includes: ArtCode (INVc), Quant, UPrice, SerialNr, Spec, VARList, CostPrice, ShipCost, CustomsCost, VATCode, Objects, CostAcc (AccVc), CredAcc (AccVc), Location (LocationVc), BatchStatus (BatchStatusVc), UnitCode, TAX2Acc (AccVc), TaxTemplateCode (TaxTemplateVc), TaxMatrix (TaxMatrixVc), PONr (POVc), plus jewelry-specific fields and many more.

**Relationships (25):** AccVc, BatchStatusVc, CurncyCodeVc, INVc, LocationVc, ObjVc, POVc (2 refs), SalesGroupVc, TaxMatrixVc, TaxTemplateVc, UserVc (4 refs), VATCodeBlock, VEVc (2 refs)

---

### 3.7 Supplier — VEVc (50 header fields, 9 relationships)

**Source:** `datadef1.hal` — `RecordBegin(VEVc,-,"ve2")`
**Persistence Key:** `ve2`

**Note:** VEVc is a simpler standalone supplier register. CUVc also contains supplier-role fields for unified customer/supplier entities.

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| Code | M4Code | 20 | VEVc (self) | Supplier code (PK) |
| Name | M4Str | 60 | — | Supplier name |
| Person | M4Str | 60 | — | Contact person |
| Addr0-4 | M4Str | 60 | — | Address lines |
| Phone | M4PhoneNo | 20 | — | Phone |
| Fax | M4Str | 20 | — | Fax |
| eMail | M4Str | 200 | — | Email |
| Comment | M4Str | 60 | — | Comment |
| PayDeal | M4Code | 3 | — | Payment terms |
| ExportFlag | M4Int | — | — | Export flag |
| CustID | M4Str | 20 | — | Our code at supplier |
| BankAcc | M4Str | 60 | — | Bank account number |
| Bank | M4Str | 20 | — | Bank name |
| BankName | M4Str | 30 | — | Bank branch name |
| AccAP | M4Code | 10 | AccVc | AP control account |
| AccCost | M4Code | 10 | AccVc | Cost account |
| OnAccAcc | M4Code | 10 | AccVc | On-account AP |
| PurchAcc | M4Code | 10 | AccVc | Purchase account |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Currency |
| CountryCode | M4Code | 5 | — | Country |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| LangCode | M4Code | 5 | — | Language |
| SearchKey | M4UStr | 10 | — | Search key |
| VATNr | M4Str | 20 | — | VAT number |
| VATCode | M4Code | 10 | VATCodeBlock | VAT code |
| CreditLimit | M4Val | — | — | Credit limit |
| WarnText1 | M4Str | 60 | — | Warning text |
| SalesMan | M4Code | 10 | UserVc | Assigned buyer |
| SalesGroup | M4Code | 5 | SalesGroupVc | Sales group |
| RegNr1 | M4Str | 20 | — | Registration nr 1 |
| RegNr2 | M4Str | 20 | — | Registration nr 2 |
| MinOrdSum | M4Val | — | — | Minimum order amount |
| BlockedFlag | M4Int | — | — | Blocked flag |
| TerminatedFlag | M4Int | — | — | Terminated flag |
| RefStr | M4Str | 60 | — | Reference string |
| RetainPrc | M4PrcStr | 10 | — | Retention percentage |
| PRCode | M4Code | 20 | VEVc | Parent/related supplier |

**Relationships (9):** AccVc (4 refs), CurncyCodeVc, ObjVc, SalesGroupVc, UserVc, VATCodeBlock

---

### 3.8 Stock Movement — StockMovVc (110 header fields + 26 array fields, 13 relationships)

**Source:** `datadef3.hal` — `RecordBegin(StockMovVc,-,"stockmov1")`
**Persistence Key:** `stockmov1`

#### Key Header Fields

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| SerNr | M4Long | — | — | Serial number (PK) |
| RegDate | M4Date | — | — | Registration date |
| TransDate | M4Date | — | — | Transaction date |
| Comment | M4Str | 60 | — | Comment |
| FrLocation | M4Code | 10 | LocationVc | From warehouse |
| ToLocation | M4Code | 10 | LocationVc | To warehouse |
| ThrouLocation | M4Code | 10 | LocationVc | Through warehouse |
| OKFlag | M4Mark | — | — | Approved flag |
| Sign | M4Code | 10 | UserVc | Created by user |
| DeliveryMan | M4Code | 10 | UserVc | Delivery person |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Currency |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| IntORNo | M4Long | — | IntORVc | Internal order ref |
| ProdSerNr | M4Long | — | ProdVc | Production order ref |
| BranchID | M4Code | 20 | CUVc | Branch ID |
| StockMovType | M4Set | 564 | — | Movement type |
| SalesGroup | M4Code | 5 | SalesGroupVc | Sales group |
| Invalid | M4Int | — | — | Voided flag |
| TotQty | M4Qty | — | — | Total quantity |
| TotWeight | M4Qty | — | — | Total weight |
| TotVolume | M4Qty | — | — | Total volume |
| ShipMode | M4Code | 5 | — | Shipping method |

#### Key Array Fields — Math (26 fields per row)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| ArtCode | M4Code | 20 | INVc | Item code |
| Quant | M4UVal | — | — | Quantity |
| Spec | M4Str | 100 | — | Description |
| SerialNr | M4Str | 60 | — | Serial number |
| NewPrice | M45Val | — | — | New cost price |
| OldPrice | M45Val | — | — | Old cost price |
| FIFORowVal | M45Val | — | — | FIFO row value |
| BasePrice | M423Val | — | — | Base price |
| Objects | M4UStr | 60 | ObjVc | Dimensions |
| FrPosCode | M4Code | 20 | — | From position |
| ToPosCode | M4Code | 20 | — | To position |
| SentQuant | M4UVal | — | — | Sent quantity |

**Relationships (13):** CUVc, CurncyCodeVc, INVc, IntORVc, LocationVc (3 refs), ObjVc, ProdVc, SalesGroupVc, UserVc (2 refs)

---

### 3.9 HR Contract — HRMCOVc (36 header fields + 9 array fields, 4 relationships)

**Source:** `datadef11.hal` — `RecordBegin(HRMCOVc,-,"HRMCOVc2")`
**Persistence Key:** `HRMCOVc2`

#### Header Fields

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| SerNr | M4Long | — | — | Serial number (PK) |
| TransDate | M4Date | — | — | Transaction date |
| Employee | M4Code | 20 | CUVc | Employee (FK to CUVc!) |
| Name | M4Str | 100 | — | Employee name |
| StartDate | M4Date | — | — | Contract start date |
| EndDate | M4Date | — | — | Contract end date |
| TrialEndDate | M4Date | — | — | Trial period end |
| JobTitle | M4Str | 100 | — | Job title |
| JobTitleDesc | M4Str | 200 | — | Job title description |
| JobType | M4Set | 487 | — | Job type (full/part-time) |
| JobHours | M4Val | — | — | Contract hours |
| WorkHoursPerDay | M4Val | — | — | Hours per day |
| SalaryType | M4Set | 463 | — | Salary type set |
| GrossSalary | M4Val | — | — | Gross salary amount |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Salary currency |
| Superior | M4Code | 20 | CUVc | Superior (FK to CUVc) |
| DepCode | M4Code | 10 | — | Department code |
| Class | M4Code | 10 | — | Employee class |
| LeaveScheme | M4Code | 10 | — | Leave scheme code |
| LeaveFwdBal | M4Val | — | — | Leave forward balance |
| LeaveFwdBalDate | M4Date | — | — | Leave balance date |
| Comment | M4Str | 200 | — | Comment |
| OKFlag | M4Mark | — | — | Approved flag |
| TerminatedFlag | M4Mark | — | — | Terminated flag |
| HRMCOSerNr | M4Long | — | HRMCOVc | Previous contract ref |
| Reason | M4Set | 470 | — | Termination reason |
| ReasonDetails | M4Str | 200 | — | Reason details |
| LangCode | M4Code | 5 | — | Language |
| RetirementFund | M4Str | 200 | — | Retirement fund |
| RetirementCode | M4Str | 200 | — | Retirement code |
| RetirementRate | M4Rate | — | — | Retirement rate |
| RetirementAccount | M4Str | 200 | — | Retirement account |
| HRMCOType | M4Str | 200 | — | Contract type |
| TaxLoad | M4Rate | — | — | Tax load rate |
| PayDate | M4Date | — | — | Pay date |

#### Array: Math (9 fields — Benefit/Allowance Lines)

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| Code | M4Code | 10 | — | Benefit/allowance code |
| Description | M4Str | 60 | — | Description |
| Type | M4Str | 255 | — | Benefit type |
| Terms | M4Str | 255 | — | Terms/conditions |
| Amount | M4Val | — | — | Amount |
| CurncyCode | M4Code | 5 | CurncyCodeVc | Currency |
| Frequency | M4Set | 753 | — | Payment frequency |
| StartDate | M4Date | — | — | Effective start |
| EndDate | M4Date | — | — | Effective end |

**Relationships (4):** CUVc (2 refs: Employee, Superior), CurncyCodeVc (2 refs: header, array)

---

### 3.10 Chart of Accounts — AccVc (22 header fields + 2 array fields, 7 relationships)

**Source:** `datadef1.hal:80` — `RecordBegin(AccVc,-,"konto5")`
**Persistence Key:** `konto5`

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| AccNumber | M4Code | 10 | AccVc (self) | Account number (PK) |
| Comment | M4Str | 60 | — | Account name/description |
| AccType | M4Int | — | — | Account type (Asset/Liability/Income/Expense/Equity) |
| NVD | M4Int | — | — | Normal balance side (Debit) |
| NVC | M4Int | — | — | Normal balance side (Credit) |
| AutCode | M4Code | 10 | AutVc | Authorization code |
| blockedFlag | M4Int | — | — | Blocked/inactive flag |
| VATCode | M4Code | 10 | VATCodeBlock | Default VAT code |
| ControlType | M4Int | — | — | Control account type (AR/AP/Bank) |
| Curncy | M4Code | 5 | CurncyCodeVc | Default currency |
| ConsAccNumber | M4Code | 10 | — | Consolidation account mapping |
| Objects | M4UStr | 60 | ObjVc | Default cost centre/dimensions |
| SRUCode | M4UStr | 10 | — | SRU reporting code |
| ExclFrRep | M4Int | — | — | Exclude from reports flag |
| PeriodCode | M4Code | 10 | — | Period code |
| GroupAcc | M4Int | — | — | Group account flag |
| TransAutCode | M4Code | 10 | AutVc | Transaction authorization |
| TaxTemplateCode | M4Code | 10 | TaxTemplateVc | Tax template |
| AccClass | M4List | 100 | AccClassVc | Account classification |
| NotBalSheet | M4Int | — | — | Not balance sheet flag |
| Conspr | M4Int | — | — | Consolidation percent |

**Array: Math** (2 fields): LangCode, Text (translations)

**Relationships (7):** AccClassVc, AutVc (2 refs), CurncyCodeVc, ObjVc, TaxTemplateVc, VATCodeBlock

---

### 3.11 Item Group — ITVc (67 header fields + 2 array fields, 45 relationships)

**Source:** `datadef1.hal` — `RecordBegin(ITVc,-,"ITVc2")`
**Persistence Key:** `ITVc2`

This is the **GL account mapping hub** for items. Contains 30 AccVc references and 7 VATCodeBlock references.

| Field | Type | Size | FK Link | Description |
|-------|------|------|---------|-------------|
| Code | M4Code | 5 | — | Item group code (PK) |
| Comment | M4Str | 60 | — | Description |
| CostAcc | M4Code | 10 | AccVc | Cost of goods account |
| InvAcc | M4Code | 10 | AccVc | Inventory/stock account |
| SalesAcc | M4Code | 10 | AccVc | Sales revenue account |
| EUSalesAcc | M4Code | 10 | AccVc | EU sales account |
| ExpSalesAcc | M4Code | 10 | AccVc | Export sales account |
| PurchAcc | M4Code | 10 | AccVc | Purchase account |
| CredSalesAcc | M4Code | 10 | AccVc | Credit note sales account |
| WIPAcc | M4Code | 10 | AccVc | Work in progress account |
| PriceVarianceAcc | M4Code | 10 | AccVc | Price variance account |
| UsageVarianceAcc | M4Code | 10 | AccVc | Usage variance account |
| DiscountAcc | M4Code | 10 | AccVc | Discount account |
| ProdControl | M4Code | 10 | AccVc | Production control account |
| ProdWCostAcc | M4Code | 10 | AccVc | Production WIP cost |
| ProjMaterialsUsageAcc | M4Code | 10 | AccVc | Project materials |
| VATCodeDom | M4Code | 10 | VATCodeBlock | Domestic VAT code |
| VATCodeEU | M4Code | 10 | VATCodeBlock | EU VAT code |
| VATCodeExp | M4Code | 10 | VATCodeBlock | Export VAT code |
| Objects | M4UStr | 60 | ObjVc | Default dimensions |
| PrimaryCostModel | M4Int | — | — | FIFO/WA/Standard cost |
| Type | M4Int | — | — | Item type |
| ClassType | M4Str | 60 | — | Classification |

**Note:** ITVc provides ALL default GL accounts for items. This is the account mapping hierarchy root.

**Relationships (45):** AccVc (30 refs!), DIVc, FiscalDepVc, ObjVc, TaxTemplateVc (3 refs), UserVc, VATCodeBlock (7 refs), VATGroupVc

---

## 4. Entity Relationship Summary (Core ERP)

```
CUVc (Customer) ──1:N──► IVVc (Invoice) ──N:1──► AccVc (GL Account)
                          │                         ▲
                          │ lines                   │ posts to
                          ▼                         │
                    IVVc.Math[] ──N:1──► INVc (Item) ──N:1──► ITVc (Item Group)
                          │
                          └──────────► VATCodeBlock (VAT)

VEVc (Supplier) ──1:N──► PUVc (Purchase Invoice)
                          │
CUVc ──1:N──► ORVc (Sales Order) ──► IVVc (creates Invoice)
VEVc ──1:N──► POVc (Purchase Order) ──► PUVc (creates Bill)

INVc ──1:N──► StockMovVc (Stock Movements) ──► LocationVc (Warehouse)

PRVc (Project) ──◄── IVVc, PUVc, ActVc (Activities)

AT2Vc (Asset) ──1:N──► AT2DprVc (Depreciation)
               ──1:N──► AT2MovVc (Movements)

ContactVc ──1:N──► ActVc (Activities)
           ──1:N──► LeadVc (Leads)

POSSalesVc (POS) ──► CashVc (Cash Register) ──► DrawerVc (Drawer)

HRMPAVc (Personnel) ──► HRMPayrollVc (Payroll) ──► HRMPymtTypeVc (Payment Types)
CUVc (Employee) ──1:N──► HRMCOVc (Contracts)

ProdVc (Production) ──► ProdOrderVc ──► ProdOperationVc
                         ──► ProdItemVc

SVOVc (Service Order) ──► AgreementVc (Service Agreement)
```

---

## 5. Key Relationship Patterns — Most Referenced Registers

Analysis of 565 foreign key relationships across all 54 registers reveals the central entities:

| Target Register | Times Referenced | Role |
|----------------|-----------------|------|
| **CurncyCodeVc** | 25 | Multi-currency support — nearly every transaction register |
| **UserVc** | 24 | User/person references — salesman, sign, approvals |
| **ObjVc** | 23 | Cost centre/dimension tagging — on every transaction |
| **CUVc** | 21 | Customer master — referenced by invoices, orders, CRM, HR |
| **AccVc** | 19 | GL accounts — every financial transaction |
| **LocationVc** | 18 | Warehouse/location — stock, orders, invoices |
| **VATCodeBlock** | 17 | VAT codes — every tax-relevant transaction |
| **INVc** | 17 | Item/article — every line item in every transaction |
| **TaxTemplateVc** | 12 | Tax templates — complex multi-jurisdiction tax |
| **SalesGroupVc** | 12 | Sales group segmentation |
| **VEVc** | 9 | Supplier — purchase transactions |
| **PLDefVc** | 9 | Price lists — sales documents |
| **RecVc** | 8 | Recipes/BOMs — manufacturing and kitting |
| **TaxMatrixVc** | 7 | Multi-jurisdiction tax matrices |
| **RegionVc** | 7 | Geographic regions |
| **PRVc** | 5 | Projects — cross-module project tracking |
| **DIVc** | 4 | Display/classification groups |
| **CreditCardVc** | 4 | Credit card payment references |
| **CUINVc** | 4 | Customer-specific item codes |

### Pattern: Universal Fields

Nearly every transactional register includes these standard fields:

- **SerNr** (M4Long) — Auto-increment serial number primary key
- **OKFlag** (M4Mark) — Approved/posted boolean
- **Objects** (M4UStr, 60) — Cost centre/dimension string, FK to ObjVc
- **CurncyCode** (M4Code, 5) — Currency, FK to CurncyCodeVc
- **Sign** (M4Code, 10) — Created-by user, FK to UserVc
- **ExportedFlag** (M4Int) — Exported to external system
- **Invalid** (M4Int) — Voided/invalidated flag

### Pattern: Document Header + Line Items

Sales/purchase documents follow a consistent header + array pattern:
- **Header**: Party code, dates, addresses, terms, totals, status flags
- **Array (Math)**: ArtCode, Quant, Price, Sum, VATCode, Objects, SerialNr, Location

---

## 6. Entity Count by Module Area

| Module Area | Estimated Entity Count | Key Prefix |
|-------------|----------------------|------------|
| Finance/GL | ~30 | Acc*, Bud* |
| AR (Sales Invoicing) | ~20 | IV*, AR*, CU* |
| AP (Purchase/Bills) | ~15 | PU*, AP*, VE* |
| Stock/Inventory | ~25 | IN*, Stock*, Location* |
| Sales Orders | ~15 | OR*, QT*, CO* |
| Purchase Orders | ~10 | PO* |
| CRM/Contacts | ~15 | Contact*, Act*, Lead*, Campaign* |
| Manufacturing | ~15 | Prod* |
| Projects | ~10 | PR* |
| HR/Payroll | ~20 | HRM* |
| Fixed Assets | ~12 | AT2* |
| POS | ~15 | POS*, Cash*, Drawer* |
| Service/Contracts | ~15 | SVO*, Agreement* |
| Hotel/Restaurant | ~30 | Res*, Rest*, Guest* |
| Web/E-commerce | ~40 | WebNG*, Web* |
| System/Admin | ~30 | User*, Access*, Sync* |
| Banking/Payment | ~15 | Bank*, Pay* |
| VAT/Tax | ~15 | VAT*, Tax* |
| Cloud/ASP | ~20 | ASP*, Cloud* |
| Other (EDI, Telecom, etc.) | ~100+ | Various |
| **Total** | **~1,055** | |

---

## 7. OPEN QUESTIONS (Data Model)

| # | Question | Status | Resolution |
|---|----------|--------|------------|
| OQ-D1 | What are all fields for CUVc (Customer)? | **ANSWERED** | 313 fields extracted — see Section 3.1 |
| OQ-D2 | What are all fields for VEVc (Supplier)? | **ANSWERED** | 50 fields extracted — see Section 3.7 |
| OQ-D3 | What are all fields for INVc (Item)? | **ANSWERED** | 211 fields + 2 array fields extracted — see Section 3.2 |
| OQ-D4 | What are the exact enum values for Status fields? | OPEN | Set numbers identified (e.g., Set 361, 443, 463) but enum values require haldefs.h parsing |
| OQ-D5 | What are the full Purchase Order (POVc) fields? | **ANSWERED** | 96 + 50 array fields extracted — see Section 3.5 |
| OQ-D6 | What are the full Sales Order (ORVc) fields? | **ANSWERED** | 165 + 66 array fields extracted — see Section 3.4 |
| OQ-D7 | Which entities are used by StandardERP vs other products? | OPEN | Requires analysis of product configuration files |
| OQ-D8 | What are the stored procedure equivalents in HAL? | OPEN | Business logic in RActions may contain triggers |

---

## 8. Comprehensive Extraction Reference

The full extraction containing all 54 registers with complete field listings is available at:

**`/tmp/hansaworld_hal_data_model_extraction.txt`** (4,391 lines)

This file contains:
- Complete field-by-field schema for every extracted register
- All 2,452 header fields with types, sizes, and FK links
- All 718 array/matrix fields with types, sizes, and FK links
- All 565 relationship mappings with source and target field names
- Summary table with per-register statistics

---

*Next: MIGRATION_MAP.md — mapping legacy HAL entities to target Nexa ERP PostgreSQL schema*
