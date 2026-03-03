# Validation Report

**Validated By:** Claude Opus 4.6
**Validation Date:** 2026-02-16
**Last Updated:** 2026-02-16 (FR alignment fix applied)
**Sources Checked:** PRD v1 (prd.md), Architecture sections 2.13-2.30 (arch-sections/), API Contracts v1.0 (this document)
**Overall Assessment:** PASS with WARNINGS

---

## Check 1: FR Coverage (FR1-FR157)

**Result: PASS**

All 157 FRs (FR1-FR157) are present in the Section 4 FR-to-Endpoint Mapping table. Every FR has at least one mapped endpoint.

**FR Count Verification:**
- PRD defines: FR1-FR157 (157 FRs) -- confirmed all sequential
- Section 4 maps: FR1-FR157 (157 entries) -- confirmed complete

## Check 1b: FR Semantic Alignment

**Result: PASS (FIXED)**

Previously, the Section 4 mapping table used FR descriptions inconsistent with the PRD definitions (~120 mismatches). This was corrected on 2026-02-16. All FR numbers in Sections 2 and 4 now match the PRD's authoritative FR definitions. Section 3 detailed endpoint specs have also been updated.

**Known gaps (no PRD FR):**
- Fixed Assets: Architecture Section 2.18 defines fixed asset endpoints but the PRD has no FRs for fixed assets (FR numbers in Section 2.19 marked as "---")
- FR93 (GDPR compliance): No dedicated API endpoint yet
- FR115 (Quality inspections): No dedicated API endpoint yet
- FR77 (VAT returns for MTD): Covered by FR91 endpoints

**HISTORICAL NOTE (pre-fix mismatch details removed):** The original Section 4 had ~120 FR description mismatches. All were corrected on 2026-02-16. The original mismatch tables have been removed since they are no longer relevant.


## Check 2: Endpoint Consistency with Architecture Data Models

**Result: PASS with WARNINGS**

Spot-checked 15 endpoints against arch-section Prisma models:

| Endpoint | Arch Section | Model | Result |
|----------|-------------|-------|--------|
| `CRUD /finance/chart-of-accounts` | 2.13 | `ChartOfAccount` | PASS |
| `CRUD /finance/journal-entries` | 2.13 | `JournalEntry` + `JournalLine` | PASS |
| `CRUD /finance/bank-accounts` | 2.13 | `BankAccount` | PASS |
| `CRUD /finance/budgets` | 2.13 | `Budget` + `BudgetLine` | PASS |
| `CRUD /ar/customers` | 2.15 | `Customer` | PASS |
| `CRUD /ar/invoices` | 2.15 | `CustomerInvoice` | PASS |
| `CRUD /ar/payments` | 2.15 | `CustomerPayment` | PASS |
| `CRUD /ap/suppliers` | 2.17 | `Supplier` | PASS |
| `CRUD /ap/purchase-orders` | 2.17 | `PurchaseOrder` | PASS |
| `CRUD /sales/quotes` | 2.16 | `SalesQuote` | PASS |
| `CRUD /sales/orders` | 2.16 | `SalesOrder` | PASS |
| `CRUD /inventory/items` | 2.14 | `InventoryItem` | PASS |
| `CRUD /crm/leads` | 2.21 | `CrmLead` | PASS |
| `CRUD /hr/employees` | 2.22 | `Employee` | PASS |
| `CRUD /production/recipes` | 2.23 | `Recipe` + `RecipeLine` | PASS |

All 15 spot-checked endpoints have corresponding Prisma models in the architecture. CRUD operations align with model capabilities.

**Warning -- Missing CRUD endpoints for architecture models:**
- `AccountClassification` model (2.13) has `CRUD /finance/account-classifications` -- covered
- `AccountMapping` model (2.13) has `CRUD /finance/account-mappings` -- covered
- `BankReconciliationLine` model (2.13) -- no direct endpoint; managed through parent reconciliation -- acceptable
- `PaymentAllocation` model (2.15) -- managed through `POST /ar/payments/:id/allocate` -- covered

