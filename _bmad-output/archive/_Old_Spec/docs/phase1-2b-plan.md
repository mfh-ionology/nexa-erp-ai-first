# Phase 1.2b plan — API suite + DB bootstrap baseline

No prior Phase 1.2b plan was present; this canonical plan is derived from the current `test:api` configuration, DB bootstrap helpers, and CI workflow expectations.

## API suite included in `pnpm -C apps/web test:api`
- apps/web/vitest.config.api.ts (entry)
- apps/web/tests/api/metrics.test.ts
- apps/web/tests/api/hardening.api.test.ts
- apps/web/tests/api/finance.gl.test.ts
- apps/web/tests/api/kpis.api.test.ts
- apps/web/tests/api/kpis.contract.test.ts
- apps/web/tests/api/banking.test.ts
- apps/web/tests/api/security.headers.test.ts
- apps/web/tests/smokes/auth-smoke.test.ts
- apps/web/tests/modules.api.contract.api.test.ts
- apps/web/tests/kpi.api.contract.api.test.ts
- apps/web/tests/pos.printers.test.ts

## DB bootstrap helpers and schema handling
- prisma/schema.prisma — authoritative schema used by bootstrap/seed.
- apps/web/tests/helpers/test-db-bootstrap.ts — computes safe TEST_DATABASE_URL, enforces schema safety, runs prisma generate/db push/seed/users bootstrap.
- apps/web/tests/helpers/api-test-helpers.ts — ensures test DB ready and exposes canonical users/tenants for API tests.
- apps/web/tests/setup.ts — Vitest setup ensuring env wiring and bootstrap gating.
- apps/web/tests/setup/global-test-setup.ts — Vitest global setup invoked by vitest.config.ts before suites.

## CI workflow expectations (Phase 1.2b)
- .github/workflows/ci.yml step "Run API suite (Phase 5 excluded)" runs `cd apps/web && pnpm -s test:api` with:
  - TEST_DATABASE_URL / DATABASE_URL / PRISMA_DATABASE_URL = postgresql://postgres:postgres@localhost:5432/nexa_vitest?schema=phase1_ci
  - TEST_DB_FORCE_RESET=1, USE_PRESEEDED_TEST_DB=1, CI_DB=1, CI=true
  - TEST_BASE_URL=http://localhost:3000 to exercise API routes

## Required environment for test:api and bootstrap (local + CI)
- TEST_DATABASE_URL (preferred) or DATABASE_URL pointing to devtest DB; schema set/validated for safety.
- PRISMA_DATABASE_URL mirrors TEST_DATABASE_URL for Prisma clients.
- TEST_DB_FORCE_RESET to allow force-reset of schema (set to "1" in CI).
- USE_PRESEEDED_TEST_DB (default "1"; set "0" to force bootstrap), CI_DB flag in CI.
- NEXA_SEED_PROFILE="ci" during bootstrap; CI flag when running in CI.
- Consent gate for destructive reset when prompted locally: PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes".
- Optional gates: SKIP_DB_BOOTSTRAP_FOR_BILLING, SKIP_DB_BOOTSTRAP_FOR_STAFF, SKIP_DB_BOOTSTRAP_FOR_DASHBOARD, VITEST_SKIP_DB=1 to skip bootstrap.
- Local runs must use TEST_DATABASE_URL pointed at localhost (e.g., via .env.test); non-local hosts are blocked unless ALLOW_REMOTE_TEST_DB=1 is explicitly set for exceptional cases.

## Schema handling expectations
- Bootstrap runs `pnpm -w exec prisma generate` and `pnpm -w exec prisma db push` (force reset when TEST_DB_FORCE_RESET=1 or CI) using `prisma/schema.prisma`, then `pnpm -w exec prisma db seed` and `pnpm -w tsx scripts/seed_users_table.ts`.
- Bootstrap refuses unsafe hosts/db names, avoids schema=public, and uses per-run schema isolation in CI derived from TEST_DATABASE_URL.
