# Nexa ERP Business Rules Extraction -- Contradictions & Inconsistencies Report

> **Source Document:** `nexa-erp-business-rules-requirements.md` (9,455 lines, 8 sections)
> **Generated:** 2026-02-03
> **Purpose:** Exhaustive cross-reference analysis identifying all contradictions, duplications, and inconsistencies within the extraction document. This report must be resolved before using the extraction as a PRD foundation.

---

## 1. Executive Summary

This report identifies **72 distinct issues** across 6 categories found in the Nexa ERP Business Rules & Requirements Extraction document. The issues range from entity definitions that directly contradict each other across sections, to duplicate API endpoints that would create ambiguity for developers, to terminology inconsistencies that would propagate confusion into the new project.

**Issue counts by category:**

| Category | Count | Severity |
|----------|-------|----------|
| Entity Contradictions | 14 | High |
| Duplicate API Endpoints | 12 | High |
| Conflicting Business Rules | 16 | Critical |
| Duplicate Content | 10 | Medium |
| Inconsistent Terminology | 11 | Medium |
| Cross-Module Reference Integrity | 9 | High |
| **Total** | **72** | |

**Critical items requiring resolution before PRD creation:**
1. Customer `code` uniqueness constraint contradicts across Sections 1.1.1 and 3.10.1
2. Supplier `code` uniqueness constraint contradicts across Sections 1.2.1 and 3.12.1
3. PurchaseOrder status lifecycle is fundamentally different across Sections 1.2.2 and 3.12.5
4. Role normalization maps unknown roles to different defaults (VIEWER vs STAFF)
5. Pipeline stages differ between DB-backed and file-based implementations
6. Dual period close mechanisms with no documented precedence

---

## 2. Entity Contradictions

Issues where the same entity is defined differently in different sections.

### EC-1: Customer `code` Uniqueness Constraint

| Attribute | Section 1.1.1 (AR) | Section 3.10.1 (CRM) |
|-----------|--------------------|-----------------------|
| `code` constraint | "Unique per tenant" (line 77) | "Unique (global)" (line 3426) |
| Business rule | "Customer code must be unique within tenant" (line 91) | Unique constraint column in table shows "Unique (global)" |

**Impact:** If the new project follows Section 3.10.1, a customer code created by Tenant A would block Tenant B from using the same code. Section 1.1.1 is correct for a multi-tenant system -- codes should be unique per tenant, not globally.

**Resolution:** Adopt Section 1.1.1 semantics (unique per tenant). The indexes in Section 3.10.1 actually support this (line 3446: `[tenantId, code]` composite index), contradicting its own "Unique (global)" column declaration.

---

### EC-2: Supplier `code` Uniqueness Constraint

| Attribute | Section 1.2.1 (AP) | Section 3.12.1 (Purchasing) |
|-----------|--------------------|-----------------------------|
| `code` constraint | "Unique" + "Case-insensitive" (line 412) | "Unique (global)" (line 3780) |
| Business rule | "Code unique per tenant, trimmed, case-insensitive" (line 420) | "Supplier code must be unique globally" (line 3799) |

**Impact:** Same issue as EC-1. Section 1.2.1 says per-tenant with case-insensitive matching. Section 3.12.1 says globally unique. Both reference the same Prisma model.

**Resolution:** The Prisma schema likely has `@unique` on `code` (global), but Section 1.2.1 notes it is enforced per-tenant at the application level. The new project should use a composite unique constraint `@@unique([tenantId, code])`. Also note that Section 3.12.1 indexes (line 3794-3795) only include `[tenantId]`, not `[tenantId, code]` -- another inconsistency.

---

### EC-3: Customer `status` Field Typing

| Attribute | Section 1.1.1 (AR) | Section 3.10.1 (CRM) |
|-----------|--------------------|-----------------------|
| `status` type | "Enum" with values ACTIVE, INACTIVE (line 83) | "CustomerStatus" Enum with values ACTIVE, INACTIVE (line 3432) |
| Required | "No" with default ACTIVE (line 83) | "Yes" with default ACTIVE (line 3432) |
| `termsDays` required | "No" with default 30 (line 82) | "Yes" with default 30 (line 3431) |

**Impact:** Minor typing difference but the Required column disagrees. Section 1.1.1 says `status` is not required (defaulted), while Section 3.10.1 says it is required. Same for `termsDays`.

**Resolution:** Both have defaults, so the distinction is semantic. Standardize on "Yes (default: ACTIVE)" to be explicit.

---

### EC-4: Supplier Entity Field Differences

| Attribute | Section 1.2.1 (AP) | Section 3.12.1 (Purchasing) |
|-----------|--------------------|-----------------------------|
| Address field | Listed as SCHEMA-GAP (line 436) | Not mentioned at all |
| Status field | Listed as SCHEMA-GAP (line 435) | Not listed; enable/disable via JSON (line 3800) |
| Relations | Not listed | Lists PurchaseOrder[], SupplierBill[], SupplierPayment[], SupplierCreditNote[], SupplierPaymentRunLine[] |
| Delete endpoint | Listed at line 432 | Not mentioned |
| Case-insensitive code | Yes (line 412, 420) | Not mentioned |

**Impact:** The two sections describe the same Prisma model but with different levels of detail and different emphasis. Section 1.2.1 has richer business rule coverage; Section 3.12.1 has richer relation coverage.

**Resolution:** Merge into a single canonical Supplier definition. Keep case-insensitive code matching from Section 1.2.1 and relations from Section 3.12.1.

---

### EC-5: PurchaseOrder Status Enum

