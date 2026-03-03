# Phase 3.11 — manufacturing_core

- BASE_REF: `2583c3c`
- HEAD: `74e3127`
- Slice: `manufacturing_core`
- Evidence: `reports/verification/phase3-manufacturing_core-20260115-212147`

## Permissions & module gate
- Read: `ui:finance_reports:view`
- Manage: `mfg:consume_bom`
- Module gate: `assertModuleEnabled('inventory')` (v1 coupling; manufacturing module gate not available)

## Endpoints
- BOMs: `GET/POST /api/manufacturing/boms`; `GET/PATCH /api/manufacturing/boms/[bomId]`; `POST /api/manufacturing/boms/[bomId]/activate`; `POST /api/manufacturing/boms/[bomId]/deactivate`
- Work orders: `GET/POST /api/manufacturing/work-orders`; `GET/PATCH /api/manufacturing/work-orders/[id]`; `POST /api/manufacturing/work-orders/[id]/release`; `POST /api/manufacturing/work-orders/[id]/start`; `POST /api/manufacturing/work-orders/[id]/complete`; `POST /api/manufacturing/work-orders/[id]/cancel`
- Schedules: `GET/POST /api/manufacturing/schedules`; `GET/PATCH /api/manufacturing/schedules/[scheduleId]`; `POST /api/manufacturing/schedules/[scheduleId]/start`; `POST /api/manufacturing/schedules/[scheduleId]/done`; `POST /api/manufacturing/schedules/[scheduleId]/cancel`

## UI routes
- `/manufacturing` entry
- `/manufacturing/boms`
- `/manufacturing/work-orders`
- `/manufacturing/work-orders/[id]`
- `/manufacturing/schedules`
- `/manufacturing/schedules/[scheduleId]`

## Lifecycle and rules
- BOM: only one active per finished good; components carry qtyPer and optional scrapPct (0–100).
- Work orders: draft → released → in_progress → completed/cancelled; release snapshots BOM; complete is idempotent and consumes components, produces FG via stock moves.
- Schedules: planned → started → done/cancelled (no stock impact).

## Inventory integration & quarantine
- Component consumption posts `issue` stock moves; finished good completion posts `receive` moves via inventory ledger.
- Availability uses WMS `getAvailableQty` when present (quarantine-aware), falling back to on-hand.

## Seed / unseed / verifier
- Seed (`scripts/qa/seed_manufacturing_core.ts`): creates tenant + warehouse + FG/C1/C2 items, seeds component stock, creates/activates BOM, creates WO (qty 5) release/start/complete, attempts second WO completion to assert insufficient stock handling; writes run report.
- Unseed (`scripts/qa/unseed_manufacturing_core.ts`): deletes stock moves, WOs, BOM items, items, warehouses, tenant config, and tenant by `RUN_ID`.
- Verifier (`scripts/verification/verify_phase3_manufacturing_core.mjs`): uses TEST_DATABASE_URL; runs seed; asserts one active BOM per FG; checks stock move totals (non-negative), enforces insufficient stock path; runs unseed and confirms cleanup.

## Evidence / commands
- Evidence folder: `reports/verification/phase3-manufacturing_core-20260115-211033`
- Commands executed:
  - `pnpm -s spec:coverage`
  - `TEST_DATABASE_URL=... SLICE_KEY=manufacturing_core BASE_REF=2583c3c bash scripts/verification/run_phase3_slice.sh`
