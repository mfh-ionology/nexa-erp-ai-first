# REPO_MAP — HansaWorld Standard ERP Legacy Codebase

> **Generated:** 2026-02-15
> **Source:** `c8520240417.zip` → extracted to `legacy-src/c8520240417/`
> **Language:** HAL (HansaWorld Application Language) — proprietary C-like compiled language
> **Total Files:** ~3,873 files (~60MB uncompressed)

---

## 1. Codebase Overview

HansaWorld Standard ERP is a comprehensive enterprise resource planning system written in **HAL** (HansaWorld Application Language). HAL is a proprietary compiled language with C-like syntax that uses:
- `RecordBegin` / `RecordField` for data definitions (database schema)
- `procedure` / `function` for business logic
- `begin` / `end` blocks (defined via C preprocessor: `#define begin {` / `#define end }`)
- A custom type system (`M4Str`, `M4Val`, `M4Int`, `M4Code`, `M4Date`, etc.)
- Compiled to `.hob` bytecode files

### Key Architecture Patterns
- **Client-Server**: Separate `client.hal` and `server.hal` entry points
- **Record-Action Pattern**: Business logic organized by register (entity) + action type
- **Document Pattern**: Print/output templates per document type
- **Window-Action Pattern**: UI event handlers per window/form

---

## 2. Top-Level Directory Structure

```
c8520240417/
├── amaster/          ← Data definitions (database schema), global headers
├── hal/              ← Core business logic, server, client, all modules
├── english/          ← English localization, window definitions, product configurations
└── averticals/       ← Vertical-specific customizations (e.g., jewellery)
```

---

## 3. `amaster/` — Data Definitions & Global Headers

**Purpose:** Defines ALL database registers (entities/tables), field definitions, type system, document templates.

| File | Size | Description |
|------|------|-------------|
| `haldefs.h` | 228K | **Master header** — HAL type system, all enums, all constants. Contains M4Type enum, register IDs, field type definitions |
| `datadef.hal` | 1K | Compiler driver — includes all datadef1-11.hal in sequence |
| `datadef1.hal` | 126K | Register definitions: Item Groups (ITVc), Chart of Accounts (AccVc), Invoices (IVVc), Purchase Orders (POVc), and related |
| `datadef2.hal` | 122K | Register definitions: Contacts (ContactVc), CRM, Activities (ActVc), Campaigns, Sales Orders |
| `datadef3.hal` | 115K | Register definitions: Stock/Inventory, Warehouses, Transfers, Quality, Manufacturing |
| `datadef4.hal` | 95K | Register definitions: Projects, Time tracking, Service/Contracts, Rental |
| `datadef5.hal` | 113K | Register definitions: HRM/Payroll, Leave, Training, Hotel/Restaurant |
| `datadef6.hal` | 123K | Register definitions: POS, Cash, Loyalty, WebShop, E-commerce |
| `datadef7.hal` | 95K | Register definitions: Assets (AT2Vc), Budgets, Reporting, Telecom |
| `datadef8.hal` | 112K | Register definitions: Service/SVO, Price Lists, Promotions, Web content |
| `datadef9.hal` | 122K | Register definitions: EDI, Banking, Payment, Tax, VAT, Custom declarations |
| `datadef10.hal` | 143K | Register definitions: Cloud/ASP management, Sync, Backup, Workflow |
| `datadef11.hal` | 370K | **Largest** — Register definitions: AI/Chat, Loan management, WebNG (next-gen web), advanced modules |
| `datadefbackcomp.hal` | 5K | Backward compatibility definitions |
| `enums.hal` | 219B | Service usage status enum (commented out — enums defined in haldefs.h) |
| `docset.hal` | 77K | Document set definitions (print template assignments) |
| `docset2.hal` | 122K | Additional document sets |
| `docset3.hal` | 94K | Additional document sets |
| `docset4.hal` | 49K | Additional document sets |

### Entity Count: **1,055 unique registers** (entities/tables)