| Attribute | Section 1.2.2 (AP) | Section 3.12.3 (Purchasing) |
|-----------|--------------------|-----------------------------|
| Status values | draft, approved, sent, received, closed, cancelled (line 458) | draft, approved, sent, received, closed, cancelled (line 3816) |
| Status lifecycle | `draft -> approved -> sent -> received -> closed; cancelled from any state` (lines 480-481) | `draft -> sent -> closed; cancelled maps to closed` (lines 3843-3852) |
| Approved state | Used in lifecycle (line 480) | Exists in enum but "no transition logic" (line 3855) |
| Cancel behavior | Sets status to "cancelled" (implied by lifecycle) | Sets status to "closed" (line 3852) |

**Impact:** Critical. The same entity has two fundamentally different lifecycle definitions. Section 1.2.2 includes an `approved` step; Section 3.12.5 skips it entirely. Cancellation behavior contradicts directly: one produces "cancelled" status, the other produces "closed" status.

**Resolution:** Must decide on a single canonical PO lifecycle. The `approved` state makes business sense (approval before sending to supplier). The cancel action should set status to "cancelled" not "closed". Recommend: `draft -> approved -> sent -> received -> closed; cancelled from draft/approved/sent`.

---

### EC-6: PurchaseOrder API Endpoints

| Section 1.2.2 (AP) | Section 3.12.3 (Purchasing) |
|--------------------|-----------------------------|
| `POST /api/purchasing/purchase-orders/` -- Create | No create endpoint listed |
| `POST /api/purchasing/po/approve/` -- Approve | No approve endpoint listed |
| `POST /api/purchasing/purchase-orders/[poId]/issue` -- Issue | No issue endpoint listed |
| No cancel endpoint | `cancelPurchaseOrder()` function exists but no API route |

**Impact:** Section 1.2.2 documents API routes; Section 3.12.5 documents server-side functions without API routes. This suggests two different code paths managing the same entity.

**Resolution:** Consolidate. The API routes from Section 1.2.2 should be the canonical REST interface.

---

### EC-7: Reservation Entity Duplication

| Attribute | Section 2.7.1 (Inventory) | Section 3.6.4 (Sales) |
|-----------|--------------------------|------------------------|
| Location | Lines 2151-2164 | Lines 3207-3220 |

Both sections define the exact same Reservation entity with identical fields, types, defaults, constraints, and indexes. This is a pure duplication.

**Impact:** A reader might wonder if these are two different entities or the same one described twice. Both sections flag it as having no implementation.

**Resolution:** Define Reservation once in a shared section or in the Inventory module (Section 2) with a cross-reference from Sales (Section 3).

---

### EC-8: CrmOpportunity Duplicate Fields

**Section 3.4.1 (line 2903-2909):**
- `value` (Decimal, optional, null) AND `amount` (Decimal, optional, 0) -- both represent deal value
- `expectedCloseDate` (DateTime, optional, null) AND `closeDate` (DateTime, optional, null) -- both represent expected close

**Section 3.4.7 (line 3024):**
> "Duplicate value/amount and expectedCloseDate/closeDate fields exist for compatibility."

**Impact:** Two fields for the same concept in the same entity. `value` defaults to null; `amount` defaults to 0. Code that reads `value` will get null for new records; code that reads `amount` will get 0. These are not interchangeable.

**Resolution:** Pick one field per concept. Recommend `value` for deal value and `expectedCloseDate` for expected close. Remove `amount` and `closeDate` aliases in new project.

---

### EC-9: Customer Entity Relations Differences

| Attribute | Section 1.1.1 (AR) | Section 3.10.1 (CRM) |
|-----------|--------------------|-----------------------|
| Relations listed | invoices, creditNotes, payments, quotes, orders, posSales (line 88) | invoices, creditNotes, payments, quotes, orders, posSales (lines 3438-3443) |

Relations are identical, but Section 3.10.1 additionally documents the auto-creation bridge (line 3449): `resolveCustomerId()` auto-creates Customer from CrmAccount with code pattern `CRM-{tenantId}-{accountCode}`. This important business rule is absent from Section 1.1.1.

**Resolution:** Add the auto-creation bridge rule to the canonical Customer definition.

---

### EC-10: InventoryItem Dual Creation Schemas

**Section 2.1.5 (lines 1274-1275):**
- **Legacy schema**: `{ sku, name?, description?, category?, unitOfMeasure?, type?: "stock" | "non_stock" }`
- **Service schema**: `{ tenantId?, sku, name?, description?, category?, unitOfMeasure?, isService?, trackBatch?, trackSerial?, qtyOnHand, warehouseId?, locationId? }`

**Impact:** Two different API schemas for creating the same entity. The `type` field (stock/non_stock) in the legacy schema maps to `isService` boolean in the service schema, but the mapping is not documented. A service item in legacy (`type: "non_stock"`) should presumably map to `isService: true`, but this is never stated.

**Resolution:** Consolidate into single creation schema. Document the type-to-isService mapping explicitly.

---

### EC-11: Warehouse `code` Uniqueness

**Section 2.3.1 (via SC-39, line 8849):**
> "`@unique` on code means global uniqueness, not per-tenant."

**Section 2.3.3 (Warehouse entity documentation):**
The warehouse code is described as unique, but Section 8 flags this as a shortcut (SC-39) since it should be per-tenant.

**Impact:** Same issue as Customer/Supplier codes. Global uniqueness in a multi-tenant system prevents different tenants from using the same warehouse code (e.g., "MAIN").

**Resolution:** Use composite unique constraint `@@unique([tenantId, code])`.

---

### EC-12: Employee Entity -- Minimal Schema vs Operational Reality

**Section 4.1.1 (Employee entity):**
The schema has only: id, tenantId, code, email, name, encryptedPii, metadata (JSON). All operational fields (status, departmentId, jobTitle, managerId, startDate, employmentType, payFrequency, basePay) are in the JSON `metadata` blob.

