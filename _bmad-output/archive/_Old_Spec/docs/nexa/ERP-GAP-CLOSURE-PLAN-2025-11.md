# Nexa ERP — Gap Closure Plan (2025-11)

This document defines the targeted deepening to ensure every module is fully usable at the surface level (UI/API/flows/E2E) within the current hybrid architecture (Prisma + file-backed stores). No schema/auth/middleware/infra changes are included. All persistence added here will be either via existing DB models or file-backed stores under `apps/web/.data/**`, with tenant scoping, RBAC, module toggles, rate limits and audited, non‑PII payloads.

---

## Classification (from ERP-INVENTORY-2025-11.md)

- FULL & DB-backed: Identity/NextAuth minimal subset, Select PO/Invoice usage; Admin/Backups; Integrations/status (as surfaced)
- FULL but Hybrid: Supply Chain, CRM & Sales flows, Planning & AvB, Workflow, Custom Fields, Healthcare, AI bar/truthfulness, many Admin/Settings UIs
- PARTIAL or THIN (to deepen now, surface-level):
  1) Manufacturing — WO→BOM consumption depth, WIP/scrap/variance/UI
  2) POS — practical shift open/close, sales, end-of-day summaries (hardware out-of-scope)
  3) Projects — timesheet approvals, billing/export, profitability
  4) HR/Payroll — payroll run, payslip history, minimal reporting
  5) Finance/GL/FA — journal surface/read, VAT/report visibility where schema is thin (derive from audits where needed)

---

## Manufacturing — Gap Closure

Current state:
- APIs exist for WO release/complete and variance report; UI lists pages exist; costing depth/WIP/scrap/consume UI thin.

Target (hybrid completeness):
- Flows: WO list/detail; component consumption (per line), scrap entry, complete; WIP tracking; variance view.
- Cross-module effects: audit + inventory adjustments via existing `/api/inventory/adjust` as needed; variance report UI.
- Minimal KPIs: WO count by status, last 7d completions.

Implementation:
- File-backed store: `apps/web/src/lib/mfg/wipStore.ts` (tenant-scoped WIP, consumption, scrap, variance snapshots).
- APIs:
  - `POST /api/manufacturing/wo/consume` (RBAC `mfg:consume_bom`)
  - `POST /api/manufacturing/wo/scrap` (RBAC `mfg:consume_bom`)
  - `GET /api/manufacturing/wip` (RBAC `mfg:wo_release`)
- UI:
  - `/manufacturing/work-orders/[id]` detail page with Consume/Scrap/Complete actions; loading/error states.
  - Minor enhancements to existing list.
- E2E: `manufacturing.wo-consume.flow.spec.ts` — create/release WO (if needed), consume components, complete, confirm UI updates and variance appears.

Out-of-scope (migration phase):
- Full GL postings & deep costing model (per-line cost rollups), DB indices, advanced WIP aging.

---

## POS — Gap Closure

Current state:
- Basic POS UI pages; limited end-to-end depth; hardware integrations out-of-scope for now.

Target (hybrid completeness):
- Flows: Shift open/close, create sale (lines, payment), end-of-day summary per shift.
- Cross-module effects: audit events; optional inventory decrement via existing POS inventory helpers.

Implementation:
- File-backed stores:
  - `apps/web/src/lib/pos/shiftStore.ts` (shifts with open/close, totals)
  - `apps/web/src/lib/pos/salesStore.ts` (sales lines, payment captured)
- APIs:
  - `GET/POST /api/pos/shifts` (open/close) RBAC `pos:finalise_sale`
  - `POST /api/pos/sales` RBAC `pos:finalise_sale`
  - `GET /api/pos/reports/eod` RBAC `pos:finalise_sale`
- UI:
  - `/pos/register` — open/close shift, create sale/payment; errors/loading.
  - `/pos/sessions` — list shifts with summaries.
- E2E: `pos.shift-and-sale.flow.spec.ts` — open shift → sale → close → EOD visible.

Out-of-scope:
- Physical printer/terminal integrations; external gateways.

---

## Projects — Gap Closure

Current state:
- Timesheets roll-up API exists; surface for approvals/billing/profitability is thin.

Target (hybrid completeness):
- Flows: timesheet create, manager approve, billing export (file-backed record), profitability snapshot.
- Cross-module effects: optional billing export record to feed invoice creation later; audit events.

Implementation:
- File-backed stores:
  - `apps/web/src/lib/projects/projectStore.ts` (projects, budgets)
  - `apps/web/src/lib/projects/timesheetStore.ts` (entries, approvals)
