---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-20'
---

# Test Design: Epic E2b - Granular RBAC & Access Groups

**Date:** 2026-02-20
**Author:** Mohammed
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic E2b — Granular RBAC & Access Groups

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (>=6): 5
- Critical categories: SEC (4), DATA (1)

**Coverage Summary:**

- P0 scenarios: 12 (~18-30 hours)
- P1 scenarios: 12 (~10-18 hours)
- P2 scenarios: 8 (~3-6 hours)
- P3 scenarios: 4 (~1-3 hours)
- **Total effort**: ~32-57 hours (~4-7 days)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Frontend UI for access group management** | E2b is API-only; admin UI screens for managing access groups belong to E6+ | API contract tests validate response shapes; UI tested when frontend shell is built |
| **Event bus emission for access group events** | Event bus infrastructure is E3; E2b defines event payload shapes | Event payload shapes documented in event catalog; actual emission tested in E3 |
| **Platform-level tenant permission management** | Platform admin portal (E13b) manages cross-tenant permissions | E2b scopes to within-tenant company-level RBAC only |
| **UI field rendering (READ_ONLY visual treatment)** | Frontend interprets `_fieldMeta` from API response; E2b only tests API-level field stripping | Frontend tests in E6 validate field rendering based on `_fieldMeta` |
| **enabledModules migration tooling** | Legacy data migration for existing users' enabledModules is operational, not tested here | Manual verification during deployment; module derivation tested via API |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| R-001 | SEC | Permission guard bypass — if `createPermissionGuard(resourceCode, action)` fails to check the permission matrix correctly, users access resources they should not | 2 | 3 | 6 | Integration tests: every guarded route returns 403 without matching permission; test each action (canAccess, canNew, canView, canEdit, canDelete) independently | Dev | Sprint E2b |
| R-002 | SEC | Most-permissive-wins logic error — if OR merge across access groups has a bug (e.g., short-circuit evaluation, missing group in merge), permissions resolve incorrectly | 2 | 3 | 6 | Unit test: permission resolution with 2+ groups where one grants and one denies each action; verify OR logic for all 5 action flags | Dev | Sprint E2b |
| R-004 | DATA | Permission cache stale after changes — if cache invalidation fails after access group edit, user-group reassignment, or field override change, users retain old permissions for up to 60 seconds | 2 | 3 | 6 | Integration test: modify permission, immediately call guarded endpoint, verify new permission applies; test cache key format `permissions:{userId}:{companyId}` | Dev | Sprint E2b |
| R-005 | SEC | Field-level visibility leak — if `filterFieldsByPermission()` onSend hook fails to strip HIDDEN fields or misses nested field paths (e.g., `lines[].costPrice`), sensitive data is exposed in API responses | 2 | 3 | 6 | Integration test: set field override to HIDDEN, request entity, verify field absent from response JSON; test nested paths and array fields | Dev | Sprint E2b |
| R-008 | SEC | Cross-company access group leakage — if companyId scoping is missing on access group queries, users in Company A can view or modify Company B's access groups and permissions | 2 | 3 | 6 | Integration test: create access groups in Company A and B, request as Company A user, verify only Company A groups returned; attempt to modify Company B group via ID injection | Dev | Sprint E2b |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| R-003 | SEC | SUPER_ADMIN bypass failure — if the guard short-circuit for SUPER_ADMIN role is missing or broken, platform admins could be incorrectly blocked | 1 | 3 | 3 | Integration test: SUPER_ADMIN accesses resource without any access group assignment; verify 200 response | Dev |
| R-007 | DATA | Default data seeding failure — if `company-defaults.json` import fails silently during company creation, new companies have no access groups | 2 | 2 | 4 | Integration test: create company via API, verify 12 system access groups exist with correct permissions | Dev |
| R-009 | SEC | Non-ADMIN accessing management endpoints — if createPermissionGuard does not enforce ADMIN role for access group management routes, non-admins can create/modify/delete groups | 1 | 3 | 3 | Integration test: STAFF user attempts POST /system/access-groups -> 403 | Dev |
| R-010 | TECH | Export/import data corruption — if import does not validate JSON schema or handle partial failures, permission data could be corrupted | 2 | 2 | 4 | Integration test: import malformed JSON -> 400; import valid JSON -> verify round-trip fidelity | Dev |
| R-012 | DATA | Module access derivation incorrect — if enabledModules removal causes navigation to break because module derivation from group permissions is wrong | 2 | 2 | 4 | Integration test: assign group with sales resources only, verify /system/my-permissions returns sales module as accessible | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| R-006 | SEC | System group deletion bypass — if isSystem=true check is bypassable via direct API call, admin could delete built-in groups | 1 | 2 | 2 | Test: DELETE /system/access-groups/:id where isSystem=true -> 403/409 |
| R-011 | PERF | Permission resolution latency — multi-group merge is slow for users with many groups (5+), degrading API response time | 1 | 2 | 2 | Benchmark: resolve permissions for user with 5 groups in <50ms |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] E2 complete (API server, JWT auth, basic RBAC, company context middleware)
- [ ] E2 test suite passing (46 tests from test-design-epic-E2.md)
- [ ] PostgreSQL container running with E1+E2 migrations applied
- [ ] Redis container running (for permission cache)
- [ ] `company-defaults.json` file exists in `packages/db/default-data/`
- [ ] Prisma schema includes Resource, AccessGroup, AccessGroupPermission, AccessGroupFieldOverride, UserAccessGroup models

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>=95%)
- [ ] No open high-severity bugs against E2b permission logic
- [ ] Permission guard (`createPermissionGuard`) enforces all 5 actions on all tested routes
- [ ] Field-level visibility (`filterFieldsByPermission`) correctly strips HIDDEN and marks READ_ONLY
- [ ] Most-permissive-wins resolution verified for multi-group users
- [ ] SUPER_ADMIN bypass verified
- [ ] Permission cache invalidation working on all mutation paths
- [ ] 12 system access groups seeded on company creation

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority based on risk and business impact, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria**: Blocks core functionality + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E2b.4-API-001 | createPermissionGuard blocks user WITHOUT canAccess permission for target resource | API | R-001 | FR175, FR177 — guard denies access -> 403 |
| E2b.4-API-002 | createPermissionGuard allows user WITH canAccess permission for target resource | API | R-001 | Positive path — 200 with correct data |
| E2b.4-API-003 | createPermissionGuard checks specific action: user with canAccess but NOT canDelete -> DELETE returns 403 | API | R-001 | Tests per-action granularity (canNew, canEdit, canDelete) |
| E2b.4-UNIT-001 | Permission resolution: OR merge across multiple groups for all 5 actions (canAccess, canNew, canView, canEdit, canDelete) | Unit | R-002 | BR-RBAC-001 — Group A false + Group B true = true |
| E2b.4-API-004 | Most-permissive-wins: user with Group A (canView=false) + Group B (canView=true) -> canView resolves to true | API | R-002 | End-to-end integration of merge logic |
| E2b.4-API-005 | SUPER_ADMIN bypasses permission matrix entirely — accesses resource without any access group | API | R-003 | BR-RBAC-002 — guard short-circuit |
| E2b.4-API-006 | Permission cache invalidated after access group permission update — new permission applies immediately | API | R-004 | FR233 — modify group permissions, call guarded route, verify new state |
| E2b.4-API-007 | Permission cache invalidated after user-group assignment change | API | R-004 | Assign user to new group, verify new permissions take effect immediately |
| E2b.5-API-001 | HIDDEN fields stripped from API response by filterFieldsByPermission | API | R-005 | FR228 — set fieldPath to HIDDEN, verify field absent in response |
| E2b.5-API-002 | READ_ONLY fields present in response with `_fieldMeta` marker | API | R-005 | FR228 — set fieldPath to READ_ONLY, verify field present + _fieldMeta |
| E2b.5-API-003 | Field visibility most-permissive-wins: Group A HIDDEN + Group B VISIBLE -> VISIBLE | API | R-005 | BR-RBAC-001 — visibility merge: VISIBLE > READ_ONLY > HIDDEN |
| E2b.2-API-001 | Cross-company isolation: access groups from Company A not visible when requesting as Company B user | API | R-008 | CompanyId scoping on all access group queries |

