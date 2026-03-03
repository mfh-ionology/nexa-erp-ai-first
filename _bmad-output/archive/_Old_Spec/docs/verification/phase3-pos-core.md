# Phase 3.15 – pos_core

- BASE_REF: `fcdc078`
- HEAD: `f87cf68`
- Slice: `pos_core`
- Evidence: `reports/verification/phase3-pos_core-20260115-235330`

## Permissions & Module Gate
- Module gate: `assertModuleEnabled('pos')`.
- READ permission: `ui:finance_reports:view`.
- MANAGE permission: `inventory:manage`.

## Endpoints
- Registers: `GET/POST /api/pos/registers`, `GET/PATCH /api/pos/registers/[registerId]`, `POST /api/pos/registers/[registerId]/open`, `POST /api/pos/registers/[registerId]/close`, `GET /api/pos/registers/[registerId]/cashup?from&to`.
- Receipts: `GET/POST /api/pos/receipts`, `GET /api/pos/receipts/[receiptId]`, `POST /api/pos/receipts/[receiptId]/void`.

## UI Routes
- `/pos` landing.
- `/pos/registers`, `/pos/registers/[registerId]`.
- `/pos/receipts`, `/pos/receipts/[receiptId]`.
- `/pos/cashup`.

## Behaviour Notes
- Registers are tenant-scoped with `active|inactive`; inactive blocks receipt creation.
- Receipts deterministic totals using Decimal; idempotent via `idempotencyKey` per register.
- Stock moves: sale posts `issue` moves from register warehouse; void posts `receive` to reverse (idempotent).
- Cash-up: totals per payment method for a date range.
- Data stored in `TenantConfig.pos.*` (no schema changes).

## Seed / Unseed / Verifier
- Seed `scripts/qa/seed_pos_core.ts`: creates tenant, warehouse, items, register; creates idempotent receipt then voids; creates second receipt for cash-up.
- Unseed `scripts/qa/unseed_pos_core.ts`: deletes runId tenant, items, stock moves, tenant config.
- Verifier `scripts/verification/verify_phase3_pos_core.mjs`: runs seed, asserts idempotent create/void, stock moves, cash-up totals, then unseed cleanup.

## Commands
- Slice gate (ran & passed):
  - `TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase3_main_pos_db01' SLICE_KEY=pos_core BASE_REF=fcdc078 bash scripts/verification/run_phase3_slice.sh`
