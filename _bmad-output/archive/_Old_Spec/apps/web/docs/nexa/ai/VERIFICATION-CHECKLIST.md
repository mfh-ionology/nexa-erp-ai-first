# Implementation Verification Checklist

## ✅ PHASE 1: ADMIN "how many X do I have?" with Real Counts

### Requirements Check:
- [x] **Service file created**: `apps/web/src/server/ai/tenant-metrics.service.ts`
  - [x] `getCustomerCountForTenant(tenantId)` - queries `Customer` model
  - [x] `getInvoiceCountForTenant(tenantId)` - queries `CustomerInvoice` model  
  - [x] `getItemCountForTenant(tenantId)` - queries `InventoryItem` model
  - [x] All functions perform `prisma.*.count()` queries scoped to tenantId
  - [x] Error handling returns 0 on failure

- [x] **Intent matching in intents.ts** (lines 817-853):
  - [x] `admin.metrics.customer_count` - matches "how many customers"
  - [x] `admin.metrics.invoice_count` - matches "how many invoices"
  - [x] `admin.metrics.item_count` - matches "how many items/products/inventory"
  - [x] Matching is tolerant (lowercase, punctuation stripped, plurals accepted)
  - [x] Returns intent with `data: { tenantId }`

- [x] **Orchestrator handling** (lines 966-986):
  - [x] Handles `admin.metrics.customer_count` - calls `getCustomerCountForTenant()`
  - [x] Handles `admin.metrics.invoice_count` - calls `getInvoiceCountForTenant()`
  - [x] Handles `admin.metrics.item_count` - calls `getItemCountForTenant()`
  - [x] Returns formatted message with count + UI guidance

- [x] **Tests** (`admin-staff-ai-intents.test.ts`):
  - [x] Test for "How many customers do I have?" - verifies intent resolution
  - [x] Test for "How many invoices do I have?" - verifies intent resolution
  - [x] Test for "How many items do I have?" - verifies intent resolution
  - [x] All 3 tests passing ✅

**STATUS: ✅ COMPLETE**

---

## ✅ PHASE 2: STAFF Tips - Actually Helpful

### Requirements Check:
- [x] **STAFF view intents in intents.ts** (lines 992-1054):
  - [x] `staff.view.stock` - "how do I see stock levels"
  - [x] `staff.view.timesheets` - "how do I see my timesheets"
  - [x] `staff.view.invoices` - "how do I view invoices"
  - [x] Each returns step-by-step navigation guidance
  - [x] Checked BEFORE generic matching

- [x] **Orchestrator handling** (lines 974-980):
  - [x] Handles `staff.view.*` intents
  - [x] Formats step-by-step instructions consistently

- [x] **Generic STAFF fallback** (line 1425-1426):
  - [x] Provides helpful navigation guidance
  - [x] Includes menu navigation tips and module locations
  - [x] No "unsupported query" message

- [x] **Tests** (`admin-staff-ai-intents.test.ts`):
  - [x] Test for "How do I see stock levels?" - verifies `staff.view.stock` intent
  - [x] Test for "How do I see my timesheets?" - verifies `staff.view.timesheets` intent
  - [x] Test for generic "How do I find information?" - verifies non-empty answer, no "unsupported"
  - [x] All 3 tests passing ✅

**STATUS: ✅ COMPLETE**

---

## ✅ PHASE 3: Billing Plans - Remove Brittle In-Memory Cache

### Requirements Check:
- [x] **loadPlansCatalogAsync()** (lines 142-198):
  - [x] NO cache check at start (no `if (plansCache !== null)`)
  - [x] Always queries DB directly via `prisma.tenantConfig.findUnique()`
  - [x] Returns saved plans if `plansCatalog` exists (even if empty array)
  - [x] Only falls back to DEFAULT_PLANS if `plansCatalog` is missing/undefined
  - [x] Comment confirms "always from DB, no cache"

- [x] **savePlansCatalog()** (lines 250-304):
  - [x] Updates TenantConfig in DB only
  - [x] NO cache update (line 294: "No cache update needed")
  - [x] No references to `plansCache` or `plansCachePromise`

- [x] **loadPlansCatalog() sync wrapper** (lines 205-209):
  - [x] Returns DEFAULT_PLANS (for non-super-admin quick access)
  - [x] Comment notes super-admin should use `loadPlansCatalogAsync()`

- [x] **API route** (`app/api/super-admin/billing/plans/route.ts`):
  - [x] GET (line 25): Always calls `loadPlansCatalogAsync()` - reads from DB
  - [x] POST (lines 64, 67-68): Saves via `savePlansCatalog()`, then reloads via `loadPlansCatalogAsync()` to return fresh state

- [x] **Cache variables removed**:
  - [x] NO `let plansCache` declaration found
  - [x] NO `let plansCachePromise` declaration found
  - [x] NO `clearPlansCache()` export found

- [x] **Tests** (`super-admin-billing-plans-v3.test.ts`):
  - [x] Round-trip test (lines 265-314): Verifies two separate `loadPlansCatalogAsync()` calls return same data
  - [x] Test simulates separate Vercel instance requests
  - [x] Test passing ✅

**STATUS: ✅ COMPLETE**

---

## Final Verification

### Test Results:
```bash
✅ ADMIN/STAFF AI intents: 6/6 passing
✅ Billing plans round-trip: Passing
✅ Build: Successful
```

### Files Changed:
- ✅ `apps/web/src/server/ai/tenant-metrics.service.ts` (NEW)
- ✅ `apps/web/src/lib/ai/intents.ts` (ADMIN metrics + STAFF view intents)
- ✅ `apps/web/src/lib/ai/orchestrator.ts` (Metrics handling + STAFF view formatting)
- ✅ `apps/web/src/lib/billing/plans.ts` (Cache removed, always read from DB)
- ✅ `apps/web/app/api/super-admin/billing/plans/route.ts` (Reload after save)
- ✅ `apps/web/tests/rbac/admin-staff-ai-intents.test.ts` (Tests added)
- ✅ `apps/web/tests/rbac/super-admin-billing-plans-v3.test.ts` (Round-trip test updated)

### Zero Gaps Achieved:
✅ ADMIN "how many X" - Real counts from database  
✅ STAFF tips - Helpful, actionable guidance  
✅ Billing plans persistence - DB is source of truth, no cache surprises  

**ALL REQUIREMENTS MET ✅**

