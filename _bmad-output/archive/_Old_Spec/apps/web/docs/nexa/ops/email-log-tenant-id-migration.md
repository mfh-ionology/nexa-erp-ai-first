# EmailLog.tenantId migration (prod alignment)

The Prisma schema expects `EmailLog` to have a nullable `tenantId` column. If your production Neon DB is missing this column (seen as Prisma P2022 on `emailLog.create()`), run the standard Prisma migration deploy to add it.

## Steps

1) Ensure the migration that adds `tenantId` to `EmailLog` is present in `prisma/migrations` (e.g. `add_tenant_id_to_email_log`).

2) From repo root, pointing `DATABASE_URL` to production:

```bash
pnpm prisma migrate deploy
```

3) Verify in Neon that `EmailLog` now includes `tenantId`.

After the column exists, email logging will no longer hit P2022. Logging is also defensive and will not block email sending even if logging fails.

