# Phase 3 Slice Manifest

This document locks the Phase 3 slice order and boundaries. Each slice is self contained and must only touch its allowlisted surfaces. Acceptance criteria are end-to-end and require both API and UI coverage with RBAC and tenant safety.

## Locked Slice Order

1. `finance_gl`
2. `finance_ar`
3. `finance_ap`
4. `banking_cash`
5. `vat_mtd`
6. `period_close_fx`
7. `fixed_assets`
8. `inventory_core`
9. `wms_extensions`
10. `purchasing_core`
11. `manufacturing`
12. `projects`
13. `hr_employees_leave`
14. `payroll_uk`
15. `pos`
16. `chat`
17. `ai_service_automation`

## Slice Boundaries and Criteria

### finance_gl (Slice 3.1)
- **Scope:** General Ledger core (COA, journals, posting, trial balance).
- **API routes:** `/api/finance/gl/*`.
- **UI routes:** `/finance/gl/*`.
- **Server folders:** `apps/web/src/server/finance/gl/*`.
- **Seeds/verifiers:** `scripts/qa/seed_finance_gl.ts`, `scripts/qa/unseed_finance_gl.ts`, `scripts/verification/verify_phase3_finance_gl.mjs`.
- **Permissions:** `ui:finance_reports:view` (read), `finance:post_journal` (manage/post).
- **Acceptance:** Create/read/update accounts; create/post journals with balanced Decimal totals; immutable after post; trial balance deterministic for date range; RBAC + module gate enforced; tenant scoped.
- **Out of scope:** AR/AP integration postings, bank feeds, FX revaluation.

### finance_ar (Slice 3.2)
- **Scope:** Accounts Receivable core (customers, invoices, receipts, credit notes).
- **API routes:** `/api/finance/ar/*`.
- **UI routes:** `/finance/ar/*`.
- **Server folders:** `apps/web/src/server/finance/ar/*`.
- **Seeds/verifiers:** `seed_finance_ar`, `unseed_finance_ar`, `verify_phase3_finance_ar`.
- **Permissions:** `finance:create_invoice`, `ui:finance_reports:view` for reads.
- **Acceptance:** Issue/approve/post invoices, record receipts, credit notes reduce balances, tenant/RBAC/module enforcement.
- **Out of scope:** Subscription billing, revenue recognition, dunning.

### finance_ap (Slice 3.3)
- **Scope:** Accounts Payable core (suppliers, bills, payments, credit notes).
- **API routes:** `/api/finance/ap/*`.
- **UI routes:** `/finance/ap/*`.
- **Server folders:** `apps/web/src/server/finance/ap/*`.
- **Seeds/verifiers:** `seed_finance_ap`, `unseed_finance_ap`, `verify_phase3_finance_ap`.
- **Permissions:** `finance:create_bill`, `finance:edit`.
- **Acceptance:** Create/update bills, post and adjust balances, record/reverse payments, tenant/RBAC/module enforcement.
- **Out of scope:** Payment runs, bank export files, supply chain links.

### banking_cash (Slice 3.4)
- **Scope:** Bank accounts, statements, reconciliations, cash movements.
- **API routes:** `/api/banking/*`, `/api/finance/banking/*`.
- **UI routes:** `/finance/banking/*`, `/finance/bank/*`.
- **Server folders:** `apps/web/src/server/finance/banking/*`.
- **Seeds/verifiers:** `seed_banking_cash`, `unseed_banking_cash`, `verify_phase3_banking_cash`.
- **Permissions:** `banking:view`, `banking:edit`.
- **Acceptance:** Create bank accounts, import statements, reconcile, produce cash summary; tenant/RBAC/module enforcement.
- **Out of scope:** Open banking integrations, payments initiation.

### vat_mtd (Slice 3.5)
- **Scope:** VAT codes, returns, MTD submission envelope.
- **API routes:** `/api/finance/vat/*`.
- **UI routes:** `/finance/vat/*`.
- **Server folders:** `apps/web/src/server/finance/vat/*`.
- **Seeds/verifiers:** `seed_vat_mtd`, `unseed_vat_mtd`, `verify_phase3_vat_mtd`.
- **Permissions:** `finance:vat_submit`, `ui:finance_reports:view`.
- **Acceptance:** Maintain VAT codes, compute/submit returns, guard module and permissions, tenant scoped.
- **Out of scope:** HMRC live integration, multi-country tax.

