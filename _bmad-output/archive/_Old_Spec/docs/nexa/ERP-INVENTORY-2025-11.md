# Nexa ERP — Full Build Inventory (2025-11 Snapshot)

This is an exhaustive, read-only inventory of the Nexa ERP monorepo at:

/Users/waheedraja/Desktop/Business Opportunities/Nexa ERP

It maps the current hybrid architecture (Prisma + file-backed stores), covering models, stores, APIs, UI routes, guards, flows and tests, to support comparison and the upcoming migration/code‑switch phase. No behavior was changed while producing this document.

---

## 1. Core Platform & Cross-Cutting

- Identity & Auth (NextAuth)
  - Prisma models: `User`, `Account`, `Session`, `VerificationToken` (apps/web/prisma/schema.prisma)
  - Auth route: `apps/web/app/api/auth/[...nextauth]/route.ts`
  - Session/AUTH helpers: `apps/web/src/lib/auth/**`, SSR guards, API guards
  - Support session: `apps/web/app/api/admin/support/session/route.ts` (SUPER_ADMIN only; audits include impersonation metadata)

- Tenancy & Access
  - Tenant config API: `apps/web/app/api/tenant/config/route.ts`
  - Per‑user/module access store & tenant toggles: `apps/web/src/lib/access/{tenantConfig.ts,store.ts,guard.ts,types.ts}`
  - Dimension scoping (warehouses/sites/etc.): `apps/web/src/lib/access/scope.ts` (`applyInventoryScope`, `applyLotScope`)

- RBAC & Permissions
  - Roles: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, `VIEWER`
  - Matrix: `apps/web/src/lib/rbac/matrix.ts` (see Section 5 for full permission set)

- Observability & Audit
  - Audit logging: `apps/web/src/lib/observability/audit.ts` (non‑PII payloads; impersonation metadata)
  - Metrics/logging: `apps/web/src/lib/observability/metrics.ts`, `apps/web/src/lib/logs/tracer.ts`, `apps/web/src/lib/observability/log.ts`, `apps/web/src/lib/sentry-scrub.ts`

- Rate Limiting
  - Tenant-aware limiter: `apps/web/src/lib/rate-limit/tenant.ts`
  - Fallback/memory limiter utilities: `apps/web/src/lib/rate-limit.ts`

- Events & Realtime
  - Publisher/types: `apps/web/src/lib/events/{publish.ts,types.ts,topic.ts}`
  - SSE stream: `apps/web/app/api/events/stream/route.ts`

- AI & Truthfulness (“no guessing”)
  - AI bar client in Shell: `apps/web/src/components/layout/Shell.tsx` (sends `{ prompt, pathname }`)
  - Endpoint: `apps/web/app/api/ai/query/route.ts` → intents: `apps/web/src/lib/ai/intents.ts`
  - Returns 501 with explicit, structured payload when data is insufficient or intent unimplemented
  - Diagnostics: `apps/web/app/api/_diag/ai-selftest/route.ts`, `apps/web/app/api/_diag/openai-live-check/route.ts`

- Billing & DR/Ops
  - Billing: `apps/web/app/api/billing/**`, `apps/web/src/components/BillingBanner.tsx`
  - Backups: `apps/web/app/api/admin/backups/{list,run}/route.ts`, `apps/web/src/lib/ops/backups.ts`
  - Compliance/GDPR: `apps/web/app/api/compliance/{export,delete}/route.ts`

---

## 2. Modules Overview

