# Epic E2 Retrospective — API Server + Auth + Multi-Company RBAC

**Date:** 2026-02-19
**Epic:** E2 — API Server + Auth + Multi-Company RBAC
**Status:** Complete (6/6 stories)
**Agent:** Claude Opus 4.6 (all stories)

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 6/6 (100%) |
| Story Failures | 0 (improvement over E1's 2 failures) |
| Code Reviews Performed | 5 (E2-3 has no documented CR) |
| CR Issues Found | ~58 (13 HIGH, 29 MEDIUM, 16 LOW) |
| HIGH Issues Unresolved | 13 |

### Story Breakdown

| Story | Title | CR Issues (H/M/L) | Key Output |
|-------|-------|--------------------|------------|
| E2-1 | Fastify API Bootstrap | 3/6/3 | Fastify 5.x app factory, error hierarchy, Zod validation, structured logging, health endpoint |
| E2-2 | JWT Authentication | 3/5/4 | JWT auth (jose), Argon2id password hashing, httpOnly cookies, login rate limiting, JWT verify hook |
| E2-3 | MFA (TOTP) | No CR | TOTP via otpauth, MFA setup/verify/reset routes, login flow MFA integration |
| E2-4 | Multi-Company Context Middleware | 3/7/2 | Company context middleware, sharing-aware query helper, company switch endpoint |
| E2-5 | RBAC Permission Guards | 0/6/4 | RBAC guard factory (preHandler), role hierarchy, module gating |
| E2-6 | User & Company Management API | 4/5/3 | User CRUD, company profile CRUD, default number series, system module pattern |

---

## E1 Retro Follow-Through

| E1 Action Item | Status | Evidence |
|---|---|---|
| 1. Fix ON DELETE SET NULL -> RESTRICT on UserCompanyRole | :hourglass: Unverified | Not explicitly addressed in any E2 story |
| 2. Align ViewScope enum with spec | :hourglass: Unverified | Not explicitly addressed in any E2 story |
| 3. Require transaction param in nextNumber() | :hourglass: Unverified | Not explicitly addressed in any E2 story |
| 4. Add PRISMA_USER_CONSENT to .env | Done | Referenced in E2-1, E2-2, E2-3 dev notes |
| 5. Add "never use db push" rule to story templates | Done | Explicit section in every E2 story template |
| 6. Document protected files from prior stories | Done | Protected files list in every E2 story |
| 7. Fix Node.js v22 alignment | Done | E2-1 dev notes specify Node.js 22 LTS |
| 8. Update specs for enum/field divergences | Done | Commit f437b73 updated all spec documents |

**Result:** 4/8 confirmed done, 1 partial, 3 unverified (DB-level fixes #1-3 need manual confirmation).

---

## What Went Well

1. **100% delivery with zero failures** — All 6 stories completed autonomously. No story required retry (unlike E1 which had 2 failed first attempts for E1-4 and E1-5).

2. **E1 retro process learnings fully adopted** — "Never use db push", protected files lists, PRISMA_USER_CONSENT — all embedded in every story template. This prevented the migration state corruption that plagued E1.

3. **Clean layered middleware architecture** — JWT verify -> company context -> RBAC guard. Each layer does one thing, composes cleanly. The RBAC guard adds zero latency (reads pre-resolved role, no DB queries).

4. **Sound library choices** — `jose` (ESM-native JWT), `otpauth` (ESM TOTP), `argon2` (OWASP-recommended password hashing). All worked without ESM/CJS import issues.

5. **First business module pattern established** — E2-6 created the standard `modules/system/` structure (routes, services, schemas) that all future modules will follow. Includes cursor-based pagination, RBAC guards on every route, response envelope pattern.

6. **Zero regressions** — Each story verified all existing tests continued to pass before marking complete.

7. **Shared test utility created** — `test-utils/jwt.ts` addresses the test helper duplication pattern.

8. **Auth flow is architecturally complete** — Login, JWT, refresh tokens (httpOnly cookies), MFA (TOTP), company switching, RBAC with per-company overrides, user/company CRUD — all working end-to-end.

---

## Challenges

### 1. Code Review Issue Accumulation (13 HIGH issues)

Every story with a code review hit the 3-iteration CR limit with remaining issues:

| Story | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| E2-1 | 3 | 6 | 3 | 12 |
| E2-2 | 3 | 5 | 4 | 12 |
| E2-3 | -- | -- | -- | No CR |
| E2-4 | 3 | 7 | 2 | 12 |
| E2-5 | 0 | 6 | 4 | 10 |
| E2-6 | 4 | 5 | 3 | 12 |
| **Total** | **13** | **29** | **16** | **58** |

**Root Cause:** Same pattern as E1. The 3-iteration CR limit is insufficient for complex stories. The dev agent doesn't prioritize HIGH issues over MEDIUM/LOW during CR iterations.

### 2. Security-Critical Issues Left Unresolved

The 13 HIGH issues include serious security vulnerabilities:

- **Privilege escalation** (E2-6 #1): ADMIN can create SUPER_ADMIN users — no role ceiling enforcement
- **JWT claims not validated** (E2-2 #1): After signature verification, payload claims (sub, tenantId, role) are used without type/presence validation
- **Non-null assertion on payload.sub** (E2-2 #2): `payload.sub!` silently passes undefined as userId
- **Company-ID enumeration** (E2-4 #1): Inconsistent 404 vs 403 between middleware and switch endpoint allows UUID enumeration
- **Self-deactivation** (E2-6 #2): Admin can deactivate themselves, orphaning the company with no admin
- **baseCurrencyCode mutability** (E2-6 #4): Changing base currency after transactions would corrupt all monetary data
- **Unsafe type assertion** (E2-6 #3): `tx as unknown as PrismaClient` bypasses TypeScript safety

### 3. Known Issues Persist Across Stories

The "no setNotFoundHandler" bug was flagged in E2-1 (CR #2) and again in E2-2 (CR #8). Neither story fixed it. The dev agent treats each story as isolated and doesn't address known issues from prior stories unless explicitly tasked.

Similarly, the hardcoded Zod role enum in `company.schema.ts:18` was flagged as HIGH in E2-4 (CR #3), warned about in E2-5's "Previous Story Intelligence", E2-6 used correct `z.nativeEnum()` in new code, but the existing file was left unfixed.

### 4. E2-3 Missing Code Review

E2-3 (MFA TOTP) has no "Code Review Notes" section in its story file. This is either a skipped review or lost documentation.

### 5. Test Utility Duplication

`makeTestJwt()` was duplicated identically in 3+ test files. E2-6 created `test-utils/jwt.ts` but `app.test.ts` still has its own local version (E2-6 CR #7).

---

## Technical Debt

### Must Fix Before E3 (Security — 7 items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 1 | Privilege escalation: ADMIN can create SUPER_ADMIN | CRITICAL | E2-6 CR #1 |
| 2 | JWT claims not validated after signature verification | CRITICAL | E2-2 CR #1 |
| 3 | Non-null assertion on payload.sub | CRITICAL | E2-2 CR #2 |
| 4 | Self-deactivation not prevented | HIGH | E2-6 CR #2 |
| 5 | Company-ID enumeration via inconsistent 404/403 | HIGH | E2-4 CR #1 |
| 6 | baseCurrencyCode mutable after creation | HIGH | E2-6 CR #4 |
| 7 | Unsafe `tx as unknown as PrismaClient` assertion | HIGH | E2-6 CR #3 |

### Must Fix Before E3 (Infrastructure — 5 items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 8 | No setNotFoundHandler — 404s break error envelope | HIGH | E2-1 CR #2, E2-2 CR #8 |
| 9 | 3 Swagger/OpenAPI tests failing (500 instead of 200) | MEDIUM | E2-1 CR #1 |
| 10 | Missing zod-to-json-schema dependency | MEDIUM | E2-1 CR #3 |
| 11 | Hardcoded Zod role enum in company.schema.ts:18 | MEDIUM | E2-4 CR #3 |
| 12 | makeTestJwt duplication across test files | MEDIUM | E2-4 CR #11, E2-6 CR #7 |

### Must Verify (E1 Carry-Forward — 3 items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 13 | ON DELETE SET NULL -> RESTRICT on UserCompanyRole | HIGH | E1 Retro #1 |
| 14 | ViewScope enum alignment with spec | HIGH | E1 Retro #2 |
| 15 | nextNumber() requires transaction parameter | HIGH | E1 Retro #3 |

### Carry Forward (Selected MEDIUM items)

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 16 | getVisibleCompanyIds() doesn't filter NONE sharing rules | MEDIUM | E2-4 CR #2 |
| 17 | No successListEnvelope shared helper for paginated responses | MEDIUM | E2-6 CR #9 |
| 18 | RequestContext.role vs FastifyRequest.userRole naming inconsistency | MEDIUM | E2-4 CR #7 |
| 19 | 2-5 DB queries per authenticated request with no caching | MEDIUM | E2-4 CR #6 |
| 20 | JWT secret re-encoded on every call (getJwtSecret) | MEDIUM | E2-2 CR #3 |
| 21 | SUPER_ADMIN module bypass undocumented | MEDIUM | E2-5 CR #2 |
| 22 | No cross-company isolation integration test | MEDIUM | E2-6 CR #5 |

---

## E3 Preview

**Epic E3:** Event Bus + Audit Trail
- 3 stories: Event Bus Infrastructure, Audit Trail Service, Event Persistence & Dead Letter
- **Dependencies on E2:** Event emitter placeholder (event-emitter.ts), full API infrastructure, auth/RBAC pipeline
- **New tech:** BullMQ/Redis for dead-letter queue
- **New Prisma model:** AuditLog with PostgreSQL immutability RULES (raw SQL in migration)
- **Key risk:** E3-2 requires Prisma migration with raw SQL — same pattern that caused issues in E1. The `--create-only` + manual SQL workflow needs clear documentation.

---

## Action Items

### Security Fixes (CRITICAL — Before E3)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Fix privilege escalation: add role ceiling check in createUser/updateRole | Dev | CRITICAL |
| 2 | Validate JWT claims after signature verification | Dev | CRITICAL |
| 3 | Fix payload.sub non-null assertion | Dev | CRITICAL |
| 4 | Prevent self-deactivation (sole ADMIN check) | Dev | HIGH |
| 5 | Fix company-ID enumeration (consistent 403 responses) | Dev | HIGH |
| 6 | Make baseCurrencyCode immutable after company creation | Dev | HIGH |
| 7 | Fix unsafe type assertion in deactivateUser transaction | Dev | HIGH |

### Infrastructure Fixes (Before E3)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 8 | Add setNotFoundHandler with standard error envelope | Dev | HIGH |
| 9 | Fix 3 failing Swagger/OpenAPI tests | Dev | MEDIUM |
| 10 | Add missing zod-to-json-schema dependency | Dev | MEDIUM |
| 11 | Fix hardcoded Zod role enum in company.schema.ts | Dev | MEDIUM |
| 12 | Consolidate makeTestJwt to shared test-utils across ALL test files | Dev | MEDIUM |

### Process Improvements

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 13 | Perform code review for E2-3 (MFA) — was not documented | SM | MEDIUM |
| 14 | Evaluate increasing CR iteration limit from 3 to 5 | SM | MEDIUM |
| 15 | Add "known issues from previous story" as mandatory dev agent section | SM | MEDIUM |
| 16 | Create E3 story template section for raw SQL migration pattern | SM | MEDIUM |

### E1 Carry-Forward Verification

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 17 | Verify ON DELETE SET NULL -> RESTRICT on UserCompanyRole | Dev | HIGH |
| 18 | Verify ViewScope enum alignment with spec | Dev | HIGH |
| 19 | Verify nextNumber() requires transaction parameter | Dev | HIGH |

---

## E3 Preparation Tasks

**Technical Setup:**
- [ ] Resolve security fixes #1-7
- [ ] Resolve infrastructure fixes #8-12
- [ ] Verify E1 carry-forward items #17-19
- [ ] Add Redis to docker-compose.dev.yml for BullMQ
- [ ] Research BullMQ + Fastify integration patterns

**Knowledge Development:**
- [ ] Document PostgreSQL RULES pattern for audit immutability
- [ ] Document `--create-only` migration + raw SQL workflow for E3 stories

**Cleanup/Refactoring:**
- [ ] Fix getVisibleCompanyIds() to filter NONE sharing rules
- [ ] Create shared successListEnvelope helper for paginated responses

---

## Significant Discoveries

**Finding:** The code review 3-iteration cap combined with the dev agent's literal story scope adherence creates a structural pattern where known issues accumulate across stories. 13 HIGH issues across E2 is unsustainable — the fix rate must exceed the creation rate.

**Impact on E3:** If E3's audit trail is built on unresolved security issues (privilege escalation, JWT gaps), the audit data itself may be untrustworthy. Security hardening is architecturally prerequisite to audit trail.

**Recommendation:** Complete security hardening pass (items #1-7) before starting E3. Consider these as E2 "fix stories" rather than E3 prerequisites.

---

## Key Takeaways

1. **E2 delivered 100% with zero failures** — process improvements from E1 retro prevented migration issues and protected file deletion
2. **Security issues are the #1 concern** — 13 HIGH CR issues need resolution before E3
3. **CR 3-iteration limit is structurally insufficient** — same finding as E1, needs process change
4. **Layered middleware architecture is excellent** — JWT -> company-context -> RBAC is the right design
5. **Known issues persist across stories** — dev agent needs mechanism to address flagged issues in adjacent files

---

## Team Participants

- Bob (Scrum Master) — Facilitator
- Alice (Product Owner) — Business perspective
- Charlie (Senior Dev) — Technical analysis
- Dana (QA Engineer) — Quality assessment
- Elena (Junior Dev) — Growth perspective
- Mohammed (Project Lead) — Strategic direction