### period_close_fx (Slice 3.6)
- **Scope:** Period open/close, FX revaluation, ledger locks.
- **API routes:** `/api/finance/close/*`, `/api/finance/fx/*`.
- **UI routes:** `/finance/close/*`, `/finance/fx/*`.
- **Server folders:** `apps/web/src/server/finance/periodClose/*`, `apps/web/src/server/finance/fx*`.
- **Seeds/verifiers:** `seed_period_close_fx`, `unseed_period_close_fx`, `verify_phase3_period_close_fx`.
- **Permissions:** `finance:post_journal`, `ui:finance_reports:view`.
- **Acceptance:** Open/close periods with audit, block posting into closed periods, run FX reval, deterministic outputs.
- **Out of scope:** Consolidation, multi-entity eliminations.

### fixed_assets (Slice 3.7)
- **Scope:** Asset register, depreciation, disposal.
- **API routes:** `/api/finance/fa/*`.
- **UI routes:** `/finance/fa/*`.
- **Server folders:** `apps/web/src/server/finance/assets*`.
- **Seeds/verifiers:** `seed_fixed_assets`, `unseed_fixed_assets`, `verify_phase3_fixed_assets`.
- **Permissions:** `finance:fa_depreciate`, `finance:fa_dispose`, `ui:finance_reports:view`.
- **Acceptance:** Add assets, run depreciation schedules, dispose with gain/loss, audit and tenant scope.
- **Out of scope:** IFRS/GAAP alternate books, asset leasing.

### inventory_core (Slice 3.8)
- **Scope:** Item master, stock ledger, adjustments.
- **API routes:** `/api/inventory/*`.
- **UI routes:** `/inventory/*`.
- **Server folders:** `apps/web/src/server/inventory/*`.
- **Seeds/verifiers:** `seed_inventory_core`, `unseed_inventory_core`, `verify_phase3_inventory_core`.
- **Permissions:** `inventory:view`, `inventory:manage`.
- **Acceptance:** Create items, track quantities, post adjustments with audit; tenant/RBAC enforced.
- **Out of scope:** WMS wave/pick/pack, manufacturing consumption.

### wms_extensions (Slice 3.9)
- **Scope:** Warehouses, bins, picking/packing/shipping flows.
- **API routes:** `/api/wms/*`, `/api/inventory/wms/*`.
- **UI routes:** `/inventory/wms/*`.
- **Server folders:** `apps/web/src/server/inventory/wms/*`.
- **Seeds/verifiers:** `seed_wms_extensions`, `unseed_wms_extensions`, `verify_phase3_wms_extensions`.
- **Permissions:** `inventory:transfer`, `inventory:adjust`.
- **Acceptance:** Manage warehouses/bins, execute pick/pack/ship with stock updates and audit.
- **Out of scope:** Carrier integrations, slotting optimization.

### purchasing_core (Slice 3.10)
- **Scope:** Purchase orders, approvals, receipts.
- **API routes:** `/api/purchasing/*`, `/api/supply/*`.
- **UI routes:** `/purchasing/*`.
- **Server folders:** `apps/web/src/server/purchasing/*`, `apps/web/src/server/supply/*`.
- **Seeds/verifiers:** `seed_purchasing_core`, `unseed_purchasing_core`, `verify_phase3_purchasing_core`.
- **Permissions:** `inventory:receive_grn`, `inventory:manage`.
- **Acceptance:** Create/approve POs, receive goods, status transitions with tenant/RBAC enforcement.
- **Out of scope:** Vendor catalogs, contract pricing, dropship.

### manufacturing (Slice 3.11)
- **Scope:** BOM, work orders, WIP movements.
- **API routes:** `/api/manufacturing/*`.
- **UI routes:** `/manufacturing/*`.
- **Server folders:** `apps/web/src/server/manufacturing/*`.
- **Seeds/verifiers:** `seed_manufacturing`, `unseed_manufacturing`, `verify_phase3_manufacturing`.
- **Permissions:** `mfg:consume_bom`, `mfg:cost_rollup`.
- **Acceptance:** Maintain BOMs, start/complete work orders, consume/produce stock with WIP ledger updates; tenant/RBAC enforced.
- **Out of scope:** APS/MRP advanced planning, routings/capacity planning.