**Section 4.2.5 (Department linkage):**
UserDepartment links Users to Departments, but there is no EmployeeDepartment table. Employee's department is free-text in JSON metadata.

**Impact:** The Employee entity schema and its operational usage are fundamentally misaligned. The schema cannot support queries like "list all employees in department X" without scanning JSON.

**Resolution:** Promote all operational fields from JSON metadata to proper schema columns with FKs and indexes.

---

### EC-13: TenantConfig as Dual-Purpose Entity

**Section 7.1.5 (TenantConfig):**
Documents the `config` JSON field as a catch-all bag storing: finance settings, inventory settings, purchasing settings, HR settings, CRM settings, compliance settings, AI config, and more.

**Multiple sections reference TenantConfig for different data:**
- Period close state (Section 1.7)
- VAT returns (Section 1.5.1)
- Disabled suppliers (Section 3.12.2)
- Disabled warehouses (Section 2.3.3)
- Disabled items (Section 2.1.5)
- Leave balances (Section 4.3)
- Payroll data (Section 4.5)
- Replenishment rules (Section 2.10)
- RFQs (Section 3.12.8)
- POS registers (Section 3.11)
- Report schedules (Section 5.5)

**Impact:** TenantConfig is used as a dumping ground for data that should have proper relational tables. Different sections treat it as authoritative for different data, creating a massive single point of failure and making concurrent updates dangerous.

**Resolution:** As documented in R-107 (Section 8), break TenantConfig into dedicated tables. Each section's reliance on TenantConfig JSON should be migrated to proper models.

---

### EC-14: Bill Status Type Inconsistency

**Section 1.2.3 (Supplier Bill, line 8811):**
> "Status is String not Enum -- allows invalid states."

**Section 1.2.2 (PurchaseOrder, line 458):**
Status is `PoStatus (Enum)` with defined values.

**Impact:** Within the same AP module, PurchaseOrder uses a proper enum for status while SupplierBill uses a plain string. This inconsistency means bill status has no database-level validation.

**Resolution:** Use enums for all status fields across all entities.

---

## 3. Duplicate API Endpoints

API paths that appear to serve the same or overlapping purposes.

### DE-1: Invoice Create -- Two Endpoints

| Endpoint | Section | Format | Notes |
|----------|---------|--------|-------|
| `POST /api/finance/ar/invoice/create` | 1.1.2 (line 217) | Minor units (pence) | Singular path |
| `POST /api/finance/ar/invoices` (POST) | 1.1.2 (line 218) | Major units (pounds) | Plural path |

**Impact:** Two endpoints creating the same entity with different monetary unit conventions. Developers must know which to use. Both are marked `[COMPLETE]`.

---

### DE-2: Bill Create -- Two Endpoints

| Endpoint | Section | Notes |
|----------|---------|-------|
| `POST /api/finance/ap/bill/create` | Referenced in SC-10 (line 8814) | Singular path |
| `POST /api/finance/ap/bills/` | Referenced in SC-10 (line 8814) | Plural path, different schema |

**Impact:** Same issue as DE-1 but for supplier bills.

---

### DE-3: AR Payment/Receipt -- Four Endpoints

| Endpoint | Section | Notes |
|----------|---------|-------|
| `POST /api/finance/ar/invoice/pay` | 1.1.3 (line 276) | Pay specific invoice, minor units |
| `POST /api/finance/ar/receipts/create` | 1.1.3 (line 277) | Record receipt, minor units |
| `POST /api/finance/ar/receipts` (POST) | 1.1.3 (line 278) | Multi-invoice allocation |
| `POST /api/finance/ar/receipt/record` | 1.1.3 (line 279) | Alternative receipt recording |

**Impact:** Four endpoints for essentially the same operation (recording customer payments). Different schemas, different naming conventions (singular/plural), different capabilities.

---

### DE-4: AP Payment -- Two Endpoints

| Endpoint | Section | Notes |
|----------|---------|-------|
| `POST /api/finance/ap/payment/record` | Referenced in SC-14 (line 8818) | Singular path |
| `POST /api/finance/ap/payments/create` | Referenced in SC-14 (line 8818) | Plural path |

---

### DE-5: Inventory Item Create -- Two Endpoints

| Endpoint | Section | Notes |
|----------|---------|-------|
| `POST /api/inventory/items` | Section 2.1.5 | Standard create |
| `POST /api/inventory/items/create` | Section 2.1.5 (SC-32, line 8842) | Separate code path |

**Impact:** Two creation endpoints with different validation schemas and code paths.

---

### DE-6: AP Aging -- Spelling Variant Endpoints

| Endpoint | Section | Notes |
|----------|---------|-------|
| `/api/finance/ap/aging/` | 1.2.7 (line 643) | American spelling |
| `/api/finance/ap/ageing/` | 1.2.7 (line 671) | British spelling |

**Impact:** Both endpoints exist and return the same data. Creates confusion about canonical URL.

---

### DE-7: WMS Shipment Systems -- Parallel Paths

| System | Section | Path Pattern | Storage |
|--------|---------|-------------|---------|
| Database-backed WMS | 2.3 | `/api/wms/shipments/` | Prisma models (Shipment, ShipmentLine) |
| File-based WMS | 2.3.12 | `/api/inventory/wms/shipping/` | File system JSON |

**Impact:** Two completely separate shipment systems with different code paths, storage mechanisms, and behavior (BG-14: pick behavior differs between them).

---

### DE-8: POS Summary Endpoints -- Seven Stubs

**Section 3.11.20 (ST-10, line 8650):**
Seven stub endpoints all returning mock data:
- `/api/pos/summary`
- `/api/pos/terminal/summary`
- `/api/pos/receipts/summary`
- `/api/pos/offline-sync/summary`
- `/api/pos/reconciliation/summary`
- `/api/pos/postings/summary`
- `/api/pos/reports/summary`

