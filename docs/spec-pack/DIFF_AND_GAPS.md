# DIFF_AND_GAPS — Legacy HansaWorld vs Target Nexa ERP Gap Analysis

> **Generated:** 2026-02-15
> **Sources:**
> - Legacy: HAL codebase analysis (1,055 entities, 3,170+ fields, 723 RActions, 743 Reports)
> - Target: `_bmad-output/planning-artifacts/` (business rules extraction, module status, completeness report)
> - Manual: hansamanuals.com Standard ERP (37+ modules)
> **Status:** COMPLETE

---

## 1. Executive Summary

| Metric | Legacy (HansaWorld) | Target (Nexa ERP) | Gap |
|--------|-------------------|-------------------|-----|
| **Database entities** | 1,055 registers | ~34 Prisma models | **MASSIVE** — 97% reduction (by design — scope limited to 5 core modules) |
| **Fields (core 54 entities)** | 3,170 fields | ~200 typed fields + JSON | **CRITICAL** — most data stored in JSON blobs |
| **Business rules (RActions)** | 723 files, 300+ rules extracted | ~30% of event subscribers have real logic | **LARGE** — 70% of cross-module effects are stubs |
| **Reports** | 743 report files | ~15 reports implemented | **MASSIVE** — 2% coverage |
| **UI screens** | 552 WAction files + 255 documents | 24 modules, 80+ routes | **MODERATE** — routes exist but depth varies |
| **Export formats** | 183 files (27+ bank formats) | BACS export (partial) | **LARGE** — UK bank formats only |
| **Import formats** | 39 files | Bank statement import only | **MODERATE** — acceptable for v1 |
| **Product variants** | 52 SKUs | 1 product | By design |
| **Countries** | 20+ localizations | UK only | By design |

---

## 2. Module-by-Module Gap Analysis

### 2.1 Finance / General Ledger

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Chart of Accounts | AccVc: 22 fields, hierarchical, typed, blocked, control accounts | CoaTemplate: template-based, no dedicated CRUD UI | CORE-PARTIAL | No account management UI, no hierarchy |
| GL Transactions | AccTransVc: auto-posting from all sub-ledgers | JournalEntry + JournalLine: manual + some auto-posting | CORE-PARTIAL | Only ~30% of auto-posting subscribers have real logic |
| Account Types | 5 types (Asset/Liability/Income/Expense/Equity) | String-typed (not enum) | CORE-PARTIAL | Type not enforced |
| Objects/Dimensions | ObjVc: multi-dimensional cost centre tracking | Not implemented | MISSING | No cost centre/dimension support |
| Period Management | AccPeriodVc: formal register with lock/unlock | Two parallel mechanisms | CORE-PARTIAL | No fiscal year config, no auto-period generation |
| Budget | BudgetVc: formal register with revised budgets | File-backed JSON | CORE-PARTIAL | No variance analysis, no approval workflow |
| Consolidation | Multi-company, multi-level, eliminations | Not implemented | MISSING | Enterprise module stubs only |
| Simulation | SimVc: what-if transaction testing | Not implemented | MISSING | |
| Double-entry enforcement | Enforced at RAction level | Enforced in GL post service | DONE | ✓ |
| Period locking | Date-based lock (DBLockBlock.DeleteBeforeDate) | Period open/close | DONE | ✓ |

### 2.2 Accounts Receivable

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Customer entity | CUVc: 313 fields, 32 relationships | Customer: ~15 fields, 7 SCHEMA-GAPs | CORE-PARTIAL | Missing: VAT number, structured address, credit limit, billing/shipping address, contact person |
| Invoice | IVVc: ~200 header + 80 line fields, 7 types | CustomerInvoice: ~20 header + 10 line fields | CORE-PARTIAL | Missing: multi-currency, recurring, installments, fiscal hash |
| Invoice types | 7 types: Normal, Cash, Credit, Interest, Debit Note, Period, Prepayment | Normal + Credit Note only | PARTIAL | Missing 5 invoice types |
| Credit notes | Full validation (51-60 rules) | Basic credit note creation | CORE-PARTIAL | Missing: original must be OKed, currency match, date validation, amount cap |
| OK Flag workflow | Universal approval with GL posting | Approve/post exists | DONE | ✓ Similar pattern |
| Payment terms | PayDeal register with days, early discount | termsDays on Customer | CORE-PARTIAL | No early payment discount, no payment terms register |
| Automatic reminders | Configurable escalation levels | Not implemented | MISSING | |
| Interest invoicing | Auto-generate interest on overdue | Not implemented | MISSING | |
| Installment tracking | ARInstallVc register | Not implemented | MISSING | |
| Disputes flag | DisputedFlag on IVVc | Not implemented | MISSING | |
| Commission tracking | SalesMan + commission calculation | Not implemented | MISSING | |
| Credit limit check | 3 modes (all open, overdue only, suspend on overdue) | Not implemented | MISSING | Legacy has sophisticated credit management |

