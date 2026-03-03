# Payroll UI

- Path: `/payroll`
- Actions:
  - Run Payroll (drawer) → POST /api/payroll/run
  - View Payslips → GET /api/payroll/payslips?runId=...
  - Export BACS → GET /api/payroll/export/bacs?runId=...
- Notes: RBAC via `x-role`, errors surfaced as toasts, accessible form labels.
- Mobile parity: Run Payroll form and recent payslips list.
