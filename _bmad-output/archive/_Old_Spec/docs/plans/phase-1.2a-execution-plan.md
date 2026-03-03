# Phase 1.2a Execution Plan (BLOCKING until approved)

Status: BLOCKING — do not implement until this plan is completed and approved in `docs/approvals/phase-1.2a.md`.

Source Gap Matrix (latest):
- `reports/verification/phase-1.2a-gap-matrix-20260105-145244/gap-matrix.csv`
- Summary: `reports/verification/phase-1.2a-gap-matrix-20260105-145244/gap-matrix.md`
- Evidence: `reports/verification/phase-1.2a-gap-matrix-20260105-145244/evidence.txt`
Note: Matrix regenerated with tightened MISMATCH rules and CI/gate detection improvements. Unknown scan: `reports/verification/phase-1.2a-gap-matrix-unknown-scan-20260105-151155/`. Closure evidence: `reports/verification/phase-1.2a-closure-20260105-145244/`.

Typecheck remediation note:
- Excluded non-shipping restore artifacts from typecheck: pattern `**/*before-restore*`.
- Evidence: `reports/verification/phase-1.2a-typecheck-remediation-20260104-183113/` (classification + initial log).

Change-control rule:
- Any deviation from this plan requires updating this file and re-approval in `docs/approvals/phase-1.2a.md` before implementation.

Phased execution (derived from Top MISSING in Gap Matrix):

## P0 — Tenancy + RBAC + Auth invariants
Acceptance:
- Critical auth routes reachable (/login, /forgot-password, /reset-password).
- Middleware/guards enforce auth + tenancy consistently; STAFF blocked from admin; SUPER_ADMIN scoped/support-mode rules defined.
- No cross-tenant access in APIs or UI (targeted tests or manual verification).
Verification commands:
- `pnpm -C apps/web typecheck`
- Targeted auth/guard tests (to be listed per implementation)
Evidence folder naming:
- `reports/verification/p0-tenancy-rbac-<timestamp>/`

## P1 — Route surface completion (public/core/admin/platform first)
Acceptance:
- Routes from Master Plan section 6.1–6.4 exist and render without errors; forbidden routes return Not Authorised/redirect as per RBAC.
Verification commands:
- `pnpm -C apps/web typecheck`
- Targeted route smoke tests (to be listed per implementation)
Evidence folder:
- `reports/verification/p1-routes-<timestamp>/`

## P2 — Data model + constraints + migration safety
Acceptance:
- Required Prisma models/entities from Master Plan section 8 are present with tenantId constraints and uniqueness where applicable.
- Migration safety (expand/backfill/contract) documented for changes.
Verification commands:
- `pnpm -w prisma validate` (if applicable)
- `pnpm -C apps/web typecheck`
Evidence folder:
- `reports/verification/p2-models-<timestamp>/`

## P3 — Seeds completeness
Acceptance:
- Seeds cover required accounts/entities per Master Plan section 10.1; idempotent and safe for env.
Verification commands:
- Seed script dry-run or targeted seed checks (to be listed per implementation)
Evidence folder:
- `reports/verification/p3-seeds-<timestamp>/`

## P4 — Tests and gates (CI, E2E, scans)
Acceptance:
- CI scripts in place for typecheck, unit, integration/API, Playwright E2E, accessibility, security headers scan, Prisma runtime scan.
- No required gate missing for listed surfaces.
Verification commands:
- `pnpm -C apps/web typecheck`
- Targeted test commands (unit/integration/e2e) as applicable
Evidence folder:
- `reports/verification/p4-tests-<timestamp>/`

## P5 — Integrations (feature-flagged where required)
Acceptance:
- Integration endpoints/hooks identified and feature-flagged where required; evidence of flags and config locations.
Verification commands:
- Targeted integration checks (to be listed per implementation)
Evidence folder:
- `reports/verification/p5-integrations-<timestamp>/`

## P6 — Ops / runbooks / DR / perf budgets / go-live gates
Acceptance:
- Runbooks, DR/backups, performance budgets, and go-live gates documented and linked; monitoring/alerting paths identified.
Verification commands:
- Documentation verification; any available automated checks (to be listed per implementation)
Evidence folder:
- `reports/verification/p6-ops-<timestamp>/`

Blocking note:
- Implementation may not begin until this plan is approved in `docs/approvals/phase-1.2a.md` with the Gap Matrix folder referenced above.
