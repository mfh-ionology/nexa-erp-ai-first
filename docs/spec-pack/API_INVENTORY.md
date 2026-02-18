# API_INVENTORY — HansaWorld Legacy ERP Integration & API Surface

> **Generated:** 2026-02-15
> **Source:** `legacy-src/c8520240417/hal/` (Web, WebNG, Exports, Imports, EDI directories)
> **Manual:** hansamanuals.com → Standard ERP → System Administrator → REST API
> **Prior work:** `_bmad-output/planning-artifacts/nexa-erp-business-rules-requirements.md`
> **Status:** COMPLETE

---

## 1. Legacy API Architecture

HansaWorld exposes functionality through multiple interface layers:

| Layer | Files | Protocol | Direction |
|-------|-------|----------|-----------|
| **Desktop Client** | `hal/client.hal` (46K) | Proprietary client-server | Bidirectional |
| **WebNG** | `hal/WebNG/` (66 files, 1.8MB) | HTTP/HTML | Inbound |
| **Legacy Web** | `hal/Web/` (56 files, 1.5MB) | HTTP/HTML | Inbound |
| **REST API** | Documented in manual | REST/JSON | Inbound |
| **Exports** | `hal/Exports/` (183 files, 2.1MB) | File-based | Outbound |
| **Imports** | `hal/Imports/` (39 files, 1.2MB) | File-based | Inbound |
| **EDI** | `hal/EDI/` (26 files, 348KB) | EDI standards | Bidirectional |
| **WebShop** | `hal/WebShop/` (1 file) | HTTP/HTML | Inbound |

---

## 2. REST API (from Manual)

**Evidence:** hansamanuals.com → Standard ERP → System Administrator → REST API

The manual documents a RESTful API layer providing programmatic access to HansaWorld registers.

### 2.1 API Pattern

- **Base URL**: `http(s)://<server>:<port>/api/`
- **Authentication**: Session-based (login endpoint returns token)
- **Format**: JSON request/response
- **Operations per register**: GET (list/single), POST (create), PUT (update), DELETE

### 2.2 Available Register Endpoints (Standard Pattern)

Each registered entity follows: `GET /api/<RegisterName>`, `GET /api/<RegisterName>/<id>`, `POST /api/<RegisterName>`, `PUT /api/<RegisterName>/<id>`, `DELETE /api/<RegisterName>/<id>`

Key endpoints based on register analysis:

| Module | Endpoint Prefix | Entity | Operations |
|--------|----------------|--------|------------|
| **Finance** | `/api/AccVc` | GL Accounts | CRUD |
| | `/api/AccTransVc` | GL Transactions | CRUD |
| | `/api/BankVc` | Banks | CRUD |
| | `/api/BankRecVc` | Bank Reconciliation | CRUD |
| | `/api/BankTRVc` | Bank Transactions | CRUD |
| | `/api/VATDeclVc` | VAT Declarations | CRUD |
| **AR** | `/api/IVVc` | Sales Invoices | CRUD + OK |
| | `/api/CUVc` | Customers | CRUD |
| | `/api/ARPayVc` | AR Payments/Receipts | CRUD |
| **AP** | `/api/PUVc` | Purchase Invoices | CRUD + OK |
| | `/api/VEVc` | Suppliers | CRUD |
| | `/api/APPayVc` | AP Payments | CRUD |
| **Sales** | `/api/QTVc` | Quotations | CRUD |
| | `/api/ORVc` | Sales Orders | CRUD + OK |
| | `/api/COVc` | Customer Orders | CRUD |
| **Purchasing** | `/api/POVc` | Purchase Orders | CRUD + OK |
| **Inventory** | `/api/INVc` | Items | CRUD |
| | `/api/ITVc` | Item Groups | CRUD |
| | `/api/StockMovVc` | Stock Movements | CRUD + OK |
| | `/api/LocationVc` | Locations | CRUD |
| | `/api/StockTakeVc` | Stock Takes | CRUD |
| **CRM** | `/api/ContactVc` | Contacts | CRUD |
| | `/api/ActVc` | Activities | CRUD |
| **HR** | `/api/HRMPAVc` | Employees | CRUD |
| | `/api/HRMPayrollVc` | Payroll | CRUD |
| **Assets** | `/api/AT2Vc` | Fixed Assets | CRUD |
| **POS** | `/api/POSSalesVc` | POS Sales | CRUD |
| **Manufacturing** | `/api/ProdVc` | Production | CRUD |
| | `/api/ProdOrderVc` | Production Orders | CRUD |

**Confidence:** MEDIUM — API endpoints inferred from register names and REST API documentation pattern. Exact endpoint names need verification against live system.

---

## 3. Export Formats (183 files)

**Evidence:** `legacy-src/c8520240417/hal/Exports/` directory

### 3.1 Bank Payment Exports (27+ formats across 15+ countries)

