# Epic E2b Retrospective — Granular RBAC & Access Groups

**Date:** 2026-02-20
**Epic:** E2b — Granular RBAC & Access Groups
**Status:** Partial (5/6 stories done, E2b-6 unimplemented)
**Agent:** Claude Opus 4.6 (all stories)
**Type:** Partial Retrospective (E2b-6 not started)

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 5/6 (83%) |
| Stories Unimplemented | 1 (E2b-6: export/import defaults) |
| Code Reviews Performed | 5 (E2b-1 through E2b-5, plus E2b-6 review-of-nothing) |
| CR Issues Found | ~53 (11 HIGH, 19 MEDIUM, 12 LOW across E2b-2 through E2b-5; plus 4 HIGH, 6 MEDIUM, 2 LOW on unimplemented E2b-6) |
| HIGH Issues from Implemented Stories | 9 |
| Pre-existing Test Failures | 42 (acknowledged in E2b-5, unresolved) |
| New DB Migrations | 2 (resource_registry, access_groups) |
| New API Endpoints | ~13 (resources, access groups CRUD, permissions, field overrides, user assignments, my-permissions) |
| Routes Migrated | 22 (from createRbacGuard to createPermissionGuard) |

### Story Breakdown

| Story | Title | CR Issues (H/M/L) | Key Output |
|-------|-------|--------------------|------------|
| E2b-1 | Resource Registry | None documented | ResourceType enum, Resource model, company-defaults.json, default-data-loader, resource CRUD API |
| E2b-2 | Access Groups + Permissions | 2/4/4 | AccessGroup models, 12 pre-built groups, CRUD + permission management API, company creation seeding |
| E2b-3 | User Access Group Assignment | 1/4/3 | UserAccessGroup routes, replace-all assignment pattern, 422 for empty groups |
| E2b-4 | Permission Enforcement | 2/5/3 | Permission service + cache + guard, my-permissions endpoint, 22-route migration |
| E2b-5 | Field-Level Visibility | 4/6/3 | filterFieldsByPermission onSend hook, HIDDEN stripping, READ_ONLY _fieldMeta |
| E2b-6 | Export/Import Defaults | **NOT IMPLEMENTED** | Zero tasks executed, orchestrator skipped Phase 2 |

---

## E2 Retro Follow-Through

The E2 retrospective identified 19 action items. Here's how E2b addressed them:

### Security Fixes (E2 Items #1-7)

| # | E2 Action Item | Status in E2b | Evidence |
|---|---|---|---|
| 1 | Fix privilege escalation: ADMIN can create SUPER_ADMIN | :x: Not Addressed | user.routes.ts still lacks role ceiling check |
| 2 | Validate JWT claims after signature verification | :x: Not Addressed | jwt-verify.hook.ts not refactored for claim validation |
| 3 | Fix payload.sub non-null assertion | :x: Not Addressed | Same pattern persists |
| 4 | Prevent self-deactivation (sole ADMIN check) | :x: Not Addressed | Not in E2b scope |
| 5 | Fix company-ID enumeration (consistent 403) | :x: Not Addressed | Not in E2b scope |
| 6 | Make baseCurrencyCode immutable | :x: Not Addressed | Not in E2b scope |
| 7 | Fix unsafe type assertion in deactivateUser | :x: Not Addressed | Not in E2b scope |

### Infrastructure Fixes (E2 Items #8-12)

| # | E2 Action Item | Status in E2b | Evidence |
|---|---|---|---|
| 8 | Add setNotFoundHandler | :x: Not Addressed | Still missing |
| 9 | Fix 3 failing Swagger/OpenAPI tests | :x: Not Addressed | Test failures grew to 42 |
| 10 | Add missing zod-to-json-schema dependency | :hourglass: Unverified | Not explicitly addressed |
| 11 | Fix hardcoded Zod role enum in company.schema.ts | :x: Not Addressed | E2b-4 CR #7 flagged related regression |
| 12 | Consolidate makeTestJwt to shared test-utils | :hourglass: Partial | Some tests use shared utils, some still local |

### Process Improvements (E2 Items #13-16)

