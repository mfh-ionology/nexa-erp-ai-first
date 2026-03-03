# Phase 6 — CRM UI + AI consolidation verification

Branch: `phase1/crm-step6-20260114`

Commits
- A (UI canonicalisation): `ba97f12`
- B (AI canonical services): `ebf3fbd`
- C (evidence/doc): _this commit_

What changed in Step 6
- CRM UI now uses canonical `/api/crm/*` endpoints; legacy `/sales/*` pages redirect to CRM equivalents.
- Shared CRM sidebar/nav points to `/crm/*`.
- AI CRM intents use canonical CRM services (`server/crm/pipelines`, `server/crm/quotes`), no legacy stores.

Local gates (PASS)
- `bash scripts/verification/assert_single_prisma_schema.sh`
- `pnpm -C apps/web -s typecheck`
- `pnpm -s spec:coverage` → 100%
- `VERCEL=1 VERCEL_ENV=preview NEXT_PUBLIC_VERCEL_ENV=preview NODE_ENV=production pnpm -C apps/web -s build`

CI (PASS)
- ci run: `20987989803`
- api-ci run: `20987989781`

Step 5 verifier (rerun after Step 6)
- Command: `BASE_URL='http://127.0.0.1:3000' SEED_EMAIL='info@nexaai.co.uk' SEED_PASSWORD='Wolfish123' TEST_AUTH_ENABLED='1' TEST_AUTH_SECRET='devsecret' QA_BYPASS_MODULE_DISABLED='1' TENANT_SLUG='demo-tenant' pnpm tsx scripts/verification/verify_phase1_crm_step5.mjs`
- Result: `PASS`
- Evidence: `reports/verification/phase1-crm-step5-2026-01-14T09-01-33-730Z`
- RunId: `qa_crm_20260114090134._11ad6e`

Proof greps
- No legacy CRM stores in AI:
  - `rg -n "src/lib/crm/.*Store|accountsStore|contactsStore|leadsStore|opportunitiesStore|quotesStore|priceBooksStore" apps/web/src/lib/ai -S` → no matches
- UI not calling `/api/sales/*` (CRM pages):
  - `rg -n "/api/sales/" apps/web/app -S` → only supply/RMA ops and sales/orders legacy file (UI redirects); no CRM UI usage
- `/sales/*` pages redirect to `/crm/*`:
  - `rg -n "sales/(leads|opportunities|quotes|customers)" apps/web/app -S` → no page content; routes now redirect

