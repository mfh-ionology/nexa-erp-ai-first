# Phase 2 Plan (≤12 files) — Batch 1

Files in this batch:
1. `packages/schemas/prisma/phase2.prisma` — Phase 2 tables (WMS, MFG, CRM/CPQ & CLM, Projects/FS, Analytics), all with `tenant_id`.
2. `apps/api/src/wms/inventory.service.ts` — FEFO, quarantine, putaway/replenishment stubs.
3. `apps/api/src/mfg/mrp.service.ts` — MRP light (ROP/lead time) stubs.
4. `apps/api/src/mfg/wo.service.ts` — WO lifecycle/backflush/WIP stubs.
5. `apps/api/src/crm/cpq.service.ts` — Price floors/approval/maker-checker stubs.
6. `apps/api/src/clm/contracts.service.ts` — Evidence hash/timestamp stubs.
7. `apps/api/src/projects/billing.service.ts` — Milestones/retainage stubs.
8. `apps/api/src/analytics/scheduler.service.ts` — Expiring signed links stubs.
9. `packages/core/sod/policy.ts` — Extend SoD roles/policies for Phase 2.
10. `scripts/gates/phase2.cjs` — Gate runner to assert Phase 2 behaviours.
11. `docs/WMS.md` — WMS overview & flows.
12. Update `package.json` — Add `gate:phase2` script and ESLint ignore for `apps/**`.

Next planned batch:
- Docs: `MFG.md`, `CRM-CPQ-CLM.md`, `PROJECTS.md`, `ANALYTICS.md`, update `AI-GOVERNANCE.md` with Phase 2 flows.
- Barcode utils (Code128/QR) stubs in `packages/core/barcode/*` with tests.
- UI stubs (Next.js pages) with axe-core checks and keyboard nav notes.
