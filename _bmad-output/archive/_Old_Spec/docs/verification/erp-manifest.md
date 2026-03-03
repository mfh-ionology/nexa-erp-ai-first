# Nexa ERP Manifest (Phase 1 Baseline)

- Source files: see `docs/verification/plan-sources.md`
- Machine version: `docs/verification/erp-manifest.json`
- Scope: Finance, Inventory/WMS, Manufacturing, Sales/CRM, Projects/Timesheets, HR/Payroll, Super Admin/Tenant ops.

## Modules and Routes
- Finance: UI `/finance`, `/finance/invoices`, `/finance/payments`, `/finance/reports`; API `/api/finance/ar/invoices`, `/api/finance/ar/invoice/create`, `/api/finance/ar/invoice/approve`, `/api/finance/ar/invoice/pay`, `/api/finance/ar/receipts/create`, `/api/finance/ap/payments`, `/api/finance/inventory/valuation`.
- Inventory/WMS: UI `/inventory`, `/inventory/items`, `/inventory/wms/receiving`, `/inventory/stock-movements`, `/inventory/valuation`; API `/api/inventory/items`, `/api/inventory/grn`, `/api/inventory/wms/receiving/open-pos`, `/api/inventory/issue`, `/api/inventory/adjustments`, `/api/inventory/warehouses`.
- Manufacturing: UI `/manufacturing`, `/manufacturing/boms`, `/manufacturing/work-orders`; API `/api/manufacturing/boms`, `/api/manufacturing/work-orders`.
- Sales/CRM: UI `/sales`, `/sales/leads`, `/sales/opportunities`; API `/api/crm/activities`, `/api/crm/opportunities`.
- Projects/Timesheets: UI `/projects`, `/projects/timesheets`; API `/api/projects/timesheets`.
- HR/Payroll: UI `/hr`, `/hr/payroll`; API `/api/hr/payslips`.
- Super Admin/Tenant Ops: UI `/super-admin/dashboard`, `/super-admin/tenants`; API `/api/super-admin/tenants`.

## Entities (required fields and invariants)
- Finance: Invoice (tenantId, number, customerId, currency, total, balance, status, issuedAt; balanced ledger, idempotent number), Payment (tenantId, amount, currency, appliedTo; no over-apply), Journal (debits=credits).
- Inventory: Item (tenantId, sku, qtyOnHand; no cross-tenant leakage), StockMovement (tenantId, sku, qty, type; signed quantities, idempotent reference).
- Manufacturing: BOM (tenantId, parentItemCode, componentItemCode, quantity; no cycles), WorkOrder (tenantId, number, itemCode, quantity, status; consume before complete).
- Sales/CRM: Lead (tenantId, name, stage), Opportunity (tenantId, name, stage, amountMinor; stage progression), Activity log.
- Projects: Project (tenantId, code, name, status), Timesheet (tenantId, projectId, userId, hours, date, status; approval locks entry).
- HR/Payroll: Employee (tenantId, name, email), Payslip (tenantId, employeeId, period, gross, net; draft→final).
- Super Admin: Tenant (name, code, plan; modules per plan).

## Flows (required endpoints & outcomes)
- Finance invoice lifecycle: create → approve/post → pay/receipt; endpoints `/api/finance/ar/invoice/create`, `/api/finance/ar/invoice/approve`, `/api/finance/ar/invoice/pay`, `/api/finance/ar/receipts/create`, `/api/finance/ap/payments`; outputs posted invoice, balanced ledger, balance reduced.
- Inventory GRN + issue: endpoints `/api/inventory/grn`, `/api/inventory/issue`, `/api/inventory/adjustments`; outputs on-hand increase then decrease, valuation updated.
- Manufacturing BOM + WO complete: endpoints `/api/manufacturing/boms`, `/api/manufacturing/work-orders`; outputs components reduced, FG increased.
- CRM lead conversion: endpoints `/api/crm/activities`, `/api/crm/opportunities`; outputs opportunity created, activity logged.
- Projects timesheet approval: endpoint `/api/projects/timesheets`; outputs entry approved and locked.
- HR payslip generate: endpoint `/api/hr/payslips`; outputs payslip available, locked when final.
- Super admin tenant provision: endpoint `/api/super-admin/tenants`; outputs tenant and admin user created.

## Propagation expectations (events)
- Finance: `finance.ar.invoice_created`, `finance.ar.payments_listed`.
- Inventory: `inventory.items_listed`.
- Manufacturing: `mfg.work_orders_listed`.
- Sales/CRM: `crm.opportunities_listed`.
- Projects: `projects.timesheets_listed`.
- HR: `hr.payslips_listed`.
- Super Admin: `superadmin.tenants_listed`.

## RBAC (high level)
- All module APIs require authenticated ADMIN or STAFF for tenant; SUPER_ADMIN restricted from business modules except super-admin portal. Public only: login/forgot-password.

## Validation rules (summary)
- Tenant isolation on all APIs.
- Idempotency keys or natural keys on writes (invoice number, GRN reference).
- Ledger/journal balanced for finance postings.
- Status lifecycles respected (draft→posted→paid; planned→released→completed; draft→final).

Machine-readable detail lives in `docs/verification/erp-manifest.json`.