**Total P0**: 12 tests, ~18-30 hours

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E2b.1-API-001 | GET /system/resources returns resource registry filtered by module and resourceType | API | — | FR227 — resource list with filtering |
| E2b.1-API-002 | Company creation seeds 12 default access groups from company-defaults.json | API | R-007 | BR-RBAC-007 — create company, verify 12 groups with isSystem=true |
| E2b.2-API-002 | POST /system/access-groups creates group with code unique per company | API | — | FR175 — CRUD create path |
| E2b.2-API-003 | PUT /system/access-groups/:id/permissions replaces full permission matrix | API | — | FR175 — replace-all semantics |
| E2b.2-API-004 | PUT /system/access-groups/:id/field-overrides replaces field override set | API | — | FR228 — replace-all semantics |
| E2b.2-API-005 | DELETE /system/access-groups/:id rejects deletion of isSystem=true groups | API | R-006 | BR-RBAC-003 — system group protection |
| E2b.3-API-001 | PUT /system/users/:id/access-groups assigns groups to user (replaces all) | API | — | FR176 — user-group assignment |
| E2b.3-API-002 | GET /system/users/:id/access-groups returns user's assigned groups for current company | API | — | FR176 — query assignment |
| E2b.4-API-008 | GET /system/my-permissions returns resolved permissions for current user + company | API | — | FR177, FR233 — frontend calls on login |
| E2b.4-API-009 | Module access derived from group permissions — user sees module only if canAccess on any resource in that module | API | R-012 | BR-RBAC-006 — replaces enabledModules |
| E2b.6-API-001 | GET /system/company-profile/export-defaults returns JSON with access groups + permissions | API | R-010 | FR230 — export flow |
| E2b.6-API-002 | POST /system/company-profile/import-defaults upserts access groups + permissions correctly | API | R-010 | FR230 — import flow |

