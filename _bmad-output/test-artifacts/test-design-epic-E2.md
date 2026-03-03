---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-18'
---

# Test Design: Epic E2 - API Server + Auth + Multi-Company RBAC

**Date:** 2026-02-18
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E2 — API Server + Auth + Multi-Company RBAC

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (>=6): 5
- Critical categories: SEC (6), TECH (3), DATA (1), PERF (1), OPS (1)

**Coverage Summary:**

- P0 scenarios: 16 (~20-32 hours)
- P1 scenarios: 16 (~12-20 hours)
- P2 scenarios: 10 (~4-8 hours)
- P3 scenarios: 4 (~1-3 hours)
- **Total effort**: ~37-63 hours (~5-8 days)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Frontend UI** | E2 is API-only; no React components | API contract tests validate response shapes; UI tested when E6 is built |
| **Event bus emission** | Event bus infrastructure is E3 | Event payload shapes validated via unit tests; actual emission tested in E3 |
| **Platform API integration** | Platform tenant entitlement checks (BR-PLT-019, BR-PLT-020) depend on platform-api service from E3b | Auth service designed with entitlement hook; integration tested when E3b is built |
| **Password reset flow** | Low-risk, standard implementation; no email service available until E10 | Email-less reset not meaningful; tested when E10 Email Integration is built |
| **AI orchestration / approval gates** | AI layer is E5; NFR16 approval-gate not applicable until AI actions exist | API structure supports AI action audit; gate tested in E5 |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| R-001 | SEC | JWT token verification bypass — if `onRequest` hook is misconfigured or skipped on a route, endpoints become publicly accessible | 2 | 3 | 6 | Integration test: every authenticated route returns 401 without token; negative test with expired/malformed tokens | Dev | Sprint E2 |
| R-002 | SEC | RBAC role resolution flaw — null handling in company-specific vs global role lookup could grant unintended access (e.g., `companyId = null` treated as wildcard) | 2 | 3 | 6 | Unit tests for `resolveUserRole()` covering all 3 paths; integration tests for each role boundary (STAFF denied MANAGER route, VIEWER denied STAFF route) | Dev | Sprint E2 |
| R-003 | SEC | Refresh token replay after rotation — if old refresh token is not properly invalidated during rotation, stolen tokens can be replayed indefinitely | 2 | 3 | 6 | Integration test: refresh token, then attempt reuse of old token (must fail); concurrent refresh race condition test | Dev | Sprint E2 |
| R-004 | SEC | MFA challenge bypass — if the two-step auth flow allows full JWT issuance without verifying TOTP when `mfaEnabled=true`, second factor is useless | 2 | 3 | 6 | Integration test: login with valid creds + mfaEnabled → assert no accessToken in response, only `requiresMfa: true`; then verify with valid TOTP → assert JWT issued | Dev | Sprint E2 |
| R-007 | DATA | Company context middleware missing on routes — if a route handler skips company-context middleware, queries execute without companyId scoping, exposing cross-company data | 2 | 3 | 6 | Integration test: every CRUD endpoint verifies returned data belongs to ctx.companyId only; negative test: request with wrong X-Company-ID returns 403 | Dev | Sprint E2 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| R-006 | SEC | Account lockout bypass — if failed login tracking uses in-memory store instead of Redis, lockout resets on server restart | 2 | 2 | 4 | Integration test: 5 failed attempts → 6th blocked; verify count persists across test scenarios | Dev |
| R-008 | PERF | Argon2id hashing latency — memory-hard hashing under concurrent login load may cause server resource contention and slow responses | 2 | 2 | 4 | Benchmark test: 50 concurrent logins complete within acceptable latency; tune Argon2 memory/time parameters | Dev |
| R-009 | TECH | Zod validation schema mismatch — if Zod schemas diverge from API contract spec, valid requests rejected or invalid requests accepted | 2 | 2 | 4 | Test: submit request matching API contract → 200; submit request violating contract → 400 with field errors | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| R-005 | TECH | Tenant database routing returns wrong PrismaClient for tenantId | 1 | 3 | 3 | Monitor; unit test TenantDatabaseManager cache key logic |
| R-010 | SEC | Information leakage on failed login — error differentiates "user not found" vs "wrong password" | 1 | 2 | 2 | Test: wrong email returns same error as wrong password (INVALID_CREDENTIALS) |
| R-011 | TECH | CORS misconfiguration allows credential requests from wildcard origins | 1 | 2 | 2 | Test: verify CORS response headers match expected allowed origins |
| R-012 | OPS | Health endpoint missing or returning stale data | 1 | 1 | 1 | Smoke test: GET /health returns 200 with status, version, uptime |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] E1 complete (database models, Prisma schemas, seed data)
- [ ] PostgreSQL containers running (nexa_erp_dev + nexa_platform_dev)
- [ ] Redis container running (for refresh token revocation + rate limiting)
- [ ] E1 seed data populated (users, companies, currencies, number series)
- [ ] Fastify dev dependencies installed (fastify, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger)
- [ ] Auth dependencies installed (argon2, jose or jsonwebtoken, otplib)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>=95%)
- [ ] No open high-severity bugs against E2 auth/RBAC
- [ ] JWT auth flow works end-to-end (login → access → refresh → logout)
- [ ] MFA setup + verify + login-with-MFA flow complete
- [ ] RBAC enforced on all E2 endpoints (role + module gating)
- [ ] Company context middleware scopes all queries by companyId

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority based on risk and business impact, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria**: Blocks core functionality + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E2.2-API-001 | Login with valid email/password returns accessToken (15min), refreshToken (httpOnly cookie), user profile with role + enabledModules | API | R-001 | AC #1 |
| E2.2-API-002 | Login with invalid credentials returns 401 INVALID_CREDENTIALS — same message for wrong email and wrong password | API | R-010 | AC #4 — no info leakage |
| E2.2-API-003 | Refresh with valid refresh token cookie issues new access token and rotates refresh token | API | R-003 | AC #2 |
| E2.2-API-004 | Old refresh token rejected after rotation (replay prevention) | API | R-003 | Defense-in-depth |
| E2.2-API-005 | Logout revokes refresh token; subsequent refresh attempt fails | API | R-003 | AC #3 |
| E2.2-API-006 | JWT onRequest hook rejects missing, expired, and malformed tokens with 401 | API | R-001 | AC #6 |
| E2.2-API-007 | Account locked after 5 failed logins in 15 minutes; 6th returns 423 ACCOUNT_LOCKED | API | R-006 | AC #5, NFR15 |
| E2.3-API-001 | Login with mfaEnabled=true + no mfaToken returns `requiresMfa: true`, no JWT issued | API | R-004 | AC #3 |
| E2.3-API-002 | Login with mfaEnabled=true + valid TOTP → full JWT tokens issued | API | R-004 | AC #4 |
| E2.3-API-003 | Login with mfaEnabled=true + invalid TOTP → 401 MFA_INVALID | API | R-004 | Negative path |
| E2.5-API-001 | RBAC guard: STAFF user denied access to MANAGER-minimum route (403 FORBIDDEN) | API | R-002 | AC #1 |
| E2.5-API-002 | RBAC guard: company-specific VIEWER override for Company 3 takes precedence over ADMIN global role | API | R-002 | AC #2 |
| E2.5-API-003 | RBAC guard: user with no global role and no company-specific role → 403 FORBIDDEN | API | R-002 | AC #3 |
| E2.5-API-004 | Module gating: user without target module in enabledModules → 403 MODULE_NOT_ENABLED | API | R-002 | AC #5 |
| E2.4-API-001 | Company context middleware: queries scoped to ctx.companyId — data from other companies not returned | API | R-007 | AC #1, #4 |
| E2.4-API-002 | X-Company-ID header with unauthorized companyId → 403 FORBIDDEN | API | R-007 | AC #3 |

