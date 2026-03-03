# Phase 3 – payroll_uk_v1 verification

- **BASE_REF:** 1ec59db2
- **HEAD:** (current HEAD)
- **Slice:** `payroll_uk_v1`
- **Evidence:** `reports/verification/phase3-payroll_uk_v1-20260115-232805`

## Permissions & module gate
- READ: `ui:finance_reports:view`
- MANAGE: `inventory:manage`
- Module gate: `assertModuleEnabled('payroll')`
- Staff self-service: staff can view their own payslips only when employee.userId matches session; manage can view all; settings/pay-runs require MANAGE.

## Endpoints
- Settings: `GET/PUT /api/payroll/settings`; `GET/PUT /api/payroll/employees/[employeeId]/settings`
- Pay runs: `GET/POST /api/payroll/pay-runs`
- Pay run detail/actions: `GET/PATCH /api/payroll/pay-runs/[runId]`, `POST /api/payroll/pay-runs/[runId]/calculate`, `POST /api/payroll/pay-runs/[runId]/finalise`, `GET /api/payroll/pay-runs/[runId]/payslips`, `POST /api/payroll/pay-runs/[runId]/gl-draft`

## UI routes
- `/payroll` (landing)
- `/payroll/settings`
- `/payroll/pay-runs`
- `/payroll/pay-runs/[runId]`
- `/payroll/payslips`

## Calculation rules (v1 simplifications)
- Pay frequency: monthly only. Gross monthly = annualSalary / 12.
- PAYE: personal allowance 12,570/year (1,047.50/month). Taxable = max(0, gross - allowance). Tax = 20% of taxable (basic rate only).
- NI (category A): threshold 1,048/month. Employee NI = max(0, gross - threshold) * 12%. Employer NI = max(0, gross - threshold) * 13.8%.
- Pension: if enabled, employee deduction = gross * pensionEmployeePct; employer contribution = gross * pensionEmployerPct.
- Net pay = gross - tax - NI (employee) - pension employee.
- GL draft: Dr wages expense = gross + employer NI + employer pension; Cr PAYE liability = tax; Cr NI liability = NI employee + NI employer; Cr Pension liability = pension employee + pension employer; Cr Net wages payable = net. Draft must balance.
- Limitations: no higher-rate tax, no NI secondary thresholds/reliefs, monthly-only periods, no student loans/other deductions beyond above.

## Period-close enforcement
- Finalise pay run checks GL period open for pay date; closed period blocks finalise (uses periodClose data).

## Seed / unseed / verifier
- `scripts/qa/seed_payroll_uk_v1.ts`: creates tenant + two employees, configures payroll settings and GL mappings, creates monthly pay run, calculates, finalises, generates GL draft, stores payslip/meta.
- `scripts/qa/unseed_payroll_uk_v1.ts`: removes runId tenant, payslips/deductions/allowances, payroll runs/schedule, payrollUk TenantConfig keys.
- `scripts/verification/verify_phase3_payroll_uk_v1.mjs`: runs seed, asserts pay run finalised, GL draft balanced, finalise idempotency (second attempt 409), payslips exist, period-close lock blocks finalise for closed month, runs unseed and confirms cleanup. Uses `TEST_DATABASE_URL`.

## Commands executed
- `pnpm -s spec:coverage`
- `TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase3_main_payroll_db01' SLICE_KEY=payroll_uk_v1 BASE_REF=1ec59db2 bash scripts/verification/run_phase3_slice.sh`
