# UI_MAP — HansaWorld Legacy ERP User Interface Inventory

> **Generated:** 2026-02-15
> **Source:** `legacy-src/c8520240417/english/` (UI definitions), `hal/WActions/` (552 files), `hal/Documents/` (255 files)
> **Prior work:** `_bmad-output/planning-artifacts/erp-module-status-summary.md` (target UI routes)
> **Status:** COMPLETE

---

## 1. Legacy UI Architecture

HansaWorld uses a **thick desktop client** with window-based UI defined in HAL files:

| Layer | Files | Purpose |
|-------|-------|---------|
| Window Definitions | `english/allwindows.hal` (6MB), `custallwindows.hal` (110KB) | ALL window layouts, field positions, tab structures |
| Menu Definitions | `english/saengm.hal`, `Haengm.hal`, `Haengm2.hal` | Module menus, navigation structure |
| String Resources | `english/s4eng.hal`, `s1eng.hal`, `s5eng.hal` | Labels, messages, tooltips |
| Window Functions | `english/WindowFunctions.hal` (23K), `EngWindowFunctions.hal` (133K) | Window event handlers |
| WActions | `hal/WActions/` (552 files, 6.6MB) | Window-level business logic per entity |
| Documents | `hal/Documents/` (255 files, 2.9MB) | Print templates/forms |
| SKU Config | `english/sku.hal` (139K) | Feature toggles per product SKU |

**Evidence:** `legacy-src/c8520240417/english/` directory listing

### 1.1 Navigation Pattern (from Manual)

**Evidence:** hansamanuals.com → Standard ERP → Working Environment

- **Navigation Centre**: Central desktop with module icon shortcuts
- **Module Selection**: Top-level module picker (Finance, Sales, Purchase, Stock, etc.)
- **Register Browse**: List view of records within a module register
- **Record Form**: Detail view for editing individual records
- **Drill-Down**: Click-through from summary to detail
- **Link Manager**: Cross-entity navigation (e.g., Invoice → Customer → Orders)
- **Personal Desktop**: User-configurable shortcuts
- **Business Alerts**: Pop-up notifications for configurable events

---

## 2. Window Actions Inventory (552 files)

### 2.1 By Module Area

| Module | WAction Files | Key Files | Complexity |
|--------|--------------|-----------|------------|
| **Sales/Invoicing** | ~45 | `IVVcWAction.hal` (1-7), `IVCashVcWAction.hal` (1-6) | **HIGH** — 13 files for invoicing alone |
| **Purchase** | ~25 | `PUVcWAction.hal`, `POVcWAction.hal`, `POQTVcWAction.hal` | MEDIUM |
| **Sales Orders** | ~20 | `ORVcWAction.hal` (1-3), `COVcWAction.hal`, `QTVcWAction.hal` | MEDIUM |
| **Stock/Inventory** | ~30 | `INVcWAction.hal`, `StockMovVcWAction.hal`, `StockTakeVcWAction.hal` | MEDIUM |
| **GL/Accounts** | ~15 | `AccVcWAction.hal`, `AccBlockWAction.hal`, `AccPeriodWActions.hal` | MEDIUM |
| **Banking** | ~10 | `BankRecVcWAction.hal`, `BankTRVcWAction.hal` | LOW |
| **CRM/Contacts** | ~15 | `ContactVcWAction.hal`, `ActVcWAction.hal` (1-2), `CampaignVcWAction.hal` | MEDIUM |
| **HR/Payroll** | ~15 | `HRMPAVcWAction.hal`, `StaffVcWAction.hal`, `PayrollVcWAction.hal` | LOW |
| **Fixed Assets** | ~10 | `AT2DprVcWAction.hal`, `AT2RevVcWAction.hal`, `AT2TakeVcWAction.hal` | LOW |
| **POS** | ~15 | `POSSalesVcWAction.hal`, `CashVcWAction.hal`, `DrawerVcWAction.hal` | MEDIUM |
| **Manufacturing** | ~15 | `ProdVcWAction.hal`, `ProdOrderVcWAction.hal` | LOW |
| **Service/Contracts** | ~10 | `SVOVcWAction.hal`, `AgreementVcWAction.hal` | LOW |
| **Projects** | ~10 | `PRVcWAction.hal`, `PRStageVcWAction.hal` | LOW |
| **Hotel/Restaurant** | ~25 | `ResVcWAction.hal`, `RestBookingWAction.hal` | MEDIUM |
| **Web/WebNG** | ~20 | `WebNGWActions.hal` variants | LOW |
| **System/Admin** | ~30 | `AccessVcWAction.hal`, `UserVcWAction.hal` | LOW |
| **ASP/Cloud** | ~20 | `ASPWActions.hal` | LOW |
| **Other** | ~80+ | Various specialty WActions | LOW |

