# Plan Outline (auto-generated)

## docs/nexa/ERP-GAP-CLOSURE-PLAN-2025-11.md
- kind: markdown
-   Nexa ERP — Gap Closure Plan (2025-11) (#nexa-erp-gap-closure-plan-2025-11) — This document defines the targeted deepening to ensure every module is fully usable at the surface level (UI/API/flows/E2E) within the current hybrid architecture (Prisma + file-backed stores). No schema/auth/middleware/infra changes are included. All persistence added here will 
-     Classification (from ERP-INVENTORY-2025-11.md) (#classification-from-erp-inventory-2025-11md) — - FULL & DB-backed: Identity/NextAuth minimal subset, Select PO/Invoice usage; Admin/Backups; Integrations/status (as surfaced)
-     Manufacturing — Gap Closure (#manufacturing-gap-closure) — Current state:
-     POS — Gap Closure (#pos-gap-closure) — Current state:
-     Projects — Gap Closure (#projects-gap-closure) — Current state:
-     HR / Payroll — Gap Closure (#hr-payroll-gap-closure) — Current state:
-     Finance / GL / FA — Surface Completion (#finance-gl-fa-surface-completion) — Current state:
-     Cross-Cutting Implementation Notes (#cross-cutting-implementation-notes) — - All new endpoints:
-     AI Coverage (Truthfulness & Contract) — Completed in this pass (#ai-coverage-truthfulness-contract-completed-in-this-pass) — - Contract documented in `docs/nexa/AI-ENGINE-CONTRACT.md`
-     Deep Build Phase – Missing vs Spec (2025-11) (#deep-build-phase-missing-vs-spec-2025-11) — The following areas are targeted for the next migration+deploy task. In this pre‑migration task we do not change the Prisma schema; instead we finalised the AI contract, Shell presence and UX polish, and expanded the migration blueprint with all required additive models and flows
-     Tracking & Out-of-Scope (Migration/Infra) (#tracking-out-of-scope-migrationinfra) — - DB schema extensions (GL, FA, Projects, HR/Payroll, deep MFG) deferred to the migration/code‑switch phase (see `docs/migrations/2025-11-XX-full-enterprise-build-final.md`).

## docs/nexa/ERP-GAP-CLOSURE-PLAN-2025-11.md
- kind: markdown
-   Nexa ERP — Gap Closure Plan (2025-11) (#nexa-erp-gap-closure-plan-2025-11) — This document defines the targeted deepening to ensure every module is fully usable at the surface level (UI/API/flows/E2E) within the current hybrid architecture (Prisma + file-backed stores). No schema/auth/middleware/infra changes are included. All persistence added here will 
-     Classification (from ERP-INVENTORY-2025-11.md) (#classification-from-erp-inventory-2025-11md) — - FULL & DB-backed: Identity/NextAuth minimal subset, Select PO/Invoice usage; Admin/Backups; Integrations/status (as surfaced)
-     Manufacturing — Gap Closure (#manufacturing-gap-closure) — Current state:
-     POS — Gap Closure (#pos-gap-closure) — Current state:
-     Projects — Gap Closure (#projects-gap-closure) — Current state:
-     HR / Payroll — Gap Closure (#hr-payroll-gap-closure) — Current state:
-     Finance / GL / FA — Surface Completion (#finance-gl-fa-surface-completion) — Current state:
-     Cross-Cutting Implementation Notes (#cross-cutting-implementation-notes) — - All new endpoints:
-     AI Coverage (Truthfulness & Contract) — Completed in this pass (#ai-coverage-truthfulness-contract-completed-in-this-pass) — - Contract documented in `docs/nexa/AI-ENGINE-CONTRACT.md`
-     Deep Build Phase – Missing vs Spec (2025-11) (#deep-build-phase-missing-vs-spec-2025-11) — The following areas are targeted for the next migration+deploy task. In this pre‑migration task we do not change the Prisma schema; instead we finalised the AI contract, Shell presence and UX polish, and expanded the migration blueprint with all required additive models and flows
-     Tracking & Out-of-Scope (Migration/Infra) (#tracking-out-of-scope-migrationinfra) — - DB schema extensions (GL, FA, Projects, HR/Payroll, deep MFG) deferred to the migration/code‑switch phase (see `docs/migrations/2025-11-XX-full-enterprise-build-final.md`).

## docs/modules/finance.md
- kind: markdown
-   Finance Module (#finance-module) — Outcomes: reliable ledgers, fast period close, statutory compliance.

## docs/modules/finance.md
- kind: markdown
-   Finance Module (#finance-module) — Outcomes: reliable ledgers, fast period close, statutory compliance.

## docs/modules/inventory-wms.md
- kind: markdown
-   Inventory & WMS Module (#inventory-wms-module) — Products, UoM, locations, lots/serials; ASN receipts; putaway; picks; shipments; cycle counts. Every stock move emits auditable events.

## docs/modules/inventory-wms.md
- kind: markdown
-   Inventory & WMS Module (#inventory-wms-module) — Products, UoM, locations, lots/serials; ASN receipts; putaway; picks; shipments; cycle counts. Every stock move emits auditable events.

## docs/modules/manufacturing.md
- kind: markdown
-   Manufacturing Module (#manufacturing-module) — BOMs, routings, work orders; component issues; operations; WIP; completion; cost roll‑ups; variance and scrap handling.

## docs/modules/manufacturing.md
- kind: markdown
-   Manufacturing Module (#manufacturing-module) — BOMs, routings, work orders; component issues; operations; WIP; completion; cost roll‑ups; variance and scrap handling.

## docs/modules/sales-crm.md
- kind: markdown
-   Sales & CRM Module (#sales-crm-module) — Lead→opportunity→quote→order→invoice. Pipelines with stages and probabilities, activities and reminders, price lists and discounts; stock‑aware quoting.

## docs/modules/sales-crm.md
- kind: markdown
-   Sales & CRM Module (#sales-crm-module) — Lead→opportunity→quote→order→invoice. Pipelines with stages and probabilities, activities and reminders, price lists and discounts; stock‑aware quoting.

## docs/modules/projects.md
- kind: markdown
-   Projects Module (#projects-module) — Tasks, timesheets, expenses, approvals; billing (fixed/T&M); revenue recognition; budget vs actuals.

## docs/modules/projects.md
- kind: markdown
-   Projects Module (#projects-module) — Tasks, timesheets, expenses, approvals; billing (fixed/T&M); revenue recognition; budget vs actuals.

## docs/modules/hr-payroll.md
- kind: markdown
-   HR & Payroll Module (#hr-payroll-module) — People, roles, leave; payroll runs produce journals and evidence for Finance.

## docs/modules/hr-payroll.md
- kind: markdown
-   HR & Payroll Module (#hr-payroll-module) — People, roles, leave; payroll runs produce journals and evidence for Finance.

## docs/modules/purchasing.md
- kind: markdown
-   Purchasing Module (#purchasing-module) — Requisition→approval→PO→receipt/return→bill→3‑way match→payment. Supplier performance metrics and price variance analysis.

## docs/modules/purchasing.md
- kind: markdown
-   Purchasing Module (#purchasing-module) — Requisition→approval→PO→receipt/return→bill→3‑way match→payment. Supplier performance metrics and price variance analysis.

## docs/processes/order-to-cash.md
- kind: markdown
-   Order to Cash (#order-to-cash) — Quote→Order→Pick/Ship→Invoice→Cash; credit checks, approvals and AR reconciliation.

## docs/processes/order-to-cash.md
- kind: markdown
-   Order to Cash (#order-to-cash) — Quote→Order→Pick/Ship→Invoice→Cash; credit checks, approvals and AR reconciliation.

## docs/processes/procure-to-pay.md
- kind: markdown
-   Procure to Pay (#procure-to-pay) — Requisition→PO→Receipt→Bill→Match→Payment; budget checks, approvals and AP reconciliation.

## docs/processes/procure-to-pay.md
- kind: markdown
-   Procure to Pay (#procure-to-pay) — Requisition→PO→Receipt→Bill→Match→Payment; budget checks, approvals and AP reconciliation.

## docs/processes/make-to-stock.md
- kind: markdown
-   Make to Stock (#make-to-stock) — Plan→produce→store→dispatch; variance and scrap recorded with approvals.

## docs/processes/make-to-stock.md
- kind: markdown
-   Make to Stock (#make-to-stock) — Plan→produce→store→dispatch; variance and scrap recorded with approvals.

## docs/processes/project-billing.md
- kind: markdown
-   Project Billing (#project-billing) — Milestones or T&M → approval → invoice → revenue recognition.

## docs/processes/project-billing.md
- kind: markdown
-   Project Billing (#project-billing) — Milestones or T&M → approval → invoice → revenue recognition.

## docs/processes/vat-uk-mtd.md
- kind: markdown
-   VAT (UK MTD) (#vat-uk-mtd) — Obligations→prepare→submit→payment; retain evidence.

## docs/processes/vat-uk-mtd.md
- kind: markdown
-   VAT (UK MTD) (#vat-uk-mtd) — Obligations→prepare→submit→payment; retain evidence.

## docs/nexa/AI-ENGINE-CONTRACT.md
- kind: markdown
-   Nexa AI Engine — Contract (Pre‑Migration, Read‑Only) (#nexa-ai-engine-contract-premigration-readonly) — Scope (this phase)

## docs/nexa/ai-engine-behaviour.md
- kind: markdown
-   AI Engine Behaviour (#ai-engine-behaviour) — **Last updated:** 2025-11-29
-     Overview (#overview) — The Nexa AI Engine provides operational assistance across ERP modules. It is designed to be data-backed, truthful, and constrained to prevent inappropriate responses.
-       Core Principles (#core-principles) — - **Read-only:** AI does not perform writes or side-effects
-     Capabilities (#capabilities) — no summary
-       Supported Use Cases (#supported-use-cases) — **Data Q&A Across Modules:**
-       Use of Chat and DMS Content (#use-of-chat-and-dms-content) — **Current Implementation:**
-       Nexa Chat and Calls Integration (#nexa-chat-and-calls-integration) — **Chat Messages:**
-     Limits (#limits) — no summary
-       What AI Does Not Do (#what-ai-does-not-do) — **Clinical Decisions:**
-       When AI Should Say "I Don't Know" (#when-ai-should-say-i-dont-know) — **Missing Data:**
-     Healthcare Constraints (#healthcare-constraints) — no summary
-       Healthcare Mode (#healthcare-mode) — **When Enabled:**
-     Evaluation (#evaluation) — no summary
-       Golden Prompts (#golden-prompts) — **Purpose:**
-       Known Safe Patterns (#known-safe-patterns) — **Finance Queries:**
-       Known Limitations and Edge Cases (#known-limitations-and-edge-cases) — **FX Conversion:**
-     AI User Preferences (#ai-user-preferences) — no summary
-       How Preferences Affect AI (#how-preferences-affect-ai) — **Role:**
-     Logging and Audit (#logging-and-audit) — no summary
-       AI Logging (#ai-logging) — **What is Logged:**
-       Access to AI Logs (#access-to-ai-logs) — **Users:**
-     Rate Limiting (#rate-limiting) — no summary
-       Rate Limits (#rate-limits) — - AI queries are rate-limited per tenant: `rateLimitTenant("ai-query", tenantId, userId)`
-       Token Caps (#token-caps) — - Token caps are enforced per request and per user (if implemented)
-     Related Documentation (#related-documentation) — - [Profile, Tenant, and AI Preferences](./profile-tenant-ai-preferences.md) — User AI preferences
-     Notes (#notes) — - AI engine is read-only and does not perform writes or side-effects

## docs/nexa/AI-ENGINE-CONTRACT.md
- kind: markdown
-   Nexa AI Engine — Contract (Pre‑Migration, Read‑Only) (#nexa-ai-engine-contract-premigration-readonly) — Scope (this phase)

## docs/nexa/ai-engine-behaviour.md
- kind: markdown
-   AI Engine Behaviour (#ai-engine-behaviour) — **Last updated:** 2025-11-29
-     Overview (#overview) — The Nexa AI Engine provides operational assistance across ERP modules. It is designed to be data-backed, truthful, and constrained to prevent inappropriate responses.
-       Core Principles (#core-principles) — - **Read-only:** AI does not perform writes or side-effects
-     Capabilities (#capabilities) — no summary
-       Supported Use Cases (#supported-use-cases) — **Data Q&A Across Modules:**
-       Use of Chat and DMS Content (#use-of-chat-and-dms-content) — **Current Implementation:**
-       Nexa Chat and Calls Integration (#nexa-chat-and-calls-integration) — **Chat Messages:**
-     Limits (#limits) — no summary
-       What AI Does Not Do (#what-ai-does-not-do) — **Clinical Decisions:**
-       When AI Should Say "I Don't Know" (#when-ai-should-say-i-dont-know) — **Missing Data:**
-     Healthcare Constraints (#healthcare-constraints) — no summary
-       Healthcare Mode (#healthcare-mode) — **When Enabled:**
-     Evaluation (#evaluation) — no summary
-       Golden Prompts (#golden-prompts) — **Purpose:**
-       Known Safe Patterns (#known-safe-patterns) — **Finance Queries:**
-       Known Limitations and Edge Cases (#known-limitations-and-edge-cases) — **FX Conversion:**
-     AI User Preferences (#ai-user-preferences) — no summary
-       How Preferences Affect AI (#how-preferences-affect-ai) — **Role:**
-     Logging and Audit (#logging-and-audit) — no summary
-       AI Logging (#ai-logging) — **What is Logged:**
-       Access to AI Logs (#access-to-ai-logs) — **Users:**
-     Rate Limiting (#rate-limiting) — no summary
-       Rate Limits (#rate-limits) — - AI queries are rate-limited per tenant: `rateLimitTenant("ai-query", tenantId, userId)`
-       Token Caps (#token-caps) — - Token caps are enforced per request and per user (if implemented)
-     Related Documentation (#related-documentation) — - [Profile, Tenant, and AI Preferences](./profile-tenant-ai-preferences.md) — User AI preferences
-     Notes (#notes) — - AI engine is read-only and does not perform writes or side-effects

## docs/qa/task-l-module-verification-matrix.md
- kind: markdown
- sections: none

## docs/qa/task-l-module-verification-matrix.md
- kind: markdown
- sections: none

## docs/technical/api-overview.md
- kind: markdown
-   API Overview (#api-overview) — - Auth: session cookies (web) and OAuth2/Bearer tokens (service). Rate limits per IP/key.

## docs/technical/data-model-and-integrations.md
- kind: markdown
-   Data Model & Integrations (#data-model-integrations) — no summary
-     Core entities (#core-entities) — - Party (customer/supplier); Product; Location; Order (sales/purchase)
-     Posting & reconciliation (#posting-reconciliation) — - Documents post to journals via rules; journals summarise to ledgers.
-     Connectors (#connectors) — - Stripe payments; TrueLayer banking; HMRC VAT (MTD). All inbound webhooks are authenticated and idempotent.

## docs/technical/api-overview.md
- kind: markdown
-   API Overview (#api-overview) — - Auth: session cookies (web) and OAuth2/Bearer tokens (service). Rate limits per IP/key.

## docs/technical/data-model-and-integrations.md
- kind: markdown
-   Data Model & Integrations (#data-model-integrations) — no summary
-     Core entities (#core-entities) — - Party (customer/supplier); Product; Location; Order (sales/purchase)
-     Posting & reconciliation (#posting-reconciliation) — - Documents post to journals via rules; journals summarise to ledgers.
-     Connectors (#connectors) — - Stripe payments; TrueLayer banking; HMRC VAT (MTD). All inbound webhooks are authenticated and idempotent.

## docs/technical/runtime-and-deployments.md
- kind: markdown
-   Runtime & Deployments (#runtime-deployments) — 1. `pnpm install` and `pnpm -r build` (per‑package artefacts)

## docs/technical/runtime-and-deployments.md
- kind: markdown
-   Runtime & Deployments (#runtime-deployments) — 1. `pnpm install` and `pnpm -r build` (per‑package artefacts)

## docs/verification/prod-smoke.md
- kind: markdown
-   Prod Smoke Verification (Live) (#prod-smoke-verification-live) — no summary
-     Overview (#overview) — - Runner: `bash ${ROOT_DIR:-/Users/waheedraja/NexaLocal/Nexa ERP}/scripts/verification/run_prod_smoke.sh`
-     Environment (#environment) — - Required: `PROD_BASE_URL` (e.g. `https://app.nexaai.co.uk`)
-     What Runs (#what-runs) — 1) API checks (Vitest) — read-only coverage of module list endpoints and RBAC.
-     Modes (#modes) — - Read-only (default): `PROD_SMOKE_WRITE` unset or `0`; flow tests are marked `SKIP`.
-     Interpreting Results (#interpreting-results) — - `summary.md` lists per-module and per-flow PASS/FAIL/SKIP with evidence locations.
-     Example (#example) — ```bash
-   Read-only (#read-only) — PROD_BASE_URL="https://app.nexaai.co.uk" \
-   Write-mode (PROD_TEST_TENANT_SLUG required) (#write-mode-prod_test_tenant_slug-required) — PROD_BASE_URL="https://app.nexaai.co.uk" \

## docs/verification/prod-smoke.md
- kind: markdown
-   Prod Smoke Verification (Live) (#prod-smoke-verification-live) — no summary
-     Overview (#overview) — - Runner: `bash ${ROOT_DIR:-/Users/waheedraja/NexaLocal/Nexa ERP}/scripts/verification/run_prod_smoke.sh`
-     Environment (#environment) — - Required: `PROD_BASE_URL` (e.g. `https://app.nexaai.co.uk`)
-     What Runs (#what-runs) — 1) API checks (Vitest) — read-only coverage of module list endpoints and RBAC.
-     Modes (#modes) — - Read-only (default): `PROD_SMOKE_WRITE` unset or `0`; flow tests are marked `SKIP`.
-     Interpreting Results (#interpreting-results) — - `summary.md` lists per-module and per-flow PASS/FAIL/SKIP with evidence locations.
-     Example (#example) — ```bash
-   Read-only (#read-only) — PROD_BASE_URL="https://app.nexaai.co.uk" \
-   Write-mode (PROD_TEST_TENANT_SLUG required) (#write-mode-prod_test_tenant_slug-required) — PROD_BASE_URL="https://app.nexaai.co.uk" \