Module | Sub-Modules | Backing (DB/File/Hybrid) | UI Routes (examples) | API Surface (examples) | E2E Coverage | Status
---|---|---|---|---|---|---
Finance & GL | AR, AP, Banking, Reports, Fixed Assets | Hybrid (Prisma minimal + logic; surface completed) | `/finance/*` | `/api/finance/ar/invoice/{approve,pay}`, `/api/finance/reports/{pnl,trial-balance,balance-sheet}`, `/api/finance/fa/acquire`, `/api/finance/journals/list` | `finance-arap-crud.spec.ts`, `finance-aging.spec.ts`, `finance-fa-close.spec.ts`, `sales-finance-flow.spec.ts` | Full (hybrid)
Inventory & WMS | Items, Lots, Cycle Count, Valuation, Warehouses, Stock Movements, Quality | Hybrid (Items/Adjust DB; cycle/quality/lot APIs rely on DB + scope helpers) + File stores for cycle plan | `/inventory/*` | `/api/inventory/{items,adjust}`, `/api/inventory/lots`, `/api/inventory/cycle/*`, `/api/inventory/reports/valuation`, `/api/quality/*` | `purchasing-inventory-flow.spec.ts`, `supply.*.spec.ts` | Full (hybrid)
Manufacturing | WOs, BOM, Routing, WIP, Variance, Schedules, Resources | Hybrid (file-backed WIP/consume/scrap + existing APIs) | `/manufacturing/*` | `/api/manufacturing/wo/{release,complete,consume,scrap}`, `/api/manufacturing/{wip,reports/variance}` | `mfg-wo-flow.spec.ts`, `mfg-bom-smoke.spec.ts` | Full (hybrid)
Supply Chain | RFQ, Contracts, Cycle, Lots, QC, Scorecards, Replenishment, Pick/Pack/Ship, RMA, Dashboard | File-backed stores + DB integrations (PO, Inventory adjust) | `/purchasing/*`, `/supply/*`, `/inventory/quality` | `/api/purchasing/rfq*`, `/api/purchasing/contracts`, `/api/supply/{replenishment,scorecards,rma,pick,pack,ship}`, `/api/quality/*` | `supply.pick-pack-ship.flow.spec.ts`, `supply.rma.flow.spec.ts`, `supply.replenishment.flow.spec.ts`, `supply.dashboard.spec.ts` | Full (hybrid)
Sales & CRM | Leads, Accounts, Contacts, Opportunities, Activities, Quotes, Price Books | File-backed stores + DB handoffs (SO/Invoice) | `/crm/*`, `/sales/*` | `/api/crm/*`, `/api/sales/order/{create,deliver}`, `/api/sales/invoice/from-order`, `/api/sales/credit/create` | `crm.lead-conversion.flow.spec.ts`, `crm.quote-order-invoice.flow.spec.ts`, `sales-finance-flow.spec.ts` | Full (hybrid)
POS | Register, Sessions, Receipts, Products | Hybrid (shifts/sales/eod file-backed + UI) | `/pos/*` | `/api/pos/{shifts,sales,reports/eod}` | `pos-smoke.spec.ts` | Full (hybrid)
Projects & Time | Boards, Tasks, Timesheets, Billing | Hybrid (timesheets/approvals/exports file-backed + UI) | `/projects/*` | `/api/projects/{projects,timesheets, timesheets/approve, billing/export}`, `/api/projects/timesheets/rollup` | `projects-flow.spec.ts` | Full (hybrid)
HR / Payroll | Employees, Leave, Payroll | Hybrid (payroll runs file-backed + UI) | `/hr/*` | `/api/hr/{employees, payroll/run, payroll/history}` | — | Full (hybrid)
Healthcare | Rota, Cost-of-Care | File-backed (rota) + derived metrics (finance/inventory) | `/healthcare/{rota,cost-of-care}` | `/api/healthcare/rota` | `healthcare.rota.flow.spec.ts`, `healthcare.cost-of-care.spec.ts` | Full (hybrid)
Planning & Budgeting | Budgets, Forecasts, Reports | File-backed + P&L actuals via DB/compute | `/planning/{budgets,forecasts,reports}` | `/api/planning/{budgets,forecast}`, `/api/finance/reports/pnl` | `planning.budget-report.flow.spec.ts` | Full (hybrid)
Workflow | Definitions, Instances, My Approvals | File-backed store + enforcement hooks | `/workflow/{definitions,instances,my-approvals}` | `/api/workflow/{definitions,instances}/*` | `workflow.approvals.flow.spec.ts` | Full (hybrid)
Custom Fields | Definitions, Values, Dynamic rendering | File-backed store | `/settings/custom-fields` | `/api/custom/{fields,values}` | `custom-fields.flow.spec.ts` | Full (file)
AI & Insights | AI bar, Truthfulness, Workbench, Automations, Logs | Hybrid (AI endpoints + offline mode) | `/ai/{workbench,automations,logs}` | `/api/ai/{query,ask}`, diag live-checks | `ai.truthfulness.spec.ts`, `ai-bar.spec.ts`, `a11y-ai-shell.spec.ts` | Full (hybrid)
Integrations & Status | Stripe/OpenAI live-checks, Status, Audit | DB/External | `/admin/integrations`, `/help` | `/api/_diag/{openai-live-check,ai-selftest}`, `/api/status`, `/api/admin/audit/list` | `integrations.live-check.spec.ts`, `prod-health.spec.ts` | Full
Admin & Settings | Users, Backups, Jobs, GDPR, Metrics | DB/Hybrid | `/admin/*`, `/settings/*` | `/api/admin/users/*`, `/api/admin/backups/*`, `/api/reports/*`, `/api/compliance/*` | `admin.backups.spec.ts`, `user-management.spec.ts` | Full/Hybrid