**Evidence:** `ls legacy-src/c8520240417/hal/WActions/ | wc -l` → 552 files

### 2.2 High-Complexity Windows (Multiple Files per Entity)

| Entity | WAction File Count | Implication |
|--------|-------------------|-------------|
| IVVc (Invoice) | 7 files: `IVVcWAction.hal` through `IVVcWAction7.hal` | Most complex UI form in system |
| IVCashVc (Cash Invoice/POS) | 6 files: `IVCashVcWAction.hal` through `IVCashVcWAction6.hal` | POS checkout complexity |
| ORVc (Sales Order) | 3 files | Order management with delivery/invoicing |
| COVc (Customer Order) | 2 files | External order handling |
| ActVc (Activity) | 2 files | CRM activity management |
| PUVc (Purchase Invoice) | 2 files | Purchase invoice processing |

---

## 3. Print Document Templates (255 files)

### 3.1 Document Categories

| Category | Count | Key Templates |
|----------|-------|---------------|
| **Sales Documents** | ~50 | InvForm, Inv1Form-Inv3Form, OrdForm, Or2Form, QuoteForm |
| **Purchase Documents** | ~25 | PurchaseForm, POQTForm, GRForm |
| **Inventory Documents** | ~25 | StockTakeForm, StockMovForm, ItemLabelForm, PalletLabForm |
| **Asset Documents** | ~10 | AT2Form, AT2DprForm, AT2MovForm, AT2RevForm, AT2TakeForm |
| **Financial Documents** | ~20 | CashForm, CheckForm, CCTRForm |
| **Service/Contract** | ~15 | ContractForm, ServiceForm, SVOForm |
| **Project Documents** | ~10 | ProjectForm, ProjectInfoForm, ProjectTransForm |
| **HR Documents** | ~10 | TimeSheetForm, TrainingPlanForm, HRMCOForm |
| **Hotel/Restaurant** | ~15 | GuestDocForm, RentResForm, RestAccForm, RestOrderForm |
| **Delivery/Shipping** | ~10 | DispatchForm, ShipmentForm |
| **Utility** | ~30 | DocumentTool (1-5), FormTool, FormTool2 |
| **Labels** | ~10 | ItemLabelForm, PalletLabForm, BarcodeForm |
| **Customs** | ~5 | CustomsForm, CustomsInvForm |

**Evidence:** `ls legacy-src/c8520240417/hal/Documents/` → 255 files

### 3.2 Form Template System (from Manual)

**Evidence:** hansamanuals.com → Standard ERP → Form Template Register

- Two-part system: **Form** (data extraction) + **Form Template** (layout)
- Design elements: Text, Line, Frame, Field, Picture, Page Sum
- Conditional printing (Print Conditions)
- Multi-language text support
- Multi-page templates
- Standard field library for reuse across templates

---

## 4. Product SKU Configuration

### 4.1 StandardERP (Target Product)

**Evidence:** `legacy-src/c8520240417/english/StandardERP/caengdb.hal`

The StandardERP SKU includes ALL modules — it is the full enterprise product. The `sku.hal` (139K) file defines which of the 1,055 registers, menu items, and features are enabled per product variant.

### 4.2 Product Variants (52 Verticals)

| Tier | Products | Purpose |
|------|----------|---------|
| Full Suite | StandardERP, StandardBusiness, 1Office | Complete ERP |
| Module-Focused | StandardAccounts, StandardInvoicing, StandardCRM, StandardPOS, StandardProjects, StandardContracts, StandardExpenses | Single-module products |
| Vertical | StandardHotel, StandardRestaurant, StandardHealthcare | Industry-specific |
| Mobile | MobilePOS, MobileStock, MobileSalesman, MobileReports, MobileRestaurant | Mobile apps |
| Entry-Level | Books, BooksBasic, BooksNominalLedger, BooksInvoicing, WeHaveInvoices, WeHaveStock | Starter products |

