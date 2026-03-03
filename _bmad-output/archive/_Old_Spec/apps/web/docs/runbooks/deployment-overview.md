## Deployment Overview

Architecture
- Next.js App Router app deployed to Vercel (project: nexa-erp-reset; alias: app.nexaai.co.uk).
- Backend uses Neon Postgres; Prisma client generated from checked-in schema (no local schema changes for P13).
- pnpm workspace; Node 20; App Router with API routes for backend services.

Process (high level)
- Build: `pnpm -C apps/web build`
- Tests before deploy: harness commands in `docs/runbooks/tests-and-harness.md`.
- Env/config: set via Vercel/secret stores (do not commit secrets); `DATABASE_URL` points to Neon; AI keys managed via env.
- No CI/CD changes in P13; follow existing Vercel pipeline and protections (CSP, HSTS, rate limits) per repo config.