Notes:
- “Hybrid” = file stores for new subsystems + DB-backed integrations (e.g., PO/Invoice/Adjust) while schema remains minimal per constraints.
- Shell navigation is manifest-driven and toggle-gated (see `src/components/layout/Shell.tsx`, `scripts/route-manifest.json`).

---

## 3. Detailed Modules

### 3.1 Finance
- Prisma models (current minimal, hybrid logic):
  - `Invoice`, `InvoiceLine` (core AR)
  - (PO models exist for Purchasing; GL/FA often computed or mocked until migration)
- APIs (examples):
  - `/api/finance/ar/invoice/approve`, `/api/finance/ar/invoice/pay`
  - `/api/finance/reports/{pnl,trial-balance,balance-sheet}`
  - `/api/finance/fa/acquire`
- UI pages: `/finance/{ap,ar,invoices,bills,payments,expenses,banking,reconciliation,reports,fa,fa/register,fa/depreciation,close,ar/aging,ap/aging}`, `/finance/journals`
- Flows: AR invoice approve→pay, P&L/trial balance reports, FA acquire/depreciation; journals surface (audit-derived)
- E2E: `finance-arap-crud.spec.ts`, `finance-aging.spec.ts`, `finance-fa-close.spec.ts`, `sales-finance-flow.spec.ts`
- Status: Partial (DB minimal; full DB model to be added in migration)

### 3.2 Inventory & WMS
- DB + Stores:
  - DB: `items`, `adjust` endpoints; lot/quality data via existing DB models (scoped by `applyInventoryScope`/`applyLotScope`)
  - File stores: `apps/web/src/lib/supply/cycleStore.ts` (plans/results)
- APIs: `/api/inventory/{items,adjust}`, `/api/inventory/lots`, `/api/inventory/cycle/*`, `/api/quality/{inspections,holds}/*`, `/api/inventory/reports/valuation`
- UI pages: `/inventory/{items,warehouses,categories,suppliers,stock-movements,valuation}`, `/inventory/lots`, `/inventory/cycle-count`, `/inventory/quality`
- Flows: GRN posting → inventory adjust → valuation; cycle count plan → count → post variance
- E2E: `purchasing-inventory-flow.spec.ts`, `supply.*.spec.ts`
- Status: Full (hybrid)

### 3.3 Manufacturing
- APIs: `/api/manufacturing/wo/{release,complete}`, `/api/manufacturing/reports/{variance,wip}`
- UI pages: `/manufacturing/{work-orders,bom,routing,resources,wip,variance,schedules}`
- Flows: WO release/complete → BOM consume (file-backed WIP) → scrap → variance
- New APIs/UI: `/api/manufacturing/wo/{consume,scrap}`, `/api/manufacturing/wip`, `/manufacturing/work-orders/[id]`
- E2E: `mfg-wo-flow.spec.ts`, `mfg-bom-smoke.spec.ts` (extend with consume)
- Status: Full (hybrid; deeper DB models to come in migration)