Key entities by module area (from RecordBegin analysis):
- **Finance/GL:** AccVc (Accounts), AccTransVc (Transactions), AccHistVc, AccPeriodVc, AccClassVc, BankVc, BankRecVc, BankTRVc
- **AR (Accounts Receivable):** IVVc (Invoices), ARVc (AR Ledger), ARPayVc (AR Payments), CUVc (Customers)
- **AP (Accounts Payable):** PUVc (Purchase Invoices/Bills), APVc (AP Ledger), APPayVc (AP Payments), VEVc (Suppliers/Vendors)
- **Inventory/Stock:** INVc (Items), StockMovVc, StockReservVc, StockTakeVc, LocationVc
- **Sales:** ORVc (Sales Orders), QTVc (Quotations), COVc (Customer Orders)
- **Purchasing:** POVc (Purchase Orders), PrelPUVc (Preliminary Purchases)
- **CRM:** ContactVc, ActVc (Activities), CampaignVc, LeadVc
- **Manufacturing:** ProdVc (Production), ProdOrderVc, ProdOperationVc, ProdItemVc, ProdPlanVc
- **Projects:** PRVc (Projects), PRStageVc, PRScheduleVc
- **HR/Payroll:** HRMPAVc (Personnel), HRMPayrollVc, HRMPymtTypeVc, HRMCOVc (Contracts)
- **POS:** POSSalesVc, POSButtonsVc, POSJournalVc, CashVc, DrawerVc
- **Fixed Assets:** AT2Vc (Assets v2), AT2DprVc (Depreciation), AT2MovVc (Movements)
- **Service/Contracts:** SVOVc, SVOSerVc, ServiceUsageVc, AgreementVc
- **Hotel/Restaurant:** ResVc (Reservations), RestBookingVc, RestITVc
- **VAT/Tax:** VATDeclVc (VAT Declarations), TaxRulesVc, TaxTemplateVc, VATClassVc
- **Web/E-commerce:** WebNGProductVc, WebNGShopBasketVc, WebNGPageVc, WebNGContentVc
- **AI/Chat:** AIChatVc, AIParametersVc
- **Cloud/ASP:** CloudNodeVc, ASProductVc, ASPEventsVc

---

## 4. `hal/` — Core Business Logic

**Purpose:** All server-side and client-side business logic, organized by function type.

### 4.1 Entry Points

| File | Size | Description |
|------|------|-------------|
| `server.hal` | 111K | **Server entry point** — All server-side request handling, function dispatch |
| `server-reports.hal` | 40K | Server-side report generation functions |
| `client.hal` | 46K | **Client entry point** — Client-side UI initialization, event handling |
| `common.hal` | 12K | Shared utilities used by both client and server |
| `clcrm.hal` | 492B | CRM client initialization |
| `BalResDef.hal` | 10K | Balance/resource definitions |

### 4.2 `RActions/` — Record Actions (723 files)

Business logic triggered by record-level events (create, update, delete, validate). Each file handles one or more register's record-level actions.

**Key files by module:**
- `IVVcRAction.hal` — Invoice record actions (create, validate, post)
- `PUVcRAction.hal` — Purchase invoice record actions
- `POVcRAction.hal` — Purchase order record actions
- `ORVcRAction.hal` — Sales order record actions
- `AccBlockActions.hal` — Account block-level actions
- `INVcRAction.hal` — Inventory item record actions
- `StockMovVcRAction.hal` — Stock movement record actions
- `ContactVcRAction.hal` — Contact record actions
- `HRMPAVcRAction.hal` — HR personnel actions
- `HRMPayrollVcRAction.hal` — Payroll processing actions
- `AT2VcRAction.hal` — Fixed asset record actions
- `ProdVcRAction.hal` — Production record actions
- `SVOVcRAction.hal` — Service order record actions

### 4.3 `WActions/` — Window Actions (552 files)

UI event handlers for forms/windows (button clicks, field changes, window open/close).

**Key files:**
- `IVVcWAction.hal` — Invoice window actions
- `PUVcWAction.hal` — Purchase invoice window actions
- `ORVcWAction.hal` — Sales order window actions
- `POVcWAction.hal` — Purchase order window actions
- `AccVcWAction.hal` — Chart of accounts window actions
- `INVcWAction.hal` — Item master window actions
- `ContactVcWAction.hal` — Contact window actions
- `CashVcWAction.hal` — Cash register window actions
- `POSSalesVcWAction.hal` — POS sales window actions

