# Phase-7 Backend Overview

This document summarizes the Phase-7 backend additions: Payroll, Advanced WMS, Advanced MFG, CRM Sync (HubSpot), and Billing. All routes follow App Router conventions, use Zod validation, RBAC via `x-role` header, correlation IDs, and masked audit logging.

- Auth: NextAuth (credentials + optional Google/Microsoft)
- DB: Prisma Postgres (`DATABASE_URL` in apps/web/.env.local)
- Headers: `x-role: admin|user|superadmin`, optional `x-tenant-id`
- Responses: `{ ok: true, ... }` or `{ ok: false, code, message }`

Modules:
- Payroll: pay runs, payslips, BACS, payslip PDFs
- WMS: ASN, Putaway, Waves, Labels
- MFG: MRP, Capacity, APS
- CRM: HubSpot status + sync, mirror models
- Billing: Invoices list, webhook status, Stripe webhook handler

See module pages:
- Payroll: payroll.md
- WMS: wms.md
- MFG: mfg.md
- CRM: crm.md
- Billing: billing.md
- Observability: observability.md