---

## Check 3: RBAC Consistency

**Result: PASS with WARNINGS**

The RBAC hierarchy (SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER) is applied consistently across endpoints with the following observations:

**Consistent patterns observed:**
- All GET/list endpoints: VIEWER minimum -- PASS
- All POST (create) endpoints: STAFF minimum -- PASS
- All PATCH (update) endpoints: STAFF minimum -- PASS
- All DELETE endpoints: MANAGER minimum -- PASS (with 4 exceptions below)
- All approve/post state transitions: MANAGER minimum -- PASS
- All admin configuration: ADMIN minimum -- PASS

**RBAC deviations (4 STAFF-level DELETE operations):**

| Endpoint | Current Role | Expected Role | Risk |
|----------|-------------|---------------|------|
| `DELETE /views/:id` | STAFF | MANAGER | LOW -- users deleting own saved views |
| `DELETE /crm/campaigns/:id/recipients/:recipientId` | STAFF | MANAGER | LOW -- managing campaign lists |
| `DELETE /chat/channels/:id/messages/:msgId` | STAFF | MANAGER | LOW -- soft-delete own messages |
| `DELETE /email/messages/:id` | STAFF | MANAGER | LOW -- archive/delete own emails |

These deviate from the stated standard CRUD pattern (Section 1) which requires MANAGER for DELETE. However, all four cases involve personal or low-risk data where STAFF-level delete is arguably appropriate. Document should either update the standard CRUD pattern to note these exceptions or elevate to MANAGER.

**VIEWER-level POST operations (4 cases):**

| Endpoint | Min Role | Justification |
|----------|----------|---------------|
| `POST /ai/explain` | VIEWER | Read-like query (explain AI decision) |
| `POST /production/recipes/:id/explode` | VIEWER | Read-like calculation (BOM explosion) |
| `POST /reports/generate` | VIEWER | Read-like (report generation) |
| `POST /reports/export` | VIEWER | Read-like (report export) |

These use POST for computational read operations. This is RESTful but deviates from the CRUD pattern which associates POST with STAFF minimum. Acceptable as documented exceptions.

---

## Check 4: Naming Convention

**Result: PASS with WARNINGS**

The stated convention is `/api/v1/{module}/{entity}`. Most endpoints follow this pattern correctly.

**Compliant patterns:**
- `/system/*`, `/finance/*`, `/ar/*`, `/ap/*`, `/sales/*`, `/purchasing/*`, `/inventory/*`, `/pricing/*`, `/crm/*`, `/hr/*`, `/production/*`, `/reports/*`, `/assets/*`, `/pos/*`, `/projects/*`, `/contracts/*`, `/warehouse/*`, `/intercompany/*`, `/consolidation/*`, `/service/*`, `/timekeeper/*` -- all follow `/{module}/{entity}` convention

**Deviations from `/{module}/{entity}` convention (cross-cutting endpoints):**

| Path Pattern | Issue | Recommendation |
|-------------|-------|----------------|
| `/auth/*` | No module prefix | Acceptable -- auth is a platform concern |
| `/views/*` | No module prefix | Consider `/system/views` for consistency |
| `/document-templates` | No module prefix, hyphenated | Consider `/system/document-templates` |
| `/documents/*` | No module prefix | Consider `/system/documents` |
| `/attachments/*` | No module prefix | Consider `/system/attachments` or `/cross-cutting/attachments` |
| `/notes/*` | No module prefix | Consider `/system/notes` |
| `/record-links/*` | No module prefix | Consider `/system/record-links` |
| `/approval-rules/*`, `/approval-requests/*` | No module prefix | Consider `/system/approval-rules` |
| `/activities/*` | No module prefix | Consider `/system/activities` |
| `/ai/*` | No module prefix | Acceptable -- AI is a platform concern |
| `/chat/*` | No module prefix | Consider `/communications/chat` |
| `/email/*` | No module prefix | Consider `/communications/email` |
| `/conference/*` | No module prefix | Consider `/communications/conference` |
| `/notifications` | No module prefix | Consider `/system/notifications` |

