# Phase 1 — CRM merge final verification (canonical)

- Base branch: `phase1/crm-merge-20260112`
- Latest CI: `ci` run `20995936123`, `api-ci` run `20995936114` (both SUCCESS)
- Local gates on base (2026-01-14):
  - `bash scripts/verification/assert_single_prisma_schema.sh` → PASS
  - `pnpm -C apps/web -s typecheck` → PASS
  - `pnpm -s spec:coverage` → 100%
  - `VERCEL=1 VERCEL_ENV=preview NEXT_PUBLIC_VERCEL_ENV=preview NODE_ENV=production pnpm -C apps/web -s build` → PASS (Vercel-like)

## Step references
- Step 4 (API consolidation): `docs/verification/phase1-crm-merge.step4-api.md`
- Step 5 (QA seed/unseed + verifier): `docs/verification/phase1-crm-merge.step5-qa-seed-verifier.md`
- Step 6 (UI + AI alignment + QA bypass hardening): `docs/verification/phase1-crm-merge.step6-final.md` and `docs/verification/phase1-crm-merge.step6-ui-ai.md`

## Evidence (canonical)
- Latest verifier run (after QA bypass hardening): `reports/verification/phase1-crm-step5-2026-01-14T11-50-40-412Z` (PASS)
  - Command: `BASE_URL='http://127.0.0.1:3000' SEED_EMAIL='info@nexaai.co.uk' SEED_PASSWORD='Wolfish123' TEST_AUTH_ENABLED='1' TEST_AUTH_SECRET='devsecret' ALLOW_QA_BYPASS='1' QA_BYPASS_SECRET='devsecret-bypass' TENANT_SLUG='demo-tenant' pnpm tsx scripts/verification/verify_phase1_crm_step5.mjs`
  - Note: Reuse of latest Step 6 verifier evidence; not rerun here because no local app/db in this session.
- Earlier Step 6 verifier (pre-hardening) kept for history: `reports/verification/phase1-crm-step5-2026-01-14T09-01-33-730Z` (RunId `qa_crm_20260114090134._11ad6e`)

## Proof snippets (no legacy stores or sales UI calls)
- AI/storage: `rg -n "src/lib/crm/.*Store|accountsStore|contactsStore|leadsStore|opportunitiesStore|quotesStore|priceBooksStore" apps/web/src/lib/ai -S` → no matches
- UI API targets: `rg -n "/api/sales/" apps/web/app -S` → only supply/RMA ops + legacy sales orders redirect file; no CRM UI usage
- Redirect confirmation: `rg -n "sales/(leads|opportunities|quotes|customers)" apps/web/app -S` → routes redirect to `/crm/*`

## QA bypass scope (local-only)
- Bypass allowed only when **all** hold: `NODE_ENV !== "production"`, host is localhost/127.0.0.1, `TEST_AUTH_ENABLED=1`, `QA_BYPASS_MODULE_DISABLED=1`, header `x-qa-bypass` matches `QA_BYPASS_SECRET`.
- Preview/prod cannot satisfy host + NODE_ENV + header/secret + test-auth combination; bypass disabled there. QA scripts send the header only when bypass variables are set.

## Next steps
- Treat this file as the canonical Phase 1 CRM merge verification index.
- Future Phase 1 steps should branch from `phase1/crm-merge-20260112` and keep CI (ci + api-ci) green with the same gates above.