---

## 5. Legacy → Target UI Mapping

### 5.1 Core Module Screens

| Legacy Window/Register | Legacy Interaction | Target Route | Target Status | Gap |
|----------------------|-------------------|-------------|---------------|-----|
| **Finance/GL** | | | | |
| AccVc (Chart of Accounts) | Desktop form + browse | `/finance` (CoaTemplate) | PARTIAL | No dedicated COA management UI |
| AccTransVc (GL Transactions) | Desktop form | `/finance/journals` | DONE | |
| Bank Reconciliation | Desktop form | `/finance/reconciliation` | DONE | |
| Period Management | Settings window | `/finance/close` | DONE | |
| Budget Register | Desktop form | `/planning/budgets` | DONE | |
| **AR** | | | | |
| IVVc (Invoices) | Desktop form (7 WAction files) | `/finance/invoices` | DONE | Missing: multi-currency, recurring |
| ARPayVc (Receipts) | Desktop form | `/finance/payments` | DONE | |
| CUVc (Customers) | Desktop form (~100 fields) | `/sales/customers` | DONE | Target has ~15 fields vs ~100 |
| AR Aging Report | Report generator | `/finance/ar/aging` | DONE | |
| **AP** | | | | |
| PUVc (Purchase Invoices) | Desktop form | `/finance/bills` | DONE | |
| APPayVc (Payments) | Desktop form | `/finance/payments` | DONE | |
| VEVc (Suppliers) | Desktop form (~50 fields) | `/purchasing/suppliers` | DONE | Target has ~10 fields vs ~50 |
| **Sales** | | | | |
| QTVc (Quotations) | Desktop form | `/crm/quotes` | DONE | Missing: versioning |
| ORVc (Sales Orders) | Desktop form (3 WAction files) | `/sales/orders` | SKELETON | Only create endpoint |
| DispatchVc (Deliveries) | Desktop form | `/inventory/shipments` | DONE | |
| **Purchasing** | | | | |
| POVc (Purchase Orders) | Desktop form | `/purchasing/orders` | DONE | |
| GRN (Goods Receipt) | Desktop form | `/inventory/wms/receiving` | DONE | |
| **Inventory** | | | | |
| INVc (Items) | Desktop form (~100 fields) | `/inventory/items` | DONE | 4 typed fields + JSON |
| StockMovVc (Movements) | Desktop form | `/inventory/stock-movements` | DONE | |
| StockTakeVc (Cycle Count) | Desktop form | `/inventory/cycle-count` | DONE | |
| LocationVc (Warehouses) | Desktop form | `/inventory/warehouses` | DONE | |
| **CRM** | | | | |
| ContactVc (Contacts) | Desktop form | `/crm/contacts` | DONE | |
| ActVc (Activities) | Desktop form | `/crm/activities` | DONE | |
| LeadVc (Leads) | Desktop form | `/crm/leads` | DONE | |
| CampaignVc (Campaigns) | Desktop form | Not implemented | MISSING | |
| **HR** | | | | |
| HRMPAVc (Employees) | Desktop form (~80 fields) | `/hr/employees` | DONE | Extremely minimal |
| HRMPayrollVc (Payroll) | Desktop form | `/hr/payroll` | DONE | Triple implementation |
| HRMCOVc (Contracts) | Desktop form | Not implemented | MISSING | |
| Leave Management | Desktop form | `/hr/leave` | DONE | |
| **Fixed Assets** | | | | |
| AT2Vc (Assets) | Desktop form | `/finance/fa/register` | DONE | |
| AT2DprVc (Depreciation) | Desktop form | `/finance/fa/depreciation` | DONE | Straight-line only |
| **POS** | | | | |
| POSSalesVc (Sales) | Desktop POS interface (6 WActions) | `/pos/register` | DONE | Triple implementation |
| CashVc (Cash Drawer) | Desktop form | `/pos/sessions` | DONE | |
| **Manufacturing** | | | | |
| ProdVc (BOM) | Desktop form | `/manufacturing/bom` | DONE | |
| ProdOrderVc (Work Orders) | Desktop form | `/manufacturing/work-orders` | DONE | |
| **Projects** | | | | |
| PRVc (Projects) | Desktop form | `/projects` | DONE | |
| Time Sheets | Desktop form | `/projects/time` | DONE | |
| **Service** | | | | |
| SVOVc (Service Orders) | Desktop form | Not in scope v1 | OUT OF SCOPE | |