| # | E2 Action Item | Status in E2b | Evidence |
|---|---|---|---|
| 13 | Code review for E2-3 (MFA) | :x: Not Done | No evidence of MFA re-review |
| 14 | Evaluate increasing CR iteration limit to 5 | :x: Not Done | CR still limited, issues still accumulate |
| 15 | Add "known issues from previous story" section | :white_check_mark: Done | E2b stories include "Previous Implementation Learnings" sections |
| 16 | Create E3 story template for raw SQL migration | :x: Not Done | E3 not started |

### E1 Carry-Forward Verification (E2 Items #17-19)

| # | E2 Action Item | Status in E2b | Evidence |
|---|---|---|---|
| 17 | Verify ON DELETE SET NULL -> RESTRICT on UCR | :x: Not Verified | Still pending |
| 18 | Verify ViewScope enum alignment | :x: Not Verified | Still pending |
| 19 | Verify nextNumber() transaction param | :x: Not Verified | Still pending |

**Result:** 1/19 confirmed done, 1 partial, 17 not addressed. E2b focused on new feature delivery and did not address the E2 retro's technical debt backlog. The 7 security fixes from E2 remain entirely unresolved.

---

## What Went Well

### 1. Foundational RBAC Architecture Delivered

The granular permission system is architecturally sound: Resource registry, AccessGroup with company-scoped permissions, most-permissive-wins resolution, SUPER_ADMIN bypass, in-memory cache with 60s TTL, and the `createPermissionGuard()` factory. This is the foundation all 11 MVP business modules (E14+) will build on.

### 2. Previous Implementation Learnings Applied

