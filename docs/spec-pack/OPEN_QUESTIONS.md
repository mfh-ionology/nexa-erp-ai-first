# OPEN_QUESTIONS — Consolidated Open Questions Register

> **Generated:** 2026-02-15
> **Source:** All spec-pack documents + prior extraction
> **Status:** COMPLETE — Living document, to be updated as questions are resolved

---

## 1. Summary

| Priority | Count | Status |
|----------|-------|--------|
| **P0 — Blocking** | 8 | OPEN |
| **P1 — Important** | 12 | OPEN |
| **P2 — Nice to Know** | 10 | OPEN |
| **Total** | **30** | |

---

## 2. P0 — Blocking Questions (Must resolve before architecture finalization)

### OQ-001: Customer Field Prioritization
- **Source:** DATA_MODEL.md (OQ-D1), DIFF_AND_GAPS.md (OQ-G1)
- **Question:** Of the 313 CUVc customer fields, which are essential for UK SME operations?
- **Impact:** Determines Customer entity schema — currently 15 fields vs 313 legacy
- **Confidence:** LOW — No UK user data available
- **Resolution Path:** Survey HansaWorld UK customers or analyze sample database export
- **Recommendation:** Start with ~50 most-used fields; add structured address, VAT number, credit limit, payment terms, contact person, billing/shipping addresses, bank details

### OQ-002: Item Field Prioritization
- **Source:** DATA_MODEL.md (OQ-D2), DIFF_AND_GAPS.md
- **Question:** Of the 211 INVc item fields, which must be promoted from JSON to typed columns?
- **Impact:** CRITICAL — Current InventoryItem has only 4 typed fields
- **Confidence:** LOW
- **Resolution Path:** Analyze actual UK SME item data patterns
- **Recommendation:** At minimum: name, description, itemType, unitOfMeasure, barcode, weight, dimensions, status, reorderPoint, costPrice, salesPrice, vatCode, serialTracking, batchTracking, itemGroup (15+ fields)

### OQ-003: Sales Order Architecture
- **Source:** DIFF_AND_GAPS.md, erp-module-status-summary.md
- **Question:** The current SalesOrder implementation uses OrderExternal (Channel model) instead of SalesOrder. Should this be rebuilt?
- **Impact:** CRITICAL — Sales Order is a core entity with only a create endpoint
- **Confidence:** HIGH — This clearly needs to be rebuilt
- **Resolution Path:** Architecture decision: rebuild as proper SalesOrder with full lifecycle
- **Recommendation:** Yes — implement full Quote → Order → Delivery → Invoice lifecycle

### OQ-004: Employee Schema Decision
- **Source:** DIFF_AND_GAPS.md
- **Question:** What Employee fields must move from JSON to typed Prisma columns?
- **Impact:** CRITICAL — Only 6 typed fields currently
- **Confidence:** MEDIUM — UK employment law dictates minimums
- **Resolution Path:** UK HR compliance review (Employment Rights Act, HMRC requirements)
- **Recommendation:** At minimum: status, department, jobTitle, managerId, startDate, endDate, employmentType, payFrequency, basePay, bankDetails, niNumber, taxCode, pensionOptIn

### OQ-005: UK VAT/Tax Rules
- **Source:** MIGRATION_MAP.md (OQ-MG6), MANUAL_EXTRACT.md
- **Question:** What are the exact UK-specific VAT rules that must be replicated?
- **Impact:** HIGH — VAT compliance is legally required
- **Confidence:** MEDIUM — Legacy has country-specific HAL files
- **Resolution Path:** Analyze `english/CountrySpecific/` + HMRC MTD requirements
- **Where to Look:** `legacy-src/c8520240417/english/CountrySpecific/`, HMRC gov.uk documentation

### OQ-006: Dual Storage Consolidation Strategy
- **Source:** DIFF_AND_GAPS.md, extraction-completeness-report.md
- **Question:** For the 30+ entities with dual storage (Prisma + JSON/file), what is the migration strategy?
- **Impact:** HIGH — Data consistency risk across the system
- **Confidence:** HIGH — Must consolidate to single storage
- **Resolution Path:** Architecture decision per entity
- **Recommendation:** Migrate all to Prisma; deprecate file-based and JSON-config storage

### OQ-007: Which Legacy Reports Are Essential?
- **Source:** DIFF_AND_GAPS.md (OQ-G2), UI_MAP.md
- **Question:** Of the 743 legacy report files, which 20-50 are needed for UK SME operations?
- **Impact:** HIGH — Currently only 15 reports implemented (2% coverage)
- **Confidence:** LOW — No usage data
- **Resolution Path:** Categorize by UK regulatory requirement vs operational need
- **Recommendation:** P0 reports: P&L, Balance Sheet, Trial Balance, AR/AP Aging, VAT Return, Cash Flow Statement, Stock Valuation, Bank Reconciliation, Payslips, Employee List

