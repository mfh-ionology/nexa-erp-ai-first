Task-L Module Verification Matrix (Modules × Roles × Must-Pass Scenarios)
=======================================================================

Run ID convention: `task-l-YYYYMMDD-HHMMSS` (mirrors runner output under `reports/verification/<RUN_ID>/`).

Evidence sources map directly to the Task-L runner steps (Task-L Playwright suite under `apps/web/tests/e2e/task-l/*.spec.ts` writes artifacts to `reports/verification/<run>/artifacts`):
- S1 DB Guard (`node scripts/verification/db_guard.mjs`)
- S2 DB Bootstrap (prisma generate + migrate deploy/push + seed discovery)
- S3 Lint (`pnpm -C apps/web lint`)
- S4 Typecheck (`pnpm typecheck`)
- S5 Build (`pnpm -C apps/web build`)
- S6 Vitest DB (`pnpm -C apps/web test:db`)
- S7 API Contract (`pnpm -C apps/web test:api`)
- S8 RBAC/Spec Audits (`pnpm exec tsx apps/web/scripts/audit/rbac-matrix-vs-routes.ts`, `.../erp-spec-vs-routes.ts`)
- S9 Vertical Scenarios (`pnpm -C apps/web test:verticals:local`)
- S10 Playwright E2E Task-L (`pnpm -C apps/web playwright test tests/e2e/task-l --reporter=json`)
- S11 Post Scan (no skips, no Prisma runtime errors via `scan_task_l.js`)