**Total P0**: 16 tests, ~20-32 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E2.1-API-001 | GET /health returns `{ status: "ok", version, uptime }` with 200 | API | R-012 | AC #6 |
| E2.1-API-002 | Error handler returns standardized envelope `{ success: false, error: { code, message, details? } }` for all error types | API | R-009 | AC #3 |
| E2.1-API-003 | Zod validation failure returns 400 with field-level error details | API | R-009 | AC #4 |
| E2.1-API-004 | Correlation ID generated if X-Correlation-ID header not present; included in response | API | — | AC #2 |
| E2.3-API-004 | MFA setup returns TOTP secret (base32) and QR code URI | API | — | AC #1 |
| E2.3-API-005 | MFA verify with valid TOTP enables mfaEnabled=true permanently | API | — | AC #2 |
| E2.4-API-003 | No X-Company-ID header → middleware uses user.companyId as default | API | — | AC #2 |
| E2.4-API-004 | POST /system/companies/:id/switch updates user's default company | API | — | AC #6 |
| E2.4-API-005 | Shared entity query uses getVisibleCompanyIds() — SELECTED mode returns correct companies | API | — | AC #5 |
| E2.5-UNIT-001 | Role hierarchy: SUPER_ADMIN(5) > ADMIN(4) > MANAGER(3) > STAFF(2) > VIEWER(1) — numeric comparison passes for all combinations | Unit | — | AC #4 |
| E2.5-UNIT-002 | resolveUserRole: returns company-specific role, then global role, then null — 3-path coverage | Unit | R-002 | AC #6 |
| E2.6-API-001 | POST /system/users creates user with Argon2id hashed password (hash verifiable) | API | R-008 | AC #1 |
| E2.6-API-002 | GET /system/users with cursor pagination returns correct page | API | — | AC #3 |
| E2.6-API-003 | PATCH /system/users/:id/role updates role and creates audit log entry | API | — | AC #2 |
| E2.6-API-004 | GET /system/company-profile returns current company based on ctx.companyId | API | — | AC #5 |
| E2.6-API-005 | STAFF user denied POST /system/users → 403 (ADMIN minimum required) | API | R-002 | AC #6 |

