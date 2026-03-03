## Finance F3 — Migration Plan (Finance-only, safe)

Generated diff source: PROD direct DB → `apps/web/prisma/schema.prisma` (Prisma 5.20 diff, trimmed manually).

Migrations created:
- `apps/web/prisma/migrations/20251222150000_finance_alignment_safe/migration.sql`

What it changes (add/backfill/index only; no drops):
- Adds enum `PeriodStatus` and augments `PeriodClose` with periodKey/status/ledger flags/closed metadata plus unique index `(tenantId, periodKey)`.
- Adds missing finance fields on `SupplierBill` (billNumber, dueDate, currency, fxRate, subtotal, taxTotal, total, balance, status, postedAt, timestamps) and safe indexes.
- Creates finance detail tables absent in prod: `SupplierBillLine`, `SupplierCreditNote`, `SupplierCreditNoteLine`, `SupplierAllocation`, `SupplierWriteOff`, `SupplierPaymentRun`, `SupplierPaymentRunLine` with FKs/indexes.
- Extends `SupplierPayment` with supplierId/bankAccountId/paymentDate/currency/fxRate/allocated/unallocated/status/reference plus FKs and indexes; backfills defaults.
- Extends `CustomerPayment` with customerId/status/unallocatedAmount, relaxes invoiceId nullability, adds FKs and indexes; backfills defaults.
- Adds unique/index for `CustomerAllocation` (invoice/payment/creditNote).

Why safe for production:
- Only `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and FK additions guarded by existence checks.
- No `DROP COLUMN`, no `DROP INDEX`, no `SET NOT NULL`; existing columns retained.
- Backfills new columns with safe defaults and derived values to avoid null constraint issues.
- Idempotent via conditional checks; reruns will be no-ops where objects already exist.

Apply commands (production, using DIRECT URL):
1) `cd /Users/waheedraja/NexaLocal/Nexa ERP/apps/web`
2) `pnpm exec prisma migrate deploy`
3) `pnpm exec prisma migrate status`

