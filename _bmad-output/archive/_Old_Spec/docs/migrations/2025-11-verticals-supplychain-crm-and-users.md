Last updated: 2025-11-15

Purpose
- Describe additive schema extensions for enterprise verticals, CRM/Sales, supply chain, workflow, and advanced user management.
- No migration is executed in this task. This is documentation only.

Who should read this
- Engineering leads and DBAs planning Task 2 migrations.

Schema diffs (proposed, additive)

1) User management
- Table UserPermission { id, userId, perm, grantedBy, grantedAt, tenantId? }
- Table UserModuleAccess { id, userId, module, enabled, tenantId? }
- Table SupportSession { id, adminUserId, targetUserId, reason, startedAt, endedAt, tenantId? }
- Indexes on (userId), (tenantId,userId)

2) Supply chain (complements existing WMS/quality)
- Table Rfq { id, tenantId, number unique, supplierId, status, createdAt, ... }
- Table Contract { id, tenantId, supplierId, code unique, terms Json, effectiveFrom, effectiveTo, status }
- Table SerialLot { id, tenantId, sku, serial, receivedAt, status }
- Table CycleCount { id, tenantId, warehouseId, scheduledFor, completedAt?, status }
- Table Rma { id, tenantId, docRef, customerId?, supplierId?, status, reason, outcome }
- Indexes on (tenantId, status), (tenantId, sku), (tenantId, supplierId)

3) CRM/Sales
- Table Lead { id, tenantId, email, name, score, ownerId, status, source, createdAt }
- Table Account { id, tenantId, name, domain, industry, size, ownerId }
- Table Contact { id, tenantId, accountId, email, name, phone, ownerId }
- Table Opportunity { id, tenantId, accountId, name, amount, stage, closeDate, ownerId, probability }
- Table Activity { id, tenantId, type, due, subject, body, ownerId, relatedId?, relatedType }
- Table Quote { id, tenantId, number unique, accountId, totalMinor, status }
- Table PriceBook { id, tenantId, name, currency, active }
- Table PriceBookItem { id, priceBookId, sku, priceMinor }
- Indexes on (tenantId, ownerId), (tenantId, accountId)

4) Healthcare
- Table Rota { id, tenantId, team, memberId, startAt, endAt, location, role }
- Table HealthcareQc { id, tenantId, sku?, lotId?, status, notes }
- Indexes on (tenantId, team), (tenantId, status)

5) Planning & budgeting
- Table Budget { id, tenantId, code, version, currency, status }
- Table BudgetLine { id, budgetId, dim1?, dim2?, account, amountMinor }
- Table Forecast { id, tenantId, code, period, valueMinor }
- Indexes on (tenantId, code), (budgetId)

Backfill and seed notes
- Seed services will populate core entities deterministically for one demo tenant.
- No destructive changes.

Apply steps (Task 2)
- Create Prisma models for above tables.
- Generate migrations:
  pnpm -w prisma generate
  pnpm -w prisma migrate dev -n "verticals-supplychain-crm-users"
- Seed/backfill scripts:
  pnpm -C apps/web seed
- Neon/staging apply:
  Use standard deploy pipeline; test e2e.


