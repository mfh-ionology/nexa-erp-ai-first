# Architecture

- Monorepo (pnpm + Turborepo)
- apps/web (Next.js), apps/api (NestJS) — to be added later
- packages: core, ui, schemas
- DB: PostgreSQL; Cache/Queue: Redis


## Phase 1
- Domain services in `packages/core` for Finance & Payroll.
- API/UI to be added in Phase 2 (NestJS/Next.js).
