# Payroll (Phase-7)

API routes (App Router):
- POST /api/payroll/run → body { periodStart, periodEnd, scheduleId? } returns { ok, runId }
- GET  /api/payroll/payslips?runId=... → returns { ok, items: Payslip[] }
- GET  /api/payroll/export/bacs?runId=... → CSV stream

Auth/RBAC:
- Header `x-role: admin` required for POST and GET

Calculations:
- Implemented in `apps/web/src/server/payroll/` (PAYE, NI, Pension, Student Loan)
- BACS CSV in `server/payroll/bacs.ts`
- Payslip PDF in `server/payroll/payslip-pdf.ts`

Notes:
- Uses Prisma models `Employee`, `PaySchedule`, `PayrollRun`, `Payslip`
- Correlation ID and masked audit logging added in routes