E2b was a **second attempt** — the first implementation was reverted (5 revert commits visible in git log). Stories E2b-1 through E2b-5 explicitly document "Previous Implementation Learnings" and avoided repeating mistakes:
- In-memory Map cache pattern validated (not Redis for MVP)
- Fastify 5 getter/setter pattern for request decorators
- `z.string().datetime()` instead of `z.date()` (learned from E2b-2 CR #10, applied in E2b-3)

### 3. Clean Separation of Concerns

Each story built on the prior in a well-layered sequence:
- E2b-1: Data layer (Resource table, seed data)
- E2b-2: Business logic (AccessGroups, permissions, company creation integration)
- E2b-3: User-to-group assignment
- E2b-4: Runtime enforcement (permission guard, cache, route migration)
- E2b-5: Response-level enforcement (field filtering hook)

### 4. Comprehensive Route Migration

22 routes across 7 files were migrated from `createRbacGuard` to `createPermissionGuard` in E2b-4. The legacy guard was marked `@deprecated` but preserved for backward compatibility. This is disciplined migration work.

### 5. Code Review Thoroughness

Every implemented story received a code review with specific, actionable findings. The reviews caught real issues: race conditions, TOCTOU vulnerabilities, crash risks, schema pollution, behavioral regressions. The review quality improved from E2.

---

## Challenges

### 1. E2b-6 Completely Skipped — Orchestrator Failure

The most significant issue: Story E2b-6 (export/import permission configurations) was **never implemented**. Zero of 8 tasks were executed. The story file shows template placeholders (`{{agent_model_name_version}}`), indicating the dev agent was never invoked. The code review was performed on non-existent code, finding the obvious: nothing was built.

**Impact:** FR230 (default data import/export endpoints) is undelivered. The `export-defaults` and `import-defaults` routes referenced in API contracts don't exist. The `company.defaultData.imported` event type is missing from the event emitter.

**Root Cause:** The BMAD orchestrator appears to have skipped Phase 2 (implementation) for E2b-6. This could be a bug in the orchestration script or a context window issue.

### 2. Test Failure Accumulation — 42 Failures Unresolved

By E2b-5, 42 test failures existed. The E2b-5 code review flagged this as HIGH Issue #1 but it was not resolved. These failures accumulated across stories:
- E2b-4 introduced broken integration tests (permission guard mocking gaps)
- E2b-5 added field-filter tests but couldn't verify no-regression with 42 failures pre-existing
- The test suite is no longer a reliable quality gate

### 3. Story Boundary Discipline Violated

Multiple stories included changes from prior stories in their diffs:
- E2b-2 included E2b-1's `resourceRoutesPlugin` registration
- E2b-3 included E2b-2's event types in `event-emitter.ts`
- E2b-3 included E2b-1 and E2b-2 route registrations in `system/index.ts`

This conflates story-level changes, makes code review harder, and violates the principle that each story is an atomic, reviewable unit.

### 4. Code Review Issues Still Accumulate

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E2b-1 | 0 | 0 | 0 | 0 |
| E2b-2 | 2 | 4 | 4 | 10 |
| E2b-3 | 1 | 4 | 3 | 8 |
| E2b-4 | 2 | 5 | 3 | 10 |
| E2b-5 | 4 | 6 | 3 | 13 |
| **Total** | **9** | **19** | **13** | **41** |

The same pattern from E2: the 3-iteration CR limit is insufficient. HIGH issues remain unresolved at story completion. The dev agent doesn't prioritize HIGH over LOW during CR iterations.

### 5. Fragile Mock Pattern

Every test file that mocks `@nexa/db` must enumerate ALL enums (ResourceType, FieldVisibility, UserRole, etc.). Each new enum added in E2b required updating N existing test files. This is brittle and scales poorly — flagged in E2b-2 CR #6 and repeated across all stories.

### 6. VIEWER Behavioral Regression

E2b-4 migrated the company-switch route from `minimumRole: VIEWER` to `createPermissionGuard('system.company.switch')`. VIEWER-role users can no longer switch companies without specific access group permission. This is an unintentional behavioral regression (E2b-4 CR #7, #9).

---

## Technical Debt

### Inherited from E2 (STILL UNRESOLVED — 7 items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 1 | Privilege escalation: ADMIN can create SUPER_ADMIN | CRITICAL | E2-6 CR #1 |
| 2 | JWT claims not validated after signature verification | CRITICAL | E2-2 CR #1 |
| 3 | Non-null assertion on payload.sub | CRITICAL | E2-2 CR #2 |
| 4 | Self-deactivation not prevented | HIGH | E2-6 CR #2 |
| 5 | Company-ID enumeration via inconsistent 404/403 | HIGH | E2-4 CR #1 |
| 6 | baseCurrencyCode mutable after creation | HIGH | E2-6 CR #4 |
| 7 | Unsafe `tx as unknown as PrismaClient` assertion | HIGH | E2-6 CR #3 |

### New from E2b (9 HIGH items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 8 | 42 test failures unresolved — test suite is unreliable | CRITICAL | E2b-5 CR #1 |
| 9 | E2b-6 never implemented — FR230 undelivered | CRITICAL | E2b-6 CR #1 |
| 10 | `registerPermissionCacheListeners()` accumulates duplicate listeners | HIGH | E2b-4 CR #2 |
| 11 | `JSON.parse('null')` crash risk in field-filter hook | HIGH | E2b-5 CR #3 |
| 12 | Field filtering only on GET — PATCH/POST return unfiltered data | HIGH | E2b-5 CR #4 |
| 13 | Race condition in `setAccessGroupPermissions` (validation outside txn) | MEDIUM | E2b-2 CR #3 |
| 14 | `assignFullAccessGroup` silent failure on missing group | MEDIUM | E2b-2 CR #5 |
| 15 | `_fieldMeta` pollutes global successEnvelope / OpenAPI docs | MEDIUM | E2b-5 CR #5 |
| 16 | VIEWER behavioral regression on company switch | MEDIUM | E2b-4 CR #7, #9 |

### Inherited from E1 (STILL UNVERIFIED — 3 items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 17 | ON DELETE SET NULL -> RESTRICT on UserCompanyRole | HIGH | E1 Retro #1 |
| 18 | ViewScope enum alignment with spec | HIGH | E1 Retro #2 |
| 19 | nextNumber() requires transaction parameter | HIGH | E1 Retro #3 |

### Carry Forward (Selected MEDIUM items from E2b)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 20 | `ACTION_FLAG_MAP` duplicated across 3+ files | MEDIUM | E2b-4 CR #5 |
| 21 | SUPER_ADMIN `getEffectivePermissions()` queries DB every call (no cache) | MEDIUM | E2b-4 CR #6 |
| 22 | `isActive` default missing in listAccessGroupsQuerySchema | MEDIUM | E2b-2 CR #1 |
| 23 | Fragile enum mock pattern across all test files | MEDIUM | E2b-2 CR #6 |
| 24 | No nested/dotted field path traversal in field-filter | LOW | E2b-5 CR #12 |
| 25 | `_fieldMeta` value type too loose (allows any string) | MEDIUM | E2b-5 CR #6 |

**Total Debt Inventory: 25 items (3 CRITICAL, 9 HIGH, 11 MEDIUM, 2 LOW)**

---

## E3 Preview

**Epic E3:** Event Bus + Audit Trail
- 3 stories: Event Bus Infrastructure, Audit Trail Service, Event Persistence & Dead Letter
- **Dependencies on E2/E2b:** Event emitter placeholder (event-emitter.ts), full API infrastructure, auth/RBAC pipeline, permission guard on all routes
- **New tech:** BullMQ/Redis for dead-letter queue
- **New Prisma model:** AuditLog with PostgreSQL immutability RULES (raw SQL in migration)
- **Key risk:** Building audit trail on top of unresolved security issues (privilege escalation, JWT gaps) means audit data itself may be untrustworthy

**E2b Dependencies that E3 relies on:**
- event-emitter.ts (extended with 4 new event types in E2b)
- Permission guard infrastructure (createPermissionGuard on all routes)
- Company context middleware (unchanged from E2)

**Preparation concerns:**
- 42 test failures must be resolved before E3 — cannot build audit trail with broken test suite
- Security fixes from E2 are now 2 epics overdue
- E2b-6 (import/export) may need to be completed or explicitly descoped

---

## Significant Discoveries

### Discovery 1: Technical Debt is Growing Faster Than It's Being Resolved

**Finding:** Across E1, E2, and E2b, the project has accumulated 25 tracked technical debt items (3 CRITICAL, 9 HIGH). Zero E2 security fixes were addressed during E2b. The E1 carry-forward items (3 items) are now 3 epics old and still unverified.

**Impact on E3:** If E3's audit trail is built on unresolved security issues (privilege escalation, unvalidated JWT claims), the audit data itself is untrustworthy. The 42 test failures mean E3 cannot verify it introduces no regressions.

**Recommendation:** A dedicated security/stability sprint is needed before E3. This is no longer optional — it's architecturally prerequisite.

### Discovery 2: Orchestrator Reliability Issue

**Finding:** The BMAD orchestrator skipped E2b-6 entirely — zero tasks executed, story left at `ready-for-dev` while sprint-status was not updated to reflect non-completion. This means the orchestrator cannot be trusted to complete all stories in an epic without manual verification.

**Impact:** Every future epic must include a manual completion check. The orchestrator bug should be investigated and fixed.

### Discovery 3: Test Suite is No Longer a Quality Gate

**Finding:** 42 test failures accumulated across E2b-4 and E2b-5. Stories were marked "done" despite these failures. The test suite can no longer distinguish between new regressions and pre-existing failures.

**Impact on E3:** Starting E3 with 42 failures means any E3 story that "passes tests" is meaningless — we can't tell E3 regressions from E2b failures.

**Recommendation:** Fix all 42 test failures before starting E3. This is a hard prerequisite.

---

## Action Items

### CRITICAL — Before E3

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Fix all 42 test failures — restore test suite as quality gate | Dev | CRITICAL |
| 2 | Implement E2b-6 OR explicitly descope FR230 from MVP | Dev/PM | CRITICAL |
| 3 | Fix privilege escalation: ADMIN can create SUPER_ADMIN (E2 #1) | Dev | CRITICAL |
| 4 | Validate JWT claims after signature verification (E2 #2) | Dev | CRITICAL |
| 5 | Fix payload.sub non-null assertion (E2 #3) | Dev | CRITICAL |

### HIGH — Before E3

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 6 | Fix `registerPermissionCacheListeners()` duplicate listener bug | Dev | HIGH |
| 7 | Fix `JSON.parse('null')` crash in field-filter hook | Dev | HIGH |
| 8 | Add field filtering to PATCH/POST responses (not just GET) | Dev | HIGH |
| 9 | Fix VIEWER behavioral regression on company switch | Dev | HIGH |
| 10 | Prevent self-deactivation (E2 #4) | Dev | HIGH |
| 11 | Fix company-ID enumeration (E2 #5) | Dev | HIGH |
| 12 | Make baseCurrencyCode immutable (E2 #6) | Dev | HIGH |
| 13 | Add setNotFoundHandler with standard error envelope (E2 #8) | Dev | HIGH |

### Process Improvements

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 14 | Investigate orchestrator bug that skipped E2b-6 | SM | HIGH |
| 15 | Add mandatory "zero test failures" gate before story completion | SM | HIGH |
| 16 | Add post-epic manual completion verification step | SM | MEDIUM |
| 17 | Fix fragile enum mock pattern (centralize mock setup) | Dev | MEDIUM |
| 18 | Resolve `ACTION_FLAG_MAP` duplication across files | Dev | MEDIUM |

### E1 Carry-Forward (3 epics overdue)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 19 | Verify ON DELETE SET NULL -> RESTRICT on UserCompanyRole | Dev | HIGH |
| 20 | Verify ViewScope enum alignment with spec | Dev | HIGH |
| 21 | Verify nextNumber() requires transaction parameter | Dev | HIGH |

---

## E3 Preparation Tasks

**CRITICAL (Must complete before E3 starts):**
- [ ] Fix all 42 test failures (#1)
- [ ] Resolve E2b-6 status — implement or descope (#2)
- [ ] Complete security fixes #3-5 (3 CRITICAL items from E2)
- [ ] Fix duplicate listener bug (#6), null crash (#7), field-filter gaps (#8)
- [ ] Fix VIEWER regression (#9)

**HIGH (Should complete before E3):**
- [ ] Complete remaining E2 security fixes #10-12
- [ ] Add setNotFoundHandler (#13)
- [ ] Investigate orchestrator bug (#14)
- [ ] Add zero-failures gate (#15)

**MEDIUM (Can parallel with early E3):**
- [ ] Fix fragile enum mock pattern (#17)
- [ ] Resolve ACTION_FLAG_MAP duplication (#18)
- [ ] Verify E1 carry-forward items #19-21

---

## Readiness Assessment

| Dimension | Status | Notes |
|-----------|--------|-------|
| Epic Completion | Partial (83%) | E2b-6 unimplemented |
| Test Suite Health | RED | 42 failures — not a reliable quality gate |
| Security Posture | RED | 3 CRITICAL + 4 HIGH issues from E2 still open |
| Technical Debt | HIGH | 25 tracked items (3 CRITICAL, 9 HIGH) |
| E3 Dependencies | YELLOW | Core permission infrastructure works, but tests unreliable |
| Deployment | N/A | Backend API, no production deployment yet |

**Verdict:** Epic E2b delivered strong foundational RBAC infrastructure (stories 1-5), but the epic is incomplete (E2b-6 skipped), the test suite is broken (42 failures), and security debt from E2 is entirely unresolved. **A stability/security sprint is required before E3.**

---

## Key Takeaways

1. **Granular RBAC architecture is sound** — Resource registry, AccessGroup, permission resolution, guard factory, field-filter hook. The design is right and will serve all 11 MVP modules well.
2. **Technical debt is growing unsustainably** — 25 items across 3 epics, 3 CRITICAL. Zero E2 security fixes addressed in E2b. A dedicated fix sprint is mandatory.
3. **42 test failures eliminate the safety net** — Starting E3 with a broken test suite is reckless. Fix first, build second.
4. **Orchestrator reliability is a concern** — E2b-6 was silently skipped. Manual verification of epic completion is now required.
5. **Code review issues accumulate but are never resolved** — The 3-iteration CR cap and story-scoped dev agent create a structural pattern where debt only grows.
6. **Second implementation attempt succeeded** — Learning from the reverted first attempt was effective. The "Previous Implementation Learnings" pattern is valuable and should continue.

---

## Next Steps

1. **Stability Sprint** — Fix 42 test failures + 3 CRITICAL security items (estimated: significant but necessary)
2. **Decide on E2b-6** — Implement export/import or explicitly defer to a later epic
3. **Then E3** — Event Bus + Audit Trail, building on a stable foundation

---

## Team Participants

- Bob (Scrum Master) — Facilitator
- Alice (Product Owner) — Business perspective
- Charlie (Senior Dev) — Technical analysis
- Dana (QA Engineer) — Quality assessment
- Elena (Junior Dev) — Growth perspective
- Mohammed (Project Lead) — Strategic direction