Module × Role Matrix
--------------------
| Module | Role | Must-pass scenarios | Expected result | Evidence source |
| --- | --- | --- | --- | --- |
| Auth / Session | SUPER_ADMIN / ADMIN / STAFF | Credential login with OTP; must-change-password flow; session extension & re-auth guard; reset-password email; tenant isolation on session cookie | Auth routes return 200/302 with correct redirects; password reset email queued; session tokens scoped to tenant and expire as configured | S4 auth/*.test.ts, S5 tests/api/auth-smoke.test.ts, S8 e2e auth specs |
| RBAC / Tenant Isolation | SUPER_ADMIN / ADMIN / STAFF | Route guard denies disallowed modules; sidebar hides blocked modules; API rejects cross-tenant access; role downgrade blocks privileged actions | 403/404 for forbidden actions; sidebar counts match API for role; tenant ID enforced per request | S4 rbac/*.test.ts, modules-alignment.test.ts; S6 rbac audit script; S8 e2e rbac specs |
| Super Admin Console | SUPER_ADMIN | Tenant search & pagination; create/update tenant; super admin audit log; canonical users present | CRUD succeeds with persisted data; audit log entries recorded; canonical users unchanged | S4 super-admin/*.test.ts, lib/super-admin-*.test.ts; S5 tests/api/super-admin endpoints; S8 e2e onboarding-flow.test.ts |
| Admin Console | ADMIN | Invite staff; assign roles; configure integrations toggles; enable MFA policy; view org dashboard KPIs | Invites emailed; role change persisted; integration flags stored; MFA enforcement seen on next login; KPI cards render | S4 modules/*.test.ts (admin paths), auth.smoke.spec.ts; S5 tests/api/phase5.addons.test.ts; S8 dashboard/ui.spec.ts |
| Staff Console | STAFF | View personal tasks & approvals; submit timesheet/expense; update profile preferences; must-change-password banner | Data persisted for staff; approvals limited to own scope; preferences saved; banner clears after reset | S4 modules/*.test.ts, profile.preferences.spec.ts; S5 tests/api/kpis.api.test.ts (staff surfaces); S8 e2e staff journeys |
| Finance (AR/AP/GL/VAT/FX) | SUPER_ADMIN / ADMIN / STAFF | GL posting with balanced debits/credits; AR invoice lifecycle; AP bill + payment; VAT return MTD stub; FX conversion applied to ledger; banking feed contract | Transactions persist with correct statuses; ledger remains balanced; VAT stub returns 200 with expected schema; FX rates applied; banking API contract matches | S4 tests/api/finance.gl.test.ts, modules/finance*.tests; S5 tests/api/banking.test.ts, kpis.contract.test.ts; S7 vertical finance steps; S8 finance E2E if present |
| Inventory / WMS | ADMIN / STAFF | Item creation & SKU uniqueness; GRN and putaway; pick/pack/ship; stock adjustments audit; warehouse transfers; inventory valuation | Stock levels adjust correctly; audit entries logged; transfers update both warehouses; valuation reports reflect moves | S4 modules/inventory*.tests; S5 tests/api/phase5.flows.test.ts (inventory flows); S7 retail-pos.test.ts (inventory touch); S8 inventory e2e specs |
| Manufacturing / MRP / BOM | ADMIN / STAFF | BOM create/update; work order release; material issue/consume; routing step completion; cost rollup; demand planning for SKU | BOM persists; WO transitions through statuses; consumption reduces components; cost rollup matches spec; planner output includes SKU | S4 manufacturing*.tests; S5 tests/api/phase5.addons.test.ts; S7 manufacturing-p5d.test.ts & manufacturing-customer.test.ts; S8 manufacturing e2e |
| CRM / Sales | ADMIN / STAFF | Lead → opportunity → quote → order; pipeline stage transitions; contact dedupe; email logging | Pipeline stages persist; dedupe rejects duplicates; quote/order totals correct; email log entries created | S4 modules/crm*.tests; S5 tests/api/phase5.flows.test.ts; S7 crm-quote-order-invoice.p12.test.ts; S8 sales e2e |
| Projects / PSA | ADMIN / STAFF | Project creation with billing model; task assignment; timesheet/expense approval; milestone billing; resource utilisation calc | Project saved; approvals update status; milestone invoice generated; utilisation matches expected | S4 modules/projects*.tests; S5 tests/api/phase5.addons.test.ts; S7 projects-p6.test.ts; S8 PSA e2e |
| HR / Payroll | ADMIN / STAFF | Employee onboarding; payroll run with deductions; leave request + approval; payslip generation; compliance export | Payroll outputs correct net pay; leave balances updated; payslip artifact generated; exports downloadable | S4 modules/hr*.tests; S5 tests/api/phase5.addons.test.ts; S7 hr-payroll-leave.p12.test.ts; S8 HR/payroll e2e |
| POS | ADMIN / STAFF | POS login with outlet binding; cart add/remove; split payments; receipt generation; printer contract; offline queue replay | POS actions succeed; receipts match schema; printer contract passes; offline queue replays without loss | S4 pos.printers.test.ts, pos.stripe-flow.test.ts; S5 tests/api/pos.printers.test.ts; S7 retail-pos.test.ts; S8 POS e2e |
| Integrations (Stripe/SMTP/OAuth connectors) | SUPER_ADMIN / ADMIN | Stripe webhook stub; SMTP smoke; OAuth callback guards; connector toggles | Stub webhook returns 200 and records event; SMTP test sends mock mail; OAuth callback guarded; toggles persist | S4 integrations/*.test.ts, auth.providers.test.ts; S5 tests/api/hmrc.vat/ping, billing.flow.spec.ts; S6 audits reflect routes; S8 OAuth/Stripe e2e stubs |
| AI Engine | SUPER_ADMIN / ADMIN / STAFF | AI engine execute route; role-based prompt controls; field visibility; audit logging; latency budget | AI responses return 200 with expected shape; role restrictions applied; audits stored; latency within threshold | S4 ai/*.tests, lib/ai-field-visibility.test.ts; S5 tests/api/ai*; S7 vertical AI truths; S8 ai e2e specs |
| Reporting / KPIs | SUPER_ADMIN / ADMIN | KPI aggregation; dashboard cards; exports; time zone correctness | KPI API returns expected schema; cards render; exports downloadable; timezone renders correct | S4 dashboard.kpi-mock.spec.ts; S5 tests/api/kpis.api.test.ts & kpis.contract.test.ts; S8 dashboard UI e2e |
| Security headers / rate limits / auditing | SUPER_ADMIN / ADMIN / STAFF | Security headers present; rate limit enforcement on auth/api; audit logs for sensitive reads; PHI redaction | Responses include CSP/HSTS; over-limit returns 429; sensitive-read logs created; PHI redaction active | S4 lib/sensitive-read-logging.test.ts, security.headers tests; S5 tests/api/security.headers.test.ts; S9 final scan for Prisma/runtime errors |
| Backups / Restore checks | SUPER_ADMIN | Backup job invocation; restore dry-run; BYOK key presence | Backup report generated; restore dry-run succeeds; BYOK key validated | S4 unit/backups.test.ts; S5 packages/jobs/backup.ts invoked via API contract where applicable; S7 vertical DR not applicable |
| Imports | ADMIN | Chart of accounts/customers/import templates processed; validation errors surfaced; idempotent re-run | Imports succeed with expected rows; validation errors reported; rerun safe | S4 modules/import*.tests; S5 tests/api/phase5.flows.test.ts (imports where applicable) |
| Auditing / Observability | SUPER_ADMIN / ADMIN | Audit tail endpoint; event SSE stream; tracing flags | Audit tail returns latest entries; SSE stream emits; tracing headers present | S4 events.sse.api.spec.ts, lib/config-change-audit.test.ts; S5 tests/api/metrics.test.ts |

Vertical Scenarios (End-to-End)
-------------------------------
| Vertical flow | Roles | Steps | Expected output | Evidence source |
| --- | --- | --- | --- | --- |
| Manufacturing (plan→produce→ship) | ADMIN / STAFF | Create BOM, release WO, consume components, record completion, ship | WO transitions through release→complete; inventory decremented; shipment recorded | S7 manufacturing-p5d.test.ts, manufacturing-customer.test.ts |
| Distribution / Inventory | ADMIN / STAFF | Receive PO, putaway, pick/pack/ship sales order, transfer warehouses | Stock increases on receipt, decreases on ship; transfer updates both sites | S7 retail-pos.test.ts (inventory touch), crm-quote-order-invoice.p12.test.ts (order→invoice) |
| PSA / Consulting | ADMIN / STAFF | Create project, assign team, log time/expenses, approve, bill milestone | Timesheets approved; invoice generated; utilisation within thresholds | S7 projects-p6.test.ts |
| Retail / POS | ADMIN / STAFF | POS login, cart add/remove, split payment, print receipt, sync offline queue | Receipts generated; payments recorded; offline queue replayed without loss | S7 retail-pos.test.ts |

