## Phase 3 — Period Close + FX Revaluation

- BASE_REF: `25a970c`
- HEAD: `82f8c5efd6c28b72a3224830125315b9cef4535c`
- Evidence: `reports/verification/phase3-period_close_fx-20260115-160145`

### Enforcement
- Period lock stored per-tenant in `finance.close` config; lock date is inclusive.
- AR: issuing invoices and recording receipts dated on/before the lock throws `period_closed` (409).
- AP: issuing bills and creating supplier payments dated on/before the lock throws `period_closed` (409).
- GL: posting journals dated on/before the lock throws `period_closed` (409).

### Enforcement points
- AR invoice issue: checks `issuedAt`
- AR receipt creation: checks `paidAt`
- AP bill issue: checks `billDate`
- AP payment creation: checks `paymentDate`
- GL journal post: checks `date`

### FX Assumptions
- Manual FX rates supplied by the user; no external feeds or caching.
- Exposure includes open AR/AP items with currency != tenant base currency.
- Revaluation builds an optional GL journal draft only; posting remains a separate GL action.

### Endpoints and Routes
- API: `GET /api/finance/close`, `POST /api/finance/close`, `POST /api/finance/close/clear`.
- API: `GET /api/finance/fx/exposure?asOf=YYYY-MM-DD`, `POST /api/finance/fx/revalue`.
- UI: `/finance/close`, `/finance/fx`, `/finance/fx/exposure`, `/finance/fx/revalue`.

### Seed / Unseed / Verifier
- Seed `scripts/qa/seed_period_close_fx.ts` creates a tenant close lock, AR/AP samples around the lock date, GL activity, and FX exposure with rates.
- Unseed `scripts/qa/unseed_period_close_fx.ts` removes seeded AR/AP/GL records and resets the close config for the runId.
- Verifier `scripts/verification/verify_phase3_period_close_fx.mjs` (DB-backed) checks lock set/get/clear, enforces 409s on blocked actions, validates FX exposure/reval outputs, and confirms unseed cleanup.