- APIs:
  - `GET/POST /api/projects/projects` RBAC `projects:billing_export`
  - `GET/POST /api/projects/timesheets` RBAC `projects:timesheet_rollup`
  - `POST /api/projects/timesheets/approve` RBAC `projects:timesheet_rollup`
  - `POST /api/projects/billing/export` RBAC `projects:billing_export`
- UI:
  - `/projects/time` — enter/approve timesheets
  - `/projects/billing` — export queue and profitability tiles
- E2E: `projects.timesheet-billing.flow.spec.ts` — create timesheet → approve → export appears.

Out-of-scope:
- Deep DB models for projects/lines, GL postings.

---

## HR / Payroll — Gap Closure

Current state:
- Employees UI/API exist; payroll flows thin.

Target (hybrid completeness):
- Flows: payroll run for period, payslip generation (file-backed), history list, basic totals.

Implementation:
- File-backed store: `apps/web/src/lib/hr/payrollStore.ts` (runs, payslips per employee)
- APIs:
  - `POST /api/hr/payroll/run` RBAC `hr:payroll_run`
  - `GET /api/hr/payroll/history` RBAC `hr:payroll_run`
- UI:
  - `/hr/payroll` — run payroll, list runs, download/export payslips (JSON/CSV)
- E2E: `hr.payroll-run.flow.spec.ts` — run → history reflects totals.

Out-of-scope:
- Real tax/NI engines; bank file generation; external payroll systems.

---

## Finance / GL / FA — Surface Completion

Current state:
- Minimal DB models; lifecycle functions reference GL postings in code paths that may be stubbed in dev; reporting surfaces exist.

Target (surface completeness within hybrid):
- Provide a read surface for “operational journals” derived from audited events when DB is thin.
- Ensure reports pages render or show “insufficient data” coherently.

Implementation:
- API: `GET /api/finance/journals/list` — derive simple balanced views from audit events (`finance.invoice.*`, etc.). RBAC `ui:finance_reports:view`
- UI: `/finance/journals` — paginated list of derived postings; links into invoices/bills if available.
- E2E: `finance.journals.surface.spec.ts` — page renders, shows either rows or “insufficient data”.

Out-of-scope:
- Full GL chart, postings, reversals, FA register DB; VAT returns submissions (migration phase).

---

## Cross-Cutting Implementation Notes

- All new endpoints:
  - `assertTenantScope`, module toggle check via tenant config, `requirePermissionServer()` (rbac/matrix.ts), `rateLimitTenant`, `auditEvent` (non‑PII).
- All new UIs:
  - Under `apps/web/app/(app)/**`; use Shell + BillingBanner + AI bar; loading/error/empty states; responsive tables; RBAC/toggle gating in UI for write actions.
- Tests:
  - New E2E specs per area; skip gracefully if toggles/roles/env not present.

---

## AI Coverage (Truthfulness & Contract) — Completed in this pass

- Contract documented in `docs/nexa/AI-ENGINE-CONTRACT.md`
- `/api/ai/query` enforces:
  - Tenant session, rate limits, module toggles, RBAC
  - Read‑only, data‑backed intents; 501 for unsupported/insufficient data
  - Structured responses `{ ok, intent, source, data }`
- Intents (read‑only) added per module:
  - Finance journals summary; Inventory on‑hand (dimension‑scoped); Supply stock‑out + suggestions; Manufacturing WIP; CRM pipeline; POS today sales; Projects timesheets; HR snapshot; Healthcare rota coverage; Planning budgets; Workflow pending approvals; Admin live‑checks
- Shell AI bar:
  - Sends `{ prompt, pathname }`, handles 429/501; context‑aware placeholder prompts
- E2E added:
  - Presence across major modules; Truthfulness specs for Finance, Supply, CRM, POS, Planning; Negative (unsupported → 501)

Readiness Constraints:
- Some positive assertions are skipped if seed/data is not available or modules are disabled in the environment (tests assert 501 “cannot answer” instead of fabricating).

---

## Deep Build Phase – Missing vs Spec (2025-11)

The following areas are targeted for the next migration+deploy task. In this pre‑migration task we do not change the Prisma schema; instead we finalised the AI contract, Shell presence and UX polish, and expanded the migration blueprint with all required additive models and flows.

1) Finance (multi‑entity, FX, AP/AR depth, rev‑rec, dimensions)
- Current state: Hybrid surfaces; journals read surface; minimal GL/FA models; no multi‑entity or FX engine.
- Required by spec: LegalEntity, intercompany, consolidation, FX rates/revaluation, payment terms, credit notes, write‑offs, dunning, deferrals, cost centres and dimensional reporting.
- Planned implementation (next task): Add models (LegalEntity, Intercompany*, Group*, Fx*, PaymentTerm, CreditNote, WriteOff, Dunning*, DeferredRevenue*, CostCentre), APIs for management and runs, UIs under Finance, E2E for intercompany, FX, dunning, rev‑rec; update posting to include costCentreId.

