Last updated: 2025-11-14

Purpose
- Add billing lifecycle fields to `Tenant` for Stripe integration and enforcement.

Who should read this
- Platform/Ops and DBAs applying migrations to Neon (staging / prod).

Schema diff (Prisma)
```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // NEW (Task 2 migration only)
  stripeCustomerId     String?       @map("stripe_customer_id")
  stripeSubscriptionId String?       @map("stripe_subscription_id")
  billingStatus        BillingStatus @default(trial) @map("billing_status")

  @@index([stripeCustomerId])
  @@index([billingStatus])
}

enum BillingStatus {
  trial
  active
  past_due
  cancelled
}
```

Commands
```bash
# Do not paste real secrets here.
cd /Users/waheedraja/Desktop/Business\\ Opportunities/Nexa\\ ERP
pnpm -w prisma generate
pnpm -w prisma migrate dev -n \"phase5_billing_lifecycle\" # for local/dev only

# Staging/Prod (apply migration SQL via Prisma or manual SQL)
pnpm -w prisma migrate deploy
```

Backfill
```sql
-- Default all existing tenants to trial
update "Tenant" set billing_status = 'trial' where billing_status is null;
```

Neon / Staging apply
1) Create a restore/validation branch from staging if desired (see ops/dr-restore.md)
2) Set DATABASE_URL to staging
3) Run `pnpm -w prisma migrate deploy`
4) Run backfill SQL
5) Verify with `/api/billing/schema-ready` (200, { ready: true })
6) Verify webhook transitions by sending Stripe test webhooks

Notes
- Enforcement in code uses raw SQL fallbacks and is safe when columns are absent (treated as `trial`).
- After migration is live, the Stripe webhook will update `billing_status` based on events.
- Playwright tests will auto-skip lifecycle checks if schema not ready.


