# DEV Database Reset — FLAT-WILDFLOWER

**Purpose:** How to reset and align the FLAT-WILDFLOWER dev DB schema with the current Prisma schema.

⚠️ **WARNING:** This procedure is **DEV-ONLY** and must **NEVER** be used against the production/mute-mode database.

## Safety Checks

This procedure is safe because:
- It only runs against databases with hostname containing `ep-flat-wildflower`
- It refuses to run if `DATABASE_URL` points to production (`ep-mute-mode-...`)
- The dev database is intentionally reset and recreated for testing

## Prerequisites

1. Ensure you have access to the FLAT-WILDFLOWER dev database credentials
2. Ensure `DATABASE_URL` is set to point at the dev database (not production)
3. Ensure you're in the `apps/web` directory

## Procedure

### Step 1: Set Environment Variables

```bash
cd /Users/waheedraja/NexaLocal/Nexa\ ERP/apps/web

export DATABASE_URL='postgresql://neondb_owner:npg_1icot3sHLxRz@ep-flat-wildflower-abzlxddv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

export SHADOW_DATABASE_URL='postgresql://neondb_owner:npg_1icot3sHLxRz@ep-flat-wildflower-abzlxddv-pooler.eu-west-2.aws.neon.tech/neondb_shadow?sslmode=require&channel_binding=require'

# Verify the host is ep-flat-wildflower-..., not ep-mute-mode-...
echo "$DATABASE_URL" | grep -q "ep-flat-wildflower" && echo "✅ Dev DB confirmed" || echo "❌ Wrong database!"
```

### Step 2: Reset TenantIntegrationConfig Table

```bash
pnpm dev:reset-tenant-integration-config
```

**Expected output:**
```
✅ DATABASE_URL verified: pointing at FLAT-WILDFLOWER dev database
   Proceeding with TenantIntegrationConfig table drop...

✅ Connected to database
🗑️  Dropping TenantIntegrationConfig table...
✅ TenantIntegrationConfig table dropped successfully

📝 Next steps:
   1. Run: pnpm dlx prisma@6.16.2 db push
   2. Run: pnpm seed
   3. (Optional) Run: pnpm test:erp-smoke
```

**If the script refuses to run:**
- Check that `DATABASE_URL` contains `ep-flat-wildflower`
- Do NOT proceed if it points to `ep-mute-mode-...` (production)

### Step 3: Push Schema Changes

```bash
pnpm dlx prisma@6.16.2 db push
```

**Expected behavior:**
- Prisma may warn about data loss for `TenantIntegrationConfig` — answer `yes`
- `db push` should complete without the `TenantIntegrationConfig_tenant_id_key` error
- Schema should be aligned with `prisma/schema.prisma`

### Step 4: Seed Database

```bash
pnpm seed
```

**Expected behavior:**
- Seed script runs without schema errors
- Tenant and TenantIntegrationConfig tables are created correctly
- Canonical users and demo tenants are seeded

**Note:** If seed fails with foreign key constraint errors (e.g., `CustomerInvoice_customerId_fkey`), this indicates a seed script ordering issue (dependencies not created before dependents). This is separate from the schema sync issue and should be fixed in the seed script itself.

### Step 5: (Optional) Run Smoke Tests

```bash
pnpm test:erp-smoke
```

**Expected behavior:**
- Smoke tests run successfully
- All core ERP modules can create and verify records

## Troubleshooting

### Error: "Refusing to run: DATABASE_URL is not pointing at the FLAT-WILDFLOWER dev DB"

**Solution:** Check your `DATABASE_URL` environment variable. It must contain `ep-flat-wildflower` in the hostname.

### Error: "TenantIntegrationConfig_tenant_id_key" still appears

**Solution:** Ensure the reset script ran successfully before `db push`. The table must be dropped first.

### Error: Schema sync fails after reset

**Solution:** 
1. Verify `SHADOW_DATABASE_URL` is set correctly
2. Try running `pnpm dlx prisma@6.16.2 db push --force-reset` (⚠️ this will drop all tables)
3. Re-run seed script

## Related Files

- Script: `apps/web/scripts/dev/reset-tenant-integration-config.ts`
- Schema: `apps/web/prisma/schema.prisma`
- Seed: `apps/web/scripts/seed/index.ts`

## Notes

- This procedure deliberately drops and recreates `TenantIntegrationConfig` in the dev database
- Production database (`ep-mute-mode-...`) is never touched by this procedure
- The reset script includes safety checks to prevent accidental production DB modifications

