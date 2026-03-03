# Phase 3 – Fixed Assets (register, schedules, drafts)

- BASE_REF: `afa8429`
- HEAD: `8d5d0fe`
- Slice: `fixed_assets`
- Evidence: `reports/verification/phase3-fixed_assets-20260115-181527`

## Scope
- Implements asset register CRUD (fields: assetId, name, category, acquisitionDate, placedInServiceDate, cost, salvageValue, usefulLifeMonths, depreciationMethod=straight_line, status, disposalDate, disposalProceeds, notes, createdAt/updatedAt).
- Generates deterministic monthly depreciation schedules with final-period rounding adjustment (remainder pushed into the last period).
- Depreciation run drafts only (Dr expense, Cr accumulated depreciation); mark recorded flags posted periods in `DepreciationSchedule`.
- Optional disposal draft (gain/loss) with user-supplied GL accounts.

## Data + Config
- Uses existing Prisma models: `FixedAsset`, `DepreciationSchedule`.
- Reads finance close lock from `TenantConfig.finance.close.lockedThrough` for enforcement; no schema changes.

## APIs
- `GET/POST /api/finance/assets`
- `GET/PATCH /api/finance/assets/[assetId]`
- `GET /api/finance/assets/[assetId]/schedule?asOf=YYYY-MM-DD`
- `POST /api/finance/assets/depreciate`
- `PATCH /api/finance/assets/depreciate` (mark recorded)
- `POST /api/finance/assets/[assetId]/dispose`

## Enforcement points
- Period close guard: `assertPeriodNotClosed` on depreciation drafts and disposal.
- Permission gates: `READ ui:finance_reports:view`, `MANAGE finance:post_journal`.

## Rounding
- Straight-line monthly; residual cents pushed into the last period so total depreciation equals (cost – salvage).

## Mark recorded
- `PATCH /api/finance/assets/depreciate` writes posted periods into `DepreciationSchedule` (idempotent upsert per asset/period). No auto-posting to GL; returns `{ ok: true }`.

## QA
- Seed: `scripts/qa/seed_fixed_assets.ts` (creates GL accounts, two assets, depreciation draft).
- Unseed: `scripts/qa/unseed_fixed_assets.ts`.
- Verifier: `scripts/verification/verify_phase3_fixed_assets.mjs` (CRUD, schedule totals/rounding, draft balance, period-close 409, cleanup).