### 3.4 Supply Chain
- File-backed stores:  
  `rfqStore.ts`, `contractsStore.ts`, `cycleStore.ts`, `rmaStore.ts`, `replenishmentStore.ts`, `pickPackShipStore.ts`, `scorecardStore.ts`, `dashboardStore.ts`
- APIs:  
  RFQ `/api/purchasing/rfq*`, Contracts `/api/purchasing/contracts`,  
  Cycle `/api/inventory/cycle/*`, Lots `/api/inventory/lots*`, QC `/api/quality/*`,  
  Replenishment `/api/supply/replenishment/*`,  
  Pick/Pack/Ship `/api/supply/{pick,pack,ship}/*`,  
  RMA `/api/supply/rma*`,  
  Dashboard `/api/supply/dashboard/*`
- UI pages:  
  `/purchasing/rfq`, `/supply/{replenishment,pick-pack-ship,scorecards,scorecards/[supplierId],dashboard}`, `/inventory/quality`
- Flows: RFQ → Contracts suggestion → PO create (DB) → GRN → QC → Scorecards; Replenishment → suggestions → POs; Pick/Pack/Ship → deliver (DB SO) → close wave; RMA → inventory adjust/credit
- E2E: `supply.pick-pack-ship.flow.spec.ts`, `supply.rma.flow.spec.ts`, `supply.replenishment.flow.spec.ts`, `supply.dashboard.spec.ts`
- Status: Full (hybrid)

### 3.5 Sales & CRM
- File-backed stores:  
  `leadsStore.ts`, `accountsStore.ts`, `contactsStore.ts`, `activitiesStore.ts`, `opportunitiesStore.ts`, `quotesStore.ts`, `priceBooksStore.ts`
- APIs:  
  `/api/crm/{leads,accounts,contacts,activities,opportunities,price-books,quotes}`, `/api/crm/quotes/[id]/approve`  
  Sales Order & Invoice handoff: `/api/sales/order/{create,deliver}`, `/api/sales/invoice/from-order`, `/api/sales/credit/create`
- UI pages:  
  `/crm/{leads,leads/[id],accounts,accounts/[id],contacts,contacts/[id],opportunities,opportunities/[id],activities,price-books,price-books/[id],quotes,quotes/[id]}`  
  `/sales/{leads,quotes,opportunities,customers,orders}`
- Flows: Lead → Account+Contact (convert) → Opportunity → Quote (approve/gated) → SO create → Invoice from order → Payment (finance)
- E2E: `crm.lead-conversion.flow.spec.ts`, `crm.quote-order-invoice.flow.spec.ts`, `sales-finance-flow.spec.ts`
- Status: Full (hybrid)

### 3.6 POS
- APIs/UI: `/pos/{register,receipts,sessions,products}`, shifts/sales/eod endpoints; helpers in `src/lib/pos/*`
- E2E: `pos-smoke.spec.ts` (extend with shift/sale)
- Status: Full (hybrid; printer adapters optional)

### 3.7 Projects
- UI: `/projects/{boards,board,tasks,time,timesheets,billing}` (time/billing pages completed)
- APIs: `/api/projects/{projects,timesheets, timesheets/approve, billing/export}`, existing roll-up
- E2E: `projects-flow.spec.ts` (extend with timesheet→approval→export)
- Status: Full (hybrid)

### 3.8 HR / Payroll
- UI: `/hr/{employees,leave,payroll,recruitment}` (payroll page completed)
- APIs: `/api/hr/{employees, payroll/run, payroll/history}`
- Status: Full (hybrid)

### 3.9 Healthcare
- File store: `healthcare/rotaStore.ts`
- UI: `/healthcare/{rota,cost-of-care}`
- API: `/api/healthcare/rota`
- Flows: Rota shifts (file) + cost-of-care derived from finance (P&L) and inventory lots
- E2E: `healthcare.rota.flow.spec.ts`, `healthcare.cost-of-care.spec.ts`
- Status: Full (hybrid)

