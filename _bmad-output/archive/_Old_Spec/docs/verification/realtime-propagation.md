# Realtime Propagation Map (Phase 1)

Source: plan docs listed in `docs/verification/plan-sources.md` and existing audit/event hooks in code.

- Finance
  - Events: `finance.ar.invoice_created`, `finance.ap.payments_listed`
  - Emitters: AR invoice create/approve/pay routes.
  - Subscribers: dashboards/KPI bands, finance lists, AR aging.
  - Expectation: invoice/payment lists refresh on event; balance/aging reflect after payment.

- Inventory/WMS
  - Events: `inventory.items_listed`
  - Emitters: inventory list/grn/issue endpoints.
  - Subscribers: inventory lists, valuation/KPI widgets.
  - Expectation: on-hand/valuation refresh after GRN/issue.

- Manufacturing
  - Events: `mfg.work_orders_listed`
  - Emitters: work order routes.
  - Subscribers: WO list, production dashboards.
  - Expectation: WO status/quantities update after consume/complete.

- Sales/CRM
  - Events: `crm.opportunity.stage.moved`
  - Emitters: opportunity/activity routes.
  - Subscribers: CRM pipeline boards, lead conversion dashboards.
  - Expectation: stage/probability reflected in pipeline views.

- Projects/Timesheets
  - Events: `projects.timesheet.approved`
  - Emitters: timesheet route.
  - Subscribers: project boards, approvals, billing readiness.
  - Expectation: approved entries lock and reflect in totals.

- HR/Payroll
  - Events: `hr.employees_listed`
  - Emitters: payslip route.
  - Subscribers: payroll list and employee profile pay tab.
  - Expectation: payslip status appears immediately after generation.

-- Super Admin / Tenant Ops
  - Events: `admin.users.listed`
  - Emitters: super-admin tenant create route.
  - Subscribers: super-admin tenant list/dashboard.
  - Expectation: new tenant visible immediately after creation.

Realtime channel: existing SSE/websocket/audit hooks; where realtime not available, minimum expectation is immediate refresh on next navigation/refresh.