| Country/Region | Format Files | Protocols |
|---------------|-------------|-----------|
| **UK** | `BankEng0.hal`, `BankEng1.hal`, `BankEng2.hal` | BACS, Faster Payments |
| **SEPA** | `BankNorSEPA*.hal`, `BankLatSEPA.hal`, `BankLitSEPA.hal`, `BankGerSEPA.hal` | SEPA Credit Transfer |
| **Finland** | `BankFin0.hal` - `BankFin3.hal` | Finnish bank formats |
| **Norway** | `BankNor0.hal`, `BankNor1.hal` | Norwegian formats |
| **Iceland** | `BankIce1.hal` - `BankIce4.hal` | Icelandic formats |
| **Latvia** | `BankLat0.hal` - `BankLat5.hal`, `BankLatSEPA.hal` | Latvian formats + SEPA |
| **Poland** | `BankPolBPH.hal`, `BankPolING.hal` | Polish bank-specific |
| **Czech Republic** | `BankCzech3.hal` | Czech format |
| **Estonia** | `BankEstEPayment.hal`, `BankEstSEPA.hal` | Estonian formats |
| **Germany** | `BankGerSEPA.hal` | German SEPA |
| **Hungary** | `BankHun*.hal` | Hungarian formats |
| **Australia/NZ** | `BankAuNZ*.hal` | ABA/Direct Entry |
| **Namibia** | `BankNamibia.hal` | South African formats |

### 3.2 Data Exports

| Category | Key Files | Format |
|----------|----------|--------|
| Activities | `Activen.hal` | CSV/XML |
| Articles/Items | `Art2En.hal` | CSV/XML |
| Attachments | `AttachmentsEn.hal` | File export |
| Financial data | Various `*En.hal` | CSV/XML |

### 3.3 Nexa ERP Relevance

**For UK-focused Nexa ERP, the critical exports are:**
- BACS payment files (`BankEng*.hal`) — **MUST HAVE**
- SEPA Credit Transfer — **SHOULD HAVE** (EU suppliers)
- CSV/XML data exports — **SHOULD HAVE** (data portability)

---

## 4. Import Formats (39 files)

**Evidence:** `legacy-src/c8520240417/hal/Imports/` directory

| Import Type | File | Size | Description |
|-------------|------|------|-------------|
| **Bank Statements** | `BankTRIn.hal` | 157K | **Largest** — Bank statement import (OFX/CSV/MT940) |
| **Payroll** | `SmartPayrollIn.hal` | — | External payroll data import |
| | `BrightPayIn.hal` | — | BrightPay integration |
| | `PalkkaFiPayrollIn.hal` | — | Finnish payroll |
| **POS** | `POSIn.hal` | — | POS terminal data import |
| **Legacy Migration** | `OldTagInRecord1.hal` - `5.hal` | — | Legacy data migration (5 files) |
| **Third-Party** | `SonicQIn.hal`, `TeleHipmIn.hal`, `VikarinaIn.hal` | — | Third-party system imports |
| **Commodity** | `CommodityIn.hal` | — | Commodity price data |
| **EDI** | `EDICustomsIn.hal` | — | Customs declarations |
| **Tax** | `UpdateSRUIn.hal` | — | Swedish tax reporting |

---

## 5. EDI Layer (26 files)

**Evidence:** `legacy-src/c8520240417/hal/EDI/` directory

- Electronic Data Interchange handling
- Customs declaration import/export (`EDICustomsIn.hal`)
- Standard EDI message formatting and parsing
- **Relevance to Nexa:** LOW priority for v1 (UK SME focus)

---

## 6. WebNG Endpoints (66 files)

**Evidence:** `legacy-src/c8520240417/hal/WebNG/` directory

| Endpoint Area | File(s) | Size | Key Functions |
|--------------|---------|------|---------------|
| **E-commerce** | `WebNGShopCatalog.hal` | 62K | Product listing, search, filtering |
| | `WebNGShopBasket.hal` (+1) | 59K | Shopping cart CRUD |
| | `WebNGShopPayment.hal` | 102K | Payment processing (multi-gateway) |
| **Customer Portal** | `WebNGMyAccount.hal` | — | Order history, invoice view, profile |
| | `WebNGCustomerRegistration.hal` | — | Signup, verification |
| **Admin** | `WebNGMan.hal` | 99K | Management interface |
| **Content** | `WebNGForum.hal` | 93K | Discussion forums |
| | `WebNGLMS.hal` | 111K | Learning management |
| **HR** | `WebNGHRPortal.hal` | — | Employee self-service |
| **Booking** | `WebNGOnlineReservation.hal` | — | Hotel room booking |
| **Payment Gateways** | Various | — | Paysera, Paytrail, Dotpay, Paymark, ANZ, MercadoPago |

---

## 7. Target Nexa ERP API Surface (from Prior Extraction)

**Evidence:** `_bmad-output/planning-artifacts/nexa-erp-business-rules-requirements.md`, `erp-module-status-summary.md`

### 7.1 Existing API Routes