**Total P1**: 12 tests, ~10-18 hours

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| E2b.2-API-006 | PATCH /system/access-groups/:id updates name and description | API | — | FR175 — update path |
| E2b.2-API-007 | POST /system/access-groups with duplicate code per company -> 409 Conflict | API | — | Unique constraint enforcement |
| E2b.3-API-003 | PUT /system/users/:id/access-groups with empty array -> 400 (minimum 1 group required) | API | — | Validation edge case |
| E2b.5-API-004 | No field override exists for a field -> defaults to VISIBLE | API | — | BR-RBAC-005 — default behavior |
| E2b.6-API-003 | Import with dryRun=true validates JSON without persisting changes | API | — | FR230 — dry run mode |
| E2b.1-API-003 | GET /system/resources with search term and isActive filter | API | — | FR227 — filtering edge cases |
| E2b.2-API-008 | GET /system/access-groups/:id returns detail with permission matrix, field overrides, and userCount | API | — | FR175 — detail view |
| E2b.4-API-010 | Non-ADMIN user blocked from all access group management endpoints | API | R-009 | BR-RBAC-008 — ADMIN minimum |

**Total P2**: 8 tests, ~3-6 hours

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
| ------- | ----------- | ---------- | ----- |
| E2b.4-PERF-001 | Permission resolution for user with 5+ groups completes in <50ms | API | Performance benchmark |
| E2b.6-API-004 | Export -> import round-trip: exported JSON re-imported produces identical permission state | API | Data integrity verification |
| E2b.2-API-009 | Clone access group: create new group copying permissions from existing group | API | FR175 — clone workflow |
| E2b.4-API-011 | Permission cache TTL: permissions expire after 60 seconds without refresh | API | FR233 — cache behavior |

**Total P3**: 4 tests, ~1-3 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs if <15 min; defer only if expensive or long-running.

| Trigger | What Runs | Expected Duration |
| ------- | --------- | ----------------- |
| **Every PR** | All unit + API integration tests (P0, P1, P2, P3 functional) | ~8-12 min (Vitest parallel + Fastify inject) |
| **Nightly** | Performance benchmark (E2b.4-PERF-001) | ~1-2 min |

All E2b tests are API-level (using Fastify `inject()`) and unit tests. No browser tests needed. The full suite fits within PR runs with Vitest parallelization. Only the performance benchmark with multi-group resolution profiling is deferred to nightly.

---

## Resource Estimates

| Priority | Count | Effort Range | Notes |
| -------- | ----- | ------------ | ----- |
| P0 | 12 | ~18-30 hours | Permission guard, field filtering, cache invalidation, cross-company isolation — complex setup |
| P1 | 12 | ~10-18 hours | CRUD operations, seeding verification, export/import, my-permissions |
| P2 | 8 | ~3-6 hours | Edge cases, validation, detail views |
| P3 | 4 | ~1-3 hours | Benchmarks, round-trip verification |
| **Total** | **36** | **~32-57 hours** | **~4-7 days** |

### Prerequisites

**Test Data:**

