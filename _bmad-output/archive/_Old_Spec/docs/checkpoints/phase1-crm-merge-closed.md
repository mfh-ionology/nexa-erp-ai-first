# Phase 1 — CRM merge closeout (checkpoint)

- Branch: `phase1/crm-merge-20260112` @ `43ae114`
- Latest CI: `ci` run `21001350053`, `api-ci` run `21001350069` (SUCCESS)
- Vercel-like build proof: `VERCEL=1 VERCEL_ENV=preview NEXT_PUBLIC_VERCEL_ENV=preview NODE_ENV=production pnpm -C apps/web -s build` (PASS on merged base)
- Verifier evidence (canonical): `reports/verification/phase1-crm-step5-2026-01-14T11-50-40-412Z` (runId `qa_crm_20260114115040._635e11`) — PASS

## What is now canonical
- Routes: CRM UI lives under `/crm/*`; legacy `/sales/*` redirects; APIs use `/api/crm/**` canonical handlers.
- Services: Prisma CRM services (`server/crm/*`, `src/lib/crm/client.ts`) back all CRM flows; ERP aliases delegate to canonical services.
- UI & AI: UI calls canonical `/api/crm/*`; AI intents rely on canonical CRM services with no legacy stores.
- Bypass safety: QA bypass requires localhost host + `NODE_ENV !== "production"` + `TEST_AUTH_ENABLED=1` + `QA_BYPASS_MODULE_DISABLED=1` + header `x-qa-bypass`=`QA_BYPASS_SECRET`; disabled for preview/prod.

## Ready to proceed
- Gates to keep enforced on this base: `bash scripts/verification/assert_single_prisma_schema.sh`, `pnpm -C apps/web -s typecheck`, `pnpm -s spec:coverage` (100%), Vercel-like build command above.
- This branch is ready for the next Phase 1 step (Step 7 onward) to branch from `phase1/crm-merge-20260112`.