**Impact:** These exist in the routing table but return no real data. They could mislead developers into thinking POS functionality is operational.

---

### DE-9: Purchasing Summary Endpoints -- Four Stubs

**Section 3.12.10 (ST-11, line 8651):**
- `/api/purchasing/summary`
- `/api/purchasing/requisitions/summary`
- `/api/purchasing/orders/summary`
- `/api/purchasing/supplier-invoices/summary`

---

### DE-10: Customer Endpoints Across Modules

| Module | Path | Notes |
|--------|------|-------|
| AR (Finance) | `/api/finance/ar/customers` | Full CRUD (Section 1.1.1) |
| CRM | Auto-created via `resolveCustomerId()` | No direct API (Section 3.10, PA-14) |

**Impact:** Customers can be created via the AR module API but are also auto-created from CrmAccount data. No single source of truth for customer creation.

---

### DE-11: Supplier Endpoints Across Modules

| Module | Path | Notes |
|--------|------|-------|
| AP (Finance) | `/api/finance/ap/suppliers/` | Full CRUD including delete (Section 1.2.1) |
| Purchasing (CRM) | No REST routes wired (Section 3.12, PA-13) | Server functions only |

**Impact:** Supplier CRUD exists in the Finance module but the Purchasing module has no REST API -- only server-side functions. Same entity managed by two different code paths.

---

### DE-12: GL Posting Endpoints -- Legacy vs Modern

| System | Section | Notes |
|--------|---------|-------|
| Modern GL | `POST /api/finance/gl/post` (line 790) | Uses GlJournalEntry/GlJournalLine/GlAccount |
| Legacy GL | Section 1.3.3 (SC-20, line 8824) | Uses JournalLine/Account models |

**Impact:** Two GL systems coexist. Financial reports (P&L, Balance Sheet) use the legacy GL (SC-88, SC-89), while some modules post to the modern GL. This means financial reports may not reflect all posted transactions.

---

## 4. Conflicting Business Rules

Cases where two rules within the document directly contradict each other.

### CR-1: PO Cancel Behavior

| Source | Rule | Line |
|--------|------|------|
| Section 1.2.2 | Cancel transitions PO to "cancelled" status | 481 |
| Section 3.12.5 | `cancelPurchaseOrder()` sets status to "closed" instead of "cancelled" | 3852 |

**Impact:** Critical. The same operation produces different outcomes depending on which code path executes.

---

### CR-2: PO Lifecycle -- Approved State

| Source | Rule | Line |
|--------|------|------|
| Section 1.2.2 | Lifecycle includes `approved` between `draft` and `sent` | 480 |
| Section 3.12.5 | Lifecycle goes `draft -> sent` directly; `approved` state has "no transition logic" | 3843-3855 |

**Impact:** Is there a PO approval step or not? Section 1.2.2 has an explicit approve API endpoint (`POST /api/purchasing/po/approve/`). Section 3.12.5 has no approve function.

---

### CR-3: Role Normalization Default

| Source | Rule | Line |
|--------|------|------|
| Section 7.3.1 (matrix.ts) | Unknown roles normalize to `VIEWER` | 7542 |
| Section 7.3.1 (roles.ts) | Unknown roles normalize to `STAFF` | 7543 |

**Impact:** A user with an unrecognized role string gets different permissions depending on which normalization function is called. STAFF has more permissions than VIEWER in the RBAC matrix.

---

### CR-4: Pipeline Stage Names

| Source | Stages | Line |
|--------|--------|------|
| DB-backed (pipelines.ts) | lead -> qualified -> proposal -> negotiation -> won | 2953, 2965 |
| File-based (store) | prospect -> proposal -> negotiation -> won \| lost | 2960 |

**Impact:** The first stage differs ("lead" vs "prospect"), the DB-backed version includes "qualified", and the file-based version includes "lost" as a terminal state while the DB version does not list it in the stage sequence.

---

### CR-5: Period Close -- Dual Mechanisms

| Source | Mechanism | Storage | Line |
|--------|-----------|---------|------|
| Section 1.7 / 6.8.1 | `PeriodClose` table with per-ledger flags | Prisma model | 1083, 6213 |
| Section 1.7 / 6.8.2 | `TenantConfig.finance.close.lockedThrough` date | JSON blob | 6227 |

**Impact:** Two independent period close checks. A period could be "open" according to one mechanism but "closed" according to the other. Different code paths call different checks. No documented precedence.

---

### CR-6: Payroll GL Posting -- Dual Mechanisms

| Source | Mechanism | Line |
|--------|-----------|------|
| Section 4.5 (payroll-gl subscriber) | Event-driven: `hr.payroll.run.committed` triggers GL journal creation | 6501 |
| Section 4.5 (payroll service) | Direct call to GL posting within payroll service | 5179 |

**Impact:** Risk of double-posting. If both mechanisms fire for the same payroll run, GL entries are duplicated. SC-83 explicitly flags this (line 5179).

---

### CR-7: POS Tax Rate Interpretation

| Context | Treatment | Source |
|---------|-----------|--------|
| Invoice lines (Section 1.1.2) | `taxRate` is a decimal (e.g., 0.2 for 20%) | Line 183 |
| POS receipts.ts | `taxRate` treated as percentage in some calculations | SC referenced in summary |

**Impact:** If tax rate = 20 is passed where 0.2 is expected (or vice versa), tax calculations will be off by a factor of 100.

---

### CR-8: Aging Report Bucket Naming