- AccessGroup factory (companyId, code, name, isSystem flag)
- AccessGroupPermission factory (accessGroupId, resourceCode, 5 boolean action flags)
- AccessGroupFieldOverride factory (accessGroupId, resourceCode, fieldPath, visibility)
- UserAccessGroup factory (userId, accessGroupId, companyId)
- Resource seed data (from company-defaults.json — resource registry entries)
- Multi-group user fixture (user assigned to 2+ groups with conflicting permissions for merge testing)
- Two-company fixture (Company A and Company B with separate access groups for isolation testing)

**Tooling:**

- Vitest for unit + API integration tests
- Fastify inject() for HTTP-level API tests (no real HTTP server needed)
- Docker Compose for PostgreSQL + Redis containers
- company-defaults.json as reference data for seeding verification

**Environment:**

- PostgreSQL 16 container (nexa_erp_dev) via Docker Compose
- Redis 7 container for permission cache
- Node.js 20+ with Fastify 5.x, Prisma 7.x
- E2 implementation complete and passing (auth, JWT, basic RBAC, company context)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Permission guard paths**: >=90% (all 5 actions tested)
- **Security scenarios**: 100% (all SEC-category risks covered)
- **Field-level filtering**: >=80% (HIDDEN, READ_ONLY, default VISIBLE)
- **Cache invalidation**: 100% (all mutation paths trigger invalidation)

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Permission guard verified for all 5 actions (R-001)
- [ ] Most-permissive-wins logic correct across multi-group users (R-002)
- [ ] Cache invalidation working on all mutation paths (R-004)
- [ ] HIDDEN field stripping verified including nested paths (R-005)
- [ ] Cross-company isolation verified (R-008)

---

## Mitigation Plans

### R-001: Permission Guard Bypass (Score: 6)

**Mitigation Strategy:**
1. Ensure `createPermissionGuard(resourceCode, action)` is registered as preHandler on all new E2b routes and all migrated E2 routes
2. Test each of the 5 actions independently (canAccess, canNew, canView, canEdit, canDelete)
3. Test with user who has NO access groups at all -> 403
4. Test with user who has groups but none with the target resource -> 403

**Owner:** Dev
**Timeline:** Sprint E2b
**Status:** Planned
**Verification:** E2b.4-API-001, E2b.4-API-002, E2b.4-API-003 pass

### R-002: Most-Permissive-Wins Logic Error (Score: 6)

**Mitigation Strategy:**
1. Unit test the permission merge function with all combinations: (false, false) -> false; (false, true) -> true; (true, false) -> true; (true, true) -> true
2. Integration test: user in 2 groups where Group A denies and Group B grants -> verify grant wins
3. Test field visibility merge: HIDDEN + VISIBLE -> VISIBLE; READ_ONLY + VISIBLE -> VISIBLE; HIDDEN + READ_ONLY -> READ_ONLY

**Owner:** Dev
**Timeline:** Sprint E2b
**Status:** Planned
**Verification:** E2b.4-UNIT-001, E2b.4-API-004, E2b.5-API-003 pass

### R-004: Permission Cache Stale Data (Score: 6)

**Mitigation Strategy:**
1. After PUT /system/access-groups/:id/permissions: invalidate cache for all users assigned to that group
2. After PUT /system/users/:id/access-groups: invalidate cache for that user
3. After PUT /system/access-groups/:id/field-overrides: invalidate cache for all users assigned to that group
4. Integration test: change permission, verify next API call uses new permission (no stale cache)

**Owner:** Dev
**Timeline:** Sprint E2b
**Status:** Planned
**Verification:** E2b.4-API-006, E2b.4-API-007 pass

### R-005: Field-Level Visibility Leak (Score: 6)

**Mitigation Strategy:**
1. `filterFieldsByPermission()` must run as Fastify onSend hook on all routes returning entity data
2. Test HIDDEN field removal for top-level fields (e.g., `supplierName`)
3. Test HIDDEN field removal for nested array fields (e.g., `lines[].costPrice`)
4. Test READ_ONLY marking: field present in response, `_fieldMeta.fieldPath = "READ_ONLY"` added
5. Test default: no override -> field VISIBLE (no stripping, no _fieldMeta)

**Owner:** Dev
**Timeline:** Sprint E2b
**Status:** Planned
**Verification:** E2b.5-API-001, E2b.5-API-002, E2b.5-API-003, E2b.5-API-004 pass

### R-008: Cross-Company Access Group Leakage (Score: 6)