**Total P1**: 16 tests, ~12-20 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E2.1-API-005 | Structured logger outputs JSON with correlationId, tenantId, userId, module fields | API | — | AC #5 |
| E2.1-API-006 | Rate limiter returns 429 when limit exceeded | API | R-006 | NFR15 |
| E2.2-API-008 | JWT claims contain correct userId, tenantId, role, enabledModules | Unit | R-001 | Token payload verification |
| E2.2-API-009 | TenantDatabaseManager returns correct PrismaClient for tenantId and caches it | Unit | R-005 | Tenant routing |
| E2.3-API-006 | Admin MFA reset clears mfaSecret, sets mfaEnabled=false | API | — | AC #6 |
| E2.3-API-007 | MFA enforcement: warning logged for ADMIN+ without MFA (not blocking) | API | — | AC #5 |
| E2.4-API-006 | buildCompanyWhereClause generates correct Prisma where clause with companyId filter | Unit | R-007 | Utility function |
| E2.6-API-006 | POST /system/company-profile creates company + generates default NumberSeries set | API | — | AC #4 |
| E2.6-API-007 | PATCH /system/users/:id/modules validates module list against known modules | API | — | Input validation |
| E2.6-API-008 | GET /system/company-profile with no company found → 404 | API | — | Edge case |

**Total P2**: 10 tests, ~4-8 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
| ------- | ----------- | ---------- | ----- |
| E2.2-PERF-001 | Login endpoint responds within 500ms under 50 concurrent users | API | NFR2, NFR7 benchmark |
| E2.2-PERF-002 | JWT verification hook adds <5ms overhead per request | Unit | Micro-benchmark |
| E2.1-API-007 | OpenAPI docs generated and accessible via /documentation | API | NFR45 |
| E2.6-PERF-001 | User CRUD operations complete within 500ms (IMP-009) | API | NFR2 benchmark |

**Total P3**: 4 tests, ~1-3 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if <15 min; defer only if expensive or long-running.

| Trigger | What Runs | Expected Duration |
| ------- | --------- | ----------------- |
| **Every PR** | All unit + API integration tests (P0, P1, P2, P3 functional) | ~8-12 min (Vitest parallel + Fastify inject) |
| **Nightly** | Performance benchmarks (E2.2-PERF-001, E2.2-PERF-002, E2.6-PERF-001) | ~3-5 min |

