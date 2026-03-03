# Plan Catalog & Billing Backfill Runbook

## Overview
- BillingPlanTemplate is the plan catalog table (code, name, currency, priceMonthly, maxUsersTotal, features JSON, isActive).
- Tenants reference plans via `billingPlanCode` and can override via `customMaxUsersTotal` / `customPriceMonthly`.
- Dashboards and capacity/feature gating use the effective plan from plan template + tenant overrides.

## Canonical plans (seeded by bootstrap script)
- LEGACY: safe default for pre-Task-K tenants.
- STARTER: small footprint (~5 users), core modules on.
- GROWTH: mid-tier (~20 users), adds POS/chat/calls.
- ENTERPRISE: full modules, high user cap.
All plans use GBP by default and set features JSON modules booleans for gating.

## Scripts (guarded, idempotent)

### Plan Catalog bootstrap
- Path: `apps/web/scripts/seed/bootstrap-plan-catalog.ts`
- Guard: `PLAN_CATALOG_BOOTSTRAP=YES_I_UNDERSTAND`
- Command (example):
  - `cd apps/web`
  - `export NODE_ENV=production`
  - `export DATABASE_URL="postgresql://..."`
  - `PLAN_CATALOG_BOOTSTRAP=YES_I_UNDERSTAND pnpm tsx scripts/seed/bootstrap-plan-catalog.ts`
- Behavior: upserts canonical plans; does not delete unknown templates.

### Tenant plan/billing backfill
- Path: `apps/web/scripts/ops/backfill-tenant-plans-and-billing.ts`
- Guard: `TENANT_PLAN_BACKFILL=YES_I_UNDERSTAND`
- Command (example):
  - `cd apps/web`
  - `export NODE_ENV=production`
  - `export DATABASE_URL="postgresql://..."`
  - `TENANT_PLAN_BACKFILL=YES_I_UNDERSTAND pnpm tsx scripts/ops/backfill-tenant-plans-and-billing.ts`
- Behavior: for tenants missing `billingPlanCode`, assigns LEGACY and safe defaults (billingMethod INVOICE, billingStatus trial if null, billingDayOfMonth=1, nextBillingDate ~30 days if null). Preserves any existing non-null billing fields. Idempotent; skips tenants already set.

## Safety guidance
- Run in staging first; take a Neon snapshot before production.
- These scripts mutate tenant metadata; no demo data is created.
- Idempotent, but still operator-only; confirm DATABASE_URL is correct before running.