The cross-cutting endpoints (14 paths) do not follow the `/{module}/{entity}` convention. While functionally correct, this creates an inconsistency where some paths have a module prefix and some do not. The Communications module is split across three top-level paths (`/chat`, `/email`, `/conference`) rather than grouped under `/communications/`.

---

## Check 5: TypeScript Interface Accuracy

**Result: PASS (1 warning fixed)**

Spot-checked 5 detailed endpoint specs in Section 3 against architecture Prisma models:

**1. POST /auth/login (Section 3.1) -- PASS**
- `LoginResponse.user.role` enum matches RBAC table exactly
- `enabledModules[]` matches architecture's module-gating pattern
- `requiresMfa` field aligns with MFA flow

**2. POST /finance/journal-entries/:id/post (Section 3.2) -- PASS**
- `JournalEntry` interface fields align with Prisma `JournalEntry` model (2.13)
- `JournalLine` interface fields align with Prisma `JournalLine` model
- `JournalSource` enum values are a subset of the Prisma enum (correct for response)
- Decimal fields correctly typed as `string` per data conventions

**3. POST /ar/invoices/:id/post (Section 3.3) -- PASS (FIXED)**
- `CustomerInvoice.invoiceType` corrected to match Prisma `InvoiceType` enum: `STANDARD | CASH | CREDIT_NOTE | DEBIT_NOTE | PROFORMA`
- Previously had `SELF_BILLING` (not in Prisma) and was missing `CASH` -- fixed on 2026-02-16
- All other fields align correctly

**4. POST /sales/quotes/:id/convert-to-order (Section 3.5) -- PASS**
- `SalesOrder` interface fields align with Prisma `SalesOrder` model (2.16)
- `quoteId` back-reference is present in both interface and Prisma model

**5. POST /hr/payroll-runs/:id/calculate (Section 3.8) -- PASS**
- `PayrollCalculationResult` fields align with Prisma `PayrollRun` + `PayrollLine` models (2.22)
- `frequency` enum values match Prisma `PayrollFrequency` enum
- Tax calculation fields (PAYE, NI, student loan, pension) match architecture design

---

## Check 6: Module Completeness

**Result: PASS**

All 18 architecture sections (2.13-2.30) have corresponding endpoint groups in Section 2:

| Arch Section | Arch Module | API Section(s) | Status |
|-------------|-------------|----------------|--------|
| 2.13 | Finance GL, Banking & Budgets | 2.7 Finance & GL, 2.8 VAT & Compliance | COVERED |
| 2.14 | Inventory | 2.13 Inventory & Stock | COVERED |
| 2.15 | Sales Ledger AR | 2.9 Accounts Receivable | COVERED |
| 2.16 | Sales Orders | 2.11 Sales Management | COVERED |
| 2.17 | Purchasing & AP | 2.10 Accounts Payable, 2.12 Purchasing | COVERED |
| 2.18 | Fixed Assets | 2.19 Fixed Assets | COVERED |
| 2.19 | Pricing | 2.14 Pricing | COVERED |
| 2.20 | Cross-cutting | 2.2 System, 2.3 Views, 2.4 Doc Templates, 2.5 Cross-cutting | COVERED |
| 2.21 | CRM | 2.15 CRM | COVERED |
| 2.22 | HR & Payroll | 2.16 HR & Payroll | COVERED |
| 2.23 | Production & MRP | 2.17 Manufacturing & Production | COVERED |
| 2.24 | POS | 2.20 POS | COVERED |
| 2.25 | Projects & Job Costing | 2.21 Projects & Job Costing | COVERED |
| 2.26 | Contracts & Agreements | 2.22 Contracts & Agreements | COVERED |
| 2.27 | Warehouse Management | 2.23 Warehouse Management | COVERED |
| 2.28 | Intercompany & Consolidation | 2.24 Intercompany & Consolidation | COVERED |
| 2.29 | Communications | 2.25 Communications | COVERED |
| 2.30 | Service Orders & Timekeeper | 2.26 Service Orders & Timekeeper | COVERED |