### 4.4 `Reports/` — Reports (743 files)

Report generation logic. Files typically named `{Register}Rn.hal` or `{Register}RnTool.hal`.

**Key reports:**
- `ARRn.hal`, `ARRnTool.hal` — AR Aging, AR Reports
- `APRn.hal`, `APRnTool.hal` — AP Aging, AP Reports
- `ARAPRn.hal`, `ARAPRnTool.hal` — Combined AR/AP Reports
- `IVJRn.hal` — Invoice Journal
- `BalRn.hal` — Balance Sheet
- `PLRn.hal` — Profit & Loss
- `TBRn.hal` — Trial Balance
- `VATRn.hal` — VAT Reports
- `StockRn.hal` — Stock Reports
- `ProdRn.hal` — Production Reports
- `HRMRn.hal` — HR/Payroll Reports
- `AT2DeprRn.hal` — Asset Depreciation Reports

### 4.5 `Exports/` — Data Exports (183 files)

Export functionality for various formats and integrations (CSV, XML, EDI, etc.).

### 4.6 `Imports/` — Data Imports (39 files)

Import functionality for data migration and integration.

### 4.7 `Maint/` — Maintenance Routines (242 files)

Database maintenance, data repair, migration scripts, cleanup routines.

### 4.8 `Documents/` — Print Templates (255 files)

Document templates for invoices, purchase orders, delivery notes, statements, labels, etc.

### 4.9 `Tools/` — Utility Functions (450 files)

Shared utility functions, helpers, calculation routines used across modules.

### 4.10 `Web/` — Web Interface (56 files)

Classic web interface handlers for browser-based access.

### 4.11 `WebNG/` — Next-Generation Web (66 files)

Modern web interface components (CMS, e-commerce, web portal).

### 4.12 `WebShop/` — Web Shop (minimal)

E-commerce shop functionality.

### 4.13 `Startup/` — Initialization (8 files)

System startup and initialization routines.

### 4.14 `EDI/` — Electronic Data Interchange (26 files)

EDI message handling, parsing, generation.

### 4.15 `Printers/` — Printer Drivers (47 files)

Printer-specific output formatting.

### 4.16 `Compatibility/` — Version Compatibility (6 files)

Backward compatibility handlers.

### 4.17 `DataFiles/` — Data File Handlers (7 files)

Data file reading/writing utilities.

### 4.18 `js/` — JavaScript (8 files)

Client-side JavaScript for web interface.

---

## 5. `english/` — English Localization & Product Configurations

**Purpose:** Window definitions, menu structures, strings, and product-specific configurations for different HansaWorld product SKUs.

### Product SKUs (directories):

| Directory | Product |
|-----------|---------|
| `StandardERP/` | **Standard ERP** — Full enterprise suite (PRIMARY FOCUS) |
| `StandardBusiness/` | Standard Business — Mid-tier business suite |
| `StandardAccounts/` | Standard Accounts — Accounting-focused product |
| `StandardCRM/` | Standard CRM |
| `StandardPOS/` | Standard POS |
| `StandardHotel/` | Standard Hotel — Hospitality vertical |
| `StandardRestaurant/` | Standard Restaurant |
| `StandardHealthcare/` | Standard Healthcare |
| `StandardProjects/` | Standard Projects |
| `StandardContracts/` | Standard Contracts/Service |
| `StandardInvoicing/` | Standard Invoicing — Basic invoicing |
| `StandardExpenses/` | Standard Expenses |
| `Books/` / `BooksBasic/` / `BooksNominalLedger/` | Bookkeeping products |
| `1Office/` | 1Office — Integrated suite |
| `MobilePOS/` / `MobileStock/` / `MobileSalesman/` / `MobileReports/` | Mobile products |
| `WeHaveStock/` / `WeHaveInvoices/` etc. | Entry-level products |

### Key Configuration Files:

