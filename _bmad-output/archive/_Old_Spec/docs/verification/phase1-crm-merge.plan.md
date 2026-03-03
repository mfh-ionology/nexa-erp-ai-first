# Phase1 CRM Merge — Plan

## Canonical locations
- Schema: `apps/web/prisma/schema.prisma` (root symlink `prisma/schema.prisma`)
- Prisma client: `apps/web/src/lib/prisma.ts` (single instantiation)
- Server services: `apps/web/src/server/crm/*` (accounts, contacts, leads, opportunities, quotes, activities, pipelines, price-books)
- API routes: `apps/web/app/api/crm/*`
- UI routes: `apps/web/app/(app)/crm/*` (lists + detail)

## Legacy aliases
- UI:
  - `/sales` → `/crm`
  - `/sales/customers` → `/crm/accounts`
  - `/sales/leads` → `/crm/leads`
  - `/sales/opportunities` → `/crm/opportunities`
  - `/sales/quotes` → `/crm/quotes`
  - `/sales/orders` → `/crm/opportunities` (until dedicated orders UI exists)
- API:
  - `/api/sales/orders`, `/api/sales/order/create|deliver`, `/api/sales/credit/create`, `/api/sales/invoice/from-order`, `/api/sales/reports/margin` → map/redirect to canonical `/api/crm/*` equivalents (create/list/update) or compatibility handlers calling canonical services.
- Server:
  - Any sales/* services should thin-wrap or alias to `src/server/crm/*` or be removed after mapping.

## Entities in scope
- Accounts
- Contacts
- Leads
- Opportunities
- Quotes
- Activities
- Pipelines/Stages
- Price books (if required by quotes)
- Orders (as alias via opportunities/quotes where needed)

## Work approach
1) Consolidate server modules under `src/server/crm/*`.
2) Wire canonical API under `app/api/crm/*`; add legacy sales/* aliases that delegate.
3) UI routes under `(app)/crm/*`; sales pages redirect/deprecate to canonical.
4) Ensure RBAC + tenant isolation preserved in canonical services.
5) QA seed/unseed + verifier operate only against canonical endpoints.