**Mitigation Strategy:**
1. All access group queries MUST include `WHERE companyId = ctx.companyId`
2. Integration test: create groups in Company A and B, request as Company A -> only Company A groups
3. Attempt to read/update Company B's group by ID while authenticated as Company A -> 403 or 404
4. Verify permission resolution only considers groups where UserAccessGroup.companyId matches ctx.companyId

**Owner:** Dev
**Timeline:** Sprint E2b
**Status:** Planned
**Verification:** E2b.2-API-001 passes

---

## Assumptions and Dependencies

### Assumptions

1. E2 is complete — JWT auth, basic RBAC guards, company context middleware all operational and passing tests
2. Redis is available for permission cache (Map-based in-memory cache acceptable for MVP if Redis unavailable)
3. Fastify 5.x preHandler hooks support async permission resolution
4. `company-defaults.json` is the authoritative source for resource registry and default access groups
5. Permission cache key format: `permissions:{userId}:{companyId}` with 60-second TTL
6. SUPER_ADMIN role check happens before any permission matrix lookup (short-circuit)
7. `enabledModules` field is deprecated; module access is derived from access group permissions

### Dependencies

1. E2 implementation passing all 46 tests — Required before E2b test execution
2. PostgreSQL + Redis containers running — Required for permission cache tests
3. `company-defaults.json` with 12 system access groups — Required for seeding tests
4. E1 utility functions (`resolveUserRole`, `getVisibleCompanyIds`) — Used by permission resolution
5. E2 company context middleware — Required for companyId scoping on access group queries

### Risks to Plan

- **Risk**: E2 `createRbacGuard()` routes not yet migrated to `createPermissionGuard()`
  - **Impact**: P0 tests for permission enforcement fail on unmigrated routes
  - **Contingency**: Track route migration as part of E2b.4 story; test only migrated routes initially

- **Risk**: Redis unavailability causes permission cache tests to use in-memory fallback
  - **Impact**: Cache invalidation tests may pass locally but behave differently in production
  - **Contingency**: Docker Compose health check on Redis; test both cache backends if applicable

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **E2 JWT Auth** | All E2b routes require JWT authentication; permission guard runs after JWT hook | E2 auth test suite (16 P0 tests) must still pass |
| **E2 RBAC Guard** | `createRbacGuard()` is replaced by `createPermissionGuard()` on migrated routes | E2.5 RBAC tests must be updated/replaced to use new guard; existing behavior preserved for SUPER_ADMIN |
| **E2 Company Context** | Access groups are company-scoped; all queries use ctx.companyId from E2.4 middleware | E2.4 company context tests must still pass |
| **E1 Database Models** | User, CompanyProfile models extended with UserAccessGroup relation | E1 migration tests must still pass; no breaking schema changes |
| **E1 resolveUserRole** | Used by permission guard for SUPER_ADMIN detection | E1.3 unit tests must still pass |
| **E3 Event Bus (future)** | Access group events (created, updated, deleted, permissions_updated, field_overrides_updated, assignment_changed) will emit via event bus | E2b defines event payload shapes; actual emission deferred to E3 |
| **E6 Frontend (future)** | Frontend calls GET /system/my-permissions on login and company switch; interprets `_fieldMeta` for field rendering | E2b API contracts must remain stable |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (TECH/SEC/PERF/DATA/BUS/OPS categories)
- `probability-impact.md` — Risk scoring methodology (1-3 scales, 6+ threshold)
- `test-levels-framework.md` — Test level selection (Unit > Integration > E2E pyramid)
- `test-priorities-matrix.md` — P0-P3 prioritization criteria

### Related Documents

- PRD: FR81, FR175-FR177, FR227-FR233
- Epic: `_bmad-output/planning-artifacts/epics/epic-overview.md` (E2b section)
- Epic: `_bmad-output/planning-artifacts/epics/epic-e2-api-server-auth-multi-company-rbac.md` (E2b follow-on section)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- API Contracts: `_bmad-output/planning-artifacts/api-contracts.md` (E2b endpoints)
- Data Models: `_bmad-output/planning-artifacts/data-models.md` (Resource, AccessGroup, AccessGroupPermission, AccessGroupFieldOverride, UserAccessGroup)
- Business Rules: `_bmad-output/planning-artifacts/business-rules-compendium.md` (BR-RBAC-001 through BR-RBAC-008, IMP-007)
- Event Catalog: `_bmad-output/planning-artifacts/event-catalog.md` (access_group.*, user_access_group.* events)
- Prior Test Design: `_bmad-output/test-artifacts/test-design-epic-E2.md`

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (BMad v6)