| Source | Bucket Names | Line |
|--------|-------------|------|
| Dedicated ageing service | `current, 1-30, 31-60, 61-90, 91+` | 5624, 5645 |
| Report dispatcher | `0-30, 31-60, 61-90, 91+` | 5624 (SC-94) |

**Impact:** Two different naming conventions for the same concept. "current" vs "0-30" represent the same bucket but would produce different JSON keys, breaking any consumer expecting a specific format.

---

### CR-9: Invoice Status -- Draft to Issued Path

| Source | Path | Line |
|--------|------|------|
| Section 1.1.2 lifecycle | `draft -> approved -> issued -> paid` | 148-157 |
| Section 1.1.2 API | `POST /api/finance/ar/invoices/[id]/issue` -- "Issue invoice (draft -> issued)" | 223 |

**Impact:** The lifecycle diagram shows `draft -> approved -> issued` as the path. But the API operation description says "draft -> issued" directly. Can an invoice be issued without approval?

---

### CR-10: Event System -- Two Parallel Implementations

| System | Event Count | Storage | Line |
|--------|-------------|---------|------|
| `lib/events` (legacy) | 8 event types (DomainEvent) | In-memory | PA-28, BG-88 |
| `server/events` (modern) | 50+ event types (NexaEvent) | Database-backed OutboxEvent | PA-28, BG-88 |

**Impact:** Events emitted by one system are invisible to the other. A subscriber on the modern event bus will not receive events from the legacy system and vice versa.

---

### CR-11: Outbox -- Two Implementations

| System | Storage | Line |
|--------|---------|------|
| Redis outbox (earlier) | Redis | PA-30, SC-108 |
| DB-backed OutboxEvent (newer) | PostgreSQL via Prisma | PA-30 |

**Impact:** Same issue as CR-10. Events could be lost if the wrong outbox is used.

---

### CR-12: Quarantine Data -- Dual Storage

**Section 2.5.5 (SC-43, line 8853):**
> "Quarantine data stored in TenantConfig JSON AND in QualityHold Prisma model. Two sources of truth."

**Impact:** Quarantine state could be inconsistent between the two storage locations.

---

### CR-13: Cycle Count -- Two Implementations

**Section 2.6.6 (SC-44, line 8854):**
> "Two parallel implementations: database-backed and file-based."

**Impact:** Cycle counts performed in one system are invisible to the other.

---

### CR-14: Transfer -- Two Mechanisms

**Section 2.4.2 (BG-17, line 9009):**
> "Two separate mechanisms (config-based two-step and immediate single-step). Don't share state."

**Impact:** A transfer started in one mechanism cannot be tracked or completed in the other.

---

### CR-15: POS -- Triple Implementation

**Section 3.11 (SC-63, line 8877):**
Three parallel POS implementations:
1. DB-backed with pricing/GL/inventory integration
2. Config-based with JSON in TenantConfig
3. File-based

**Impact:** Sales recorded in one implementation are invisible to the others. Financial reporting will be incomplete if the wrong implementation is queried.

---

### CR-16: Plan/Billing -- Three Models

**Section 7.4 (BG-105, line 9122):**
Three plan models coexist:
1. `Plan` (legacy)
2. `BillingPlan`
3. `BillingPlanTemplate` (actively used)

**Impact:** Code referencing `Plan` or `BillingPlan` may retrieve stale or incorrect billing information. Only `BillingPlanTemplate` is actively maintained.

---

## 5. Duplicate Content

Content that appears in multiple sections, potentially with divergent descriptions.

### DC-1: Customer Entity -- Full Duplication

| Location | Section | Lines |
|----------|---------|-------|
| AR module | Section 1.1.1 | 69-117 |
| CRM module | Section 3.10.1 | 3418-3451 |

Both sections fully define the Customer entity with field tables, relations, and indexes. As noted in EC-1 and EC-3, they have conflicting uniqueness constraints and required-field semantics.

---

### DC-2: Supplier Entity -- Full Duplication

| Location | Section | Lines |
|----------|---------|-------|
| AP module | Section 1.2.1 | 404-444 |
| Purchasing module | Section 3.12.1 | 3772-3796 |

Both sections fully define the Supplier entity. As noted in EC-2 and EC-4, they have conflicting uniqueness constraints and different levels of detail.

---

### DC-3: PurchaseOrder Entity -- Full Duplication

| Location | Section | Lines |
|----------|---------|-------|
| AP module | Section 1.2.2 | 447-505 |
| Purchasing module | Section 3.12.3 | 3803-3866 |

Both sections define the PurchaseOrder entity with field tables and lifecycle. As noted in EC-5 and CR-1/CR-2, the lifecycles directly contradict.

---

### DC-4: Reservation Entity -- Full Duplication

| Location | Section | Lines |
|----------|---------|-------|
| Inventory module | Section 2.7.1 | 2151-2174 |
| Sales module | Section 3.6.4 | 3207-3224 |

Exact same entity defined twice with identical fields, types, and indexes. No contradictions, just pure redundancy.

---

### DC-5: VAT Return Storage Gap

This issue appears in multiple locations:
- Section 1.5.1 (line 795): Gap about dual VAT storage
- Section 5.1.5 (SC-91, line 8916): VAT returns in JSON not relational
- Section 8.5.1 (SC-23, line 8827): "VAT returns stored in TenantConfig JSON, NOT the VatReturn table"
- Section 8.7.1 (BG-7-9, lines 8994-8996): VAT code tracking gaps
- Section 8.8.1 (R-9, line 9154): Recommendation for relational storage

All describe the same issue but with slightly different framing. The core fact is consistent: VatReturn table exists but is never populated; actual data lives in TenantConfig JSON.

---

### DC-6: Period Close Gap