### 3.10 Planning & Budgeting
- File stores: `planning/budgetsStore.ts`, `planning/forecastStore.ts`
- UI: `/planning/{budgets,forecasts,reports}`
- API: `/api/planning/{budgets,forecast}`, actuals via `/api/finance/reports/pnl`
- E2E: `planning.budget-report.flow.spec.ts`
- Status: Full (hybrid)

### 3.11 Workflow
- File store: `workflow/workflowStore.ts`; enforcement: `workflow/enforcer.ts`
- UI: `/workflow/{definitions,instances,my-approvals}`
- API: `/api/workflow/{definitions,instances}/*`
- Flows: Definitions → instances → approvals gating RFQ award, PO approval, Quote approval, RMA process
- E2E: `workflow.approvals.flow.spec.ts`
- Status: Full (hybrid)

### 3.12 Custom Fields
- File store: `custom/customFieldStore.ts`
- UI: `/settings/custom-fields` + dynamic rendering on key forms (CRM lead/opportunity, Inventory item, Healthcare rota shift)
- API: `/api/custom/{fields,values}`
- E2E: `custom-fields.flow.spec.ts`
- Status: Full (file)

### 3.13 AI & Insights
- UI: `/ai/{workbench,automations,logs}` (plus AI bar in Shell)
- API: `/api/ai/{query,ask}`, diag live-checks
- E2E: `ai.truthfulness.spec.ts`, `ai-bar.spec.ts`, `a11y-ai-shell.spec.ts`
- Status: Full (hybrid)

### 3.14 Integrations
- UI: `/admin/integrations`, `/help`
- API: `_diag/{openai-live-check,ai-selftest}`, `stripe/*`, `status`
- E2E: `integrations.live-check.spec.ts`, `prod-health.spec.ts`
- Status: Full

### 3.15 Admin, User Management & Settings
- UI: `/admin/{users,global-users,imports,jobs,backups,metrics,gdpr}`, `/settings/{modules,billing,custom-fields}`
- API: `/api/admin/users/*`, `/api/admin/backups/*`, `/api/admin/billing/*`, `/api/admin/audit/list`, `/api/tenant/users/*`, `/api/admin/settings/modules`
- Status: Full/Hybrid

---

## 4. Cross-Module Business Flows

1) Purchasing → GRN → Inventory → Finance  
UI entry: `/purchasing/rfq` → RFQ award → `/api/purchasing/po/create` (DB) → `/api/purchasing/grn/post` → `/api/inventory/adjust` → valuation/reporting → Finance reporting.

2) Manufacturing WO → BOM consume → Finished goods → Costing  
UI entry: `/manufacturing/work-orders` → `/api/manufacturing/wo/{release,complete}` → inventory effects (consumption/receipt) → variance reports `/api/manufacturing/reports/variance`. (Partial/hybrid)

3) Sales/CRM Quote → Delivery → COGS → AR Invoice → Payment  
UI entry: `/crm/quotes/[id]` → approve (workflow) → `/api/sales/order/create` → `/api/sales/order/deliver` → `/api/sales/invoice/from-order` → `/api/finance/ar/invoice/{approve,pay}` → GL/AR. (Hybrid)

4) POS sale → Inventory → GL  
UI entry: `/pos/register` → open shift → sale posting (file-backed; optional inv decrement via POS helper) → EOD summary; revenue/COGS into Finance reports (hybrid).

5) Projects → Timesheets → Billing  
UI entry: `/projects/time` → create + approve → `/projects/billing` export (file-backed) → invoice in migration phase (hybrid).

6) Supply Chain  
RFQ → Contracts → PO → GRN → QC → Scorecards  
Replenishment rules → Suggestions → POs  
Pick/Pack/Ship → Delivery → COGS/GL  
RMA → Inventory adjust → Refund/Credit

7) Healthcare  
Rota (file) → cost-of-care dashboard `/healthcare/cost-of-care` using finance (P&L) + inventory lots (hybrid), cached per-tenant.