Since E2 tests are API-level (using Fastify's `inject()` for HTTP simulation) and unit tests, all functional tests fit within PR runs. Performance benchmarks with concurrent load are deferred to nightly.

---

## Resource Estimates

| Priority | Count | Effort Range | Notes |
| -------- | ----- | ------------ | ----- |
| P0 | 16 | ~20-32 hours | Auth flows, RBAC boundaries, company isolation — complex setup, security-critical |
| P1 | 16 | ~12-20 hours | Standard endpoint testing, CRUD, middleware validation |
| P2 | 10 | ~4-8 hours | Edge cases, utility functions, logging verification |
| P3 | 4 | ~1-3 hours | Benchmarks, OpenAPI validation |
| **Total** | **46** | **~37-63 hours** | **~5-8 days** |

### Prerequisites

**Test Data:**
- User factory (email, passwordHash via Argon2id, role, companyId, enabledModules)
- Company factory (name, legalName, baseCurrencyCode)
- UserCompanyRole factory (userId, companyId, role — supports global and company-specific)
- RefreshToken factory (userId, tokenHash, expiresAt)
- Seeded MFA user (mfaEnabled=true, mfaSecret set)

**Tooling:**
- Vitest for unit + API integration tests
- Fastify inject() for HTTP-level API tests (no real HTTP server needed)
- Docker Compose for PostgreSQL + Redis containers
- otplib/speakeasy for generating valid TOTP tokens in tests
- argon2 for creating pre-hashed passwords in fixtures

**Environment:**
- PostgreSQL 16 container (nexa_erp_dev) via Docker Compose
- Redis 7 container for refresh token revocation + rate limiting
- Node.js 20+ with Fastify 5.x, Prisma 7.x

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] JWT auth flow verified end-to-end (R-001, R-003)
- [ ] MFA bypass impossible (R-004)
- [ ] RBAC role resolution correct for all 3 paths (R-002)
- [ ] Company data isolation verified (R-007)

---

## Mitigation Plans

### R-001: JWT Token Verification Bypass (Score: 6)

**Mitigation Strategy:**
1. Ensure `onRequest` hook is registered globally for all routes except `/auth/login`, `/auth/password/reset-request`, `/auth/password/reset`, and `/health`
2. Test every authenticated route without token → 401
3. Test with expired token → 401
4. Test with malformed token → 401

**Owner:** Dev
**Timeline:** Sprint E2
**Status:** Planned
**Verification:** E2.2-API-006 passes; no route returns 200 without valid JWT

### R-002: RBAC Role Resolution Flaw (Score: 6)

**Mitigation Strategy:**
1. Unit test `resolveUserRole()` with all 3 resolution paths
2. Integration test: user with ADMIN global + VIEWER for Company 3 → Company 3 access uses VIEWER
3. Integration test: user with no roles → 403
4. Integration test: role hierarchy enforcement at every boundary (VIEWER < STAFF < MANAGER < ADMIN < SUPER_ADMIN)

**Owner:** Dev
**Timeline:** Sprint E2
**Status:** Planned
**Verification:** E2.5-API-001 through E2.5-API-004 and E2.5-UNIT-001, E2.5-UNIT-002 pass

### R-003: Refresh Token Replay After Rotation (Score: 6)

**Mitigation Strategy:**
1. On refresh: mark old token as revoked (set `revokedAt`), issue new token
2. Test: refresh → reuse old token → must fail
3. Test: concurrent refresh calls → only one succeeds, other gets 401
4. Test: logout → refresh → must fail

**Owner:** Dev
**Timeline:** Sprint E2
**Status:** Planned
**Verification:** E2.2-API-003, E2.2-API-004, E2.2-API-005 pass

### R-004: MFA Challenge Bypass (Score: 6)

**Mitigation Strategy:**
1. Login handler: if `user.mfaEnabled === true` and no `mfaToken` provided, return `requiresMfa: true` with NO JWT tokens
2. Login handler: if `user.mfaEnabled === true` and `mfaToken` provided but invalid → 401 MFA_INVALID
3. Only issue JWT when MFA is disabled OR MFA token is verified
4. Test the exact boundary: valid creds + mfaEnabled + no mfaToken → no accessToken in response body

**Owner:** Dev
**Timeline:** Sprint E2
**Status:** Planned
**Verification:** E2.3-API-001, E2.3-API-002, E2.3-API-003 pass