2) Banking & Cash Management
- Current state: Banking pages exist; limited reconciliation surface.
- Required: BankAccount, BankStatement/Line, Reconciliation (auto/manual), cash position and cashflow projections.
- Planned: Add models/APIs for accounts/statements/reconciliation; CSV import and matching; UI workbench; E2E import→match→reconcile.

3) HR & Payroll
- Current: File‑backed payroll; basic UI; no full HR master.
- Required: Employee/Contract/Department/Position, HR timesheets, payroll runs/lines/liabilities with GL postings.
- Planned: Add models/APIs and UIs; E2E employee→timesheet→payroll→GL.

4) Inventory & WMS depth
- Current: Items/adjust DB; cycle count file store; lots/QC; transfers basic.
- Required: Bin locations, stock per bin, wh/bin transfers, adjustment reasons, DB‑backed cycle plans.
- Planned: Add models, APIs and UIs; E2E GRN→bin stock→transfer→adjustment→reports.

5) Manufacturing deep
- Current: File‑backed WIP; consume/scrap; basic variance.
- Required: Multi‑level BOM, work centres, routings, WO lifecycle, variances, simple MRP.
- Planned: Add models/APIs, UIs for BOM/Routing/MRP, E2E BOM→WO→consume→variance→MRP.

6) Purchasing advanced procurement
- Current: RFQ/contracts/replenishment; PO via existing DB; landed cost missing.
- Required: Blanket/scheduled orders, landed cost allocation, supplier KPI tight links.
- Planned: Add models/APIs, UIs, E2E contract→PO→GRN→landed cost→AP bill→KPIs.

7) Projects / PSA
- Current: File‑backed time/approvals/billing export; profitability thin.
- Required: Project phases/tasks/budgets, billing profiles (T&M/fixed/milestone/retainer), WIP rules/postings.
- Planned: Add models/APIs/UIs; E2E setup→timesheets→WIP→billing.

8) Sales & CRM deep
- Current: File‑backed CRM entities; quote→order→invoice handoff; pipelines basic.
- Required: Full CRM tables, pricing/discounting, backorders/partial fulfilment, inventory reservation.
- Planned: Add models/APIs/UIs; E2E lead→account/contact→opportunity→quote→SO→delivery→invoice.

9) POS retail‑grade
- Current: File‑backed shifts/sales/EOD; no promotions/cash‑up DB.
- Required: POS sessions/payments/promotions/till close models; reconciliation.
- Planned: Add models/APIs/UIs; E2E open→sales→cash‑up→reconcile.

10) Compliance & Tax
- Current: VAT/MTD stubs; export/delete endpoints.
- Required: TaxRegime/Period/VatReturn/Line, e‑invoicing docs, audit pack generator.
- Planned: Add models/APIs/UIs; E2E create return→audit pack.

11) Analytics & KPIs
- Current: Operational KPIs on pages; no unified metrics warehouse.
- Required: MetricDefinition/Snapshot/Dimensions and ETL jobs.
- Planned: Add models + ETL + APIs + UI; E2E metric consistency vs source.

12) AI Engine automation layer
- Current: Truthful, read‑only intents; no automation.
- Required: Bank rec suggestions, anomalies, accrual suggestions, commentary (read‑only, opt‑in).
- Planned: Add engine module, suggestion endpoints and UIs; E2E structured outputs or 501.

13) Admin/Localisation/Partner
- Current: Module toggles, users, backups; integrations surface.
- Required: CoA templates, localisation config, partner/industry‑packs models/APIs/UIs.
- Planned: Add models/APIs/UIs; E2E template apply; partner tenants/revenue share.

14) Healthcare vertical (PCN/GP)
- Current: Rota + cost‑of‑care dashboard.
- Required: PCN/Practice/ARRS/Claims models and flows; payroll/claims integration.
- Planned: Add models/APIs/UIs; E2E ARRS workflow with postings.

15) Ops/DR/Performance finishing
- Current: DR scripts; december:ready pipeline; perf not baselined at 100k+.
- Required: Updated DR docs/logs; perf baseline and indexes.
- Planned: Update ops docs; seed/load scripts; perf doc with index proposals.

## Tracking & Out-of-Scope (Migration/Infra)

- DB schema extensions (GL, FA, Projects, HR/Payroll, deep MFG) deferred to the migration/code‑switch phase (see `docs/migrations/2025-11-XX-full-enterprise-build-final.md`).
- External device/gateway integrations (POS printers/terminals), external ERPs, or infra (Hostinger/Vercel/AWS/Neon) are out‑of‑scope for this pass.


