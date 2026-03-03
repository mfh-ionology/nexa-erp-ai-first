# Cleanup all tenant domain data

**Destructive**: wipes all tenant-scoped domain/transactional data for every tenant while keeping tenants and users intact. Intended for ops use only.

## Guard

Requires env flag:

```
CLEANUP_ALL_TENANT_DATA=YES_I_UNDERSTAND
```

## Run (production/staging)

From repo root with `DATABASE_URL` pointed at the target DB:

```bash
cd apps/web
CLEANUP_ALL_TENANT_DATA=YES_I_UNDERSTAND pnpm ts-node scripts/ops/cleanup-all-tenant-data.ts
```

What it does:

- Iterates all tenants.
- Deletes tenant-scoped domain data (children → parents → master) such as movements, lines, orders, invoices, items, customers, etc.
- Does **not** delete tenants or users (platform/root structure is preserved).

Use this before reseeding a minimal demo or to ensure all non-demo tenants are clean.