### R-007: Company Context Middleware Missing on Routes (Score: 6)

**Mitigation Strategy:**
1. Register company-context middleware at the Fastify instance level (not per-route)
2. Integration test: create data in Company A and Company B, request as Company A user → only Company A data returned
3. Integration test: attempt to set X-Company-ID to unauthorized company → 403
4. Test: no X-Company-ID header → falls back to user.companyId

**Owner:** Dev
**Timeline:** Sprint E2
**Status:** Planned
**Verification:** E2.4-API-001, E2.4-API-002 pass

---

## Assumptions and Dependencies

### Assumptions

1. E1 is complete — all database models (User, UserCompanyRole, CompanyProfile, RefreshToken) exist and migrations applied
2. Redis is available for refresh token revocation list and rate limiting counters
3. Fastify 5.x is the API framework (per Architecture decisions)
4. Argon2id is used for password hashing (not bcrypt)
5. JWT access tokens carry `userId`, `tenantId`, `role`, `enabledModules[]` claims
6. Tests use Fastify `inject()` for API-level testing (no real HTTP server, no network overhead)

### Dependencies

1. PostgreSQL containers running with E1 seed data — Required before any test execution
2. Redis container running — Required for refresh token and rate limiting tests
3. E1 utility functions (`resolveUserRole`, `getVisibleCompanyIds`) — Required for RBAC and multi-company tests
4. E1 NumberSeries service (`nextNumber`) — Required for company creation tests

### Risks to Plan

- **Risk**: Redis unavailability causes rate limiting and token revocation tests to fail
  - **Impact**: P0 tests for account lockout and token revocation blocked
  - **Contingency**: Docker Compose health check on Redis before test execution

- **Risk**: Argon2id native module compilation issues on CI
  - **Impact**: User creation and login tests fail on CI but pass locally
  - **Contingency**: Pre-built Docker image with Argon2 binaries; fallback to argon2-browser

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **E1 Database Models** | User, UserCompanyRole, CompanyProfile, RefreshToken schemas used by all auth/RBAC services | E1 migration + seed tests must still pass; no schema breaking changes |
| **E1 resolveUserRole** | Used by RBAC guard for role resolution | E1.3-UNIT-001 through E1.3-UNIT-003 must still pass |
| **E1 getVisibleCompanyIds** | Used by company context middleware for sharing queries | E1.3-UNIT-001 through E1.3-UNIT-003 must still pass |
| **E1 NumberSeries** | Company creation auto-generates default number series | E1.5-INT-001 through E1.5-INT-003 must still pass |
| **E0 Docker Compose** | PostgreSQL + Redis containers must be running | Docker Compose up succeeds, health checks pass |
| **E3 Event Bus (future)** | Auth events (`user.login`, `settings.updated`) will emit via event bus | E2 defines event payload shape; actual emission deferred to E3 |
| **E6 Frontend (future)** | Frontend will consume all E2 API endpoints | E2 API contracts must remain stable; OpenAPI spec is the contract |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (TECH/SEC/PERF/DATA/BUS/OPS categories)
- `probability-impact.md` — Risk scoring methodology (1-3 scales, 6+ threshold)
- `test-levels-framework.md` — Test level selection (Unit > Integration > E2E pyramid)
- `test-priorities-matrix.md` — P0-P3 prioritization criteria

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/functional-requirements.md` (FR80-84, FR172, FR174-177)
- PRD: `_bmad-output/planning-artifacts/prd/non-functional-requirements.md` (NFR2, NFR10-16, NFR45)
- Epic: `_bmad-output/planning-artifacts/epics/epic-e2-api-server-auth-multi-company-rbac.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md`
- API Contracts: `_bmad-output/planning-artifacts/api-contracts/3-detailed-endpoint-specifications.md`
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md` (IMP-007, IMP-008, IMP-009, BR-PLT-018)
- Event Catalog: `_bmad-output/planning-artifacts/event-catalog.md` (user.login, settings.updated)
- Project Context: `_bmad-output/planning-artifacts/project-context.md` (Multi-Company, RBAC resolution)
- Prior Test Design: `_bmad-output/test-artifacts/test-design-epic-E1.md`

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (BMad v6)