Described in:
- Section 1.7 (line 1121): Gap about dual mechanism
- Section 5.6.1 (SC-105, line 8929): Shortcut about dual mechanism
- Section 6.8 (lines 6207-6235): Detailed comparison of both mechanisms
- Section 8.7.1 (BG-4, line 8991): Business rule gap
- Section 8.8.5 (R-87, line 9252): Recommendation to consolidate

All consistent in describing the issue, but the detailed analysis in Section 6.8 provides the most complete picture.

---

### DC-7: Three-Way Matching Gap

Described in:
- Section 1.2.2 (line 502): "[MISSING] No three-way matching"
- Section 3.12.11 (MF-90): "No goods receipt / three-way match logic"
- Section 8.2.1 (MF-21, line 8470): Same
- Section 8.9.1 (P1, line 9314): Priority classification

All consistent.

---

### DC-8: Role Normalization Inconsistency

Described in:
- Section 7.3.1 (lines 7542-7543): Primary description
- Section 7.3.8 (line 7641): Gap note
- Section 8.7.7 (BG-102, line 9119): Business rule gap entry

All consistent. The contradiction is between the two code files, not between document sections.

---

### DC-9: HubSpot Integration Gap

Described in:
- Section 3.13 (various): Schema-only, no sync
- Section 8.1.3 (SG-65, line 8414): Schema gap
- Section 8.2.3 (MF-92, line 8551): Missing feature
- Section 8.8.3 (R-48, line 9203): Recommendation

All consistent.

---

### DC-10: Z-Report Gap -- Different IDs

| Location | ID | Description |
|----------|----|-------------|
| Section 8.2.3 | MF-85 (line 8544) | "Z-report generation -- Schema exists, no implementation" |
| Section 8.2.3 | MF-86 (line 8545) | "Z-reports -- Z-report generation logic missing" |

**Impact:** MF-85 and MF-86 appear to describe the same gap (Z-report generation) but with different source sections. This inflates the gap count.

**Resolution:** Merge MF-85 and MF-86 into a single entry.

---

## 6. Inconsistent Terminology

Terms used inconsistently across the document.

### IT-1: "aging" vs "ageing"

| Usage | Location |
|-------|----------|
| "aging" (American) | API path `/api/finance/ap/aging/` (line 643), report type `ar_aging` / `ap_aging` (line 5741-5742) |
| "ageing" (British) | API path `/api/finance/ap/ageing/` (line 671), function name `getAgeing()` (lines 5591, 5633), dedicated service files |

**Impact:** Both spellings are used in API paths, function names, and documentation. For a UK-focused ERP system, "ageing" is the correct British spelling, but the codebase mixes both.

**Resolution:** Standardize on "ageing" (British) since the system is UK-focused. Use a single API path.

---

### IT-2: "value" vs "amount" on CrmOpportunity

| Field | Default | Usage |
|-------|---------|-------|
| `value` | null | Deal value (Section 3.4.1, line 2903) |
| `amount` | 0 | "Alias for value (compatibility)" (Section 3.4.1, line 2904) |

**Impact:** As noted in EC-8, these are supposed to be aliases but have different defaults (null vs 0), making them not interchangeable.

---

### IT-3: "expectedCloseDate" vs "closeDate"

| Field | Usage |
|-------|-------|
| `expectedCloseDate` | Primary field for expected close (Section 3.4.1, line 2907); used in indexes (line 2931) |
| `closeDate` | "Alias for expectedCloseDate" (Section 3.4.1, line 2909); used in HubSpot mapping (line 3962) |

**Impact:** Code referencing `closeDate` vs `expectedCloseDate` will access different database columns unless an alias mechanism is in place at the ORM level.

---

### IT-4: "isService" vs "type: stock/non_stock"

| System | Field | Values |
|--------|-------|--------|
| Service schema | `isService` | boolean (true/false) (line 1210) |
| Legacy schema | `type` | "stock" / "non_stock" (line 1224) |

**Impact:** Two different ways to express the same concept (stockable vs non-stockable item). No documented mapping between them.

---

### IT-5: "bill" vs "supplier invoice"

| Usage | Location |
|-------|----------|
| "bill" | Entity name `SupplierBill`, API paths `/api/finance/ap/bill/`, `/api/finance/ap/bills/` |
| "supplier invoice" | Purchasing summary endpoint `/api/purchasing/supplier-invoices/summary` (ST-11) |

**Impact:** The same concept (an invoice received from a supplier) is called "bill" in the Finance module and "supplier invoice" in the Purchasing module.

**Resolution:** Standardize on "bill" (more common in accounting software) or "purchase invoice" (more common in UK accounting). Be consistent across modules.

---

### IT-6: "receipt" vs "payment" (AR context)

| Term | Usage |
|------|-------|
| "payment" | Entity: `CustomerPayment`, API: `/api/finance/ar/invoice/pay` |
| "receipt" | API: `/api/finance/ar/receipts/`, `/api/finance/ar/receipt/record` |

**Impact:** In AR, money coming in from customers is called both "payment" and "receipt" in different API paths. In accounting, "receipt" is the correct term for money received; "payment" is money paid out.

**Resolution:** Standardize on "receipt" for AR (money received) and "payment" for AP (money paid).

---

### IT-7: "ownerId" vs "ownerUserId"

| Entity | Field Name |
|--------|------------|
| CrmOpportunity | `ownerId` (line 2910) |
| Various CRM entities (referenced in BG-35) | `ownerUserId` |

**Impact:** Same concept (the assigned user) uses different field names across CRM entities.

---

### IT-8: Entity Naming Convention Inconsistency

| Convention | Examples |
|-----------|----------|
| Prefixed with module | `CrmLead`, `CrmContact`, `CrmAccount`, `CrmActivity`, `CrmOpportunity` |
| Not prefixed | `Customer`, `Supplier`, `PurchaseOrder`, `SalesOrder`, `SalesQuote` |