| File | Size | Description |
|------|------|-------------|
| `custallwindows.hal` | 113K | ALL window definitions (all products combined) |
| `sku.hal` | 143K | SKU/product configuration — which modules/features included per product |
| `s4eng.hal` | 116K | Standard ERP English strings and menu definitions |
| `s2eng.hal` | 94K | Additional product strings |
| `saengm.hal` | 109K | Module menu definitions |
| `Haengm2.hal` | 136K | Additional menu/window definitions |
| `WindowFunctions.hal` | 23K | Window utility functions |

---

## 6. `averticals/` — Vertical Customizations

| Directory | Description |
|-----------|-------------|
| `jewellery/` | Jewellery-specific customizations |

---

## 7. Prior Work (`_bmad-output/`)

Extensive prior specification work exists from a previous extraction effort:

### Core Documents (MUST USE as foundation):
| File | Size | Lines | Description |
|------|------|-------|-------------|
| `nexa-erp-business-rules-requirements.md` | 612K | 10,789 | **Complete extraction** of business rules, entities, validations, APIs, status lifecycles. 676 flagged items (79 schema gaps, 140 missing, 30 stubbed, 62 partial, 123 shortcuts). |
| `extraction-completeness-report.md` | 74K | — | Market research vs 13 competitors. 120 missing features identified (33 MUST, 55 SHOULD, 32 COULD). |
| `extraction-contradictions-report.md` | 44K | — | 72 contradictions found and resolved. Audit trail for design decisions. |
| `erp-module-status-summary.md` | — | 909 | Module-by-module completion status (24 modules, 50-95% complete). |
| `ai-first-erp-vision-summary.md` | 6.2K | 139 | Product vision: AI-first ERP with conversational UI. |

### Old Spec Archive (`_Old_Spec/`):
- ~199 markdown files covering: architecture, phases 0-4, module specs, verification reports, compliance stubs, business processes, operations docs
- Key reference files: RBAC matrix, business process flows (quote-to-cash, procure-to-pay, payroll-run), scale design, FX/timezone handling

---

## 8. Technology Summary

| Aspect | Detail |
|--------|--------|
| **Language** | HAL (HansaWorld Application Language) — proprietary compiled language |
| **Architecture** | Client-Server with thick client |
| **Database** | Custom integrated DB engine (not SQL-based) |
| **Data Model** | 1,055 registers (entities) defined across 11 datadef files |
| **Business Logic** | 723 Record Action files + 552 Window Action files |
| **Reports** | 743 report definitions |
| **Exports** | 183 export definitions |
| **Imports** | 39 import definitions |
| **Documents/Templates** | 255 print template definitions |
| **Utilities** | 450 tool/utility files |
| **Web Layer** | Classic Web (56 files) + WebNG (66 files) + WebShop |
| **Products** | 30+ product SKUs (StandardERP is the flagship) |
| **Verticals** | Hotel, Restaurant, Healthcare, Jewellery, POS, Projects, CRM, etc. |

---

## 9. Key Observations

1. **Massive scope**: 1,055 entities is significantly larger than the target system's current ~34 tables. The HAL codebase covers hotel management, restaurant, healthcare, telephony, web CMS, cloud hosting management, loan management, and many other verticals beyond core ERP.

2. **No SQL**: HansaWorld uses its own database engine, not SQL. Data definitions use `RecordBegin`/`RecordField` syntax. Migration requires complete schema re-mapping.

3. **Prior extraction is comprehensive**: The 10,789-line business rules extraction from the previous codebase (Nexa ERP TypeScript/Node.js) already covers the target system's planned modules. The HAL codebase analysis adds the **legacy source of truth** for features and business rules.

4. **Focus area**: The `StandardERP` product configuration (in `english/StandardERP/`) defines which of the 1,055 registers are relevant for the target migration scope.

5. **Rich business logic**: The Record Action files (723) contain the bulk of business rules, validations, calculations, and status transitions. These are the primary source for requirements extraction.

---

*Next step: MANUAL_EXTRACT.md — Parse HansaWorld manual from hansamanuals.com*