### 2.3 Accounts Payable

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Supplier entity | VEVc: 50 fields, 9 relationships | Supplier: ~10 fields, 8 SCHEMA-GAPs | CORE-PARTIAL | Missing: address, VAT, payment terms, bank details, status |
| Purchase invoice | PUVc: 73 header + 84 line fields | SupplierBill: simplified | CORE-PARTIAL | Missing: three-way matching UI, partial credit notes |
| Three-way matching | PO → GRN → Invoice matching enforced | Logic exists, no dedicated UI | CORE-PARTIAL | |
| Payment proposal | Auto-generate batch payments by due date | Not implemented | MISSING | |
| BACS/SEPA export | 27+ bank format files | BACS API exists (no UI) | CORE-PARTIAL | |
| Cost variance tracking | UpdateVarianceStatusPU | Not implemented | MISSING | |

### 2.4 Sales / CRM

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Quotations | QTVc: 148 fields + 57 array fields | SalesQuote: dual storage | CORE-PARTIAL | Missing: versioning, terms, tax |
| Sales Orders | ORVc: 165 fields + 66 array fields | SalesOrder: SKELETON (only create) | **CRITICAL** | No list/get/update/cancel/fulfillment |
| Price hierarchy | Customer > Item > Item Group > Price List | Price Books exist | CORE-PARTIAL | No hierarchical override |
| ATP checking | Stock reservation + availability | ATP API exists but ignores reservations | CORE-PARTIAL | ATP derives from Shipment data only |
| Credit limit on order | 3 configurable modes | Not implemented | MISSING | |
| Contacts | ContactVc: unified entity (Customer+Supplier+Person) | Separate CRM entities | DONE | Different architecture (split vs unified) |
| Activities | ActVc: 89 fields, privacy per user | Activities: dual storage | CORE-PARTIAL | Missing: reminder integration |
| Campaigns | CampaignVc: 16 fields + 4 array fields | Not implemented | MISSING | |
| Leads | LeadVc: 39 fields | CrmLead: dual storage | CORE-PARTIAL | |
| Opportunity | Not in legacy (CRM focused) | CrmOpportunity: CORE-PARTIAL | — | Target has this, legacy doesn't |
| Pipeline | Not in legacy | Pipeline summary | — | Target advantage |

### 2.5 Inventory / Stock

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Item master | INVc: 211 fields, 44 relationships | InventoryItem: 4 typed fields + JSON | **CRITICAL** | All metadata in JSON blob |
| Item Groups | ITVc: 67 fields with GL account defaults | Categories (no GL mapping) | CORE-PARTIAL | No default GL accounts per group |
| Costing methods | FIFO, Weighted Average, Standard Cost (per item/group) | WAC + FIFO (config-based JSON) | CORE-PARTIAL | No standard cost, not per-item configurable |
| Stock movements | StockMovVc: 110 fields + 26 array fields, 13 types | StockMovement: 13 types, not transactional | CORE-PARTIAL | Separate Prisma calls (not atomic) |
| Serial numbers | Full tracking (serialized items, strict qty=1 enforcement) | trackSerial flag exists but never enforced | CORE-SKELETON | |
| Lot/Batch tracking | Batch with expiry dates | InventoryLot model, rarely populated | CORE-PARTIAL | |
| Multi-UoM | Unit conversion factors per item | Not implemented | MISSING | |
| Reorder points | Min stock level alerts | Flags exist but no automation | CORE-SKELETON | |
| Stock reservation | StockReservVc: formal register | Reservation model ignored by ATP | CORE-PARTIAL | |
| Position/Bin management | Position validation (capacity: width, height, depth) | Location model (SKELETON) | CORE-SKELETON | |
| Barcode support | Item Code + additional barcodes | Not implemented | MISSING | |
| Item variants | Sizes, colors via VARList | Not implemented | MISSING | |
| Warehouse locations | LocationVc: 55 fields, 10 relationships | Warehouse: minimal | CORE-PARTIAL | |