**Impact:** CRM entities are consistently prefixed with "Crm" but other modules do not use prefixes. This creates naming collisions risk and inconsistency.

---

### IT-9: "POS sale" vs "receipt" (POS context)

| Term | Usage |
|------|-------|
| "PosSale" | Prisma model name |
| "receipt" | POS receipt concept, `receipts.ts` file |

**Impact:** POS transactions are called "sales" at the model level but "receipts" at the file/service level.

---

### IT-10: Monetary Unit Conventions

| Convention | Where Used |
|-----------|------------|
| Minor units (pence/cents) | Invoice create (`/api/finance/ar/invoice/create`), payment recording |
| Major units (pounds/dollars) | Invoice create (`/api/finance/ar/invoices` POST), some report outputs |
| `*Minor` suffix fields | Payroll: `grossMinor`, `netMinor`, `basePayMinor` |
| Decimal fields | Most entities: `amount`, `total`, `subtotal` (major units implied) |

**Impact:** No consistent convention for monetary values. Some APIs accept pence, others accept pounds. Some fields use a "Minor" suffix to indicate pence; others leave it ambiguous.

**Resolution:** Standardize on one convention. Recommendation: store all monetary values as minor units (pence) internally, accept/return in a documented format.

---

### IT-11: "PLATFORM" vs "NEXA_ROOT" Special Tenants

| Tenant Code | Purpose | Line |
|-------------|---------|------|
| `PLATFORM` | Plans catalog, AI config, integration metadata | 7274 |
| `NEXA_ROOT` | Operational runbooks | 7275 |

**Impact:** Two different special tenant codes for platform-level configuration with no clear reason for the split. As flagged in BG-116 (line 9133).

**Resolution:** Consolidate into a single `PLATFORM` tenant or use a dedicated `PlatformConfig` table.

---

## 7. Cross-Module Reference Integrity

Issues where one section references concepts, entities, or behaviors from another section that do not match.

### XR-1: Events Without Subscribers

**Section 6.2 defines 50+ event types**, but as noted in PA-55 (line 8781):
> "Only ~30% of subscribers have real business logic; rest are stubs or logs-only."

Specific unimplemented cross-module connections:
- `sales.invoice.created` -- No GL journal entry creation (MF-132)
- `sales.order.created` -- No inventory reservation (BG-91)
- `sales.order.fulfilled` -- No stock movement (PA-42)
- `finance.invoice.paid` -- No payment application logic (PA-43)
- `purchasing.po.approved` -- No MRP recalculation (PA-46)
- `pos.refund.created` -- No inventory or finance reversal (BG-90)

**Impact:** Section 6 describes an event-driven architecture, but the described integration is aspirational rather than real. Any module expecting cross-module side effects from events will be disappointed.

---

### XR-2: Payroll GL Posting -- Section 4 vs Section 6

**Section 4.5 (payroll services):**
Describes direct GL posting within the payroll service, with two different mechanisms (SC-83).

**Section 6.3.4 (payroll event chain):**
Describes GL posting via the `hr.payroll.run.committed` event subscriber, which creates 3-line journal entries (debit Payroll Expense, credit Payroll Payable, credit PAYE Liability).

**Section 6.3.4 also notes (BG-93, line 9105):**
> "No NI employer contribution line in payroll GL posting. Only PAYE deductions calculated."

**Impact:** The payroll GL posting is described differently in the two sections. Section 4 mentions two mechanisms; Section 6 describes one event-driven mechanism. The event-driven version is missing NI employer contributions.

---

### XR-3: Data Warehouse Fact Tables -- Populated but Unread

**Section 5.6 (Data Warehouse):**
Documents FactInvoice, FactReceipt, FactInventoryMovement, FactWorkOrder, FactProjectWip tables that are populated by event subscribers.

**Section 5.6.3 (line 8593, MF-124):**
> "No reporting layer reads from the fact tables; they are populated but no analytics dashboards or reports query them."

**Impact:** Sections 5 and 6 describe fact table population in detail, but no section describes consumption. The data warehouse is write-only.

---

### XR-4: Workflow Engine -- Defined but Not Wired

**Section 6.6 (Workflow Engine):**
Describes a workflow approval framework with `requireWorkflowApproval()` and `WorkflowStep` configuration.

**Section 6.6.2 (BG-96, line 9108):**
> "No evidence of enforcer being called from actual business module code."

**Impact:** The workflow engine is documented as existing infrastructure, but no business module (invoicing, PO approval, leave management) actually calls it. References to "approval workflow" in other sections are aspirational.

---

### XR-5: AI Context Providers -- Referenced but Limited

**Section 6.10 (AI Reasoning Layer):**
Documents context providers for each module that fetch relevant data for AI queries.

**Section 5.4.2 (SC-103, line 8927):**
> "Each provider fetches only 5 records; not suitable for comprehensive reporting."

**Section 6.10.4 (SC-112, line 8941):**
> "Context limited to 5 most recent records per entity."

**Impact:** The AI-first vision described in the document introduction (line 33) relies on rich context, but the actual implementation is limited to 5 recent records per entity.

---

### XR-6: Propagation Framework -- Defined but Not Enforced

**Section 6.5 (Event Propagation Framework):**
Documents a propagation registry with `requiredEmits`, `writes`, and `idempotency` configuration.

**Section 6.5.2 (BG-94-95, lines 9106-9107):**
> "writes and idempotency fields populated but not enforced at runtime. Only requiredEmits checked."
> "Most registry entries have idempotency.required = false and key = null."

**Impact:** The propagation framework appears complete in documentation but is largely passive/unconfigured at runtime.

---

### XR-7: Section 8 Gap Description Differences