8) Planning  
Budgets/Forecasts (file) vs Actual P&L (`/api/finance/reports/pnl`) → variance and % in `/planning/reports`.

9) Workflow  
Definitions (`/workflow/definitions`) → Instances (`/workflow/instances`) → My approvals (`/workflow/my-approvals`) → Enforcement at: PO approve, RFQ award, Quote approve, RMA process (403 until approved; audited).

10) AI  
Shell AI bar → `/api/ai/query` → `resolveIntent()` (Prisma/file-backed data) → returns 501 for unimplemented/no_data (no guessing).

---

## 5. Security, RBAC, Tenancy & Access

- Roles: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, `VIEWER`
- Permissions (from `apps/web/src/lib/rbac/matrix.ts`):
  - Finance: `finance:{approve_invoice,record_payment,create_invoice,create_bill,ap_payment,credit_note,post_journal,vat_submit,fa_depreciate,fa_dispose}`
  - Bank: `bank:{statement_import,reconcile}`
  - Inventory: `inventory:{receive_grn,valuation_post_cogs,transfer}`
  - Manufacturing: `mfg:{consume_bom,cost_rollup,wo_release,wo_complete,wo_close}`
  - HR/Payroll: `hr:payroll_run`
  - POS: `pos:finalise_sale`
  - Projects: `projects:{timesheet_rollup,billing_export}`
  - Reports: `reports:{schedule_manage,send_now}`, `ui:finance_reports:view`
  - System/Admin: `system:{jobs:view,jobs:retry,backups:view,tenant_export,tenant_delete,backups:run,settings:update,impersonate,integrations:{live_check,view}}`, `admin:role_change`
  - User management: `system:users:{list,update,force_logout}`, `tenant:users:{list,update,create}`
  - Sales: `sales:{create_order,deliver,invoice,credit_note}`
  - New modules: `crm:manage`, `planning:manage`, `workflow:{manage,approve}`, `custom:manage`, `healthcare:manage`

- Module toggles & per-user overrides:
  - Tenant-level toggles (e.g., `supply`, `planning`, `workflow`, `crm`, `healthcare`, `custom_fields`) via tenant config API; enforced server-side and in Shell nav (`Shell.tsx`).
  - Per-user module overrides/actions: `access/store.ts`, `access/guard.ts`

- Dimension scoping:
  - `applyInventoryScope`, `applyLotScope` filter by user-allowed warehouses (from access config)

- Support session / Impersonation:
  - SUPER_ADMIN-only; `api/admin/support/session/route.ts`
  - Audit includes impersonated user metadata; no privilege escalation beyond constraints; tenant scoping preserved.

- Rate limiting:
  - `rateLimitTenant(bucket, tenantId, userId)` across sensitive/mutating endpoints; Redis-aware with in-memory fallback

- Auditing:
  - Centralized, non‑PII payloads; events emitted for all new actions; idempotency via `http/idempotency.ts` where required

---

## 6. Tests & Quality

E2E suites (selection; see `apps/web/tests/e2e/**` for full list):
- Supply: `supply.pick-pack-ship.flow.spec.ts`, `supply.rma.flow.spec.ts`, `supply.replenishment.flow.spec.ts`, `supply.dashboard.spec.ts`
- CRM & Sales: `crm.lead-conversion.flow.spec.ts`, `crm.quote-order-invoice.flow.spec.ts`, `sales-finance-flow.spec.ts`
- Planning: `planning.budget-report.flow.spec.ts`
- Workflow: `workflow.approvals.flow.spec.ts`
- Custom Fields: `custom-fields.flow.spec.ts`
- Healthcare: `healthcare.rota.flow.spec.ts`, `healthcare.cost-of-care.spec.ts`
- AI/Observability/Billing/Admin: `ai.truthfulness.spec.ts`, `ai-bar.spec.ts`, `a11y-ai-shell.spec.ts`, `billing.lifecycle.spec.ts`, `integrations.live-check.spec.ts`, `admin.backups.spec.ts`
- Core UX/Access: `login-and-dashboard.spec.ts`, `auth.authed-sidebar.spec.ts`, `sidebar.counts-match-api.spec.ts`, `negative-cross-tenant.spec.ts`, `a11y*.spec.ts`