### 5.2 Reports Mapping

| Legacy Report Category | Files | Target Equivalent | Status |
|----------------------|-------|-------------------|--------|
| Balance Sheet (Bal*) | 10+ | `/finance/reports` (Balance Sheet) | DONE |
| P&L (PL*) | 10+ | `/finance/reports` (P&L) | DONE |
| Trial Balance (TB*) | 5+ | `/finance/reports` (Trial Balance) | DONE |
| AR Aging (AR*) | 15+ | `/finance/ar/aging` | DONE |
| AP Aging (AP*) | 15+ | `/finance/ap/aging` | DONE |
| VAT Reports (VAT*) | 10+ | VAT Returns API | PARTIAL |
| Stock Reports (Stock*) | 20+ | `/inventory/valuation` | PARTIAL |
| Asset Reports (AT2*) | 10+ | `/finance/fa/register` | PARTIAL |
| Sales Reports | 20+ | Not dedicated | MISSING |
| HR Reports (HRM*) | 10+ | Not implemented | MISSING |
| POS Reports | 5+ | Not implemented | MISSING |
| Project Reports | 10+ | Not implemented | MISSING |
| Manufacturing Reports | 10+ | `/manufacturing/variance` | PARTIAL |
| Cash Flow | 5+ | Not implemented | MISSING |
| **Total Legacy Reports** | **743** | **~15 implemented** | **~2% coverage** |

---

## 6. Web Interface Inventory

### 6.1 WebNG (Modern Web — 66 files)

**Evidence:** `legacy-src/c8520240417/hal/WebNG/` directory

| Component | File | Size | Description |
|-----------|------|------|-------------|
| Core Framework | `WebNG.hal` | — | Core routing and rendering |
| E-commerce Catalog | `WebNGShopCatalog.hal` | 62K | Product browsing |
| Shopping Cart | `WebNGShopBasket.hal` + `1.hal` | 59K | Cart management |
| Payment | `WebNGShopPayment.hal` | 102K | Payment gateway integration |
| Customer Portal | `WebNGMyAccount.hal` | — | Self-service account |
| Customer Registration | `WebNGCustomerRegistration.hal` | — | New account signup |
| LMS | `WebNGLMS.hal` | 111K | Learning Management System |
| Forum | `WebNGForum.hal` | 93K | Discussion forum |
| HR Portal | `WebNGHRPortal.hal` | — | Employee self-service |
| Hotel Booking | `WebNGOnlineReservation.hal` (1-2) | — | Room booking |
| University | `WebNGUniversity*.hal` | — | Education module |
| Translation | `WebNGTranslation.hal` | — | i18n framework |
| Management | `WebNGMan.hal` | 99K | Admin interface |
| CAPTCHA | `WebNGRecaptcha.hal` | — | Bot protection |
| UI Components | `WebNGElements.hal`, `WebNGPages.hal` | — | Reusable UI |
| Tools | `WebNGTools.hal` | — | Utility functions |

### 6.2 Legacy Web (56 files)

**Evidence:** `legacy-src/c8520240417/hal/Web/` directory

Older HTML-generation web interface including shop variants, hotel booking, and WAP mobile interface.

---

## 7. OPEN QUESTIONS (UI)

| # | Question | Impact | Where to Look |
|---|----------|--------|---------------|
| OQ-UI1 | What are the exact window layouts for core registers (field positions, tabs)? | UI feature parity assessment | `english/allwindows.hal` (6MB) |
| OQ-UI2 | Which of the 552 WAction files contain business logic that must be replicated? | Separating UI logic from business rules | `hal/WActions/` — cross-reference with RActions |
| OQ-UI3 | What are the exact report parameters and outputs for the 743 reports? | Report replication scope | `hal/Reports/` |
| OQ-UI4 | Which StandardERP features are enabled vs disabled? | Feature scoping | `english/sku.hal` |
| OQ-UI5 | What keyboard shortcuts and navigation patterns are users accustomed to? | UX migration planning | Manual → Working Environment section |

---

*Cross-references: DATA_MODEL.md (entity definitions), CODE_REQUIREMENTS.md (business rules in WActions), MIGRATION_MAP.md (entity mapping)*
