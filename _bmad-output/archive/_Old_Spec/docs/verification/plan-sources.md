# Nexa ERP Plan Sources (Authoritative Inputs)

- `docs/nexa/ERP-GAP-CLOSURE-PLAN-2025-11.md` — master closure plan: required modules, flows, sequencing, completeness gates.
- `docs/modules/finance.md` — finance surface (AR/AP/GL, VAT, payments, invoicing) including expected routes and workflows.
- `docs/modules/inventory-wms.md` — inventory/WMS scope (items, receipts/GRN, movements, valuation).
- `docs/modules/manufacturing.md` — manufacturing scope (BOMs, work orders, consumption/completion, variance).
- `docs/modules/sales-crm.md` — CRM scope (leads, opportunities, activities).
- `docs/modules/projects.md` — projects/timesheets scope (projects, timesheets, approvals/billing expectations).
- `docs/modules/hr-payroll.md` — HR/Payroll scope (employees, payslips) and current expectations.
- `docs/modules/purchasing.md` — purchasing/procure-to-pay surface (supplier bills/POs) linked to finance and inventory.
- `docs/processes/order-to-cash.md` — end-to-end OTC flow (orders → invoice → payment/fulfilment) invariants.
- `docs/processes/procure-to-pay.md` — P2P flow (PO/GRN/bill/payment) invariants.
- `docs/processes/make-to-stock.md` — MTS/production alignment with manufacturing + inventory.
- `docs/processes/project-billing.md` — projects → timesheets → approvals → billing rules.
- `docs/processes/vat-uk-mtd.md` — VAT/MTD handling expectations and compliance.
- `docs/nexa/AI-ENGINE-CONTRACT.md` and `docs/nexa/ai-engine-behaviour.md` — realtime/AI event expectations and auditability.
- `docs/qa/task-l-module-verification-matrix.md` — verification matrix for module coverage and RBAC expectations.
- `docs/technical/api-overview.md` and `docs/technical/data-model-and-integrations.md` — API contract shape and integrations touchpoints.
- `docs/technical/runtime-and-deployments.md` — runtime concerns (SSR/ISR vs dynamic) that affect route behaviour.
- `docs/verification/prod-smoke.md` — live verification scope for authenticated routes and RBAC.