### 2.6 HR / Payroll

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Employee master | HRMPAVc + StaffVc: ~80+ fields | Employee: 6 typed fields + JSON | **CRITICAL** | Extremely minimal |
| Employment contracts | HRMCOVc: 36 fields + 9 array fields | Not implemented | MISSING | |
| Payroll processing | HRMPayrollVc: formal register | Triple implementation (Prisma/JSON/file) | CORE-PARTIAL | No approval workflow |
| UK tax calculation | Country-specific (haldefs.h) | Demo calculators only (basic rate 20%) | CORE-SKELETON | No higher/additional/Scottish/Welsh |
| Third-party payroll API | N/A (built-in) | Staffology/PayRun.io planned | CORE-SKELETON | No integration code |
| Leave management | Leave register | JSON-based, no DB models | CORE-PARTIAL | No bank holiday exclusion |
| Performance appraisal | HRMPAVc: formal register with ratings | Not implemented | MISSING | |
| Training tracking | Training register | Not implemented | MISSING | |
| Skills evaluation | Skills register | Not implemented | MISSING | |
| Job positions | Job Position register | Not implemented | MISSING | |
| P45/P60 generation | Country-specific exports | Not implemented | MISSING | |
| Pension auto-enrolment | Country-specific | Not implemented | MISSING | |
| RTI (HMRC) submission | Country-specific | Not implemented | MISSING | |

### 2.7 Fixed Assets

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Asset register | AT2Vc: 17 fields + 2 array fields | FixedAsset: CORE-PARTIAL | DONE | |
| Depreciation | Multiple methods (straight-line, declining balance, custom) | Straight-line only | CORE-PARTIAL | Missing methods |
| Disposal | Full workflow with gain/loss calculation | Basic disposal | CORE-PARTIAL | |
| Revaluation | AT2RevVc register | Basic revaluation, no history | CORE-PARTIAL | |
| Asset categories | Formal register | No asset category enum | CORE-PARTIAL | |

### 2.8 POS

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| POS Sales | POSSalesVc: 29 fields + 13 array fields | PosSale: triple implementation | CORE-PARTIAL | |
| Cash management | CashVc: formal with session open/close | Session management exists | CORE-PARTIAL | |
| Offline mode | Live-Sync: standalone offline, sync when connected | Not implemented | MISSING | |
| Card-present payment | Cash/card payment handling | Stripe Terminal (stubbed) | CORE-SKELETON | |
| Cash drawer | DrawerVc: physical drawer control | No functional logic | CORE-SKELETON | |
| X/Z Reports | Session reports | Schema exists, no implementation | CORE-SKELETON | |
| Receipt printing | Printer drivers (45 files, 20+ models) | HTML receipt only | CORE-PARTIAL | |

### 2.9 Manufacturing

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| BOM | ProdVc: 45 fields + 40 array fields | Bom model: DONE | DONE | |
| Work Orders | ProdOrderVc: 40 fields + 15 array fields | WorkOrder: DONE | DONE | |
| Routing/Operations | ProdOperationVc: 35 fields + 17 array fields | Routing + RoutingStep | DONE | |
| MRP | ProdPlanVc | MRP run exists | CORE-PARTIAL | |
| Machine Hours | Machine Hours register | Not implemented | MISSING | |
| Alternative components | ProdItemVc alternatives | Not implemented | MISSING | |

### 2.10 Reporting