Thin or partial areas:
- Manufacturing deep GL/COGS postings; POS printers/adapters; Projects billing E2E depth; HR payroll depth.

---

## 7. Known Gaps & Hybrid Areas

Intended for migration only (see `docs/migrations/2025-11-XX-full-enterprise-build-final.md`):
- Move file-backed subsystems (Supply/CRM/Planning/Workflow/Custom/Healthcare/Projects/POS/Manufacturing/Payroll) to Prisma models with deep relations and indices.
- Add deep GL/FA models and postings, advanced MFG costing, and external device/integration surfaces.
- Infra adjustments (Hostinger/Vercel/AWS/Neon) remain out-of-scope here.

---

## 8. Known Issues / Failing Checks (as of this snapshot)

From non‑destructive runs (local/dev context):
- Lint (`pnpm -w lint`): 34 errors, mostly outside `apps/web` (legacy/archived folders and generated artifacts), e.g.:
  - Old website builds `Nexa ERP Website Files/**` referencing `document/localStorage` in Node lint context
  - `consolidated_build_artifacts/**` parsing errors (module syntax)
  - Various `prisma/seed*.ts`, `tools/*.ts`, `playwright.selfheal.config.js` parsing errors
- Typecheck (`pnpm -w typecheck`): passed (no emit)
- Routes (`pnpm -w run check:routes`): local check reported non‑200 for many routes at `http://localhost:3000` (likely server not running);  
  December readiness step indicates all manifest routes return 200 at production alias `https://app.nexaai.co.uk`
- Placeholders (`pnpm -w run check:placeholders`): passed
- Tests (`pnpm -w test -- --run`): mixed; major failure categories:
  - “describe is not defined” in some API contract tests (Jest globals vs Vitest environment)
  - Prisma undefined in certain API tests (expect Prisma client context; schema/env not loaded)
  - ECONNREFUSED localhost:3000 for supertest‑based API tests (no local server during run)
  - Playwright test mis‑invocation warning in one smoke file (test() called in wrong context)
- December readiness (`pnpm -w run december:ready`): 
  - Lint issues (non‑blocking)
  - Prisma validate error (P1012: `DATABASE_URL` missing in env; non‑blocking in readiness script)
  - Routes: production alias OK; E2E smoke (prod) non‑zero (not investigated here)

---

## 9. Summary

**Enterprise‑grade today**
- Shell + RBAC + tenant toggles + dimension scoping + support session; audit/rate‑limit/observability
- Supply Chain (RFQ, Contracts, Cycle, Lots/QC, Replenishment, Pick/Pack/Ship, RMA, Dashboard) — full (hybrid)
- CRM Sales flows (lead conversion; quote approvals + order + invoice); Workflow gating; Custom Fields; Planning; Healthcare rota/cost‑of‑care; AI bar truthfulness; Admin/Backups/Diagnostics

**Hybrid/file‑backed (ready to migrate)**
- CRM entities, Supply chain analytics and operational stores, Planning (budgets/forecasts), Workflow, Custom Fields, Healthcare rota, Projects/POS/Manufacturing/Payroll

**Thinner/partial**
- Deep Finance/GL/FA models (schema-level), advanced MFG costing depth, POS hardware integration; some dev tests require live server/DB and are documented.

--- 

Appendix: Source references (non‑exhaustive)
- Prisma schema: `apps/web/prisma/schema.prisma`
- File stores: `apps/web/src/lib/{supply,crm,planning,workflow,custom,healthcare}/*Store.ts`
- APIs: `apps/web/app/api/**/route.ts`
- UI pages: `apps/web/app/(app)/**/page.tsx`
- Guards & scope: `apps/web/src/lib/access/{guard.ts,scope.ts,tenantConfig.ts,store.ts}`, `apps/web/src/lib/rbac/matrix.ts`
- Shell: `apps/web/src/components/layout/Shell.tsx`


