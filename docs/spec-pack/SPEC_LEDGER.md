# SPEC_LEDGER — Master Requirements Index & Traceability Matrix

> **Generated:** 2026-02-15
> **Purpose:** Central index of all requirements, cross-references, and evidence chains
> **Status:** COMPLETE

---

## 1. Spec-Pack Document Registry

| # | Document | Status | Lines | Key Content |
|---|----------|--------|-------|-------------|
| 1 | [REPO_MAP.md](REPO_MAP.md) | COMPLETE | ~315 | Legacy codebase structure: 3,873 files, 1,055 entities, 1.7M LOC |
| 2 | [MANUAL_EXTRACT.md](MANUAL_EXTRACT.md) | COMPLETE | ~340+ | 37+ modules from hansamanuals.com with registers, rules, integrations |
| 3 | [CODE_REQUIREMENTS.md](CODE_REQUIREMENTS.md) | COMPLETE | ~600+ | 300+ business rules from 14 RAction files with evidence pointers |
| 4 | [DATA_MODEL.md](DATA_MODEL.md) | COMPLETE | ~360+ | 54 core registers, 3,170 fields, 565 relationships |
| 5 | [MIGRATION_MAP.md](MIGRATION_MAP.md) | COMPLETE | ~195 | HAL → Nexa entity mapping, field richness gaps, migration decisions |
| 6 | [UI_MAP.md](UI_MAP.md) | COMPLETE | ~280 | 552 WActions, 255 documents, legacy→target screen mapping |
| 7 | [API_INVENTORY.md](API_INVENTORY.md) | COMPLETE | ~250 | REST API, 183 exports, 39 imports, 26 EDI, WebNG endpoints |
| 8 | [SPEC_LEDGER.md](SPEC_LEDGER.md) | COMPLETE | This file | Master index and traceability |
| 9 | [DIFF_AND_GAPS.md](DIFF_AND_GAPS.md) | COMPLETE | ~300+ | Module-by-module gap analysis, field richness comparison |
| 10 | [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | COMPLETE | ~240 | 30 open questions (8 P0, 12 P1, 10 P2) |
| 11 | [QA_PACK.md](QA_PACK.md) | COMPLETE | ~200 | Self-assessment, coverage metrics, consistency checks |

---

## 2. Evidence Source Registry

| Source | Type | Location | Description |
|--------|------|----------|-------------|
| **HAL Codebase** | Primary | `legacy-src/c8520240417/` | 3,873 files, ~60MB, HAL source code |
| **HansaWorld Manual** | Primary | hansamanuals.com → Standard ERP | Official product documentation |
| **Prior Extraction** | Secondary | `_bmad-output/planning-artifacts/` | 10,789-line business rules extraction from Nexa ERP codebase |
| **Completeness Report** | Secondary | `_bmad-output/planning-artifacts/extraction-completeness-report.md` | 120 missing features vs 13 competitors |
| **Contradictions Report** | Secondary | `_bmad-output/planning-artifacts/extraction-contradictions-report.md` | 72 resolved contradictions |
| **Module Status** | Secondary | `_bmad-output/planning-artifacts/erp-module-status-summary.md` | 24 modules at 30-95% completion |
| **Vision** | Secondary | `_bmad-output/ai-first-erp-vision-summary.md` | AI-first ERP product vision |
| **Data Model Extraction** | Derived | `/tmp/hansaworld_hal_data_model_extraction.txt` | 54 registers, 4,391 lines, 297KB |

---

## 3. Requirements Traceability Matrix

### 3.1 By Module

| Module | Legacy Entities | Legacy Rules | Target Entities | Target Status | Spec Documents |
|--------|----------------|-------------|----------------|---------------|---------------|
| **Finance/GL** | AccVc, AccTransVc, AccHistVc, AccPeriodVc, AccClassVc, BudgetVc | AccBlockActions (5+ rules) | CoaTemplate, JournalEntry, JournalLine | 80% | CODE_REQUIREMENTS, DATA_MODEL, DIFF_AND_GAPS |
| **AR** | IVVc, CUVc, ARVc, ARPayVc, ARInstallVc | IVVcRecAction (60 rules) | Customer, CustomerInvoice, CustomerPayment | 80% (7 SCHEMA-GAPs) | CODE_REQUIREMENTS §1, DATA_MODEL §2.2, MIGRATION_MAP §2.2 |
| **AP** | PUVc, VEVc, APVc, APPayVc | PUVcRecAction (28 rules) | Supplier, SupplierBill, SupplierPayment | 80% (8 SCHEMA-GAPs) | CODE_REQUIREMENTS §2, DATA_MODEL, MIGRATION_MAP §2.3 |
| **Sales** | QTVc, ORVc, COVc, DispatchVc | ORVcRecAction (47 rules) | SalesQuote, SalesOrder, Shipment | 80% (SO=SKELETON) | CODE_REQUIREMENTS §3, DIFF_AND_GAPS §2.4 |
| **Purchasing** | POVc | POVcRAction (30 rules) | PurchaseOrder | 80% | CODE_REQUIREMENTS §4, DIFF_AND_GAPS §2.3 |
| **Inventory** | INVc, ITVc, StockMovVc, LocationVc, StockTakeVc, StockReservVc | INVcRAction (8), StockMovVcRAction (18) | InventoryItem, StockMovement, Warehouse | 85% (item=CRITICAL) | CODE_REQUIREMENTS §5-6, DATA_MODEL §2.5, DIFF_AND_GAPS §2.5 |
| **CRM** | ContactVc, ActVc, LeadVc, CampaignVc | ContactVcRAction (2 rules) | CrmContact, CrmAccount, CrmActivity, CrmLead | 80% | CODE_REQUIREMENTS §10, DIFF_AND_GAPS §2.4 |
| **HR/Payroll** | HRMPAVc, HRMPayrollVc, HRMCOVc, HRMPymtTypeVc, StaffVc | HRMPAVcRAction (7), HRMPayrollVcRAction (5) | Employee, PayrollRun, PayrollDeduction | 70% | CODE_REQUIREMENTS §11-12, DIFF_AND_GAPS §2.6 |
| **Fixed Assets** | AT2Vc, AT2DprVc, AT2MovVc | AT2VcRAction (1 rule) | FixedAsset, FixedAssetDepreciation | 80% | CODE_REQUIREMENTS §13, DIFF_AND_GAPS §2.7 |
| **POS** | POSSalesVc, CashVc, DrawerVc | CashVcRAction (12 rules) | PosSale, PosStore, PosRegister | 75% | CODE_REQUIREMENTS §8, DIFF_AND_GAPS §2.8 |
| **Manufacturing** | ProdVc, ProdOrderVc, ProdOperationVc, ProdItemVc | Not yet extracted | Bom, WorkOrder, Routing | 80% | DIFF_AND_GAPS §2.9, DATA_MODEL |
| **VAT/Tax** | VATDeclVc, TaxTemplateVc, VATClassVc | VATDeclVcRAction (5 rules) | VatReturn (partial) | 50% | CODE_REQUIREMENTS §14, DIFF_AND_GAPS |
| **Banking** | BankVc, BankRecVc, BankTRVc | Not yet extracted | BankAccount, BankStatementLine, BankReconciliation | 80% | DATA_MODEL §12, API_INVENTORY §3 |

### 3.2 Cross-Cutting Concerns

| Concern | Legacy Implementation | Target Implementation | Spec Reference |
|---------|---------------------|----------------------|----------------|
| **OKFlag Workflow** | Universal across all transactional entities | Partial (approve/post pattern) | CODE_REQUIREMENTS §Universal Patterns |
| **Delete Protection** | 4-check pattern (OKFlag, date lock, children, approval) | Basic soft-delete | CODE_REQUIREMENTS §Universal Patterns |
| **Serial Numbering** | Configurable per entity with chronology validation | Timestamp-based | OPEN_QUESTIONS OQ-020 |
| **Multi-Currency** | Dual-base (B1/B2) throughout | Single base + FX rates | MIGRATION_MAP §4.1 (decided) |
| **Multi-Company** | Single DB, multi-company register | Database-per-tenant | MIGRATION_MAP §4.1 (decided) |
| **Access Control** | Access Groups per module/register/action | RBAC (5 roles) + module toggles | DIFF_AND_GAPS §5 |
| **Audit Trail** | Full change tracking | Audit log (minimal per-field) | DIFF_AND_GAPS §5 |
| **Error Codes** | 60+ unique error codes documented | Exception-based | CODE_REQUIREMENTS §Error Code Reference |

---

## 4. Statistics

### 4.1 Extraction Coverage

| Aspect | Total in Legacy | Extracted | Coverage |
|--------|----------------|-----------|----------|
| Entities (registers) | 1,055 | 54 (detailed schema) | 5.1% of total, **100% of core ERP scope** |
| Fields | Unknown (est. 50,000+) | 3,170 | ~6% (covers all 5 core modules) |
| Relationships | Unknown | 565 | Core module coverage |
| RAction files | 723 | 14 (detailed analysis) | 1.9% of files, **covers key entities** |
| Business rules | Unknown (est. 2,000+) | 300+ | ~15% (focused on critical paths) |
| Reports | 743 | Cataloged (not detailed) | 100% cataloged, 0% detailed |
| WActions | 552 | Cataloged (not detailed) | 100% cataloged, 0% detailed |
| Manual modules | 37+ | 37+ (all fetched) | **100%** |
| Export formats | 183 | Cataloged by country | 100% cataloged |
| Import formats | 39 | Cataloged by type | 100% cataloged |

### 4.2 Evidence Quality

| Evidence Type | Confidence | Notes |
|--------------|------------|-------|
| Direct HAL code analysis | HIGH | Field definitions, relationships, RAction rules |
| HansaWorld manual | HIGH | Official documentation |
| Prior extraction (Nexa ERP) | HIGH | Comprehensive 10,789-line analysis |
| Inferred from patterns | MEDIUM | Some rules generalized from observed patterns |
| Manual section summaries | MEDIUM | Index pages parsed; some detail pages not fetched |
| Entity count estimates | LOW | Module-level counts estimated from naming patterns |

---

## 5. Key Decisions Log

| # | Decision | Made By | Date | Impact | Reference |
|---|----------|---------|------|--------|-----------|
| D-1 | Fresh codebase (not fork) | Prior | Pre-2026 | Extract business logic, not code | Vision doc |
| D-2 | Database-per-tenant | Prior | Pre-2026 | Each client gets own PostgreSQL DB | Business rules doc §Instructions |
| D-3 | AI-first interaction | Prior | Pre-2026 | Conversational UI primary | Vision doc |
| D-4 | UK payroll via API | Prior | Pre-2026 | Staffology/PayRun.io integration | Business rules doc §Instructions |
| D-5 | 5 core modules | Prior | Pre-2026 | Invoicing, Inventory, CRM, HR, Reporting | Business rules doc §Module Coverage |
| D-6 | Single base currency | Prior/Confirmed | 2026-02-15 | Not dual-base like legacy | MIGRATION_MAP D-5 |
| D-PENDING-1 | Invoice field count | TBD | — | ~80 recommended | OPEN_QUESTIONS OQ-008 |
| D-PENDING-2 | Item JSON vs relational | TBD | — | Relational recommended | OPEN_QUESTIONS OQ-009 |
| D-PENDING-3 | Item Group GL defaults | TBD | — | Yes recommended | OPEN_QUESTIONS OQ-010 |
| D-PENDING-4 | Multi-address support | TBD | — | Yes recommended | OPEN_QUESTIONS OQ-011 |
| D-PENDING-5 | Report scope | TBD | — | Core 20 + extended 30 recommended | OPEN_QUESTIONS OQ-007 |

---

## 6. Document Cross-Reference Map

```
REPO_MAP ──────────► DATA_MODEL (entity sources)
    │                    │
    │                    ├──► MIGRATION_MAP (field mapping)
    │                    │
    │                    └──► DIFF_AND_GAPS (field richness comparison)
    │
MANUAL_EXTRACT ────► CODE_REQUIREMENTS (business rules validation)
    │                    │
    │                    ├──► DIFF_AND_GAPS (rule coverage analysis)
    │                    │
    │                    └──► MIGRATION_MAP (functional mapping)
    │
    ├────────────────► UI_MAP (screen/form mapping)
    │                    │
    │                    └──► DIFF_AND_GAPS (UI coverage)
    │
    └────────────────► API_INVENTORY (integration mapping)
                         │
                         └──► DIFF_AND_GAPS (API gap analysis)

All documents ──────► OPEN_QUESTIONS (consolidated OQs)
                   └──► SPEC_LEDGER (this index)
                   └──► QA_PACK (quality assessment)
```

---

*This document should be updated whenever new requirements are identified or questions are resolved.*