| Feature | Legacy | Target | Classification | Gap Description |
|---------|--------|--------|---------------|-----------------|
| Report engine | 743 compiled reports | ~15 basic reports | **MASSIVE** | 2% coverage |
| Balance Sheet | BalRn.hal + variants | `/finance/reports` | DONE | |
| P&L | PLRn.hal + variants | `/finance/reports` | DONE | |
| Trial Balance | TBRn.hal | `/finance/reports` | DONE | |
| AR/AP Aging | ARRn.hal, APRn.hal | Aging reports | DONE | Partial payment handling missing |
| Cash Flow | Cash flow reports | Not implemented | MISSING | |
| VAT Reports | VATRn.hal | VAT returns (partial) | CORE-PARTIAL | |
| Stock Reports | StockRn.hal (20+ variants) | Stock valuation only | CORE-PARTIAL | |
| Asset Reports | AT2DeprRn.hal variants | Asset register only | CORE-PARTIAL | |
| Sales Reports | Multiple | Not implemented | MISSING | |
| HR Reports | HRMRn.hal variants | Not implemented | MISSING | |
| Project Reports | PRRn.hal variants | Not implemented | MISSING | |
| Report Generator | Custom report builder | Not implemented | MISSING | |
| Report export | Print/PDF/CSV | Not implemented | MISSING | |

---

## 3. Field Richness Gap Summary

| Entity | Legacy Fields | Target Fields | Reduction | Impact |
|--------|-------------|--------------|-----------|--------|
| Customer (CUVc → Customer) | 313 | ~15 typed | **95%** | CRITICAL — most customer data lost |
| Item (INVc → InventoryItem) | 211 | 4 typed + JSON | **98%** | CRITICAL — metadata in JSON |
| Invoice (IVVc → CustomerInvoice) | ~280 (header+lines) | ~30 (header+lines) | **89%** | LARGE |
| Sales Order (ORVc → SalesOrder) | 231 (header+lines) | SKELETON | **99%** | CRITICAL |
| Purchase Order (POVc → PurchaseOrder) | 146 (header+lines) | ~20 | **86%** | LARGE |
| Supplier (VEVc → Supplier) | 50 | ~10 | **80%** | LARGE |
| Employee (HRMPAVc → Employee) | ~80+ | 6 typed + JSON | **93%** | CRITICAL |
| Stock Movement (StockMovVc) | 136 (header+lines) | ~15 | **89%** | LARGE |
| Location (LocationVc → Warehouse) | 55 | ~8 | **85%** | LARGE |

---

## 4. Business Rule Coverage

### 4.1 Legacy Rules Extracted (from CODE_REQUIREMENTS.md)

| Entity | Rules Extracted | Rules Implemented in Target | Coverage |
|--------|----------------|---------------------------|----------|
| IVVc (Invoice) | 60 | ~15 (basic validations) | **25%** |
| PUVc (Purchase Invoice) | 28 | ~10 | **36%** |
| ORVc (Sales Order) | 47 | ~5 (skeleton) | **11%** |
| POVc (Purchase Order) | 30 | ~12 | **40%** |
| INVc (Item) | 8 | ~3 | **38%** |
| StockMovVc (Stock Movement) | 18 | ~8 | **44%** |
| AccBlock (GL Settings) | 5+ | ~2 | **40%** |
| CashVc (POS Cash) | 12 | ~4 | **33%** |
| HRMPayrollVc (Payroll) | 5 | ~2 | **40%** |
| **Total** | **300+** | **~60** | **~20%** |

### 4.2 Critical Missing Business Rules

1. **Credit limit checking** (3 modes) — Not implemented in target
2. **OK Flag complete workflow** — Partial (no un-OK reversal of cross-entity effects)
3. **Credit note validation chain** (10 rules) — Only basic implementation
4. **Serial number enforcement** — Flag exists but not enforced
5. **Three-way matching** — Logic exists but no UI or enforcement
6. **Multi-currency rate management** — FX rates exist but revaluation is partial
7. **Stock chronology validation** — Not implemented
8. **Position/bin capacity management** — Not implemented
9. **Payment proposal generation** — Not implemented
10. **Automatic GL posting from all sub-ledgers** — Only 30% of subscribers implemented

---

## 5. Architecture Gaps

