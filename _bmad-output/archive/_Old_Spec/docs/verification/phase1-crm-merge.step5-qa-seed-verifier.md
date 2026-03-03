# Phase 1 — CRM Merge Step 5: QA Seed/Unseed + Verifier

## Defaults
- `BASE_URL=http://127.0.0.1:3000`
- `SEED_EMAIL=info@nexaai.co.uk`
- `SEED_PASSWORD=ChangeMe!123`
- `ALLOW_NON_LOCALHOST=0` (set to `1` to allow non-local targets)

## Artifacts
- `scripts/qa/seed_crm.ts` — seeds CRM data via API with tagged runId.
- `scripts/qa/unseed_crm.ts` — deletes seeded data by run file.
- `scripts/verification/verify_phase1_crm_step5.mjs` — end-to-end seed/verify/unseed with evidence.
- Evidence output: `reports/verification/phase1-crm-step5-<timestamp>/`
  - `run.json`, `summary.md`, `responses/*.json`

## Safety
- Refuses non-local BASE_URL unless `ALLOW_NON_LOCALHOST=1`.
- Seed/Unseed uses runId tagging (`qa_crm_<timestamp>_<rand>`) and only deletes tagged records.
- Auth uses stored Playwright state if available, otherwise credentials login via `/api/auth/*`.

## Running
1. Seed only (optional):
   ```bash
   pnpm tsx scripts/qa/seed_crm.ts
   ```
2. Unseed only (optional):
   ```bash
   RUN_FILE=reports/verification/latest-run.json pnpm tsx scripts/qa/unseed_crm.ts
   ```
3. Full verify (seed + checks + unseed + evidence):
   ```bash
   pnpm tsx scripts/verification/verify_phase1_crm_step5.mjs
   ```

## What is verified
- Canonical CRM endpoints: accounts, contacts, leads (incl. cancel), opportunities (stage move), activities, price-books, quotes (approve/cancel).
- Legacy aliases: `/api/sales/leads`, `/api/sales/quotes`, `/api/sales/orders` respond with 2xx.
- Post-unseed: tagged data absent from lists.

## Notes
- STAFF checks are optional; verifier does not block on missing staff creds.
- No schema or migration changes are introduced.