### OQ-008: How Many Legacy IVVc Invoice Fields to Carry Forward?
- **Source:** MIGRATION_MAP.md (D-1)
- **Question:** Legacy invoice has ~280 fields (header+lines). Target has ~30. What's the right number?
- **Impact:** Invoice is the most critical business document
- **Confidence:** MEDIUM
- **Resolution Path:** Map each legacy field to business need; classify as Must/Should/Could/Won't
- **Recommendation:** ~80 fields (all relevant business fields, excluding vertical-specific like Hotel/Restaurant)

---

## 3. P1 — Important Questions (Should resolve before implementation)

### OQ-009: Should Item Metadata Move from JSON to Relational?
- **Source:** MIGRATION_MAP.md (D-2)
- **Question:** Keep flexible JSON or structured relational for item attributes?
- **Resolution Path:** Architecture decision considering query patterns and validation needs
- **Recommendation:** Relational for core fields; JSON for custom/extended attributes

### OQ-010: Should HAL Item Groups Map to Categories with GL Defaults?
- **Source:** MIGRATION_MAP.md (D-3)
- **Question:** Legacy ITVc has 67 fields including 15+ GL account defaults per group. Replicate?
- **Resolution Path:** Determine if UK SMEs use group-level account defaults
- **Recommendation:** Yes — this is a core ERP pattern that eliminates manual account entry

### OQ-011: Multi-Address Support
- **Source:** MIGRATION_MAP.md (D-4)
- **Question:** Carry forward billing + shipping address pattern from legacy?
- **Confidence:** HIGH — Standard ERP requirement
- **Recommendation:** Yes — implement structured addresses with billing/shipping distinction

### OQ-012: Dual-Base Currency
- **Source:** MIGRATION_MAP.md (D-5)
- **Question:** Support legacy B1/B2 dual-base or single base + reporting currency?
- **Confidence:** HIGH — Already decided
- **Resolution:** Single base + reporting currency (confirmed in prior decisions)

### OQ-013: What Business Rules in RActions Must Be Replicated?
- **Source:** MIGRATION_MAP.md (OQ-MG3), CODE_REQUIREMENTS.md
- **Question:** Of the 723 RAction files, which rules are UK-relevant?
- **Impact:** Business rule coverage currently at ~20%
- **Confidence:** MEDIUM — 14 key entities already extracted (300+ rules)
- **Resolution Path:** Prioritize by module, implement rules for 5 core modules first

### OQ-014: Bank Statement Import Formats
- **Source:** API_INVENTORY.md (OQ-API2)
- **Question:** What bank statement formats must be supported for UK market?
- **Confidence:** HIGH
- **Recommendation:** OFX (primary), CSV (common), MT940 (corporate), CAMT.053 (future-proofing)

### OQ-015: BACS File Format Specification
- **Source:** API_INVENTORY.md (OQ-API3)
- **Question:** What exact BACS format specifications are in BankEng*.hal?
- **Resolution Path:** Analyze `hal/Exports/BankEng*.hal` files
- **Impact:** Required for UK supplier payment processing

### OQ-016: Report Export Formats
- **Source:** DIFF_AND_GAPS.md
- **Question:** What export formats are needed for reports (PDF, CSV, Excel)?
- **Confidence:** HIGH — Standard requirement
- **Recommendation:** PDF (primary), CSV (data export), Excel (nice-to-have)

### OQ-017: Exact Enum Values for Status Fields
- **Source:** DATA_MODEL.md (OQ-D4)
- **Question:** What are the exact enum values for M4Set status fields across entities?
- **Impact:** Needed for status machine mapping
- **Resolution Path:** Parse `amaster/haldefs.h` Set definitions (228K file)

### OQ-018: StandardERP Feature Scope
- **Source:** DATA_MODEL.md (OQ-D7), UI_MAP.md (OQ-UI4)
- **Question:** Which of the 1,055 entities are used by StandardERP vs other products?
- **Impact:** Scoping — not all entities are in scope
- **Resolution Path:** Analyze `english/sku.hal` (139K) and `english/StandardERP/` config

### OQ-019: Payment Gateway Requirements
- **Source:** API_INVENTORY.md (OQ-API4)
- **Question:** Which payment gateways are needed for UK market beyond Stripe?
- **Confidence:** MEDIUM
- **Recommendation:** Stripe (primary), GoCardless (direct debit), Open Banking (future)