---

## Check 7: Missing API Coverage for PRD Requirements

**Result: PASS with WARNINGS (2 of 3 gaps fixed)**

| PRD FR | Requirement | Status |
|--------|-------------|--------|
| FR8 | Fall back to traditional form-based interfaces | No gap -- all CRUD endpoints serve this; purely a UX/frontend concern |
| FR32 | Ingest supplier bills via email/OCR | FIXED -- `POST /ap/supplier-bills/import-ocr` added |
| FR87 | Import data (customers, suppliers, items, opening balances) from CSV | Partial -- import endpoints exist for items, employees, leads, supplier catalogues; customer/supplier/opening balance CSV import still needed |
| FR88 | Manage backup and restore operations | FIXED -- `POST /system/backups`, `GET /system/backups`, `POST /system/backups/:id/restore` added |
| FR93 | GDPR compliance (data export/deletion) | Missing -- no dedicated GDPR API endpoints yet |
| FR115 | Quality inspections at operation level | Missing -- no dedicated quality inspection endpoints yet |
| FR121 | POS offline mode and auto-sync | FIXED -- `POST /pos/sync` added |

---

## Summary of Findings

| Check | Result | Critical Issues |
|-------|--------|-----------------|
| 1. FR Coverage (count) | PASS | All 157 FRs present in Section 4 |
| 1b. FR Semantic Alignment | PASS (FIXED) | All FR descriptions now match PRD definitions |
| 2. Endpoint-Model Consistency | PASS | All 15 spot-checked endpoints have matching Prisma models |
| 3. RBAC Consistency | PASS (warnings) | 4 STAFF-level DELETEs deviate from stated pattern; 4 VIEWER-level POSTs |
| 4. Naming Convention | PASS (warnings) | 14 cross-cutting paths lack module prefix; Communications split across 3 paths |
| 5. TypeScript Interfaces | PASS (FIXED) | InvoiceType enum corrected to match Prisma schema |
| 6. Module Completeness | PASS | All 18 arch sections mapped to endpoint groups |
| 7. Missing API Coverage | PASS (warnings) | FR32/FR88/FR121 endpoints added; FR87 partial; FR93/FR115 still missing |

## Overall Assessment: PASS with WARNINGS

The API Contracts Reference is structurally comprehensive and technically sound. All 18 architecture modules are covered. Endpoint designs are well-considered with proper CRUD patterns, state transitions, and reporting endpoints. TypeScript interfaces align with Prisma models. RBAC is consistently applied with minor documented exceptions.

**Fixes applied on 2026-02-16:**
1. **P0 (FIXED):** All FR numbers in Sections 2, 3, and 4 realigned to match PRD FR definitions exactly
2. **P1 (FIXED):** `InvoiceType` enum in Section 3.3 corrected (removed `SELF_BILLING`, added `CASH`)
3. **P1 (FIXED):** Missing endpoints added: FR32 (`POST /ap/supplier-bills/import-ocr`), FR88 (backup/restore), FR121 (`POST /pos/sync`)
4. **Note:** Fixed Assets endpoints (Section 2.19) have no PRD FRs -- marked with "---" until PRD is updated

**Remaining items:**
1. **P3 (Low):** Decide on cross-cutting endpoint naming convention and STAFF DELETE policy
2. **P3 (Low):** Add dedicated endpoints for FR93 (GDPR) and FR115 (quality inspections) when those modules are designed

---
