# Phase 3 — VAT MTD (Slice 3.5)

- Branch: `phase3/main`
- BASE_REF (fixed SHA for slice boundary checks): `72f79db`
- HEAD (slice commit): `344b09a`
- Evidence folder: `reports/verification/phase3-vat_mtd-20260115-145954`
- Note: Do not use moving refs like origin/phase3/main for BASE_REF.

## Endpoints
- `GET /api/finance/vat/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET/POST /api/finance/vat/returns`
- `GET /api/finance/vat/returns/[periodKey]`
- `POST /api/finance/vat/returns/[periodKey]/submit`

## UI Routes
- `/finance/vat`
- `/finance/vat/summary`
- `/finance/vat/returns`
- `/finance/vat/returns/[periodKey]`

## Permissions & Module Gate
- Module: `finance`
- Read: `ui:finance_reports:view`
- Manage: `finance:post_journal`

## TenantConfig keys
- `vat.returns[periodKey]` storing draft/submitted snapshots (`summary`, `from`, `to`, `status`, `createdAt`, `submittedAt`).

## Seed / Unseed / Verifier
- Seed: `scripts/qa/seed_vat_mtd.ts` (creates runId-tagged tenant, AR invoice with VAT, AP bill with VAT, and VAT draft in TenantConfig).
- Unseed: `scripts/qa/unseed_vat_mtd.ts` (removes runId-tagged VAT data and deletes the runId tenant/returns).
- Verifier: `scripts/verification/verify_phase3_vat_mtd.mjs` (DB-backed; fails hard if DB unreachable unless `ALLOW_INMEM_FALLBACK=1`; asserts summary totals, draft retrieval, submit idempotency, unseed cleanup).

## Commands Run (PASS)
- `pnpm -s spec:coverage`
- `TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase3_main_vat_db01' SLICE_KEY=vat_mtd BASE_REF=72f79db bash scripts/verification/run_phase3_slice.sh`