### OQ-020: Number Series/Sequence Rules
- **Source:** MANUAL_EXTRACT.md (OQ-M6)
- **Question:** What are the exact number series rules for invoices, POs, etc.?
- **Impact:** Current system uses timestamps; legacy uses configurable sequences
- **Resolution Path:** Review `NumberSeries` documentation in manual
- **Recommendation:** Implement configurable number series (prefix + sequential counter)

---

## 4. P2 — Nice to Know (Can resolve during implementation)

### OQ-021: Legacy Report Parameters
- **Source:** MIGRATION_MAP.md (OQ-MG4), UI_MAP.md (OQ-UI3)
- **Question:** What are the detailed parameters and outputs for the 743 reports?
- **Resolution Path:** Deep-dive into `hal/Reports/` when building specific reports

### OQ-022: Export/Import Formats for UK
- **Source:** MIGRATION_MAP.md (OQ-MG5)
- **Question:** What export/import formats beyond BACS are needed for UK?
- **Resolution Path:** UK regulatory review (HMRC, Companies House)

### OQ-023: Complete Validation Rules Per Field
- **Source:** MANUAL_EXTRACT.md (OQ-M2)
- **Question:** What are the complete field-level validation rules?
- **Resolution Path:** Deep-dive into field-level help pages on hansamanuals.com

### OQ-024: Full Permission Model Per Register
- **Source:** MANUAL_EXTRACT.md (OQ-M3)
- **Question:** What is the complete permission model per register/action?
- **Resolution Path:** Access Groups configuration pages on hansamanuals.com

### OQ-025: Window Layout Details
- **Source:** UI_MAP.md (OQ-UI1)
- **Question:** What are the exact window layouts for core registers?
- **Resolution Path:** Parse `english/allwindows.hal` (6MB)

### OQ-026: Which WActions Contain Business Logic vs UI Logic?
- **Source:** UI_MAP.md (OQ-UI2)
- **Question:** Of 552 WAction files, which have rules to replicate vs pure UI handlers?
- **Resolution Path:** Cross-reference WActions with RActions

### OQ-027: Complete Settings Per Module
- **Source:** MANUAL_EXTRACT.md (OQ-M5)
- **Question:** What are all Settings per module?
- **Resolution Path:** Settings sub-pages per module on hansamanuals.com

### OQ-028: Webhook/Callback Mechanisms
- **Source:** API_INVENTORY.md (OQ-API5)
- **Question:** What webhook/callback mechanisms does HansaWorld support?
- **Resolution Path:** Server.hal analysis

### OQ-029: Bank Export/Import File Formats
- **Source:** MANUAL_EXTRACT.md (OQ-M7)
- **Question:** What are the exact bank file format specifications per country?
- **Resolution Path:** Export/Import sub-pages per country on hansamanuals.com

### OQ-030: User Navigation Patterns
- **Source:** UI_MAP.md (OQ-UI5)
- **Question:** What keyboard shortcuts and navigation patterns do users rely on?
- **Resolution Path:** Manual → Working Environment section, user interviews

---

## 5. Resolution Tracking

| OQ | Status | Resolved Date | Resolution Summary |
|----|--------|--------------|-------------------|
| OQ-001 | OPEN | — | — |
| OQ-002 | OPEN | — | — |
| OQ-003 | OPEN | — | — |
| OQ-004 | OPEN | — | — |
| OQ-005 | OPEN | — | — |
| OQ-006 | OPEN | — | — |
| OQ-007 | OPEN | — | — |
| OQ-008 | OPEN | — | — |
| OQ-009 | OPEN | — | — |
| OQ-010 | OPEN | — | — |
| OQ-011 | OPEN | — | — |
| OQ-012 | **RESOLVED** | 2026-02-15 | Single base + reporting currency (from prior decisions) |
| OQ-013 | PARTIAL | — | 14 key entities extracted (300+ rules). Remaining 709 RAction files unanalyzed. |
| OQ-014 | OPEN | — | — |
| OQ-015 | OPEN | — | — |
| OQ-016 | OPEN | — | — |
| OQ-017 | OPEN | — | — |
| OQ-018 | OPEN | — | — |
| OQ-019 | OPEN | — | — |
| OQ-020 | OPEN | — | — |
| OQ-021-030 | OPEN | — | — |

---

*This is a living document. Update status as questions are resolved.*
*Cross-references: Every spec-pack document contributes questions; see individual OQ sections in each document.*
