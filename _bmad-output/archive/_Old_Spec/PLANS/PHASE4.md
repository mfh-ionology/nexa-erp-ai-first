# Phase 4 Plan (≤12 files)

1. `apps/api/src/marketplace/storefront.service.js` — Public storefront: search/browse/install/uninstall.
2. `apps/api/src/billing/billing.service.js` — Stripe Connect stubs, plans, refunds, suspensions, quotas.
3. `apps/api/src/devportal/devportal.service.js` — App submission validation, entitlements, staged rollout.
4. `apps/api/src/monitoring/monitoring.service.js` — App status, kill-switch, alerts/logs.
5. `apps/api/src/marketplace/skills.service.js` — AI Skill registry with token caps and confirm cards.
6. `packages/schemas/prisma/phase4.prisma` — Minimal schema stubs for Phase 4.
7. `scripts/gates/phase4.cjs` — Gate runner for Phase 4.
8. `docs/RoPA.md` — Records of Processing Activities.
9. `docs/DPIA-Payroll.md` — Data Protection Impact Assessment (Payroll).
10. `docs/Sub-Processor-Register.md`
11. `docs/Accessibility-Statement.md`
12. `docs/PECR-Policy.md`

Also: add `gate:phase4` script and update CI to run it.
