# Phase 3 — Banking & Cash (Slice 3.4)

- Branch: `phase3/main`
- UTC timestamp: 2026-01-15T14:12:05Z
- Git SHA: `66381c7`
- Evidence folder: `reports/verification/phase3-banking_cash-20260115-141205`
- Note: BASE_REF for slice boundaries: `eac5ff0`

## Endpoints
- `GET/POST /api/finance/banking/accounts`
- `GET/PATCH /api/finance/banking/accounts/[accountId]`
- `GET/POST /api/finance/banking/transactions` (POST = CSV/import)
- `GET /api/finance/banking/transactions/[txnId]`
- `POST /api/finance/banking/transactions/[txnId]/reconcile`
- `POST /api/finance/banking/transactions/[txnId]/unreconcile`

## UI Routes
- `/finance/banking`
- `/finance/banking/accounts`
- `/finance/banking/transactions`
- `/finance/banking/reconcile`

## Permissions & Gates
- Module gate: `finance`
- Read: `ui:finance_reports:view`
- Manage: `finance:post_journal`

## Seed / Unseed / Verifier
- Seed: `scripts/qa/seed_banking_cash.ts` (runId-tagged; creates 1 bank account, 3 transactions with 1 reconciled via supplier payment reference).
- Unseed: `scripts/qa/unseed_banking_cash.ts` (removes runId-tagged accounts/transactions/supplier/payment and reconciliation metadata).
- Verifier: `scripts/verification/verify_phase3_banking_cash.mjs` (DB-backed; fails hard if DB unreachable unless ALLOW_INMEM_FALLBACK=1).

## Commands Run (PASS)
- `pnpm -s spec:coverage`
- `TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase3_main_banking_db01' SLICE_KEY=banking_cash BASE_REF=70476ca bash scripts/verification/run_phase3_slice.sh`
