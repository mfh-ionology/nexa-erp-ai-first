# Phase 3 Plan (≤12 files) — Batch 1

Files:
1. `packages/schemas/prisma/phase3.prisma` — Phase 3 tables (subset for gates), all with `tenant_id`.
2. `apps/api/src/mfg/bom.service.js` — BOM multi-level + version/effectivity.
3. `apps/api/src/mfg/genealogy.service.js` — Lot/serial genealogy trace.
4. `apps/api/src/quality/quality.service.js` — Holds, NC/CAPA link, supplier scoring.
5. `apps/api/src/fieldservice/checklist.service.js` — Offline checklist, SLA timer, sign-off.
6. `apps/api/src/treasury/treasury.service.js` — Cash forecast, FX exposure, netting.
7. `apps/api/src/analytics/nlq.service.js` — NLQ stub, scheduler retry, OData stub.
8. `apps/api/src/marketplace/manifest.service.js` — manifest validate, OAuth scopes, installer hooks, webhook HMAC + replay, skill registry.
9. `scripts/gates/phase3.cjs` — Gate runner.
10. Update `package.json` — add `gate:phase3`.
11. Update `.github/workflows/ci.yml` — run `pnpm -w gate:phase3`.
12. (Reserved) — For quick fixes if needed.

Next batch: Docs for Manufacturing, PLM, Projects, Treasury, Analytics, Marketplace.
