# Phase 2 — Shared Foundations Verification

- Branch: `phase2/foundations-20260114`
- SHA: `c25cf0de50f3d7b105bdc499ec6e583cade3eceb`
- Timestamp (UTC): 2026-01-14 18:24:44 UTC
- Evidence folder: `reports/verification/phase2-foundations-20260114-180951`

## Foundations added (apps/web/src/server/api/*)
- `ctx.ts`: central API ctx builder (requestId resolution, actor/tenant, permission set + helpers), typed errors (`UnauthenticatedError`, `ForbiddenError`, `NotFoundError`, `ModuleDisabledError`, `ValidationError`, `ApiError`), auth/tenant enforcement.
- `moduleGate.ts`: tenant module enablement check with strict local-only QA bypass (NODE_ENV!==production, host localhost/127.0.0.1, TEST_AUTH_ENABLED=1, QA_BYPASS_MODULE_DISABLED=1, header x-qa-bypass == QA_BYPASS_SECRET).
- `http.ts`: response envelope helpers `ok(ctx, data, status?)`, `fail(...)`, `fromError(...)` with legacy adapter (`details.legacyError`) and status mappings.
- `validate.ts`: JSON/query parsing + zod validation wrapper raising `ValidationError`.
- `pagination.ts`: shared pagination parser/serializer consistent with CRM defaults.
- QA helpers: `_foundation.ts` is canonical; `_shared.ts` re-exports for existing scripts; `seed_crm.ts` unwraps new envelopes.

## CRM adoption proof
- New lifecycle wrapper `crmHandler` in `apps/web/app/api/crm/_handlers/common.ts` builds ctx, requires auth/tenant, enforces module gate, optional `crm:manage`, rate limits, wraps handlers with `ok`/`fromError`.
- All CRM handlers now use foundations (`accounts.ts`, `contacts.ts`, `leads.ts`, `opportunities.ts`, `activities.ts`, `pipelines.ts`, `priceBooks.ts`, `quotes.ts`) with envelope + validation helpers; no direct `NextResponse.json`, `getServerSession`, or inline `"module_disabled"`.
- CRM client (`apps/web/src/lib/crm/client.ts`) continues to unwrap `data` and respect `error.details.legacyError`.

## Backwards compatibility
- Envelope keeps `ok` semantics and adds `requestId`; errors map to legacy codes via `details.legacyError`.
- Status codes preserved (401/403/404/400/500). No CRM handlers used HTTP 201 in baseline (`git --no-pager grep -n "status: 201" origin/phase1/crm-merge-20260112 -- apps/web/app/api/crm/_handlers` returned none). `ok(ctx, data, status?)` supports non-200 if needed.
- QA bypass remains local-only per moduleGate constraints; CRM verifier now runs under tsx with TS import and envelope-aware seed.

## Commands run (all PASS; see `reports/verification/phase2-foundations-20260114-180951/gates.txt`)
- `bash scripts/verification/assert_single_prisma_schema.sh`
- `pnpm -C apps/web -s typecheck`
- `pnpm -s spec:coverage` (100%)
- `VERCEL=1 VERCEL_ENV=preview NEXT_PUBLIC_VERCEL_ENV=preview NODE_ENV=production pnpm -C apps/web -s build`
- `bash scripts/verification/assert_phase2_foundations_adoption.sh`
- API tests: `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase_local_lane_1768414090589 pnpm -C apps/web -s test:api`
- CRM verifier (with QA bypass header + dev server on :3000): `BASE_URL=http://127.0.0.1:3000 ALLOW_QA_BYPASS=1 QA_BYPASS_SECRET=local-qa TEST_AUTH_ENABLED=1 pnpm tsx scripts/verification/verify_phase1_crm_step5.mjs`

## Proof artifacts
- Grep proofs: `reports/verification/phase2-foundations-20260114-180951/adoption-grep.txt`
- Diff/stat + file list vs base: `diffstat.txt`, `changed-files.txt`
- Dev server log (for CRM verifier run with QA bypass): `devserver.log`

## Notes
- API test runner now creates `nexa_vitest` if missing (fallback to port 5432) and supports `--listTests` via `vitest list`.
- CRM seed/verifier unwraps envelopes to keep compatibility with new `ok`/`fail` shape.