### projects (Slice 3.12)
- **Scope:** Projects, tasks, timesheets.
- **API routes:** `/api/projects/*`.
- **UI routes:** `/projects/*`.
- **Server folders:** `apps/web/src/server/projects/*`.
- **Seeds/verifiers:** `seed_projects`, `unseed_projects`, `verify_phase3_projects`.
- **Permissions:** `projects:timesheet_rollup`, `ui:finance_reports:view`.
- **Acceptance:** Create projects, submit/approve timesheets, rollup time/costs with tenant/RBAC enforcement.
- **Out of scope:** Billing exports, revenue recognition.

### hr_employees_leave (Slice 3.13)
- **Scope:** Employees, leave management.
- **API routes:** `/api/hr/*`.
- **UI routes:** `/hr/*`.
- **Server folders:** `apps/web/src/server/hr/*`.
- **Seeds/verifiers:** `seed_hr_employees_leave`, `unseed_hr_employees_leave`, `verify_phase3_hr_employees_leave`.
- **Permissions:** `hr:payroll_run` (or module-specific read/manage equivalents).
- **Acceptance:** Maintain employees, apply/approve leave, audit trail, tenant/RBAC enforced.
- **Out of scope:** Performance reviews, recruiting ATS.

### payroll_uk (Slice 3.14)
- **Scope:** UK payroll runs, payslips, statutory deductions.
- **API routes:** `/api/payroll/*`, `/api/hr/payroll/*`.
- **UI routes:** `/payroll/*`.
- **Server folders:** `apps/web/src/server/payroll/*`, `apps/web/src/server/hr/payroll/*`.
- **Seeds/verifiers:** `seed_payroll_uk`, `unseed_payroll_uk`, `verify_phase3_payroll_uk`.
- **Permissions:** `hr:payroll_run`.
- **Acceptance:** Run payroll, compute deductions, lock periods, secure payslip delivery with tenant/RBAC enforcement.
- **Out of scope:** Multi-country payroll, RTI submissions, pension provider APIs.

### pos (Slice 3.15)
- **Scope:** POS sessions, sales, receipts/refunds.
- **API routes:** `/api/pos/*`.
- **UI routes:** `/pos/*`.
- **Server folders:** `apps/web/src/server/pos/*`.
- **Seeds/verifiers:** `seed_pos`, `unseed_pos`, `verify_phase3_pos`.
- **Permissions:** `pos:register`, `pos:finalise_sale`.
- **Acceptance:** Open/close sessions, record sales/refunds, cash reconciliation, tenant/RBAC enforced.
- **Out of scope:** Hardware integrations, loyalty, gift cards.

### chat (Slice 3.16)
- **Scope:** In-app chat, threads, attachments.
- **API routes:** `/api/chat/*`.
- **UI routes:** `/chat/*`.
- **Server folders:** `apps/web/src/server/chat/*`.
- **Seeds/verifiers:** `seed_chat`, `unseed_chat`, `verify_phase3_chat`.
- **Permissions:** `ui:ai:analytics` or chat-specific read/write perms.
- **Acceptance:** Create/join threads, send/receive messages, tenant scoped, rate-limited.
- **Out of scope:** Voice/video, external channel bridges.

### ai_service_automation (Slice 3.17)
- **Scope:** AI agent workflows, action triggers, service automation.
- **API routes:** `/api/ai/*`.
- **UI routes:** `/ai/*`.
- **Server folders:** `apps/web/src/server/ai/*`.
- **Seeds/verifiers:** `seed_ai_service_automation`, `unseed_ai_service_automation`, `verify_phase3_ai_service_automation`.
- **Permissions:** `ui:ai:finance` or module-specific manage perms.
- **Acceptance:** Deterministic agent actions with audit, tenant safety, RBAC/module gates, no placeholder responses.
- **Out of scope:** Model training, third-party orchestration beyond approved adapters.