| Aspect | Legacy | Target | Gap |
|--------|--------|--------|-----|
| Data storage | All data in typed fields | Extensive JSON blob usage | **CRITICAL** — JSON stores lose queryability, validation, FK integrity |
| Dual storage | Single storage per entity | 30+ entities with dual (Prisma + JSON/file) storage | **HIGH** — Data consistency risk |
| Transactional integrity | Native DB transactions | Separate Prisma calls (not atomic for stock moves) | **HIGH** — Race conditions possible |
| Audit trail | Full change tracking | Audit log exists but minimal per-field tracking | **MODERATE** |
| Multi-currency | Dual-base currency throughout | Single base + FX rate table | **MODERATE** — By design decision |
| Multi-company | Single DB, multi-company | Database-per-tenant | **N/A** — Different architecture |
| Offline support | Live-Sync POS mode | No offline capability | **MODERATE** — POS only |

---

## 6. Target Advantages Over Legacy

| Feature | Legacy | Target |
|---------|--------|--------|
| AI-first interface | No AI | Conversational UI primary, 8 context providers, agent system |
| Modern web UI | Desktop thick client | React web, mobile-responsive |
| API-first | REST API (secondary) | REST API primary |
| Cloud-native | Client-server | Multi-tenant SaaS |
| Event-driven | Procedural (RActions) | 50+ event types, typed event bus, transactional outbox |
| SaaS billing | N/A | Stripe integration |
| CI/CD | Compiled .hob files | Modern deployment pipeline |
| Technology | Proprietary HAL | TypeScript/Node.js/React ecosystem |
| Data warehouse | No analytics layer | 7 Dimension + 6 Fact tables |
| CRM pipeline | Basic contact management | Opportunity pipeline, lead scoring (planned) |

---

## 7. Priority Gap Remediation Recommendations

### P0 — Must Fix Before Production

1. **SalesOrder endpoints** — Only create exists. Need full CRUD + lifecycle.
2. **InventoryItem schema** — Move critical fields from JSON to typed Prisma columns.
3. **Employee schema** — Move critical HR fields from JSON to typed columns.
4. **Credit limit checking** — Implement at least basic mode on invoice/order creation.
5. **Dual storage consolidation** — Choose one storage mechanism per entity.

### P1 — Required for Feature Parity

6. **Report coverage** — Add cash flow, sales, HR, project reports.
7. **Three-way matching UI** — Expose existing logic in purchasing UI.
8. **Cost centre/dimension support** — Add Objects equivalent.
9. **Payment terms register** — Move from flat days to configurable terms.
10. **Serial number enforcement** — Actually enforce trackSerial flag.
11. **Multi-UoM** — Add unit conversion support to items.

### P2 — Important for UK Market

12. **UK payroll integration** — Complete Staffology/PayRun.io API integration.
13. **HMRC MTD** — Move from sandbox to live submission.
14. **P45/P60 generation** — Statutory document output.
15. **Pension auto-enrolment** — Workplace pension compliance.
16. **Dunning/reminder automation** — Automated overdue collection.

### P3 — Enhancement

17. **Campaign management** — CRM campaigns.
18. **Report generator** — Custom report builder.
19. **Customer self-service portal** — WebNG equivalent.
20. **Offline POS mode** — Live-Sync equivalent.

---

## 8. OPEN QUESTIONS (Gaps)

| # | Question | Impact | Resolution Path |
|---|----------|--------|----------------|
| OQ-G1 | How many of the 313 CUVc customer fields are actually populated by UK SMEs? | Determines minimum Customer schema | Survey HansaWorld UK users or analyze sample data |
| OQ-G2 | Which of the 743 legacy reports are used most frequently? | Report prioritization | Usage analytics from HansaWorld or user interviews |
| OQ-G3 | Are there UK regulatory requirements not covered by the prior extraction? | Compliance risk | UK Companies Act, HMRC requirements review |
| OQ-G4 | Which legacy WAction files contain business logic vs pure UI logic? | Code extraction scope | Systematic WAction analysis |
| OQ-G5 | What is the acceptable data loss for JSON-stored fields during migration? | Migration strategy | Business stakeholder decision |

---

*Cross-references: CODE_REQUIREMENTS.md (detailed business rules), DATA_MODEL.md (field counts), MIGRATION_MAP.md (entity mapping), OPEN_QUESTIONS.md (consolidated questions)*
