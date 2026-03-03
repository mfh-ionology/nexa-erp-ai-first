# Architecture — How Nexa is built

## High‑level components
- Web (Next.js, App Router): UI, session, SSR/ISR, BFF endpoints, CSRF/CSP/HSTS.
- API (Node 22): domain services, posting rules, approvals, audit.
- Workers: queues for imports, statements, VAT returns, notifications.
- Data: Postgres (Prisma), Redis (cache/queues). Reverse proxy (Caddy/NGINX).

## Domain boundaries
Finance; Trade (orders/shipments/invoices); Inventory; People (users/roles/SoD); Projects; Manufacturing.

## Data rules
- Strong foreign keys; monetary values as minor units; timezone‑aware timestamps.
- Soft delete only for non‑financial entities; never for journals/ledgers.
- Optimistic concurrency on hot aggregates; idempotency keys for external writes.

## Multi‑tenancy & access
- Single tenant per instance by default; per‑tenant guard at repository layer.
- RBAC with role → permission mapping; SoD policies evaluated at runtime.

## Environments & deployment
- Local (compose), Staging, Production. Build once, promote; images tagged by SHA.
- Migrations applied with backups and smoke tests; blue‑green or rolling.

## Observability
- Structured logs with correlation IDs; metrics (latency, errors, queue depth, DB/Redis); health endpoints; dashboards and alerts.