| Module | Route Prefix | Operations | Status |
|--------|-------------|------------|--------|
| **Finance** | `/api/finance/` | GL post/reverse, AR/AP CRUD | DONE |
| | `/api/finance/ar/` | Invoices, payments, credit notes, write-offs | DONE |
| | `/api/finance/ap/` | Bills, payments | DONE |
| | `/api/banking/` | Bank accounts, statement import, reconciliation | DONE |
| | `/api/finance/vat/` | VAT returns, MTD submit (sandbox) | PARTIAL |
| | `/api/finance/fa/` | Assets, depreciation, dispose, revalue | DONE |
| | `/api/finance/fx/` | FX rates, revaluation | PARTIAL |
| **Inventory** | `/api/inventory/` | Items, movements, adjustments, transfers | DONE |
| | `/api/inventory/atp` | Available to promise | DONE |
| | `/api/inventory/wms/` | Receiving, shipping, pick/pack | DONE |
| **Sales/CRM** | `/api/crm/` | Leads, contacts, accounts, opportunities, activities | DONE |
| | `/api/sales/` | Orders, quotes, invoicing | PARTIAL |
| **Purchasing** | `/api/purchasing/` | POs, RFQ, contracts, GRN, bills | DONE |
| **HR** | `/api/hr/` | Employees, leave, payroll | PARTIAL (no HTTP routes) |
| **Manufacturing** | `/api/manufacturing/` | Work orders, BOM, routing, MRP | DONE |
| **POS** | `/api/pos/` | Sales, sessions, refunds, EOD | DONE |
| **Projects** | `/api/projects/` | Projects, tasks, time, timesheets | DONE |
| **Admin** | `/api/admin/` | Users, audit, backups, GDPR | DONE |
| **Billing** | `/api/billing/`, `/api/stripe/` | SaaS billing (Stripe) | DONE |

### 7.2 API Gaps (Legacy Features Not Yet Exposed)

| Legacy Capability | Legacy Layer | Target API Status | Priority |
|------------------|-------------|-------------------|----------|
| Bank payment file export (BACS) | `Exports/BankEng*.hal` | API exists, no UI | P0 |
| Bank statement import (OFX/CSV) | `Imports/BankTRIn.hal` | API exists | DONE |
| Payment proposal generation | RActions/WActions | Not implemented | P1 |
| Recurring invoice generation | Contracts module | Not implemented | P1 |
| Three-way matching (PO/GRN/Invoice) | RActions logic | Logic exists, no UI | P1 |
| Dunning/reminder automation | AR module | Not implemented | P2 |
| Report export (PDF/CSV/Excel) | Reports layer (743 files) | Not implemented | P1 |
| E-commerce/WebShop API | WebNG (66 files) | Not in scope v1 | P3 |
| EDI message handling | EDI (26 files) | Not in scope v1 | P3 |
| Customer self-service portal | WebNG MyAccount | Not implemented | P2 |
| Employee self-service portal | WebNG HRPortal | Not implemented | P2 |
| Multi-company consolidation | Reports/Consolidation | Not implemented | P2 |

---

## 8. Integration Points Summary

### 8.1 Inbound Integrations (Data → System)

| Integration | Legacy | Target | Status |
|-------------|--------|--------|--------|
| Bank statement import | BankTRIn.hal (OFX/CSV/MT940) | Statement import API | DONE |
| Open Banking | N/A | TrueLayer (sandbox only) | SKELETON |
| Payroll data import | SmartPayrollIn, BrightPayIn | Staffology/PayRun.io API | SKELETON |
| POS terminal data | POSIn.hal | Direct POS API | DONE |
| EDI inbound | EDI/ (26 files) | Not in scope | — |

### 8.2 Outbound Integrations (System → External)

| Integration | Legacy | Target | Status |
|-------------|--------|--------|--------|
| BACS payment files | BankEng*.hal | BACS export API | PARTIAL |
| HMRC MTD | Country-specific | VAT submit API (sandbox) | SKELETON |
| Email | Internal mail system | Notification system | PARTIAL |
| Amazon MWS | AmazonMWSTools.hal | Not in scope | — |
| Asterisk PBX | AsteriskConfigTools.hal (174K) | Not in scope | — |
| Payment gateways | WebNG (6+ gateways) | Stripe only | PARTIAL |

---

## 9. OPEN QUESTIONS (API)

| # | Question | Impact | Where to Look |
|---|----------|--------|---------------|
| OQ-API1 | What are the exact REST API endpoints and parameters in HansaWorld? | API parity assessment | Manual → REST API section (deep dive needed) |
| OQ-API2 | What bank statement formats does BankTRIn.hal support (OFX, CSV, MT940, CAMT.053)? | Import format requirements | `hal/Imports/BankTRIn.hal` (157K) |
| OQ-API3 | What are the exact BACS file format specifications used by BankEng*.hal? | UK payment export | `hal/Exports/BankEng*.hal` |
| OQ-API4 | Which payment gateways are integrated via WebNG and which are needed for UK market? | Payment processing scope | `hal/WebNG/WebNGShopPayment.hal` |
| OQ-API5 | What WebHook/callback mechanisms does HansaWorld support? | Event-driven integration | Server.hal, WebNG |

---

*Cross-references: CODE_REQUIREMENTS.md (business rules), UI_MAP.md (UI endpoints), MIGRATION_MAP.md (entity mapping)*