Several gaps appear in both module-local "Gaps & Issues" subsections AND Section 8, sometimes with slightly different descriptions:

| Gap | Local Description | Section 8 Description | Difference |
|-----|-------------------|----------------------|------------|
| Z-reports | "Schema exists, no implementation" (3.11.8) | MF-85: "Schema exists, no implementation" AND MF-86: "Z-report generation logic missing" | Section 8 has TWO entries for the same gap |
| CashMovement | "Schema exists; not actively populated" (3.11.8) | MF-87: "Schema exists, not populated" | Consistent but redundant with MF-85/86 area |
| LandedCost | Listed in Section 2.12.1 AND Section 3.12.9 | SG-62 references CRM section, ST-8 references Inventory section | Same model referenced from two modules with different gap IDs |

---

### XR-8: Module Licensing -- No Entity Exists

**Section 7.5 (Module Licensing):**
Documents module licensing logic using `TenantPlan.featureOverrides` JSON field and `assertPlanFeature()` checks.

**Section 8.7.7 (BG-108, line 9125):**
> "No dedicated ModuleLicense entity. Module licensing entirely in JSON fields."

**Section 8.8.7 (R-111, line 9286):**
Recommends creating a `TenantModule` junction table.

**Impact:** Section 7 describes module licensing as if it works (and it does via JSON), but the entity it relies on (TenantModule) does not exist in the schema. The recommendation in Section 8 suggests creating what Section 7 implies already exists.

---

### XR-9: Special Tenant Code Inconsistency

**Section 7.8.7 (line 3157):**
> "Runbooks are stored in the NEXA_ROOT tenant's TenantConfig"

**Section 7.8.4 (line 3121):**
> "A platform tenant (code: 'PLATFORM') is auto-created via upsert when needed to store platform-level configs."

**Section 7.9 (lines 3270-3275):**
Documents both special tenants, but they serve overlapping purposes.

**Impact:** Two special tenants (`PLATFORM` and `NEXA_ROOT`) for platform configuration creates confusion about where platform-level data should be stored. The `PLATFORM` tenant stores almost everything; `NEXA_ROOT` stores only runbooks.

---

## 8. Resolution Recommendations

### Priority 1: Must Fix Before PRD (Blocks Architecture Decisions)

| # | Issue | Action |
|---|-------|--------|
| 1 | EC-1, EC-2, EC-11: Code uniqueness (global vs per-tenant) | Decide: per-tenant with `@@unique([tenantId, code])`. Update all entity definitions. |
| 2 | EC-5, CR-1, CR-2: PO lifecycle contradictions | Define single canonical lifecycle: `draft -> approved -> sent -> received -> closed; cancelled from draft/approved/sent`. Cancel produces "cancelled" not "closed". |
| 3 | CR-3: Role normalization | Decide: unknown roles map to VIEWER (principle of least privilege). Remove roles.ts legacy mapping. |
| 4 | CR-5: Dual period close | Decide: database-backed PeriodClose with per-ledger flags is the canonical mechanism. Remove TenantConfig.finance.close.lockedThrough. |
| 5 | CR-10, CR-11: Dual event/outbox systems | Decide: modern NexaEvent system with DB-backed OutboxEvent is canonical. Deprecate legacy lib/events and Redis outbox. |
| 6 | CR-15: Triple POS implementation | Decide: DB-backed implementation is canonical. Remove config-based and file-based. |
| 7 | CR-16: Three billing plan models | Decide: BillingPlanTemplate is canonical. Remove Plan and BillingPlan. |

### Priority 2: Must Fix Before PRD (Blocks Entity Design)

| # | Issue | Action |
|---|-------|--------|
| 8 | DC-1 through DC-4: Duplicate entity definitions | Define each entity ONCE in a primary section with cross-references from other sections. |
| 9 | EC-8: Opportunity duplicate fields | Pick `value` and `expectedCloseDate`. Remove `amount` and `closeDate` aliases. |
| 10 | EC-10: Dual item creation schemas | Consolidate into single schema. Document `type`-to-`isService` mapping. |
| 11 | EC-13: TenantConfig as catch-all | Create entity list of what must move from TenantConfig JSON to proper tables. |
| 12 | EC-14: Bill status String vs Enum | All status fields must use enums in new project. |

### Priority 3: Should Fix Before PRD (Improves Clarity)

| # | Issue | Action |
|---|-------|--------|
| 13 | IT-1: aging/ageing | Standardize on "ageing" (British). |
| 14 | IT-5: bill/supplier invoice | Standardize on "bill" or "purchase invoice". |
| 15 | IT-6: receipt/payment (AR) | Standardize on "receipt" for AR, "payment" for AP. |
| 16 | IT-10: Monetary units | Document convention: minor units internally, documented API format. |
| 17 | IT-11: PLATFORM/NEXA_ROOT | Consolidate into single platform config mechanism. |
| 18 | DE-1 through DE-6: Duplicate endpoints | Each operation should have exactly one endpoint with consistent naming. |
| 19 | DC-5 through DC-10: Duplicate gap descriptions | Deduplicate gap entries. Assign single canonical ID per gap. |

### Priority 4: Acknowledge in PRD (Context for Architecture)

| # | Issue | Action |
|---|-------|--------|
| 20 | XR-1: Events without subscribers | PRD should list required cross-module integrations with explicit subscriber requirements. |
| 21 | XR-3: Fact tables unread | PRD should specify which fact tables the reporting module must consume. |
| 22 | XR-4: Workflow engine not wired | PRD should specify which business operations require approval workflows. |
| 23 | XR-5: AI context limited | PRD should specify context depth requirements per module for AI. |
| 24 | CR-6: Dual payroll GL posting | PRD should specify single event-driven GL posting path with NI employer contributions. |

---

*End of report*
