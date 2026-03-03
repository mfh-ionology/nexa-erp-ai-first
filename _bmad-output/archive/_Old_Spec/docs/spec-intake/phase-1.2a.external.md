# Phase 1.2a External Spec Intake (BLOCKING)

Status: **BLOCKED — Phase 1.2a requirements not found in-repo at Phase 1.1 checkpoint.**
Do not implement Phase 1.2a until the authoritative requirements are pasted into this file verbatim.

## Provenance
- Timestamp (UTC): 20260104-125907
- Branch: phase1/phase-1.2a
- HEAD SHA: a01535091a7fc34c7b56ecbbad55cc68b18ec62f
- phase-1.1-green tag deref SHA: a01535091a7fc34c7b56ecbbad55cc68b18ec62f

## What was searched (summary)
- Checked: docs/, docs/checkpoints/, docs/spec/, docs/specs/
- Ripgrep searches performed for: `Phase 1.2a`, `phase-1.2a`, `phase1.2a`, `1.2a` across docs and repo
- Candidate docs listing via find under docs/ (maxdepth 4)

## Authoritative Phase 1.2a Requirements (VERBATIM)
=== BEGIN PHASE 1.2a SPEC (VERBATIM) ===
Title: Phase 1.2a — Full Master Plan Gate (no gaps, hard-fail on any missing requirement)

Single Source of Truth: docs/master-plan/nexa-erp-v1-master-plan.md (Nexa ERP v1 Master Plan)
Phase 1.2a Gate Rule: Phase 1.2a is GREEN only if ALL Master Plan Sections 0–20 are implemented and verified (no exclusions). Any missing item is a hard FAIL.
Phase 1.2a Scope Rule: Phase 1.2a defines the minimal canonical flows/invariants required by the Master Plan Sections 3–6, 9, 10, 12, 14, 15, and 19. If any conflict exists, the Master Plan wins.

Purpose:
Establish a single canonical baseline of end-to-end user flows and invariants that MUST PASS in preview, with evidence captured, before any further phases proceed. Any missing flow, undefined acceptance criterion, or unverified invariant is a hard fail.

Scope (what this phase MUST define and verify):
R1 (MUST): Define canonical personas and credentials used for verification.
AC1.1 (PASS): Spec lists personas SUPER_ADMIN, ADMIN, STAFF with the exact test accounts used by prod-smoke.
AC1.2 (PASS): Spec states that credentials are never written to docs; only env var names are referenced.

R2 (MUST): Define canonical authentication flows.
AC2.1 (PASS): Credentials login flow to /dashboard is included for SUPER_ADMIN, ADMIN, STAFF.
AC2.2 (PASS): Session persistence across a full refresh is included (post-login refresh stays authenticated).
AC2.3 (PASS): Logout flow is included (returns to /login; protected routes require auth again).

R3 (MUST): Define canonical tenancy + RBAC invariants.
AC3.1 (PASS): Tenant isolation invariant is defined: cross-tenant data access is impossible by API and UI.
AC3.2 (PASS): RBAC invariant is defined: STAFF cannot access admin-only pages; must see Not authorised (or 403) deterministically.
AC3.3 (PASS): Middleware/client-gate behaviour for protected routes is defined and verifiable.

R4 (MUST): Define canonical “smoke-critical” route coverage.
AC4.1 (PASS): Spec lists the minimum routes that must load for each persona (including those already covered by prod-smoke).
AC4.2 (PASS): For each route, expected outcome is explicit (200 + UI marker for allowed; “Not authorised”/403 for forbidden; redirect to /login if unauthenticated).

R5 (MUST): Define canonical data integrity expectations for seed/test environment.
AC5.1 (PASS): Seed accounts exist and are required for tests.
AC5.2 (PASS): Seeded data used in flows is listed (minimal; only what’s required for routes to render without runtime errors).

R6 (MUST): Define the required verification procedure and evidence outputs.
AC6.1 (PASS): Procedure requires typecheck + relevant tests + prod-smoke wrapper against preview URL.
AC6.2 (PASS): Evidence path format is defined under reports/verification with timestamped folder naming.
AC6.3 (PASS): A “hard fail on gaps” rule is explicit: any missing step or undefined expected result blocks completion.

R7 (MUST): Define exclusions (no scope creep).
AC7.1 (PASS): Spec explicitly excludes new features, refactors, formatting-only changes, and unrelated fixes.

Acceptance Gate (Phase completion):
G1 (PASS): All requirements R1–R7 are implemented and verified with evidence.
G2 (PASS): Working tree clean; branch contains only phase-scoped commits.
G3 (PASS): Checkpoint doc is produced and tag created only after Step 3 (deploy + prod-smoke) is green.

=== END PHASE 1.2a SPEC (VERBATIM) ===

## Gate (non-negotiable)
- [ ] Requirements pasted verbatim above (no paraphrasing)
- [ ] Each requirement has acceptance criteria (PASS conditions)
- [ ] No secrets included
- [ ] Only then may Step 2 implementation begin on branch `phase1/phase-1.2a`
